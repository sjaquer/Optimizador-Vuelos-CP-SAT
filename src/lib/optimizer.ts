import type { Passenger, FlightPlan, FlightStep, ScenarioData } from './types';

// Helper to create a deep copy
const deepCopy = <T>(obj: T): T => JSON.parse(JSON.stringify(obj));

interface Itinerary {
  passengersToPickup: Passenger[];
  passengersToDropoff: Passenger[];
}

/**
 * Generates a flight plan focused on serving the highest-priority passengers first,
 * while trying to optimize pickups and drop-offs along the way.
 */
export function generatePlan(scenario: ScenarioData): FlightPlan {
  const passengersToPickup = deepCopy(scenario.passengers);
  let passengersInHelicopter: Passenger[] = [];
  const steps: FlightStep[] = [];
  let currentStation = 0; // Start at base
  let passengersDelivered = 0;

  while (passengersToPickup.length > 0 || passengersInHelicopter.length > 0) {
    // Determine next stops based on passengers in helicopter and those waiting
    const dropoffStations = passengersInHelicopter.map(p => p.destinationStation);
    const pickupStations = passengersToPickup.sort((a,b) => a.priority - b.priority).map(p => p.originStation);
    
    // Simple strategy: prioritize drop-offs, then highest-priority pickups
    const targetStations = [...new Set([...dropoffStations, ...pickupStations])];

    if (targetStations.length === 0) break; // Should not happen if loop condition is correct

    const nextStation = targetStations[0];

    // 1. Travel to the next station
    if (currentStation !== nextStation) {
      steps.push({
        action: 'TRAVEL',
        station: nextStation,
        passengers: deepCopy(passengersInHelicopter),
        notes: `Volando de Estación ${currentStation} a Estación ${nextStation}`,
      });
      currentStation = nextStation;
    }

    // 2. Drop off passengers destined for the current station
    const passengersToDrop = passengersInHelicopter.filter(p => p.destinationStation === currentStation);
    if (passengersToDrop.length > 0) {
      passengersInHelicopter = passengersInHelicopter.filter(p => !passengersToDrop.find(dp => dp.id === p.id));
      passengersDelivered += passengersToDrop.length;
      steps.push({
        action: 'DROPOFF',
        station: currentStation,
        passengers: passengersToDrop,
        notes: `Desembarque de ${passengersToDrop.length} pasajero(s).`,
      });
    }

    // 3. Pick up passengers from the current station
    const passengersToBoard = passengersToPickup
      .filter(p => p.originStation === currentStation)
      .sort((a,b) => a.priority - b.priority);

    const pickedUp: Passenger[] = [];
    for (const p of passengersToBoard) {
      if (passengersInHelicopter.length < scenario.helicopterCapacity) {
        passengersInHelicopter.push(p);
        pickedUp.push(p);
      }
    }

    if (pickedUp.length > 0) {
      passengersToPickup.splice(0, pickedUp.length);
      steps.push({
        action: 'PICKUP',
        station: currentStation,
        passengers: pickedUp,
        notes: `Embarque de ${pickedUp.length} pasajero(s).`,
      });
    }
  }
  
    // Final return to base if not already there
  if (currentStation !== 0) {
    steps.push({
      action: 'TRAVEL',
      station: 0,
      passengers: [],
      notes: 'Regreso final a la base.',
    });
  }


  return {
    id: 'priority_focused',
    title: 'Plan A: Enfoque en Prioridad',
    steps,
    metrics: {
      totalStops: steps.filter(s => s.action !== 'TRAVEL').length,
      totalDistance: steps.filter(s => s.action === 'TRAVEL').length,
      passengersTransported: passengersDelivered,
    },
  };
}


/**
 * Generates an alternative flight plan that tries to minimize travel distance
 * by grouping passengers with nearby pickups and drop-offs.
 */
export function generateAlternativePlan(scenario: ScenarioData): FlightPlan {
  const passengersToPickup = deepCopy(scenario.passengers);
  let passengersInHelicopter: Passenger[] = [];
  const steps: FlightStep[] = [];
  let currentStation = 0; // Start at base
  let passengersDelivered = 0;

  const getNextClosestStation = (from: number, availableStations: number[]): number => {
    if (availableStations.length === 0) return -1;
    // Simple distance logic: difference in station numbers.
    return availableStations.sort((a,b) => Math.abs(a - from) - Math.abs(b - from))[0];
  }

  while (passengersToPickup.length > 0 || passengersInHelicopter.length > 0) {
     const availablePickupStations = [...new Set(passengersToPickup.map(p => p.originStation))];
     const availableDropoffStations = [...new Set(passengersInHelicopter.map(p => p.destinationStation))];
     const allTargetStations = [...new Set([...availablePickupStations, ...availableDropoffStations])];

     if (allTargetStations.length === 0) break;

     const nextStation = getNextClosestStation(currentStation, allTargetStations);

      // 1. Travel
      if (currentStation !== nextStation) {
          steps.push({
              action: 'TRAVEL',
              station: nextStation,
              passengers: deepCopy(passengersInHelicopter),
              notes: `Volando de Estación ${currentStation} a Estación ${nextStation}`,
          });
          currentStation = nextStation;
      }

      // 2. Dropoff
      const passengersToDrop = passengersInHelicopter.filter(p => p.destinationStation === currentStation);
      if (passengersToDrop.length > 0) {
          passengersInHelicopter = passengersInHelicopter.filter(p => !passengersToDrop.find(dp => dp.id === p.id));
          passengersDelivered += passengersToDrop.length;
          steps.push({
              action: 'DROPOFF',
              station: currentStation,
              passengers: passengersToDrop,
              notes: `Desembarque de ${passengersToDrop.length} pasajero(s).`,
          });
      }

      // 3. Pickup
      if (passengersInHelicopter.length < scenario.helicopterCapacity) {
          const passengersToBoard = passengersToPickup
              .filter(p => p.originStation === currentStation)
              .sort((a,b) => a.priority - b.priority);

          const pickedUp: Passenger[] = [];
          for (const p of passengersToBoard) {
              if (passengersInHelicopter.length < scenario.helicopterCapacity) {
                  passengersInHelicopter.push(p);
                  pickedUp.push(p);
              } else {
                  break;
              }
          }

          if (pickedUp.length > 0) {
              for (const p of pickedUp) {
                  const index = passengersToPickup.findIndex(pp => pp.id === p.id);
                  if (index > -1) passengersToPickup.splice(index, 1);
              }
              steps.push({
                  action: 'PICKUP',
                  station: currentStation,
                  passengers: pickedUp,
                  notes: `Embarque de ${pickedUp.length} pasajero(s).`,
              });
          }
      }
  }
  
    // Final return to base
    if (currentStation !== 0) {
        steps.push({
            action: 'TRAVEL',
            station: 0,
            passengers: [],
            notes: 'Regreso final a la base.',
        });
    }

  return {
    id: 'route_efficiency',
    title: 'Plan B: Eficiencia de Ruta',
    steps,
    metrics: {
        totalStops: steps.filter(s => s.action !== 'TRAVEL').length,
        totalDistance: steps.filter(s => s.action === 'TRAVEL').length,
        passengersTransported: passengersDelivered,
    },
  };
}
