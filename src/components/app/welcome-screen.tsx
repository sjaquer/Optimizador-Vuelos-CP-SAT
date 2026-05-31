'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Wind, Plane, FileSpreadsheet, PenLine, ClipboardList } from 'lucide-react';

interface WelcomeScreenProps {
  isLoading: boolean;
  onImport?: () => void;
  onCreateManual?: () => void;
  onShowHistory?: () => void;
}

export function WelcomeScreen({ isLoading, onImport, onCreateManual, onShowHistory }: WelcomeScreenProps) {
  return (
    <div className="flex h-full items-center justify-center p-6 relative overflow-hidden">
      {/* Subtle background route lines */}
      <div className="absolute inset-0 pointer-events-none opacity-30 dark:opacity-20">
        <svg className="w-full h-full" viewBox="0 0 800 400" preserveAspectRatio="xMidYMid slice">
          {/* Stylized route lines */}
          <path d="M 50 300 Q 200 100, 400 200 T 750 150" fill="none" stroke="hsl(24, 100%, 50%)" strokeWidth="1.5" className="animate-flow-dash neon-line" opacity="0.4" />
          <path d="M 100 350 Q 300 200, 500 250 T 780 100" fill="none" stroke="hsl(210, 80%, 60%)" strokeWidth="1" className="animate-flow-dash" strokeDasharray="4 8" opacity="0.3" />
          <path d="M 0 200 Q 150 50, 350 150 T 700 80" fill="none" stroke="hsl(24, 100%, 50%)" strokeWidth="1" className="animate-flow-dash" strokeDasharray="6 10" opacity="0.25" />
          {/* Station dots */}
          <circle cx="150" cy="220" r="3" fill="hsl(24, 100%, 50%)" className="animate-station-pulse" opacity="0.5" />
          <circle cx="400" cy="200" r="4" fill="hsl(24, 100%, 50%)" className="animate-station-pulse" opacity="0.6" />
          <circle cx="620" cy="130" r="3" fill="hsl(24, 100%, 50%)" className="animate-station-pulse" opacity="0.4" />
        </svg>
      </div>

      {/* Flying helicopter silhouette */}
      <div className="absolute top-1/4 left-0 right-0 pointer-events-none">
        <div className="animate-heli-fly">
          <Plane className="h-6 w-6 text-primary/40 dark:text-primary/30 rotate-[-15deg]" />
        </div>
      </div>

      {isLoading ? (
        <Card className="w-full max-w-md glass-card border-primary/20 shadow-xl animate-fade-up">
          <CardContent className="p-10">
            <div className="flex flex-col items-center gap-6">
              {/* Premium spinner */}
              <div className="relative flex items-center justify-center h-24 w-24">
                <div className="absolute inset-0 rounded-full border-2 border-primary/20 animate-spin" style={{ animationDuration: '3s' }}>
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 h-2 w-2 bg-primary rounded-full" />
                </div>
                <div className="absolute inset-2 rounded-full bg-primary/5 dark:bg-primary/10" />
                <Plane className="h-10 w-10 text-primary animate-heli-hover" />
              </div>
              <div className="space-y-2 text-center">
                <h3 className="text-xl font-bold tracking-tight">Procesando Escenario...</h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
                  El motor de optimización heurística está calculando las mejores combinaciones de rutas
                  y carga para las estaciones activas.
                </p>
              </div>
              {/* Progress shimmer */}
              <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
                <div className="h-full w-1/3 bg-gradient-to-r from-transparent via-primary to-transparent rounded-full animate-pulse" style={{ animationDuration: '1.5s' }} />
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="w-full max-w-2xl space-y-8 animate-fade-up relative z-10">
          {/* Hero heading */}
          <div className="text-center space-y-3">
            <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-primary/10 dark:bg-primary/15 border border-primary/20 mx-auto mb-2">
              <Plane className="h-7 w-7 text-primary" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight">Motor de Planificación Heurística</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
              Sistema avanzado de enrutamiento para logística aérea. Selecciona cómo deseas comenzar.
            </p>
          </div>

          {/* 3 Action cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Import Excel */}
            <button
              type="button"
              onClick={onImport}
              className="group glass-card rounded-xl p-5 text-left transition-all duration-300 hover:scale-[1.02] hover:border-primary/30 hover:glow-primary focus:outline-none focus:ring-2 focus:ring-primary/40 focus:ring-offset-2 focus:ring-offset-background cursor-pointer"
            >
              <div className="flex flex-col items-center text-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/15 flex items-center justify-center border border-emerald-500/20 transition-colors group-hover:bg-emerald-500/20 group-hover:border-emerald-500/30">
                  <FileSpreadsheet className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <span className="text-sm font-semibold block">📥 Importar Excel</span>
                  <span className="text-xs text-muted-foreground mt-1 block">Carga tu archivo de requerimientos</span>
                </div>
              </div>
            </button>

            {/* Create Manual */}
            <button
              type="button"
              onClick={onCreateManual}
              className="group glass-card rounded-xl p-5 text-left transition-all duration-300 hover:scale-[1.02] hover:border-blue-500/30 hover:glow-blue focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:ring-offset-2 focus:ring-offset-background cursor-pointer"
            >
              <div className="flex flex-col items-center text-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-blue-500/10 dark:bg-blue-500/15 flex items-center justify-center border border-blue-500/20 transition-colors group-hover:bg-blue-500/20 group-hover:border-blue-500/30">
                  <PenLine className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <span className="text-sm font-semibold block">✏️ Crear Escenario</span>
                  <span className="text-xs text-muted-foreground mt-1 block">Define parámetros manualmente</span>
                </div>
              </div>
            </button>

            {/* History */}
            <button
              type="button"
              onClick={onShowHistory}
              className="group glass-card rounded-xl p-5 text-left transition-all duration-300 hover:scale-[1.02] hover:border-amber-500/30 hover:glow-amber focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:ring-offset-2 focus:ring-offset-background cursor-pointer"
            >
              <div className="flex flex-col items-center text-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-amber-500/10 dark:bg-amber-500/15 flex items-center justify-center border border-amber-500/20 transition-colors group-hover:bg-amber-500/20 group-hover:border-amber-500/30">
                  <ClipboardList className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <span className="text-sm font-semibold block">📋 Historial</span>
                  <span className="text-xs text-muted-foreground mt-1 block">Recupera misiones previas</span>
                </div>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
