
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { FlightPlan, TransportItem, FlightStep } from '@/lib/types';
import { PlaneTakeoff, PlaneLanding, User, Waypoints, Package, ArrowRight, FileDown, RotateCw, Route, Gauge, Milestone } from 'lucide-react';
import { Fragment, useMemo } from 'react';
import { stationNamesMap } from '@/lib/stations';

interface FlightItineraryProps {
  plan: FlightPlan;
}

const actionTranslations: Record<FlightStep['action'], string> = {
  PICKUP: 'EMBARQUE',
  DROPOFF: 'DESEMBARQUE',
  TRAVEL: 'EN VUELO',
};

const priorityLabels: Record<number, string> = { 1: 'P1 Urgente', 2: 'P2 Estándar', 3: 'P3 Baja' };

/** Extract flight number from notes like "[Vuelo #2] ..." */
const getFlightNum = (notes: string): number | null => {
  const m = notes.match(/\[Vuelo #(\d+)\]/);
  return m ? Number(m[1]) : null;
};

export function FlightItinerary({ plan }: FlightItineraryProps) {
  const getActionIcon = (action: FlightStep['action']) => {
    switch (action) {
      case 'PICKUP': return <PlaneTakeoff className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />;
      case 'DROPOFF': return <PlaneLanding className="h-5 w-5 text-blue-600 dark:text-blue-400" />;
      case 'TRAVEL': return <Waypoints className="h-5 w-5 text-muted-foreground" />;
      default: return null;
    }
  };

  const getActionLabel = (action: FlightStep['action']) => actionTranslations[action] || action;

  const sName = (id: number) => stationNamesMap[id] ?? `E-${id}`;

  const getItemLabel = (item: TransportItem) => {
    const Icon = item.type === 'PAX' ? User : Package;
    const quantityLabel = item.type === 'PAX' && item.quantity > 1 ? ` (x${item.quantity})` : '';

    return (
       <Badge variant="outline" className={`font-medium h-auto py-1.5 px-2.5 text-sm shadow-sm border-muted-foreground/20 ${item.type === 'PAX' ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300' : 'bg-amber-500/10 text-amber-700 dark:text-amber-300'}`}>
          <Icon className="mr-1.5 h-4 w-4" />
          {item.area}-{item.type}{quantityLabel} 
          <span className="opacity-70 font-normal ml-1.5">(P{item.priority})</span>
          <span className='ml-2.5 pl-2.5 border-l border-current/20 flex items-center gap-1 opacity-80 text-xs'>
            {sName(item.originStation)} <ArrowRight className='h-3.5 w-3.5'/> {sName(item.destinationStation)}
          </span>
       </Badge>
    );
  };
  
  const strategy = plan.id.replace(/_[MT]$/, '');
  const shift = plan.id.endsWith('_M') ? 'M' : 'T';
  const { metrics } = plan;

  const summary = useMemo(() => {
    const pax = plan.steps.filter(s => s.action === 'DROPOFF').flatMap(s => s.items).filter(i => i.type === 'PAX');
    const cargo = plan.steps.filter(s => s.action === 'DROPOFF').flatMap(s => s.items).filter(i => i.type === 'CARGO');
    return {
      paxCount: pax.reduce((s, i) => s + i.quantity, 0),
      cargoCount: cargo.length,
      cargoWeight: cargo.reduce((s, i) => s + i.weight, 0),
    };
  }, [plan]);

  const exportToPDF = async () => {
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    const doc = new jsPDF({ orientation: 'landscape' });
    const pageW = doc.internal.pageSize.getWidth();
    const now = new Date().toLocaleString('es-CL', { dateStyle: 'long', timeStyle: 'short' });

    // Header bar
    doc.setFillColor(30, 58, 95);
    doc.rect(0, 0, pageW, 28, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.text(plan.title, 14, 12);
    doc.setFontSize(9);
    doc.text(`Generado: ${now}`, 14, 20);
    doc.text(`Turno: ${shift === 'M' ? 'Mañana' : 'Tarde'}`, pageW - 14, 12, { align: 'right' });

    // Metrics summary bar
    doc.setTextColor(60, 60, 60);
    doc.setFontSize(9);
    const y0 = 36;
    const metricsArr = [
      [`Distancia`, `${metrics.totalDistance.toFixed(0)} tramos`],
      [`Vuelos`, `${metrics.totalFlights}`],
      [`Paradas`, `${metrics.totalStops}`],
      [`PAX entregados`, `${summary.paxCount}`],
      [`Carga entregada`, `${summary.cargoCount} (${summary.cargoWeight} kg)`],
      [`Carga promedio`, `${Math.round(metrics.avgLoadRatio * 100)}%`],
    ];
    const colW = (pageW - 28) / metricsArr.length;
    metricsArr.forEach(([label, value], i) => {
      const x = 14 + i * colW;
      doc.setFillColor(245, 247, 250);
      doc.roundedRect(x, y0, colW - 4, 16, 2, 2, 'F');
      doc.setFontSize(7);
      doc.setTextColor(120, 120, 120);
      doc.text(label.toUpperCase(), x + (colW - 4) / 2, y0 + 5, { align: 'center' });
      doc.setFontSize(11);
      doc.setTextColor(30, 58, 95);
      doc.text(value, x + (colW - 4) / 2, y0 + 12, { align: 'center' });
    });

    // Itinerary table
    autoTable(doc, {
      startY: y0 + 22,
      head: [['#', 'Vuelo', 'Acción', 'Estación', 'Tipo', 'Área', 'Prioridad', 'Cantidad/Peso', 'Ruta', 'Detalle']],
      body: plan.steps.map((step, index) => {
        const flightNum = getFlightNum(step.notes);
        const noteText = step.notes.replace(/\[Vuelo #\d+\]\s*/, '');
        if (step.items.length === 0) {
          return [index + 1, flightNum ? `#${flightNum}` : '', getActionLabel(step.action), sName(step.station), '', '', '', '', '', noteText];
        }
        return [
          index + 1,
          flightNum ? `#${flightNum}` : '',
          getActionLabel(step.action),
          sName(step.station),
          step.items.map(i => i.type).join(', '),
          step.items.map(i => i.area).join(', '),
          step.items.map(i => priorityLabels[i.priority] || `P${i.priority}`).join(', '),
          step.items.map(i => i.type === 'PAX' ? `${i.quantity} pax` : `${i.weight} kg`).join(', '),
          step.items.map(i => `${sName(i.originStation)} → ${sName(i.destinationStation)}`).join('\n'),
          noteText,
        ];
      }),
      headStyles: { fillColor: [30, 58, 95], textColor: 255, fontStyle: 'bold', fontSize: 7, cellPadding: 2 },
      bodyStyles: { fontSize: 7, cellPadding: 1.5 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 14, halign: 'center' },
        2: { cellWidth: 22 },
        3: { cellWidth: 28 },
        9: { cellWidth: 'auto', fontStyle: 'italic', textColor: [100, 100, 100] },
      },
      margin: { left: 14, right: 14 },
      didDrawPage: (data: any) => {
        // Footer with page numbers
        doc.setFontSize(7);
        doc.setTextColor(140, 140, 140);
        doc.text(`Página ${doc.getNumberOfPages()}`, pageW - 14, doc.internal.pageSize.getHeight() - 8, { align: 'right' });
        doc.text('Logística Aérea — Plan Operativo', 14, doc.internal.pageSize.getHeight() - 8);
      },
    });
    doc.save(`plan_${strategy}_${shift}.pdf`);
  };

  const exportToExcel = async () => {
    const ExcelJS = await import('exceljs');
    const wb = new ExcelJS.Workbook();
    
    // ─── Summary sheet ───
    const wsSummary = wb.addWorksheet('Resumen');
    wsSummary.columns = [
      { header: 'Métrica', key: 'metric', width: 25 },
      { header: 'Valor', key: 'value', width: 20 },
    ];
    const sumHeaderRow = wsSummary.getRow(1);
    sumHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sumHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
    
    const summaryData = [
      ['Plan', plan.title],
      ['Turno', shift === 'M' ? 'Mañana' : 'Tarde'],
      ['Distancia total', `${metrics.totalDistance.toFixed(0)} tramos`],
      ['Vuelos', `${metrics.totalFlights}`],
      ['Paradas', `${metrics.totalStops}`],
      ['PAX entregados', `${summary.paxCount}`],
      ['Carga entregada', `${summary.cargoCount} bultos (${summary.cargoWeight} kg)`],
      ['Carga promedio', `${Math.round(metrics.avgLoadRatio * 100)}%`],
      ['Items no entregados', `${metrics.itemsNotDelivered}`],
      ['Generado', new Date().toLocaleString('es-CL')],
    ];
    summaryData.forEach(([metric, value]) => {
      const row = wsSummary.addRow({ metric, value });
      row.getCell(1).font = { bold: true };
    });

    // ─── Itinerary sheet ───
    const ws = wb.addWorksheet('Itinerario');
    ws.columns = [
      { header: 'Paso', key: 'step', width: 8 },
      { header: 'Vuelo', key: 'flight', width: 8 },
      { header: 'Acción', key: 'action', width: 14 },
      { header: 'Estación', key: 'station', width: 22 },
      { header: 'Tipo tramo', key: 'legType', width: 12 },
      { header: 'Área', key: 'area', width: 12 },
      { header: 'Tipo', key: 'type', width: 10 },
      { header: 'Cantidad', key: 'qty', width: 10 },
      { header: 'Prioridad', key: 'priority', width: 12 },
      { header: 'Peso (kg)', key: 'weight', width: 12 },
      { header: 'Origen', key: 'origin', width: 18 },
      { header: 'Destino', key: 'dest', width: 18 },
      { header: 'Descripción', key: 'desc', width: 25 },
      { header: 'Notas', key: 'notes', width: 40 },
    ];

    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };

    plan.steps.forEach((step, index) => {
      const flightNum = getFlightNum(step.notes);
      const noteText = step.notes.replace(/\[Vuelo #\d+\]\s*/, '');
      if (step.items.length === 0) {
        const row = ws.addRow({ step: index + 1, flight: flightNum ?? '', action: getActionLabel(step.action), station: sName(step.station), legType: step.legType ?? '', notes: noteText });
        if (step.action === 'TRAVEL') {
          row.eachCell(cell => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }; });
        }
      } else {
        step.items.forEach(item => {
          const row = ws.addRow({
            step: index + 1,
            flight: flightNum ?? '',
            action: getActionLabel(step.action),
            station: sName(step.station),
            legType: step.legType ?? '',
            area: item.area,
            type: item.type,
            qty: item.quantity,
            priority: priorityLabels[item.priority] || `P${item.priority}`,
            weight: item.weight,
            origin: sName(item.originStation),
            dest: sName(item.destinationStation),
            desc: item.description,
            notes: noteText,
          });
          if (step.action === 'PICKUP') {
            row.getCell('action').font = { bold: true, color: { argb: 'FF059669' } };
          } else if (step.action === 'DROPOFF') {
            row.getCell('action').font = { bold: true, color: { argb: 'FF2563EB' } };
          }
        });
      }
    });

    // Auto-filter
    ws.autoFilter = { from: 'A1', to: `N${ws.rowCount}` };

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
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Metrics summary bar */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { icon: <Route className="h-5 w-5" />, label: 'Distancia', value: `${metrics.totalDistance.toFixed(0)}`, unit: 'tramos' },
          { icon: <PlaneTakeoff className="h-5 w-5" />, label: 'Vuelos', value: `${metrics.totalFlights}`, unit: '' },
          { icon: <Milestone className="h-5 w-5" />, label: 'Paradas', value: `${metrics.totalStops}`, unit: '' },
          { icon: <User className="h-5 w-5 text-blue-500" />, label: 'PAX', value: `${summary.paxCount}`, unit: 'entregados' },
          { icon: <Package className="h-5 w-5 text-amber-500" />, label: 'Carga', value: `${summary.cargoCount}`, unit: `${summary.cargoWeight} kg` },
          { icon: <Gauge className="h-5 w-5" />, label: 'Carga prom.', value: `${Math.round(metrics.avgLoadRatio * 100)}%`, unit: '' },
        ].map((m) => (
          <div key={m.label} className="bg-card border rounded-lg p-4 text-center shadow-sm">
            <div className="flex justify-center mb-1.5 text-primary">{m.icon}</div>
            <div className="text-2xl font-bold tabular-nums">{m.value}</div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider mt-0.5">{m.label}{m.unit ? ` · ${m.unit}` : ''}</div>
          </div>
        ))}
      </div>

      {/* Itinerary table */}
      <Card className="shadow-sm">
        <CardHeader className='flex-row items-center justify-between'>
          <div>
            <CardTitle className="text-lg">{plan.title}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">Itinerario paso a paso · {plan.steps.length} pasos</p>
          </div>
          <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="default" variant="outline" className='shadow-sm gap-2 h-10'>
                  <FileDown className="h-4 w-4" />
                  Exportar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={exportToPDF} className="text-sm py-2">Descargar PDF</DropdownMenuItem>
                <DropdownMenuItem onClick={exportToExcel} className="text-sm py-2">Descargar Excel (.xlsx)</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="w-[50px] text-center text-sm">#</TableHead>
                  <TableHead className="w-[60px] text-center text-sm">Vuelo</TableHead>
                  <TableHead className="w-[140px] text-sm">Acción</TableHead>
                  <TableHead className="w-[180px] text-sm">Estación</TableHead>
                  <TableHead className="min-w-[280px] text-sm">Items</TableHead>
                  <TableHead className="min-w-[220px] text-sm">Detalle</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plan.steps.map((step, index) => {
                  const flightNum = getFlightNum(step.notes);
                  const prevFlightNum = index > 0 ? getFlightNum(plan.steps[index - 1].notes) : null;
                  const isNewFlight = flightNum !== null && flightNum !== prevFlightNum;
                  const noteText = step.notes.replace(/\[Vuelo #\d+\]\s*/, '');

                  return (
                    <Fragment key={`step-${index}`}>
                      {isNewFlight && (
                        <TableRow className="bg-primary/5 border-t-2 border-primary/20 hover:bg-primary/10">
                          <TableCell colSpan={6} className="py-2">
                            <div className="flex items-center gap-2 text-sm font-bold text-primary">
                              <RotateCw className="h-4 w-4" />
                              Vuelo #{flightNum}
                              {step.legType && (
                                <Badge variant="outline" className={`text-xs px-2 py-0.5 ml-1 ${step.legType === 'PAX' ? 'bg-blue-500/10 text-blue-600 border-blue-500/30' : step.legType === 'CARGO' ? 'bg-amber-500/10 text-amber-600 border-amber-500/30' : 'bg-muted text-muted-foreground'}`}>
                                  {step.legType === 'PAX' ? '✈ Pasajeros' : step.legType === 'CARGO' ? '📦 Carga' : '↻ Reposición'}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                      <TableRow className={
                        step.action === 'TRAVEL' ? 'bg-muted/5 text-muted-foreground' : 
                        step.action === 'PICKUP' ? 'bg-emerald-500/[0.02]' : 
                        step.action === 'DROPOFF' ? 'bg-blue-500/[0.02]' : ''
                      }>
                        <TableCell className="font-mono text-sm text-center text-muted-foreground">{index + 1}</TableCell>
                        <TableCell className="text-center">
                          {flightNum !== null && (
                            <Badge variant="secondary" className="text-xs px-2 py-0.5 font-mono tabular-nums">
                              #{flightNum}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 font-medium text-sm">
                            {getActionIcon(step.action)}
                            <span className={
                              step.action === 'PICKUP' ? 'text-emerald-700 dark:text-emerald-400' :
                              step.action === 'DROPOFF' ? 'text-blue-700 dark:text-blue-400' :
                              'text-muted-foreground'
                            }>{getActionLabel(step.action)}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium text-sm">{sName(step.station)}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1.5">
                            {step.items.map((item) => (
                              <div key={item.id}>{getItemLabel(item)}</div>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm max-w-[300px]">{noteText}</TableCell>
                      </TableRow>
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
