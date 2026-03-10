
'use client';

import { useMemo, useEffect, useState, useRef, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import type { FlightPlan } from '@/lib/types';
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';
import { Button } from '../ui/button';
import { Slider } from '../ui/slider';
import { ALL_STATIONS, stationCoordsMap } from '@/lib/stations';

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
  if (hasPax && hasCargo) return 'stroke-blue-500';
  if (hasPax) return 'stroke-green-500';
  return 'stroke-orange-500';
};

const getLegLabel = (items: { type: string }[]): string => {
  if (items.length === 0) return '';
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
  const playInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const activeStations = useMemo(
    () => ALL_STATIONS.filter(s => s.id <= numStations),
    [numStations]
  );

  useEffect(() => {
    onStepChange(0);
    setAnimationKey(prev => prev + 1);
    setIsPlaying(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan.id]);

  useEffect(() => {
    setAnimationKey(prev => prev + 1);
  }, [currentStep]);

  // Autoplay logic
  const stopPlaying = useCallback(() => {
    setIsPlaying(false);
    if (playInterval.current) {
      clearInterval(playInterval.current);
      playInterval.current = null;
    }
  }, []);

  useEffect(() => {
    if (isPlaying) {
      playInterval.current = setInterval(() => {
        onStepChange(-1); // signal to advance; handled below
      }, 1500);
    } else {
      stopPlaying();
    }
    return () => {
      if (playInterval.current) clearInterval(playInterval.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying]);

  // Special handler: when autoplay fires, advance step
  useEffect(() => {
    if (!isPlaying) return;
    // We piggyback off the interval by watching currentStep
  }, [isPlaying, currentStep]);

  const handleAutoAdvance = useCallback(() => {
    if (!isPlaying) return;
    const maxStep = flightPath.length - 1;
    if (currentStep >= maxStep) {
      stopPlaying();
    }
  }, [isPlaying, currentStep, flightPath.length, stopPlaying]);

  useEffect(() => { handleAutoAdvance(); }, [handleAutoAdvance]);

  // Override onStepChange for autoplay
  const advanceStep = useCallback(() => {
    const maxStep = flightPath.length - 1;
    onStepChange(Math.min(maxStep, currentStep + 1));
  }, [currentStep, flightPath.length, onStepChange]);

  useEffect(() => {
    if (!isPlaying) return;
    const id = setInterval(advanceStep, 1500);
    return () => clearInterval(id);
  }, [isPlaying, advanceStep]);

  // Clean up duplicate interval from above
  useEffect(() => {
    if (isPlaying && playInterval.current) {
      clearInterval(playInterval.current);
      playInterval.current = null;
    }
  }, [isPlaying]);

  const togglePlay = () => {
    if (currentStep >= flightPath.length - 1) {
      onStepChange(0);
    }
    setIsPlaying(v => !v);
  };

  return (
    <Card className="flex flex-col shadow-sm border border-border/70 overflow-hidden">
      <CardContent className="flex-1 flex flex-col items-center p-0 m-0">
        <div className="relative w-full aspect-[4/3] bg-background">
          {/* Radar grid backgrounds */}
          <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at center, currentColor 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
          <div className="absolute inset-0 opacity-[0.04] dark:opacity-[0.06] pointer-events-none" style={{ backgroundImage: 'linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)', backgroundSize: '120px 120px' }}></div>
          
          <svg viewBox="0 0 800 600" className="relative z-10 w-full h-full overflow-visible p-4">
            <defs>
              <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="0" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" className="fill-primary" />
              </marker>
              <marker id="arrowhead-green" markerWidth="10" markerHeight="7" refX="0" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" className="fill-green-500" />
              </marker>
              <marker id="arrowhead-orange" markerWidth="10" markerHeight="7" refX="0" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" className="fill-orange-500" />
              </marker>
              <marker id="arrowhead-blue" markerWidth="10" markerHeight="7" refX="0" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" className="fill-blue-500" />
              </marker>
            </defs>

            {/* Background dashed lines for all legs */}
            {flightPath.map((leg, index) => {
              const startId = index > 0 ? flightPath[index - 1].station : plan.steps.find(s => s.action !== 'TRAVEL')?.station ?? 0;
              const start = stationCoordsMap[startId];
              const end = stationCoordsMap[leg.station];
              if (!start || !end) return null;
              return (
                <line
                  key={`bg-${index}`}
                  x1={start.x} y1={start.y} x2={end.x} y2={end.y}
                  className="stroke-muted/50 dark:stroke-muted/30"
                  strokeWidth="2" strokeDasharray="4"
                />
              );
            })}

            {/* Active leg with color coding */}
            {(() => {
              if (flightPath.length === 0) return null;
              const legIndex = Math.min(currentStep, flightPath.length - 1);
              const startId = legIndex > 0 ? flightPath[legIndex - 1].station : plan.steps.find(s => s.action !== 'TRAVEL')?.station ?? 0;
              const endId = flightPath[legIndex].station;
              const start = stationCoordsMap[startId];
              const end = stationCoordsMap[endId];
              if (!start || !end) return null;

              const items = flightPath[legIndex].items;
              const colorClass = getLegColor(items);
              const label = getLegLabel(items);
              const midX = (start.x + end.x) / 2;
              const midY = (start.y + end.y) / 2;

              const arrowId = colorClass.includes('green') ? 'arrowhead-green'
                : colorClass.includes('orange') ? 'arrowhead-orange'
                : colorClass.includes('blue') ? 'arrowhead-blue'
                : 'arrowhead';

              return (
                <>
                  <line
                    key={`${animationKey}-active`}
                    x1={start.x} y1={start.y} x2={end.x} y2={end.y}
                    className={`${colorClass} animate-draw`}
                    strokeWidth="4"
                    markerEnd={`url(#${arrowId})`}
                  />
                  {label && (
                    <g transform={`translate(${midX}, ${midY - 12})`}>
                      <rect x="-35" y="-10" width="70" height="18" rx="4" className="fill-card/90 stroke-border" strokeWidth="1" />
                      <text textAnchor="middle" dy="0.35em" fontSize="10" className="fill-foreground font-medium">{label}</text>
                    </g>
                  )}
                </>
              );
            })()}

            {/* Station nodes */}
            {activeStations.map((station) => {
              const endStationId = flightPath[currentStep]?.station;
              const isCurrent = station.id === endStationId;
              const isBase = station.id === 0;
              const isHovered = hoveredStation === station.id;

              return (
                <g
                  key={station.id}
                  transform={`translate(${station.x}, ${station.y})`}
                  onMouseEnter={() => setHoveredStation(station.id)}
                  onMouseLeave={() => setHoveredStation(null)}
                  className="cursor-pointer"
                >
                  <circle cx="0" cy="0" r={isBase ? 12 : 10}
                    className={isBase ? 'fill-primary stroke-primary-foreground' : 'fill-card stroke-primary'}
                    strokeWidth="2"
                  />
                  {isCurrent && <circle cx="0" cy="0" r="12" className="fill-primary/50 animate-station-pulse" />}
                  <text x="0" y="1" textAnchor="middle" dy="0.3em"
                    className={isBase ? 'fill-primary-foreground font-bold' : 'fill-primary font-bold'}
                    fontSize="12"
                  >
                    {station.id}
                  </text>
                  {/* Tooltip on hover */}
                  {isHovered && (
                    <g transform="translate(0, -22)">
                      <rect x={-station.name.length * 3.5 - 6} y="-12" width={station.name.length * 7 + 12} height="20" rx="4"
                        className="fill-card stroke-border" strokeWidth="1" />
                      <text textAnchor="middle" dy="0.3em" fontSize="11" className="fill-foreground font-medium">
                        {station.name}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Controls */}
        {flightPath.length > 0 && (
          <div className="w-full space-y-4 p-5 bg-card border-t z-10 w-full relative">
            <div className="max-w-2xl mx-auto flex justify-between items-center bg-muted/40 p-2.5 rounded-lg border">
              <h4 className="font-semibold text-sm px-2 text-muted-foreground uppercase tracking-wide">Tramo {currentStep + 1} de {flightPath.length}</h4>
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

            {/* Color legend */}
            <div className="flex items-center gap-6 text-[10px] uppercase font-bold text-muted-foreground justify-center pt-2">
              <span className="flex items-center gap-1.5"><span className="inline-block w-4 h-1 bg-green-500 rounded-full" /> Vuelo de Personal (PAX)</span>
              <span className="flex items-center gap-1.5"><span className="inline-block w-4 h-1 bg-amber-500 rounded-full" /> Vuelo de Carga Pura</span>
              <span className="flex items-center gap-1.5"><span className="inline-block w-4 h-1 bg-blue-500 rounded-full" /> Vuelo Combinado (Mixto)</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
