import type { Passenger, FlightPlan, FlightStep, ScenarioData } from './types';

// Helper to create a deep copy of passengers
const deepCopy = <T>(obj: T): T => JSON.parse(JSON.stringify(obj));

/**
 * Generates a flight plan using a simple greedy algorithm based on passenger priority.
 * The helicopter fetches the highest priority passengers and returns to base.
 */
export function generatePlan(scenario: ScenarioData): FlightPlan {
  let remainingPassengers = deepCopy(scenario.passengers.filter(p => p.station > 0));
  const steps: FlightStep[] = [];
  let helicopterLoad: Passenger[] = [];
  let currentStation = 0;
  let transportedCount = 0;

  while (remainingPassengers.length > 0) {
    // Find the highest priority among remaining passengers
    const maxPriority = Math.min(...remainingPassengers.map(p => p.priority));
    const highPriorityPassengers = remainingPassengers.filter(p => p.priority === maxPriority);

    // Find the station with the highest priority passenger
    const targetStation = highPriorityPassengers[0].station;
    
    // 1. Travel to station
    if (currentStation !== targetStation) {
      steps.push({
        action: 'TRAVEL',
        station: targetStation,
        passengers: deepCopy(helicopterLoad),
        notes: `Flying to Station ${targetStation}`,
      });
      currentStation = targetStation;
    }

    // 2. Pick up passengers from this station
    const passengersAtStation = remainingPassengers.filter(p => p.station === currentStation).sort((a,b) => a.priority - b.priority);
    const passengersToPickup: Passenger[] = [];
    
    while(helicopterLoad.length < scenario.helicopterCapacity && passengersAtStation.length > 0) {
        const passenger = passengersAtStation.shift()!;
        helicopterLoad.push(passenger);
        passengersToPickup.push(passenger);
        remainingPassengers = remainingPassengers.filter(p => p.id !== passenger.id);
    }
    
    if (passengersToPickup.length > 0) {
        steps.push({
            action: 'PICKUP',
            station: currentStation,
            passengers: passengersToPickup,
            notes: `Picked up ${passengersToPickup.length} passenger(s).`,
        });
    }

    // 3. Travel back to base if helicopter is full or no more high-priority passengers are left at other stations
    const shouldReturnToBase = helicopterLoad.length === scenario.helicopterCapacity || remainingPassengers.filter(p => p.station !== 0).length === 0;

    if (shouldReturnToBase && currentStation !== 0) {
      steps.push({
        action: 'TRAVEL',
        station: 0,
        passengers: deepCopy(helicopterLoad),
        notes: 'Returning to Base.',
      });
      currentStation = 0;
    }

    // 4. Drop off at base
    if (currentStation === 0 && helicopterLoad.length > 0) {
      transportedCount += helicopterLoad.length;
      steps.push({
        action: 'DROPOFF',
        station: 0,
        passengers: deepCopy(helicopterLoad),
        notes: `Dropped off ${helicopterLoad.length} passenger(s) at Base.`,
      });
      helicopterLoad = [];
    }
  }

  return {
    id: 'priority_first',
    title: 'Plan A: Priority First',
    steps,
    metrics: {
      totalStops: steps.filter(s => s.action !== 'TRAVEL').length,
      totalDistance: steps.filter(s => s.action === 'TRAVEL').length,
      passengersTransported: transportedCount,
    },
  };
}


/**
 * Generates an alternative flight plan that tries to fill the helicopter before returning.
 */
export function generateAlternativePlan(scenario: ScenarioData): FlightPlan {
  let remainingPassengers = deepCopy(scenario.passengers.filter(p => p.station > 0));
  const steps: FlightStep[] = [];
  let helicopterLoad: Passenger[] = [];
  let currentStation = 0;
  let transportedCount = 0;

  while (remainingPassengers.length > 0) {
    // Start a new trip
    const tripOrder = Array.from(new Set(remainingPassengers.sort((a,b) => a.priority - b.priority).map(p => p.station)));
    
    for (const targetStation of tripOrder) {
        if(helicopterLoad.length >= scenario.helicopterCapacity) break;
        
        // 1. Travel to station
        if(currentStation !== targetStation) {
            steps.push({ action: 'TRAVEL', station: targetStation, passengers: deepCopy(helicopterLoad), notes: `Flying to Station ${targetStation}` });
            currentStation = targetStation;
        }

        // 2. Pick up
        const passengersAtStation = remainingPassengers.filter(p => p.station === currentStation).sort((a,b) => a.priority - b.priority);
        const passengersToPickup: Passenger[] = [];

        while(helicopterLoad.length < scenario.helicopterCapacity && passengersAtStation.length > 0) {
            const passenger = passengersAtStation.shift()!;
            helicopterLoad.push(passenger);
            passengersToPickup.push(passenger);
            remainingPassengers = remainingPassengers.filter(p => p.id !== passenger.id);
        }

        if (passengersToPickup.length > 0) {
            steps.push({ action: 'PICKUP', station: currentStation, passengers: passengersToPickup, notes: `Picked up ${passengersToPickup.length} pax.` });
        }
    }
    
    // After trip, return to base
    if (currentStation !== 0) {
        steps.push({ action: 'TRAVEL', station: 0, passengers: deepCopy(helicopterLoad), notes: 'Returning to Base.' });
        currentStation = 0;
    }

    // Drop off
    if (currentStation === 0 && helicopterLoad.length > 0) {
        transportedCount += helicopterLoad.length;
        steps.push({ action: 'DROPOFF', station: 0, passengers: deepCopy(helicopterLoad), notes: `Dropped off ${helicopterLoad.length} pax at Base.` });
        helicopterLoad = [];
    }
  }

  return {
    id: 'capacity_fill',
    title: 'Plan B: Capacity Fill',
    steps,
    metrics: {
        totalStops: steps.filter(s => s.action !== 'TRAVEL').length,
        totalDistance: steps.filter(s => s.action === 'TRAVEL').length,
        passengersTransported: transportedCount,
    },
  };
}
