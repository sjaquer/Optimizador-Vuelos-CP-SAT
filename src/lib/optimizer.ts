
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
    const sortedByPriority = passengersToPickup.sort((a,b) => a.priority - b.priority);
    const firstPickupStation = sortedByPriority[0].originStation;
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
      // Prioritize dropping off passengers already in the helicopter
      const dropoffStations = passengersInHelicopter.map(p => p.destinationStation);
      // Then consider picking up highest priority passengers
      const pickupStations = passengersToPickup.sort((a,b) => a.priority - b.priority).map(p => p.originStation);
      
      const targetStations = [...new Set([...dropoffStations, ...pickupStations])];
      if (targetStations.length === 0) break;

      // Simple strategy: go to the first available target. Could be improved with distance logic.
      const nextStation = targetStations[0];
      
      if (currentStation !== nextStation) {
        steps.push({
          action: 'TRAVEL',
          station: nextStation,
          passengers: deepCopy(passengersInHelicopter),
          notes: `Volando de ${currentStation === 0 ? 'Base' : `Estación ${currentStation}`} a ${nextStation === 0 ? 'Base' : `Estación ${nextStation}`}`,
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
      totalStops: new Set(steps.filter(s => s.action !== 'TRAVEL').map(s => s.station)).size,
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
   
        let nextStation = -1;
        // Prioritize dropping off if helicopter is full
        if (passengersInHelicopter.length === scenario.helicopterCapacity && availableDropoffStations.length > 0) {
            nextStation = getNextClosestStation(currentStation, availableDropoffStations);
        } else {
            nextStation = getNextClosestStation(currentStation, allTargetStations);
        }

        if (nextStation !== -1 && currentStation !== nextStation) {
            steps.push({
                action: 'TRAVEL',
                station: nextStation,
                passengers: deepCopy(passengersInHelicopter),
                notes: `Volando de ${currentStation === 0 ? 'Base' : `Estación ${currentStation}`} a ${nextStation === 0 ? 'Base' : `Estación ${nextStation}`}`,
            });
            currentStation = nextStation;
        } else if (allTargetStations.length > 0 && availablePickupStations.length === 0 && availableDropoffStations.length === 0) {
            // Stuck at a station with no one to pick up or drop off, but still people in the system.
            const otherStations = allTargetStations.filter(s => s !== currentStation);
            if (otherStations.length > 0) {
                const nextBestStation = getNextClosestStation(currentStation, otherStations);
                if(nextBestStation !== -1 && currentStation !== nextBestStation) {
                     steps.push({
                        action: 'TRAVEL',
                        station: nextBestStation,
                        passengers: deepCopy(passengersInHelicopter),
                        notes: `Reposicionando de ${currentStation === 0 ? 'Base' : `Estación ${currentStation}`} a ${nextBestStation === 0 ? 'Base' : `Estación ${nextBestStation}`}`,
                    });
                    currentStation = nextBestStation;
                } else {
                    break; 
                }
            } else {
                break;
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
        totalStops: new Set(steps.filter(s => s.action !== 'TRAVEL').map(s => s.station)).size,
        totalDistance: steps.filter(s => s.action === 'TRAVEL').length,
        passengersTransported: passengersDelivered,
    },
  };
}


/**
 * Generates a third plan that serves passengers strictly by priority, one by one.
 * Less efficient but guarantees priority order.
 */
export function generateThirdPlan(scenario: ScenarioData): FlightPlan {
  const passengersToServe = deepCopy(scenario.passengers).sort((a,b) => a.priority - b.priority);
  const steps: FlightStep[] = [];
  let currentStation = 0;
  let passengersDelivered = 0;

  for (const passenger of passengersToServe) {
    // Travel to pickup location
    if (currentStation !== passenger.originStation) {
      steps.push({
        action: 'TRAVEL',
        station: passenger.originStation,
        passengers: [],
        notes: `Volando a la Estación ${passenger.originStation} para recoger a ${passenger.name}`,
      });
      currentStation = passenger.originStation;
    }

    // Pick up
    steps.push({
      action: 'PICKUP',
      station: currentStation,
      passengers: [passenger],
      notes: `Recogiendo a ${passenger.name}`,
    });

    // Travel to drop-off location
    if (currentStation !== passenger.destinationStation) {
      steps.push({
        action: 'TRAVEL',
        station: passenger.destinationStation,
        passengers: [passenger],
        notes: `Volando a la Estación ${passenger.destinationStation} para dejar a ${passenger.name}`,
      });
      currentStation = passenger.destinationStation;
    }

    // Drop off
    steps.push({
      action: 'DROPOFF',
      station: currentStation,
      passengers: [passenger],
      notes: `Dejando a ${passenger.name}`,
    });
    passengersDelivered++;
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
    id: 'strict_priority',
    title: 'Plan C: Prioridad Estricta',
    steps,
    metrics: {
      totalStops: new Set(steps.filter(s => s.action !== 'TRAVEL').map(s => s.station)).size,
      totalDistance: steps.filter(s => s.action === 'TRAVEL').length,
      passengersTransported: passengersDelivered,
    },
  };
}
