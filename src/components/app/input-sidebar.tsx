
'use client';

import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  SidebarHeader,
  SidebarFooter,
} from '@/components/ui/sidebar';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import type { ScenarioData } from '@/lib/types';
import { Plus, Trash2, Wind, ArrowRight, History, Users, Package } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getHistory, deleteScenarioFromHistory } from '@/lib/history';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

import { CurrentDateTime } from './current-date-time';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { ALL_STATIONS, getActiveStations } from '@/lib/stations';


const transportItemSchema = z.object({
  id: z.string(),
  area: z.string().min(1, 'Área requerida'),
  type: z.enum(['PAX', 'CARGO']),
  shift: z.enum(['M', 'T']),
  priority: z.coerce.number().min(1).max(5),
  quantity: z.coerce.number().min(1, "La cantidad debe ser al menos 1."),
  originStation: z.coerce.number().min(0),
  destinationStation: z.coerce.number().min(0),
  weight: z.coerce.number().optional(), // Make optional
  description: z.string().optional(),
});

const formSchema = z.object({
  numStations: z.coerce.number().min(1, 'Mínimo 1 estación'),
  helicopterCapacity: z.coerce.number().min(1, 'Capacidad mín. 1'),
  helicopterMaxWeight: z.coerce.number().min(1, 'Peso máx. mín. 1'),
  paxDefaultWeight: z.coerce.number().min(1, 'Peso PAX mín. 1'),
  transportItems: z.array(transportItemSchema),
  weatherConditions: z.string().optional(),
  operationalNotes: z.string().optional(),
}).refine(data => {
    return data.transportItems.every(p => p.originStation <= data.numStations && p.destinationStation <= data.numStations);
}, { message: "Estación debe ser <= al nro de estaciones", path: ["transportItems"] })
 .refine(data => {
    return data.transportItems.every(p => p.originStation !== p.destinationStation);
 }, { message: "Origen y destino no pueden ser iguales", path: ["transportItems"] })
 .refine(data => {
    return data.transportItems.every(item => item.type === 'PAX' || (item.weight !== undefined && item.weight > 0));
}, { message: 'El peso es requerido para CARGO', path: ['transportItems'] });


type FormValues = z.infer<typeof formSchema>;

interface InputSidebarProps {
  scenario: ScenarioData;
  setScenario: (scenario: ScenarioData) => void;
  onGeneratePlans: () => void;
  isLoading: boolean;
}

