'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Plane, Upload, Download, ListCollapse, Map, Milestone,
  CalendarDays, PanelLeft, ChevronRight, ChevronLeft, X,
  Sparkles, Package, Users, BarChart3, FileSpreadsheet,
  Navigation, BookOpen,
} from 'lucide-react';

const ONBOARDING_KEY = 'ovh_onboarding_completed_v1';

interface TourStep {
  title: string;
  description: string;
  icon: React.ReactNode;
  visual?: React.ReactNode;
  tip?: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    title: 'Bienvenido al Sistema de Logística Aérea',
    description:
      'Este sistema te permite planificar y optimizar los vuelos de helicóptero para transportar pasajeros (PAX) y carga (CARGO) entre múltiples estaciones operativas de forma eficiente.',
    icon: <Plane className="h-8 w-8" />,
    tip: 'Los pasajeros y la carga siempre viajan en vuelos separados por seguridad.',
  },
  {
    title: 'Panel de Control (Barra Lateral)',
    description:
      'En el panel lateral izquierdo configuras todo el escenario. Define la cantidad de estaciones activas, la capacidad del helicóptero (asientos y peso máximo), y agrega los requerimientos de transporte: pasajeros y carga con origen, destino, prioridad y turno.',
    icon: <PanelLeft className="h-8 w-8" />,
    visual: (
      <div className="bg-card border rounded-lg p-3 text-xs space-y-2 w-full">
        <div className="flex items-center gap-2 font-semibold"><Users className="h-3.5 w-3.5 text-blue-500" /> PAX — Tipo: Pasajero</div>
        <div className="flex items-center gap-2 font-semibold"><Package className="h-3.5 w-3.5 text-amber-500" /> CARGO — Tipo: Carga</div>
        <div className="text-muted-foreground">Cada ítem necesita: área, tipo, turno (M/T), prioridad (1-5), estación origen y destino.</div>
      </div>
    ),
    tip: 'Puedes agregar múltiples ítems manualmente o importar un Excel.',
  },
  {
    title: 'Importar y Descargar Plantilla',
    description:
      'Usa el botón "Plantilla" en el encabezado para descargar un archivo Excel pre-formateado con datos de ejemplo. Llénalo con tus datos reales y luego impórtalo con "Importar Excel". El sistema validará automáticamente cada fila.',
    icon: <FileSpreadsheet className="h-8 w-8" />,
    visual: (
      <div className="flex items-center gap-3 w-full justify-center">
        <div className="flex items-center gap-1.5 bg-card border rounded-md px-3 py-2 text-xs font-medium shadow-sm">
          <Download className="h-4 w-4 text-primary" /> Plantilla
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
        <div className="flex items-center gap-1.5 bg-card border rounded-md px-3 py-2 text-xs font-medium shadow-sm">
          <Upload className="h-4 w-4 text-primary" /> Importar Excel
        </div>
      </div>
    ),
    tip: 'El Excel tiene 2 hojas: "Configuracion" (parámetros) e "Items" (requerimientos).',
  },
  {
    title: 'Calcular Planes de Vuelo',
    description:
      'Una vez definidos los requerimientos, presiona "Calcular Plan Operativo" en el panel lateral. El motor heurístico generará 4 estrategias de optimización distintas para cada turno (Mañana y Tarde):',
    icon: <Sparkles className="h-8 w-8" />,
    visual: (
      <div className="grid grid-cols-2 gap-2 w-full text-xs">
        <div className="bg-card border rounded-md p-2"><span className="font-bold text-primary">Plan A:</span> Prioridad Estricta</div>
        <div className="bg-card border rounded-md p-2"><span className="font-bold text-primary">Plan B:</span> Ruta Más Corta</div>
        <div className="bg-card border rounded-md p-2"><span className="font-bold text-primary">Plan C:</span> Máxima Carga</div>
        <div className="bg-card border rounded-md p-2"><span className="font-bold text-primary">Plan D:</span> Balanceado</div>
      </div>
    ),
    tip: 'Cada plan muestra distancia total, vuelos, paradas, entregas PAX/CARGO y carga promedio.',
  },
  {
    title: 'Selector de Turno',
    description:
      'Alterna entre Turno Mañana y Turno Tarde con el selector superior. Los ítems se procesan de manera 100% independiente por turno, así puedes ver cómo se distribuyen los recursos en cada jornada.',
    icon: <CalendarDays className="h-8 w-8" />,
    visual: (
      <div className="flex items-center gap-2 bg-card border rounded-lg px-4 py-2 text-sm w-full justify-center">
        <CalendarDays className="h-4 w-4 text-primary" />
        <span className="font-medium">Jornada:</span>
        <span className="bg-primary text-primary-foreground px-2 py-0.5 rounded text-xs font-bold">Mañana</span>
        <span className="text-muted-foreground">|</span>
        <span className="bg-muted px-2 py-0.5 rounded text-xs">Tarde</span>
      </div>
    ),
  },
  {
    title: 'Vista: Análisis de Rutas',
    description:
      'La vista principal muestra las tarjetas de cada estrategia con sus métricas. Haz clic en una tarjeta para seleccionar ese plan y poder verlo en las demás vistas. Debajo encontrarás gráficos comparativos de barras y radar.',
    icon: <ListCollapse className="h-8 w-8" />,
    visual: (
      <div className="flex items-center gap-3 w-full justify-center">
        <div className="flex items-center gap-1.5 bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-xs font-medium shadow-sm">
          <ListCollapse className="h-3.5 w-3.5" /> Análisis de Rutas
        </div>
        <div className="flex items-center gap-1.5 bg-card border rounded-md px-3 py-1.5 text-xs text-muted-foreground">
          <Milestone className="h-3.5 w-3.5" /> Desglose
        </div>
        <div className="flex items-center gap-1.5 bg-card border rounded-md px-3 py-1.5 text-xs text-muted-foreground">
          <Map className="h-3.5 w-3.5" /> Visor
        </div>
      </div>
    ),
    tip: 'Compara métricas entre estrategias con los gráficos de barras y radar al final.',
  },
  {
    title: 'Vista: Desglose en Tabla',
    description:
      'Muestra el itinerario paso a paso del plan seleccionado en formato tabla: cada acción (Recoger/Dejar/Viajar), la estación, los ítems involucrados y las notas. Desde aquí puedes exportar a PDF o Excel.',
    icon: <Milestone className="h-8 w-8" />,
    tip: 'Usa los botones de descarga para generar el reporte del itinerario.',
  },
  {
    title: 'Vista: Visor Satelital',
    description:
      'Un mapa interactivo con animación del helicóptero recorriendo la ruta. Controla la reproducción con los botones de avance, retroceso y reproducción automática. El panel derecho muestra el manifiesto de cada escala.',
    icon: <Navigation className="h-8 w-8" />,
    visual: (
      <div className="bg-card border rounded-lg p-3 text-xs space-y-1.5 w-full">
        <div className="flex items-center gap-2"><span className="inline-block w-3 h-1 bg-blue-500 rounded-full" /> Vuelos de Pasajeros (PAX)</div>
        <div className="flex items-center gap-2"><span className="inline-block w-3 h-1 bg-amber-500 rounded-full" /> Vuelos de Carga (CARGO)</div>
        <div className="flex items-center gap-2"><BarChart3 className="h-3 w-3 text-muted-foreground" /> Manifiesto de embarque/desembarque por escala</div>
      </div>
    ),
    tip: 'El helicóptero se anima entre estaciones. Usa el slider para navegar rápidamente.',
  },
  {
    title: '¡Listo para empezar!',
    description:
      'Ya conoces todas las funciones del sistema. Comienza definiendo tus requerimientos en el panel lateral o descargando la plantilla Excel para llenar tus datos. Puedes repetir este recorrido en cualquier momento desde el botón de ayuda.',
    icon: <BookOpen className="h-8 w-8" />,
    tip: 'El historial guarda tus últimos 20 escenarios para que puedas recargarlos después.',
  },
];

