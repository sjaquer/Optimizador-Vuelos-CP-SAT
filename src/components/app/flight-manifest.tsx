
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import type { FlightPlan, FlightStep, TransportItem } from '@/lib/types';
import { PlaneTakeoff, PlaneLanding, Users, Package, ArrowRight, ArrowLeft } from 'lucide-react';
import { useMemo } from 'react';

interface FlightManifestProps {
  plan: FlightPlan;
  currentStep: number;
}

export function FlightManifest({ plan, currentStep }: FlightManifestProps) {
  const flightPath = useMemo(() => plan.steps.filter(s => s.action === 'TRAVEL'), [plan]);
  
  const manifestData = useMemo(() => {
    if (flightPath.length === 0) return null;
    
    const legIndex = Math.min(currentStep, flightPath.length - 1);
    const endStationId = flightPath[legIndex]?.station ?? 0;
    
    const previousStationId = legIndex > 0 
      ? flightPath[legIndex - 1].station 
      : plan.steps.find(s => s.action !== 'TRAVEL')?.station ?? 0;

    const pickups = plan.steps.filter(s => s.action === 'PICKUP' && s.station === endStationId);
    const dropoffs = plan.steps.filter(s => s.action === 'DROPOFF' && s.station === endStationId);

    return {
      station: endStationId,
      pickups: pickups.flatMap(s => s.items),
      dropoffs: dropoffs.flatMap(s => s.items),
      previousStation: previousStationId,
    };
  }, [currentStep, plan, flightPath]);

  const ItemBadge = ({ item }: { item: TransportItem }) => (
    <Badge variant="secondary" className="font-normal w-full justify-start">
      {item.type === 'PAX' ? <Users className="mr-2 h-4 w-4" /> : <Package className="mr-2 h-4 w-4" />}
      <span className="flex-1 truncate">{item.area}-{item.type} (P{item.priority})</span>
    </Badge>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Manifiesto de Vuelo</CardTitle>
      </CardHeader>
      <CardContent>
        {manifestData ? (
          <div className="space-y-4">
             <div className="flex items-center justify-center text-center font-bold">
                <span>E-{manifestData.previousStation}</span>
                <ArrowRight className="mx-2 h-5 w-5" />
                <span>E-{manifestData.station}</span>
             </div>
             
             <ScrollArea className="h-64">
                <div className="space-y-4 pr-4">
                    <div>
                        <h4 className="font-semibold mb-2 flex items-center gap-2"><PlaneLanding className="text-blue-500"/> Desembarques</h4>
                        {manifestData.dropoffs.length > 0 ? (
                            <div className="space-y-1">
                                {manifestData.dropoffs.map(item => <ItemBadge key={item.id} item={item} />)}
                            </div>
                        ) : <p className="text-sm text-muted-foreground">N/A</p>}
                    </div>
                     <div>
                        <h4 className="font-semibold mb-2 flex items-center gap-2"><PlaneTakeoff className="text-green-500" /> Embarques</h4>
                        {manifestData.pickups.length > 0 ? (
                             <div className="space-y-1">
                                {manifestData.pickups.map(item => <ItemBadge key={item.id} item={item} />)}
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
