
'use client';

import { useState, useRef, useMemo, useEffect } from 'react';
import { LoginScreen, isAuthenticated } from '@/components/app/login-screen';
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
import { Map, ListCollapse, Wind, Upload, Download, CalendarDays, Milestone, Plane, ShieldCheck, Users, Package, HelpCircle, User, ClipboardList } from 'lucide-react';
import { OnboardingTour, OnboardingPrompt, useOnboarding } from '@/components/app/onboarding-tour';
import { useToast } from '@/hooks/use-toast';
import { saveScenarioToHistory } from '@/lib/history';
import { ThemeToggle } from '@/components/app/theme-toggle';
import { WeatherAlert } from '@/components/app/weather-alert';
import { WelcomeScreen } from '@/components/app/welcome-screen';
import { downloadTemplate } from '@/lib/download-template';
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
    missionDetails: {
      pilotInCommand: '',
      copilot: '',
      aircraftCallsign: '',
      missionObjective: '',
      authorization: '',
      clientOrProject: '',
      missionNotes: '',
    },
  });

  const [basePlans, setBasePlans] = useState<FlightPlan[]>([]);
  const [calculatedPlans, setCalculatedPlans] = useState<Record<string, FlightPlan>>({});

  const [isLoading, setIsLoading] = useState(false);
  const [activeView, setActiveView] = useState('plans'); // 'plans', 'map', or 'itinerary'
  const [activeShift, setActiveShift] = useState<'M' | 'T'>('M');
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [currentMapStep, setCurrentMapStep] = useState(0);
  const [authenticated, setAuthenticated] = useState(false);

  // Check session auth on mount
  useEffect(() => {
    setAuthenticated(isAuthenticated());
  }, []);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const onboarding = useOnboarding();
  
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
            { id: 'strict_priority', title: 'Plan A: Prioridad Estricta', description: 'Atiende primero los requerimientos de mayor prioridad (P1 antes que P2, etc.). PAX y CARGO van en vuelos separados. El tipo con el ítem más urgente vuela primero.', steps: [], metrics: { totalStops: 0, totalDistance: 0, totalLegs: 0, itemsTransported: 0, itemsNotDelivered: 0, totalWeight: 0, maxWeightRatio: 0, avgLoadRatio: 0, totalFlights: 0 } },
            { id: 'shortest_route', title: 'Plan B: Ruta Más Corta', description: 'Minimiza la distancia total con optimización 2-opt. Recoge en la estación más cercana y entrega en ruta. Vuelos exclusivos PAX o CARGO.', steps: [], metrics: { totalStops: 0, totalDistance: 0, totalLegs: 0, itemsTransported: 0, itemsNotDelivered: 0, totalWeight: 0, maxWeightRatio: 0, avgLoadRatio: 0, totalFlights: 0 } },
            { id: 'max_load', title: 'Plan C: Máxima Carga', description: 'Maximiza la ocupación en cada vuelo para reducir el número total de viajes. Prioriza estaciones con más ítems por recoger. Separa PAX de CARGO.', steps: [], metrics: { totalStops: 0, totalDistance: 0, totalLegs: 0, itemsTransported: 0, itemsNotDelivered: 0, totalWeight: 0, maxWeightRatio: 0, avgLoadRatio: 0, totalFlights: 0 } },
            { id: 'balanced', title: 'Plan D: Balanceado', description: 'Equilibra prioridad y eficiencia de ruta. Combina puntaje de urgencia con distancia para elegir la siguiente estación. Vuelos exclusivos por tipo.', steps: [], metrics: { totalStops: 0, totalDistance: 0, totalLegs: 0, itemsTransported: 0, itemsNotDelivered: 0, totalWeight: 0, maxWeightRatio: 0, avgLoadRatio: 0, totalFlights: 0 } },
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
        saveScenarioToHistory(scenario, newCalculatedPlans);
        
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
  
  const handleDownloadTemplate = () => downloadTemplate();

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
        const ExcelJS = await import('exceljs');
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(arrayBuffer);

        const sheetToJson = (worksheet: import('exceljs').Worksheet) => {
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
            missionDetails: {},
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

  // Show login screen until authenticated
  if (!authenticated) {
    return <LoginScreen onSuccess={() => setAuthenticated(true)} />;
  }

  return (
    <>
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
              <WeatherAlert />
              <div className="h-6 w-px bg-border"></div>
              <Button variant="outline" size="sm" onClick={handleDownloadTemplate} className="shadow-sm">
                  <Download className="mr-2 h-4 w-4" />
                  Plantilla
              </Button>
              <Button variant="outline" size="sm" onClick={handleImportClick} className="shadow-sm">
                  <Upload className="mr-2 h-4 w-4" />
                  Importar Excel
              </Button>
              <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".xlsx, .xls" className="hidden" />
              <div className="h-6 w-px bg-border mx-1"></div>
              <Button variant="ghost" size="icon" onClick={onboarding.restart} className="h-9 w-9 text-muted-foreground hover:text-primary" title="Recorrido de ayuda">
                <HelpCircle className="h-5 w-5" />
              </Button>
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
                      <h2 className="text-xl font-bold tracking-tight mb-4 flex items-center gap-2 text-foreground">
                        <Wind className="text-primary h-5 w-5" /> 
                        Estrategias de Vuelo Calculadas
                        <span className="ml-2 text-sm font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full border">
                          Turno {activeShift === 'M' ? 'Mañana' : 'Tarde'}
                        </span>
                      </h2>

                      {/* Mission briefing bar */}
                      {scenario.missionDetails && (scenario.missionDetails.pilotInCommand || scenario.missionDetails.aircraftCallsign || scenario.missionDetails.missionObjective) && (
                        <div className="bg-card border rounded-lg p-3 mb-4 shadow-sm">
                          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
                            {scenario.missionDetails.aircraftCallsign && (
                              <div className="flex items-center gap-1.5">
                                <Plane className="h-3.5 w-3.5 text-primary" />
                                <span className="text-muted-foreground">Aeronave:</span>
                                <span className="font-mono font-bold">{scenario.missionDetails.aircraftCallsign}</span>
                              </div>
                            )}
                            {scenario.missionDetails.pilotInCommand && (
                              <div className="flex items-center gap-1.5">
                                <User className="h-3.5 w-3.5 text-emerald-500" />
                                <span className="text-muted-foreground">PIC:</span>
                                <span className="font-semibold">{scenario.missionDetails.pilotInCommand}</span>
                                {scenario.missionDetails.copilot && (
                                  <span className="text-muted-foreground">/ SIC: <span className="font-semibold text-foreground">{scenario.missionDetails.copilot}</span></span>
                                )}
                              </div>
                            )}
                            {scenario.missionDetails.missionObjective && (
                              <div className="flex items-center gap-1.5">
                                <ClipboardList className="h-3.5 w-3.5 text-amber-500" />
                                <span className="text-muted-foreground">Misión:</span>
                                <span className="font-semibold">{scenario.missionDetails.missionObjective}</span>
                              </div>
                            )}
                            {scenario.missionDetails.authorization && (
                              <div className="flex items-center gap-1.5 ml-auto">
                                <span className="font-mono text-[10px] bg-muted px-2 py-0.5 rounded border">{scenario.missionDetails.authorization}</span>
                              </div>
                            )}
                          </div>
                          {(scenario.weatherConditions || scenario.operationalNotes) && (
                            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-[11px] mt-2 pt-2 border-t border-dashed">
                              {scenario.weatherConditions && (
                                <div className="flex items-center gap-1.5 text-muted-foreground">
                                  <Wind className="h-3 w-3 text-blue-500" />
                                  {scenario.weatherConditions}
                                </div>
                              )}
                              {scenario.operationalNotes && (
                                <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                                  <ShieldCheck className="h-3 w-3" />
                                  {scenario.operationalNotes}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex items-center gap-4 text-xs bg-muted/50 border rounded-lg p-3 mb-6">
                        <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
                        <span className="text-muted-foreground">
                          <strong className="text-foreground">Reglas activas:</strong> Pasajeros y Carga viajan en vuelos 100% separados.
                          Turnos Mañana/Tarde no se mezclan. Prioridad 1 = más urgente.
                        </span>
                        <div className="flex items-center gap-3 ml-auto shrink-0">
                          <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5 text-blue-500" /> PAX: {scenario.transportItems.filter(i => i.shift === activeShift && i.type === 'PAX').length}</span>
                          <span className="flex items-center gap-1"><Package className="h-3.5 w-3.5 text-amber-500" /> Carga: {scenario.transportItems.filter(i => i.shift === activeShift && i.type === 'CARGO').length}</span>
                        </div>
                      </div>
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

    {/* Onboarding flow */}
    {onboarding.phase === 'prompt' && (
      <OnboardingPrompt onAccept={onboarding.accept} onDecline={onboarding.decline} />
    )}
    {onboarding.phase === 'tour' && (
      <OnboardingTour onComplete={onboarding.complete} />
    )}
    </>
  );
}
