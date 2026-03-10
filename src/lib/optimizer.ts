import type { TransportItem, FlightPlan, FlightStep, ScenarioData } from './types';
import { getDistance, stationNamesMap } from './stations';

const deepCopy = <T>(obj: T): T => JSON.parse(JSON.stringify(obj));

type Strategy = 'mixed_efficiency' | 'pure_efficiency' | 'pax_priority' | 'cargo_priority';

const getClosest = (from: number, stations: number[]): number => {
  if (stations.length === 0) return -1;
  return [...stations].sort((a, b) => getDistance(from, a) - getDistance(from, b))[0];
};

// ──── Strategy configuration ─────────────────────────────────────────
interface StrategyConfig {
  /** Allow mixing PAX and CARGO in same flight */
  allowMix: boolean;
  /** Sort items for pickup priority. Lower = picked first */
  sortItems: (a: TransportItem, b: TransportItem) => number;
  /** Filter which pending items to consider when choosing next pickup station */
  filterPendingForNextStation: (items: TransportItem[]) => TransportItem[];
  /** Choose next station logic override (null = use default nearest) */
  chooseNext: 'nearest_dropoff_first' | 'maximize_load' | 'nearest_any';
}

const strategyConfigs: Record<Strategy, StrategyConfig> = {
  mixed_efficiency: {
    allowMix: true,
    sortItems: (a, b) => a.priority - b.priority,
    filterPendingForNextStation: (items) => items,
    chooseNext: 'maximize_load',
  },
  pure_efficiency: {
    allowMix: false,
    sortItems: (a, b) => a.priority - b.priority,
    filterPendingForNextStation: (items) => items,
    chooseNext: 'nearest_any',
  },
  pax_priority: {
    allowMix: false,
    sortItems: (a, b) => {
      if (a.type !== b.type) return a.type === 'PAX' ? -1 : 1;
      return a.priority - b.priority;
    },
    filterPendingForNextStation: (items) => {
      const pax = items.filter(i => i.type === 'PAX');
      return pax.length > 0 ? pax : items;
    },
    chooseNext: 'nearest_dropoff_first',
  },
  cargo_priority: {
    allowMix: false,
    sortItems: (a, b) => {
      if (a.type !== b.type) return a.type === 'CARGO' ? -1 : 1;
      return a.priority - b.priority;
    },
    filterPendingForNextStation: (items) => {
      const cargo = items.filter(i => i.type === 'CARGO');
      return cargo.length > 0 ? cargo : items;
    },
    chooseNext: 'nearest_dropoff_first',
  },
};

