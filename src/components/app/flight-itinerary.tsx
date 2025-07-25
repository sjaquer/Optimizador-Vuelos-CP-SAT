
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { FlightPlan, TransportItem, FlightStep } from '@/lib/types';
import { PlaneTakeoff, PlaneLanding, User, Waypoints, Package, ArrowRight, FileDown } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface FlightItineraryProps {
  plan: FlightPlan;
}

const actionTranslations: Record<FlightStep['action'], string> = {
  PICKUP: 'RECOGER',
  DROPOFF: 'DEJAR',
  TRAVEL: 'VIAJAR',
};

export function FlightItinerary({ plan }: FlightItineraryProps) {
  const getActionIcon = (action: FlightStep['action']) => {
    switch (action) {
      case 'PICKUP': return <PlaneTakeoff className="h-4 w-4 text-green-600" />;
      case 'DROPOFF': return <PlaneLanding className="h-4 w-4 text-blue-600" />;
      case 'TRAVEL': return <Waypoints className="h-4 w-4 text-muted-foreground" />;
      default: return null;
    }
  };

  const getActionLabel = (action: FlightStep['action']) => actionTranslations[action] || action;

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
    );
  };
  
  const strategy = plan.id.split('_').slice(0, -1).join('_');
  const shift = plan.id.endsWith('_M') ? 'M' : 'T';

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text(`${plan.title} (Turno ${shift === 'M' ? 'Mañana' : 'Tarde'})`, doc.internal.pageSize.getWidth() / 2, 20, { align: 'center' });
    
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
    doc.save(`plan_${strategy}_${shift}.pdf`);
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
    link.setAttribute("download", `plan_${strategy}_${shift}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Card>
      <CardHeader className='flex-row items-center justify-between'>
        <CardTitle>{plan.title} - Itinerario</CardTitle>
         <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="outline" className='h-9 w-9'>
                <FileDown className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={exportToPDF}>Descargar PDF</DropdownMenuItem>
              <DropdownMenuItem onClick={exportToExcel}>Descargar Excel (CSV)</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">Paso</TableHead>
              <TableHead className="w-[120px]">Acción</TableHead>
              <TableHead>Estación</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Notas</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {plan.steps.map((step, index) => (
              <TableRow key={index}>
                <TableCell className="font-medium">{index + 1}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2 font-medium">
                    {getActionIcon(step.action)}
                    <span>{getActionLabel(step.action)}</span>
                  </div>
                </TableCell>
                <TableCell>{step.station === 0 ? 'Base' : `Estación ${step.station}`}</TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    {step.items.map((item) => (
                      <div key={item.id}>{getItemLabel(item)}</div>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">{step.notes}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
