
'use client';

import { useMemo, useEffect, useState, useRef, useCallback } from 'react';
import type { FlightPlan, StationConfig } from '@/lib/types';
import { Play, Pause, SkipBack, SkipForward, Users, Package, Camera, MapPin } from 'lucide-react';
import { Button } from '../ui/button';
import { Slider } from '../ui/slider';
import { buildCoordsMap, buildNamesMap, getBaseStation } from '@/lib/stations';

interface RouteMapProps {
  plan: FlightPlan;
  stations: StationConfig[];
  currentStep: number;
  onStepChange: (step: number) => void;
  mapBackgroundUrl?: string;
  onStationDrag?: (stationId: string, x: number, y: number) => void;
  onBackgroundUpload?: () => void;
}

const VIEWBOX_W = 850;
const VIEWBOX_H = 500;
const PADDING = 60;

const getLegColor = (step: { legType?: string; items: { type: string }[] }): string => {
  if (step.legType === 'PAX') return '#38bdf8';
  if (step.legType === 'CARGO') return '#fbbf24';
  if (step.legType === 'EMPTY') return '#6b7280';
  if (step.items.length === 0) return '#6b7280';
  if (step.items.some(i => i.type === 'PAX')) return '#38bdf8';
  return '#fbbf24';
};

const getLegGlowId = (step: { legType?: string; items: { type: string }[] }): string => {
  if (step.legType === 'PAX') return 'glow-pax';
  if (step.legType === 'CARGO') return 'glow-cargo';
  if (step.legType === 'EMPTY') return 'glow-empty';
  if (step.items.length === 0) return 'glow-empty';
  if (step.items.some(i => i.type === 'PAX')) return 'glow-pax';
  return 'glow-cargo';
};

