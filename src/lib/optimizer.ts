import type { Passenger, FlightPlan, FlightStep, ScenarioData } from './types';

const deepCopy = <T>(obj: T): T => JSON.parse(JSON.stringify(obj));

/**
 * Generates a flight plan focused on serving the highest-priority passengers first,
 * while trying to optimize pickups and drop-offs along the way.
 */
export function generatePlan(scenario: ScenarioData): FlightPlan {
  const passengersToPickup = deepCopy(scenario.passengers);
  let passengersInHelicopter: Passenger[] = [];
  const steps: FlightStep[] = [];
  let currentStation = 0; 
  let passengersDelivered = 0;

  // Initial move from base if necessary
  if (passengersToPickup.length > 0) {
    const firstPickupStation = passengersToPickup.sort((a,b) => a.priority - b.priority)[0].originStation;
    if (currentStation !== firstPickupStation) {
      steps.push({
        action: 'TRAVEL',
        station: firstPickupStation,
        passengers: [],
        notes: `Despegue de la Base a la Estación ${firstPickupStation}`,
      });
      currentStation = firstPickupStation;
    }
  }


  while (passengersToPickup.length > 0 || passengersInHelicopter.length > 0) {
    // 1. Drop off passengers at the current station
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

    // 2. Pick up passengers from the current station
    const passengersAvailableAtStation = passengersToPickup
      .filter(p => p.originStation === currentStation)
      .sort((a, b) => a.priority - b.priority);

    const pickedUp: Passenger[] = [];
    for (const p of passengersAvailableAtStation) {
      if (passengersInHelicopter.length < scenario.helicopterCapacity) {
        passengersInHelicopter.push(p);
        const indexInWaiting = passengersToPickup.findIndex(wp => wp.id === p.id);
        if (indexInWaiting > -1) {
            passengersToPickup.splice(indexInWaiting, 1);
        }
        pickedUp.push(p);
      }
    }

    if (pickedUp.length > 0) {
      steps.push({
        action: 'PICKUP',
        station: currentStation,
        passengers: pickedUp,
        notes: `Embarque de ${pickedUp.length} pasajero(s).`,
      });
    }

    // 3. Decide next station and travel
    if (passengersToPickup.length > 0 || passengersInHelicopter.length > 0) {
      const dropoffStations = passengersInHelicopter.map(p => p.destinationStation);
      const pickupStations = passengersToPickup.sort((a,b) => a.priority - b.priority).map(p => p.originStation);
      
      const targetStations = [...new Set([...dropoffStations, ...pickupStations])];
      if (targetStations.length === 0) break;

      const nextStation = targetStations[0];
      
      if (currentStation !== nextStation) {
        steps.push({
          action: 'TRAVEL',
          station: nextStation,
          passengers: deepCopy(passengersInHelicopter),
          notes: `Volando de Estación ${currentStation} a Estación ${nextStation}`,
        });
        currentStation = nextStation;
      }
    }
  }
  
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
      totalStops: new Set(steps.map(s => s.station)).size,
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
  let currentStation = 0; 
  let passengersDelivered = 0;

  const getNextClosestStation = (from: number, availableStations: number[]): number => {
    if (availableStations.length === 0) return -1;
    return availableStations.sort((a,b) => Math.abs(a - from) - Math.abs(b - from))[0];
  }

  while (passengersToPickup.length > 0 || passengersInHelicopter.length > 0) {
     // 1. Dropoff at current station
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

      // 2. Pickup from current station (opportunistic)
      if (passengersInHelicopter.length < scenario.helicopterCapacity) {
          const passengersAvailableAtStation = passengersToPickup
              .filter(p => p.originStation === currentStation)
              .sort((a,b) => a.priority - b.priority);

          const pickedUp: Passenger[] = [];
          for (const p of passengersAvailableAtStation) {
              if (passengersInHelicopter.length < scenario.helicopterCapacity) {
                  passengersInHelicopter.push(p);
                  pickedUp.push(p);
                  const index = passengersToPickup.findIndex(pp => pp.id === p.id);
                  if (index > -1) passengersToPickup.splice(index, 1);
              } else {
                  break;
              }
          }

          if (pickedUp.length > 0) {
              steps.push({
                  action: 'PICKUP',
                  station: currentStation,
                  passengers: pickedUp,
                  notes: `Embarque de ${pickedUp.length} pasajero(s).`,
              });
          }
      }

      // 3. Decide next station and travel
      if (passengersToPickup.length > 0 || passengersInHelicopter.length > 0) {
        const availablePickupStations = [...new Set(passengersToPickup.map(p => p.originStation))];
        const availableDropoffStations = [...new Set(passengersInHelicopter.map(p => p.destinationStation))];
        const allTargetStations = [...new Set([...availablePickupStations, ...availableDropoffStations])];
   
        if (allTargetStations.length === 0) break;
   
        const nextStation = getNextClosestStation(currentStation, allTargetStations);

        if (currentStation !== nextStation) {
            steps.push({
                action: 'TRAVEL',
                station: nextStation,
                passengers: deepCopy(passengersInHelicopter),
                notes: `Volando de Estación ${currentStation} a Estación ${nextStation}`,
            });
            currentStation = nextStation;
        } else if (allTargetStations.length > 0 && availablePickupStations.length === 0 && availableDropoffStations.length === 0) {
            // Stuck at a station with no one to pick up or drop off, but still people in the system.
            // This can happen if the closest station is the current one, but it's now empty of tasks.
            const nextBestStation = getNextClosestStation(currentStation, allTargetStations.filter(s => s !== currentStation));
            if(nextBestStation !== -1 && currentStation !== nextBestStation) {
                 steps.push({
                    action: 'TRAVEL',
                    station: nextBestStation,
                    passengers: deepCopy(passengersInHelicopter),
                    notes: `Reposicionando de Estación ${currentStation} a Estación ${nextBestStation}`,
                });
                currentStation = nextBestStation;
            } else {
                break; // Break if no other option
            }
        }
      }
  }
  
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
        totalStops: new Set(steps.map(s => s.station)).size,
        totalDistance: steps.filter(s => s.action === 'TRAVEL').length,
        passengersTransported: passengersDelivered,
    },
  };
}

    