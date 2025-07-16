
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { PlaneTakeoff, PlaneLanding, User, Wind, Milestone, FileDown, ArrowRight, Waypoints, Package } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';


interface FlightPlanCardProps {
  plan: FlightPlan;
  scenario: ScenarioData;
}

const actionTranslations: Record<FlightStep['action'], string> = {
  PICKUP: 'RECOGER',
  DROPOFF: 'DEJAR',
  TRAVEL: 'VIAJAR',
};

export function FlightPlanCard({ plan, scenario }: FlightPlanCardProps) {
  const getActionIcon = (action: FlightStep['action']) => {
    switch (action) {
      case 'PICKUP':
        return <PlaneTakeoff className="h-4 w-4 text-green-600" />;
      case 'DROPOFF':
        return <PlaneLanding className="h-4 w-4 text-blue-600" />;
      case 'TRAVEL':
        return <Waypoints className="h-4 w-4 text-muted-foreground" />;
      default:
        return null;
    }
  };
  
  const getActionLabel = (action: FlightStep['action']) => {
    return actionTranslations[action] || action;
  }

  const handleExportExcel = () => {
    const headers = ['Paso', 'Acción', 'Estación', 'Items', 'Notas'];
    const rows = plan.steps.map((step, index) => [
      index + 1,
      getActionLabel(step.action),
      step.station === 0 ? 'Base' : `Estación ${step.station}`,
      step.items.map(item => `${item.area}-${item.type} (P${item.priority})`).join(', '),
      step.notes,
    ]);

    let csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n" 
      + rows.map(e => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `plan_de_vuelo_${plan.id}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const headStyles = { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' };
    const bodyStyles = { font: 'helvetica', fontSize: 10 };

    doc.setFontSize(18);
    doc.text(plan.title, pageWidth / 2, 20, { align: 'center' });

    doc.setFontSize(11);
    doc.setTextColor(100);
    const metricsText = `Paradas: ${plan.metrics.totalStops} | Tramos: ${plan.metrics.totalDistance} | Items: ${plan.metrics.itemsTransported}`;
    doc.text(metricsText, pageWidth / 2, 28, { align: 'center' });

    autoTable(doc, {
      startY: 40,
      head: [['Paso', 'Acción', 'Estación', 'Items', 'Notas']],
      body: plan.steps.map((step, index) => [
        index + 1,
        getActionLabel(step.action),
        step.station === 0 ? 'Base' : `E-${step.station}`,
        step.items.map(p => `${p.area}-${p.type} (P${p.priority})`).join('\n'),
        step.notes
      ]),
      headStyles: headStyles,
      bodyStyles: bodyStyles,
      columnStyles: {
        0: { cellWidth: 15 },
        1: { cellWidth: 25 },
        2: { cellWidth: 20 },
        3: { cellWidth: 'auto' },
        4: { cellWidth: 'auto' }
      },
      didDrawPage: (data) => {
        const str = 'Página ' + doc.internal.pages.length;
        doc.setFontSize(10);
        doc.text(str, data.settings.margin.left, doc.internal.pageSize.getHeight() - 10);
      }
    });

    doc.save(`plan_de_vuelo_${plan.id}.pdf`);
  }

  const getItemLabel = (item: TransportItem) => {
    const originLabel = item.originStation === 0 ? 'B' : item.originStation;
    const destLabel = item.destinationStation === 0 ? 'B' : item.destinationStation;
    const Icon = item.type === 'PAX' ? User : Package;

    return (
       <Badge variant="secondary" className="font-normal">
          <Icon className="mr-1 h-3 w-3" />
          {item.area}-{item.type} (P{item.priority})
          <span className='mx-1.5 text-muted-foreground/80 flex items-center gap-0.5'>
            {originLabel} <ArrowRight className='h-3 w-3'/> {destLabel}
          </span>
       </Badge>
    )
  }

  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{plan.title}</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost">
                <FileDown className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExportPDF}>Descargar PDF</DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportExcel}>Descargar Excel</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardTitle>
        <div className="flex items-center gap-4 pt-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Milestone className="h-4 w-4" />
            <span>{plan.metrics.totalStops} Paradas</span>
          </div>
          <div className="flex items-center gap-2">
            <Wind className="h-4 w-4" />
            <span>{plan.metrics.totalDistance} Tramos</span>
          </div>
          <div className="flex items-center gap-2">
            {plan.id.includes('pax') ? <User className="h-4 w-4" /> : <Package className="h-4 w-4" />}
            <span>{plan.metrics.itemsTransported} Items</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea className="h-80">
          <Table>
            <TableHeader className="sticky top-0 bg-card">
              <TableRow>
                <TableHead className="w-[80px]">Acción</TableHead>
                <TableHead>Estación</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Notas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plan.steps.map((step, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <div className="flex items-center gap-2 font-medium">
                      {getActionIcon(step.action)}
                      <span>{getActionLabel(step.action)}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {step.station === 0 ? 'Base' : `Estación ${step.station}`}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {step.items.map((item) => (
                       <div key={item.id}>
                          {getItemLabel(item)}
                       </div>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{step.notes}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
