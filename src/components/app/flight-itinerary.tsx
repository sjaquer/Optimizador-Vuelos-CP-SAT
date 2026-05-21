'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { FlightPlan, TransportItem, FlightStep } from '@/lib/types';
import { PlaneTakeoff, PlaneLanding, User, Waypoints, Package, ArrowRight, FileDown, RotateCw, Route, Gauge, Milestone, Fuel } from 'lucide-react';
import { Fragment, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';

interface FlightItineraryProps {
  plan: FlightPlan;
  namesMap?: Record<string, string>;
}

const actionTranslations: Record<FlightStep['action'], string> = {
  PICKUP: 'EMBARQUE',
  DROPOFF: 'DESEMBARQUE',
  TRAVEL: 'EN VUELO',
  REFUEL: 'REABASTECIMIENTO DE COMBUSTIBLE',
};

const priorityLabels: Record<'ALTA' | 'MEDIA' | 'BAJA', string> = { ALTA: 'Alta', MEDIA: 'Media', BAJA: 'Baja' };

/** Extract flight number from notes like "[Vuelo #2] ..." */
const getFlightNum = (notes: string): number | null => {
  const m = notes.match(/\[Vuelo #(\d+)\]/);
  return m ? Number(m[1]) : null;
};

export function FlightItinerary({ plan, namesMap = {} }: FlightItineraryProps) {
  const { toast } = useToast();
  
  const sName = (id: string) => namesMap[id] ?? id;

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
    try {
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
        [`Distancia`, `${metrics.totalDistance.toFixed(1)} km`],
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
            return [index + 1, flightNum ? `#${flightNum}` : '', actionTranslations[step.action] || step.action, sName(step.station), '', '', '', '', '', noteText];
          }
          return [
            index + 1,
            flightNum ? `#${flightNum}` : '',
            actionTranslations[step.action] || step.action,
            sName(step.station),
            step.items.map(i => i.type).join(', '),
            step.items.map(i => i.area).join(', '),
            step.items.map(i => priorityLabels[i.priority] || i.priority).join(', '),
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
          doc.setFontSize(7);
          doc.setTextColor(140, 140, 140);
          doc.text(`Página ${doc.getNumberOfPages()}`, pageW - 14, doc.internal.pageSize.getHeight() - 8, { align: 'right' });
          doc.text('Logística Aérea — Plan Operativo', 14, doc.internal.pageSize.getHeight() - 8);
        },
      });
      doc.save(`plan_${strategy}_${shift}.pdf`);
    } catch (error) {
      console.error('Error al exportar PDF:', error);
      toast({ variant: 'destructive', title: 'Error de Exportación', description: 'No se pudo generar el PDF. Intenta de nuevo.' });
    }
  };

  const exportToExcel = async () => {
    try {
      const ExcelJS = await import('exceljs');
      const wb = new ExcelJS.Workbook();
      
      // Summary sheet
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
        ['Distancia total', `${metrics.totalDistance.toFixed(1)} km`],
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

      // Itinerary sheet
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
          const row = ws.addRow({ step: index + 1, flight: flightNum ?? '', action: actionTranslations[step.action] || step.action, station: sName(step.station), legType: step.legType ?? '', notes: noteText });
          if (step.action === 'TRAVEL') {
            row.eachCell(cell => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }; });
          }
        } else {
          step.items.forEach(item => {
            const row = ws.addRow({
              step: index + 1,
              flight: flightNum ?? '',
              action: actionTranslations[step.action] || step.action,
              station: sName(step.station),
              legType: step.legType ?? '',
              area: item.area,
              type: item.type,
              qty: item.quantity,
              priority: priorityLabels[item.priority] || item.priority,
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
    } catch (error) {
      console.error('Error al exportar Excel:', error);
      toast({ variant: 'destructive', title: 'Error de Exportación', description: 'No se pudo generar el archivo Excel.' });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Metrics summary bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {[
          { icon: <Route className="h-5 w-5" />, label: 'Distancia', value: `${metrics.totalDistance.toFixed(1)}`, unit: 'km' },
          { icon: <RotateCw className="h-5 w-5 text-primary" />, label: 'Vuelos', value: `${metrics.totalFlights}`, unit: '' },
          { icon: <Milestone className="h-5 w-5 text-emerald-500" />, label: 'Paradas', value: `${metrics.totalStops}`, unit: '' },
          { icon: <User className="h-5 w-5 text-cyan-500" />, label: 'PAX', value: `${summary.paxCount}`, unit: 'entregados' },
          { icon: <Package className="h-5 w-5 text-amber-500" />, label: 'Carga', value: `${summary.cargoCount}`, unit: `${summary.cargoWeight} kg` },
          { icon: <Gauge className="h-5 w-5 text-indigo-500" />, label: 'Carga prom.', value: `${Math.round(metrics.avgLoadRatio * 100)}%`, unit: '' },
        ].map((m) => (
          <div key={m.label} className="glass-card border border-border/50 rounded-xl p-4 text-center shadow-lg transition-all hover:-translate-y-1 duration-300">
            <div className="flex justify-center mb-2">{m.icon}</div>
            <div className="text-xl sm:text-2xl font-bold font-mono tracking-tight">{m.value}</div>
            <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mt-1">{m.label}{m.unit ? ` · ${m.unit}` : ''}</div>
          </div>
        ))}
      </div>

      {/* Itinerary Timeline */}
      <Card className="glass-card shadow-xl border-border/50 overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-primary to-orange-600 opacity-80" />
        <CardHeader className='flex flex-row items-center justify-between gap-4 flex-wrap border-b border-border/50 bg-muted/10 pb-4'>
          <div className="min-w-0">
            <CardTitle className="text-lg sm:text-xl font-bold tracking-tight text-foreground">{plan.title}</CardTitle>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1 font-medium">Itinerario Operativo · {plan.steps.length} Pasos</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="default" variant="outline" className='shadow-sm gap-2 h-10 border-border/60 hover:bg-muted/40'>
                <FileDown className="h-4 w-4" />
                Exportar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="glass-card border-border/60">
              <DropdownMenuItem onClick={exportToPDF} className="text-sm py-2 cursor-pointer hover:bg-muted/40">Descargar PDF</DropdownMenuItem>
              <DropdownMenuItem onClick={exportToExcel} className="text-sm py-2 cursor-pointer hover:bg-muted/40">Descargar Excel (.xlsx)</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 md:p-8 bg-card/20">
          
          <div className="relative border-l-2 border-border/60 ml-4 sm:ml-8 pl-6 sm:pl-10 py-2 space-y-6 sm:space-y-8">
            
            {plan.steps.map((step, index) => {
              const flightNum = getFlightNum(step.notes);
              const prevFlightNum = index > 0 ? getFlightNum(plan.steps[index - 1].notes) : null;
              const isNewFlight = flightNum !== null && flightNum !== prevFlightNum;
              const noteText = step.notes.replace(/\[Vuelo #\d+\]\s*/, '');

              // Action styles
              let dotColor = "bg-muted-foreground border-muted-foreground/30";
              let icon = <Waypoints className="h-4 w-4 text-white" />;
              let containerStyle = "border-border/40 hover:border-border/80";
              let badgeColor = "bg-muted/40 text-muted-foreground border-border";

              if (step.action === 'PICKUP') {
                dotColor = "bg-emerald-500 border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.3)]";
                icon = <PlaneTakeoff className="h-4 w-4 text-white" />;
                containerStyle = "border-emerald-500/20 bg-emerald-500/[0.02] hover:border-emerald-500/40";
                badgeColor = "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25";
              } else if (step.action === 'DROPOFF') {
                dotColor = "bg-blue-500 border-blue-500/30 shadow-[0_0_10px_rgba(59,130,246,0.3)]";
                icon = <PlaneLanding className="h-4 w-4 text-white" />;
                containerStyle = "border-blue-500/20 bg-blue-500/[0.02] hover:border-blue-500/40";
                badgeColor = "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/25";
              } else if (step.action === 'REFUEL') {
                dotColor = "bg-orange-500 border-orange-500/30 shadow-[0_0_10px_rgba(249,115,22,0.4)] animate-pulse";
                icon = <Fuel className="h-4 w-4 text-white" />;
                containerStyle = "border-orange-500/20 bg-orange-500/[0.02] hover:border-orange-500/40";
                badgeColor = "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/25";
              }

              return (
                <div key={`step-${index}`} className="relative group transition-all duration-300">
                  
                  {/* Timeline point dot */}
                  <span className={`absolute -left-[35px] sm:-left-[51px] top-1 flex h-6 w-6 sm:h-8 sm:w-8 items-center justify-center rounded-full border-4 ${dotColor} z-10 transition-transform duration-300 group-hover:scale-110`}>
                    {icon}
                  </span>

                  {/* Flight header marker */}
                  {isNewFlight && (
                    <div className="mb-4 -mt-2 animate-slide-in">
                      <div className="inline-flex items-center gap-2 bg-gradient-to-r from-primary to-orange-500 text-white font-mono font-bold text-xs px-3 py-1 rounded-full shadow-md">
                        <RotateCw className="h-3.5 w-3.5 animate-spin-slow" />
                        VUELO #{flightNum}
                        {step.legType && (
                          <span className="opacity-90 font-sans border-l border-white/20 pl-2 ml-1 text-[10px]">
                            {step.legType === 'PAX' ? '✈ Pasajeros' : step.legType === 'CARGO' ? '📦 Carga' : '↻ Reposición'}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Step Card Content */}
                  <div className={`border rounded-xl p-4 sm:p-5 shadow-sm transition-all duration-300 ${containerStyle}`}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold font-mono bg-muted/60 text-muted-foreground px-2 py-0.5 rounded border border-border">
                          PASO {index + 1}
                        </span>
                        <Badge variant="outline" className={`text-xs font-bold font-sans tracking-wide uppercase px-2.5 py-0.5 ${badgeColor}`}>
                          {actionTranslations[step.action] || step.action}
                        </Badge>
                      </div>

                      {flightNum !== null && (
                        <div className="text-xs font-mono font-semibold text-muted-foreground">
                          Vuelo <span className="text-primary font-bold">#{flightNum}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-baseline gap-2 mb-3">
                      <h4 className="text-sm sm:text-base font-bold text-foreground">
                        Estación: <span className="text-primary">{sName(step.station)}</span>
                      </h4>
                    </div>

                    {/* Transport items lists */}
                    {step.items.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {step.items.map((item) => {
                          const ItemIcon = item.type === 'PAX' ? User : Package;
                          const quantityLabel = item.type === 'PAX' && item.quantity > 1 ? ` (x${item.quantity})` : '';
                          const isItemPax = item.type === 'PAX';
                          
                          return (
                            <Badge 
                              key={item.id}
                              variant="outline" 
                              className={`font-semibold h-auto py-1.5 px-3 text-xs sm:text-sm shadow-sm border-border/50 transition-colors ${
                                isItemPax 
                                  ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300 hover:bg-blue-500/20' 
                                  : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20'
                              }`}
                            >
                              <ItemIcon className="mr-1.5 h-3.5 w-3.5 shrink-0" />
                              {item.area} - {item.type} {quantityLabel}
                              <span className="opacity-75 font-normal ml-1.5">{item.priority === 'ALTA' ? 'Alta' : item.priority === 'MEDIA' ? 'Media' : 'Baja'}</span>
                              <span className="ml-2 pl-2 border-l border-current/25 font-mono text-[10px] font-normal flex items-center gap-1.5">
                                {sName(item.originStation)} <ArrowRight className="h-3 w-3" /> {sName(item.destinationStation)}
                              </span>
                            </Badge>
                          );
                        })}
                      </div>
                    )}

                    {/* Operational details notes */}
                    {noteText && (
                      <p className="text-xs sm:text-sm text-muted-foreground italic border-t border-border/40 pt-3 mt-1 font-mono">
                        {noteText}
                      </p>
                    )}

                  </div>
                </div>
              );
            })}

          </div>
        </CardContent>
      </Card>
    </div>
  );
}
