
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { FlightPlan } from '@/lib/types';
import { User, Wind, Milestone, Package, AlertTriangle, Scale } from 'lucide-react';
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


  return (
    <Card className={cn("flex h-full flex-col transition-all cursor-pointer", isSelected ? 'border-primary ring-2 ring-primary' : 'border-border')} onClick={handleSelection}>
      <CardHeader>
        <div className='flex items-start justify-between gap-4'>
            <div className='flex-1'>
              <CardTitle className='text-xl'>{displayedPlan.title}</CardTitle>
              {displayedPlan.description && <CardDescription className='mt-1'>{displayedPlan.description}</CardDescription>}
            </div>
        </div>
        {hasContent ? (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-1"><Milestone className="h-4 w-4" /><span>{displayedPlan.metrics.totalStops} Paradas</span></div>
              <div className="flex items-center gap-1"><Wind className="h-4 w-4" /><span>{displayedPlan.metrics.totalDistance} Tramos</span></div>
              {paxDeliveredCount > 0 && <div className="flex items-center gap-1"><User className="h-4 w-4" /><span>{paxDeliveredCount} PAX</span></div>}
              {cargoDeliveredCount > 0 && <div className="flex items-center gap-1"><Package className="h-4 w-4" /><span>{cargoDeliveredCount} Cargas</span></div>}
              <div className="flex items-center gap-1"><Scale className="h-4 w-4" /><span>Peso Máx: {(displayedPlan.metrics.maxWeightRatio * 100).toFixed(0)}%</span></div>
            </div>
        ) : (
            <div className='flex flex-col items-center justify-center text-center p-4 min-h-[120px]'>
                <AlertTriangle className='h-10 w-10 text-muted-foreground/50 mb-2' />
                <p className='font-medium'>Sin datos para este turno</p>
                <p className='text-sm text-muted-foreground'>No hay items definidos para el turno de la {shift === 'M' ? 'mañana' : 'tarde'}.</p>
             </div>
        )}
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-6 flex items-center justify-center">
        <Badge variant={hasContent ? "default" : "secondary"}>
          {hasContent ? "Ver Detalles" : "No Calculado"}
        </Badge>
      </CardContent>
    </Card>
  );
}
