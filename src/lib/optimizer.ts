import type { TransportItem, FlightPlan, FlightStep, ScenarioData, StationConfig } from './types';
import { getDistance, buildNamesMap } from './stations';

const deepCopy = <T>(obj: T): T => JSON.parse(JSON.stringify(obj));

// ──── Station label helper (uses customStations when available) ──────
let _namesMap: Record<number, string> = {};
const stationLabel = (id: number) => _namesMap[id] ?? `E-${id}`;

// ──── Priority values and cost weights ─────────────────────────────────────────
const PRIORITY_VAL: Record<'ALTA' | 'MEDIA' | 'BAJA', number> = {
  ALTA: 1,
  MEDIA: 2,
  BAJA: 3,
};

const PRIORITY_COST: Record<'ALTA' | 'MEDIA' | 'BAJA', number> = {
  ALTA: 100,
  MEDIA: 10,
  BAJA: 1,
};

// ──── FIX #6: Improved scoring — considers total trip cost ──────────
// Higher priority items with shorter total trips (pickup + delivery) score better.
function scoreItem(
  item: TransportItem,
  currentStation: number,
  customStations?: StationConfig[],
): number {
  const distToOrigin = getDistance(currentStation, item.originStation, customStations);
  const distOriginToDest = getDistance(item.originStation, item.destinationStation, customStations);
  const totalTripCost = distToOrigin + distOriginToDest;
  const priorityCost = PRIORITY_COST[item.priority] || 10;
  // Higher priority (higher cost) + shorter trip = better score
  return priorityCost / Math.max(totalTripCost, 0.5);
}

// ──── Genuinely different variant strategies ────────────────

// Variant 0: Urgent route - ALTA priority first, then MEDIA, then BAJA.
function sortVariant0(items: TransportItem[], currentStation: number, customStations?: StationConfig[]): TransportItem[] {
  return [...items].sort((a, b) => {
    // Priority first
    if (a.priority !== b.priority) {
      return PRIORITY_VAL[a.priority] - PRIORITY_VAL[b.priority];
    }
    // Then nearest origin
    const dA = getDistance(currentStation, a.originStation, customStations);
    const dB = getDistance(currentStation, b.originStation, customStations);
    return dA - dB;
  });
}

// Variant 1: Consolidated route - group items by origin and destination pairs so they are consolidated
function sortVariant1(items: TransportItem[], customStations?: StationConfig[]): TransportItem[] {
  return [...items].sort((a, b) => {
    // Group by origin first
    if (a.originStation !== b.originStation) return a.originStation - b.originStation;
    // Then destination
    if (a.destinationStation !== b.destinationStation) return a.destinationStation - b.destinationStation;
    // Tie-break by priority
    return PRIORITY_VAL[a.priority] - PRIORITY_VAL[b.priority];
  });
}

// Variant 2: Cluster/Zone based route - segment destinations into 3 regions (near, medium, far)
function sortVariant2(items: TransportItem[], customStations?: StationConfig[]): TransportItem[] {
  const maxDist = Math.max(...items.map(i => getDistance(0, i.destinationStation, customStations)), 1);
  const zoneOf = (station: number) => {
    const d = getDistance(0, station, customStations);
    const z = Math.floor(d / maxDist * 3);
    return Math.min(z, 2);
  };

  return [...items].sort((a, b) => {
    const zA = zoneOf(a.destinationStation);
    const zB = zoneOf(b.destinationStation);
    if (zA !== zB) return zA - zB; // serve nearest zone first
    // Within zone, group by destination
    if (a.destinationStation !== b.destinationStation) return a.destinationStation - b.destinationStation;
    // Then priority
    return PRIORITY_VAL[a.priority] - PRIORITY_VAL[b.priority];
  });
}

function groupByVariant(
  items: TransportItem[],
  variant: number,
  currentStation: number,
  customStations?: StationConfig[],
): TransportItem[] {
  switch (variant) {
    case 1: return sortVariant1(items, customStations);
    case 2: return sortVariant2(items, customStations);
    default: return sortVariant0(items, currentStation, customStations);
  }
}

