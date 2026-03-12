import type { TransportItem, FlightPlan, FlightStep, ScenarioData } from './types';
import { getDistance, stationNamesMap } from './stations';

const deepCopy = <T>(obj: T): T => JSON.parse(JSON.stringify(obj));

const stationLabel = (id: number) => stationNamesMap[id] ?? `E-${id}`;

// ──── Costos de penalización por prioridad ────────────────────────────
// Prioridad 1 = urgente: penalización muy alta si no se atiende pronto
// Prioridad 2 = estándar
// Prioridad 3 = baja prioridad
const PRIORITY_COST: Record<number, number> = {
  1: 100,
  2: 10,
  3: 1,
};

// ──── Scoring para elegir siguiente destino ──────────────────────────
function scoreItem(item: TransportItem, currentStation: number): number {
  const dist = getDistance(currentStation, item.originStation);
  const priorityCost = PRIORITY_COST[item.priority] || 1;
  return priorityCost / Math.max(dist, 0.5);
}

// ──── Agrupación eficiente: items con destinos cercanos ──────────────
function groupByProximity(items: TransportItem[]): TransportItem[] {
  return [...items].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.destinationStation - b.destinationStation;
  });
}

// ──── Core: construir ruta para un tipo (PAX o CARGO) ────────────────
function buildTypeRoute(
  allItems: TransportItem[],
  scenario: ScenarioData,
): { steps: FlightStep[]; totalDist: number; notDelivered: TransportItem[] } {
  if (allItems.length === 0) return { steps: [], totalDist: 0, notDelivered: [] };

  const pending = groupByProximity(allItems);
  let helicopter: TransportItem[] = [];
  const steps: FlightStep[] = [];
  let currentStation = 0;
  let totalDist = 0;
  let flightNum = 0;
  let needsNewFlight = true;

  const weight = () => helicopter.reduce((s, i) => s + i.weight, 0);
  const typeShort = allItems[0].type;
  const legType = typeShort === 'PAX' ? 'PAX' as const : 'CARGO' as const;

  const boardSummary = (items: TransportItem[]) => {
    const w = items.reduce((s, i) => s + i.weight, 0);
    if (typeShort === 'PAX') return `${items.length} pasajero(s), ${w} kg`;
    return `${items.length} bulto(s), ${w} kg`;
  };

  const onboardSummary = () => {
    if (helicopter.length === 0) return 'vacío';
    const w = weight();
    if (typeShort === 'PAX') return `${helicopter.length} PAX a bordo (${w} kg)`;
    return `${helicopter.length} carga(s) a bordo (${w} kg)`;
  };

  const MAX_ITERATIONS = 300;
  let iter = 0;

  while ((pending.length > 0 || helicopter.length > 0) && iter < MAX_ITERATIONS) {
    iter++;

    if (currentStation === 0 && needsNewFlight && (pending.length > 0 || helicopter.length > 0)) {
      flightNum++;
      needsNewFlight = false;
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
      if (helicopter.length + 1 > scenario.helicopterCapacity) break;
      if (weight() + item.weight > scenario.helicopterMaxWeight) continue;
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

    // ── ELEGIR SIGUIENTE ESTACIÓN ──
    let nextStation = -1;

    if (helicopter.length > 0) {
      const dropoffs = [...new Set(helicopter.map(p => p.destinationStation))];
      nextStation = dropoffs.sort((a, b) => getDistance(currentStation, a) - getDistance(currentStation, b))[0];
    } else if (pending.length > 0) {
      let bestScore = -1;
      let bestStation = -1;
      const origins = [...new Set(pending.map(p => p.originStation))];
      for (const origin of origins) {
        const stationItems = pending.filter(p => p.originStation === origin);
        const totalScore = stationItems.reduce((sum, item) => sum + scoreItem(item, currentStation), 0);
        if (totalScore > bestScore) {
          bestScore = totalScore;
          bestStation = origin;
        }
      }
      nextStation = bestStation;
    }

    if (nextStation !== -1 && nextStation !== currentStation) {
      const legDist = getDistance(currentStation, nextStation);
      totalDist += legDist;
      const currentLegType = helicopter.length > 0 ? legType : 'EMPTY' as const;
      steps.push({
        action: 'TRAVEL',
        station: nextStation,
        items: deepCopy(helicopter),
        legType: currentLegType,
        notes: `[Vuelo #${flightNum}] ${stationLabel(currentStation)} → ${stationLabel(nextStation)} (${legDist} tramos) · ${onboardSummary()}`,
      });
      currentStation = nextStation;
    } else if (helicopter.length > 0 && currentStation !== 0) {
      const legDist = getDistance(currentStation, 0);
      totalDist += legDist;
      steps.push({
        action: 'TRAVEL', station: 0, items: deepCopy(helicopter),
        legType,
        notes: `[Vuelo #${flightNum}] Regresando a Base desde ${stationLabel(currentStation)} (${legDist} tramos) · ${onboardSummary()}`,
      });
      currentStation = 0;
    } else if (helicopter.length === 0 && pending.length > 0 && currentStation !== 0) {
      const legDist = getDistance(currentStation, 0);
      totalDist += legDist;
      steps.push({
        action: 'TRAVEL', station: 0, items: [],
        legType: 'EMPTY',
        notes: `[Vuelo #${flightNum}] Regreso a Base desde ${stationLabel(currentStation)} para nuevo vuelo (${legDist} tramos) · vacío`,
      });
      currentStation = 0;
      needsNewFlight = true;
    } else {
      break;
    }
  }

  if (currentStation !== 0 && steps.length > 0) {
    const legDist = getDistance(currentStation, 0);
    totalDist += legDist;
    steps.push({
      action: 'TRAVEL', station: 0, items: [],
      legType: 'EMPTY',
      notes: `[Vuelo #${flightNum}] Regreso final a ${stationLabel(0)}.`,
    });
  }

  return { steps, totalDist, notDelivered: [...pending] };
}

// ──── Construir ruta completa: PAX + CARGO separados ─────────────────
function buildRoute(
  allItems: TransportItem[],
  scenario: ScenarioData,
): { steps: FlightStep[]; totalDistanceUnits: number; notDelivered: TransportItem[] } {
  const paxItems = allItems.filter(i => i.type === 'PAX');
  const cargoItems = allItems.filter(i => i.type === 'CARGO');

  const bestPax = paxItems.length > 0 ? Math.min(...paxItems.map(i => i.priority)) : Infinity;
  const bestCargo = cargoItems.length > 0 ? Math.min(...cargoItems.map(i => i.priority)) : Infinity;
  const typeOrder: ('PAX' | 'CARGO')[] = bestPax <= bestCargo ? ['PAX', 'CARGO'] : ['CARGO', 'PAX'];

  const allSteps: FlightStep[] = [];
  let totalDist = 0;
  const allNotDelivered: TransportItem[] = [];

  for (const type of typeOrder) {
    const items = type === 'PAX' ? paxItems : cargoItems;
    if (items.length === 0) continue;

    if (allSteps.length > 0) {
      const lastStep = allSteps[allSteps.length - 1];
      if (lastStep.station !== 0) {
        const legDist = getDistance(lastStep.station, 0);
        totalDist += legDist;
        allSteps.push({
          action: 'TRAVEL', station: 0, items: [],
          legType: 'EMPTY',
          notes: `Regreso a Base para iniciar vuelos de ${type === 'PAX' ? 'Pasajeros' : 'Carga'} · vacío`,
        });
      }
    }

    const result = buildTypeRoute(items, scenario);
    allSteps.push(...result.steps);
    totalDist += result.totalDist;
    allNotDelivered.push(...result.notDelivered);
  }

  return { steps: allSteps, totalDistanceUnits: totalDist, notDelivered: allNotDelivered };
}

// ──── Cálculo de métricas ────────────────────────────────────────────
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

// ──── API Pública ────────────────────────────────────────────────────
export function runFlightOptimization(
  itemsToTransport: TransportItem[],
  scenario: ScenarioData,
  shift: 'M' | 'T'
): FlightPlan {
  const emptyMetrics: FlightPlan['metrics'] = {
    totalStops: 0, totalDistance: 0, totalLegs: 0,
    itemsTransported: 0, itemsNotDelivered: 0,
    totalWeight: 0, maxWeightRatio: 0, avgLoadRatio: 0, totalFlights: 0,
  };

  const planId = `optimized_${shift}`;
  const planTitle = `Plan Óptimo — Turno ${shift === 'M' ? 'Mañana' : 'Tarde'}`;

  if (itemsToTransport.length === 0) {
    return {
      id: planId,
      title: planTitle,
      description: 'Sin requerimientos para este turno.',
      steps: [],
      metrics: emptyMetrics,
    };
  }

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

  const { steps, totalDistanceUnits, notDelivered } = buildRoute(expandedItems, scenario);
  const metrics = computeMetrics(steps, totalDistanceUnits, scenario, notDelivered);

  return {
    id: planId,
    title: planTitle,
    description: 'Optimización única: máxima eficiencia con penalización por prioridad. PAX y Carga en vuelos separados. Agrupación de tramos consecutivos.',
    steps,
    metrics,
  };
}