export function InputSidebar({ scenario, setScenario, onGeneratePlans, isLoading }: InputSidebarProps) {
  const { toast } = useToast();
  const [activeView, setActiveView] = useState('editor'); // 'editor' or 'history'
  const [history, setHistory] = useState<ScenarioData[]>([]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: scenario,
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'transportItems',
  });

  const watchedItems = form.watch('transportItems');

  useEffect(() => {
    form.reset(scenario);
  }, [scenario, form]);

  useEffect(() => {
    if (activeView === 'history') {
      setHistory(getHistory());
    }
  }, [activeView]);
  
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    form.trigger().then(isValid => {
      if (isValid) {
        const values = form.getValues();
        const paxWeight = values.paxDefaultWeight || 80;
        const processedValues = {
            ...values,
            transportItems: values.transportItems.map(item => ({
                ...item,
                weight: item.type === 'PAX' ? paxWeight : item.weight!,
                description: item.type === 'PAX' ? `Pasajero de ${item.area}`: item.description || '',
            }))
        };
        setScenario(processedValues);
        onGeneratePlans();
      } else {
        toast({
            variant: "destructive",
            title: "Error de Validación",
            description: "Por favor, corrige los errores en el formulario.",
        })
      }
    });
  }

  const loadScenarioFromHistory = (histScenario: ScenarioData) => {
    setScenario(histScenario);
    setActiveView('editor');
    toast({ title: 'Escenario Cargado', description: 'Se cargó el escenario desde el historial.' });
  };

  const deleteScenario = (scenarioId: string | undefined) => {
    if(!scenarioId) return;
    deleteScenarioFromHistory(scenarioId);
    setHistory(getHistory());
    toast({ title: 'Escenario Eliminado', description: 'El escenario ha sido eliminado.' });
  }

  const maxStation = form.watch('numStations');

  return (
    <Form {...form}>
      <form className="flex h-full flex-col" onSubmit={handleFormSubmit} noValidate>
        <div className="flex min-h-0 flex-1 flex-col">
          <SidebarHeader className="group-data-[collapsible=icon]:hidden border-b pb-4 mb-2 bg-muted/20">
              <div className='flex items-center justify-between'>
                <h2 className='font-bold text-primary tracking-tight'>Control de Escenario</h2>
                <Button
                  variant={activeView === 'history' ? 'default' : 'outline'}
                  size="icon"
                  className='h-8 w-8 shadow-sm transition-all'
                  onClick={() => setActiveView(v => v === 'editor' ? 'history' : 'editor')}
                  type="button"
                  aria-label="Historial"
                >
                  <History className="h-4 w-4" />
                </Button>
              </div>
              <CurrentDateTime />
          </SidebarHeader>

          <div className="min-h-0 flex-1">
           <ScrollArea className="h-full">
            <div className="space-y-6 p-4 group-data-[collapsible=icon]:hidden">
               {activeView === 'editor' ? (
                <>
                  <div className="bg-card border rounded-lg p-3 shadow-sm">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5"><Wind className="h-3.5 w-3.5"/> Condiciones</h3>
                    <div className="space-y-3">
                      <FormField control={form.control} name="weatherConditions" render={({ field }) => (
                          <FormItem>
                            <FormControl><Input placeholder="Clima (Ej: Viento 15km/h NNO)" className="text-xs h-8 bg-background border-border" {...field} /></FormControl>
                          </FormItem>
                        )}/>
                      <FormField control={form.control} name="operationalNotes" render={({ field }) => (
                          <FormItem>
                            <FormControl><Input placeholder="Notas operacionales o alertas..." className="text-xs h-8 bg-background border-border" {...field} /></FormControl>
                          </FormItem>
                        )}/>
                    </div>
                  </div>

                  <div className="bg-card border rounded-lg p-3 shadow-sm">
                     <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">Config. Aeronave</h3>
                     <div className="grid grid-cols-2 gap-3">
                        <FormField control={form.control} name="numStations" render={({ field }) => ( <FormItem><FormLabel className="text-[10px] uppercase font-semibold text-muted-foreground">Estaciones Activas</FormLabel><FormControl><Input type="number" className="h-8 font-medium bg-background" {...field} /></FormControl></FormItem> )}/>
                        <FormField control={form.control} name="helicopterCapacity" render={({ field }) => ( <FormItem><FormLabel className="text-[10px] uppercase font-semibold text-muted-foreground">Capacidad (Asientos)</FormLabel><FormControl><Input type="number" className="h-8 font-medium bg-background" {...field} /></FormControl></FormItem> )}/>
                        <FormField control={form.control} name="helicopterMaxWeight" render={({ field }) => ( <FormItem><FormLabel className="text-[10px] uppercase font-semibold text-muted-foreground">Carga Máxima (kg)</FormLabel><FormControl><Input type="number" className="h-8 font-medium bg-background" {...field} /></FormControl></FormItem> )}/>
                        <FormField control={form.control} name="paxDefaultWeight" render={({ field }) => ( <FormItem><FormLabel className="text-[10px] uppercase font-semibold text-muted-foreground">Peso PAX Estándar</FormLabel><FormControl><Input type="number" className="h-8 font-medium bg-background" {...field} /></FormControl></FormItem> )}/>
                     </div>
                     <FormMessage className="text-xs mt-2">{form.formState.errors.numStations?.message || form.formState.errors.helicopterCapacity?.message || form.formState.errors.helicopterMaxWeight?.message}</FormMessage>
                  </div>
                  
                  <div className="bg-card border rounded-lg p-3 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">Requerimientos</h3>
                    </div>
                    <div className="space-y-4">
                      {fields.map((field, index) => {
                        const itemType = watchedItems[index]?.type;
                        const isPax = itemType === 'PAX';
                        return (
                          <div key={field.id} className={`flex flex-col gap-3 rounded-md border p-3 relative group ${isPax ? 'bg-blue-500/5 border-blue-500/20' : 'bg-amber-500/5 border-amber-500/20'}`}>
                            <Button type="button" variant="ghost" size="icon" className="absolute top-1 right-1 h-6 w-6 shrink-0 text-muted-foreground hover:bg-destructive hover:text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => remove(index)}><Trash2 className="h-3 w-3" /></Button>
                            
                            <div className="flex items-center gap-2 pr-6">
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 ${isPax ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300' : 'bg-amber-500/10 text-amber-700 dark:text-amber-300'}`}>
                                {isPax ? <Users className="h-3 w-3" /> : <Package className="h-3 w-3" />}
                                #{index + 1}
                              </span>
                              <FormField control={form.control} name={`transportItems.${index}.area`} render={({ field }) => ( <FormItem className="flex-1 space-y-0.5"><FormControl><Input className="h-7 text-xs bg-background" placeholder="Área" {...field} /></FormControl></FormItem> )}/>
                            </div>

                            <div className="grid grid-cols-3 gap-2">
                                <FormField control={form.control} name={`transportItems.${index}.type`} render={({ field }) => ( <FormItem className="space-y-0.5"><FormLabel className="text-[10px]">TIPO</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger className="h-7 text-xs bg-background"><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="PAX">PAX</SelectItem><SelectItem value="CARGO">CARGA</SelectItem></SelectContent></Select></FormItem> )}/>
                                <FormField control={form.control} name={`transportItems.${index}.shift`} render={({ field }) => ( <FormItem className="space-y-0.5"><FormLabel className="text-[10px]">TRN</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger className="h-7 text-xs bg-background"><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="M">MAÑ</SelectItem><SelectItem value="T">TAR</SelectItem></SelectContent></Select></FormItem> )}/>
                                <FormField control={form.control} name={`transportItems.${index}.priority`} render={({ field }) => ( <FormItem className="space-y-0.5"><FormLabel className="text-[10px]">PRIO</FormLabel><FormControl><Input type="number" min="1" max="5" className="h-7 text-xs bg-background" {...field} /></FormControl></FormItem> )}/>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-2">
                               <FormField control={form.control} name={`transportItems.${index}.quantity`} render={({ field }) => ( <FormItem className="space-y-0.5"><FormLabel className="text-[10px]">CANTIDAD</FormLabel><FormControl><Input type="number" min="1" placeholder="1" className="h-7 text-xs bg-background" {...field} disabled={!isPax} value={isPax ? field.value || 1 : 1} /></FormControl></FormItem> )}/>
                               <FormField control={form.control} name={`transportItems.${index}.weight`} render={({ field }) => ( <FormItem className="space-y-0.5"><FormLabel className="text-[10px]">PESO (kg)</FormLabel><FormControl><Input type="number" className="h-7 text-xs bg-background" {...field} disabled={isPax} placeholder={isPax ? `${form.watch('paxDefaultWeight') || 80}` : '0'} value={isPax ? '' : field.value || ''} /></FormControl></FormItem> )}/>
                            </div>
                            
                            {!isPax && (
                              <FormField control={form.control} name={`transportItems.${index}.description`} render={({ field }) => ( <FormItem className="space-y-0.5"><FormControl><Input placeholder="Describir carga..." className="h-7 text-xs bg-background" {...field} value={field.value || ''} /></FormControl></FormItem> )}/>
                            )}

                            <div className="flex items-center justify-between gap-2 bg-background p-1.5 rounded border border-border">
                                <Controller control={form.control} name={`transportItems.${index}.originStation`} render={({ field }) => (
                                  <FormItem className="flex-1 space-y-0">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[10px] font-medium text-muted-foreground w-6">ORG</span>
                                      <Select onValueChange={(v) => field.onChange(Number(v))} value={String(field.value)}>
                                        <FormControl><SelectTrigger className="h-6 text-xs"><SelectValue placeholder="Origen" /></SelectTrigger></FormControl>
                                        <SelectContent>
                                          {getActiveStations(maxStation).map(s => (
                                            <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </FormItem>
                                )}/>
                                <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                                <Controller control={form.control} name={`transportItems.${index}.destinationStation`} render={({ field }) => (
                                  <FormItem className="flex-1 space-y-0">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[10px] font-medium text-muted-foreground w-6">DST</span>
                                      <Select onValueChange={(v) => field.onChange(Number(v))} value={String(field.value)}>
                                        <FormControl><SelectTrigger className="h-6 text-xs"><SelectValue placeholder="Destino" /></SelectTrigger></FormControl>
                                        <SelectContent>
                                          {getActiveStations(maxStation).map(s => (
                                            <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </FormItem>
                                )}/>
                            </div>
                            <FormMessage className="text-[10px]">{form.formState.errors.transportItems?.[index]?.root?.message || form.formState.errors.transportItems?.[index]?.area?.message || form.formState.errors.transportItems?.[index]?.weight?.message || form.formState.errors.transportItems?.[index]?.quantity?.message}</FormMessage>
                          </div>
                        );
                      })}
                      <Button type="button" variant="outline" className="w-full" onClick={() => append({ id: crypto.randomUUID(), area: '', type: 'PAX', shift: 'M', priority: 3, quantity: 1, originStation: 1, destinationStation: 0, weight: 80, description: '' })}>
                        <Plus className="mr-2" /> Agregar Item
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                 <div>
                     <h3 className="text-sm font-medium mb-2">Historial</h3>
                      {history.length > 0 ? (
                        <Accordion type="single" collapsible className="w-full">
                            {history.map((histScenario, index) => (
                              <AccordionItem value={`item-${index}`} key={histScenario.id}>
                                <AccordionTrigger>
                                    <span className="truncate flex-1 text-left">
                                      Escenario del {new Date(histScenario.id!).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </AccordionTrigger>
                                <AccordionContent className='space-y-4'>
                                  <div className='text-xs text-muted-foreground space-y-2'>
                                     <p><strong>Items:</strong> {histScenario.transportItems.length} ({histScenario.transportItems.filter(i=>i.type==='PAX').length} PAX, {histScenario.transportItems.filter(i=>i.type==='CARGO').length} Carga)</p>
                                     <p><strong>Estaciones:</strong> {histScenario.numStations}</p>
                                     <p><strong>Capacidad:</strong> {histScenario.helicopterCapacity} asientos, {histScenario.helicopterMaxWeight} kg</p>
                                  </div>
                                  <div className='flex gap-2'>
                                    <Button size="sm" onClick={() => loadScenarioFromHistory(histScenario)} className="flex-1">Cargar</Button>
                                    <Button size="sm" variant="destructive" onClick={() => deleteScenario(histScenario.id)}><Trash2/></Button>
                                  </div>
                                </AccordionContent>
                              </AccordionItem>
                            ))}
                          </Accordion>
                      ) : (<p className="text-sm text-muted-foreground text-center py-4">No hay escenarios guardados.</p>)}
                 </div>
              )}
            </div>
          </ScrollArea>
          </div>
        </div>

        <SidebarFooter className="group-data-[collapsible=icon]:hidden p-4 border-t bg-card/50">
          <Button type="submit" disabled={isLoading} className="w-full h-11 font-bold shadow-md relative overflow-hidden group">
            {isLoading ? (
              <><Wind className="mr-2 h-5 w-5 animate-spin" /> Procesando Heurística...</>
            ) : (
              <span className="flex items-center justify-center relative z-10 transition-transform group-hover:gap-2">
                 Calcular Plan Operativo <ArrowRight className="ml-2 h-5 w-5 opacity-0 group-hover:opacity-100 -translate-x-4 group-hover:translate-x-0 transition-all" />
              </span>
            )}
          </Button>
        </SidebarFooter>
      </form>
    </Form>
  );
}
