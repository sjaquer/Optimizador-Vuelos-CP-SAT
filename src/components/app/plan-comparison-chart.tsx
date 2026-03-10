'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { FlightPlan } from '@/lib/types';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts';

interface PlanComparisonChartProps {
  plans: FlightPlan[];
}

const COLORS = ['hsl(var(--primary))', '#16a34a', '#f59e0b', '#8b5cf6'];

export function PlanComparisonChart({ plans }: PlanComparisonChartProps) {
  const activePlans = useMemo(() => plans.filter(p => p.steps.length > 0), [plans]);

  const barData = useMemo(() => {
    if (activePlans.length === 0) return [];
    return [
      {
        metric: 'Distancia',
        ...Object.fromEntries(activePlans.map(p => [p.title.split(':')[0].trim(), Math.round(p.metrics.totalDistance)])),
      },
      {
        metric: 'Items',
        ...Object.fromEntries(activePlans.map(p => [p.title.split(':')[0].trim(), p.metrics.itemsTransported])),
      },
      {
        metric: 'Paradas',
        ...Object.fromEntries(activePlans.map(p => [p.title.split(':')[0].trim(), p.metrics.totalStops])),
      },
      {
        metric: 'Vuelos',
        ...Object.fromEntries(activePlans.map(p => [p.title.split(':')[0].trim(), p.metrics.totalFlights])),
      },
      {
        metric: 'No entregados',
        ...Object.fromEntries(activePlans.map(p => [p.title.split(':')[0].trim(), p.metrics.itemsNotDelivered])),
      },
    ];
  }, [activePlans]);

  const radarData = useMemo(() => {
    if (activePlans.length === 0) return [];
    const maxDist = Math.max(...activePlans.map(p => p.metrics.totalDistance), 1);
    const maxItems = Math.max(...activePlans.map(p => p.metrics.itemsTransported), 1);
    const maxFlights = Math.max(...activePlans.map(p => p.metrics.totalFlights), 1);

    return activePlans.map((p, i) => ({
      plan: p.title.split(':')[0].trim(),
      'Eficiencia dist.': Math.round((1 - p.metrics.totalDistance / maxDist) * 100),
      'Items entregados': Math.round((p.metrics.itemsTransported / maxItems) * 100),
      'Carga promedio': Math.round(p.metrics.avgLoadRatio * 100),
      'Menos vuelos': Math.round((1 - p.metrics.totalFlights / maxFlights) * 100),
      fill: COLORS[i % COLORS.length],
    }));
  }, [activePlans]);

  const radarMetrics = ['Eficiencia dist.', 'Items entregados', 'Carga promedio', 'Menos vuelos'];
  const radarChartData = useMemo(() => {
    return radarMetrics.map(metric => {
      const entry: Record<string, string | number> = { metric };
      radarData.forEach(r => { entry[r.plan] = r[metric as keyof typeof r] as number; });
      return entry;
    });
  }, [radarData]);

  if (activePlans.length === 0) {
    return null;
  }

  const planKeys = activePlans.map(p => p.title.split(':')[0].trim());

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Comparación de Métricas</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={barData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="metric" className="text-xs" />
              <YAxis className="text-xs" />
              <Tooltip
                contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '0.5rem' }}
                labelStyle={{ fontWeight: 600 }}
              />
              <Legend />
              {planKeys.map((key, i) => (
                <Bar key={key} dataKey={key} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Perfil de Rendimiento</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={radarChartData} cx="50%" cy="50%" outerRadius="70%">
              <PolarGrid className="stroke-muted" />
              <PolarAngleAxis dataKey="metric" className="text-xs" />
              <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} />
              {planKeys.map((key, i) => (
                <Radar key={key} name={key} dataKey={key} stroke={COLORS[i % COLORS.length]} fill={COLORS[i % COLORS.length]} fillOpacity={0.15} />
              ))}
              <Legend />
            </RadarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
