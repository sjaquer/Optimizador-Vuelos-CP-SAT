
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

    // --- Key Change: Expand PAX items into individual items ---
    const allItemsToPickup = deepCopy(itemsToTransport).flatMap(item => {
        if (item.type === 'PAX' && item.quantity > 1) {
            return Array.from({ length: item.quantity }, (_, i) => ({
                ...item,
                id: `${item.id}-${i}`, // Give each a unique ID
                quantity: 1,
                description: `${item.area}-PAX`,
            }));
        }
        return item;
    });
    
    let itemsInHelicopter: TransportItem[] = [];
    const steps: FlightStep[] = [];
    let currentStation = 0;
    let totalWeightTransported = 0;
    let maxWeightRatio = 0;
    
    const strategy: 'pax_priority' | 'cargo_priority' | 'mixed_efficiency' | 'pure_efficiency' = basePlan.id as any;

    const getCurrentWeight = () => itemsInHelicopter.reduce((sum, item) => sum + item.weight, 0); // Quantity is always 1 now
    const getCurrentSeatCount = () => itemsInHelicopter.length; // Each item takes one "seat"
    const getCurrentItemType = (): 'PAX' | 'CARGO' | null => itemsInHelicopter[0]?.type ?? null;

    let emergencyExit = 0; // Failsafe to prevent infinite loops
    while ((allItemsToPickup.length > 0 || itemsInHelicopter.length > 0) && emergencyExit < 100) {
        emergencyExit++;

        // 1. Drop off
        const itemsToDrop = itemsInHelicopter.filter(p => p.destinationStation === currentStation);
        if (itemsToDrop.length > 0) {
            itemsInHelicopter = itemsInHelicopter.filter(p => !itemsToDrop.find(dp => dp.id === p.id));
            totalWeightTransported += itemsToDrop.reduce((sum, item) => sum + item.weight, 0);
            steps.push({ action: 'DROPOFF', station: currentStation, items: itemsToDrop, notes: `Desembarque de ${itemsToDrop.length} item(s).` });
        }

        // 2. Pick up - respecting segregation
        const currentTypeInHeli = getCurrentItemType();
        const pickupableTypes = currentTypeInHeli ? [currentTypeInHeli] : ['PAX', 'CARGO'];

        const itemsAvailableAtStation = allItemsToPickup
            .filter(p => p.originStation === currentStation && pickupableTypes.includes(p.type))
            .sort((a, b) => {
                if (strategy === 'pax_priority') {
                    if (a.type !== b.type) return a.type === 'PAX' ? -1 : 1;
                }
                if (strategy === 'cargo_priority') {
                     if (a.type !== b.type) return a.type === 'CARGO' ? -1 : 1;
                }
                return a.priority - b.priority;
            });

        const pickedUpItems: TransportItem[] = [];
        for (const item of itemsAvailableAtStation) {
            const seatsAfterPickup = getCurrentSeatCount() + 1; // Each item is 1 "seat"
            const weightAfterPickup = getCurrentWeight() + item.weight;

            if ((itemsInHelicopter.length === 0 || item.type === getCurrentItemType()) &&
                seatsAfterPickup <= scenario.helicopterCapacity &&
                weightAfterPickup <= scenario.helicopterMaxWeight)
            {
                itemsInHelicopter.push(item);
                pickedUpItems.push(item);
                const index = allItemsToPickup.findIndex(pp => pp.id === item.id);
                if (index > -1) allItemsToPickup.splice(index, 1);
            }
        }

        if (pickedUpItems.length > 0) {
            steps.push({ action: 'PICKUP', station: currentStation, items: pickedUpItems, notes: `Embarque de ${pickedUpItems.length} item(s).` });
        }
        
        maxWeightRatio = Math.max(maxWeightRatio, getCurrentWeight() / scenario.helicopterMaxWeight);

        // 3. Decide next move
        if (allItemsToPickup.length === 0 && itemsInHelicopter.length === 0) break;

        let nextStation = -1;
        
        // Priority 1: Drop off items currently in helicopter
        if (itemsInHelicopter.length > 0) {
            const dropoffStations = [...new Set(itemsInHelicopter.map(p => p.destinationStation))];
            nextStation = getNextClosestStation(currentStation, dropoffStations);
        }

        // Priority 2: If empty, or after dropoff, pick up something new
        if (nextStation === -1 && allItemsToPickup.length > 0) {
            let potentialPickups = allItemsToPickup;
            if (strategy === 'pax_priority') {
                const paxItems = allItemsToPickup.filter(i => i.type === 'PAX');
                if (paxItems.length > 0) potentialPickups = paxItems;
            } else if (strategy === 'cargo_priority') {
                const cargoItems = allItemsToPickup.filter(i => i.type === 'CARGO');
                if (cargoItems.length > 0) potentialPickups = cargoItems;
            }
            
            const pickupStations = [...new Set(potentialPickups.map(p => p.originStation))];
            nextStation = getNextClosestStation(currentStation, pickupStations);
        }

        if (nextStation !== -1 && currentStation !== nextStation) {
            steps.push({ action: 'TRAVEL', station: nextStation, items: deepCopy(itemsInHelicopter), notes: `Volando de E-${currentStation} a E-${nextStation}` });
            currentStation = nextStation;
        } else if (itemsInHelicopter.length > 0 && currentStation !== 0) {
            // Failsafe: Stuck with items, must return to base
            steps.push({ action: 'TRAVEL', station: 0, items: deepCopy(itemsInHelicopter), notes: `Failsafe: Regresando a base desde E-${currentStation}.` });
            currentStation = 0;
        } else {
            break; // No more moves possible
        }
    }

    if (currentStation !== 0 && steps.length > 0) {
        steps.push({ action: 'TRAVEL', station: 0, items: [], notes: 'Regreso final a la base.' });
    }
    
    const itemsDelivered = steps.filter(s => s.action === 'DROPOFF').flatMap(s => s.items).length;

    return {
        ...basePlan,
        id: `${basePlan.id}_${shift}`,
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
