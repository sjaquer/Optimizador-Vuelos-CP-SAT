
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
import { InputSidebar } from '@/components/app/input-sidebar';
import type { FlightPlan, TransportItem, ScenarioData } from '@/lib/types';
import { FlightPlanCard } from '@/components/app/flight-plan-card';
import { RouteMap } from '@/components/app/route-map';
import { Bot, Map, ListCollapse, Wind, Upload, Package, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { saveScenarioToHistory } from '@/lib/history';
import { ThemeToggle } from '@/components/app/theme-toggle';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";


export default function Home() {
  const [scenario, setScenario] = useState<ScenarioData>({
    numStations: 6,
    helicopterCapacity: 4,
    helicopterMaxWeight: 500,
    transportItems: [],
    weatherConditions: '',
    operationalNotes: '',
  });

  const [generatedPlans, setGeneratedPlans] = useState<FlightPlan[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeView, setActiveView] = useState('plans'); // 'plans' or 'map'
  const [selectedPlan, setSelectedPlan] = useState<FlightPlan | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const passengerPlans = useMemo(() => generatedPlans.filter(p => p.id.startsWith('pax')), [generatedPlans]);
  const cargoPlans = useMemo(() => generatedPlans.filter(p => p.id.startsWith('cargo')), [generatedPlans]);

  const handleGeneratePlans = () => {
    if (scenario.transportItems.length === 0) {
        toast({
            variant: 'destructive',
            title: 'No hay ítems',
            description: `No hay pasajeros ni carga definidos en el escenario.`,
        });
        return;
    }
    setIsLoading(true);
    setGeneratedPlans([]);
    setSelectedPlan(null);

    setTimeout(() => {
      try {
        setGeneratedPlans([
            { id: 'pax_priority', title: 'Plan A: Prioridad', steps: [], metrics: { totalStops: 0, totalDistance: 0, itemsTransported: 0, totalWeight: 0, maxWeightRatio: 0 } },
            { id: 'pax_efficiency', title: 'Plan B: Eficiencia', steps: [], metrics: { totalStops: 0, totalDistance: 0, itemsTransported: 0, totalWeight: 0, maxWeightRatio: 0 } },
            { id: 'pax_segments', title: 'Plan C: Segmentos', steps: [], metrics: { totalStops: 0, totalDistance: 0, itemsTransported: 0, totalWeight: 0, maxWeightRatio: 0 } },
            { id: 'cargo_priority', title: 'Plan D: Prioridad', steps: [], metrics: { totalStops: 0, totalDistance: 0, itemsTransported: 0, totalWeight: 0, maxWeightRatio: 0 } },
            { id: 'cargo_efficiency', title: 'Plan E: Eficiencia', steps: [], metrics: { totalStops: 0, totalDistance: 0, itemsTransported: 0, totalWeight: 0, maxWeightRatio: 0 } },
            { id: 'cargo_segments', title: 'Plan F: Segmentos', steps: [], metrics: { totalStops: 0, totalDistance: 0, itemsTransported: 0, totalWeight: 0, maxWeightRatio: 0 } },
        ]);
        
        saveScenarioToHistory(scenario);
         toast({
            title: 'Éxito',
            description: 'Escenario listo. Selecciona un turno en cada tarjeta para ver los planes.',
          });
      } catch (error) {
        console.error("Error setting up plans:", error);
        toast({
          variant: 'destructive',
          title: 'Error de Configuración',
          description: error instanceof Error ? error.message : 'No se pudo preparar el escenario.',
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
        const helicopterMaxWeight = configData.find(row => row.Clave === 'helicopterMaxWeight')?.Valor;
        if (numStations === undefined || helicopterCapacity === undefined || helicopterMaxWeight === undefined) throw new Error("Formato de 'Configuracion' incorrecto. Faltan numStations, helicopterCapacity o helicopterMaxWeight.");

        const itemsSheet = workbook.Sheets['Items'];
        if (!itemsSheet) throw new Error("No se encontró la hoja 'Items'.");
        const itemsData = XLSX.utils.sheet_to_json<{ area: string; tipo: 'PAX' | 'CARGO'; turno: 'M' | 'T'; prioridad: number; origen: number; destino: number; peso?: number; descripcion?: string }>(itemsSheet);

        const transportItems: TransportItem[] = itemsData.map((item, index) => ({
          id: crypto.randomUUID(),
          area: item.area,
          type: item.tipo,
          shift: item.turno,
          priority: item.prioridad,
          originStation: item.origen,
          destinationStation: item.destino,
          weight: item.tipo === 'PAX' ? (item.peso ?? 80) : item.peso,
          description: item.descripcion || '',
        }));
        
        if (transportItems.some(p => !p.area || !p.type || !p.shift || p.priority === undefined || p.originStation === undefined || p.destinationStation === undefined || p.weight === undefined)) {
            throw new Error("La hoja 'Items' tiene filas con datos incompletos o incorrectos. Revisa que todas las columnas esten presentes (peso y descripcion son opcionales para PAX).");
        }

        setScenario({ 
            numStations, 
            helicopterCapacity, 
            helicopterMaxWeight,
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
              <SidebarTrigger />
              <h1 className='font-semibold text-lg'>OVH por sjaquer - Optimización de Rutas</h1>
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
            {!isLoading && generatedPlans.length === 0 && <WelcomeScreen isLoading={false} />}
            {!isLoading && generatedPlans.length > 0 && (
              <div className="flex flex-col gap-8">
                <div className="flex items-center justify-end">
                    <div className="flex items-center gap-2 rounded-md bg-muted p-1">
                      <Button variant={activeView === 'plans' ? 'secondary' : 'ghost'} size="sm" onClick={() => setActiveView('plans')} className="h-8">
                        <ListCollapse className="mr-2 h-4 w-4" />
                        Planes
                      </Button>
                      <Button variant={activeView === 'map' ? 'secondary' : 'ghost'} size="sm" onClick={() => setActiveView('map')} className="h-8" disabled={!selectedPlan || selectedPlan.steps.length === 0}>
                        <Map className="mr-2 h-4 w-4" />
                        Ruta
                      </Button>
                    </div>
                </div>
                {activeView === 'plans' ? (
                  <div className="space-y-8">
                    {passengerPlans.length > 0 && (
                      <div>
                        <h2 className="text-2xl font-bold tracking-tight mb-4 flex items-center gap-2"><Users /> Planes de Pasajeros (PAX)</h2>
                        <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
                          {passengerPlans.map((plan) => (
                            <FlightPlanCard key={plan.id} basePlan={plan} scenario={scenario} itemType="PAX" onPlanUpdate={(p) => {
                                 const currentPlans = [...generatedPlans];
                                 const index = currentPlans.findIndex(cp => cp.id === p.id);
                                 if (index !== -1) {
                                     currentPlans[index] = p;
                                     setGeneratedPlans(currentPlans);
                                 }
                                 if(selectedPlan?.id === p.id) setSelectedPlan(p);
                            }} onSelectPlan={(p) => setSelectedPlan(p)} isSelected={selectedPlan?.id === plan.id} />
                          ))}
                        </div>
                      </div>
                    )}
                     {cargoPlans.length > 0 && (
                      <div>
                        <h2 className="text-2xl font-bold tracking-tight mb-4 mt-8 flex items-center gap-2"><Package /> Planes de Carga</h2>
                         <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
                          {cargoPlans.map((plan) => (
                            <FlightPlanCard key={plan.id} basePlan={plan} scenario={scenario} itemType="CARGO" onPlanUpdate={(p) => {
                                 const currentPlans = [...generatedPlans];
                                 const index = currentPlans.findIndex(cp => cp.id === p.id);
                                 if (index !== -1) {
                                     currentPlans[index] = p;
                                     setGeneratedPlans(currentPlans);
                                 }
                                if(selectedPlan?.id === p.id) setSelectedPlan(p);
                            }} onSelectPlan={(p) => setSelectedPlan(p)} isSelected={selectedPlan?.id === plan.id}/>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : selectedPlan && (
                  <>
                    <div className='flex items-center gap-4'>
                      <span className='text-sm font-medium'>Visualizando:</span>
                       <Select value={selectedPlan.id} onValueChange={(planId) => {
                          const newSelectedPlan = generatedPlans.find(p => p.id === planId);
                          if(newSelectedPlan) setSelectedPlan(newSelectedPlan);
                        }}>
                          <SelectTrigger className="w-[280px]">
                            <SelectValue placeholder="Seleccionar un plan" />
                          </SelectTrigger>
                          <SelectContent>
                             {passengerPlans.filter(p => p.steps.length > 0).map((plan) => <SelectItem key={plan.id} value={plan.id}>{plan.title} (PAX)</SelectItem>)}
                             {cargoPlans.filter(p => p.steps.length > 0).map((plan) => <SelectItem key={plan.id} value={plan.id}>{plan.title} (Carga)</SelectItem>)}
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
                Define tu escenario, importa datos y haz clic en "Generar Plan de Vuelo" para comenzar.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
