
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BookMarked } from 'lucide-react';

const stationNames: Record<number, string> = {
  0: "BO Nuevo Mundo",
  1: "HP 6+800",
  2: "HP Kinteroni",
  3: "HP CT-5",
  4: "HP Sagari AX",
  5: "HP Sagari BX",
  6: "HP 14+000",
  7: "HP Porotobango",
  8: "HP Kitepampani",
};

export function StationLegend() {
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
          {Object.entries(stationNames).map(([id, name]) => (
            <li key={id} className="flex items-center gap-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-xs">
                {id}
              </span>
              <span className="flex-1">{name}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