// ──── Core: build route for a type (PAX or CARGO) ───────────────────
function buildTypeRoute(
  allItems: TransportItem[],
  scenario: ScenarioData,
  variant: number = 0,
): { steps: FlightStep[]; totalDist: number; notDelivered: TransportItem[]; flightCount: number; refuelStops: number } {
  if (allItems.length === 0) return { steps: [], totalDist: 0, notDelivered: [], flightCount: 0, refuelStops: 0 };

  const cs = scenario.customStations;
  const pending = groupByVariant(allItems, variant, 0, cs);
  let helicopter: TransportItem[] = [];
  const steps: FlightStep[] = [];
  let currentStation = 0;
  let totalDist = 0;
  let flightNum = 0;
  let needsNewFlight = true;
  let refuelStops = 0;

  // FIX #8: Refuel tracking
  const refuelEnabled = scenario.refuelConfig?.enabled === true;
  const maxFlightDist = scenario.refuelConfig?.maxFlightDistance ?? Infinity;
  let distSinceBase = 0; // cumulative distance since last departure from base

  const weight = () => helicopter.reduce((s, i) => s + i.weight, 0);
  const typeShort = allItems[0].type;
  const legType = typeShort === 'PAX' ? 'PAX' as const : 'CARGO' as const;
  const isPax = typeShort === 'PAX';

  const boardSummary = (items: TransportItem[]) => {
    const w = items.reduce((s, i) => s + i.weight, 0);
    if (isPax) return `${items.length} pasajero(s), ${w} kg`;
    return `${items.length} bulto(s), ${w} kg`;
  };

  const onboardSummary = () => {
    if (helicopter.length === 0) return 'vacío';
    const w = weight();
    if (isPax) return `${helicopter.length} PAX a bordo (${w} kg)`;
    return `${helicopter.length} carga(s) a bordo (${w} kg)`;
  };

  // Helper: can we fit this item?
  // FIX #4: CARGO items only check weight, not seat capacity
  const canFit = (item: TransportItem): boolean => {
    if (weight() + item.weight > scenario.helicopterMaxWeight) return false;
    if (isPax && helicopter.length + 1 > scenario.helicopterCapacity) return false;
    return true;
  };

  // FIX #8: Insert refuel step if needed before travelling a given distance
  const maybeRefuel = (legDist: number): void => {
    if (!refuelEnabled) return;
    if (distSinceBase + legDist > maxFlightDist && currentStation !== 0) {
      // Need to return to base to refuel first
      const returnDist = getDistance(currentStation, 0, cs);
      totalDist += returnDist;
      distSinceBase += returnDist;
      steps.push({
        action: 'TRAVEL',
        station: 0,
        items: deepCopy(helicopter),
        legType: helicopter.length > 0 ? legType : 'EMPTY',
        notes: `[Vuelo #${flightNum}] ⛽ Retorno a Base para reabastecimiento desde ${stationLabel(currentStation)} (${returnDist} tramos)`,
      });
      currentStation = 0;
      steps.push({
        action: 'REFUEL',
        station: 0,
        items: [],
        notes: `[Vuelo #${flightNum}] ⛽ Reabastecimiento de combustible en ${stationLabel(0)}`,
      });
      refuelStops++;
      distSinceBase = 0;
    }
  };

  const MAX_ITERATIONS = 500;
  let iter = 0;

  while ((pending.length > 0 || helicopter.length > 0) && iter < MAX_ITERATIONS) {
    iter++;

    if (currentStation === 0 && needsNewFlight && (pending.length > 0 || helicopter.length > 0)) {
      flightNum++;
      needsNewFlight = false;
      distSinceBase = 0; // reset on new flight from base
    }

    // ── DROPOFF ──
    const toDrop = helicopter.filter(p => p.destinationStation === currentStation);
    if (toDrop.length > 0) {
      helicopter = helicopter.filter(p => !toDrop.some(dp => dp.id === p.id));
      steps.push({
        action: 'DROPOFF',
        station: currentStation,
        items: toDrop,
        legType,
        notes: `[Vuelo #${flightNum}] Desembarque en ${stationLabel(currentStation)}: ${boardSummary(toDrop)}. ${helicopter.length > 0 ? `Quedan ${onboardSummary()}.` : 'Helicóptero vacío.'}`,
      });
    }

    // ── PICKUP ──
    const available = pending
      .filter(p => p.originStation === currentStation)
      .sort((a, b) => PRIORITY_VAL[a.priority] - PRIORITY_VAL[b.priority]);

    const pickedUp: TransportItem[] = [];
    for (const item of available) {
      if (!canFit(item)) continue;
      helicopter.push(item);
      pickedUp.push(item);
      const idx = pending.findIndex(pp => pp.id === item.id);
      if (idx > -1) pending.splice(idx, 1);
    }

    if (pickedUp.length > 0) {
      const isBase = currentStation === 0;
      steps.push({
        action: 'PICKUP',
        station: currentStation,
        items: pickedUp,
        legType,
        notes: `[Vuelo #${flightNum}] ${isBase ? '🚁 Embarque en Base' : 'Embarque en'} ${stationLabel(currentStation)}: ${boardSummary(pickedUp)}. Total a bordo: ${onboardSummary()} (${Math.round(weight() / scenario.helicopterMaxWeight * 100)}% payload).`,
      });
    }

    if (pending.length === 0 && helicopter.length === 0) break;

    // ── CHOOSE NEXT STATION ──
    let nextStation = -1;

    if (helicopter.length > 0) {
      // Primary: go to nearest dropoff
      const dropoffs = [...new Set(helicopter.map(p => p.destinationStation))];

      if (variant === 1) {
        // Variant 1 (Option B): nearest dropoff (greedy)
        nextStation = dropoffs.sort((a, b) =>
          getDistance(currentStation, a, cs) - getDistance(currentStation, b, cs)
        )[0];
      } else if (variant === 2) {
        // Variant 2 (Option C): Zoned dropoff
        const maxDest = Math.max(...allItems.map(i => getDistance(0, i.destinationStation, cs)), 1);
        const zoneOf = (station: number) => {
          const d = getDistance(0, station, cs);
          const z = Math.floor(d / maxDest * 3);
          return Math.min(z, 2);
        };
        nextStation = dropoffs.sort((a, b) => {
          const zA = zoneOf(a);
          const zB = zoneOf(b);
          if (zA !== zB) return zA - zB;
          return getDistance(currentStation, a, cs) - getDistance(currentStation, b, cs);
        })[0];
      } else {
        // Variant 0 (Option A): Urgent dropoff
        // If there are ALTA items on board, go to nearest ALTA dropoff first
        const altaOnBoard = helicopter.filter(p => p.priority === 'ALTA');
        if (altaOnBoard.length > 0) {
          const altaDropoffs = [...new Set(altaOnBoard.map(p => p.destinationStation))];
          nextStation = altaDropoffs.sort((a, b) =>
            getDistance(currentStation, a, cs) - getDistance(currentStation, b, cs)
          )[0];
        } else {
          nextStation = dropoffs.sort((a, b) =>
            getDistance(currentStation, a, cs) - getDistance(currentStation, b, cs)
          )[0];
        }
      }

      // FIX #1: POOLING — check intermediate stations for pending pickups along the route
      if (pending.length > 0 && nextStation !== currentStation) {
        const routeDist = getDistance(currentStation, nextStation, cs);
        // Check all stations with pending items
        const intermediateOrigins = [...new Set(pending.map(p => p.originStation))].filter(
          s => s !== currentStation && s !== nextStation
        );
        for (const midStation of intermediateOrigins) {
          const detour = getDistance(currentStation, midStation, cs) + getDistance(midStation, nextStation, cs) - routeDist;
          if (detour <= 1) {
            // Check if we have capacity to pick up something there
            const midItems = pending.filter(p => p.originStation === midStation);
            const canPickAny = midItems.some(item => canFit(item));
            if (canPickAny) {
              // Divert to this intermediate station first
              nextStation = midStation;
              break;
            }
          }
        }
      }
    } else if (pending.length > 0) {
      if (variant === 1) {
        // Variant 1 (Option B): consolidated - fly to the origin with highest pending payload
        const origins = [...new Set(pending.map(p => p.originStation))];
        let bestStation = -1;
        let maxWeight = -1;
        for (const origin of origins) {
          const stationItems = pending.filter(p => p.originStation === origin);
          const totalWeight = stationItems.reduce((sum, item) => sum + item.weight, 0);
          if (totalWeight > maxWeight) {
            maxWeight = totalWeight;
            bestStation = origin;
          }
        }
        nextStation = bestStation;
      } else if (variant === 2) {
        // Variant 2 (Option C): cluster-based — pick the origin whose items belong to the nearest incomplete zone
        const maxDest = Math.max(...allItems.map(i => getDistance(0, i.destinationStation, cs)), 1);
        const zoneOf = (station: number) => {
          const d = getDistance(0, station, cs);
          const z = Math.floor(d / maxDest * 3);
          return Math.min(z, 2);
        };

        const pendingZones = pending.map(i => zoneOf(i.destinationStation));
        const minZone = Math.min(...pendingZones);
        const zoneItems = pending.filter(i => zoneOf(i.destinationStation) === minZone);
        const origins = [...new Set(zoneItems.map(p => p.originStation))];
        // Nearest origin in that zone
        nextStation = origins.sort((a, b) => getDistance(currentStation, a, cs) - getDistance(currentStation, b, cs))[0];
      } else {
        // Variant 0 (Option A): urgent - pick the station that has the highest urgency items
        // If there are ALTA items pending, only consider their origins
        const altaPending = pending.filter(i => i.priority === 'ALTA');
        const activePending = altaPending.length > 0 ? altaPending : pending;

        let bestScore = -1;
        let bestStation = -1;
        const origins = [...new Set(activePending.map(p => p.originStation))];
        for (const origin of origins) {
          const stationItems = activePending.filter(p => p.originStation === origin);
          const totalScore = stationItems.reduce((sum, item) => sum + scoreItem(item, currentStation, cs), 0);
          if (totalScore > bestScore) {
            bestScore = totalScore;
            bestStation = origin;
          }
        }
        nextStation = bestStation;
      }
    }

    if (nextStation !== -1 && nextStation !== currentStation) {
      const legDist = getDistance(currentStation, nextStation, cs);
      // FIX #8: check refuel before travel
      maybeRefuel(legDist);
      // Recalculate distance from current position (may have changed due to refuel)
      const actualDist = getDistance(currentStation, nextStation, cs);
      totalDist += actualDist;
      distSinceBase += actualDist;
      const currentLegType = helicopter.length > 0 ? legType : 'EMPTY' as const;
      steps.push({
        action: 'TRAVEL',
        station: nextStation,
        items: deepCopy(helicopter),
        legType: currentLegType,
        notes: `[Vuelo #${flightNum}] ${stationLabel(currentStation)} → ${stationLabel(nextStation)} (${actualDist} tramos) · ${onboardSummary()}`,
      });
      currentStation = nextStation;
    } else if (helicopter.length > 0 && currentStation !== 0) {
      const legDist = getDistance(currentStation, 0, cs);
      maybeRefuel(legDist);
      const actualDist = getDistance(currentStation, 0, cs);
      totalDist += actualDist;
      distSinceBase += actualDist;
      steps.push({
        action: 'TRAVEL', station: 0, items: deepCopy(helicopter),
        legType,
        notes: `[Vuelo #${flightNum}] Regresando a Base desde ${stationLabel(currentStation)} (${actualDist} tramos) · ${onboardSummary()}`,
      });
      currentStation = 0;
    } else if (helicopter.length === 0 && pending.length > 0 && currentStation !== 0) {
      const legDist = getDistance(currentStation, 0, cs);
      maybeRefuel(legDist);
      const actualDist = getDistance(currentStation, 0, cs);
      totalDist += actualDist;
      distSinceBase += actualDist;
      steps.push({
        action: 'TRAVEL', station: 0, items: [],
        legType: 'EMPTY',
        notes: `[Vuelo #${flightNum}] Regreso a Base desde ${stationLabel(currentStation)} para nuevo vuelo (${actualDist} tramos) · vacío`,
      });
      currentStation = 0;
      needsNewFlight = true;
    } else {
      break;
    }
  }

  // Final return to base
  if (currentStation !== 0 && steps.length > 0) {
    const legDist = getDistance(currentStation, 0, cs);
    maybeRefuel(legDist);
    const actualDist = getDistance(currentStation, 0, cs);
    totalDist += actualDist;
    steps.push({
      action: 'TRAVEL', station: 0, items: [],
      legType: 'EMPTY',
      notes: `[Vuelo #${flightNum}] Regreso final a ${stationLabel(0)}.`,
    });
  }

  // FIX #5: flight count based on flightNum counter
  return { steps, totalDist, notDelivered: [...pending], flightCount: flightNum, refuelStops };
}