/** Convierte coordenadas en km a píxeles SVG usando la escala calculada */
function useKmToSvg(stations: StationConfig[]) {
  return useMemo(() => {
    if (stations.length === 0) return { toSvg: (_x: number, _y: number) => ({ x: VIEWBOX_W / 2, y: VIEWBOX_H / 2 }), fromSvg: (_x: number, _y: number) => ({ x: 0, y: 0 }) };

    const xs = stations.map(s => s.x);
    const ys = stations.map(s => s.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const rangeX = Math.max(maxX - minX, 1);
    const rangeY = Math.max(maxY - minY, 1);

    // Scale to fit SVG with padding, maintaining aspect ratio
    const scaleX = (VIEWBOX_W - PADDING * 2) / rangeX;
    const scaleY = (VIEWBOX_H - PADDING * 2) / rangeY;
    const scale = Math.min(scaleX, scaleY);

    // Center the map
    const offsetX = (VIEWBOX_W - rangeX * scale) / 2;
    const offsetY = (VIEWBOX_H - rangeY * scale) / 2;

    const toSvg = (x: number, y: number) => ({
      x: offsetX + (x - minX) * scale,
      y: offsetY + (y - minY) * scale,
    });

    const fromSvg = (svgX: number, svgY: number) => ({
      x: Math.round(((svgX - offsetX) / scale + minX) * 10) / 10,
      y: Math.round(((svgY - offsetY) / scale + minY) * 10) / 10,
    });

    // Scale in km per 100 SVG units (for scale bar)
    const kmPer100 = Math.round((100 / scale) * 10) / 10;

    return { toSvg, fromSvg, kmPer100 };
  }, [stations]);
}

export function RouteMap({
  plan,
  stations,
  currentStep,
  onStepChange,
  mapBackgroundUrl,
  onStationDrag,
  onBackgroundUpload,
}: RouteMapProps) {
  const namesMap = useMemo(() => buildNamesMap(stations), [stations]);
  const baseId = useMemo(() => getBaseStation(stations).id, [stations]);
  const { toSvg, fromSvg, kmPer100 } = useKmToSvg(stations);

  // Build coordsMap in SVG space
  const svgCoordsMap = useMemo(() => {
    const result: Record<string, { x: number; y: number }> = {};
    for (const s of stations) {
      result[s.id] = toSvg(s.x, s.y);
    }
    return result;
  }, [stations, toSvg]);

  const flightPath = useMemo(() => plan.steps.filter(s => s.action === 'TRAVEL'), [plan]);
  const refuelSteps = useMemo(() => plan.steps.filter(s => s.action === 'REFUEL'), [plan]);

  const [isPlaying, setIsPlaying] = useState(false);
  const [hoveredStation, setHoveredStation] = useState<string | null>(null);
  const [heliProgress, setHeliProgress] = useState(1);
  const heliAnimRef = useRef<number | null>(null);

  // Drag state
  const [draggingStation, setDraggingStation] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const screenToSVG = useCallback((clientX: number, clientY: number) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const svg = svgRef.current;
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const svgPt = pt.matrixTransform(ctm.inverse());
    return { x: svgPt.x, y: svgPt.y };
  }, []);

  const handleStationMouseDown = useCallback((e: React.MouseEvent, stationId: string) => {
    if (!onStationDrag) return;
    e.preventDefault();
    e.stopPropagation();
    const svgPt = screenToSVG(e.clientX, e.clientY);
    const coords = svgCoordsMap[stationId];
    if (!coords) return;
    setDraggingStation(stationId);
    setDragOffset({ x: svgPt.x - coords.x, y: svgPt.y - coords.y });
  }, [onStationDrag, screenToSVG, svgCoordsMap]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (draggingStation === null || !dragOffset || !onStationDrag) return;
    const svgPt = screenToSVG(e.clientX, e.clientY);
    const newSvgX = Math.max(PADDING / 2, Math.min(VIEWBOX_W - PADDING / 2, svgPt.x - dragOffset.x));
    const newSvgY = Math.max(PADDING / 2, Math.min(VIEWBOX_H - PADDING / 2, svgPt.y - dragOffset.y));
    // Convert back to km
    const { x: kmX, y: kmY } = fromSvg(newSvgX, newSvgY);
    onStationDrag(draggingStation, kmX, kmY);
  }, [draggingStation, dragOffset, onStationDrag, screenToSVG, fromSvg]);

  const handleMouseUp = useCallback(() => {
    setDraggingStation(null);
    setDragOffset(null);
  }, []);

  // Helicopter position
  const heliPosition = useMemo(() => {
    if (flightPath.length === 0) return svgCoordsMap[baseId] ?? { x: VIEWBOX_W / 2, y: VIEWBOX_H / 2 };
    const legIndex = Math.min(currentStep, flightPath.length - 1);
    const startId = legIndex > 0 ? flightPath[legIndex - 1].station : (plan.steps.find(s => s.action !== 'TRAVEL')?.station ?? baseId);
    const endId = flightPath[legIndex].station;
    const start = svgCoordsMap[startId] ?? { x: VIEWBOX_W / 2, y: VIEWBOX_H / 2 };
    const end = svgCoordsMap[endId] ?? { x: VIEWBOX_W / 2, y: VIEWBOX_H / 2 };
    return {
      x: start.x + (end.x - start.x) * heliProgress,
      y: start.y + (end.y - start.y) * heliProgress,
    };
  }, [flightPath, currentStep, heliProgress, plan.steps, svgCoordsMap, baseId]);

  useEffect(() => {
    setHeliProgress(0);
    let startTime: number | null = null;
    const duration = 800;
    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / duration, 1);
      setHeliProgress(1 - Math.pow(1 - progress, 3));
      if (progress < 1) {
        heliAnimRef.current = requestAnimationFrame(animate);
      }
    };
    heliAnimRef.current = requestAnimationFrame(animate);
    return () => { if (heliAnimRef.current) cancelAnimationFrame(heliAnimRef.current); };
  }, [currentStep, plan.id]);

  useEffect(() => {
    onStepChange(0);
    setIsPlaying(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan.id]);

  const advanceStep = useCallback(() => {
    const maxStep = flightPath.length - 1;
    onStepChange(Math.min(maxStep, currentStep + 1));
  }, [currentStep, flightPath.length, onStepChange]);

  useEffect(() => {
    if (!isPlaying) return;
    if (currentStep >= flightPath.length - 1) { setIsPlaying(false); return; }
    const id = setInterval(advanceStep, 1800);
    return () => clearInterval(id);
  }, [isPlaying, advanceStep, currentStep, flightPath.length]);

  const togglePlay = () => {
    if (currentStep >= flightPath.length - 1) { onStepChange(0); }
    setIsPlaying(v => !v);
  };

  const currentLegInfo = useMemo(() => {
    if (flightPath.length === 0) return null;
    const legIndex = Math.min(currentStep, flightPath.length - 1);
    const leg = flightPath[legIndex];
    const startId = legIndex > 0 ? flightPath[legIndex - 1].station : (plan.steps.find(s => s.action !== 'TRAVEL')?.station ?? baseId);
    return {
      from: namesMap[startId] ?? startId,
      to: namesMap[leg.station] ?? leg.station,
      items: leg.items,
      paxCount: leg.items.filter(i => i.type === 'PAX').length,
      cargoCount: leg.items.filter(i => i.type === 'CARGO').length,
      legType: leg.legType,
    };
  }, [flightPath, currentStep, plan.steps, namesMap, baseId]);

  const refuelStationIds = useMemo(() => new Set(refuelSteps.map(s => s.station)), [refuelSteps]);

  return (
    <div className="flex flex-col rounded-xl overflow-hidden border border-border/70 bg-card shadow-lg">
      <div
        className="relative w-full aspect-[4/3] sm:aspect-[16/9] overflow-hidden select-none"
        style={{
          background: mapBackgroundUrl
            ? undefined
            : 'linear-gradient(135deg, rgba(6,78,59,0.15) 0%, rgba(6,78,59,0.07) 40%, rgba(6,78,59,0.12) 100%)',
        }}
      >
        {!mapBackgroundUrl && (
          <>
            <div className="absolute inset-0 opacity-[0.06] dark:opacity-[0.08] pointer-events-none" style={{ backgroundImage: 'radial-gradient(ellipse at 30% 50%, rgba(34,197,94,0.4) 0%, transparent 60%), radial-gradient(ellipse at 70% 30%, rgba(34,197,94,0.3) 0%, transparent 50%), radial-gradient(ellipse at 50% 80%, rgba(34,197,94,0.2) 0%, transparent 50%)' }} />
            <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05] pointer-events-none" style={{ backgroundImage: 'linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)', backgroundSize: '80px 80px' }} />
          </>
        )}

        {/* Background upload button */}
        {onBackgroundUpload && (
          <button
            onClick={onBackgroundUpload}
            className="absolute top-3 right-3 z-30 flex items-center justify-center h-8 w-8 rounded-lg bg-card/80 dark:bg-card/60 border border-border/60 shadow-md backdrop-blur-sm hover:bg-card transition-colors"
            title="Subir imagen de fondo"
          >
            <Camera className="h-4 w-4 text-muted-foreground" />
          </button>
        )}

        {/* Current leg info badge */}
        {currentLegInfo && (
          <div className="absolute top-3 left-3 z-30 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card/85 dark:bg-card/70 border border-border/60 shadow-lg backdrop-blur-sm text-xs sm:text-sm">
            <span className="font-semibold text-foreground truncate max-w-[90px]">{currentLegInfo.from}</span>
            <span className="text-primary font-bold">→</span>
            <span className="font-semibold text-primary truncate max-w-[90px]">{currentLegInfo.to}</span>
            {currentLegInfo.paxCount > 0 && (
              <span className="flex items-center gap-1 bg-cyan-500/15 text-cyan-600 dark:text-cyan-300 px-1.5 py-0.5 rounded-full font-medium text-[10px]">
                <Users className="h-3 w-3" /> {currentLegInfo.paxCount}
              </span>
            )}
            {currentLegInfo.cargoCount > 0 && (
              <span className="flex items-center gap-1 bg-amber-500/15 text-amber-600 dark:text-amber-300 px-1.5 py-0.5 rounded-full font-medium text-[10px]">
                <Package className="h-3 w-3" /> {currentLegInfo.cargoCount}
              </span>
            )}
            {currentLegInfo.paxCount === 0 && currentLegInfo.cargoCount === 0 && (
              <span className="text-[10px] text-muted-foreground italic">Vacío</span>
            )}
          </div>
        )}

        {/* SVG map */}
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
          className="relative z-10 w-full h-full overflow-visible p-2 sm:p-4"
          preserveAspectRatio="xMidYMid meet"
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <defs>
            <radialGradient id="station-grad" cx="35%" cy="35%">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="1" />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.7" />
            </radialGradient>
            <radialGradient id="station-grad-default" cx="35%" cy="35%">
              <stop offset="0%" stopColor="hsl(var(--card))" stopOpacity="1" />
              <stop offset="100%" stopColor="hsl(var(--muted))" stopOpacity="0.9" />
            </radialGradient>
            <radialGradient id="base-grad" cx="30%" cy="30%">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity="1" />
              <stop offset="100%" stopColor="#0891b2" stopOpacity="0.9" />
            </radialGradient>
            <filter id="station-shadow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="rgba(0,0,0,0.3)" />
            </filter>
            <filter id="glow-pax" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
              <feFlood floodColor="#38bdf8" floodOpacity="0.6" result="color" />
              <feComposite in="color" in2="blur" operator="in" result="glow" />
              <feMerge><feMergeNode in="glow" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id="glow-cargo" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
              <feFlood floodColor="#fbbf24" floodOpacity="0.5" result="color" />
              <feComposite in="color" in2="blur" operator="in" result="glow" />
              <feMerge><feMergeNode in="glow" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id="glow-empty" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id="pulse-glow" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
              <feFlood floodColor="hsl(var(--primary))" floodOpacity="0.5" result="color" />
              <feComposite in="color" in2="blur" operator="in" />
            </filter>
            <marker id="arrow-cyan" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="#38bdf8" />
            </marker>
            <marker id="arrow-amber" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="#fbbf24" />
            </marker>
            <marker id="arrow-gray" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="#6b7280" />
            </marker>
          </defs>

          {/* Custom background image */}
          {mapBackgroundUrl && (
            <image
              href={mapBackgroundUrl}
              x="0" y="0" width={VIEWBOX_W} height={VIEWBOX_H}
              preserveAspectRatio="xMidYMid slice"
              opacity="0.6"
            />
          )}

          {/* All legs as dashed background */}
          {flightPath.map((leg, index) => {
            const startId = index > 0 ? flightPath[index - 1].station : plan.steps.find(s => s.action !== 'TRAVEL')?.station ?? baseId;
            const start = svgCoordsMap[startId];
            const end = svgCoordsMap[leg.station];
            if (!start || !end) return null;
            return (
              <line key={`bg-${index}`}
                x1={start.x} y1={start.y} x2={end.x} y2={end.y}
                stroke="currentColor" className="text-muted-foreground/20 dark:text-muted-foreground/10"
                strokeWidth="1.5" strokeDasharray="6 4"
              />
            );
          })}

          {/* Completed/active legs */}
          {flightPath.map((leg, index) => {
            if (index > currentStep) return null;
            const startId = index > 0 ? flightPath[index - 1].station : plan.steps.find(s => s.action !== 'TRAVEL')?.station ?? baseId;
            const start = svgCoordsMap[startId];
            const end = svgCoordsMap[leg.station];
            if (!start || !end) return null;
            const isCurrent = index === currentStep;
            const color = isCurrent ? getLegColor(leg) : '#9ca3af';
            const isEmpty = leg.legType === 'EMPTY' || leg.items.length === 0;
            const glowFilter = isCurrent ? `url(#${getLegGlowId(leg)})` : undefined;
            const arrowId = leg.legType === 'PAX' || leg.items.some(i => i.type === 'PAX') ? 'arrow-cyan'
              : leg.legType === 'CARGO' || leg.items.some(i => i.type === 'CARGO') ? 'arrow-amber' : 'arrow-gray';

            return (
              <g key={`active-${index}`}>
                <line
                  x1={start.x} y1={start.y} x2={end.x} y2={end.y}
                  stroke={color}
                  strokeWidth={isCurrent ? 3.5 : 2}
                  strokeDasharray={isEmpty && isCurrent ? '8 5' : undefined}
                  markerEnd={isCurrent ? `url(#${arrowId})` : undefined}
                  opacity={isCurrent ? 1 : 0.35}
                  filter={glowFilter}
                />
                {isCurrent && !isEmpty && (
                  <line
                    x1={start.x} y1={start.y} x2={end.x} y2={end.y}
                    stroke="white" strokeWidth="1.5" strokeDasharray="4 12" opacity="0.5"
                  >
                    <animate attributeName="stroke-dashoffset" from="0" to="-16" dur="0.8s" repeatCount="indefinite" />
                  </line>
                )}
              </g>
            );
          })}

          {/* Refuel markers */}
          {refuelSteps.map((rs, i) => {
            const coords = svgCoordsMap[rs.station];
            if (!coords) return null;
            return (
              <g key={`refuel-marker-${i}`} transform={`translate(${coords.x}, ${coords.y - 28})`}>
                <circle cx="0" cy="0" r="8" fill="#f97316" opacity="0.9" />
                <text x="0" y="1" textAnchor="middle" dy="0.35em" fontSize="8" fill="white" fontWeight="bold">⛽</text>
              </g>
            );
          })}

          {/* Station nodes */}
          {stations.map((station) => {
            const coords = svgCoordsMap[station.id];
            if (!coords) return null;
            const endStationId = flightPath[currentStep]?.station;
            const isCurrent = station.id === endStationId;
            const isBase = station.isBase === true;
            const isHovered = hoveredStation === station.id;
            const isDragging = draggingStation === station.id;
            const isRefuelStation = refuelStationIds.has(station.id);
            const hasPickup = plan.steps.some(s => s.action === 'PICKUP' && s.station === station.id);
            const hasDropoff = plan.steps.some(s => s.action === 'DROPOFF' && s.station === station.id);
            const r = isBase ? 18 : 13;

            // Label: remove prefix HP/BO for brevity
            const shortName = station.name.replace(/^(HP|BO)\s+/, '');

            return (
              <g key={station.id}
                transform={`translate(${coords.x}, ${coords.y})`}
                onMouseEnter={() => setHoveredStation(station.id)}
                onMouseLeave={() => setHoveredStation(null)}
                onMouseDown={(e) => handleStationMouseDown(e, station.id)}
                className={onStationDrag ? 'cursor-grab' : 'cursor-pointer'}
                style={isDragging ? { cursor: 'grabbing' } : undefined}
              >
                {isCurrent && (
                  <>
                    <circle cx="0" cy="0" r={r + 10} filter="url(#pulse-glow)" opacity="0.7">
                      <animate attributeName="r" values={`${r + 6};${r + 14};${r + 6}`} dur="2s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.7;0.3;0.7" dur="2s" repeatCount="indefinite" />
                    </circle>
                    <circle cx="0" cy="0" r={r + 4} fill="none" stroke="hsl(var(--primary))" strokeWidth="1.5" opacity="0.5">
                      <animate attributeName="r" values={`${r + 2};${r + 8};${r + 2}`} dur="2s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.6;0.15;0.6" dur="2s" repeatCount="indefinite" />
                    </circle>
                  </>
                )}

                {(hasPickup || hasDropoff) && !isCurrent && (
                  <circle cx="0" cy="0" r={r + 5} fill="none"
                    stroke={hasPickup && hasDropoff ? 'hsl(var(--primary))' : hasPickup ? '#34d399' : '#60a5fa'}
                    strokeWidth="1.5" strokeDasharray="4 3" opacity="0.5"
                  />
                )}

                <circle cx="1" cy="2" r={r} fill="rgba(0,0,0,0.15)" />
                <circle cx="0" cy="0" r={r}
                  fill={isBase ? 'url(#base-grad)' : isCurrent ? 'url(#station-grad)' : 'url(#station-grad-default)'}
                  stroke={isCurrent ? 'hsl(var(--primary-foreground))' : isBase ? '#06b6d4' : 'hsl(var(--border))'}
                  strokeWidth={isCurrent || isBase ? 2.5 : 2}
                  filter="url(#station-shadow)"
                />

                {isBase ? (
                  <>
                    <circle cx="0" cy="0" r={r - 4} fill="none" stroke="white" strokeWidth="1.5" opacity="0.7" />
                    <text x="0" y="1" textAnchor="middle" dy="0.35em" fontSize="13" fill="white" fontWeight="bold">H</text>
                  </>
                ) : (
                  <MapPin x={-5} y={-6} width="10" height="10" fill={isCurrent ? 'hsl(var(--primary-foreground))' : 'hsl(var(--foreground))'} />
                )}

                <rect x={-40} y={isBase ? 26 : 20} width={80} height={16} rx={4}
                  fill="hsl(var(--card))" fillOpacity="0.85"
                  stroke="hsl(var(--border))" strokeOpacity="0.4" strokeWidth="0.5"
                />
                <text x="0" y={isBase ? 37 : 31} textAnchor="middle" fontSize="8.5"
                  fill="hsl(var(--foreground))" fontWeight="600"
                >
                  {shortName}
                </text>

                {isRefuelStation && (
                  <g transform={`translate(${r + 2}, ${-r + 2})`}>
                    <circle cx="0" cy="0" r="6" fill="#f97316" stroke="white" strokeWidth="1" />
                    <text x="0" y="0.5" textAnchor="middle" dy="0.35em" fontSize="7" fill="white">⛽</text>
                  </g>
                )}

                {isHovered && !isDragging && (
                  <g transform="translate(0, -30)">
                    <rect x="-55" y="-14" width="110" height="18" rx="4"
                      fill="hsl(var(--popover))" stroke="hsl(var(--border))" strokeWidth="0.5" opacity="0.95"
                    />
                    <text x="0" y="-3" textAnchor="middle" fontSize="9"
                      fill="hsl(var(--popover-foreground))" fontWeight="500"
                    >
                      {station.name}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* Helicopter */}
          <g transform={`translate(${heliPosition.x}, ${heliPosition.y})`} className="pointer-events-none">
            <g transform="translate(-14, -30)">
              <rect x="4" y="12" width="20" height="10" rx="3" fill="hsl(var(--primary))" />
              <rect x="22" y="14" width="6" height="6" rx="2" fill="hsl(var(--primary-foreground))" opacity="0.8" stroke="currentColor" strokeWidth="0.5" />
              <line x1="0" y1="12" x2="28" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <animateTransform attributeName="transform" type="rotate" from="0 14 12" to="360 14 12" dur="0.3s" repeatCount="indefinite" />
              </line>
              <line x1="4" y1="17" x2="-4" y2="14" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinecap="round" />
              <circle cx="-4" cy="14" r="3" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.5">
                <animateTransform attributeName="transform" type="rotate" from="0 -4 14" to="360 -4 14" dur="0.2s" repeatCount="indefinite" />
              </circle>
              <line x1="6" y1="22" x2="6" y2="25" stroke="currentColor" strokeWidth="1" opacity="0.5" />
              <line x1="22" y1="22" x2="22" y2="25" stroke="currentColor" strokeWidth="1" opacity="0.5" />
              <line x1="3" y1="25" x2="25" y2="25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
            </g>
          </g>

          {/* Scale bar */}
          {kmPer100 && (
            <g transform={`translate(${VIEWBOX_W - 120}, ${VIEWBOX_H - 28})`}>
              <rect x="0" y="0" width="110" height="18" rx="4" fill="hsl(var(--card))" fillOpacity="0.8" stroke="hsl(var(--border))" strokeOpacity="0.5" strokeWidth="0.5" />
              <line x1="8" y1="10" x2="72" y2="10" stroke="hsl(var(--foreground))" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="8" y1="6" x2="8" y2="14" stroke="hsl(var(--foreground))" strokeWidth="1.5" />
              <line x1="72" y1="6" x2="72" y2="14" stroke="hsl(var(--foreground))" strokeWidth="1.5" />
              <text x="80" y="13" fontSize="8" fill="hsl(var(--muted-foreground))" fontWeight="500">{kmPer100} km</text>
            </g>
          )}
        </svg>

        {/* Controls */}
        {flightPath.length > 0 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 w-[94%] max-w-xl">
            <div className="bg-card/85 dark:bg-card/75 backdrop-blur-md border border-border/60 rounded-xl shadow-xl p-2.5 sm:p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">
                  Tramo {currentStep + 1}/{flightPath.length}
                </span>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg hover:bg-muted/80" onClick={() => { onStepChange(0); setIsPlaying(false); }}>
                    <SkipBack className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg hover:bg-muted/80" onClick={() => onStepChange(Math.max(0, currentStep - 1))} disabled={currentStep === 0}>
                    <SkipForward className="h-3.5 w-3.5 rotate-180" />
                  </Button>
                  <Button
                    variant={isPlaying ? 'default' : 'secondary'}
                    size="icon"
                    className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg shadow-sm"
                    onClick={togglePlay}
                  >
                    {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 ml-0.5" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg hover:bg-muted/80" onClick={() => onStepChange(Math.min(flightPath.length - 1, currentStep + 1))} disabled={currentStep >= flightPath.length - 1}>
                    <SkipForward className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div className="px-1">
                <Slider
                  value={[currentStep]}
                  onValueChange={(value) => { onStepChange(value[0]); setIsPlaying(false); }}
                  max={flightPath.length - 1}
                  step={1}
                  className="cursor-pointer"
                />
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] uppercase font-bold text-muted-foreground justify-center">
                <span className="flex items-center gap-1"><span className="inline-block w-3.5 h-1 bg-cyan-400 rounded-full shadow-[0_0_4px_rgba(56,189,248,0.5)]" /> PAX</span>
                <span className="flex items-center gap-1"><span className="inline-block w-3.5 h-1 bg-amber-400 rounded-full shadow-[0_0_4px_rgba(251,191,36,0.5)]" /> Carga</span>
                <span className="flex items-center gap-1"><span className="inline-block w-3.5 h-0.5 bg-gray-500 rounded-full" style={{ borderTop: '1px dashed' }} /> Vacío</span>
                <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-orange-500" /> Refuel</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
