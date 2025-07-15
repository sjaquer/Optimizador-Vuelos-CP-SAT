export interface Passenger {
  id: string;
  name: string;
  priority: number;
  originStation: number;
  destinationStation: number;
}

export interface FlightStep {
  action: 'TRAVEL' | 'PICKUP' | 'DROPOFF';
  station: number;
  passengers: Passenger[];
  notes: string;
}

export interface FlightPlan {
  id: string;
  title: string;
  steps: FlightStep[];
  metrics: {
    totalStops: number;
    totalDistance: number; 
    passengersTransported: number;
  };
}

export interface ScenarioData {
    numStations: number;
    helicopterCapacity: number;
    passengers: Passenger[];
}