// ──── Build complete route: PAX + CARGO separated ───────────────────
function buildRoute(
  allItems: TransportItem[],
  scenario: ScenarioData,
  variant: number = 0,
): { steps: FlightStep[]; totalDistanceUnits: number; notDelivered: TransportItem[]; totalFlights: number; refuelStops: number } {
  const cs = scenario.customStations;
  const paxItems = allItems.filter(i => i.type === 'PAX');
  const cargoItems = allItems.filter(i => i.type === 'CARGO');

  // Determine type order: prioritize the type with highest-urgency items
  let typeOrder: ('PAX' | 'CARGO')[];
  if (variant === 1) {
    // Variant 1: CARGO first (farthest destinations often cargo)
    typeOrder = ['CARGO', 'PAX'];
  } else {
    const bestPax = paxItems.length > 0 ? Math.min(...paxItems.map(i => PRIORITY_VAL[i.priority])) : Infinity;
    const bestCargo = cargoItems.length > 0 ? Math.min(...cargoItems.map(i => PRIORITY_VAL[i.priority])) : Infinity;
    typeOrder = bestPax <= bestCargo ? ['PAX', 'CARGO'] : ['CARGO', 'PAX'];
  }

  const allSteps: FlightStep[] = [];
  let totalDist = 0;
  let totalFlights = 0;
  let totalRefuelStops = 0;
  const allNotDelivered: TransportItem[] = [];

  for (const type of typeOrder) {
    const items = type === 'PAX' ? paxItems : cargoItems;
    if (items.length === 0) continue;

    // Ensure we start from base between type switches
    if (allSteps.length > 0) {
      const lastStep = allSteps[allSteps.length - 1];
      if (lastStep.station !== 0) {
        const legDist = getDistance(lastStep.station, 0, cs);
        totalDist += legDist;
        allSteps.push({
          action: 'TRAVEL', station: 0, items: [],
          legType: 'EMPTY',
          notes: `Regreso a Base para iniciar vuelos de ${type === 'PAX' ? 'Pasajeros' : 'Carga'} · vacío`,
        });
      }
    }

    const result = buildTypeRoute(items, scenario, variant);
    allSteps.push(...result.steps);
    totalDist += result.totalDist;
    totalFlights += result.flightCount;
    totalRefuelStops += result.refuelStops;
    allNotDelivered.push(...result.notDelivered);
  }

  return { steps: allSteps, totalDistanceUnits: totalDist, notDelivered: allNotDelivered, totalFlights, refuelStops: totalRefuelStops };
}

