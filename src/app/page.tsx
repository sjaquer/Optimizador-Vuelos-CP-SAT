
'use client';

import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  SidebarProvider,
  Sidebar,
  SidebarInset,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { InputSidebar } from '@/components/app/input-sidebar';
import type { FlightPlan, Passenger, ScenarioData } from '@/lib/types';
import { generatePlan, generateAlternativePlan } from '@/lib/optimizer';
import { FlightPlanCard } from '@/components/app/flight-plan-card';
import { RouteMap } from '@/components/app/route-map';
import { Logo } from '@/components/app/logo';
import { Bot, Map, ListCollapse, Wind, Upload } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

export default function Home() {
  const [scenario, setScenario] = useState<ScenarioData>({
    numStations: 6,
    helicopterCapacity: 4,
    passengers: [],
  });
  const [flightPlans, setFlightPlans] = useState<FlightPlan[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('plans');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleGeneratePlans = () => {
    if (scenario.passengers.length === 0) {
        toast({
            variant: 'destructive',
            title: 'No hay pasajeros',
            description: 'Agregue al menos un pasajero para generar un plan de vuelo.',
        });
        return;
    }
    setIsLoading(true);
    setFlightPlans([]);
    // Use a timeout to allow the UI to update to the loading state
    setTimeout(() => {
      try {
        const plan1 = generatePlan(scenario);
        const plan2 = generateAlternativePlan(scenario);
        setFlightPlans([plan1, plan2]);
      } catch (error) {
        console.error("Error generating plans:", error);
        toast({
          variant: 'destructive',
          title: 'Error de Optimización',
          description: error instanceof Error ? error.message : 'No se pudo generar un plan de vuelo. Revise los datos del escenario.',
        });
      } finally {
         setIsLoading(false);
         setActiveTab('plans');
      }
    }, 500);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        const configSheet = workbook.Sheets['Configuracion'];
        if (!configSheet) throw new Error("No se encontró la hoja 'Configuracion'.");
        const configData = XLSX.utils.sheet_to_json<{ Clave: string; Valor: number }>(configSheet);

        const numStations = configData.find(row => row.Clave === 'numStations')?.Valor;
        const helicopterCapacity = configData.find(row => row.Clave === 'helicopterCapacity')?.Valor;

        if (numStations === undefined || helicopterCapacity === undefined) {
          throw new Error("El formato de la hoja 'Configuracion' es incorrecto.");
        }

        const passengersSheet = workbook.Sheets['Pasajeros'];
        if (!passengersSheet) throw new Error("No se encontró la hoja 'Pasajeros'.");
        const passengersData = XLSX.utils.sheet_to_json<{ nombre: string; prioridad: number; origen: number; destino: number }>(passengersSheet);

        const passengers: Passenger[] = passengersData.map((p, index) => ({
          id: crypto.randomUUID(),
          name: p.nombre,
          priority: p.prioridad,
          originStation: p.origen,
          destinationStation: p.destino,
        }));
        
        if (passengers.some(p => !p.name || p.priority === undefined || p.originStation === undefined || p.destinationStation === undefined)) {
            throw new Error("La hoja 'Pasajeros' tiene filas con datos incompletos o incorrectos.");
        }

        setScenario({ numStations, helicopterCapacity, passengers });
        toast({
          title: 'Éxito',
          description: 'Los datos del escenario se importaron correctamente desde Excel.',
        });

      } catch (error) {
        console.error("Error al importar el archivo:", error);
        toast({
          variant: 'destructive',
          title: 'Error de Importación',
          description: error instanceof Error ? error.message : 'No se pudo procesar el archivo Excel.',
        });
      } finally {
        if(event.target) event.target.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const selectedPlan = flightPlans[0];

  return (
    <SidebarProvider>
      <Sidebar>
        <InputSidebar
          scenario={scenario}
          setScenario={setScenario}
          onGeneratePlans={handleGeneratePlans}
          isLoading={isLoading}
        />
      </Sidebar>
      <SidebarInset>
        <div className="flex h-full flex-col">
          <header className="flex h-14 items-center justify-between border-b bg-card/50 px-4">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="md:hidden" />
              <Logo />
            </div>
            <Button variant="outline" size="sm" onClick={handleImportClick}>
                <Upload className="mr-2 h-4 w-4" />
                Importar desde Excel
            </Button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".xlsx, .xls"
              className="hidden"
            />
          </header>
          <main className="flex-1 overflow-auto p-4 md:p-6">
            {isLoading && (
                 <WelcomeScreen isLoading={true} />
            )}
            {!isLoading && flightPlans.length === 0 && (
              <WelcomeScreen isLoading={false} />
            )}
            {!isLoading && flightPlans.length > 0 && (
              <div className="flex flex-col gap-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold tracking-tight">
                    Planes de Vuelo Optimizados
                  </h2>
                  <div className="flex items-center gap-2 rounded-md bg-muted p-1">
                    <Button
                      variant={activeTab === 'plans' ? 'secondary' : 'ghost'}
                      size="sm"
                      onClick={() => setActiveTab('plans')}
                      className="h-8"
                    >
                      <ListCollapse className="mr-2 h-4 w-4" />
                      Planes
                    </Button>
                    <Button
                      variant={activeTab === 'map' ? 'secondary' : 'ghost'}
                      size="sm"
                      onClick={() => setActiveTab('map')}
                      className="h-8"
                    >
                      <Map className="mr-2 h-4 w-4" />
                      Ruta
                    </Button>
                  </div>
                </div>
                {activeTab === 'plans' && (
                  <div className="grid gap-6 lg:grid-cols-2">
                    {flightPlans.map((plan) => (
                      <FlightPlanCard key={plan.id} plan={plan} scenario={scenario} />
                    ))}
                  </div>
                )}
                {activeTab === 'map' && selectedPlan && (
                  <RouteMap plan={selectedPlan} numStations={scenario.numStations} />
                )}
              </div>
            )}
          </main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

function WelcomeScreen({ isLoading }: { isLoading: boolean }) {
  return (
    <div className="flex h-full items-center justify-center">
      <Card className="w-full max-w-lg text-center">
        <CardContent className="p-8">
          {isLoading ? (
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <Wind className="h-16 w-16 animate-spin text-primary" style={{ animationDuration: '3s' }} />
                <Bot className="absolute inset-0 m-auto h-8 w-8 text-primary/80" />
              </div>
              <h3 className="text-xl font-semibold">Generando Planes...</h3>
              <p className="text-muted-foreground">
                Nuestra IA está calculando las rutas más eficientes. Por favor espera un momento.
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <Bot className="h-16 w-16 text-primary" />
              <h3 className="text-xl font-semibold">Bienvenido a OVH</h3>
              <p className="text-muted-foreground">
                Define tu escenario en la barra lateral izquierda, o importa un archivo Excel, luego haz clic en "Generar Plan de Vuelo" para comenzar.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
