
export interface TransportItem {
  id: string;
  area: string;
  type: 'PAX' | 'CARGO';
  shift: 'M' | 'T'; // Mañana o Tarde
  priority: 1 | 2 | 3; // 1=Máxima urgencia, 2=Programación estándar, 3=Baja prioridad
  quantity: number;
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
  legType?: 'PAX' | 'CARGO' | 'EMPTY'; // Tipo de tramo para diferenciación visual
}

export interface FlightPlan {
  id: string;
  title: string;
  description?: string;
  steps: FlightStep[];
  metrics: {
    totalStops: number;
    totalDistance: number;
    totalLegs: number;
    itemsTransported: number;
    itemsNotDelivered: number;
    totalWeight: number;
    maxWeightRatio: number;
    avgLoadRatio: number;
    totalFlights: number;
  };
}

export interface MissionDetails {
  pilotInCommand?: string;
  copilot?: string;
  aircraftCallsign?: string;
  missionObjective?: string;
  authorization?: string;
  clientOrProject?: string;
  missionNotes?: string;
}

export interface ScenarioData {
    id?: string; // Unique identifier for history
    numStations: number;
    helicopterCapacity: number;
    helicopterMaxWeight: number;
    paxDefaultWeight: number;
    transportItems: TransportItem[];
    weatherConditions?: string;
    operationalNotes?: string;
    missionDetails?: MissionDetails;
    calculatedPlans?: Record<string, FlightPlan>;
}
