export interface StationData {
  id: number;
  name: string;
  x: number;
  y: number;
}

/**
 * Fuente de verdad única para todas las estaciones (helipads).
 * Cualquier componente que necesite nombres, coordenadas o IDs
 * debe importar desde aquí.
 */
export const ALL_STATIONS: StationData[] = [
  { id: 0, name: 'BO Nuevo Mundo', x: 450, y: 350 },
  { id: 1, name: 'HP 6+800', x: 400, y: 250 },
  { id: 2, name: 'HP Kinteroni', x: 300, y: 300 },
  { id: 3, name: 'HP CT-5', x: 250, y: 150 },
  { id: 4, name: 'HP Sagari AX', x: 100, y: 200 },
  { id: 5, name: 'HP Sagari BX', x: 80, y: 100 },
  { id: 6, name: 'HP 14+000', x: 700, y: 500 },
  { id: 7, name: 'HP Porotobango', x: 550, y: 80 },
  { id: 8, name: 'HP Kitepampani', x: 180, y: 450 },
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

/** Distancia euclidiana entre dos estaciones */
export const getDistance = (from: number, to: number): number => {
  const a = stationCoordsMap[from];
  const b = stationCoordsMap[to];
  if (!a || !b) return Infinity;
  return Math.round(Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2));
};
