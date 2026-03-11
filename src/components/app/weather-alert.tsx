'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle, CloudRain, Wind, RefreshCw, Sun,
  Thermometer, Droplets, Eye, Clock, ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

// Coordenadas aprox. del Consorcio Camisea – Cusco, Perú
const LATITUDE = -11.85;
const LONGITUDE = -72.70;

interface CurrentWeather {
  temperature: number;
  windSpeed: number;
  windGusts: number;
  rain: number;
  humidity: number;
  weatherCode: number;
  time: string;
}

interface DailyForecast {
  tempMax: number;
  tempMin: number;
  precipitationSum: number;
  windSpeedMax: number;
  windGusts: number;
  sunrise: string;
  sunset: string;
  precipProbMax: number;
}

interface WeatherState {
  current: CurrentWeather;
  daily: DailyForecast;
}

type AlertLevel = 'ok' | 'caution' | 'warning';

function classifyAlert(w: CurrentWeather): AlertLevel {
  if (w.windSpeed > 40 || w.windGusts > 60) return 'warning';
  if (w.rain > 3 || w.windSpeed > 25 || w.windGusts > 40) return 'caution';
  return 'ok';
}

function weatherDescription(code: number): string {
  if (code === 0) return 'Despejado';
  if (code <= 2) return 'Parcialmente nublado';
  if (code === 3) return 'Nublado';
  if (code <= 49) return 'Neblina / Niebla';
  if (code <= 57) return 'Llovizna';
  if (code <= 67) return 'Lluvia';
  if (code <= 77) return 'Nieve';
  if (code <= 82) return 'Chubascos';
  if (code <= 86) return 'Nieve con chubascos';
  if (code <= 99) return 'Tormenta eléctrica';
  return 'Desconocido';
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch {
    return iso.slice(11, 16);
  }
}

function alertConfig(level: AlertLevel) {
  switch (level) {
    case 'warning':
      return {
        label: 'Condiciones Adversas',
        icon: AlertTriangle,
        badge: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30',
        header: 'bg-red-500/10 border-red-500/20',
      };
    case 'caution':
      return {
        label: 'Precaución',
        icon: Wind,
        badge: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
        header: 'bg-amber-500/10 border-amber-500/20',
      };
    default:
      return {
        label: 'Clima Favorable',
        icon: Sun,
        badge: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
        header: 'bg-emerald-500/10 border-emerald-500/20',
      };
  }
}