// ──── Core simulation ────────────────────────────────────────────────
function buildRoute(
  strategy: Strategy,
  allItems: TransportItem[],
  scenario: ScenarioData
): { steps: FlightStep[]; totalDistanceUnits: number; notDelivered: TransportItem[] } {
  const config = strategyConfigs[strategy];
  const pending = [...allItems];
  let helicopter: TransportItem[] = [];
  const steps: FlightStep[] = [];
  let currentStation = 0;
  let totalDist = 0;
  let totalWeightTransported = 0;

  const weight = () => helicopter.reduce((s, i) => s + i.weight, 0);
  const seats = () => helicopter.length;
  const heliType = (): 'PAX' | 'CARGO' | null => helicopter[0]?.type ?? null;

  const stationLabel = (id: number) => stationNamesMap[id] ? `E-${id}` : `E-${id}`;

  let safetyCounter = 0;
  const MAX_ITERATIONS = 200;

  while ((pending.length > 0 || helicopter.length > 0) && safetyCounter < MAX_ITERATIONS) {
    safetyCounter++;

    // ── DROPOFF at current station ──
    const toDrop = helicopter.filter(p => p.destinationStation === currentStation);
    if (toDrop.length > 0) {
      helicopter = helicopter.filter(p => !toDrop.find(dp => dp.id === p.id));
      totalWeightTransported += toDrop.reduce((s, i) => s + i.weight, 0);
      steps.push({
        action: 'DROPOFF',
        station: currentStation,
        items: toDrop,
        notes: `Desembarque de ${toDrop.length} item(s) en ${stationLabel(currentStation)}.`,
      });
    }

    // ── PICKUP at current station ──
    const canPickType = (type: 'PAX' | 'CARGO'): boolean => {
      if (config.allowMix) return true;
      const current = heliType();
      return current === null || current === type;
    };

    const available = pending
      .filter(p => p.originStation === currentStation && canPickType(p.type))
      .sort(config.sortItems);

    const pickedUp: TransportItem[] = [];
    for (const item of available) {
      if (!canPickType(item.type)) continue;
      if (seats() + 1 > scenario.helicopterCapacity) break;
      if (weight() + item.weight > scenario.helicopterMaxWeight) continue;

      helicopter.push(item);
      pickedUp.push(item);
      const idx = pending.findIndex(pp => pp.id === item.id);
      if (idx > -1) pending.splice(idx, 1);
    }

    if (pickedUp.length > 0) {
      steps.push({
        action: 'PICKUP',
        station: currentStation,
        items: pickedUp,
        notes: `Embarque de ${pickedUp.length} item(s) en ${stationLabel(currentStation)}.`,
      });
    }

    // ── EXIT if done ──
    if (pending.length === 0 && helicopter.length === 0) break;

    // ── CHOOSE NEXT STATION ──
    let nextStation = -1;

    if (config.chooseNext === 'maximize_load' && helicopter.length === 0 && pending.length > 0) {
      // For mixed_efficiency: prefer station with most items to maximize load factor
      const stationCounts = new Map<number, number>();
      for (const item of config.filterPendingForNextStation(pending)) {
        stationCounts.set(item.originStation, (stationCounts.get(item.originStation) || 0) + 1);
      }
      let bestStation = -1;
      let bestScore = -1;
      for (const [station, count] of stationCounts) {
        // Score = items at station / distance to station (higher is better)
        const dist = getDistance(currentStation, station);
        const score = dist > 0 ? count / dist : count;
        if (score > bestScore) {
          bestScore = score;
          bestStation = station;
        }
      }
      nextStation = bestStation;
    }

    if (nextStation === -1 && helicopter.length > 0) {
      const dropoffStations = [...new Set(helicopter.map(p => p.destinationStation))];
      nextStation = getClosest(currentStation, dropoffStations);
    }

    if (nextStation === -1 && pending.length > 0) {
      const filtered = config.filterPendingForNextStation(pending);
      const pickupStations = [...new Set(filtered.map(p => p.originStation))];
      nextStation = getClosest(currentStation, pickupStations);
    }

    if (nextStation !== -1 && nextStation !== currentStation) {
      const legDist = getDistance(currentStation, nextStation);
      totalDist += legDist;
      steps.push({
        action: 'TRAVEL',
        station: nextStation,
        items: deepCopy(helicopter),
        notes: `Volando de ${stationLabel(currentStation)} a ${stationLabel(nextStation)} (${legDist} ud)`,
      });
      currentStation = nextStation;
    } else if (helicopter.length > 0 && currentStation !== 0) {
      const legDist = getDistance(currentStation, 0);
      totalDist += legDist;
      steps.push({
        action: 'TRAVEL',
        station: 0,
        items: deepCopy(helicopter),
        notes: `Regresando a base desde ${stationLabel(currentStation)} (${legDist} ud)`,
      });
      currentStation = 0;
    } else {
      break;
    }
  }

  // Return to base if not there
  if (currentStation !== 0 && steps.length > 0) {
    const legDist = getDistance(currentStation, 0);
    totalDist += legDist;
    steps.push({ action: 'TRAVEL', station: 0, items: [], notes: 'Regreso final a la base.' });
  }

  return { steps, totalDistanceUnits: totalDist, notDelivered: pending };
}

// ──── 2-opt local improvement on TRAVEL legs ─────────────────────────
function applyTwoOpt(steps: FlightStep[]): FlightStep[] {
  const travelIndices = steps.map((s, i) => s.action === 'TRAVEL' ? i : -1).filter(i => i !== -1);
  if (travelIndices.length < 4) return steps;

  let improved = true;
  const result = [...steps];

  while (improved) {
    improved = false;
    for (let i = 0; i < travelIndices.length - 2; i++) {
      for (let j = i + 2; j < travelIndices.length; j++) {
        const idxA = travelIndices[i];
        const idxB = travelIndices[j];
        const stationA = result[idxA].station;
        const stationB = result[idxB].station;
        const prevA = i > 0 ? result[travelIndices[i - 1]].station : 0;
        const nextB = j < travelIndices.length - 1 ? result[travelIndices[j + 1]].station : 0;

        const currentCost = getDistance(prevA, stationA) + getDistance(stationB, nextB);
        const swapCost = getDistance(prevA, stationB) + getDistance(stationA, nextB);

        if (swapCost < currentCost) {
          // Swap the two travel step stations
          const tempStation = result[idxA].station;
          result[idxA] = { ...result[idxA], station: result[idxB].station };
          result[idxB] = { ...result[idxB], station: tempStation };
          improved = true;
        }
      }
    }
  }
  return result;
}

