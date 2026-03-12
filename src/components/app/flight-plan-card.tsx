
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { FlightPlan } from '@/lib/types';
import { User, Package, AlertTriangle, Gauge } from 'lucide-react';
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
  const loadPercent = Math.round(metrics.avgLoadRatio * 100);

  return (
    <Card 
      className={cn(
        "flex h-full flex-col transition-all cursor-pointer overflow-hidden border shadow-sm relative group", 
        isSelected ? 'border-primary ring-2 ring-primary/30 shadow-lg bg-primary/[0.02]' : 'hover:border-primary/50 hover:shadow-md hover:bg-muted/10'
      )} 
      onClick={handleSelection}
    >
      {isSelected && (
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-primary/80 to-primary"></div>
      )}
      <CardHeader className="pb-2 pt-5 px-5">
        <div className='flex items-center gap-3'>
            <CardTitle className='text-lg font-bold leading-tight'>{displayedPlan.title}</CardTitle>
            <Badge variant="outline" className={cn("text-xs px-2.5 py-0.5", shift === 'M' ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30' : 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30')}>
              {shift === 'M' ? '☀ Mañana' : '🌙 Tarde'}
            </Badge>
            {isSelected && <Badge className="text-xs px-2.5 py-0.5 bg-primary/90">Activo</Badge>}
        </div>
      </CardHeader>
      
      {hasContent ? (
        <CardContent className="flex-1 flex flex-col justify-end pt-0 px-5 pb-5">
          {/* Key metrics row */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="bg-background rounded-lg border p-3 text-center">
              <div className="text-2xl font-bold tabular-nums leading-tight">{metrics.totalDistance.toFixed(0)}</div>
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Tramos</span>
            </div>
            <div className="bg-background rounded-lg border p-3 text-center">
              <div className="text-2xl font-bold tabular-nums leading-tight">{metrics.totalFlights}</div>
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Vuelos</span>
            </div>
            <div className="bg-background rounded-lg border p-3 text-center">
              <div className="text-2xl font-bold tabular-nums leading-tight">{metrics.totalStops}</div>
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Paradas</span>
            </div>
          </div>

          {/* Compact info row: deliveries + load */}
          <div className="flex items-center justify-between text-sm mb-4">
            <div className="flex items-center gap-3">
              {paxDeliveredCount > 0 && (
                <span className="flex items-center gap-1.5 font-medium text-blue-700 dark:text-blue-300"><User className="h-4 w-4" /> {paxDeliveredCount} PAX</span>
              )}
              {cargoDeliveredCount > 0 && (
                <span className="flex items-center gap-1.5 font-medium text-amber-700 dark:text-amber-300"><Package className="h-4 w-4" /> {cargoDeliveredCount} Carga</span>
              )}
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Gauge className="h-4 w-4" />
              <span className={cn("font-bold text-base tabular-nums", loadPercent >= 70 ? 'text-emerald-600 dark:text-emerald-400' : loadPercent >= 40 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground')}>{loadPercent}%</span>
              <Progress value={loadPercent} className="h-2 w-20" />
            </div>
          </div>

          {/* Delivery status */}
          {metrics.itemsNotDelivered > 0 ? (
            <div className="bg-destructive/10 text-destructive text-sm font-bold p-3 rounded-lg flex items-center justify-center gap-2 border border-destructive/20">
              <AlertTriangle className="h-4 w-4" />
              {metrics.itemsNotDelivered} NO ENTREGADO(S)
            </div>
          ) : (
            <div className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-sm font-bold p-3 rounded-lg flex items-center justify-center gap-1.5 border border-emerald-500/20">
              ✓ ENTREGA COMPLETA
            </div>
          )}
        </CardContent>
      ) : (
        <CardContent className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="h-14 w-14 bg-muted rounded-full flex items-center justify-center mb-4">
              <AlertTriangle className='h-7 w-7 text-muted-foreground/60' />
            </div>
            <p className='font-semibold text-base'>Sin datos operativos</p>
            <p className='text-sm text-muted-foreground mt-1.5 max-w-[220px]'>No hay requerimientos programados para este turno.</p>
        </CardContent>
      )}
    </Card>
  );
}
