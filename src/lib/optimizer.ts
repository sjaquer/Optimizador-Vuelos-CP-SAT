
import type { TransportItem, FlightPlan, FlightStep, ScenarioData } from './types';

const deepCopy = <T>(obj: T): T => JSON.parse(JSON.stringify(obj));

const stationCoords: Record<number, { x: number; y: number }> = {
  0: { x: 450, y: 350 },
  1: { x: 400, y: 250 },
  2: { x: 300, y: 300 },
  3: { x: 250, y: 150 },
  4: { x: 100, y: 200 },
  5: { x: 80, y: 100 },
  6: { x: 700, y: 500 },
  7: { x: 550, y: 80 },
  8: { x: 180, y: 450 },
};

const getDistance = (from: number, to: number): number => {
    const fromCoord = stationCoords[from];
    const toCoord = stationCoords[to];
    if (!fromCoord || !toCoord) return Infinity;
    // Using simple integer distance for simulation, not real-world units
    return Math.round(Math.sqrt(Math.pow(toCoord.x - fromCoord.x, 2) + Math.pow(toCoord.y - fromCoord.y, 2)));
};

const getNextClosestStation = (from: number, availableStations: number[]): number => {
    if (availableStations.length === 0) return -1;
    return availableStations.sort((a, b) => getDistance(from, a) - getDistance(from, b))[0];
};

export function runFlightSimulation(
    basePlan: FlightPlan,
    itemsToTransport: TransportItem[],
    scenario: ScenarioData,
    shift: 'M' | 'T'
): FlightPlan {
    const itemsToPickup = deepCopy(itemsToTransport);
    let itemsInHelicopter: TransportItem[] = [];
    const steps: FlightStep[] = [];
    let currentStation = 0;
    let itemsDelivered = 0;
    let totalWeightTransported = 0;
    let maxWeightRatio = 0;
    
    const strategy = basePlan.id.split('_')[1] as 'priority' | 'efficiency' | 'segments';

    const getCurrentWeight = () => itemsInHelicopter.reduce((sum, item) => sum + item.weight, 0);

    while (itemsToPickup.length > 0 || itemsInHelicopter.length > 0) {
        // 1. Drop off
        const itemsToDrop = itemsInHelicopter.filter(p => p.destinationStation === currentStation);
        if (itemsToDrop.length > 0) {
            itemsInHelicopter = itemsInHelicopter.filter(p => !itemsToDrop.find(dp => dp.id === p.id));
            itemsDelivered += itemsToDrop.length;
            totalWeightTransported += itemsToDrop.reduce((sum, item) => sum + item.weight, 0);
            steps.push({ action: 'DROPOFF', station: currentStation, items: itemsToDrop, notes: `Desembarque de ${itemsToDrop.length} item(s).` });
        }

        // 2. Pick up
        const capacityAvailable = scenario.helicopterCapacity - itemsInHelicopter.length;
        if (capacityAvailable > 0) {
            const itemsAvailableAtStation = itemsToPickup
                .filter(p => p.originStation === currentStation)
                .sort((a, b) => a.priority - b.priority);

            const pickedUp: TransportItem[] = [];
            for (const item of itemsAvailableAtStation) {
                if (itemsInHelicopter.length < scenario.helicopterCapacity && (getCurrentWeight() + item.weight) <= scenario.helicopterMaxWeight) {
                    itemsInHelicopter.push(item);
                    pickedUp.push(item);
                    const index = itemsToPickup.findIndex(pp => pp.id === item.id);
                    if (index > -1) itemsToPickup.splice(index, 1);
                } else {
                    break;
                }
            }
            if (pickedUp.length > 0) {
                steps.push({ action: 'PICKUP', station: currentStation, items: pickedUp, notes: `Embarque de ${pickedUp.length} item(s).` });
            }
        }
        
        maxWeightRatio = Math.max(maxWeightRatio, getCurrentWeight() / scenario.helicopterMaxWeight);

        // 3. Decide next move
        if (itemsToPickup.length === 0 && itemsInHelicopter.length === 0) break;

        const availablePickupStations = [...new Set(itemsToPickup.map(p => p.originStation))];
        const availableDropoffStations = [...new Set(itemsInHelicopter.map(p => p.destinationStation))];
        const allTargetStations = [...new Set([...availablePickupStations, ...availableDropoffStations])];

        if (allTargetStations.length === 0) break;

        let nextStation = -1;
        
        // Strategy-based decision
        if (strategy === 'priority') {
            const highPriorityPickup = itemsToPickup.sort((a,b) => a.priority - b.priority)[0]?.originStation;
            const targetStations = [...new Set([...availableDropoffStations, highPriorityPickup].filter(s => s !== undefined))]
            nextStation = getNextClosestStation(currentStation, targetStations.length > 0 ? targetStations : allTargetStations);
        } else if (strategy === 'efficiency') {
            if (itemsInHelicopter.length === scenario.helicopterCapacity && availableDropoffStations.length > 0) {
                nextStation = getNextClosestStation(currentStation, availableDropoffStations);
            } else {
                nextStation = getNextClosestStation(currentStation, allTargetStations);
            }
        } else if (strategy === 'segments') {
            if (itemsInHelicopter.length >= scenario.helicopterCapacity * 0.75 && availableDropoffStations.length > 0) {
                nextStation = getNextClosestStation(currentStation, availableDropoffStations);
            } else if (availablePickupStations.length > 0) {
                const stationCounts = availablePickupStations.map(s => ({ station: s, count: itemsToPickup.filter(p => p.originStation === s).length, dist: getDistance(currentStation, s) }));
                stationCounts.sort((a,b) => b.count - a.count || a.dist - b.dist);
                nextStation = stationCounts[0].station;
            } else {
                nextStation = getNextClosestStation(currentStation, availableDropoffStations);
            }
        }

        if (nextStation !== -1 && currentStation !== nextStation) {
            steps.push({ action: 'TRAVEL', station: nextStation, items: deepCopy(itemsInHelicopter), notes: `Volando de E-${currentStation} a E-${nextStation}` });
            currentStation = nextStation;
        } else if (itemsInHelicopter.length > 0 && availableDropoffStations.length > 0) {
             nextStation = getNextClosestStation(currentStation, availableDropoffStations.filter(s => s !== currentStation));
             if(nextStation !== -1 && currentStation !== nextStation) {
                steps.push({ action: 'TRAVEL', station: nextStation, items: deepCopy(itemsInHelicopter), notes: `Volando de E-${currentStation} a E-${nextStation}` });
                currentStation = nextStation;
             } else {
                break;
             }
        } else {
            break;
        }
    }

    if (currentStation !== 0) {
        steps.push({ action: 'TRAVEL', station: 0, items: [], notes: 'Regreso final a la base.' });
    }

    return {
        ...basePlan,
        id: `${basePlan.id.split('_').slice(0, 2).join('_')}_${shift}`,
        steps,
        metrics: {
            totalStops: new Set(steps.filter(s => s.action !== 'TRAVEL').map(s => s.station)).size,
            totalDistance: steps.filter(s => s.action === 'TRAVEL').length,
            itemsTransported: itemsDelivered,
            totalWeight: totalWeightTransported,
            maxWeightRatio,
        },
    };
}
