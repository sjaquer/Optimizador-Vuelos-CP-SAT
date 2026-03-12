
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BookMarked } from 'lucide-react';
import { getActiveStations } from '@/lib/stations';

interface StationLegendProps {
  numStations: number;
}

export function StationLegend({ numStations }: StationLegendProps) {
  const stations = getActiveStations(numStations);

  return (
    <Card>
      <CardHeader className="pb-2 sm:pb-3">
        <CardTitle className="text-base sm:text-lg flex items-center gap-2">
          <BookMarked className="h-4 w-4 sm:h-5 sm:w-5" />
          Leyenda
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="grid grid-cols-2 xl:grid-cols-1 gap-1.5 sm:gap-2 text-xs sm:text-sm">
          {stations.map((station) => (
            <li key={station.id} className="flex items-center gap-2 sm:gap-3">
              <span className="flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-[10px] sm:text-xs shrink-0">
                {station.id}
              </span>
              <span className="flex-1 truncate">{station.name}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
