
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import type { FlightPlan, TransportItem } from '@/lib/types';
import { PlaneTakeoff, PlaneLanding, Users, Package, ArrowRight, Waypoints } from 'lucide-react';
import { useMemo } from 'react';

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

  const ItemBadge = ({ item, isPickup }: { item: TransportItem, isPickup: boolean }) => (
    <Badge 
        variant="secondary" 
        className={`font-normal w-full justify-start text-left h-auto py-1.5 ${isPickup ? 'animate-manifest-item-in' : ''}`}
    >
      {item.type === 'PAX' ? <Users className="mr-2 h-4 w-4 shrink-0" /> : <Package className="mr-2 h-4 w-4 shrink-0" />}
      <span className="flex-1 truncate leading-tight">{item.area}-{item.type} (P{item.priority})</span>
    </Badge>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
            <Waypoints className="h-5 w-5"/>
            Manifiesto de Vuelo
        </CardTitle>
      </CardHeader>
      <CardContent>
        {manifestData ? (
          <div className="space-y-4">
             <div className="flex items-center justify-center text-center font-bold">
                <span className='truncate'>E-{manifestData.previousStation}</span>
                <ArrowRight className="mx-2 h-5 w-5 shrink-0" />
                <span className='truncate'>E-{manifestData.station}</span>
             </div>
             
             <ScrollArea className="h-64">
                <div className="space-y-4 pr-4">
                    <div>
                        <h4 className="font-semibold mb-2 flex items-center gap-2"><PlaneLanding className="text-blue-500"/> Desembarques</h4>
                        {manifestData.dropoffs.length > 0 ? (
                            <div className="space-y-1">
                                {manifestData.dropoffs.map(item => <ItemBadge key={item.id} item={item} isPickup={false} />)}
                            </div>
                        ) : <p className="text-sm text-muted-foreground">N/A</p>}
                    </div>
                     <div>
                        <h4 className="font-semibold mb-2 flex items-center gap-2"><PlaneTakeoff className="text-green-500" /> Embarques</h4>
                        {manifestData.pickups.length > 0 ? (
                             <div className="space-y-1">
                                {manifestData.pickups.map(item => <ItemBadge key={item.id} item={item} isPickup={true} />)}
                            </div>
                        ) : <p className="text-sm text-muted-foreground">N/A</p>}
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
