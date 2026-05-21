
export interface TransportItem {
  id: string;
  area: string;
  type: 'PAX' | 'CARGO';
  shift: 'M' | 'T'; // Mañana o Tarde
  priority: 'ALTA' | 'MEDIA' | 'BAJA'; // ALTA = Máxima urgencia, MEDIA = Estándar, BAJA = Baja prioridad
  quantity: number;
  originStation: string;      // slug de estación, ej: "bo-nuevo-mundo"
  destinationStation: string; // slug de estación
  weight: number;
  description: string;
}

export interface FlightStep {
  action: 'TRAVEL' | 'PICKUP' | 'DROPOFF' | 'REFUEL';
  station: string;       // slug de estación
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
    totalDistance: number;   // en km
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
  /** Distancia máxima en km antes de necesitar retorno a base para recargar */
  maxFlightDistance: number;
}

/** Configuración de una estación con coordenadas reales en km */
export interface StationConfig {
  id: string;          // slug único, ej: "bo-nuevo-mundo"
  name: string;        // nombre completo, ej: "BO Nuevo Mundo"
  x: number;           // coordenada X en km relativa a la base (este positivo)
  y: number;           // coordenada Y en km relativa a la base (norte positivo)
  isBase?: boolean;    // true para la estación base de operaciones
}

export interface ScenarioData {
  id?: string;                          // identificador único para historial
  stations: StationConfig[];            // lista completa de estaciones activas
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
  /** URL o data-url de imagen de fondo para el mapa */
  mapBackgroundUrl?: string;
}
