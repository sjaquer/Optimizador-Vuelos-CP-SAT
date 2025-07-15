'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { FlightPlan } from '@/lib/types';
import { Map } from 'lucide-react';
import { Button } from '../ui/button';
import { Slider } from '../ui/slider';

interface RouteMapProps {
  plan: FlightPlan;
  numStations: number;
}

interface Point {
  x: number;
  y: number;
}

function HelicopterIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2.5 12a5.5 5.5 0 0 1 11 0" />
      <path d="M12.5 12H18a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-1.5" />
      <path d="M19 16V9a2 2 0 0 1 2-2h1" />
      <path d="M22 7h-2" />
      <path d="M8 12.5V21" />
      <path d="M5 21h6" />
      <path d="M8 8.5V6a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v2.5" />
    </svg>
  );
}


export function RouteMap({ plan, numStations }: RouteMapProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const { stationCoords, pathCoords } = useMemo(() => {
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

    const pCoords: Point[] = [];
    if (plan.steps.length > 0) {
      let lastStation = 0;
      plan.steps.forEach(step => {
        if (step.action === 'TRAVEL' || pCoords.length === 0) {
          pCoords.push(sCoords[lastStation]);
          pCoords.push(sCoords[step.station]);
          lastStation = step.station;
        }
      });
    }
    
    // A bit of a hack to map slider steps to path segments
    const flightPath = plan.steps.filter(s => s.action === 'TRAVEL');
    if (currentStep < flightPath.length) {
        const currentLegStart = sCoords[currentStep > 0 ? flightPath[currentStep-1].station : 0];
        const currentLegEnd = sCoords[flightPath[currentStep].station];
        pCoords.push(currentLegStart, currentLegEnd);
    }


    return { stationCoords: sCoords, pathCoords: pCoords };
  }, [plan, numStations]);
  
  const flightPath = plan.steps.filter(s => s.action === 'TRAVEL');

  const helicopterPosition = useMemo(() => {
    if (currentStep >= flightPath.length) {
      return stationCoords[flightPath[flightPath.length - 1]?.station ?? 0];
    }
    const startStation = currentStep > 0 ? flightPath[currentStep-1].station : 0;
    const endStation = flightPath[currentStep].station;

    return stationCoords[endStation];
  }, [currentStep, flightPath, stationCoords]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Map className="h-5 w-5" />
          <span>Visualización de Ruta</span>
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
              const startStation = index > 0 ? flightPath[index-1].station : 0;
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
            {flightPath.map((leg, index) => {
              if (index > currentStep) return null;
              const startStation = index > 0 ? flightPath[index-1].station : 0;
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
                  markerEnd="url(#arrowhead)"
                  style={{
                    strokeDasharray: '500',
                    strokeDashoffset: isCurrentLeg ? '0' : '500',
                    animation: isCurrentLeg ? 'dash 1s linear forwards' : 'none',
                  }}
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
            
            {helicopterPosition && (
              <g transform={`translate(${helicopterPosition.x}, ${helicopterPosition.y})`} className="transition-transform duration-500 ease-in-out">
                 <HelicopterIcon className="h-8 w-8 -translate-x-4 -translate-y-10 text-accent-foreground fill-accent" />
              </g>
            )}

          </svg>
           <style jsx>{`
                @keyframes dash {
                  from {
                    stroke-dashoffset: 500;
                  }
                  to {
                    stroke-dashoffset: 0;
                  }
                }
              `}</style>
        </div>
        <div className="w-full max-w-lg space-y-4">
            <div className='flex justify-between items-center'>
                <h4 className='font-medium'>Paso {currentStep + 1} de {flightPath.length}</h4>
                <div className='flex gap-2'>
                    <Button variant="outline" size="sm" onClick={() => setCurrentStep(s => Math.max(0, s-1))} disabled={currentStep === 0}>Anterior</Button>
                    <Button variant="outline" size="sm" onClick={() => setCurrentStep(s => Math.min(flightPath.length - 1, s+1))} disabled={currentStep === flightPath.length - 1}>Siguiente</Button>
                </div>
            </div>
          <Slider
            value={[currentStep]}
            onValueChange={(value) => setCurrentStep(value[0])}
            max={flightPath.length - 1}
            step={1}
          />
        </div>
      </CardContent>
    </Card>
  );
}
