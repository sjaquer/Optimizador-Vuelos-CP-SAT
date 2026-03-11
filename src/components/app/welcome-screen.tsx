'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Bot, Wind, Plane } from 'lucide-react';

export function WelcomeScreen({ isLoading }: { isLoading: boolean }) {
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
