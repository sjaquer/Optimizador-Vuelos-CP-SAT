
'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { FlightPlan } from '@/lib/types';
import { Map } from 'lucide-react';
import { Button } from '../ui/button';
import { Slider } from '../ui/slider';
import Image from 'next/image';

interface RouteMapProps {
  plan: FlightPlan;
  numStations: number;
}

interface Point {
  x: number;
  y: number;
}


export function RouteMap({ plan, numStations }: RouteMapProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const { stationCoords } = useMemo(() => {
    const width = 500;
    const height = 500;
    const center = { x: width / 2, y: height / 2 };
    const radius = width / 2 - 40;

    const sCoords: Record<number, Point> = {
      0: center,
    };

    for (let i = 1; i <= numStations; i++) {
      const angle = (i - 1) * (2 * Math.PI / numStations) - Math.PI / 2;
      sCoords[i] = {
        x: center.x + radius * Math.cos(angle),
        y: center.y + radius * Math.sin(angle),
      };
    }
    return { stationCoords: sCoords };
  }, [numStations]);
  
  const flightPath = plan.steps.filter(s => s.action === 'TRAVEL');

  const helicopterPosition = useMemo(() => {
    if (flightPath.length === 0) {
        return stationCoords[0];
    }
    if (currentStep >= flightPath.length) {
      return stationCoords[flightPath[flightPath.length - 1]?.station ?? 0];
    }
    const endStation = flightPath[currentStep].station;

    return stationCoords[endStation];
  }, [currentStep, flightPath, stationCoords]);

  // Reset step to 0 when plan changes
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
        <div className="relative w-full max-w-[500px]" data-ai-hint="map schematic">
          <svg viewBox="0 0 500 500" className="rounded-lg border bg-card">
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

            {/* Render full path faintly */}
            {flightPath.map((leg, index) => {
              const startStation = index > 0 ? flightPath[index-1].station : plan.steps.find(s => s.action !== 'TRAVEL')?.station ?? 0;
              const endStation = leg.station;
              const start = stationCoords[startStation];
              const end = stationCoords[endStation];
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
            
            {/* Render active path */}
            {flightPath.slice(0, currentStep + 1).map((leg, index) => {
              const startStation = index > 0 ? flightPath[index-1].station : plan.steps.find(s => s.action !== 'TRAVEL')?.station ?? 0;
              const endStation = leg.station;
              const start = stationCoords[startStation];
              const end = stationCoords[endStation];
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
                  r={id === '0' ? '20' : '15'}
                  className={id === '0' ? 'fill-primary' : 'fill-card stroke-primary'}
                  strokeWidth="2"
                />
                <text
                  textAnchor="middle"
                  dy="0.3em"
                  className={id === '0' ? 'fill-primary-foreground font-bold' : 'fill-primary font-semibold'}
                  fontSize="12"
                >
                  {id === '0' ? 'Base' : id}
                </text>
              </g>
            ))}
            
          </svg>
          {helicopterPosition && (
              <div 
                className="absolute transition-all duration-500 ease-in-out" 
                style={{ 
                  top: helicopterPosition.y - 20, 
                  left: helicopterPosition.x - 20,
                  width: 40,
                  height: 40
                }}
              >
                 <Image src="/images/helicopter.png" alt="Helicopter" width={40} height={40} className="drop-shadow-lg" />
              </div>
            )}
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
