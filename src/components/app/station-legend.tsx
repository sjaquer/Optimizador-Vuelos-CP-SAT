
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
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <BookMarked className="h-5 w-5" />
          Leyenda
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2 text-sm">
          {stations.map((station) => (
            <li key={station.id} className="flex items-center gap-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-xs">
                {station.id}
              </span>
              <span className="flex-1">{station.name}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
