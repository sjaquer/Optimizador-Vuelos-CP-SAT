
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
import type { FlightPlan, TransportItem, ScenarioData, StationConfig } from '@/lib/types';
import { FlightPlanCard } from '@/components/app/flight-plan-card';
import { RouteMap } from '@/components/app/route-map';
import { Map, ListCollapse, Wind, Upload, Download, CalendarDays, Milestone, Plane, ShieldCheck, Users, Package, HelpCircle, User, ClipboardList, RefreshCw, Loader2 } from 'lucide-react';
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
import { runFlightOptimization } from '@/lib/optimizer';
import { FlightItinerary } from '@/components/app/flight-itinerary';
import { DEFAULT_STATIONS, buildNamesMap } from '@/lib/stations';


export default function Home() {
  const [scenario, setScenario] = useState<ScenarioData>({
    stations: DEFAULT_STATIONS,
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
    refuelConfig: {
      enabled: false,
      maxFlightDistance: 80,
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
  const [isTemplateDownloading, setIsTemplateDownloading] = useState(false);

  // Check session auth on mount
  useEffect(() => {
    setAuthenticated(isAuthenticated());
  }, []);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const backgroundObjectUrlRef = useRef<string | null>(null);
  const { toast } = useToast();
  const onboarding = useOnboarding();

  useEffect(() => {
    return () => {
      if (backgroundObjectUrlRef.current) {
        try { URL.revokeObjectURL(backgroundObjectUrlRef.current); } catch (e) { /* ignore */ }
        backgroundObjectUrlRef.current = null;
      }
    };
  }, []);

  const handleBackgroundFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Revoke previous blob URL if any
    if (backgroundObjectUrlRef.current) {
      try { URL.revokeObjectURL(backgroundObjectUrlRef.current); } catch (err) { /* ignore */ }
    }
    const url = URL.createObjectURL(file);
    backgroundObjectUrlRef.current = url;
    setScenario(prev => ({ ...prev, mapBackgroundUrl: url }));
    // clear the input so selecting same file again triggers change
    if (fileInputRef.current) fileInputRef.current.value = '';
    toast({ title: 'Imagen cargada', description: 'La imagen de fondo se ha establecido correctamente.' });
  };

  // Build namesMap from current scenario stations
  const namesMap = useMemo(() => buildNamesMap(scenario.stations), [scenario.stations]);
  
  const selectedPlan = useMemo(() => {
    if (!selectedPlanId) return null;
    return calculatedPlans[selectedPlanId] || null;
  }, [selectedPlanId, calculatedPlans]);

  const planForActiveShift = useMemo(() => {
    const shiftId = `optimized_${activeShift}`;
    return calculatedPlans[shiftId] || null;
  }, [calculatedPlans, activeShift]);

  const alternativePlans = useMemo(() => {
    return [1, 2]
      .map(v => calculatedPlans[`alt${v}_${activeShift}`])
      .filter(Boolean) as FlightPlan[];
  }, [calculatedPlans, activeShift]);

  const handleGeneratePlans = (latestScenario?: ScenarioData) => {
    const activeScenario = latestScenario || scenario;
    if (activeScenario.transportItems.length === 0) {
        toast({
            variant: 'destructive',
            title: 'No hay ítems',
            description: `No hay pasajeros ni carga definidos en el escenario.`,
        });
        return;
    }
    setIsLoading(true);
    setCalculatedPlans({});
    setSelectedPlanId(null);
    setActiveView('plans');
    setActiveShift('M');

    setTimeout(() => {
      try {
        const newCalculatedPlans: Record<string, FlightPlan> = {};
        const shifts: ('M' | 'T')[] = ['M', 'T'];

        for (const shift of shifts) {
            const itemsForShift = activeScenario.transportItems.filter(item => item.shift === shift);
            const calculated = runFlightOptimization(itemsForShift, activeScenario, shift, 0);
            newCalculatedPlans[calculated.id] = calculated;
            for (const v of [1, 2]) {
              const alt = runFlightOptimization(itemsForShift, activeScenario, shift, v);
              newCalculatedPlans[alt.id] = alt;
            }
        }
        
        setBasePlans([{ id: 'optimized', title: 'Plan Óptimo', steps: [], metrics: { totalStops: 0, totalDistance: 0, totalLegs: 0, itemsTransported: 0, itemsNotDelivered: 0, totalWeight: 0, maxWeightRatio: 0, avgLoadRatio: 0, totalFlights: 0, refuelStops: 0, impossibleItems: 0 } }]);
        setCalculatedPlans(newCalculatedPlans);
        
        const morningPlan = newCalculatedPlans['optimized_M'];
        if (morningPlan && morningPlan.steps.length > 0) {
          setSelectedPlanId('optimized_M');
        }
        
        saveScenarioToHistory(activeScenario, newCalculatedPlans);
        
        toast({
            title: 'Éxito',
            description: 'Planes optimizados para Mañana y Tarde calculados.',
          });
          
      } catch (error) {
        console.error("Error setting up plans:", error);
        toast({
          variant: 'destructive',
          title: 'Error de Optimización',
          description: error instanceof Error ? error.message : 'No se pudo calcular el plan operativo.',
        });
      } finally {
         setIsLoading(false);
      }
    }, 500);
  };

  // Station drag updates coordinates in km
  const handleStationDrag = (stationId: string, x: number, y: number) => {
    setScenario(prev => ({
      ...prev,
      stations: prev.stations.map(s => s.id === stationId ? { ...s, x, y } : s),
    }));
  };

  // Full stations CRUD from StationManager
  const handleStationsChange = (newStations: StationConfig[]) => {
    setScenario(prev => ({ ...prev, stations: newStations }));
  };
  
  const handleDownloadTemplate = async () => {
    try {
      setIsTemplateDownloading(true);
      await downloadTemplate();
      toast({
        title: 'Plantilla descargada',
        description: 'Se generó el archivo Excel con el formato actualizado.',
      });
    } catch (error) {
      console.error('Error al descargar plantilla:', error);
      toast({
        variant: 'destructive',
        title: 'No se pudo descargar la plantilla',
        description: error instanceof Error ? error.message : 'Inténtalo de nuevo en unos segundos.',
      });
    } finally {
      setIsTemplateDownloading(false);
    }
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

        const getConfigValueOptional = (key: string) => {
          const row = configJson.find(r => r.Clave === key);
          return row?.Valor;
        };
        const getConfigValue = (key: string) => {
          const val = getConfigValueOptional(key);
          if (val === undefined || val === '') throw new Error(`Falta el valor para '${key}' en la hoja 'Configuracion'.`);
          return val;
        };

        const helicopterCapacity = getConfigValue('helicopterCapacity');
        const helicopterMaxWeight = getConfigValue('helicopterMaxWeight');
        const refuelEnabledRaw = getConfigValueOptional('refuelEnabled');
        const refuelEnabled = refuelEnabledRaw === true || String(refuelEnabledRaw).toUpperCase() === 'TRUE';
        const refuelMaxDist = Number(getConfigValueOptional('refuelMaxFlightDistance') ?? 80);

        // Build station lookup by name (for Excel compatibility)
        const stationsByName: Record<string, string> = {};
        for (const s of scenario.stations) {
          stationsByName[s.name.toLowerCase().trim()] = s.id;
          stationsByName[s.id] = s.id; // also allow slug directly
        }
        // Also allow numeric IDs for backward compat (map number → slug by index)
        const stationsByIndex: Record<number, string> = {};
        scenario.stations.forEach((s, i) => { stationsByIndex[i] = s.id; });
        // Special case: 0 = base
        const baseId = scenario.stations.find(s => s.isBase)?.id ?? scenario.stations[0]?.id ?? '';

        const resolveStation = (raw: any, rowIndex: number, col: string): string => {
          if (raw === undefined || raw === null || raw === '') throw new Error(`Falta el valor en la columna '${col}' en la fila ${rowIndex}.`);
          const rawStr = String(raw).trim();
          // Try by name
          if (stationsByName[rawStr.toLowerCase()]) return stationsByName[rawStr.toLowerCase()];
          // Try by numeric index (backward compat)
          const num = Number(rawStr);
          if (!isNaN(num)) {
            if (num === 0) return baseId;
            if (stationsByIndex[num]) return stationsByIndex[num];
          }
          throw new Error(`Estación '${rawStr}' en la columna '${col}' (fila ${rowIndex}) no existe. Verifica los nombres en la hoja 'Configuracion'.`);
        };

        // --- Items Sheet Validation ---
        const itemsSheet = workbook.getWorksheet('Items');
        if (!itemsSheet) throw new Error("No se encontró la hoja 'Items'.");
        const itemsJson = sheetToJson(itemsSheet) as any[];

        const transportItems: TransportItem[] = itemsJson
            .filter(item => item.area && item.area.toString().trim() !== '')
            .map((item, index) => {
            const rowIndex = index + 2;

            if (!item.area) throw new Error(`Fila ${rowIndex}: Falta 'area'.`);
            if (!item.tipo) throw new Error(`Fila ${rowIndex}: Falta 'tipo'.`);
            if (item.tipo !== 'PAX' && item.tipo !== 'CARGO') throw new Error(`Fila ${rowIndex}: 'tipo' debe ser PAX o CARGO.`);
            if (!item.turno) throw new Error(`Fila ${rowIndex}: Falta 'turno'.`);
            if (item.turno !== 'M' && item.turno !== 'T') throw new Error(`Fila ${rowIndex}: 'turno' debe ser M o T.`);
            const rawPrio = item.prioridad !== undefined ? String(item.prioridad).trim().toUpperCase() : 'MEDIA';
            let parsedPriority: 'ALTA' | 'MEDIA' | 'BAJA';
            if (rawPrio === 'ALTA' || rawPrio === '1' || rawPrio === 'P1') parsedPriority = 'ALTA';
            else if (rawPrio === 'BAJA' || rawPrio === '3' || rawPrio === 'P3') parsedPriority = 'BAJA';
            else parsedPriority = 'MEDIA';

            const originSlug = resolveStation(item.origen, rowIndex, 'origen');
            const destSlug = resolveStation(item.destino, rowIndex, 'destino');

            if (item.tipo === 'CARGO' && (item.peso === undefined || item.peso.toString() === '' || Number(item.peso) <= 0)) {
                throw new Error(`Fila ${rowIndex}: CARGO debe tener un 'peso' mayor a 0.`);
            }
            if (item.tipo === 'PAX' && (item.cantidad === undefined || item.cantidad.toString() === '' || Number(item.cantidad) <= 0)) {
                throw new Error(`Fila ${rowIndex}: PAX debe tener una 'cantidad' mayor a 0.`);
            }

            return {
              id: crypto.randomUUID(),
              area: item.area,
              type: item.tipo,
              shift: item.turno,
              priority: parsedPriority,
              quantity: item.tipo === 'PAX' ? Number(item.cantidad) : 1,
              originStation: originSlug,
              destinationStation: destSlug,
              weight: item.tipo === 'PAX' ? (scenario.paxDefaultWeight || 80) : Number(item.peso),
              description: item.descripcion || '',
            };
        });

        setScenario(prev => ({ 
          ...prev,
          helicopterCapacity: Number(helicopterCapacity),
          helicopterMaxWeight: Number(helicopterMaxWeight),
          paxDefaultWeight: prev.paxDefaultWeight || 80,
          transportItems, 
          weatherConditions: '',
          operationalNotes: '',
          missionDetails: {},
          refuelConfig: { enabled: refuelEnabled, maxFlightDistance: refuelMaxDist },
        }));
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
    if (selectedPlanId) {
      const base = selectedPlanId.replace(/_[MT]$/, '');
      const newPlanId = `${base}_${shift}`;
      if (calculatedPlans[newPlanId] && calculatedPlans[newPlanId].steps.length > 0) {
        setSelectedPlanId(newPlanId);
        return;
      }
    }
    const defaultId = `optimized_${shift}`;
    if (calculatedPlans[defaultId] && calculatedPlans[defaultId].steps.length > 0) {
      setSelectedPlanId(defaultId);
    } else {
      setSelectedPlanId(null);
      if (activeView !== 'plans') setActiveView('plans');
    }
  }

  const handleViewChange = (view: 'plans' | 'map' | 'itinerary') => {
    if (view !== 'plans' && !selectedPlanId) {
       if (planForActiveShift && planForActiveShift.steps.length > 0) {
         setSelectedPlanId(planForActiveShift.id);
         setActiveView(view);
       } else {
         toast({
            variant: 'destructive',
            title: 'No hay plan disponible',
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
          <header className="flex h-14 sm:h-16 items-center justify-between border-b bg-card px-3 sm:px-5 shadow-sm">
             <div className="flex items-center gap-2 sm:gap-3">
              <SidebarTrigger className="text-muted-foreground hover:text-foreground h-9 w-9 sm:h-10 sm:w-10" />
              <div className="flex items-center gap-2">
                <Plane className="h-5 w-5 text-primary" />
                <h1 className='font-bold text-sm sm:text-base tracking-tight'>Logística Aérea</h1>
              </div>
            </div>
            <div className='flex items-center gap-1 sm:gap-2'>
              <WeatherAlert />
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDownloadTemplate}
                disabled={isTemplateDownloading}
                className="group text-xs sm:text-sm h-9 sm:h-10 px-2 sm:px-3 text-muted-foreground hover:text-foreground border border-transparent hover:border-primary/15 hover:bg-primary/5 transition-all"
                aria-busy={isTemplateDownloading}
              >
                  {isTemplateDownloading ? <Loader2 className="h-4 w-4 sm:mr-1.5 animate-spin text-primary" /> : <Download className="h-4 w-4 sm:mr-1.5 group-hover:text-primary transition-colors" />}
                  <span className="hidden sm:inline">{isTemplateDownloading ? 'Generando...' : 'Plantilla'}</span>
              </Button>
              <Button variant="ghost" size="sm" onClick={handleImportClick} className="text-xs sm:text-sm h-9 sm:h-10 px-2 sm:px-3 text-muted-foreground hover:text-foreground">
                  <Upload className="h-4 w-4 sm:mr-1.5" />
                  <span className="hidden sm:inline">Importar</span>
              </Button>
              <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".xlsx, .xls" className="hidden" />
              <div className="hidden sm:block h-6 w-px bg-border"></div>
              <Button variant="ghost" size="icon" onClick={onboarding.restart} className="h-9 w-9 sm:h-10 sm:w-10 text-muted-foreground hover:text-primary" title="Ayuda">
                <HelpCircle className="h-5 w-5" />
              </Button>
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 text-card-foreground overflow-auto p-3 sm:p-5 md:p-8">
            {isLoading && <WelcomeScreen isLoading={true} />}
            {!isLoading && basePlans.length === 0 && <WelcomeScreen isLoading={false} />}
            {!isLoading && basePlans.length > 0 && (
              <div className="flex flex-col gap-6">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 bg-card p-2 rounded-lg border shadow-sm">
                    <div className='flex items-center gap-2 px-1 sm:px-2'>
                        <CalendarDays className='h-4 w-4 text-primary shrink-0' />
                        <Select value={activeShift} onValueChange={(value) => handleShiftChange(value as 'M' | 'T')}>
                            <SelectTrigger className="w-full sm:w-[160px] h-9 sm:h-10 text-sm font-semibold border-none shadow-none focus:ring-0 bg-transparent hover:bg-muted/50 transition-colors">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="M">☀ Turno Mañana</SelectItem>
                              <SelectItem value="T">🌙 Turno Tarde</SelectItem>
                            </SelectContent>
                          </Select>
                    </div>
                    <div className="flex items-center gap-1 rounded-md bg-muted/50 p-1">
                      <Button variant={activeView === 'plans' ? 'default' : 'ghost'} size="sm" onClick={() => handleViewChange('plans')} className="flex-1 sm:flex-none h-9 sm:h-10 px-3 sm:px-4 text-xs sm:text-sm">
                        <ListCollapse className="mr-1 sm:mr-1.5 h-4 w-4" />
                        Resumen
                      </Button>
                       <Button variant={activeView === 'itinerary' ? 'default' : 'ghost'} size="sm" onClick={() => handleViewChange('itinerary')} className="flex-1 sm:flex-none h-9 sm:h-10 px-3 sm:px-4 text-xs sm:text-sm" disabled={!selectedPlan || selectedPlan.steps.length === 0}>
                        <Milestone className="mr-1 sm:mr-1.5 h-4 w-4" />
                        Tabla
                      </Button>
                      <Button variant={activeView === 'map' ? 'default' : 'ghost'} size="sm" onClick={() => handleViewChange('map')} className="flex-1 sm:flex-none h-9 sm:h-10 px-3 sm:px-4 text-xs sm:text-sm" disabled={!selectedPlan || selectedPlan.steps.length === 0}>
                        <Map className="mr-1 sm:mr-1.5 h-4 w-4" />
                        Mapa
                      </Button>
                    </div>
                </div>

                {activeView === 'plans' && (
                  <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                      {/* Compact mission briefing */}
                      {scenario.missionDetails && (scenario.missionDetails.pilotInCommand || scenario.missionDetails.aircraftCallsign || scenario.missionDetails.missionObjective) && (
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs sm:text-sm text-muted-foreground mb-4 sm:mb-5 px-1">
                            {scenario.missionDetails.aircraftCallsign && (
                              <span><Plane className="inline h-4 w-4 mr-1.5 text-primary" /><strong className="text-foreground font-mono">{scenario.missionDetails.aircraftCallsign}</strong></span>
                            )}
                            {scenario.missionDetails.pilotInCommand && (
                              <span>PIC: <strong className="text-foreground">{scenario.missionDetails.pilotInCommand}</strong>{scenario.missionDetails.copilot && <> / SIC: <strong className="text-foreground">{scenario.missionDetails.copilot}</strong></>}</span>
                            )}
                            {scenario.missionDetails.missionObjective && (
                              <span className="truncate max-w-sm">{scenario.missionDetails.missionObjective}</span>
                            )}
                            {scenario.missionDetails.authorization && (
                              <span className="font-mono text-xs bg-muted px-2 py-1 rounded border ml-auto">{scenario.missionDetails.authorization}</span>
                            )}
                            {scenario.weatherConditions && (
                              <span><Wind className="inline h-4 w-4 mr-1.5 text-blue-500" />{scenario.weatherConditions}</span>
                            )}
                            {scenario.operationalNotes && (
                              <span className="text-amber-600 dark:text-amber-400"><ShieldCheck className="inline h-4 w-4 mr-1.5" />{scenario.operationalNotes}</span>
                            )}
                        </div>
                      )}

                      {/* Inline counters */}
                      <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs sm:text-sm text-muted-foreground mb-4 sm:mb-5 px-1">
                        <span className="flex items-center gap-1.5"><Users className="h-4 w-4 text-blue-500" /> {scenario.transportItems.filter(i => i.shift === activeShift && i.type === 'PAX').length} PAX</span>
                        <span className="flex items-center gap-1.5"><Package className="h-4 w-4 text-amber-500" /> {scenario.transportItems.filter(i => i.shift === activeShift && i.type === 'CARGO').length} Carga</span>
                        <span className="text-muted-foreground/50 hidden sm:inline">·</span>
                        <span className="hidden sm:inline">PAX/Carga separados · ALTA→MEDIA→BAJA</span>
                      </div>

                      <div className="max-w-7xl mx-auto px-0">
                        {planForActiveShift ? (
                          <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                              {/* Optimal Plan Card */}
                              <div className="flex flex-col h-full">
                                <div className="text-xs font-bold text-primary uppercase tracking-wider mb-2 px-1 text-center font-mono">
                                  Opción Óptima (A)
                                </div>
                                <FlightPlanCard 
                                  plan={planForActiveShift}
                                  onSelectPlan={handlePlanSelection}
                                  isSelected={selectedPlanId === planForActiveShift.id}
                                />
                              </div>

                              {/* Alternative 1 Card */}
                              {alternativePlans[0] && (
                                <div className="flex flex-col h-full animate-fade-up" style={{ animationDelay: '100ms' }}>
                                  <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 px-1 text-center font-mono">
                                    Alternativa B
                                  </div>
                                  <FlightPlanCard 
                                    plan={alternativePlans[0]}
                                    onSelectPlan={handlePlanSelection}
                                    isSelected={selectedPlanId === alternativePlans[0].id}
                                  />
                                </div>
                              )}

                              {/* Alternative 2 Card */}
                              {alternativePlans[1] && (
                                <div className="flex flex-col h-full animate-fade-up" style={{ animationDelay: '200ms' }}>
                                  <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 px-1 text-center font-mono">
                                    Alternativa C
                                  </div>
                                  <FlightPlanCard 
                                    plan={alternativePlans[1]}
                                    onSelectPlan={handlePlanSelection}
                                    isSelected={selectedPlanId === alternativePlans[1].id}
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-16 text-muted-foreground bg-muted/10 border rounded-xl">
                            <p className="text-base font-semibold">No hay plan calculado para este turno.</p>
                            <p className="text-xs mt-1">Modifica los requerimientos en el panel lateral y presiona "Calcular Plan Operativo".</p>
                          </div>
                        )}
                      </div>
                  </div>
                )}
                
                {activeView === 'itinerary' && selectedPlan && (
                  <FlightItinerary plan={selectedPlan} namesMap={namesMap} />
                )}

                {activeView === 'map' && selectedPlan && (
                  <div className='grid grid-cols-1 lg:grid-cols-[1fr_300px] xl:grid-cols-[250px_1fr_280px] gap-4 sm:gap-6 items-start'>
                     <div className="hidden xl:block">
                       <StationLegend stations={scenario.stations} />
                     </div>
                     <div className="col-span-1 lg:col-span-1">
                       <RouteMap 
                          plan={selectedPlan}
                          stations={scenario.stations}
                          currentStep={currentMapStep}
                          onStepChange={setCurrentMapStep}
                          mapBackgroundUrl={scenario.mapBackgroundUrl}
                          onStationDrag={handleStationDrag}
                          onBackgroundUpload={() => {
                            fileInputRef.current?.click();
                          }}
                      />
                      {/* Station legend below map on mobile/tablet */}
                      <div className="xl:hidden mt-4">
                        <StationLegend stations={scenario.stations} />
                      </div>
                     </div>
                    <div className='flex flex-col gap-4 sm:gap-6'>
                      <FlightManifest plan={selectedPlan} currentStep={currentMapStep} namesMap={namesMap} />
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
    <input
      ref={fileInputRef}
      type="file"
      accept="image/*"
      className="hidden"
      onChange={handleBackgroundFileChange}
    />
    </>
  );
}