export function WeatherAlert() {
  const [weather, setWeather] = useState<WeatherState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchWeather = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const params = new URLSearchParams({
        latitude: String(LATITUDE),
        longitude: String(LONGITUDE),
        current: 'temperature_2m,relative_humidity_2m,wind_speed_10m,wind_gusts_10m,rain,weather_code',
        daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,wind_gusts_10m_max,sunrise,sunset,precipitation_probability_max',
        forecast_days: '1',
        timezone: 'America/Lima',
      });
      const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
      if (!res.ok) throw new Error('API error');
      const json = await res.json();
      const c = json.current;
      const d = json.daily;
      setWeather({
        current: {
          temperature: Math.round(c.temperature_2m * 10) / 10,
          windSpeed: Math.round(c.wind_speed_10m),
          windGusts: Math.round(c.wind_gusts_10m ?? 0),
          rain: Math.round(c.rain * 10) / 10,
          humidity: Math.round(c.relative_humidity_2m),
          weatherCode: c.weather_code,
          time: c.time,
        },
        daily: {
          tempMax: Math.round(d.temperature_2m_max[0]),
          tempMin: Math.round(d.temperature_2m_min[0]),
          precipitationSum: Math.round(d.precipitation_sum[0] * 10) / 10,
          windSpeedMax: Math.round(d.wind_speed_10m_max[0]),
          windGusts: Math.round(d.wind_gusts_10m_max[0]),
          sunrise: d.sunrise[0],
          sunset: d.sunset[0],
          precipProbMax: d.precipitation_probability_max[0],
        },
      });
      setLastUpdated(new Date());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWeather();
    const interval = setInterval(fetchWeather, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchWeather]);

  if (loading && !weather) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground animate-pulse">
        <RefreshCw className="h-3 w-3 animate-spin" />
        <span className="hidden sm:inline">Clima…</span>
      </div>
    );
  }

  if (error && !weather) {
    return (
      <button
        onClick={fetchWeather}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <AlertTriangle className="h-3 w-3" />
        <span className="hidden sm:inline">Sin datos del clima</span>
      </button>
    );
  }

  if (!weather) return null;

  const level = classifyAlert(weather.current);
  const cfg = alertConfig(level);
  const Icon = cfg.icon;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md border transition-colors hover:opacity-80 ${cfg.badge}`}
          aria-label="Ver pronóstico del clima"
        >
          <Icon className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{cfg.label}</span>
          <span className="sm:hidden">Clima</span>
          <ChevronDown className="h-3 w-3 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="end"
        className="w-72 p-0 overflow-hidden"
        sideOffset={8}
      >
        {/* Header */}
        <div className={`px-4 py-3 border-b ${cfg.header}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-foreground">Zona Camisea, Cusco</p>
              <p className="text-[11px] text-muted-foreground">Consorcio Camisea — Perú</p>
            </div>
            <div className="text-right">
              <p className={`text-xs font-bold ${level === 'ok' ? 'text-emerald-600 dark:text-emerald-400' : level === 'caution' ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
                {cfg.label}
              </p>
              <p className="text-[11px] text-muted-foreground">{weatherDescription(weather.current.weatherCode)}</p>
            </div>
          </div>
        </div>

        {/* Current conditions */}
        <div className="px-4 py-3 border-b">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">Condiciones actuales</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
            <div className="flex items-center gap-2">
              <Thermometer className="h-3.5 w-3.5 text-orange-500 shrink-0" />
              <div>
                <p className="text-[10px] text-muted-foreground">Temperatura</p>
                <p className="text-sm font-semibold">{weather.current.temperature}°C</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Droplets className="h-3.5 w-3.5 text-blue-500 shrink-0" />
              <div>
                <p className="text-[10px] text-muted-foreground">Humedad</p>
                <p className="text-sm font-semibold">{weather.current.humidity}%</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Wind className="h-3.5 w-3.5 text-sky-500 shrink-0" />
              <div>
                <p className="text-[10px] text-muted-foreground">Viento</p>
                <p className="text-sm font-semibold">{weather.current.windSpeed} km/h</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Wind className="h-3.5 w-3.5 text-sky-400 shrink-0" />
              <div>
                <p className="text-[10px] text-muted-foreground">Ráfagas</p>
                <p className="text-sm font-semibold">{weather.current.windGusts} km/h</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <CloudRain className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
              <div>
                <p className="text-[10px] text-muted-foreground">Lluvia actual</p>
                <p className="text-sm font-semibold">{weather.current.rain} mm</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Eye className="h-3.5 w-3.5 text-purple-500 shrink-0" />
              <div>
                <p className="text-[10px] text-muted-foreground">Prob. lluvia hoy</p>
                <p className="text-sm font-semibold">{weather.daily.precipProbMax}%</p>
              </div>
            </div>
          </div>
        </div>

        {/* Daily forecast */}
        <div className="px-4 py-3 border-b">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">Pronóstico del día</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
            <div className="flex items-center gap-2">
              <Thermometer className="h-3.5 w-3.5 text-red-400 shrink-0" />
              <div>
                <p className="text-[10px] text-muted-foreground">Máx / Mín</p>
                <p className="text-sm font-semibold">{weather.daily.tempMax}° / {weather.daily.tempMin}°C</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <CloudRain className="h-3.5 w-3.5 text-blue-400 shrink-0" />
              <div>
                <p className="text-[10px] text-muted-foreground">Precipitación</p>
                <p className="text-sm font-semibold">{weather.daily.precipitationSum} mm</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Wind className="h-3.5 w-3.5 text-teal-500 shrink-0" />
              <div>
                <p className="text-[10px] text-muted-foreground">Viento máx.</p>
                <p className="text-sm font-semibold">{weather.daily.windSpeedMax} km/h</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Wind className="h-3.5 w-3.5 text-teal-400 shrink-0" />
              <div>
                <p className="text-[10px] text-muted-foreground">Ráfagas máx.</p>
                <p className="text-sm font-semibold">{weather.daily.windGusts} km/h</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Sun className="h-3.5 w-3.5 text-yellow-400 shrink-0" />
              <div>
                <p className="text-[10px] text-muted-foreground">Amanecer</p>
                <p className="text-sm font-semibold">{formatTime(weather.daily.sunrise)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Sun className="h-3.5 w-3.5 text-orange-400 shrink-0" />
              <div>
                <p className="text-[10px] text-muted-foreground">Atardecer</p>
                <p className="text-sm font-semibold">{formatTime(weather.daily.sunset)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Clock className="h-3 w-3" />
            {lastUpdated
              ? `Actualizado ${lastUpdated.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false })}`
              : 'Open-Meteo'}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchWeather}
            disabled={loading}
            className="h-6 px-2 text-[11px]"
          >
            <RefreshCw className={`h-3 w-3 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
