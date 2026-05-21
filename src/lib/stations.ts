import type { StationConfig } from './types';

// ─── Utility ───────────────────────────────────────────────────────────────

/** Genera un slug único a partir de un nombre de estación */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // quitar tildes
    .replace(/[^a-z0-9\s+-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

// ─── Estaciones reales del mapa de operaciones Nuevo Mundo, Cuzco ──────────
//
// Coordenadas en km relativas a la base (BO Nuevo Mundo = 0, 0).
// Sistema: X positivo = este, Y positivo = sur (inversión visual para mapa).
// Estimaciones basadas en el mapa real con escala 0-5-10-15 km.
// El usuario puede ajustar con Drag & Drop.
//
// Distancias aproximadas desde la base:
//   HP Kirigueti   ~  4 km (cercana, al este)
//   HP Mipaya      ~  9 km (sur-oeste)
//   HP 6+800       ~ 12 km (oeste)
//   HP Kinteroni   ~ 18 km (oeste)
//   HP CT-5        ~ 22 km (noroeste)
//   HP Porotobango ~ 26 km (norte)
//   HP Kitepampani ~ 28 km (suroeste)
//   HP Sagari AX   ~ 33 km (noroeste lejano)
//   HP Sagari BX   ~ 36 km (noroeste, más lejano aún)
//   HP 14+000      ~ 52 km (sureste, el más remoto)

export const DEFAULT_STATIONS: StationConfig[] = [
  { id: 'bo-nuevo-mundo',  name: 'BO Nuevo Mundo',  x:   0.0, y:   0.0, isBase: true  },
  { id: 'hp-kirigueti',    name: 'HP Kirigueti',    x:   3.5, y:  -2.0                },
  { id: 'hp-mipaya',       name: 'HP Mipaya',       x:  -5.5, y:  -3.5                },
  { id: 'hp-6800',         name: 'HP 6+800',        x:  -9.5, y:   5.5                },
  { id: 'hp-kinteroni',    name: 'HP Kinteroni',    x: -16.0, y:   2.5                },
  { id: 'hp-ct5',          name: 'HP CT-5',         x: -18.5, y:   9.5                },
  { id: 'hp-porotobango',  name: 'HP Porotobango',  x: -11.5, y:  13.5                },
  { id: 'hp-kitepampani',  name: 'HP Kitepampani',  x: -20.0, y:  -4.5                },
  { id: 'hp-sagari-ax',    name: 'HP Sagari AX',    x: -25.5, y:   9.0                },
  { id: 'hp-sagari-bx',    name: 'HP Sagari BX',    x: -22.0, y:  16.5                },
  { id: 'hp-14000',        name: 'HP 14+000',       x:  18.5, y: -21.5                },
];

// ─── Funciones de acceso ───────────────────────────────────────────────────

/** Retorna la estación base (isBase === true), o la primera si no hay ninguna marcada */
export function getBaseStation(stations: StationConfig[]): StationConfig {
  return stations.find(s => s.isBase) ?? stations[0];
}

/** Busca una estación por slug */
export function stationById(id: string, stations: StationConfig[]): StationConfig | undefined {
  return stations.find(s => s.id === id);
}

/** Construye mapa nombre-completo indexado por slug: slug → name */
export function buildNamesMap(stations: StationConfig[]): Record<string, string> {
  return Object.fromEntries(stations.map(s => [s.id, s.name]));
}

/** Construye mapa de coordenadas indexado por slug: slug → {x, y} */
export function buildCoordsMap(stations: StationConfig[]): Record<string, { x: number; y: number }> {
  return Object.fromEntries(stations.map(s => [s.id, { x: s.x, y: s.y }]));
}

// ─── Distancia ─────────────────────────────────────────────────────────────

/**
 * Distancia euclidiana en km entre dos estaciones identificadas por slug.
 * Las coordenadas ya están en km, por lo tanto el resultado es directo.
 * Fallback: 0 si no se encuentran las estaciones.
 */
export function getDistance(
  fromId: string,
  toId: string,
  stations: StationConfig[],
): number {
  const a = stations.find(s => s.id === fromId);
  const b = stations.find(s => s.id === toId);
  if (!a || !b) return 0;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.round(Math.sqrt(dx * dx + dy * dy) * 10) / 10; // 1 decimal en km
}

// ─── CRUD helpers ─────────────────────────────────────────────────────────

/** Agrega una nueva estación, generando slug único (con sufijo numérico si colisiona) */
export function addStation(
  stations: StationConfig[],
  name: string,
  x = 0,
  y = 0,
): StationConfig[] {
  let slug = slugify(name) || 'nueva-estacion';
  const existingSlugs = new Set(stations.map(s => s.id));
  if (existingSlugs.has(slug)) {
    let n = 2;
    while (existingSlugs.has(`${slug}-${n}`)) n++;
    slug = `${slug}-${n}`;
  }
  return [...stations, { id: slug, name, x, y }];
}

/** Actualiza campos de una estación por slug */
export function updateStation(
  stations: StationConfig[],
  id: string,
  updates: Partial<Omit<StationConfig, 'id'>>,
): StationConfig[] {
  return stations.map(s => (s.id === id ? { ...s, ...updates } : s));
}

/** Elimina una estación por slug (no permite eliminar la base) */
export function removeStation(stations: StationConfig[], id: string): StationConfig[] {
  const target = stations.find(s => s.id === id);
  if (!target || target.isBase) return stations; // proteger la base
  return stations.filter(s => s.id !== id);
}

/** Marca una estación como base y desmarca las demás */
export function setBaseStation(stations: StationConfig[], id: string): StationConfig[] {
  return stations.map(s => ({ ...s, isBase: s.id === id }));
}

// ─── Compat helpers (evitar breaking changes en componentes menores) ────────

/** @deprecated Usar stations directamente */
export const ALL_STATIONS = DEFAULT_STATIONS;
