
'use client';

import { useState, useEffect } from 'react';
import { Calendar, Clock } from 'lucide-react';

export function CurrentDateTime() {
  const [date, setDate] = useState<Date | null>(null);

  useEffect(() => {
    // Set initial date on client mount to avoid hydration mismatch
    setDate(new Date());

    const timerId = setInterval(() => {
      setDate(new Date());
    }, 1000); // Update every second

    // Cleanup interval on component unmount
    return () => clearInterval(timerId);
  }, []);

  const formattedDate = date
    ? new Intl.DateTimeFormat('es-ES', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }).format(date)
    : 'Cargando fecha...';

  const formattedTime = date
    ? new Intl.DateTimeFormat('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).format(date)
    : 'Cargando hora...';

  return (
    <div className="flex flex-col gap-1 rounded-lg border bg-background/50 p-2 text-center text-sm text-muted-foreground">
      <div className="flex items-center justify-center gap-2 font-medium">
        <Calendar className="h-4 w-4" />
        <span className="capitalize">{formattedDate}</span>
      </div>
      <div className="flex items-center justify-center gap-2">
        <Clock className="h-4 w-4" />
        <span>{formattedTime}</span>
      </div>
    </div>
  );
}

