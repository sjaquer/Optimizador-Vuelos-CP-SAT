
'use client';

import { useState, useRef, useMemo } from 'react';
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
import { Bot, Map, ListCollapse, Wind, Upload, Download, CalendarDays, Milestone, Plane, ShieldCheck, Users, Package } from 'lucide-react';
import { ALL_STATIONS } from '@/lib/stations';
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
  
  const handleDownloadTemplate = async () => {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Optimizador de Vuelos';
    wb.created = new Date();

    const BRAND = '1F3A6E'; // dark blue
    const BRAND_LIGHT = 'E8EDF5';
    const HEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + BRAND } };
    const HEADER_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11, name: 'Calibri' };
    const NOTE_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF9E6' } };
    const NOTE_FONT: Partial<ExcelJS.Font> = { italic: true, color: { argb: 'FF8B7000' }, size: 10, name: 'Calibri' };
    const CELL_BORDER: Partial<ExcelJS.Borders> = {
      top: { style: 'thin', color: { argb: 'FFD0D5DD' } },
      bottom: { style: 'thin', color: { argb: 'FFD0D5DD' } },
      left: { style: 'thin', color: { argb: 'FFD0D5DD' } },
      right: { style: 'thin', color: { argb: 'FFD0D5DD' } },
    };
    const ALT_ROW: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + BRAND_LIGHT } };

    // ── HOJA 1: Configuración ──
    const wsConfig = wb.addWorksheet('Configuracion', { properties: { tabColor: { argb: 'FF' + BRAND } } });
    wsConfig.columns = [
      { header: 'Clave', key: 'Clave', width: 28 },
      { header: 'Valor', key: 'Valor', width: 18 },
      { header: 'Descripción', key: 'Descripcion', width: 52 },
    ];
    // Header styling
    const cfgHeader = wsConfig.getRow(1);
    cfgHeader.eachCell(c => { c.fill = HEADER_FILL; c.font = HEADER_FONT; c.border = CELL_BORDER; c.alignment = { vertical: 'middle' }; });
    cfgHeader.height = 28;

    const cfgData = [
      { Clave: 'numStations', Valor: 8, Descripcion: 'Número de estaciones activas (sin contar la Base). Máx: ' + (ALL_STATIONS.length - 1) },
      { Clave: 'helicopterCapacity', Valor: 4, Descripcion: 'Asientos disponibles en el helicóptero (sin contar tripulación)' },
      { Clave: 'helicopterMaxWeight', Valor: 500, Descripcion: 'Peso máximo de carga útil en kilogramos' },
    ];
    cfgData.forEach((row, i) => {
      const r = wsConfig.addRow(row);
      r.eachCell(c => { c.border = CELL_BORDER; c.alignment = { vertical: 'middle', wrapText: true }; });
      if (i % 2 === 1) r.eachCell(c => { c.fill = ALT_ROW; });
    });

    // Nota instructiva
    const cfgNote = wsConfig.addRow({ Clave: '', Valor: '', Descripcion: '' });
    wsConfig.mergeCells(`A${cfgNote.number}:C${cfgNote.number}`);
    const cfgNoteCell = wsConfig.getCell(`A${cfgNote.number}`);
    cfgNoteCell.value = '⚠ No cambiar los valores de la columna "Clave". Solo modificar la columna "Valor".';
    cfgNoteCell.fill = NOTE_FILL;
    cfgNoteCell.font = NOTE_FONT;
    cfgNoteCell.border = CELL_BORDER;

    // Estaciones reference
    wsConfig.addRow({});
    const stTitle = wsConfig.addRow({ Clave: 'REFERENCIA DE ESTACIONES' });
    wsConfig.mergeCells(`A${stTitle.number}:C${stTitle.number}`);
    stTitle.getCell(1).font = { bold: true, size: 11, color: { argb: 'FF' + BRAND } };

    const stHeader = wsConfig.addRow({ Clave: 'ID', Valor: 'Nombre de Estación' });
    stHeader.eachCell(c => { c.fill = HEADER_FILL; c.font = HEADER_FONT; c.border = CELL_BORDER; });

    ALL_STATIONS.forEach((s, i) => {
      const r = wsConfig.addRow({ Clave: s.id, Valor: s.name });
      r.eachCell(c => { c.border = CELL_BORDER; c.alignment = { vertical: 'middle' }; });
      if (i % 2 === 1) r.eachCell(c => { c.fill = ALT_ROW; });
      if (s.id === 0) r.getCell(2).font = { bold: true, color: { argb: 'FF' + BRAND } };
    });

    // ── HOJA 2: Items ──
    const wsItems = wb.addWorksheet('Items', { properties: { tabColor: { argb: 'FF2E7D32' } } });
    wsItems.columns = [
      { header: 'area', key: 'area', width: 20 },
      { header: 'tipo', key: 'tipo', width: 10 },
      { header: 'turno', key: 'turno', width: 10 },
      { header: 'prioridad', key: 'prioridad', width: 12 },
      { header: 'cantidad', key: 'cantidad', width: 12 },
      { header: 'origen', key: 'origen', width: 10 },
      { header: 'destino', key: 'destino', width: 10 },
      { header: 'peso', key: 'peso', width: 12 },
      { header: 'descripcion', key: 'descripcion', width: 36 },
    ];

    const itmHeader = wsItems.getRow(1);
    itmHeader.eachCell(c => { c.fill = HEADER_FILL; c.font = HEADER_FONT; c.border = CELL_BORDER; c.alignment = { vertical: 'middle' }; });
    itmHeader.height = 28;

    // Datos de ejemplo
    const examples = [
      { area: 'Perforación', tipo: 'PAX', turno: 'M', prioridad: 1, cantidad: 3, origen: 0, destino: 2, peso: '', descripcion: '' },
      { area: 'Geología', tipo: 'PAX', turno: 'M', prioridad: 2, cantidad: 2, origen: 0, destino: 4, peso: '', descripcion: '' },
      { area: 'Logística', tipo: 'CARGO', turno: 'M', prioridad: 1, cantidad: 1, origen: 0, destino: 3, peso: 120, descripcion: 'Tubería HDD 6"' },
      { area: 'Mantenimiento', tipo: 'PAX', turno: 'T', prioridad: 2, cantidad: 1, origen: 3, destino: 0, peso: '', descripcion: '' },
      { area: 'Medio Ambiente', tipo: 'PAX', turno: 'M', prioridad: 3, cantidad: 2, origen: 0, destino: 7, peso: '', descripcion: '' },
      { area: 'Obras Civiles', tipo: 'CARGO', turno: 'T', prioridad: 2, cantidad: 1, origen: 0, destino: 6, peso: 200, descripcion: 'Cemento y herramientas' },
      { area: 'Seguridad', tipo: 'PAX', turno: 'T', prioridad: 1, cantidad: 4, origen: 2, destino: 0, peso: '', descripcion: '' },
      { area: 'Campamento', tipo: 'CARGO', turno: 'M', prioridad: 3, cantidad: 1, origen: 0, destino: 5, peso: 85, descripcion: 'Víveres y agua' },
    ];

    const PAX_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };
    const CARGO_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };

    examples.forEach((row) => {
      const r = wsItems.addRow(row);
      const bg = row.tipo === 'PAX' ? PAX_FILL : CARGO_FILL;
      r.eachCell({ includeEmpty: true }, c => { c.border = CELL_BORDER; c.alignment = { vertical: 'middle' }; c.fill = bg; });
    });

    // Notas instructivas debajo
    wsItems.addRow({});
    const noteRows = [
      '📋 INSTRUCCIONES:',
      '• "area": Nombre del área o departamento solicitante.',
      '• "tipo": Escribir PAX (pasajeros) o CARGO (carga). No se mezclan en un mismo vuelo.',
      '• "turno": M = Mañana, T = Tarde. Los turnos no se mezclan.',
      '• "prioridad": 1 (más urgente) a 5 (menos urgente).',
      '• "cantidad": Solo para PAX, indicar número de personas.',
      '• "origen" / "destino": ID de estación (ver hoja Configuracion). 0 = Base.',
      '• "peso": Solo para CARGO, peso en kg. PAX usa peso estándar configurado.',
      '• "descripcion": Opcional. Detalle de la carga.',
      '',
      '💡 Las filas de ejemplo arriba pueden ser eliminadas o reemplazadas con datos reales.',
    ];
    noteRows.forEach(text => {
      const r = wsItems.addRow({ area: text });
      wsItems.mergeCells(`A${r.number}:I${r.number}`);
      r.getCell(1).font = text.startsWith('📋') || text.startsWith('💡') ? { bold: true, size: 10 } : { italic: true, size: 10, color: { argb: 'FF555555' } };
      r.getCell(1).fill = NOTE_FILL;
    });

    // Data validations (cast needed — ExcelJS types lag behind runtime API)
    const wsItemsAny = wsItems as any;
    wsItemsAny.dataValidations.add('B2:B200', {
      type: 'list', allowBlank: false, formulae: ['"PAX,CARGO"'],
      showErrorMessage: true, errorTitle: 'Tipo inválido', error: 'Solo PAX o CARGO.',
    });
    wsItemsAny.dataValidations.add('C2:C200', {
      type: 'list', allowBlank: false, formulae: ['"M,T"'],
      showErrorMessage: true, errorTitle: 'Turno inválido', error: 'Solo M (Mañana) o T (Tarde).',
    });
    wsItemsAny.dataValidations.add('D2:D200', {
      type: 'whole', allowBlank: false, operator: 'between',
      formulae: [1, 5], showErrorMessage: true, errorTitle: 'Prioridad', error: 'Valor entre 1 y 5.',
    });

    // Freeze header row
    wsItems.views = [{ state: 'frozen', ySplit: 1 }];
    wsConfig.views = [{ state: 'frozen', ySplit: 1 }];

    // Download
    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'plantilla_vuelos.xlsx';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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
