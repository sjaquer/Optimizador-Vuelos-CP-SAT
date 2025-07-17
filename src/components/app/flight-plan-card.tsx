
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { FlightPlan, TransportItem, ScenarioData, FlightStep } from '@/lib/types';
import { PlaneTakeoff, PlaneLanding, User, Wind, Milestone, FileDown, ArrowRight, Waypoints, Package, AlertTriangle, Scale } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { runFlightSimulation } from '@/lib/optimizer';
import { useState, useEffect, useMemo, useCallback } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { cn } from '@/lib/utils';


interface FlightPlanCardProps {
  basePlan: FlightPlan;
  scenario: ScenarioData;
  onPlanUpdate: (plan: FlightPlan) => void;
  onSelectPlan: (planId: string) => void;
  isSelected: boolean;
}

const actionTranslations: Record<FlightStep['action'], string> = {
  PICKUP: 'RECOGER',
  DROPOFF: 'DEJAR',
  TRAVEL: 'VIAJAR',
};

export function FlightPlanCard({ basePlan, scenario, onPlanUpdate, onSelectPlan, isSelected }: FlightPlanCardProps) {
  const [activeShift, setActiveShift] = useState<'M' | 'T'>('M');
  const [currentPlan, setCurrentPlan] = useState<FlightPlan>(basePlan);
  const [isLoading, setIsLoading] = useState(false);

  const strategy = useMemo(() => {
     return basePlan.id as 'pax_priority' | 'cargo_priority' | 'mixed_efficiency' | 'pure_efficiency';
  }, [basePlan.id]);

  const generatePlanForShift = useCallback((shift: 'M' | 'T') => {
    setIsLoading(true);
    const relevantItems = scenario.transportItems.filter(item => item.shift === shift);
    
    // Create a temporary base plan with the correct strategy but empty steps
    const planTemplate: FlightPlan = {
      id: strategy, // Use the base ID for calculation
      title: basePlan.title,
      description: basePlan.description,
      steps: [],
      metrics: { totalStops: 0, totalDistance: 0, itemsTransported: 0, totalWeight: 0, maxWeightRatio: 0 },
    };

    if (relevantItems.length === 0) {
      const emptyPlan: FlightPlan = {
        ...planTemplate,
        id: `${strategy}_${shift}`, // Add shift to ID
      };
      setCurrentPlan(emptyPlan);
      onPlanUpdate(emptyPlan);
      setIsLoading(false);
      return;
    }

    const newPlan = runFlightSimulation(planTemplate, relevantItems, scenario, shift);
    setCurrentPlan(newPlan);
    onPlanUpdate(newPlan);
    setIsLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenario, basePlan.id, basePlan.title, basePlan.description, strategy]); // onPlanUpdate is removed intentionally
  
  useEffect(() => {
    // Generate the plan for the default shift ('M') when the component mounts or dependencies change
    generatePlanForShift('M');
    setActiveShift('M');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenario.transportItems, basePlan.id]); // Re-run only if items or base plan ID change


  const handleShiftChange = (shift: 'M' | 'T') => {
    if (shift !== activeShift || !currentPlan.id.endsWith(shift)) {
        setActiveShift(shift);
        generatePlanForShift(shift);
    }
  }

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
    doc.text(`${currentPlan.title} (Turno ${activeShift === 'M' ? 'Mañana' : 'Tarde'})`, doc.internal.pageSize.getWidth() / 2, 20, { align: 'center' });
    
    doc.setFontSize(11);
    const metricsText = `Paradas: ${currentPlan.metrics.totalStops} | Tramos: ${currentPlan.metrics.totalDistance} | Items: ${currentPlan.metrics.itemsTransported} | Peso Máx: ${(currentPlan.metrics.maxWeightRatio * 100).toFixed(0)}%`;
    doc.text(metricsText, doc.internal.pageSize.getWidth() / 2, 28, { align: 'center' });
    
    autoTable(doc, {
      startY: 40,
      head: [['Paso', 'Acción', 'Estación', 'Items', 'Notas']],
      body: currentPlan.steps.map((step, index) => [
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
    const rows = currentPlan.steps.flatMap((step, index) => {
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
  
  const hasContent = currentPlan.steps.length > 0;
  
  const handleSelection = () => {
    if (hasContent) {
        onSelectPlan(currentPlan.id);
    }
  }

  const paxDeliveredCount = useMemo(() => {
     return currentPlan.steps
      .filter(s => s.action === 'DROPOFF')
      .flatMap(s => s.items)
      .filter(i => i.type === 'PAX')
      .reduce((sum, item) => sum + item.quantity, 0);
  }, [currentPlan]);

  const cargoDeliveredCount = useMemo(() => {
     return currentPlan.steps
      .filter(s => s.action === 'DROPOFF')
      .flatMap(s => s.items)
      .filter(i => i.type === 'CARGO')
      .reduce((sum, item) => sum + item.quantity, 0);
  }, [currentPlan]);


  return (
    <Card className={cn("flex h-full flex-col transition-all cursor-pointer", isSelected ? 'border-primary ring-2 ring-primary' : 'border-border')} onClick={handleSelection}>
      <CardHeader>
        <div className='flex items-start justify-between gap-4'>
            <div className='flex-1'>
              <CardTitle className='text-xl'>{currentPlan.title}</CardTitle>
              {currentPlan.description && <CardDescription className='mt-1'>{currentPlan.description}</CardDescription>}
            </div>
            <div className='flex items-center gap-2'>
              <Select value={activeShift} onValueChange={(value) => handleShiftChange(value as 'M' | 'T')}>
                <SelectTrigger className="w-[120px] h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="M">Mañana</SelectItem>
                  <SelectItem value="T">Tarde</SelectItem>
                </SelectContent>
              </Select>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="icon" variant="ghost" className='h-9 w-9' disabled={!hasContent} onClick={(e) => e.stopPropagation()}>
                    <FileDown className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenuItem onClick={exportToPDF}>Descargar PDF</DropdownMenuItem>
                  <DropdownMenuItem onClick={exportToExcel}>Descargar Excel (CSV)</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
        </div>
        {hasContent && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-1"><Milestone className="h-4 w-4" /><span>{currentPlan.metrics.totalStops} Paradas</span></div>
              <div className="flex items-center gap-1"><Wind className="h-4 w-4" /><span>{currentPlan.metrics.totalDistance} Tramos</span></div>
              {paxDeliveredCount > 0 && <div className="flex items-center gap-1"><User className="h-4 w-4" /><span>{paxDeliveredCount} PAX</span></div>}
              {cargoDeliveredCount > 0 && <div className="flex items-center gap-1"><Package className="h-4 w-4" /><span>{cargoDeliveredCount} Cargas</span></div>}
              <div className="flex items-center gap-1"><Scale className="h-4 w-4" /><span>Peso Máx: {(currentPlan.metrics.maxWeightRatio * 100).toFixed(0)}%</span></div>
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
              {currentPlan.steps.map((step, index) => (
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
