export interface TransportItem {
  id: string;
  area: string;
  type: 'PAX' | 'CARGO';
  shift: 'M' | 'T'; // Mañana o Tarde
  priority: number;
  originStation: number;
  destinationStation: number;
  weight: number;
  description: string;
}

export interface FlightStep {
  action: 'TRAVEL' | 'PICKUP' | 'DROPOFF';
  station: number;
  items: TransportItem[];
  notes: string;
}

export interface FlightPlan {
  id: string;
  title: string;
  steps: FlightStep[];
  metrics: {
    totalStops: number;
    totalDistance: number; 
    itemsTransported: number;
    totalWeight: number;
    maxWeightRatio: number;
  };
}

export interface ScenarioData {
    id?: string; // Unique identifier for history
    numStations: number;
    helicopterCapacity: number;
    helicopterMaxWeight: number;
    transportItems: TransportItem[];
    weatherConditions?: string;
    operationalNotes?: string;
}
