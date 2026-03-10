
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { FlightPlan, TransportItem } from '@/lib/types';
import { PlaneTakeoff, PlaneLanding, Users, Package, ArrowRight, Waypoints } from 'lucide-react';
import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { stationNamesMap } from '@/lib/stations';

interface FlightManifestProps {
  plan: FlightPlan;
  currentStep: number;
}

export function FlightManifest({ plan, currentStep }: FlightManifestProps) {
  const flightPath = useMemo(() => plan.steps.filter(s => s.action === 'TRAVEL'), [plan]);
  
  const manifestData = useMemo(() => {
    if (!plan || flightPath.length === 0 || currentStep >= flightPath.length) return null;

    const currentTravelStep = flightPath[currentStep];
    const endStationId = currentTravelStep.station;

    const previousTravelStep = currentStep > 0 ? flightPath[currentStep - 1] : null;
    const startStationId = previousTravelStep?.station ?? 0;

    const currentTravelStepIndex = plan.steps.findIndex(step => step === currentTravelStep);
    const prevTravelStepIndex = previousTravelStep 
        ? plan.steps.findIndex(step => step === previousTravelStep) 
        : -1;

    let endSliceIndex = plan.steps.length;
    if (currentStep + 1 < flightPath.length) {
        const nextTravelStep = flightPath[currentStep + 1];
        endSliceIndex = plan.steps.findIndex(step => step === nextTravelStep);
    }
    
    const relevantActions = plan.steps.slice(prevTravelStepIndex + 1, endSliceIndex);

    const dropoffs = relevantActions
        .filter(s => s.action === 'DROPOFF' && s.station === endStationId)
        .flatMap(s => s.items);

    const pickups = relevantActions
        .filter(s => s.action === 'PICKUP' && s.station === endStationId)
        .flatMap(s => s.items);

    return {
      station: endStationId,
      pickups,
      dropoffs,
      previousStation: startStationId,
    };
  }, [currentStep, plan, flightPath]);

  const sName = (id: number) => stationNamesMap[id] ?? `E-${id}`;

  const ItemBadge = ({ item, isPickup }: { item: TransportItem, isPickup: boolean }) => (
    <div 
        className={cn(
          "flex items-center gap-2 p-2 rounded-md border text-sm font-medium",
          isPickup ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300 animate-manifest-item-in" : "bg-blue-500/10 border-blue-500/20 text-blue-700 dark:text-blue-300",
        )}
    >
      <div className="bg-background rounded p-1 shadow-sm shrink-0">
        {item.type === 'PAX' ? <Users className="h-3.5 w-3.5" /> : <Package className="h-3.5 w-3.5" />}
      </div>
      <div className="flex flex-col flex-1 min-w-0">
        <span className="truncate leading-tight">{item.area} <span className="opacity-70 font-normal">| {item.type}</span></span>
        <span className="text-[10px] opacity-70 flex gap-2">
          <span>Prio: {item.priority}</span>
          <span>{item.type === 'PAX' ? `${item.quantity} pax` : `${item.weight} kg`}</span>
          <span>{sName(item.originStation)} → {sName(item.destinationStation)}</span>
        </span>
      </div>
    </div>
  );

  return (
    <Card className="shadow-sm border-border/70">
      <CardHeader className="bg-muted/30 border-b pb-4">
        <CardTitle className="text-lg flex items-center gap-2 tracking-tight">
            <Waypoints className="h-5 w-5 text-primary"/>
            Manifiesto de Escala
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        {manifestData ? (
          <div className="space-y-5">
             <div className="flex items-center justify-center text-center bg-background border rounded-lg p-3 shadow-sm mx-auto">
                <div className="flex flex-col items-center">
                  <span className="text-[10px] text-muted-foreground uppercase">Desde</span>
                  <span className='font-bold text-sm'>{sName(manifestData.previousStation)}</span>
                </div>
                <ArrowRight className="mx-4 h-5 w-5 text-primary shrink-0" />
                <div className="flex flex-col items-center">
                  <span className="text-[10px] text-muted-foreground uppercase">Hacia</span>
                  <span className='font-bold text-sm text-primary'>{sName(manifestData.station)}</span>
                </div>
             </div>
             
             <ScrollArea className="h-72">
                <div className="space-y-6 pr-4">
                    <div className="bg-card border rounded-lg p-3">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5"><PlaneLanding className="text-blue-500 h-4 w-4"/> Desembarcan ({manifestData.dropoffs.length})</h4>
                        {manifestData.dropoffs.length > 0 ? (
                            <div className="space-y-2">
                                {manifestData.dropoffs.map(item => <ItemBadge key={item.id} item={item} isPickup={false} />)}
                            </div>
                        ) : <p className="text-sm text-muted-foreground/60 italic px-2">Sin actividad</p>}
                    </div>
                     <div className="bg-card border rounded-lg p-3 shadow-sm">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5"><PlaneTakeoff className="text-emerald-500 h-4 w-4" /> Embarcan ({manifestData.pickups.length})</h4>
                        {manifestData.pickups.length > 0 ? (
                             <div className="space-y-2">
                                {manifestData.pickups.map(item => <ItemBadge key={item.id} item={item} isPickup={true} />)}
                            </div>
                        ) : <p className="text-sm text-muted-foreground/60 italic px-2">Sin actividad</p>}
                    </div>
                </div>
            </ScrollArea>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center">Selecciona un plan para ver el manifiesto.</p>
        )}
      </CardContent>
    </Card>
  );
}
