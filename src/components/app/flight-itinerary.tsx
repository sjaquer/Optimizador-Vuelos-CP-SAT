
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
import ExcelJS from 'exceljs';
import { stationNamesMap } from '@/lib/stations';

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
      case 'PICKUP': return <PlaneTakeoff className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />;
      case 'DROPOFF': return <PlaneLanding className="h-4 w-4 text-blue-600 dark:text-blue-400" />;
      case 'TRAVEL': return <Waypoints className="h-4 w-4 text-muted-foreground" />;
      default: return null;
    }
  };

  const getActionLabel = (action: FlightStep['action']) => actionTranslations[action] || action;

  const sName = (id: number) => stationNamesMap[id] ?? `E-${id}`;

  const getItemLabel = (item: TransportItem) => {
    const Icon = item.type === 'PAX' ? User : Package;
    const quantityLabel = item.type === 'PAX' && item.quantity > 1 ? ` (x${item.quantity})` : '';

    return (
       <Badge variant="outline" className={`font-medium h-auto py-1 shadow-sm border-muted-foreground/20 ${item.type === 'PAX' ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300' : 'bg-amber-500/10 text-amber-700 dark:text-amber-300'}`}>
          <Icon className="mr-1.5 h-3 w-3" />
          {item.area}-{item.type}{quantityLabel} 
          <span className="opacity-70 font-normal ml-1">(P{item.priority})</span>
          <span className='ml-2 pl-2 border-l border-current/20 flex items-center gap-1 opacity-80 text-[10px]'>
            {sName(item.originStation)} <ArrowRight className='h-3 w-3'/> {sName(item.destinationStation)}
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
    const metricsText = `Paradas: ${plan.metrics.totalStops} | Dist: ${plan.metrics.totalDistance.toFixed(1)} ud | Tramos: ${plan.metrics.totalLegs} | Items: ${plan.metrics.itemsTransported} | Vuelos: ${plan.metrics.totalFlights} | Carga prom: ${(plan.metrics.avgLoadRatio * 100).toFixed(0)}%`;
    doc.text(metricsText, doc.internal.pageSize.getWidth() / 2, 28, { align: 'center' });
    
    autoTable(doc, {
      startY: 40,
      head: [['Paso', 'Acción', 'Estación', 'Items', 'Notas']],
      body: plan.steps.map((step, index) => [
        index + 1,
        getActionLabel(step.action),
        sName(step.station),
        step.items.map(p => `${p.area}-${p.type} ${p.type === 'PAX' && p.quantity > 1 ? `(x${p.quantity})` : ''} / ${p.type === 'CARGO' ? `${p.weight}kg` : ''}`).join('\n'),
        step.notes
      ]),
      headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
    });
    doc.save(`plan_${strategy}_${shift}.pdf`);
  };

  const exportToExcel = async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Itinerario');

    ws.columns = [
      { header: 'Paso', key: 'step', width: 8 },
      { header: 'Acción', key: 'action', width: 14 },
      { header: 'Estación', key: 'station', width: 14 },
      { header: 'Área', key: 'area', width: 12 },
      { header: 'Tipo', key: 'type', width: 10 },
      { header: 'Cantidad', key: 'qty', width: 10 },
      { header: 'Prioridad', key: 'priority', width: 10 },
      { header: 'Peso (kg)', key: 'weight', width: 12 },
      { header: 'Descripción', key: 'desc', width: 30 },
      { header: 'Notas', key: 'notes', width: 30 },
    ];

    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2980B5' } };

    plan.steps.forEach((step, index) => {
      if (step.items.length === 0) {
        ws.addRow({ step: index + 1, action: getActionLabel(step.action), station: sName(step.station), notes: step.notes });
      } else {
        step.items.forEach(item => {
          ws.addRow({
            step: index + 1,
            action: getActionLabel(step.action),
            station: sName(step.station),
            area: item.area,
            type: item.type,
            qty: item.quantity,
            priority: item.priority,
            weight: item.weight,
            desc: item.description,
            notes: step.notes,
          });
        });
      }
    });

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `plan_${strategy}_${shift}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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
              <DropdownMenuItem onClick={exportToExcel}>Descargar Excel (.xlsx)</DropdownMenuItem>
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
                <TableCell>{sName(step.station)}</TableCell>
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
