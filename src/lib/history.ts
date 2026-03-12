
'use client';

import type { FlightPlan, ScenarioData, TransportItem, MissionDetails } from './types';
import { ALL_STATIONS } from './stations';

const HISTORY_KEY = 'ovh_flight_history_v2';
const MAX_HISTORY_ITEMS = 20;

export const getHistory = (): ScenarioData[] => {
  if (typeof window === 'undefined') {
    return [];
  }
  try {
    const historyJson = window.localStorage.getItem(HISTORY_KEY);
    return historyJson ? JSON.parse(historyJson) : [];
  } catch (error) {
    console.error("Failed to parse history from localStorage", error);
    return [];
  }
};

export const saveScenarioToHistory = (scenario: ScenarioData, plans?: Record<string, FlightPlan>): void => {
   if (typeof window === 'undefined') {
    return;
  }
  let history = getHistory();
  
  // Add a unique ID if it doesn't have one
  const newScenarioWithId: ScenarioData = {
      ...scenario,
      id: new Date().toISOString(),
      calculatedPlans: plans,
  };

  const newHistory = [newScenarioWithId, ...history].slice(0, MAX_HISTORY_ITEMS);
  
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory));
  } catch (error) {
    console.error("Failed to save history to localStorage", error);
  }
};

export const deleteScenarioFromHistory = (scenarioId: string): void => {
  if (typeof window === 'undefined') {
    return;
  }
  let history = getHistory();
  history = history.filter(s => s.id !== scenarioId);

  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch (error) {
     console.error("Failed to update history in localStorage", error);
  }
}

// ──── Random Scenario Generator ──────────────────────────────────────

const AREAS = [
  'Operaciones', 'Perforación', 'Logística', 'Mantenimiento',
  'Geología', 'HSE', 'Supervisión', 'Ingeniería', 'Campamento',
  'Producción', 'Medio Ambiente', 'Topografía',
];

const CARGO_DESCRIPTIONS = [
  'Herramientas de perforación', 'Repuestos de bomba', 'Tubería 4"',
  'Material eléctrico', 'Provisiones campamento', 'Equipo de soldadura',
  'Muestras geológicas', 'EPP para cuadrilla', 'Cemento especial',
  'Válvulas de seguridad', 'Kit de primeros auxilios', 'Filtros industriales',
  'Cable de acero 200m', 'Baterías y generador', 'Instrumental topográfico',
  'Químicos de tratamiento', 'Piezas de reemplazo compresor',
];

const WEATHER_OPTIONS = [
  'Despejado, visibilidad >10km',
  'Parcialmente nublado, viento 10km/h SE',
  'Viento fuerte 25km/h NNO, techo 2500ft',
  'Niebla matutina, despeja ~09:00',
  'Tormenta eléctrica prevista PM',
  'Lluvia ligera, visibilidad 5km',
  'CAVOK, condiciones ideales',
  'Bruma, techo 1500ft, mejorando',
];

const OPERATIONAL_NOTES_OPTIONS = [
  'Priorizar evacuación de personal turno saliente',
  'Estación 4 con restricción de peso por terreno blando',
  'Ventana operativa reducida: 06:00-14:00',
  'Combustible limitado – máx 4 rotaciones',
  'Carga frágil requiere vuelo directo sin escalas intermedias',
  'Personal VIP en traslado, coordinar con seguridad',
  'Rotación de cambio de guardia 14 días',
  'Emergencia médica posible, reservar slot PM',
  '',
  '',
];

const PILOT_NAMES = [
  'Cap. Rodríguez M.', 'Cap. Fernández J.', 'Cap. Torres A.', 'Cap. Gutiérrez L.',
  'Cap. Sánchez D.', 'Cap. Paredes R.', 'Cap. Villanueva C.', 'Cap. Mendoza H.',
];

const COPILOT_NAMES = [
  'SIC Quispe P.', 'SIC Huamán E.', 'SIC Castillo V.', 'SIC Chávez N.',
  'SIC Rivera G.', 'SIC Condori F.', '', '',
];

const CALLSIGNS = [
  'OB-2145-P', 'OB-1987-P', 'OB-2201-P', 'OB-1860-P',
  'OB-2310-P', 'OB-9934-P', 'HK-5021', 'OB-2089-P',
];

const MISSION_OBJECTIVES = [
  'Rotación de personal turno 14D',
  'Abastecimiento de estaciones remotas',
  'Evacuación programada fin de ciclo',
  'Movilización de equipo de perforación',
  'Traslado de muestras y personal geología',
  'Cambio de guardia + provisiones',
  'Soporte logístico operación sísmica',
  'Relevo de cuadrilla HSE',
];

