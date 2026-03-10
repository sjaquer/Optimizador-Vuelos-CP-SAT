import type { TransportItem, FlightPlan, FlightStep, ScenarioData } from './types';
import { getDistance, stationNamesMap } from './stations';

const deepCopy = <T>(obj: T): T => JSON.parse(JSON.stringify(obj));

export type Strategy = 'strict_priority' | 'shortest_route' | 'max_load' | 'balanced';

const getClosest = (from: number, targets: number[]): number => {
  if (targets.length === 0) return -1;
  return [...targets].sort((a, b) => getDistance(from, a) - getDistance(from, b))[0];
};

const stationLabel = (id: number) => stationNamesMap[id] ?? `E-${id}`;

// ──── Regla fundamental: PAX y CARGO NUNCA se mezclan ────────────────
// El optimizador separa internamente los items por tipo y genera
// vuelos exclusivos para cada tipo. El orden en que se procesan
// los tipos depende de la estrategia elegida.

// ──── Strategy ordering ──────────────────────────────────────────────
function getTypeOrder(strategy: Strategy, paxItems: TransportItem[], cargoItems: TransportItem[]): ('PAX' | 'CARGO')[] {
  switch (strategy) {
    case 'strict_priority': {
      // Tipo con el item de mayor prioridad (menor número) va primero
      const bestPax = paxItems.length > 0 ? Math.min(...paxItems.map(i => i.priority)) : Infinity;
      const bestCargo = cargoItems.length > 0 ? Math.min(...cargoItems.map(i => i.priority)) : Infinity;
      return bestPax <= bestCargo ? ['PAX', 'CARGO'] : ['CARGO', 'PAX'];
    }
    case 'shortest_route':
    case 'balanced':
      return ['PAX', 'CARGO']; // PAX primero por defecto
    case 'max_load':
      // Tipo con más peso total va primero para maximizar uso de capacidad
      const paxW = paxItems.reduce((s, i) => s + i.weight, 0);
      const cargoW = cargoItems.reduce((s, i) => s + i.weight, 0);
      return cargoW >= paxW ? ['CARGO', 'PAX'] : ['PAX', 'CARGO'];
  }
}

// ──── Item sorting per strategy ──────────────────────────────────────
function sortItems(strategy: Strategy, items: TransportItem[]): TransportItem[] {
  const sorted = [...items];
  switch (strategy) {
    case 'strict_priority':
      sorted.sort((a, b) => a.priority - b.priority);
      break;
    case 'shortest_route':
      // Sort by origin station proximity to base, then priority
      sorted.sort((a, b) => {
        const dA = getDistance(0, a.originStation);
        const dB = getDistance(0, b.originStation);
        return dA !== dB ? dA - dB : a.priority - b.priority;
      });
      break;
    case 'max_load':
      // Heavier items first to fill capacity, then priority
      sorted.sort((a, b) => b.weight - a.weight || a.priority - b.priority);
      break;
    case 'balanced':
      // Priority first, then weight desc
      sorted.sort((a, b) => a.priority - b.priority || b.weight - a.weight);
      break;
  }
  return sorted;
}

// ──── Choose next station per strategy ───────────────────────────────
function chooseNextStation(
  strategy: Strategy,
  currentStation: number,
  helicopter: TransportItem[],
  pending: TransportItem[],
): number {
  // If carrying items, always go to nearest dropoff
  if (helicopter.length > 0) {
    const dropoffs = [...new Set(helicopter.map(p => p.destinationStation))];
    return getClosest(currentStation, dropoffs);
  }

  if (pending.length === 0) return -1;

  switch (strategy) {
    case 'max_load': {
      // Go to station with most items (density score)
      const stationCounts = new Map<number, number>();
      for (const item of pending) {
        stationCounts.set(item.originStation, (stationCounts.get(item.originStation) || 0) + 1);
      }
      let best = -1, bestScore = -1;
      for (const [station, count] of stationCounts) {
        const dist = getDistance(currentStation, station);
        const score = dist > 0 ? count / dist : count;
        if (score > bestScore) { bestScore = score; best = station; }
      }
      return best;
    }
    case 'shortest_route': {
      // Nearest pickup station
      const pickupStations = [...new Set(pending.map(p => p.originStation))];
      return getClosest(currentStation, pickupStations);
    }
    case 'strict_priority': {
      // Go to station of highest priority pending item
      const sorted = [...pending].sort((a, b) => a.priority - b.priority);
      return sorted[0].originStation;
    }
    case 'balanced': {
      // Score: priority weight + distance weight
      const stationScores = new Map<number, number>();
      for (const item of pending) {
        const dist = getDistance(currentStation, item.originStation);
        // Higher priority (lower number) + shorter distance = better score
        const score = (6 - item.priority) / Math.max(dist, 1);
        stationScores.set(item.originStation, (stationScores.get(item.originStation) || 0) + score);
      }
      let best = -1, bestScore = -1;
      for (const [station, score] of stationScores) {
        if (score > bestScore) { bestScore = score; best = station; }
      }
      return best;
    }
  }
}

