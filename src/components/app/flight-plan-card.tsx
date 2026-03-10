
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { FlightPlan } from '@/lib/types';
import { User, Wind, Milestone, Package, AlertTriangle, Scale, Route, Gauge, PlaneTakeoff } from 'lucide-react';
import { useMemo } from 'react';
import { cn } from '@/lib/utils';


interface FlightPlanCardProps {
  plan: FlightPlan;
  onSelectPlan: (planId: string) => void;
  isSelected: boolean;
}

export function FlightPlanCard({ plan, onSelectPlan, isSelected }: FlightPlanCardProps) {
  
  const shift = useMemo(() => {
    return plan.id.endsWith('_M') ? 'M' : 'T';
  }, [plan.id]);

  const displayedPlan = plan;
  const hasContent = displayedPlan.steps.length > 0;
  
  const handleSelection = () => {
    if (hasContent) {
        onSelectPlan(displayedPlan.id);
    }
  }

  const paxDeliveredCount = useMemo(() => {
     return displayedPlan.steps
      .filter(s => s.action === 'DROPOFF')
      .flatMap(s => s.items)
      .filter(i => i.type === 'PAX')
      .reduce((sum, item) => sum + item.quantity, 0);
  }, [displayedPlan]);

  const cargoDeliveredCount = useMemo(() => {
     return displayedPlan.steps
      .filter(s => s.action === 'DROPOFF')
      .flatMap(s => s.items)
      .filter(i => i.type === 'CARGO')
      .reduce((sum, item) => sum + item.quantity, 0);
  }, [displayedPlan]);

  const { metrics } = displayedPlan;

  return (
    <Card 
      className={cn(
        "flex h-full flex-col transition-all cursor-pointer overflow-hidden border shadow-sm relative group", 
        isSelected ? 'border-primary ring-1 ring-primary shadow-md bg-primary/[0.02]' : 'hover:border-primary/50 hover:bg-muted/20'
      )} 
      onClick={handleSelection}
    >
      {isSelected && (
        <div className="absolute top-0 left-0 w-full h-1 bg-primary"></div>
      )}
      <CardHeader className="pb-4">
        <div className='flex items-start justify-between gap-4'>
            <div className='flex-1'>
              <div className="flex items-center gap-2 mb-1.5">
                <CardTitle className='text-lg font-bold leading-tight'>{displayedPlan.title.split(':')[0]}</CardTitle>
                {isSelected && <Badge variant="default" className="text-[10px] px-1.5 py-0 h-4">Activo</Badge>}
              </div>
              <div className="text-sm font-medium text-primary/80 mb-2">{displayedPlan.title.split(':')?.[1]?.trim() || ''}</div>
              {displayedPlan.description && <CardDescription className='text-xs leading-relaxed line-clamp-2'>{displayedPlan.description}</CardDescription>}
            </div>
        </div>
      </CardHeader>
      
      {hasContent ? (
        <CardContent className="flex-1 flex flex-col justify-end pt-0">
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-background rounded-md border p-2.5 flex flex-col justify-between">
              <span className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider flex items-center gap-1"><Route className="h-3 w-3" /> Distancia</span>
              <div className="text-lg font-semibold mt-1">{(metrics.totalDistance).toFixed(1)} <span className="text-xs text-muted-foreground font-normal">ud</span></div>
            </div>
            <div className="bg-background rounded-md border p-2.5 flex flex-col justify-between">
              <span className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider flex items-center gap-1"><PlaneTakeoff className="h-3 w-3" /> Vuelos</span>
              <div className="text-lg font-semibold mt-1">{metrics.totalFlights} <span className="text-xs text-muted-foreground font-normal">rt</span></div>
            </div>
          </div>

          <div className="space-y-2 mb-4">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center text-muted-foreground"><Milestone className="mr-1.5 h-3.5 w-3.5" /> Paradas Totales</span>
              <span className="font-medium">{metrics.totalStops}</span>
            </div>
            
            {(paxDeliveredCount > 0 || cargoDeliveredCount > 0) && (
              <div className="flex items-center justify-between text-xs border-t pt-2">
                <span className="text-muted-foreground">Entregas</span>
                <div className="flex items-center gap-2">
                  {paxDeliveredCount > 0 && <span className="font-medium flex items-center"><User className="mr-1 h-3.5 w-3.5 text-blue-500" /> {paxDeliveredCount}</span>}
                  {cargoDeliveredCount > 0 && <span className="font-medium flex items-center"><Package className="mr-1 h-3.5 w-3.5 text-amber-500" /> {cargoDeliveredCount}</span>}
                </div>
              </div>
            )}
            
            <div className="flex items-center justify-between text-xs border-t pt-2">
              <span className="flex items-center text-muted-foreground"><Gauge className="mr-1.5 h-3.5 w-3.5" /> Carga Promedio</span>
              <span className="font-medium">{(metrics.avgLoadRatio * 100).toFixed(0)}%</span>
            </div>
          </div>

          {metrics.itemsNotDelivered > 0 ? (
            <div className="mt-auto bg-destructive/10 text-destructive text-xs font-semibold p-2 rounded-md flex items-center justify-center gap-1.5 border border-destructive/20">
              <AlertTriangle className="h-3.5 w-3.5" />
              {metrics.itemsNotDelivered} ITEM(S) NO ENTREGADOS
            </div>
          ) : (
            <div className="mt-auto bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold p-2 rounded-md flex items-center justify-center gap-1.5 border border-emerald-500/20">
              ENTREGA COMPLETA (100%)
            </div>
          )}
        </CardContent>
      ) : (
        <CardContent className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <div className="h-12 w-12 bg-muted rounded-full flex items-center justify-center mb-3">
              <AlertTriangle className='h-6 w-6 text-muted-foreground/60' />
            </div>
            <p className='font-semibold text-sm'>Sin datos operativos</p>
            <p className='text-xs text-muted-foreground mt-1 max-w-[180px]'>No hay requerimientos programados para este turno.</p>
        </CardContent>
      )}
    </Card>
  );
}
