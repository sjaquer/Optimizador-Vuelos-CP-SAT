
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { FlightPlan, TransportItem, ScenarioData, FlightStep } from '@/lib/types';
import { PlaneTakeoff, PlaneLanding, User, Wind, Milestone, FileDown, ArrowRight, Waypoints, Package, AlertTriangle, Scale } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { runFlightSimulation } from '@/lib/optimizer';
import { useState, useEffect, useMemo, useCallback } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { cn } from '@/lib/utils';


interface FlightPlanCardProps {
  plan: FlightPlan;
  scenario: ScenarioData;
  activeShift: 'M' | 'T';
  onPlanUpdate: (plan: FlightPlan) => void;
  onSelectPlan: (planId: string) => void;
  isSelected: boolean;
}

const actionTranslations: Record<FlightStep['action'], string> = {
  PICKUP: 'RECOGER',
  DROPOFF: 'DEJAR',
  TRAVEL: 'VIAJAR',
};

export function FlightPlanCard({ plan, scenario, activeShift, onPlanUpdate, onSelectPlan, isSelected }: FlightPlanCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  
  const strategy = useMemo(() => {
     const baseId = plan.id.split('_')[0];
     return baseId as 'pax_priority' | 'cargo_priority' | 'mixed_efficiency' | 'pure_efficiency';
  }, [plan.id]);

  const generatePlanForShift = useCallback((shift: 'M' | 'T') => {
    setIsLoading(true);
    const relevantItems = scenario.transportItems.filter(item => item.shift === shift);
    
    const planTemplate: FlightPlan = {
      id: strategy,
      title: plan.title,
      description: plan.description,
      steps: [],
      metrics: { totalStops: 0, totalDistance: 0, itemsTransported: 0, totalWeight: 0, maxWeightRatio: 0 },
    };

    if (relevantItems.length === 0) {
      const emptyPlan: FlightPlan = {
        ...planTemplate,
        id: `${strategy}_${shift}`,
      };
      onPlanUpdate(emptyPlan);
      setIsLoading(false);
      return;
    }

    setTimeout(() => {
        try {
          const newPlan = runFlightSimulation(planTemplate, relevantItems, scenario, shift);
          onPlanUpdate(newPlan);
        } catch (error) {
          console.error(`Error generating plan for ${strategy}:`, error);
        } finally {
          setIsLoading(false);
        }
    }, 0);
  }, [scenario, strategy, plan.title, plan.description, onPlanUpdate]);
  
  useEffect(() => {
    generatePlanForShift(activeShift);
  }, [activeShift, scenario.transportItems, generatePlanForShift]); 


  const getActionIcon = (action: FlightStep['action']) => {
    switch (action) {
      case 'PICKUP': return <PlaneTakeoff className="h-4 w-4 text-green-600" />;
      case 'DROPOFF': return <PlaneLanding className="h-4 w-4 text-blue-600" />;
      case 'TRAVEL': return <Waypoints className="h-4 w-4 text-muted-foreground" />;
      default: return null;
    }
  };
  
  const getActionLabel = (action: FlightStep['action']) => actionTranslations[action] || action;

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text(`${plan.title} (Turno ${activeShift === 'M' ? 'Mañana' : 'Tarde'})`, doc.internal.pageSize.getWidth() / 2, 20, { align: 'center' });
    
    doc.setFontSize(11);
    const metricsText = `Paradas: ${plan.metrics.totalStops} | Tramos: ${plan.metrics.totalDistance} | Items: ${plan.metrics.itemsTransported} | Peso Máx: ${(plan.metrics.maxWeightRatio * 100).toFixed(0)}%`;
    doc.text(metricsText, doc.internal.pageSize.getWidth() / 2, 28, { align: 'center' });
    
    autoTable(doc, {
      startY: 40,
      head: [['Paso', 'Acción', 'Estación', 'Items', 'Notas']],
      body: plan.steps.map((step, index) => [
        index + 1,
        getActionLabel(step.action),
        step.station === 0 ? 'Base' : `E-${step.station}`,
        step.items.map(p => `${p.area}-${p.type} ${p.type === 'PAX' && p.quantity > 1 ? `(x${p.quantity})` : ''} / ${p.type === 'CARGO' ? `${p.weight}kg` : ''}`).join('\n'),
        step.notes
      ]),
      headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
    });
    doc.save(`plan_${strategy}_${activeShift}.pdf`);
  };

  const exportToExcel = () => {
    const headers = ['Paso', 'Acción', 'Estación', 'Area', 'Tipo', 'Cantidad', 'Prioridad', 'Peso', 'Descripción', 'Notas'];
    const rows = plan.steps.flatMap((step, index) => {
        if (step.items.length === 0) {
            return [[index + 1, getActionLabel(step.action), step.station === 0 ? 'Base' : `E-${step.station}`, '', '', '', '', '', '', step.notes]];
        }
        return step.items.map(item => [
            index + 1,
            getActionLabel(step.action),
            step.station === 0 ? 'Base' : `E-${step.station}`,
            item.area,
            item.type,
            item.quantity,
            item.priority,
            item.weight,
            item.description,
            step.notes
        ]);
    });

    let csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n" 
      + rows.map(e => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `plan_${strategy}_${activeShift}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getItemLabel = (item: TransportItem) => {
    const originLabel = item.originStation === 0 ? 'B' : item.originStation;
    const destLabel = item.destinationStation === 0 ? 'B' : item.destinationStation;
    const Icon = item.type === 'PAX' ? User : Package;
    const quantityLabel = item.type === 'PAX' && item.quantity > 1 ? ` (x${item.quantity})` : '';

    return (
       <Badge variant="secondary" className="font-normal h-6">
          <Icon className="mr-1 h-3 w-3" />
          {item.area}-{item.type}{quantityLabel} (P{item.priority})
          <span className='mx-1.5 text-muted-foreground/80 flex items-center gap-0.5'>
            {originLabel} <ArrowRight className='h-3 w-3'/> {destLabel}
          </span>
       </Badge>
    )
  }
  
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
             <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="icon" variant="ghost" className='h-9 w-9' disabled={!hasContent || isLoading} onClick={(e) => e.stopPropagation()}>
                    <FileDown className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenuItem onClick={exportToPDF}>Descargar PDF</DropdownMenuItem>
                  <DropdownMenuItem onClick={exportToExcel}>Descargar Excel (CSV)</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
        </div>
        {hasContent && !isLoading && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-1"><Milestone className="h-4 w-4" /><span>{displayedPlan.metrics.totalStops} Paradas</span></div>
              <div className="flex items-center gap-1"><Wind className="h-4 w-4" /><span>{displayedPlan.metrics.totalDistance} Tramos</span></div>
              {paxDeliveredCount > 0 && <div className="flex items-center gap-1"><User className="h-4 w-4" /><span>{paxDeliveredCount} PAX</span></div>}
              {cargoDeliveredCount > 0 && <div className="flex items-center gap-1"><Package className="h-4 w-4" /><span>{cargoDeliveredCount} Cargas</span></div>}
              <div className="flex items-center gap-1"><Scale className="h-4 w-4" /><span>Peso Máx: {(displayedPlan.metrics.maxWeightRatio * 100).toFixed(0)}%</span></div>
            </div>
        )}
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea className="h-80">
          {isLoading ? <p className='text-center p-8 text-muted-foreground'>Calculando...</p> : 
          !hasContent ? (
             <div className='flex flex-col items-center justify-center h-full text-center p-4'>
                <AlertTriangle className='h-10 w-10 text-muted-foreground/50 mb-2' />
                <p className='font-medium'>Sin datos para este turno</p>
                <p className='text-sm text-muted-foreground'>No hay items para el turno de la {activeShift === 'M' ? 'mañana' : 'tarde'}.</p>
             </div>
          ) : (
          <Table>
            <TableHeader className="sticky top-0 bg-card z-10">
              <TableRow><TableHead className="w-[80px]">Acción</TableHead><TableHead>Estación</TableHead><TableHead>Items</TableHead><TableHead>Notas</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {displayedPlan.steps.map((step, index) => (
                <TableRow key={index}>
                  <TableCell><div className="flex items-center gap-2 font-medium">{getActionIcon(step.action)}<span>{getActionLabel(step.action)}</span></div></TableCell>
                  <TableCell>{step.station === 0 ? 'Base' : `Estación ${step.station}`}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      {step.items.map((item) => ( <div key={item.id}>{getItemLabel(item)}</div> ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">{step.notes}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