// ──── Metrics calculation ────────────────────────────────────────────
function computeMetrics(
  steps: FlightStep[],
  totalDistanceUnits: number,
  totalInputItems: number,
  scenario: ScenarioData,
  notDelivered: TransportItem[]
): FlightPlan['metrics'] {
  const travelSteps = steps.filter(s => s.action === 'TRAVEL');
  const dropoffSteps = steps.filter(s => s.action === 'DROPOFF');
  const itemsDelivered = dropoffSteps.flatMap(s => s.items).length;
  const totalWeight = dropoffSteps.flatMap(s => s.items).reduce((s, i) => s + i.weight, 0);

  const stopsSet = new Set(steps.filter(s => s.action !== 'TRAVEL').map(s => s.station));

  // Count flights (cycles from base to base)
  let flights = 0;
  let leftBase = false;
  for (const step of travelSteps) {
    if (!leftBase && step.station !== 0) leftBase = true;
    if (leftBase && step.station === 0) {
      flights++;
      leftBase = false;
    }
  }
  if (leftBase) flights++; // Incomplete flight

  // Average load ratio across travel legs
  let totalLoadRatio = 0;
  for (const leg of travelSteps) {
    const legWeight = leg.items.reduce((s, i) => s + i.weight, 0);
    totalLoadRatio += legWeight / scenario.helicopterMaxWeight;
  }
  const avgLoadRatio = travelSteps.length > 0 ? totalLoadRatio / travelSteps.length : 0;

  // Max weight ratio
  let maxWeightRatio = 0;
  for (const leg of travelSteps) {
    const legWeight = leg.items.reduce((s, i) => s + i.weight, 0);
    maxWeightRatio = Math.max(maxWeightRatio, legWeight / scenario.helicopterMaxWeight);
  }

  return {
    totalStops: stopsSet.size,
    totalDistance: totalDistanceUnits,
    totalLegs: travelSteps.length,
    itemsTransported: itemsDelivered,
    itemsNotDelivered: notDelivered.length,
    totalWeight,
    maxWeightRatio,
    avgLoadRatio,
    totalFlights: Math.max(flights, 1),
  };
}

// ──── Public API ─────────────────────────────────────────────────────
export function runFlightSimulation(
  basePlan: FlightPlan,
  itemsToTransport: TransportItem[],
  scenario: ScenarioData,
  shift: 'M' | 'T'
): FlightPlan {
  const emptyMetrics: FlightPlan['metrics'] = {
    totalStops: 0, totalDistance: 0, totalLegs: 0,
    itemsTransported: 0, itemsNotDelivered: 0,
    totalWeight: 0, maxWeightRatio: 0, avgLoadRatio: 0, totalFlights: 0,
  };

  if (itemsToTransport.length === 0) {
    return { ...basePlan, id: `${basePlan.id}_${shift}`, steps: [], metrics: emptyMetrics };
  }

  // Expand PAX with quantity > 1 into individual items
  const expandedItems = deepCopy(itemsToTransport).flatMap(item => {
    if (item.type === 'PAX' && item.quantity > 1) {
      return Array.from({ length: item.quantity }, (_, i) => ({
        ...item,
        id: `${item.id}-${i}`,
        quantity: 1,
        description: `${item.area}-PAX`,
      }));
    }
    return item;
  });

  const strategy = basePlan.id as Strategy;
  const { steps, totalDistanceUnits, notDelivered } = buildRoute(strategy, expandedItems, scenario);

  // Apply 2-opt improvement for pure_efficiency strategy
  const optimizedSteps = strategy === 'pure_efficiency' ? applyTwoOpt(steps) : steps;

  // Recalculate distance after 2-opt
  let finalDistance = totalDistanceUnits;
  if (strategy === 'pure_efficiency' && optimizedSteps !== steps) {
    finalDistance = 0;
    const travelLegs = optimizedSteps.filter(s => s.action === 'TRAVEL');
    let prevStation = 0;
    for (const leg of travelLegs) {
      finalDistance += getDistance(prevStation, leg.station);
      prevStation = leg.station;
    }
  }

  const metrics = computeMetrics(optimizedSteps, finalDistance, expandedItems.length, scenario, notDelivered);

  return {
    ...basePlan,
    id: `${basePlan.id}_${shift}`,
    steps: optimizedSteps,
    metrics,
  };
}