// ──── Core simulation for a single type group ────────────────────────
function buildTypeRoute(
  strategy: Strategy,
  allItems: TransportItem[],
  scenario: ScenarioData,
): { steps: FlightStep[]; totalDist: number; notDelivered: TransportItem[] } {
  if (allItems.length === 0) return { steps: [], totalDist: 0, notDelivered: [] };

  const pending = sortItems(strategy, allItems);
  let helicopter: TransportItem[] = [];
  const steps: FlightStep[] = [];
  let currentStation = 0;
  let totalDist = 0;

  const weight = () => helicopter.reduce((s, i) => s + i.weight, 0);
  const seats = () => helicopter.length;

  const MAX_ITERATIONS = 300;
  let iter = 0;

  while ((pending.length > 0 || helicopter.length > 0) && iter < MAX_ITERATIONS) {
    iter++;

    // ── DROPOFF at current station ──
    const toDrop = helicopter.filter(p => p.destinationStation === currentStation);
    if (toDrop.length > 0) {
      helicopter = helicopter.filter(p => !toDrop.some(dp => dp.id === p.id));
      steps.push({
        action: 'DROPOFF',
        station: currentStation,
        items: toDrop,
        notes: `Desembarque de ${toDrop.length} ítem(s) en ${stationLabel(currentStation)}.`,
      });
    }

    // ── PICKUP at current station (same type guaranteed) ──
    const available = pending
      .filter(p => p.originStation === currentStation)
      .sort((a, b) => a.priority - b.priority);

    const pickedUp: TransportItem[] = [];
    for (const item of available) {
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
        notes: `Embarque de ${pickedUp.length} ítem(s) en ${stationLabel(currentStation)}.`,
      });
    }

    if (pending.length === 0 && helicopter.length === 0) break;

    // ── CHOOSE NEXT STATION ──
    const nextStation = chooseNextStation(strategy, currentStation, helicopter, pending);

    if (nextStation !== -1 && nextStation !== currentStation) {
      const legDist = getDistance(currentStation, nextStation);
      totalDist += legDist;
      steps.push({
        action: 'TRAVEL',
        station: nextStation,
        items: deepCopy(helicopter),
        notes: `Volando ${stationLabel(currentStation)} → ${stationLabel(nextStation)} (${legDist} ud)`,
      });
      currentStation = nextStation;
    } else if (helicopter.length > 0 && currentStation !== 0) {
      // Return to base
      const legDist = getDistance(currentStation, 0);
      totalDist += legDist;
      steps.push({
        action: 'TRAVEL', station: 0, items: deepCopy(helicopter),
        notes: `Regresando a base desde ${stationLabel(currentStation)} (${legDist} ud)`,
      });
      currentStation = 0;
    } else if (helicopter.length === 0 && pending.length > 0 && currentStation !== 0) {
      // Go back to base to start a new flight
      const legDist = getDistance(currentStation, 0);
      totalDist += legDist;
      steps.push({
        action: 'TRAVEL', station: 0, items: [],
        notes: `Regreso a base desde ${stationLabel(currentStation)} para nuevo vuelo (${legDist} ud)`,
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
    steps.push({ action: 'TRAVEL', station: 0, items: [], notes: `Regreso final a ${stationLabel(0)}.` });
  }

  return { steps, totalDist, notDelivered: [...pending] };
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

// ──── Build complete route: PAX flights + CARGO flights ──────────────
function buildRoute(
  strategy: Strategy,
  allItems: TransportItem[],
  scenario: ScenarioData,
): { steps: FlightStep[]; totalDistanceUnits: number; notDelivered: TransportItem[] } {
  const paxItems = allItems.filter(i => i.type === 'PAX');
  const cargoItems = allItems.filter(i => i.type === 'CARGO');
  const typeOrder = getTypeOrder(strategy, paxItems, cargoItems);

  const allSteps: FlightStep[] = [];
  let totalDist = 0;
  const allNotDelivered: TransportItem[] = [];

  for (const type of typeOrder) {
    const items = type === 'PAX' ? paxItems : cargoItems;
    if (items.length === 0) continue;

    // Add a separator travel note if we already have steps (returning from previous type group)
    if (allSteps.length > 0) {
      const lastStep = allSteps[allSteps.length - 1];
      if (lastStep.station !== 0) {
        const legDist = getDistance(lastStep.station, 0);
        totalDist += legDist;
        allSteps.push({
          action: 'TRAVEL', station: 0, items: [],
          notes: `Regreso a base para iniciar vuelos de ${type === 'PAX' ? 'Pasajeros' : 'Carga'}.`,
        });
      }
    }

    const result = buildTypeRoute(strategy, items, scenario);
    allSteps.push(...result.steps);
    totalDist += result.totalDist;
    allNotDelivered.push(...result.notDelivered);
  }

  // Apply 2-opt on shortest_route strategy
  const optimizedSteps = strategy === 'shortest_route' ? applyTwoOpt(allSteps) : allSteps;

  // Recalculate distance after 2-opt
  if (strategy === 'shortest_route' && optimizedSteps !== allSteps) {
    totalDist = 0;
    let prevStation = 0;
    for (const step of optimizedSteps) {
      if (step.action === 'TRAVEL') {
        totalDist += getDistance(prevStation, step.station);
        prevStation = step.station;
      }
    }
  }

  return { steps: optimizedSteps, totalDistanceUnits: totalDist, notDelivered: allNotDelivered };
}

// ──── Metrics calculation ────────────────────────────────────────────
function computeMetrics(
  steps: FlightStep[],
  totalDistanceUnits: number,
  scenario: ScenarioData,
  notDelivered: TransportItem[]
): FlightPlan['metrics'] {
  const travelSteps = steps.filter(s => s.action === 'TRAVEL');
  const dropoffSteps = steps.filter(s => s.action === 'DROPOFF');
  const itemsDelivered = dropoffSteps.flatMap(s => s.items).length;
  const totalWeight = dropoffSteps.flatMap(s => s.items).reduce((s, i) => s + i.weight, 0);
  const stopsSet = new Set(steps.filter(s => s.action !== 'TRAVEL').map(s => s.station));

  let flights = 0, leftBase = false;
  for (const step of travelSteps) {
    if (!leftBase && step.station !== 0) leftBase = true;
    if (leftBase && step.station === 0) { flights++; leftBase = false; }
  }
  if (leftBase) flights++;

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
  const expandedItems: TransportItem[] = deepCopy(itemsToTransport).flatMap((item: TransportItem) => {
    if (item.type === 'PAX' && item.quantity > 1) {
      return Array.from({ length: item.quantity }, (_, i) => ({
        ...item,
        id: `${item.id}-${i}`,
        quantity: 1,
        description: `${item.area}-PAX`,
      }));
    }
    return [item];
  });

  const strategy = basePlan.id as Strategy;
  const { steps, totalDistanceUnits, notDelivered } = buildRoute(strategy, expandedItems, scenario);
  const metrics = computeMetrics(steps, totalDistanceUnits, scenario, notDelivered);

  return {
    ...basePlan,
    id: `${basePlan.id}_${shift}`,
    steps,
    metrics,
  };
}