export function OnboardingTour({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0);
  const total = TOUR_STEPS.length;
  const current = TOUR_STEPS[step];
  const progress = ((step + 1) / total) * 100;

  const next = useCallback(() => {
    if (step < total - 1) setStep(s => s + 1);
    else {
      localStorage.setItem(ONBOARDING_KEY, 'true');
      onComplete();
    }
  }, [step, total, onComplete]);

  const prev = useCallback(() => {
    if (step > 0) setStep(s => s - 1);
  }, [step]);

  const skip = useCallback(() => {
    localStorage.setItem(ONBOARDING_KEY, 'true');
    onComplete();
  }, [onComplete]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'Enter') next();
      else if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'Escape') skip();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [next, prev, skip]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
      <div className="relative w-full max-w-lg bg-card border rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        {/* Progress bar */}
        <div className="h-1 bg-muted">
          <div
            className="h-full bg-primary transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Close / Skip */}
        <button
          onClick={skip}
          className="absolute top-4 right-4 p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors z-10"
          aria-label="Cerrar recorrido"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Content */}
        <div className="p-6 md:p-8 space-y-5">
          {/* Step indicator */}
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-primary/10 text-primary shrink-0">
              {current.icon}
            </div>
            <span className="text-xs font-semibold text-muted-foreground tracking-wider uppercase">
              Paso {step + 1} de {total}
            </span>
          </div>

          {/* Title & description */}
          <div className="space-y-2">
            <h2 className="text-xl md:text-2xl font-bold tracking-tight text-foreground leading-tight">
              {current.title}
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {current.description}
            </p>
          </div>

          {/* Visual aid */}
          {current.visual && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              {current.visual}
            </div>
          )}

          {/* Tip */}
          {current.tip && (
            <div className="flex items-start gap-2 bg-primary/5 border border-primary/20 rounded-lg px-3 py-2.5 text-xs text-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
              <span>{current.tip}</span>
            </div>
          )}
        </div>

        {/* Dots + Navigation */}
        <div className="px-6 md:px-8 pb-6 md:pb-8 flex items-center justify-between gap-4">
          {/* Dots */}
          <div className="flex items-center gap-1.5">
            {TOUR_STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className={`h-2 rounded-full transition-all duration-300 ${
                  i === step
                    ? 'w-6 bg-primary'
                    : i < step
                    ? 'w-2 bg-primary/40'
                    : 'w-2 bg-muted-foreground/20'
                }`}
                aria-label={`Ir al paso ${i + 1}`}
              />
            ))}
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-2">
            {step > 0 && (
              <Button variant="ghost" size="sm" onClick={prev} className="h-9">
                <ChevronLeft className="h-4 w-4 mr-1" />
                Anterior
              </Button>
            )}
            {step === 0 && (
              <Button variant="ghost" size="sm" onClick={skip} className="h-9 text-muted-foreground">
                Omitir
              </Button>
            )}
            <Button size="sm" onClick={next} className="h-9 px-4 shadow-sm">
              {step < total - 1 ? (
                <>
                  Siguiente
                  <ChevronRight className="h-4 w-4 ml-1" />
                </>
              ) : (
                'Comenzar'
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Prompt dialog: asks first-time users if they want the tour */
export function OnboardingPrompt({
  onAccept,
  onDecline,
}: {
  onAccept: () => void;
  onDecline: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
      <div className="w-full max-w-md bg-card border rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="p-6 md:p-8 space-y-5 text-center">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-2xl bg-primary/10 text-primary">
            <Plane className="h-9 w-9" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl md:text-2xl font-bold tracking-tight">
              ¡Bienvenido!
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Es la primera vez que accedes al sistema de <strong className="text-foreground">Logística Aérea</strong>.
              ¿Te gustaría un recorrido rápido para conocer todas las funciones?
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
            <Button onClick={onAccept} className="w-full sm:w-auto px-6 shadow-sm">
              <BookOpen className="h-4 w-4 mr-2" />
              Sí, mostrar recorrido
            </Button>
            <Button variant="ghost" onClick={onDecline} className="w-full sm:w-auto text-muted-foreground">
              No, ya conozco la app
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Hook: manages the full onboarding flow */
export function useOnboarding() {
  const [phase, setPhase] = useState<'loading' | 'prompt' | 'tour' | 'done'>('loading');

  useEffect(() => {
    const completed = localStorage.getItem(ONBOARDING_KEY);
    setPhase(completed ? 'done' : 'prompt');
  }, []);

  const accept = useCallback(() => setPhase('tour'), []);
  const decline = useCallback(() => {
    localStorage.setItem(ONBOARDING_KEY, 'true');
    setPhase('done');
  }, []);
  const complete = useCallback(() => setPhase('done'), []);
  const restart = useCallback(() => setPhase('tour'), []);

  return { phase, accept, decline, complete, restart };
}

export { ONBOARDING_KEY };
