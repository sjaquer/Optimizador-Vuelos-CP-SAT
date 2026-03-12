export interface StationData {
  id: number;
  name: string;
  x: number;
  y: number;
}

/**
 * Fuente de verdad única para todas las estaciones (helipads).
 * Disposición lineal: la distancia entre estaciones es proporcional
 * al índice. Estación 0 es la base, estación 8 es el punto más remoto.
 * Las coordenadas están dispuestas en un arco para visualización en mapa.
 */
export const ALL_STATIONS: StationData[] = [
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

/** Lookup rápido por ID */
export const stationById = (id: number): StationData | undefined =>
  ALL_STATIONS.find(s => s.id === id);

/** Coordenadas indexadas por ID — para uso en optimizer y mapa */
export const stationCoordsMap: Record<number, { x: number; y: number }> =
  Object.fromEntries(ALL_STATIONS.map(s => [s.id, { x: s.x, y: s.y }]));

/** Nombres indexados por ID */
export const stationNamesMap: Record<number, string> =
  Object.fromEntries(ALL_STATIONS.map(s => [s.id, s.name]));

/** Filtra estaciones activas según numStations (0 = base, siempre incluida) */
export const getActiveStations = (numStations: number): StationData[] =>
  ALL_STATIONS.filter(s => s.id <= numStations);

/**
 * Distancia lineal entre dos estaciones basada en índices.
 * La distancia es proporcional a la diferencia de índices (|from - to|).
 * Cada tramo entre estaciones consecutivas vale 1 unidad.
 */
export const getDistance = (from: number, to: number): number => {
  return Math.abs(from - to);
};
