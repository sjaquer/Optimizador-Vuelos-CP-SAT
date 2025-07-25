
'use client';

import { useState, useRef, useMemo, useEffect } from 'react';
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
import { Bot, Map, ListCollapse, Wind, Upload, CalendarDays, Milestone } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
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
import { StationLegend } from '@/components/app/station-legend';
import { FlightManifest } from '@/components/app/flight-manifest';
import { runFlightSimulation } from '@/lib/optimizer';
import { FlightItinerary } from '@/components/app/flight-itinerary';


export default function Home() {
  const [scenario, setScenario] = useState<ScenarioData>({
    numStations: 8,
    helicopterCapacity: 4,
    helicopterMaxWeight: 500,
    transportItems: [],
    weatherConditions: '',
    operationalNotes: '',
  });

  const [basePlans, setBasePlans] = useState<FlightPlan[]>([]);
  const [calculatedPlans, setCalculatedPlans] = useState<Record<string, FlightPlan>>({});

  const [isLoading, setIsLoading] = useState(false);
  const [activeView, setActiveView] = useState('plans'); // 'plans', 'map', or 'itinerary'
  const [activeShift, setActiveShift] = useState<'M' | 'T'>('M');
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [currentMapStep, setCurrentMapStep] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  
  const selectedPlan = useMemo(() => {
    if (!selectedPlanId) return null;
    return calculatedPlans[selectedPlanId] || null;
  }, [selectedPlanId, calculatedPlans]);

  const plansForActiveShift = useMemo(() => {
    return basePlans.map(p => {
        const shiftId = `${p.id}_${activeShift}`;
        return calculatedPlans[shiftId] || { ...p, id: shiftId, steps: [] }; // Return calculated if exists, else a template
    });
  }, [basePlans, calculatedPlans, activeShift]);
  

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
    setBasePlans([]);
    setCalculatedPlans({});
    setSelectedPlanId(null);
    setActiveView('plans');
    setActiveShift('M');

    // Timeout to allow UI to update to loading state
    setTimeout(() => {
      try {
        const initialPlans: FlightPlan[] = [
            { id: 'mixed_efficiency', title: 'Propuesta A: Eficiencia Mixta', description: 'Busca la ruta más corta para entregar todos los ítems (PAX y Carga), ideal para ahorrar combustible y tiempo total.', steps: [], metrics: { totalStops: 0, totalDistance: 0, itemsTransported: 0, totalWeight: 0, maxWeightRatio: 0 } },
            { id: 'pure_efficiency', title: 'Propuesta B: Eficiencia de Ruta Pura', description: 'Encuentra la ruta más corta posible, optimizando cada tramo sin priorizar tipo de carga. Puede resultar en más vuelos.', steps: [], metrics: { totalStops: 0, totalDistance: 0, itemsTransported: 0, totalWeight: 0, maxWeightRatio: 0 } },
            { id: 'pax_priority', title: 'Propuesta C: Prioridad PAX', description: 'Optimiza la ruta dando preferencia a los pasajeros, ideal para traslados urgentes de personal.', steps: [], metrics: { totalStops: 0, totalDistance: 0, itemsTransported: 0, totalWeight: 0, maxWeightRatio: 0 } },
            { id: 'cargo_priority', title: 'Propuesta D: Prioridad Carga', description: 'Busca la eficiencia dando preferencia a la entrega de la carga. Los pasajeros se transportan cuando no hay conflictos.', steps: [], metrics: { totalStops: 0, totalDistance: 0, itemsTransported: 0, totalWeight: 0, maxWeightRatio: 0 } },
        ];
        
        setBasePlans(initialPlans);

        const newCalculatedPlans: Record<string, FlightPlan> = {};
        const shifts: ('M' | 'T')[] = ['M', 'T'];

        for (const planTemplate of initialPlans) {
            for (const shift of shifts) {
                const itemsForShift = scenario.transportItems.filter(item => item.shift === shift);
                const calculated = runFlightSimulation(planTemplate, itemsForShift, scenario, shift);
                newCalculatedPlans[calculated.id] = calculated;
            }
        }
        
        setCalculatedPlans(newCalculatedPlans);
        saveScenarioToHistory(scenario);
        
        toast({
            title: 'Éxito',
            description: 'Planes para Mañana y Tarde calculados.',
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

        // --- Config Sheet Validation ---
        const configSheet = workbook.Sheets['Configuracion'];
        if (!configSheet) throw new Error("No se encontró la hoja 'Configuracion'.");
        const configJson = XLSX.utils.sheet_to_json<{ Clave: string; Valor: any }>(configSheet);
        
        const getConfigValue = (key: string) => {
            const row = configJson.find(r => r.Clave === key);
            if (row === undefined || row.Valor === undefined || row.Valor === '') throw new Error(`Falta el valor para '${key}' en la hoja 'Configuracion'.`);
            return row.Valor;
        };
        const numStations = getConfigValue('numStations');
        const helicopterCapacity = getConfigValue('helicopterCapacity');
        const helicopterMaxWeight = getConfigValue('helicopterMaxWeight');
        
        // --- Items Sheet Validation ---
        const itemsSheet = workbook.Sheets['Items'];
        if (!itemsSheet) throw new Error("No se encontró la hoja 'Items'.");
        const itemsJson = XLSX.utils.sheet_to_json<{ area: string; tipo: 'PAX' | 'CARGO'; turno: 'M' | 'T'; prioridad: number; cantidad?: number; origen: number; destino: number; peso?: number; descripcion?: string }>(itemsSheet, { defval: "" });

        const transportItems: TransportItem[] = itemsJson
            .filter(item => item.area && item.area.toString().trim() !== '') // Ignore empty rows
            .map((item, index) => {
            const rowIndex = index + 2; // +1 for header, +1 for 0-based index

            // General validations for required fields
            if (!item.area) throw new Error(`Error en la fila ${rowIndex} de 'Items': Falta el valor en la columna 'area'.`);
            if (!item.tipo) throw new Error(`Error en la fila ${rowIndex} de 'Items': Falta el valor en la columna 'tipo'.`);
            if (item.tipo !== 'PAX' && item.tipo !== 'CARGO') throw new Error(`Error en la fila ${rowIndex} de 'Items': El valor en 'tipo' debe ser 'PAX' o 'CARGO'.`);
            if (!item.turno) throw new Error(`Error en la fila ${rowIndex} de 'Items': Falta el valor en la columna 'turno'.`);
            if (item.turno !== 'M' && item.turno !== 'T') throw new Error(`Error en la fila ${rowIndex} de 'Items': El valor en 'turno' debe ser 'M' o 'T'.`);
            if (item.prioridad === undefined || item.prioridad.toString() === '') throw new Error(`Error en la fila ${rowIndex} de 'Items': Falta el valor en la columna 'prioridad'.`);
            if (item.origen === undefined || item.origen.toString() === '') throw new Error(`Error en la fila ${rowIndex} de 'Items': Falta el valor en la columna 'origen'.`);
            if (item.destino === undefined || item.destino.toString() === '') throw new Error(`Error en la fila ${rowIndex} de 'Items': Falta el valor en la columna 'destino'.`);
            
            // Type-specific validations
            if (item.tipo === 'CARGO' && (item.peso === undefined || item.peso.toString() === '' || Number(item.peso) <= 0)) {
                throw new Error(`Error en la fila ${rowIndex} de 'Items': La carga debe tener un 'peso' mayor a 0.`);
            }
            if (item.tipo === 'PAX' && (item.cantidad === undefined || item.cantidad.toString() === '' || Number(item.cantidad) <= 0)) {
                throw new Error(`Error en la fila ${rowIndex} de 'Items': PAX debe tener una 'cantidad' mayor a 0.`);
            }

            return {
              id: crypto.randomUUID(),
              area: item.area,
              type: item.tipo,
              shift: item.turno,
              priority: Number(item.prioridad),
              quantity: item.tipo === 'PAX' ? Number(item.cantidad) : 1,
              originStation: Number(item.origen),
              destinationStation: Number(item.destino),
              weight: item.tipo === 'PAX' ? 80 : Number(item.peso),
              description: item.descripcion || '',
            };
        });

        setScenario({ 
            numStations: Number(numStations), 
            helicopterCapacity: Number(helicopterCapacity), 
            helicopterMaxWeight: Number(helicopterMaxWeight),
            transportItems, 
            weatherConditions: '',
            operationalNotes: '',
        });
        toast({ title: 'Éxito', description: 'Datos del escenario importados correctamente.' });
      } catch (error) {
        console.error("Error al importar:", error);
        toast({ variant: 'destructive', title: 'Error de Importación', description: error instanceof Error ? error.message : 'No se pudo procesar el archivo Excel.', duration: 9000 });
      } finally {
        if(event.target) event.target.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handlePlanSelection = (planId: string) => {
    const plan = calculatedPlans[planId];
     if (plan && plan.steps.length > 0) {
      setSelectedPlanId(planId);
      setActiveView('map');
      setCurrentMapStep(0);
    } else {
      toast({
        variant: 'destructive',
        title: 'Plan no disponible',
        description: 'La ruta para este plan está vacía o no ha sido calculada.',
      });
    }
  }
  
  const handleShiftChange = (shift: 'M' | 'T') => {
    setActiveShift(shift);
    const currentBaseId = selectedPlanId?.split('_').slice(0, -1).join('_');

    if (activeView !== 'plans' && currentBaseId) {
        const newPlanId = `${currentBaseId}_${shift}`;
        if (calculatedPlans[newPlanId] && calculatedPlans[newPlanId].steps.length > 0) {
            setSelectedPlanId(newPlanId);
        } else {
             // Try to select the first available plan for the new shift
             const firstAvailablePlan = basePlans
                .map(p => `${p.id}_${shift}`)
                .find(id => calculatedPlans[id] && calculatedPlans[id].steps.length > 0);
            
            if (firstAvailablePlan) {
                setSelectedPlanId(firstAvailablePlan);
            } else {
                setSelectedPlanId(null);
                setActiveView('plans'); // No plans for this shift, go back to plans view
            }
        }
    } else {
        setSelectedPlanId(null);
        if (activeView !== 'plans') {
            setActiveView('plans');
        }
    }
  }

  const handleViewChange = (view: 'plans' | 'map' | 'itinerary') => {
    if (view !== 'plans' && !selectedPlanId) {
       const firstAvailablePlan = plansForActiveShift.find(p => p.steps.length > 0);
       if (firstAvailablePlan) {
         setSelectedPlanId(firstAvailablePlan.id);
         setActiveView(view);
       } else {
         toast({
            variant: 'destructive',
            title: 'No hay plan seleccionado',
            description: 'No hay planes con rutas para mostrar en esta vista.',
         })
       }
    } else {
      setActiveView(view);
    }
  }

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
            {!isLoading && basePlans.length === 0 && <WelcomeScreen isLoading={false} />}
            {!isLoading && basePlans.length > 0 && (
              <div className="flex flex-col gap-8">
                <div className="flex items-center justify-between">
                    <div className='flex items-center gap-2'>
                        <CalendarDays className='h-5 w-5 text-muted-foreground' />
                        <Select value={activeShift} onValueChange={(value) => handleShiftChange(value as 'M' | 'T')}>
                            <SelectTrigger className="w-[130px] h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="M">Turno Mañana</SelectItem>
                              <SelectItem value="T">Turno Tarde</SelectItem>
                            </SelectContent>
                          </Select>
                    </div>
                    <div className="flex items-center gap-2 rounded-md bg-muted p-1">
                      <Button variant={activeView === 'plans' ? 'secondary' : 'ghost'} size="sm" onClick={() => handleViewChange('plans')} className="h-8">
                        <ListCollapse className="mr-2 h-4 w-4" />
                        Planes
                      </Button>
                       <Button variant={activeView === 'itinerary' ? 'secondary' : 'ghost'} size="sm" onClick={() => handleViewChange('itinerary')} className="h-8" disabled={!selectedPlan || selectedPlan.steps.length === 0}>
                        <Milestone className="mr-2 h-4 w-4" />
                        Itinerario
                      </Button>
                      <Button variant={activeView === 'map' ? 'secondary' : 'ghost'} size="sm" onClick={() => handleViewChange('map')} className="h-8" disabled={!selectedPlan || selectedPlan.steps.length === 0}>
                        <Map className="mr-2 h-4 w-4" />
                        Ruta
                      </Button>
                    </div>
                </div>

                {activeView === 'plans' && (
                  <div className="space-y-8">
                    <div>
                      <h2 className="text-2xl font-bold tracking-tight mb-4 flex items-center gap-2"><Wind /> Propuestas de Vuelo - Turno {activeShift === 'M' ? 'Mañana' : 'Tarde'}</h2>
                      <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
                        {plansForActiveShift.map((plan) => (
                          <FlightPlanCard 
                            key={plan.id} 
                            plan={plan}
                            onSelectPlan={handlePlanSelection}
                            isSelected={selectedPlanId === plan.id}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                
                {activeView === 'itinerary' && selectedPlan && <FlightItinerary plan={selectedPlan} />}

                {activeView === 'map' && selectedPlan && (
                  <div className='grid grid-cols-1 xl:grid-cols-[300px_1fr_300px] gap-6 items-start'>
                     <StationLegend />
                     <RouteMap 
                        plan={selectedPlan} 
                        currentStep={currentMapStep}
                        onStepChange={setCurrentMapStep}
                    />
                    <div className='flex flex-col gap-6'>
                       <div className='flex items-center gap-4'>
                         <Select value={selectedPlan.id} onValueChange={(planId) => handlePlanSelection(planId)}>
                            <SelectTrigger className="w-auto flex-1">
                              <SelectValue placeholder="Seleccionar un plan" />
                            </SelectTrigger>
                            <SelectContent>
                               {Object.values(calculatedPlans).filter(p => p.steps.length > 0 && p.id.endsWith(activeShift)).map((p) => (
                                 <SelectItem key={p.id} value={p.id}>
                                  {p.title}
                                 </SelectItem>
                               ))}
                            </SelectContent>
                          </Select>
                      </div>
                      <FlightManifest plan={selectedPlan} currentStep={currentMapStep} />
                    </div>
                  </div>
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
