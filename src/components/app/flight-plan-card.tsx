'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { FlightPlan } from '@/lib/types';
import { User, Package, AlertTriangle, Gauge, Fuel } from 'lucide-react';
import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';

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
  };

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
  const loadPercent = Math.round(metrics.avgLoadRatio * 100);

  return (
    <Card 
      className={cn(
        "flex h-full flex-col transition-all duration-300 cursor-pointer overflow-hidden border shadow-sm relative group rounded-xl", 
        isSelected 
          ? 'border-primary ring-2 ring-primary/20 shadow-lg bg-primary/[0.02] dark:bg-primary/[0.01]' 
          : 'hover:border-primary/50 hover:shadow-md hover:bg-muted/10'
      )} 
      onClick={handleSelection}
    >
      {isSelected && (
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-orange-400 to-primary"></div>
      )}
      <CardHeader className="pb-2 pt-4 sm:pt-5 px-4 sm:px-5">
        <div className='flex items-center justify-between flex-wrap gap-2'>
            <CardTitle className='text-sm sm:text-base font-bold leading-tight tracking-tight group-hover:text-primary transition-colors'>{displayedPlan.title}</CardTitle>
            <div className="flex items-center gap-1.5">
              <Badge variant="outline" className={cn("text-[10px] px-2 py-0.5 font-bold uppercase", shift === 'M' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20')}>
                {shift === 'M' ? '☀ Mañana' : '🌙 Tarde'}
              </Badge>
              {metrics.refuelStops > 0 && (
                <Badge variant="outline" className="text-[10px] px-2 py-0.5 bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 flex items-center gap-1 font-bold">
                  <Fuel className="h-3 w-3" /> {metrics.refuelStops}
                </Badge>
              )}
            </div>
        </div>
      </CardHeader>
      
      {hasContent ? (
        <CardContent className="flex-1 flex flex-col justify-end pt-0 px-4 sm:px-5 pb-4 sm:pb-5">
          {/* Key metrics row */}
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2 mb-3 sm:mb-4">
            <div className="bg-background rounded-lg border p-2 text-center transition-all duration-300 group-hover:border-border/80 group-hover:bg-muted/5">
              <div className="text-lg sm:text-xl font-extrabold tabular-nums leading-tight">{metrics.totalDistance.toFixed(1)}</div>
              <span className="text-[9px] sm:text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Distancia</span>
            </div>
            <div className="bg-background rounded-lg border p-2 text-center transition-all duration-300 group-hover:border-border/80 group-hover:bg-muted/5">
              <div className="text-lg sm:text-xl font-extrabold tabular-nums leading-tight">{metrics.totalFlights}</div>
              <span className="text-[9px] sm:text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Vuelos</span>
            </div>
            <div className="bg-background rounded-lg border p-2 text-center transition-all duration-300 group-hover:border-border/80 group-hover:bg-muted/5">
              <div className="text-lg sm:text-xl font-extrabold tabular-nums leading-tight">{metrics.totalStops}</div>
              <span className="text-[9px] sm:text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Paradas</span>
            </div>
          </div>

          {/* Compact info row: deliveries + load */}
          <div className="flex items-center justify-between text-xs mb-3 sm:mb-4 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              {paxDeliveredCount > 0 && (
                <span className="flex items-center gap-1 font-semibold text-blue-600 dark:text-blue-400 bg-blue-500/5 px-1.5 py-0.5 rounded border border-blue-500/10"><User className="h-3 w-3" /> {paxDeliveredCount} PAX</span>
              )}
              {cargoDeliveredCount > 0 && (
                <span className="flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/5 px-1.5 py-0.5 rounded border border-amber-500/10"><Package className="h-3 w-3" /> {cargoDeliveredCount} Carga</span>
              )}
            </div>
            <div className="flex items-center gap-2 text-muted-foreground ml-auto">
              <Gauge className="h-3.5 w-3.5 text-muted-foreground/75" />
              <span className={cn("font-bold text-xs tabular-nums", loadPercent >= 70 ? 'text-emerald-600 dark:text-emerald-400' : loadPercent >= 40 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground')}>{loadPercent}%</span>
              <Progress value={loadPercent} className="h-1.5 w-14" />
            </div>
          </div>

          {/* Delivery status */}
          {metrics.itemsNotDelivered > 0 ? (
            <div className="bg-destructive/10 text-destructive text-[11px] font-bold p-2.5 rounded-lg flex items-center justify-center gap-1.5 border border-destructive/20 uppercase tracking-wide">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              {metrics.itemsNotDelivered} NO ENTREGADO(S)
            </div>
          ) : (
            <div className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold p-2.5 rounded-lg flex items-center justify-center gap-1 border border-emerald-500/20 uppercase tracking-wide">
              ✓ ENTREGA COMPLETA
            </div>
          )}
        </CardContent>
      ) : (
        <CardContent className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <div className="h-12 w-12 bg-muted rounded-full flex items-center justify-center mb-3">
              <AlertTriangle className='h-6 w-6 text-muted-foreground/60' />
            </div>
            <p className='font-bold text-xs uppercase text-muted-foreground'>Sin datos operativos</p>
            <p className='text-[10px] text-muted-foreground mt-1 max-w-[180px]'>No hay requerimientos programados para este turno.</p>
        </CardContent>
      )}
    </Card>
  );
}
