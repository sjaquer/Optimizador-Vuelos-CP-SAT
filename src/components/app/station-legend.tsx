'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BookMarked } from 'lucide-react';
import { getActiveStations } from '@/lib/stations';
import type { StationConfig } from '@/lib/types';

interface StationLegendProps {
  numStations: number;
  customStations?: StationConfig[];
}

export function StationLegend({ numStations, customStations }: StationLegendProps) {
  const stations = getActiveStations(numStations, customStations);

  return (
    <Card className="glass-card shadow-lg border-border/50 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-[3px] bg-primary opacity-80" />
      <CardHeader className="pb-2 sm:pb-3 bg-muted/10 border-b border-border/50">
        <CardTitle className="text-base sm:text-lg flex items-center gap-2 font-bold tracking-tight text-foreground">
          <BookMarked className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
          Leyenda Estaciones
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <ul className="grid grid-cols-2 xl:grid-cols-1 gap-2.5 text-xs sm:text-sm">
          {stations.map((station) => {
            const isBase = station.id === 0;
            return (
              <li key={station.id} className="flex items-center gap-3 p-1.5 rounded-lg border border-border/30 bg-muted/5 transition-all hover:bg-muted/15">
                <span className={`flex h-6 w-6 items-center justify-center rounded-full font-bold text-[10px] sm:text-xs shrink-0 shadow-sm ${
                  isBase 
                    ? "bg-cyan-500 text-white animate-pulse" 
                    : "bg-primary text-white"
                }`}>
                  {isBase ? "H" : station.id}
                </span>
                <div className="flex-1 min-w-0 flex flex-col">
                  <span className="font-semibold text-foreground truncate">{station.name}</span>
                  <span className="text-[10px] text-muted-foreground font-mono">X: {station.x} · Y: {station.y}</span>
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
