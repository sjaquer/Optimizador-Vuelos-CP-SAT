
'use client';

import { useMemo, useEffect, useState, useRef, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import type { FlightPlan } from '@/lib/types';
import { Play, Pause, SkipBack, SkipForward, Users, Package } from 'lucide-react';
import { Button } from '../ui/button';
import { Slider } from '../ui/slider';
import { ALL_STATIONS, stationCoordsMap, stationNamesMap } from '@/lib/stations';

interface RouteMapProps {
  plan: FlightPlan;
  numStations: number;
  currentStep: number;
  onStepChange: (step: number) => void;
}

const getLegColor = (items: { type: string }[]): string => {
  if (items.length === 0) return 'stroke-muted-foreground';
  const hasPax = items.some(i => i.type === 'PAX');
  const hasCargo = items.some(i => i.type === 'CARGO');
  if (hasPax && hasCargo) return 'stroke-violet-500';
  if (hasPax) return 'stroke-blue-500';
  return 'stroke-amber-500';
};

const getLegLabel = (items: { type: string }[]): string => {
  if (items.length === 0) return 'Vacío';
  const pax = items.filter(i => i.type === 'PAX').length;
  const cargo = items.filter(i => i.type === 'CARGO').length;
  const parts: string[] = [];
  if (pax > 0) parts.push(`${pax} PAX`);
  if (cargo > 0) parts.push(`${cargo} CRG`);
  return parts.join(' + ');
};

export function RouteMap({ plan, numStations, currentStep, onStepChange }: RouteMapProps) {
  const flightPath = useMemo(() => plan.steps.filter(s => s.action === 'TRAVEL'), [plan]);
  const [animationKey, setAnimationKey] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hoveredStation, setHoveredStation] = useState<number | null>(null);
  const [heliProgress, setHeliProgress] = useState(1); // 0 to 1 for animation
  const heliAnimRef = useRef<number | null>(null);

  const activeStations = useMemo(
    () => ALL_STATIONS.filter(s => s.id <= numStations),
    [numStations]
  );

  // Calculate helicopter position
  const heliPosition = useMemo(() => {
    if (flightPath.length === 0) return { x: stationCoordsMap[0]?.x ?? 450, y: stationCoordsMap[0]?.y ?? 350 };
    const legIndex = Math.min(currentStep, flightPath.length - 1);
    const startId = legIndex > 0 ? flightPath[legIndex - 1].station : (plan.steps.find(s => s.action !== 'TRAVEL')?.station ?? 0);
    const endId = flightPath[legIndex].station;
    const start = stationCoordsMap[startId] ?? { x: 450, y: 350 };
    const end = stationCoordsMap[endId] ?? { x: 450, y: 350 };
    return {
      x: start.x + (end.x - start.x) * heliProgress,
      y: start.y + (end.y - start.y) * heliProgress,
    };
  }, [flightPath, currentStep, heliProgress, plan.steps]);

  // Helicopter animation
  useEffect(() => {
    setHeliProgress(0);
    let startTime: number | null = null;
    const duration = 800; // ms

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
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
    setAnimationKey(prev => prev + 1);
    setIsPlaying(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan.id]);

  useEffect(() => { setAnimationKey(prev => prev + 1); }, [currentStep]);

  // Autoplay
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

  // Current leg info
  const currentLegInfo = useMemo(() => {
    if (flightPath.length === 0) return null;
    const legIndex = Math.min(currentStep, flightPath.length - 1);
    const leg = flightPath[legIndex];
    const startId = legIndex > 0 ? flightPath[legIndex - 1].station : (plan.steps.find(s => s.action !== 'TRAVEL')?.station ?? 0);
    return {
      from: stationNamesMap[startId] ?? `E-${startId}`,
      to: stationNamesMap[leg.station] ?? `E-${leg.station}`,
      items: leg.items,
      paxCount: leg.items.filter(i => i.type === 'PAX').length,
      cargoCount: leg.items.filter(i => i.type === 'CARGO').length,
    };
  }, [flightPath, currentStep, plan.steps]);

  return (
    <Card className="flex flex-col shadow-sm border border-border/70 overflow-hidden">
      <CardContent className="flex-1 flex flex-col items-center p-0 m-0">
        <div className="relative w-full aspect-[4/3] bg-background">
          {/* Grid background */}
          <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at center, currentColor 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
          <div className="absolute inset-0 opacity-[0.04] dark:opacity-[0.06] pointer-events-none" style={{ backgroundImage: 'linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)', backgroundSize: '120px 120px' }}></div>
          
          <svg viewBox="0 0 800 600" className="relative z-10 w-full h-full overflow-visible p-4">
            <defs>
              <marker id="arrowhead-blue" markerWidth="8" markerHeight="6" refX="0" refY="3" orient="auto">
                <polygon points="0 0, 8 3, 0 6" className="fill-blue-500" />
              </marker>
              <marker id="arrowhead-amber" markerWidth="8" markerHeight="6" refX="0" refY="3" orient="auto">
                <polygon points="0 0, 8 3, 0 6" className="fill-amber-500" />
              </marker>
              <marker id="arrowhead-muted" markerWidth="8" markerHeight="6" refX="0" refY="3" orient="auto">
                <polygon points="0 0, 8 3, 0 6" className="fill-muted-foreground" />
              </marker>
            </defs>

            {/* All legs as dashed background */}
            {flightPath.map((leg, index) => {
              const startId = index > 0 ? flightPath[index - 1].station : plan.steps.find(s => s.action !== 'TRAVEL')?.station ?? 0;
              const start = stationCoordsMap[startId];
              const end = stationCoordsMap[leg.station];
              if (!start || !end) return null;
              return (
                <line key={`bg-${index}`}
                  x1={start.x} y1={start.y} x2={end.x} y2={end.y}
                  className="stroke-muted/40 dark:stroke-muted/20"
                  strokeWidth="1.5" strokeDasharray="6 4"
                />
              );
            })}

            {/* Completed legs as solid lines */}
            {flightPath.map((leg, index) => {
              if (index > currentStep) return null;
              const startId = index > 0 ? flightPath[index - 1].station : plan.steps.find(s => s.action !== 'TRAVEL')?.station ?? 0;
              const start = stationCoordsMap[startId];
              const end = stationCoordsMap[leg.station];
              if (!start || !end) return null;
              const colorClass = index === currentStep ? getLegColor(leg.items) : 'stroke-muted-foreground/30';
              const arrowId = leg.items.some(i => i.type === 'PAX') ? 'arrowhead-blue'
                : leg.items.some(i => i.type === 'CARGO') ? 'arrowhead-amber' : 'arrowhead-muted';
              return (
                <line key={`active-${index}`}
                  x1={start.x} y1={start.y} x2={end.x} y2={end.y}
                  className={`${colorClass} ${index === currentStep ? 'animate-draw' : ''}`}
                  strokeWidth={index === currentStep ? 3.5 : 2}
                  markerEnd={index === currentStep ? `url(#${arrowId})` : undefined}
                  opacity={index === currentStep ? 1 : 0.4}
                />
              );
            })}

            {/* Station nodes with names */}
            {activeStations.map((station) => {
              const endStationId = flightPath[currentStep]?.station;
              const isCurrent = station.id === endStationId;
              const isBase = station.id === 0;
              const isHovered = hoveredStation === station.id;

              // Check if station has activity in current step
              const hasPickup = plan.steps.some(s => s.action === 'PICKUP' && s.station === station.id);
              const hasDropoff = plan.steps.some(s => s.action === 'DROPOFF' && s.station === station.id);

              return (
                <g key={station.id}
                  transform={`translate(${station.x}, ${station.y})`}
                  onMouseEnter={() => setHoveredStation(station.id)}
                  onMouseLeave={() => setHoveredStation(null)}
                  className="cursor-pointer"
                >
                  {/* Activity ring */}
                  {(hasPickup || hasDropoff) && (
                    <circle cx="0" cy="0" r="18" fill="none"
                      className={hasPickup && hasDropoff ? 'stroke-primary/30' : hasPickup ? 'stroke-emerald-500/30' : 'stroke-blue-500/30'}
                      strokeWidth="2" strokeDasharray="4 2"
                    />
                  )}
                  
                  {/* Pulse ring for current station */}
                  {isCurrent && <circle cx="0" cy="0" r="16" className="fill-primary/20 animate-station-pulse" />}
                  
                  {/* Station circle */}
                  <circle cx="0" cy="0" r={isBase ? 14 : 10}
                    className={isBase ? 'fill-primary stroke-primary/50' : isCurrent ? 'fill-primary stroke-primary-foreground' : 'fill-card stroke-border'}
                    strokeWidth="2"
                  />
                  <text x="0" y="1" textAnchor="middle" dy="0.3em"
                    className={isBase || isCurrent ? 'fill-primary-foreground font-bold' : 'fill-foreground font-semibold'}
                    fontSize={isBase ? 10 : 9}
                  >
                    {isBase ? 'BO' : station.id}
                  </text>
                  
                  {/* Station name label (always visible) */}
                  <text x="0" y={isBase ? 24 : 20} textAnchor="middle" fontSize="9"
                    className="fill-muted-foreground font-medium"
                  >
                    {station.name.replace('HP ', '').replace('BO ', '')}
                  </text>
                </g>
              );
            })}

            {/* Helicopter icon */}
            <g transform={`translate(${heliPosition.x}, ${heliPosition.y})`} className="pointer-events-none">
              <g transform="translate(-14, -30)">
                {/* Helicopter body */}
                <rect x="4" y="12" width="20" height="10" rx="3" className="fill-primary" />
                {/* Cockpit */}
                <rect x="22" y="14" width="6" height="6" rx="2" className="fill-primary-foreground/80" stroke="currentColor" strokeWidth="0.5" />
                {/* Main rotor */}
                <line x1="0" y1="12" x2="28" y2="12" className="stroke-foreground" strokeWidth="1.5" strokeLinecap="round">
                  <animateTransform attributeName="transform" type="rotate" from="0 14 12" to="360 14 12" dur="0.3s" repeatCount="indefinite" />
                </line>
                {/* Tail */}
                <line x1="4" y1="17" x2="-4" y2="14" className="stroke-primary" strokeWidth="2" strokeLinecap="round" />
                {/* Tail rotor */}
                <circle cx="-4" cy="14" r="3" fill="none" className="stroke-foreground/50" strokeWidth="1">
                  <animateTransform attributeName="transform" type="rotate" from="0 -4 14" to="360 -4 14" dur="0.2s" repeatCount="indefinite" />
                </circle>
                {/* Skids */}
                <line x1="6" y1="22" x2="6" y2="25" className="stroke-muted-foreground" strokeWidth="1" />
                <line x1="22" y1="22" x2="22" y2="25" className="stroke-muted-foreground" strokeWidth="1" />
                <line x1="3" y1="25" x2="25" y2="25" className="stroke-muted-foreground" strokeWidth="1.5" strokeLinecap="round" />
              </g>
            </g>
          </svg>
        </div>

        {/* Current leg info bar */}
        {currentLegInfo && (
          <div className="w-full bg-muted/30 border-t px-4 py-2.5 flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="font-semibold text-foreground truncate">{currentLegInfo.from}</span>
              <span className="text-muted-foreground">→</span>
              <span className="font-semibold text-primary truncate">{currentLegInfo.to}</span>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {currentLegInfo.paxCount > 0 && (
                <span className="flex items-center gap-1 text-xs bg-blue-500/10 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full font-medium">
                  <Users className="h-3 w-3" /> {currentLegInfo.paxCount} PAX
                </span>
              )}
              {currentLegInfo.cargoCount > 0 && (
                <span className="flex items-center gap-1 text-xs bg-amber-500/10 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full font-medium">
                  <Package className="h-3 w-3" /> {currentLegInfo.cargoCount} CRG
                </span>
              )}
              {currentLegInfo.paxCount === 0 && currentLegInfo.cargoCount === 0 && (
                <span className="text-xs text-muted-foreground italic">Vuelo vacío (reposición)</span>
              )}
            </div>
          </div>
        )}

        {/* Controls */}
        {flightPath.length > 0 && (
          <div className="w-full space-y-3 p-4 bg-card border-t z-10 relative">
            <div className="max-w-2xl mx-auto flex justify-between items-center bg-muted/40 p-2 rounded-lg border">
              <h4 className="font-semibold text-sm px-2 text-muted-foreground uppercase tracking-wide">Tramo {currentStep + 1} / {flightPath.length}</h4>
              <div className="flex gap-1.5">
                <Button variant="outline" size="sm" className="h-8 shadow-sm" onClick={() => { onStepChange(0); setIsPlaying(false); }}>
                  <SkipBack className="h-4 w-4 mr-1" /> Inicio
                </Button>
                <div className="w-px h-8 bg-border mx-1" />
                <Button variant="outline" size="icon" className="h-8 w-8 shadow-sm" onClick={() => onStepChange(Math.max(0, currentStep - 1))} disabled={currentStep === 0}>
                  <SkipForward className="h-4 w-4 rotate-180" />
                </Button>
                <Button variant={isPlaying ? 'default' : 'secondary'} size="icon" className="h-8 w-8 shadow-sm border-primary/20" onClick={togglePlay}>
                  {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
                </Button>
                <Button variant="outline" size="icon" className="h-8 w-8 shadow-sm" onClick={() => onStepChange(Math.min(flightPath.length - 1, currentStep + 1))} disabled={currentStep >= flightPath.length - 1}>
                  <SkipForward className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <div className="px-4 max-w-2xl mx-auto">
              <Slider
                value={[currentStep]}
                onValueChange={(value) => { onStepChange(value[0]); setIsPlaying(false); }}
                max={flightPath.length - 1}
                step={1}
                className="cursor-pointer py-2"
              />
            </div>

            <div className="flex items-center gap-6 text-[10px] uppercase font-bold text-muted-foreground justify-center pt-1">
              <span className="flex items-center gap-1.5"><span className="inline-block w-4 h-1 bg-blue-500 rounded-full" /> Vuelo PAX</span>
              <span className="flex items-center gap-1.5"><span className="inline-block w-4 h-1 bg-amber-500 rounded-full" /> Vuelo Carga</span>
              <span className="flex items-center gap-1.5"><span className="inline-block w-4 h-0.5 bg-muted-foreground rounded-full" style={{ borderTop: '1px dashed' }} /> Ruta planificada</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
