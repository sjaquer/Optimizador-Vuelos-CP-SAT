'use client';

import { useState } from 'react';
import type { StationConfig } from '@/lib/types';
import {
  addStation,
  updateStation,
  removeStation,
  setBaseStation,
  DEFAULT_STATIONS,
  slugify,
} from '@/lib/stations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Plus, Trash2, Home, MapPin, RotateCcw, Check, X, Pencil, Radio,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface StationManagerProps {
  stations: StationConfig[];
  onChange: (stations: StationConfig[]) => void;
}

interface EditingState {
  id: string;
  name: string;
  x: string;
  y: string;
}

export function StationManager({ stations, onChange }: StationManagerProps) {
  const { toast } = useToast();
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [addingNew, setAddingNew] = useState(false);
  const [newStation, setNewStation] = useState({ name: '', x: '0', y: '0' });

  const baseId = stations.find(s => s.isBase)?.id;

  // ── Edit existing station ───────────────────────────────────────────
  const startEdit = (station: StationConfig) => {
    setEditing({
      id: station.id,
      name: station.name,
      x: String(station.x),
      y: String(station.y),
    });
    setAddingNew(false);
  };

  const confirmEdit = () => {
    if (!editing) return;
    const x = parseFloat(editing.x);
    const y = parseFloat(editing.y);
    if (!editing.name.trim()) {
      toast({ variant: 'destructive', title: 'Nombre requerido', description: 'El nombre de la estación no puede estar vacío.' });
      return;
    }
    if (isNaN(x) || isNaN(y)) {
      toast({ variant: 'destructive', title: 'Coordenadas inválidas', description: 'X e Y deben ser números válidos.' });
      return;
    }
    onChange(updateStation(stations, editing.id, { name: editing.name.trim(), x, y }));
    setEditing(null);
  };

  const cancelEdit = () => setEditing(null);

  // ── Add new station ─────────────────────────────────────────────────
  const confirmAdd = () => {
    if (!newStation.name.trim()) {
      toast({ variant: 'destructive', title: 'Nombre requerido', description: 'Ingresa un nombre para la nueva estación.' });
      return;
    }
    const x = parseFloat(newStation.x);
    const y = parseFloat(newStation.y);
    if (isNaN(x) || isNaN(y)) {
      toast({ variant: 'destructive', title: 'Coordenadas inválidas', description: 'X e Y deben ser números válidos.' });
      return;
    }
    // Check for duplicate name
    const slug = slugify(newStation.name.trim());
    if (stations.some(s => s.id === slug)) {
      toast({ variant: 'destructive', title: 'Nombre duplicado', description: `Ya existe una estación con nombre similar (${slug}).` });
      return;
    }
    const updated = addStation(stations, newStation.name.trim(), x, y);
    onChange(updated);
    setNewStation({ name: '', x: '0', y: '0' });
    setAddingNew(false);
    toast({ title: 'Estación agregada', description: `"${newStation.name.trim()}" añadida al mapa.` });
  };

  const cancelAdd = () => {
    setNewStation({ name: '', x: '0', y: '0' });
    setAddingNew(false);
  };

  // ── Remove station ──────────────────────────────────────────────────
  const handleRemove = (station: StationConfig) => {
    if (station.isBase) {
      toast({ variant: 'destructive', title: 'No permitido', description: 'No puedes eliminar la estación base.' });
      return;
    }
    if (stations.length <= 2) {
      toast({ variant: 'destructive', title: 'No permitido', description: 'El sistema necesita al menos 2 estaciones.' });
      return;
    }
    onChange(removeStation(stations, station.id));
    toast({ title: 'Estación eliminada', description: `"${station.name}" eliminada.` });
  };

  // ── Set as base ─────────────────────────────────────────────────────
  const handleSetBase = (id: string) => {
    onChange(setBaseStation(stations, id));
    toast({ title: 'Base actualizada', description: `${stations.find(s => s.id === id)?.name} ahora es la base de operaciones.` });
  };

  // ── Restore defaults ────────────────────────────────────────────────
  const handleRestoreDefaults = () => {
    onChange(DEFAULT_STATIONS);
    setEditing(null);
    setAddingNew(false);
    toast({ title: 'Estaciones restauradas', description: 'Se restauraron las 11 estaciones originales del mapa de Nuevo Mundo.' });
  };

  return (
    <div className="space-y-2">
      {/* Header actions */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {stations.length} estación{stations.length !== 1 ? 'es' : ''}
        </span>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
            onClick={handleRestoreDefaults}
            title="Restaurar estaciones por defecto"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-primary hover:text-primary hover:bg-primary/10"
            onClick={() => { setAddingNew(true); setEditing(null); }}
            title="Agregar estación"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Station list */}
      <ScrollArea className="max-h-[260px]">
        <div className="space-y-1 pr-1">
          {stations.map((station) => {
            const isEditing = editing?.id === station.id;
            const isBase = station.isBase === true;

            if (isEditing) {
              return (
                <div key={station.id} className="rounded-lg border border-primary/40 bg-primary/5 p-2 space-y-2">
                  <Input
                    className="h-7 text-xs bg-background"
                    value={editing.name}
                    onChange={e => setEditing(prev => prev ? { ...prev, name: e.target.value } : prev)}
                    placeholder="Nombre"
                    autoFocus
                  />
                  <div className="grid grid-cols-2 gap-1.5">
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-bold text-muted-foreground w-4">X</span>
                      <Input
                        className="h-7 text-xs bg-background font-mono"
                        type="number"
                        step="0.1"
                        value={editing.x}
                        onChange={e => setEditing(prev => prev ? { ...prev, x: e.target.value } : prev)}
                        placeholder="km"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-bold text-muted-foreground w-4">Y</span>
                      <Input
                        className="h-7 text-xs bg-background font-mono"
                        type="number"
                        step="0.1"
                        value={editing.y}
                        onChange={e => setEditing(prev => prev ? { ...prev, y: e.target.value } : prev)}
                        placeholder="km"
                      />
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <Button type="button" size="sm" className="flex-1 h-7 text-xs" onClick={confirmEdit}>
                      <Check className="h-3 w-3 mr-1" /> Guardar
                    </Button>
                    <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={cancelEdit}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={station.id}
                className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 transition-colors group ${
                  isBase
                    ? 'bg-cyan-500/8 border-cyan-500/20 hover:border-cyan-500/40'
                    : 'bg-card border-border/40 hover:border-border'
                }`}
              >
                {/* Base / station icon */}
                <div className={`shrink-0 flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold ${
                  isBase ? 'bg-cyan-500 text-white' : 'bg-primary/10 text-primary'
                }`}>
                  {isBase ? <Home className="h-2.5 w-2.5" /> : <MapPin className="h-2.5 w-2.5" />}
                </div>

                {/* Name + coords */}
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-foreground truncate leading-tight">
                    {station.name}
                    {isBase && <span className="ml-1.5 text-[9px] text-cyan-600 dark:text-cyan-400 font-bold uppercase">BASE</span>}
                  </div>
                  <div className="text-[10px] text-muted-foreground font-mono leading-tight">
                    X: {station.x} km · Y: {station.y} km
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  {!isBase && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-cyan-600"
                      title="Marcar como Base"
                      onClick={() => handleSetBase(station.id)}
                    >
                      <Radio className="h-3 w-3" />
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-primary"
                    title="Editar"
                    onClick={() => startEdit(station)}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                  {!isBase && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-destructive"
                      title="Eliminar"
                      onClick={() => handleRemove(station)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {/* Add new station form */}
      {addingNew && (
        <div className="rounded-lg border border-primary/40 bg-primary/5 p-2 space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="text-[10px] font-bold text-primary uppercase tracking-wider">Nueva Estación</div>
          <Input
            className="h-7 text-xs bg-background"
            value={newStation.name}
            onChange={e => setNewStation(prev => ({ ...prev, name: e.target.value }))}
            placeholder="Nombre (ej: HP Nueva)"
            autoFocus
            onKeyDown={e => { if (e.key === 'Enter') confirmAdd(); if (e.key === 'Escape') cancelAdd(); }}
          />
          <div className="grid grid-cols-2 gap-1.5">
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-bold text-muted-foreground w-4">X</span>
              <Input
                className="h-7 text-xs bg-background font-mono"
                type="number"
                step="0.1"
                value={newStation.x}
                onChange={e => setNewStation(prev => ({ ...prev, x: e.target.value }))}
                placeholder="km"
              />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-bold text-muted-foreground w-4">Y</span>
              <Input
                className="h-7 text-xs bg-background font-mono"
                type="number"
                step="0.1"
                value={newStation.y}
                onChange={e => setNewStation(prev => ({ ...prev, y: e.target.value }))}
                placeholder="km"
              />
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Las coordenadas son en km relativas a la Base. Puedes ajustarlas arrastrando en el mapa.
          </p>
          <div className="flex gap-1.5">
            <Button type="button" size="sm" className="flex-1 h-7 text-xs" onClick={confirmAdd}>
              <Plus className="h-3 w-3 mr-1" /> Agregar
            </Button>
            <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={cancelAdd}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