const CLIENT_PROJECTS = [
  'Consorcio Camisea', 'Proyecto Kinteroni', 'Lote 88 Operaciones',
  'Pluspetrol Norte', 'CNPC Perú', 'Hunt Oil Exploración',
  'Repsol Upstream', 'Tecpetrol Sur',
];

const AUTHORIZATION_PREFIXES = ['AUTH', 'OPS', 'FLT', 'LOG'];

const MISSION_NOTES_OPTIONS = [
  'Coordinar con torre Malvinas frecuencia 123.45 MHz. Contacto en tierra: Ing. Vargas cel. 987654321.',
  'Carga frágil en slot PM, requiere manipulación especial. Confirmar con base antes de despegue.',
  'Pasajero con restricción médica, disponer botiquín avanzado. Coordinar ambulancia en Base.',
  'Repostaje programado en HP Kinteroni si autonomía < 1.5 hrs. Check fuel antes de salida.',
  'Material HAZMAT clase 3 en vuelo CARGO, portar MSDS y kit de derrame. Solo vuelo directo.',
  'Ventana de vuelo reducida por ROL de tripulación. Máximo 8 hrs de servicio restantes.',
  '',
  '',
];

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickUnique<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(n, arr.length));
}

export function generateRandomScenario(): ScenarioData {
  const numStations = randInt(4, ALL_STATIONS.length - 1);
  const helicopterCapacity = pick([6, 8, 10, 12]);
  const helicopterMaxWeight = pick([800, 1000, 1200, 1500]);
  const paxDefaultWeight = pick([75, 80, 85]);

  // Generate between 6 and 18 transport items for a robust test
  const numItems = randInt(6, 18);
  const transportItems: TransportItem[] = [];

  // Ensure a good mix: at least 30% PAX and 30% CARGO
  const minPax = Math.max(2, Math.floor(numItems * 0.3));
  const minCargo = Math.max(2, Math.floor(numItems * 0.3));
  const paxCount = randInt(minPax, numItems - minCargo);
  const cargoCount = numItems - paxCount;

  // Generate PAX items
  for (let i = 0; i < paxCount; i++) {
    let origin = randInt(0, numStations);
    let destination = randInt(0, numStations);
    while (destination === origin) {
      destination = randInt(0, numStations);
    }

    transportItems.push({
      id: crypto.randomUUID(),
      area: pick(AREAS),
      type: 'PAX',
      shift: pick(['M', 'T']),
      priority: randInt(1, 3) as 1 | 2 | 3,
      quantity: 1,
      originStation: origin,
      destinationStation: destination,
      weight: paxDefaultWeight,
      description: `Pasajero de ${pick(AREAS)}`,
    });
  }

  // Generate CARGO items
  for (let i = 0; i < cargoCount; i++) {
    let origin = randInt(0, numStations);
    let destination = randInt(0, numStations);
    while (destination === origin) {
      destination = randInt(0, numStations);
    }

    const weight = pick([
      randInt(20, 80),    // light cargo
      randInt(80, 200),   // medium cargo
      randInt(200, 500),  // heavy cargo
      randInt(500, 900),  // very heavy (may push limits)
    ]);

    transportItems.push({
      id: crypto.randomUUID(),
      area: pick(AREAS),
      type: 'CARGO',
      shift: pick(['M', 'T']),
      priority: randInt(1, 3) as 1 | 2 | 3,
      quantity: 1,
      originStation: origin,
      destinationStation: destination,
      weight,
      description: pick(CARGO_DESCRIPTIONS),
    });
  }

  // Shuffle so PAX and CARGO are interleaved
  transportItems.sort(() => Math.random() - 0.5);

  const missionDetails: MissionDetails = {
    pilotInCommand: pick(PILOT_NAMES),
    copilot: pick(COPILOT_NAMES),
    aircraftCallsign: pick(CALLSIGNS),
    missionObjective: pick(MISSION_OBJECTIVES),
    clientOrProject: pick(CLIENT_PROJECTS),
    authorization: `${pick(AUTHORIZATION_PREFIXES)}-${randInt(1000, 9999)}`,
    missionNotes: pick(MISSION_NOTES_OPTIONS),
  };

  return {
    numStations,
    helicopterCapacity,
    helicopterMaxWeight,
    paxDefaultWeight,
    transportItems,
    weatherConditions: pick(WEATHER_OPTIONS),
    operationalNotes: pick(OPERATIONAL_NOTES_OPTIONS),
    missionDetails,
  };
}
