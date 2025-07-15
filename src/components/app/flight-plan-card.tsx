'use client';

import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { FlightPlan, Passenger, ScenarioData, FlightStep } from '@/lib/types';
import { PlaneTakeoff, PlaneLanding, User, Users, Wind, Milestone, Download, ArrowRight } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface FlightPlanCardProps {
  plan: FlightPlan;
  scenario: ScenarioData;
}

export function FlightPlanCard({ plan, scenario }: FlightPlanCardProps) {
  const getActionIcon = (action: FlightStep['action']) => {
    switch (action) {
      case 'PICKUP':
        return <PlaneTakeoff className="h-4 w-4 text-green-600" />;
      case 'DROPOFF':
        return <PlaneLanding className="h-4 w-4 text-blue-600" />;
      case 'TRAVEL':
        return <Wind className="h-4 w-4 text-muted-foreground" />;
      default:
        return null;
    }
  };

  const handleExport = () => {
    const headers = ['Paso', 'Acción', 'Estación', 'Pasajeros', 'Notas'];
    const rows = plan.steps.map((step, index) => [
      index + 1,
      step.action,
      step.station === 0 ? 'Base' : `Estación ${step.station}`,
      step.passengers.map(p => `${p.name} (P${p.priority})`).join(', '),
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

  const getPassengerLabel = (passenger: Passenger, action: FlightStep['action']) => {
    const originLabel = passenger.originStation === 0 ? 'B' : passenger.originStation;
    const destLabel = passenger.destinationStation === 0 ? 'B' : passenger.destinationStation;

    return (
       <Badge variant="secondary" className="font-normal">
          <User className="mr-1 h-3 w-3" />
          {passenger.name} (P{passenger.priority})
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
          <Button size="icon" variant="ghost" onClick={handleExport}>
            <Download className="h-5 w-5" />
          </Button>
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
            <Users className="h-4 w-4" />
            <span>{plan.metrics.passengersTransported} Pasajeros</span>
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
                <TableHead>Pasajeros</TableHead>
                <TableHead>Notas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plan.steps.map((step, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <div className="flex items-center gap-2 font-medium">
                      {getActionIcon(step.action)}
                      <span>{step.action}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {step.station === 0 ? 'Base' : `Estación ${step.station}`}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {step.passengers.map((p) => (
                       <div key={p.id}>
                          {getPassengerLabel(p, step.action)}
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

    