// ──── Metrics computation ───────────────────────────────────────────
function computeMetrics(
  steps: FlightStep[],
  totalDistanceUnits: number,
  scenario: ScenarioData,
  notDelivered: TransportItem[],
  totalFlights: number,
  refuelStops: number,
  impossibleItems: number,
): FlightPlan['metrics'] {
  const travelSteps = steps.filter(s => s.action === 'TRAVEL');
  const dropoffSteps = steps.filter(s => s.action === 'DROPOFF');
  const itemsDelivered = dropoffSteps.flatMap(s => s.items).length;
  const totalWeight = dropoffSteps.flatMap(s => s.items).reduce((s, i) => s + i.weight, 0);
  const stopsSet = new Set(steps.filter(s => s.action !== 'TRAVEL' && s.action !== 'REFUEL').map(s => s.station));

  let totalLoadRatio = 0;
  let maxWeightRatio = 0;
  for (const leg of travelSteps) {
    const legWeight = leg.items.reduce((s, i) => s + i.weight, 0);
    const ratio = legWeight / scenario.helicopterMaxWeight;
    totalLoadRatio += ratio;
    maxWeightRatio = Math.max(maxWeightRatio, ratio);
  }
  const avgLoadRatio = travelSteps.length > 0 ? totalLoadRatio / travelSteps.length : 0;

  return {
    totalStops: stopsSet.size,
    totalDistance: totalDistanceUnits,
    totalLegs: travelSteps.length,
    itemsTransported: itemsDelivered,
    itemsNotDelivered: notDelivered.length,
    totalWeight,
    maxWeightRatio,
    avgLoadRatio,
    // FIX #5: use flightNum counter instead of base departure tracking
    totalFlights: Math.max(totalFlights, steps.length > 0 ? 1 : 0),
    // FIX #8: new metrics
    refuelStops,
    impossibleItems,
  };
}

