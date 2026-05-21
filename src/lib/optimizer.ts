import type { TransportItem, FlightPlan, FlightStep, ScenarioData, StationConfig } from './types';
import { getDistance, buildNamesMap } from './stations';

const deepCopy = <T>(obj: T): T => JSON.parse(JSON.stringify(obj));

// ──── Station label helper (uses customStations when available) ──────
let _namesMap: Record<number, string> = {};
const stationLabel = (id: number) => _namesMap[id] ?? `E-${id}`;

// ──── Priority cost weights ─────────────────────────────────────────
const PRIORITY_COST: Record<number, number> = {
  1: 100,
  2: 10,
  3: 1,
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
  const priorityCost = PRIORITY_COST[item.priority] || 1;
  // Higher priority (higher cost) + shorter trip = better score
  return priorityCost / Math.max(totalTripCost, 0.5);
}

// ──── FIX #7: Genuinely different variant strategies ────────────────

// Variant 0: Greedy nearest-first with priority weighting
function sortVariant0(items: TransportItem[], currentStation: number, customStations?: StationConfig[]): TransportItem[] {
  return [...items].sort((a, b) => {
    // Priority first
    if (a.priority !== b.priority) return a.priority - b.priority;
    // Then nearest origin
    const dA = getDistance(currentStation, a.originStation, customStations);
    const dB = getDistance(currentStation, b.originStation, customStations);
    return dA - dB;
  });
}

// Variant 1: Farthest-destination-first — serve the most remote stations first
function sortVariant1(items: TransportItem[], customStations?: StationConfig[]): TransportItem[] {
  return [...items].sort((a, b) => {
    // Farthest destination first (from base = station 0)
    const dA = getDistance(0, a.destinationStation, customStations);
    const dB = getDistance(0, b.destinationStation, customStations);
    if (dA !== dB) return dB - dA; // descending: farthest first
    // Tie-break by priority
    return a.priority - b.priority;
  });
}

// Variant 2: Cluster-based — group items by destination zone, serve each zone fully
function sortVariant2(items: TransportItem[], customStations?: StationConfig[]): TransportItem[] {
  // Cluster destinations into zones (thirds of max distance from base)
  const maxDist = Math.max(...items.map(i => getDistance(0, i.destinationStation, customStations)), 1);
  const zoneOf = (station: number) => Math.floor(getDistance(0, station, customStations) / maxDist * 3);

  return [...items].sort((a, b) => {
    const zA = zoneOf(a.destinationStation);
    const zB = zoneOf(b.destinationStation);
    if (zA !== zB) return zA - zB; // serve nearest zone first
    // Within zone, group by destination
    if (a.destinationStation !== b.destinationStation) return a.destinationStation - b.destinationStation;
    // Then priority
    return a.priority - b.priority;
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
      .sort((a, b) => a.priority - b.priority);

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
        // Variant 1: farthest dropoff first
        nextStation = dropoffs.sort((a, b) =>
          getDistance(0, b, cs) - getDistance(0, a, cs)
        )[0];
      } else {
        // Default & variant 2: nearest dropoff
        nextStation = dropoffs.sort((a, b) =>
          getDistance(currentStation, a, cs) - getDistance(currentStation, b, cs)
        )[0];
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
        // Variant 1: pick up items destined for the farthest station
        let bestDist = -1;
        let bestStation = -1;
        const origins = [...new Set(pending.map(p => p.originStation))];
        for (const origin of origins) {
          const stationItems = pending.filter(p => p.originStation === origin);
          const maxDestDist = Math.max(...stationItems.map(i => getDistance(0, i.destinationStation, cs)));
          if (maxDestDist > bestDist) {
            bestDist = maxDestDist;
            bestStation = origin;
          }
        }
        nextStation = bestStation;
      } else if (variant === 2) {
        // Variant 2: cluster-based — pick the origin whose items belong to the nearest incomplete zone
        const maxDest = Math.max(...pending.map(i => getDistance(0, i.destinationStation, cs)), 1);
        const zoneOf = (station: number) => Math.floor(getDistance(0, station, cs) / maxDest * 3);

        // Find nearest zone that still has pending items
        const zones = [...new Set(pending.map(i => zoneOf(i.destinationStation)))].sort((a, b) => a - b);
        const targetZone = zones[0];
        const zoneItems = pending.filter(i => zoneOf(i.destinationStation) === targetZone);
        const origins = [...new Set(zoneItems.map(p => p.originStation))];
        // Nearest origin in that zone
        nextStation = origins.sort((a, b) => getDistance(currentStation, a, cs) - getDistance(currentStation, b, cs))[0];
      } else {
        // Variant 0: greedy nearest — best scoring station
        let bestScore = -1;
        let bestStation = -1;
        const origins = [...new Set(pending.map(p => p.originStation))];
        for (const origin of origins) {
          const stationItems = pending.filter(p => p.originStation === origin);
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
    const bestPax = paxItems.length > 0 ? Math.min(...paxItems.map(i => i.priority)) : Infinity;
    const bestCargo = cargoItems.length > 0 ? Math.min(...cargoItems.map(i => i.priority)) : Infinity;
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
  0: 'Plan Óptimo',
  1: 'Alternativa A',
  2: 'Alternativa B',
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
      ? 'Optimización greedy: máxima eficiencia por cercanía y prioridad. PAX y Carga en vuelos separados.'
      : variant === 1
      ? 'Alternativa: destinos más remotos primero para minimizar viajes largos de retorno. PAX y Carga separados.'
      : 'Alternativa: agrupación por zonas de destino, sirviendo cada zona completamente. PAX y Carga separados.',
    steps,
    metrics,
  };
}
