
'use client';

import { useMemo, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import type { FlightPlan } from '@/lib/types';
import { Wind } from 'lucide-react';
import { Button } from '../ui/button';
import { Slider } from '../ui/slider';

interface RouteMapProps {
  plan: FlightPlan;
  currentStep: number;
  onStepChange: (step: number) => void;
}

interface Point {
  x: number;
  y: number;
  name: string;
}

const stationCoords: Record<number, Point> = {
  0: { x: 450, y: 350, name: "BO Nuevo Mundo" },
  1: { x: 400, y: 250, name: "HP 6+800" },
  2: { x: 300, y: 300, name: "HP Kinteroni" },
  3: { x: 250, y: 150, name: "HP CT-5" },
  4: { x: 100, y: 200, name: "HP Sagari AX" },
  5: { x: 80, y: 100, name: "HP Sagari BX" },
  6: { x: 700, y: 500, name: "HP 14+000" },
  7: { x: 550, y: 80, name: "HP Porotobango" },
  8: { x: 180, y: 450, name: "HP Kitepampani" },
};


export function RouteMap({ plan, currentStep, onStepChange }: RouteMapProps) {
  const flightPath = useMemo(() => plan.steps.filter(s => s.action === 'TRAVEL'), [plan]);

  const helicopterPosition = useMemo(() => {
    if (flightPath.length === 0) {
      return stationCoords[0];
    }
    const legIndex = Math.min(currentStep, flightPath.length - 1);
    const endStationId = flightPath[legIndex]?.station ?? 0;
    
    return stationCoords[endStationId] || stationCoords[0];
  }, [currentStep, flightPath]);

  // Reset step to 0 when the plan changes
  useEffect(() => {
    onStepChange(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan.id]);

  return (
    <Card className="flex flex-col">
      <CardContent className="flex-1 flex flex-col items-center gap-6 p-4">
        <div className="relative w-full aspect-[4/3] bg-muted/20 rounded-lg">
          <svg viewBox="0 0 800 600" className="relative z-10 w-full h-full">
            <defs>
              <marker
                id="arrowhead"
                markerWidth="10"
                markerHeight="7"
                refX="0"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 10 3.5, 0 7" className="fill-primary" />
              </marker>
            </defs>

            {flightPath.map((leg, index) => {
              const startStationId = index > 0 ? flightPath[index-1].station : plan.steps.find(s => s.action !== 'TRAVEL')?.station ?? 0;
              const endStationId = leg.station;
              const start = stationCoords[startStationId];
              const end = stationCoords[endStationId];
              if (!start || !end) return null;
              return (
                 <line
                    key={`path-bg-${index}`}
                    x1={start.x}
                    y1={start.y}
                    x2={end.x}
                    y2={end.y}
                    className="stroke-muted/50 dark:stroke-muted/30"
                    strokeWidth="2"
                    strokeDasharray="4"
                  />
              )
            })}
            
            {flightPath.slice(0, currentStep + 1).map((leg, index) => {
              const startStationId = index > 0 ? flightPath[index - 1].station : plan.steps.find(s => s.action !== 'TRAVEL')?.station ?? 0;
              const endStationId = leg.station;
              const start = stationCoords[startStationId];
              const end = stationCoords[endStationId];
              if (!start || !end) return null;
              
              const isCurrentLeg = index === currentStep;

              return (
                <line
                  key={`path-active-${index}`}
                  x1={start.x}
                  y1={start.y}
                  x2={end.x}
                  y2={end.y}
                  className="stroke-primary transition-all duration-300"
                  strokeWidth={isCurrentLeg ? "4" : "2"}
                  markerEnd={isCurrentLeg ? "url(#arrowhead)" : "none"}
                />
              );
            })}
            
            {Object.entries(stationCoords).map(([id, coords]) => (
              <g key={id} transform={`translate(${coords.x}, ${coords.y})`}>
                 <circle
                  cx="0"
                  cy="0"
                  r={id === '0' ? '12' : '10'}
                  className={id === '0' ? 'fill-primary stroke-primary-foreground' : 'fill-card stroke-primary'}
                  strokeWidth="2"
                />
                 <text
                  x="0"
                  y="1"
                  textAnchor="middle"
                  dy="0.3em"
                  className={id === '0' ? 'fill-primary-foreground font-bold' : 'fill-primary font-bold'}
                  fontSize="12"
                >
                  {id}
                </text>
              </g>
            ))}

            <g 
              className="transition-transform duration-500 ease-in-out" 
              transform={`translate(${helicopterPosition.x}, ${helicopterPosition.y})`}
            >
                <Wind className="h-10 w-10 text-primary drop-shadow-lg -translate-x-5 -translate-y-5" />
            </g>
          </svg>
        </div>
        {flightPath.length > 0 && (
          <div className="w-full max-w-lg space-y-4 pt-4">
              <div className='flex justify-between items-center'>
                  <h4 className='font-medium'>Paso {currentStep + 1} de {flightPath.length}</h4>
                  <div className='flex gap-2'>
                      <Button variant="outline" size="sm" onClick={() => onStepChange(Math.max(0, currentStep-1))} disabled={currentStep === 0}>Anterior</Button>
                      <Button variant="outline" size="sm" onClick={() => onStepChange(Math.min(flightPath.length - 1, currentStep+1))} disabled={currentStep >= flightPath.length - 1}>Siguiente</Button>
                  </div>
              </div>
            <Slider
              value={[currentStep]}
              onValueChange={(value) => onStepChange(value[0])}
              max={flightPath.length - 1}
              step={1}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

    