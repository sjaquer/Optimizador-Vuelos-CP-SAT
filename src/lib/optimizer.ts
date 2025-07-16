
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
    let totalWeightTransported = 0;
    let maxWeightRatio = 0;
    
    const strategy: 'pax_priority' | 'cargo_priority' | 'mixed_efficiency' = basePlan.id.split('_').slice(0, 2).join('_') as any;

    const getCurrentWeight = () => itemsInHelicopter.reduce((sum, item) => sum + (item.weight * item.quantity), 0);
    const getCurrentSeatCount = () => itemsInHelicopter.reduce((sum, item) => sum + (item.type === 'PAX' ? item.quantity : 1), 0);
    const getCurrentItemType = (): 'PAX' | 'CARGO' | null => itemsInHelicopter[0]?.type ?? null;

    while (itemsToPickup.length > 0 || itemsInHelicopter.length > 0) {
        // 1. Drop off
        const itemsToDrop = itemsInHelicopter.filter(p => p.destinationStation === currentStation);
        if (itemsToDrop.length > 0) {
            itemsInHelicopter = itemsInHelicopter.filter(p => !itemsToDrop.find(dp => dp.id === p.id));
            totalWeightTransported += itemsToDrop.reduce((sum, item) => sum + (item.weight * item.quantity), 0);
            steps.push({ action: 'DROPOFF', station: currentStation, items: itemsToDrop, notes: `Desembarque de ${itemsToDrop.reduce((s,i) => s + i.quantity, 0)} item(s).` });
        }

        // 2. Pick up - respecting new constraints
        const currentTypeInHeli = getCurrentItemType();
        
        // Determine what can be picked up. If heli is empty, can pick up anything.
        // If not empty, can only pick up more of the same type.
        const pickupableTypes = currentTypeInHeli ? [currentTypeInHeli] : ['PAX', 'CARGO'];

        // Sort available items based on strategy
        const itemsAvailableAtStation = itemsToPickup
            .filter(p => p.originStation === currentStation && pickupableTypes.includes(p.type))
            .sort((a, b) => {
                if (strategy === 'pax_priority') {
                    if (a.type !== b.type) return a.type === 'PAX' ? -1 : 1; // PAX first
                }
                if (strategy === 'cargo_priority') {
                     if (a.type !== b.type) return a.type === 'CARGO' ? -1 : 1; // CARGO first
                }
                return a.priority - b.priority; // Then by priority
            });

        const pickedUp: TransportItem[] = [];
        for (const item of itemsAvailableAtStation) {
            const seatsAfterPickup = getCurrentSeatCount() + (item.type === 'PAX' ? item.quantity : 1);
            const weightAfterPickup = getCurrentWeight() + (item.weight * item.quantity);

            // Check if heli is empty OR if item type matches what's already inside
            if ((itemsInHelicopter.length === 0 || item.type === getCurrentItemType()) &&
                seatsAfterPickup <= scenario.helicopterCapacity &&
                weightAfterPickup <= scenario.helicopterMaxWeight)
            {
                itemsInHelicopter.push(item);
                pickedUp.push(item);
                const index = itemsToPickup.findIndex(pp => pp.id === item.id);
                if (index > -1) itemsToPickup.splice(index, 1);
            }
        }
        if (pickedUp.length > 0) {
            steps.push({ action: 'PICKUP', station: currentStation, items: pickedUp, notes: `Embarque de ${pickedUp.reduce((s,i) => s + i.quantity, 0)} item(s).` });
        }
        
        maxWeightRatio = Math.max(maxWeightRatio, getCurrentWeight() / scenario.helicopterMaxWeight);

        // 3. Decide next move
        if (itemsToPickup.length === 0 && itemsInHelicopter.length === 0) break;

        let nextStation = -1;
        
        // If helicopter has items, priority is to drop them off.
        if (itemsInHelicopter.length > 0) {
            const dropoffStations = [...new Set(itemsInHelicopter.map(p => p.destinationStation))];
            nextStation = getNextClosestStation(currentStation, dropoffStations);
        }

        // If no drop-offs possible or heli is empty, decide what to pick up next.
        if (nextStation === -1 && itemsToPickup.length > 0) {
            let potentialPickups = itemsToPickup;
            if (strategy === 'pax_priority') {
                const paxItems = itemsToPickup.filter(i => i.type === 'PAX');
                if (paxItems.length > 0) potentialPickups = paxItems;
            } else if (strategy === 'cargo_priority') {
                const cargoItems = itemsToPickup.filter(i => i.type === 'CARGO');
                if (cargoItems.length > 0) potentialPickups = cargoItems;
            }
            
            const pickupStations = [...new Set(potentialPickups.map(p => p.originStation))];
            nextStation = getNextClosestStation(currentStation, pickupStations);
        }

        if (nextStation !== -1 && currentStation !== nextStation) {
            steps.push({ action: 'TRAVEL', station: nextStation, items: deepCopy(itemsInHelicopter), notes: `Volando de E-${currentStation} a E-${nextStation}` });
            currentStation = nextStation;
        } else if (itemsInHelicopter.length > 0) { // Failsafe to return to base if stuck
             const dropoffStations = [...new Set(itemsInHelicopter.map(p => p.destinationStation))];
             const finalAttemptStation = getNextClosestStation(currentStation, dropoffStations.filter(s => s !== currentStation));
             if(finalAttemptStation !== -1) {
                steps.push({ action: 'TRAVEL', station: finalAttemptStation, items: deepCopy(itemsInHelicopter), notes: `Volando de E-${currentStation} a E-${finalAttemptStation}` });
                currentStation = finalAttemptStation;
             } else {
                 break;
             }
        } else {
            break; // No more moves
        }
    }

    if (currentStation !== 0) {
        steps.push({ action: 'TRAVEL', station: 0, items: [], notes: 'Regreso final a la base.' });
    }
    
    const itemsDelivered = steps.filter(s => s.action === 'DROPOFF').flatMap(s => s.items).reduce((sum, item) => sum + item.quantity, 0);

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
