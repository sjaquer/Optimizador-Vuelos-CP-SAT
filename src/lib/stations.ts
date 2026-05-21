import type { StationConfig } from './types';

export interface StationData {
  id: number;
  name: string;
  x: number;
  y: number;
}

/**
 * Estaciones por defecto (helipads).
 * Disposición en arco para visualización en mapa.
 * Estación 0 es la base, estación 8 es el punto más remoto.
 */
export const DEFAULT_STATIONS: StationData[] = [
  { id: 0, name: 'BO Nuevo Mundo', x: 100, y: 300 },
  { id: 1, name: 'HP 6+800', x: 185, y: 220 },
  { id: 2, name: 'HP Kinteroni', x: 270, y: 160 },
  { id: 3, name: 'HP CT-5', x: 355, y: 120 },
  { id: 4, name: 'HP Sagari AX', x: 440, y: 110 },
  { id: 5, name: 'HP Sagari BX', x: 525, y: 130 },
  { id: 6, name: 'HP 14+000', x: 610, y: 180 },
  { id: 7, name: 'HP Porotobango', x: 695, y: 260 },
  { id: 8, name: 'HP Kitepampani', x: 750, y: 360 },
];

/** Backward compat alias */
export const ALL_STATIONS = DEFAULT_STATIONS;

/**
 * Resuelve las estaciones activas: usa customStations si existen, o DEFAULT_STATIONS.
 * Filtra por numStations (0 = base, siempre incluida).
 */
export function resolveStations(
  numStations: number,
  customStations?: StationConfig[],
): StationData[] {
  const source: StationData[] = customStations && customStations.length > 0
    ? customStations
    : DEFAULT_STATIONS;
  return source.filter(s => s.id <= numStations);
}

/** Lookup rápido por ID */
export const stationById = (id: number, customStations?: StationConfig[]): StationData | undefined => {
  const source = customStations && customStations.length > 0 ? customStations : DEFAULT_STATIONS;
  return source.find(s => s.id === id);
};

/** Construye mapa de coordenadas por ID */
export function buildCoordsMap(customStations?: StationConfig[]): Record<number, { x: number; y: number }> {
  const source = customStations && customStations.length > 0 ? customStations : DEFAULT_STATIONS;
  return Object.fromEntries(source.map(s => [s.id, { x: s.x, y: s.y }]));
}

/** Coordenadas indexadas por ID — default para compat */
export const stationCoordsMap: Record<number, { x: number; y: number }> =
  Object.fromEntries(DEFAULT_STATIONS.map(s => [s.id, { x: s.x, y: s.y }]));

/** Construye mapa de nombres por ID */
export function buildNamesMap(customStations?: StationConfig[]): Record<number, string> {
  const source = customStations && customStations.length > 0 ? customStations : DEFAULT_STATIONS;
  return Object.fromEntries(source.map(s => [s.id, s.name]));
}

/** Nombres indexados por ID — default para compat */
export const stationNamesMap: Record<number, string> =
  Object.fromEntries(DEFAULT_STATIONS.map(s => [s.id, s.name]));

/** Filtra estaciones activas según numStations (0 = base, siempre incluida) */
export const getActiveStations = (numStations: number, customStations?: StationConfig[]): StationData[] =>
  resolveStations(numStations, customStations);

/**
 * Distancia euclidiana real entre dos estaciones basada en coordenadas (x, y).
 * Utiliza las coordenadas de las estaciones configuradas.
 * Fallback a distancia lineal si no se encuentran coordenadas.
 */
export function getEuclideanDistance(
  from: number,
  to: number,
  customStations?: StationConfig[],
): number {
  const coords = buildCoordsMap(customStations);
  const a = coords[from];
  const b = coords[to];
  if (!a || !b) return Math.abs(from - to); // fallback lineal
  return Math.sqrt(Math.pow(b.x - a.x, 2) + Math.pow(b.y - a.y, 2));
}

/**
 * Distancia principal — siempre euclidiana basada en coordenadas.
 * Para compat con el optimizador, normalizada (dividida por la distancia base entre E0-E1).
 */
export function getDistance(
  from: number,
  to: number,
  customStations?: StationConfig[],
): number {
  const raw = getEuclideanDistance(from, to, customStations);
  // Normalizar: la distancia entre estaciones consecutivas por defecto es ~1 unidad
  // Usamos la distancia E0→E1 como unidad base
  const coords = buildCoordsMap(customStations);
  const e0 = coords[0];
  const e1 = coords[1];
  if (!e0 || !e1) return Math.abs(from - to); // fallback
  const baseUnit = Math.sqrt(Math.pow(e1.x - e0.x, 2) + Math.pow(e1.y - e0.y, 2));
  if (baseUnit === 0) return Math.abs(from - to);
  return Math.round((raw / baseUnit) * 100) / 100; // 2 decimales
}

/**
 * Genera estaciones automáticas para N estaciones dispuestas en arco.
 * Útil cuando el usuario cambia numStations más allá de las defaults.
 */
export function generateDefaultStations(numStations: number): StationData[] {
  const stations: StationData[] = [];
  for (let i = 0; i <= numStations; i++) {
    const existing = DEFAULT_STATIONS.find(s => s.id === i);
    if (existing) {
      stations.push(existing);
    } else {
      // Generar posición en arco extendido
      const angle = (Math.PI * 0.8) * (i / Math.max(numStations, 1)) - Math.PI * 0.1;
      const radius = 320;
      const cx = 425, cy = 380;
      stations.push({
        id: i,
        name: `HP E-${i}`,
        x: Math.round(cx + radius * Math.cos(angle - Math.PI / 2 + Math.PI * 0.6)),
        y: Math.round(cy + radius * Math.sin(angle - Math.PI / 2 + Math.PI * 0.6) * 0.7),
      });
    }
  }
  return stations;
}