// ──── Public API ────────────────────────────────────────────────────
const VARIANT_LABELS: Record<number, string> = {
  0: 'Opción A: Ruta Urgente',
  1: 'Opción B: Ruta Consolidada',
  2: 'Opción C: Ruta por Zonas',
};

export function runFlightOptimization(
  itemsToTransport: TransportItem[],
  scenario: ScenarioData,
  shift: 'M' | 'T',
  variant: number = 0,
): FlightPlan {
  const cs = scenario.customStations;

  // Initialize namesMap for stationLabel helper
  _namesMap = buildNamesMap(cs);

  const emptyMetrics: FlightPlan['metrics'] = {
    totalStops: 0, totalDistance: 0, totalLegs: 0,
    itemsTransported: 0, itemsNotDelivered: 0,
    totalWeight: 0, maxWeightRatio: 0, avgLoadRatio: 0, totalFlights: 0,
    refuelStops: 0, impossibleItems: 0,
  };

  const planId = variant === 0 ? `optimized_${shift}` : `alt${variant}_${shift}`;
  const label = VARIANT_LABELS[variant] || `Alternativa ${variant}`;
  const planTitle = `${label} — Turno ${shift === 'M' ? 'Mañana' : 'Tarde'}`;

  if (itemsToTransport.length === 0) {
    return {
      id: planId,
      title: planTitle,
      description: 'Sin requerimientos para este turno.',
      steps: [],
      metrics: emptyMetrics,
    };
  }

  // FIX #3: Preserve original description when expanding PAX
  const expandedItems: TransportItem[] = deepCopy(itemsToTransport).flatMap((item: TransportItem) => {
    if (item.type === 'PAX' && item.quantity > 1) {
      return Array.from({ length: item.quantity }, (_, i) => ({
        ...item,
        id: `${item.id}-${i}`,
        quantity: 1,
        description: item.description && item.description.trim() !== ''
          ? item.description
          : `${item.area}-PAX`,
      }));
    }
    return [item];
  });

  // FIX #2: Filter out impossible items (individual weight > helicopterMaxWeight)
  const impossibleItems: TransportItem[] = [];
  const feasibleItems: TransportItem[] = [];
  for (const item of expandedItems) {
    if (item.weight > scenario.helicopterMaxWeight) {
      impossibleItems.push(item);
    } else {
      feasibleItems.push(item);
    }
  }

  // Build route with feasible items only
  const { steps, totalDistanceUnits, notDelivered, totalFlights, refuelStops } = buildRoute(feasibleItems, scenario, variant);

  // Impossible items go to notDelivered with a message
  const impossibleAsNotDelivered = impossibleItems.map(item => ({
    ...item,
    description: `⚠ IMPOSIBLE: peso (${item.weight} kg) excede capacidad máxima (${scenario.helicopterMaxWeight} kg). ${item.description || ''}`.trim(),
  }));
  const allNotDelivered = [...notDelivered, ...impossibleAsNotDelivered];

  const metrics = computeMetrics(steps, totalDistanceUnits, scenario, allNotDelivered, totalFlights, refuelStops, impossibleItems.length);

  return {
    id: planId,
    title: planTitle,
    description: variant === 0
      ? 'Ruta Urgente (Opción A): Prioriza al máximo la entrega inmediata de los requerimientos de prioridad ALTA.'
      : variant === 1
      ? 'Ruta Consolidada (Opción B): Agrupa y consolida pasajeros y bultos por cercanía y peso para minimizar las distancias de vuelo.'
      : 'Ruta por Zonas (Opción C): Segmenta geográficamente las estaciones por zonas (cercana, media y lejana) para realizar entregas secuenciales sin idas y vueltas.',
    steps,
    metrics,
  };
}
