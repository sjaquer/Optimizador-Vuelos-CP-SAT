
'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { FlightPlan } from '@/lib/types';
import { Map, Wind } from 'lucide-react';
import { Button } from '../ui/button';
import { Slider } from '../ui/slider';
import Image from 'next/image';

interface RouteMapProps {
  plan: FlightPlan;
  numStations: number; // Keep this prop for potential future use, though coords are now hardcoded
}

interface Point {
  x: number;
  y: number;
  name: string;
}

// Hardcoded coordinates based on the provided image, scaled to a 800x600 viewbox
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


export function RouteMap({ plan, numStations }: RouteMapProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const flightPath = useMemo(() => plan.steps.filter(s => s.action === 'TRAVEL'), [plan]);

  const helicopterPosition = useMemo(() => {
    if (flightPath.length === 0) {
      return stationCoords[0];
    }
    const legIndex = Math.min(currentStep, flightPath.length - 1);
    const endStationId = flightPath[legIndex]?.station ?? 0;
    
    return stationCoords[endStationId] || stationCoords[0];
  }, [currentStep, flightPath]);

  useEffect(() => {
    setCurrentStep(0);
  }, [plan]);


  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Map className="h-5 w-5" />
          <span>Visualización de Ruta ({plan.title})</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-6">
        <div className="relative w-full max-w-[800px] aspect-[4/3]" data-ai-hint="map schematic">
          <svg viewBox="0 0 800 600" className="rounded-lg border bg-card">
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
                    className="stroke-muted/50"
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
                  className={id === '0' ? 'fill-primary' : 'fill-card stroke-primary'}
                  strokeWidth="2"
                />
                 <text
                  x="15"
                  textAnchor="start"
                  dy="0.3em"
                  className={'fill-foreground font-semibold'}
                  fontSize="12"
                >
                  {id} {coords.name}
                </text>
              </g>
            ))}
          </svg>
          <div 
            className="absolute transition-all duration-500 ease-in-out" 
            style={{ 
              top: helicopterPosition.y - 20, 
              left: helicopterPosition.x - 20,
              width: 40,
              height: 40,
            }}
          >
              <Wind className="h-10 w-10 text-primary drop-shadow-lg" />
          </div>
        </div>
        {flightPath.length > 0 && (
          <div className="w-full max-w-lg space-y-4">
              <div className='flex justify-between items-center'>
                  <h4 className='font-medium'>Paso {currentStep + 1} de {flightPath.length}</h4>
                  <div className='flex gap-2'>
                      <Button variant="outline" size="sm" onClick={() => setCurrentStep(s => Math.max(0, s-1))} disabled={currentStep === 0}>Anterior</Button>
                      <Button variant="outline" size="sm" onClick={() => setCurrentStep(s => Math.min(flightPath.length - 1, s+1))} disabled={currentStep >= flightPath.length - 1}>Siguiente</Button>
                  </div>
              </div>
            <Slider
              value={[currentStep]}
              onValueChange={(value) => setCurrentStep(value[0])}
              max={flightPath.length - 1}
              step={1}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
