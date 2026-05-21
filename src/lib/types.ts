
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
  action: 'TRAVEL' | 'PICKUP' | 'DROPOFF' | 'REFUEL';
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
    refuelStops: number;
    impossibleItems: number;
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

/** Configuración de reabastecimiento */
export interface RefuelConfig {
  enabled: boolean;
  /** Distancia máxima (en unidades) antes de necesitar retorno a base para recargar */
  maxFlightDistance: number;
}

/** Configuración de una estación con coordenadas editables */
export interface StationConfig {
  id: number;
  name: string;
  x: number;
  y: number;
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
    /** Configuración de reabastecimiento de combustible */
    refuelConfig?: RefuelConfig;
    /** Coordenadas personalizadas de estaciones (overrides ALL_STATIONS) */
    customStations?: StationConfig[];
    /** URL o data-url de imagen de fondo para el mapa */
    mapBackgroundUrl?: string;
}
