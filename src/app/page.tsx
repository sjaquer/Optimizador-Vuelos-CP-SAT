
'use client';

import { useState, useRef, useMemo, useEffect } from 'react';
import * as ExcelJS from 'exceljs';
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
import { Bot, Map, ListCollapse, Wind, Upload, CalendarDays, Milestone, Plane } from 'lucide-react';
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
import { PlanComparisonChart } from '@/components/app/plan-comparison-chart';


export default function Home() {
  const [scenario, setScenario] = useState<ScenarioData>({
    numStations: 8,
    helicopterCapacity: 4,
    helicopterMaxWeight: 500,
    paxDefaultWeight: 80,
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
            { id: 'mixed_efficiency', title: 'Propuesta A: Eficiencia Mixta', description: 'Permite mezclar PAX y carga en el mismo vuelo, priorizando estaciones con más items. Maximiza uso de capacidad.', steps: [], metrics: { totalStops: 0, totalDistance: 0, totalLegs: 0, itemsTransported: 0, itemsNotDelivered: 0, totalWeight: 0, maxWeightRatio: 0, avgLoadRatio: 0, totalFlights: 0 } },
            { id: 'pure_efficiency', title: 'Propuesta B: Ruta Más Corta', description: 'Optimiza la distancia total con mejora local 2-opt. No mezcla PAX y carga. Mejor distancia posible.', steps: [], metrics: { totalStops: 0, totalDistance: 0, totalLegs: 0, itemsTransported: 0, itemsNotDelivered: 0, totalWeight: 0, maxWeightRatio: 0, avgLoadRatio: 0, totalFlights: 0 } },
            { id: 'pax_priority', title: 'Propuesta C: Prioridad PAX', description: 'Entrega primero a todos los pasajeros; la carga se transporta después. Ideal para traslados urgentes de personal.', steps: [], metrics: { totalStops: 0, totalDistance: 0, totalLegs: 0, itemsTransported: 0, itemsNotDelivered: 0, totalWeight: 0, maxWeightRatio: 0, avgLoadRatio: 0, totalFlights: 0 } },
            { id: 'cargo_priority', title: 'Propuesta D: Prioridad Carga', description: 'Prioriza la entrega de carga pesada antes que PAX. Ideal cuando la carga es crítica para la operación.', steps: [], metrics: { totalStops: 0, totalDistance: 0, totalLegs: 0, itemsTransported: 0, itemsNotDelivered: 0, totalWeight: 0, maxWeightRatio: 0, avgLoadRatio: 0, totalFlights: 0 } },
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
    reader.onload = async (e) => {
      try {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(arrayBuffer);

        const sheetToJson = (worksheet: ExcelJS.Worksheet) => {
          const headerRow = worksheet.getRow(1);
          const maxCol = headerRow.cellCount || 0;
          const headers: string[] = [];
          for (let c = 1; c <= maxCol; c++) {
            const val = headerRow.getCell(c).value;
            headers.push(val === null || val === undefined ? '' : String(val));
          }
          const rows: any[] = [];
          worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
            if (rowNumber === 1) return;
            const obj: any = {};
            for (let c = 1; c <= maxCol; c++) {
              const key = headers[c - 1];
              if (!key) continue;
              const cell = row.getCell(c).value;
              obj[key] = cell && typeof cell === 'object' && 'text' in cell ? (cell as any).text : cell;
            }
            rows.push(obj);
          });
          return rows;
        };

        // --- Config Sheet Validation ---
        const configSheet = workbook.getWorksheet('Configuracion');
        if (!configSheet) throw new Error("No se encontró la hoja 'Configuracion'.");
        const configJson = sheetToJson(configSheet) as { Clave: string; Valor: any }[];

        const getConfigValue = (key: string) => {
            const row = configJson.find(r => r.Clave === key);
            if (row === undefined || row.Valor === undefined || row.Valor === '') throw new Error(`Falta el valor para '${key}' en la hoja 'Configuracion'.`);
            return row.Valor;
        };
        const numStations = getConfigValue('numStations');
        const helicopterCapacity = getConfigValue('helicopterCapacity');
        const helicopterMaxWeight = getConfigValue('helicopterMaxWeight');

        // --- Items Sheet Validation ---
        const itemsSheet = workbook.getWorksheet('Items');
        if (!itemsSheet) throw new Error("No se encontró la hoja 'Items'.");
        const itemsJson = sheetToJson(itemsSheet) as any[];

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
              weight: item.tipo === 'PAX' ? (scenario.paxDefaultWeight || 80) : Number(item.peso),
              description: item.descripcion || '',
            };
        });

        setScenario({ 
            numStations: Number(numStations), 
            helicopterCapacity: Number(helicopterCapacity), 
            helicopterMaxWeight: Number(helicopterMaxWeight),
            paxDefaultWeight: scenario.paxDefaultWeight || 80,
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
        <div className="flex h-full flex-col bg-background">
          <header className="flex h-16 items-center justify-between border-b bg-card px-6 shadow-sm">
             <div className="flex items-center gap-4">
              <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
              <div className="h-6 w-px bg-border mx-2"></div>
              <div className="flex items-center gap-2">
                <div className="bg-primary/10 p-1.5 rounded-md">
                  <Plane className="h-5 w-5 text-primary" />
                </div>
                <h1 className='font-bold text-lg tracking-tight'>Logística Aérea <span className="text-muted-foreground font-normal">| Panel de Optimización</span></h1>
              </div>
            </div>
            <div className='flex items-center gap-3'>
              <Button variant="outline" size="sm" onClick={handleImportClick} className="shadow-sm">
                  <Upload className="mr-2 h-4 w-4" />
                  Importar Excel
              </Button>
              <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".xlsx, .xls" className="hidden" />
              <div className="h-6 w-px bg-border mx-1"></div>
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 text-card-foreground overflow-auto p-4 md:p-8">
            {isLoading && <WelcomeScreen isLoading={true} />}
            {!isLoading && basePlans.length === 0 && <WelcomeScreen isLoading={false} />}
            {!isLoading && basePlans.length > 0 && (
              <div className="flex flex-col gap-8">
                <div className="flex items-center justify-between bg-card p-2 rounded-lg border shadow-sm">
                    <div className='flex items-center gap-3 px-3'>
                        <div className="bg-muted p-2 rounded-md">
                          <CalendarDays className='h-4 w-4 text-primary' />
                        </div>
                        <span className="text-sm font-medium text-muted-foreground">Jornada:</span>
                        <Select value={activeShift} onValueChange={(value) => handleShiftChange(value as 'M' | 'T')}>
                            <SelectTrigger className="w-[160px] h-9 font-semibold border-none shadow-none focus:ring-0 bg-transparent hover:bg-muted/50 transition-colors">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="M">Turno Mañana</SelectItem>
                              <SelectItem value="T">Turno Tarde</SelectItem>
                            </SelectContent>
                          </Select>
                    </div>
                    <div className="flex items-center gap-1 rounded-md bg-muted/50 p-1 border">
                      <Button variant={activeView === 'plans' ? 'default' : 'ghost'} size="sm" onClick={() => handleViewChange('plans')} className="h-9 px-4 transition-all">
                        <ListCollapse className="mr-2 h-4 w-4" />
                        Análisis de Rutas
                      </Button>
                       <Button variant={activeView === 'itinerary' ? 'default' : 'ghost'} size="sm" onClick={() => handleViewChange('itinerary')} className="h-9 px-4 transition-all" disabled={!selectedPlan || selectedPlan.steps.length === 0}>
                        <Milestone className="mr-2 h-4 w-4" />
                        Desglose en Tabla
                      </Button>
                      <Button variant={activeView === 'map' ? 'default' : 'ghost'} size="sm" onClick={() => handleViewChange('map')} className="h-9 px-4 transition-all" disabled={!selectedPlan || selectedPlan.steps.length === 0}>
                        <Map className="mr-2 h-4 w-4" />
                        Visor Satelital
                      </Button>
                    </div>
                </div>

                {activeView === 'plans' && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div>
                      <h2 className="text-xl font-bold tracking-tight mb-6 flex items-center gap-2 text-foreground">
                        <Wind className="text-primary h-5 w-5" /> 
                        Estrategias de Vuelo Calculadas
                        <span className="ml-2 text-sm font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full border">
                          Turno {activeShift === 'M' ? 'Mañana' : 'Tarde'}
                        </span>
                      </h2>
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
                    <PlanComparisonChart plans={plansForActiveShift} />
                  </div>
                )}
                
                {activeView === 'itinerary' && selectedPlan && <FlightItinerary plan={selectedPlan} />}

                {activeView === 'map' && selectedPlan && (
                  <div className='grid grid-cols-1 xl:grid-cols-[300px_1fr_300px] gap-6 items-start'>
                     <StationLegend numStations={scenario.numStations} />
                     <RouteMap 
                        plan={selectedPlan}
                        numStations={scenario.numStations}
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
    <div className="flex h-full items-center justify-center p-4">
      <Card className="w-full max-w-2xl border-dashed shadow-sm">
        <CardContent className="p-12">
          {isLoading ? (
            <div className="flex flex-col items-center gap-6 animate-in fade-in duration-500">
              <div className="relative flex items-center justify-center h-24 w-24 bg-primary/5 rounded-full">
                <Wind className="absolute inset-0 m-auto h-12 w-12 animate-spin text-primary/40" style={{ animationDuration: '4s' }} />
                <Plane className="absolute inset-0 m-auto h-8 w-8 text-primary animate-pulse" />
              </div>
              <div className="space-y-2 text-center">
                <h3 className="text-2xl font-bold tracking-tight">Procesando Escenario...</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  El motor de optimización heurística está calculando las mejores combinaciones de rutas 
                  y carga para las estaciones activas.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-6 animate-in fade-in duration-500">
              <div className="h-20 w-20 bg-muted/50 rounded-2xl flex items-center justify-center border shadow-sm">
                <Bot className="h-10 w-10 text-primary" />
              </div>
              <div className="space-y-3 text-center">
                <h3 className="text-2xl font-bold tracking-tight">Motor de Planificación Heurística</h3>
                <p className="text-muted-foreground max-w-md mx-auto leading-relaxed">
                  Sistema avanzado de enrutamiento para logística aérea. Define los parámetros del helicóptero 
                  y carga tu archivo <strong className="font-medium text-foreground">Excel</strong> con los requerimientos operativos para comenzar el análisis.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
