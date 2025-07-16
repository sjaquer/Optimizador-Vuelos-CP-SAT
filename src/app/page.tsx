
'use client';

import { useState, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  SidebarProvider,
  Sidebar,
  SidebarInset,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { InputSidebar } from '@/components/app/input-sidebar';
import type { FlightPlan, TransportItem, ScenarioData } from '@/lib/types';
import { generatePassengerPlans, generateCargoPlans } from '@/lib/optimizer';
import { FlightPlanCard } from '@/components/app/flight-plan-card';
import { RouteMap } from '@/components/app/route-map';
import { Bot, Map, ListCollapse, Wind, Upload, PlusCircle, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { saveScenarioToHistory } from '@/lib/history';
import { ThemeToggle } from '@/components/app/theme-toggle';

export default function Home() {
  const [scenario, setScenario] = useState<ScenarioData>({
    numStations: 6,
    helicopterCapacity: 4,
    transportItems: [],
    weatherConditions: '',
    operationalNotes: '',
  });
  const [passengerPlans, setPassengerPlans] = useState<FlightPlan[]>([]);
  const [cargoPlans, setCargoPlans] = useState<FlightPlan[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingAlternative, setIsLoadingAlternative] = useState(false);
  const [activeView, setActiveView] = useState('plans'); // 'plans' or 'map'
  const [activeShift, setActiveShift] = useState<'M' | 'T'>('M');
  const [selectedPlan, setSelectedPlan] = useState<FlightPlan | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const filteredScenario = useMemo((): ScenarioData => {
    return {
      ...scenario,
      transportItems: scenario.transportItems.filter(item => item.shift === activeShift),
    };
  }, [scenario, activeShift]);

  const handleGeneratePlans = () => {
    if (filteredScenario.transportItems.length === 0) {
        toast({
            variant: 'destructive',
            title: 'No hay ítems',
            description: `No hay pasajeros ni carga para el turno de la ${activeShift === 'M' ? 'mañana' : 'tarde'}.`,
        });
        return;
    }
    setIsLoading(true);
    setPassengerPlans([]);
    setCargoPlans([]);
    setSelectedPlan(null);

    setTimeout(() => {
      try {
        const passPlans = generatePassengerPlans(filteredScenario);
        const cargPlans = generateCargoPlans(filteredScenario);

        setPassengerPlans(passPlans);
        setCargoPlans(cargPlans);
        
        if (passPlans.length > 0) {
          setSelectedPlan(passPlans[0]);
        } else if (cargPlans.length > 0) {
          setSelectedPlan(cargPlans[0]);
        }

        saveScenarioToHistory(scenario);
         toast({
            title: 'Éxito',
            description: 'Planes generados y escenario guardado en el historial.',
          });
      } catch (error) {
        console.error("Error generating plans:", error);
        toast({
          variant: 'destructive',
          title: 'Error de Optimización',
          description: error instanceof Error ? error.message : 'No se pudo generar un plan de vuelo. Revise los datos del escenario.',
        });
      } finally {
         setIsLoading(false);
         setActiveView('plans');
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
        const configData = XLSX.utils.sheet_to_json<{ Clave: string; Valor: any }>(configSheet);
        const numStations = configData.find(row => row.Clave === 'numStations')?.Valor;
        const helicopterCapacity = configData.find(row => row.Clave === 'helicopterCapacity')?.Valor;
        if (numStations === undefined || helicopterCapacity === undefined) throw new Error("Formato de 'Configuracion' incorrecto.");

        const itemsSheet = workbook.Sheets['Items'];
        if (!itemsSheet) throw new Error("No se encontró la hoja 'Items'.");
        const itemsData = XLSX.utils.sheet_to_json<{ area: string; tipo: 'PAX' | 'CARGO'; turno: 'M' | 'T'; prioridad: number; origen: number; destino: number }>(itemsSheet);

        const transportItems: TransportItem[] = itemsData.map((item, index) => ({
          id: crypto.randomUUID(),
          area: item.area,
          type: item.tipo,
          shift: item.turno,
          priority: item.prioridad,
          originStation: item.origen,
          destinationStation: item.destino,
        }));
        
        if (transportItems.some(p => !p.area || !p.type || !p.shift || p.priority === undefined || p.originStation === undefined || p.destinationStation === undefined)) {
            throw new Error("La hoja 'Items' tiene filas con datos incompletos o incorrectos.");
        }

        setScenario({ 
            numStations, 
            helicopterCapacity, 
            transportItems, 
            weatherConditions: '',
            operationalNotes: '',
        });
        toast({ title: 'Éxito', description: 'Datos del escenario importados correctamente.' });
      } catch (error) {
        console.error("Error al importar:", error);
        toast({ variant: 'destructive', title: 'Error de Importación', description: error instanceof Error ? error.message : 'No se pudo procesar el archivo Excel.' });
      } finally {
        if(event.target) event.target.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const allPlans = [...passengerPlans, ...cargoPlans];
  
  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
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
              <SidebarTrigger />
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <Select value={activeShift} onValueChange={(val: 'M' | 'T') => setActiveShift(val)}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Seleccionar turno" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="M">Turno Mañana</SelectItem>
                    <SelectItem value="T">Turno Tarde</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className='flex items-center gap-2'>
              <Button variant="outline" size="sm" onClick={handleImportClick}>
                  <Upload className="mr-2 h-4 w-4" />
                  Importar Excel
              </Button>
              <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".xlsx, .xls" className="hidden" />
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 overflow-auto p-4 md:p-6">
            {isLoading && <WelcomeScreen isLoading={true} />}
            {!isLoading && allPlans.length === 0 && <WelcomeScreen isLoading={false} />}
            {!isLoading && allPlans.length > 0 && (
              <div className="flex flex-col gap-8">
                <div className="flex items-center justify-end">
                    <div className="flex items-center gap-2 rounded-md bg-muted p-1">
                      <Button variant={activeView === 'plans' ? 'secondary' : 'ghost'} size="sm" onClick={() => setActiveView('plans')} className="h-8">
                        <ListCollapse className="mr-2 h-4 w-4" />
                        Planes
                      </Button>
                      <Button variant={activeView === 'map' ? 'secondary' : 'ghost'} size="sm" onClick={() => setActiveView('map')} className="h-8" disabled={!selectedPlan}>
                        <Map className="mr-2 h-4 w-4" />
                        Ruta
                      </Button>
                    </div>
                </div>
                {activeView === 'plans' ? (
                  <div className="space-y-8">
                    {passengerPlans.length > 0 && (
                      <div>
                        <h2 className="text-2xl font-bold tracking-tight mb-4">Planes de Pasajeros (PAX)</h2>
                        <div className="grid gap-6 lg:grid-cols-2">
                          {passengerPlans.map((plan) => (
                            <FlightPlanCard key={plan.id} plan={plan} scenario={scenario} />
                          ))}
                        </div>
                      </div>
                    )}
                     {cargoPlans.length > 0 && (
                      <div>
                        <h2 className="text-2xl font-bold tracking-tight mb-4">Planes de Carga</h2>
                         <div className="grid gap-6 lg:grid-cols-2">
                          {cargoPlans.map((plan) => (
                            <FlightPlanCard key={plan.id} plan={plan} scenario={scenario} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : selectedPlan && (
                  <>
                    <div className='flex items-center gap-4'>
                      <span className='text-sm font-medium'>Visualizando:</span>
                      <Select value={selectedPlan.id} onValueChange={(planId) => setSelectedPlan(allPlans.find(p => p.id === planId) || null)}>
                          <SelectTrigger className="w-[280px]">
                            <SelectValue placeholder="Seleccionar un plan" />
                          </SelectTrigger>
                          <SelectContent>
                            {passengerPlans.length > 0 && <SelectItem value="header-pax" disabled>Planes de Pasajeros</SelectItem>}
                            {passengerPlans.map((plan) => <SelectItem key={plan.id} value={plan.id}>{plan.title}</SelectItem>)}
                            {cargoPlans.length > 0 && <SelectItem value="header-cargo" disabled>Planes de Carga</SelectItem>}
                            {cargoPlans.map((plan) => <SelectItem key={plan.id} value={plan.id}>{plan.title}</SelectItem>)}
                          </SelectContent>
                        </Select>
                    </div>
                    <RouteMap plan={selectedPlan} numStations={scenario.numStations} />
                  </>
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
                El motor de optimización está calculando las rutas. Por favor espera un momento.
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <Bot className="h-16 w-16 text-primary" />
              <h3 className="text-xl font-semibold">Bienvenido, Roberto J. Jaque Culqui</h3>
              <p className="text-muted-foreground">
                Define tu escenario, selecciona un turno y haz clic en "Generar Plan de Vuelo" para comenzar.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
