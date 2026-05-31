'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { FlightPlan, TransportItem } from '@/lib/types';
import { PlaneTakeoff, PlaneLanding, Users, Package, ArrowRight, Waypoints } from 'lucide-react';
import { useMemo } from 'react';
import { cn } from '@/lib/utils';

interface FlightManifestProps {
  plan: FlightPlan;
  currentStep: number;
  namesMap?: Record<string, string>;
}

export function FlightManifest({ plan, currentStep, namesMap }: FlightManifestProps) {
  const flightPath = useMemo(() => plan.steps.filter(s => s.action === 'TRAVEL'), [plan]);
  
  const manifestData = useMemo(() => {
    if (!plan || flightPath.length === 0 || currentStep >= flightPath.length) return null;

    const currentTravelStep = flightPath[currentStep];
    const endStationId = currentTravelStep.station;

    const previousTravelStep = currentStep > 0 ? flightPath[currentStep - 1] : null;
    const startStationId = previousTravelStep?.station ?? '';

    const currentTravelStepIndex = plan.steps.findIndex(step => step === currentTravelStep);
    const prevTravelStepIndex = previousTravelStep 
        ? plan.steps.findIndex(step => step === previousTravelStep) 
        : -1;

    let endSliceIndex = plan.steps.length;
    if (currentStep + 1 < flightPath.length) {
        const nextTravelStep = flightPath[currentStep + 1];
        endSliceIndex = plan.steps.findIndex(step => step === nextTravelStep);
    }
    
    // relevantActions contains all steps from the end of the previous leg to the end of the current leg
    const relevantActions = plan.steps.slice(prevTravelStepIndex + 1, endSliceIndex);

    // Pickups happen at the START station of the travel leg (origin scale)
    const pickups = relevantActions
        .filter(s => s.action === 'PICKUP' && s.station === startStationId)
        .flatMap(s => s.items);

    // Dropoffs happen at the END station of the travel leg (destination scale)
    const dropoffs = relevantActions
        .filter(s => s.action === 'DROPOFF' && s.station === endStationId)
        .flatMap(s => s.items);

    return {
      station: endStationId,
      pickups,
      dropoffs,
      previousStation: startStationId,
    };
  }, [currentStep, plan, flightPath]);

  const sName = (id: string) => namesMap?.[id] ?? id;

  const ItemBadge = ({ item, isPickup }: { item: TransportItem, isPickup: boolean }) => (
    <div 
        className={cn(
          "flex items-center gap-2.5 p-2 rounded-lg border text-sm font-medium transition-all duration-300",
          isPickup 
            ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-600 dark:text-emerald-400 animate-manifest-item-in" 
            : "bg-blue-500/10 border-blue-500/25 text-blue-600 dark:text-blue-400",
        )}
    >
      <div className="bg-card rounded p-1.5 shadow-sm border border-border/50 shrink-0">
        {item.type === 'PAX' ? <Users className="h-4 w-4" /> : <Package className="h-4 w-4" />}
      </div>
      <div className="flex flex-col flex-1 min-w-0">
        <span className="truncate leading-tight font-semibold text-xs sm:text-sm">
          {item.area} <span className="opacity-75 font-normal text-[10px] sm:text-xs">| {item.type}</span>
        </span>
        <span className="text-[10px] opacity-70 flex gap-2 mt-0.5 font-mono">
          <span>PRIO: {item.priority === 'ALTA' ? 'Alta' : item.priority === 'MEDIA' ? 'Media' : 'Baja'}</span>
          <span>{item.type === 'PAX' ? `${item.quantity} pax` : `${item.weight} kg`}</span>
          <span className="truncate">{sName(item.originStation)} → {sName(item.destinationStation)}</span>
        </span>
      </div>
    </div>
  );

  return (
    <Card className="glass-card shadow-lg border-border/50 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-emerald-500 via-primary to-blue-500 opacity-80" />
      <CardHeader className="bg-muted/10 border-b border-border/50 pb-3 sm:pb-4">
        <CardTitle className="text-base sm:text-lg flex items-center gap-2 tracking-tight">
            <Waypoints className="h-4 w-4 sm:h-5 sm:w-5 text-primary"/>
            Manifesto de Escala
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 sm:pt-6">
        {manifestData ? (
          <div className="space-y-4 sm:space-y-5">
             <div className="flex items-center justify-center text-center bg-muted/20 border border-border/50 rounded-xl p-3 shadow-inner max-w-md mx-auto">
                <div className="flex flex-col items-center">
                  <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider mb-0.5">Origen</span>
                  <span className='font-bold text-xs sm:text-sm text-foreground'>{sName(manifestData.previousStation)}</span>
                </div>
                <div className="flex flex-col items-center mx-4 sm:mx-6 shrink-0">
                  <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5 text-primary animate-pulse" />
                  <span className="text-[8px] text-primary/80 font-bold uppercase mt-0.5">TRAMO {currentStep + 1}</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider mb-0.5">Destino</span>
                  <span className='font-bold text-xs sm:text-sm text-primary'>{sName(manifestData.station)}</span>
                </div>
             </div>
             
             <ScrollArea className="h-60 sm:h-[300px]">
                <div className="space-y-5 pr-3">
                     <div className="bg-card/40 border border-border/40 rounded-xl p-3 shadow-sm hover:border-blue-500/20 transition-all">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                          <PlaneLanding className="text-blue-500 h-4 w-4 animate-bounce" /> 
                          Desembarcan ({manifestData.dropoffs.length})
                        </h4>
                        {manifestData.dropoffs.length > 0 ? (
                            <div className="space-y-2">
                                {manifestData.dropoffs.map(item => <ItemBadge key={item.id} item={item} isPickup={false} />)}
                            </div>
                        ) : <p className="text-xs text-muted-foreground/60 italic px-2">Sin actividad de desembarque</p>}
                    </div>

                     <div className="bg-card/40 border border-border/40 rounded-xl p-3 shadow-sm hover:border-emerald-500/20 transition-all">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                          <PlaneTakeoff className="text-emerald-500 h-4 w-4 animate-bounce" /> 
                          Embarcan ({manifestData.pickups.length})
                        </h4>
                        {manifestData.pickups.length > 0 ? (
                             <div className="space-y-2">
                                {manifestData.pickups.map(item => <ItemBadge key={item.id} item={item} isPickup={true} />)}
                            </div>
                        ) : <p className="text-xs text-muted-foreground/60 italic px-2">Sin actividad de embarque</p>}
                    </div>
                </div>
            </ScrollArea>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">Selecciona un plan con ruta para ver el manifiesto.</p>
        )}
      </CardContent>
    </Card>
  );
}
