
'use client';

import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  SidebarHeader,
  SidebarFooter,
  SidebarMenuButton,
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
import { Plus, Trash2, Wind, ArrowRight, History } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getHistory, deleteScenarioFromHistory } from '@/lib/history';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Textarea } from '../ui/textarea';
import { CurrentDateTime } from './current-date-time';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';


const transportItemSchema = z.object({
  id: z.string(),
  area: z.string().min(1, 'El área es requerida'),
  type: z.enum(['PAX', 'CARGO']),
  shift: z.enum(['M', 'T']),
  priority: z.coerce.number().min(1).max(5),
  originStation: z.coerce.number().min(0),
  destinationStation: z.coerce.number().min(0),
});

const formSchema = z.object({
  numStations: z.coerce.number().min(1, 'Se requiere al menos una estación'),
  helicopterCapacity: z.coerce.number().min(1, 'La capacidad debe ser al menos 1'),
  transportItems: z.array(transportItemSchema),
  weatherConditions: z.string().optional(),
  operationalNotes: z.string().optional(),
}).refine(data => {
    return data.transportItems.every(p => p.originStation <= data.numStations && p.destinationStation <= data.numStations);
}, { message: "La estación debe ser menor o igual al número de estaciones", path: ["transportItems"] })
 .refine(data => {
    return data.transportItems.every(p => p.originStation !== p.destinationStation);
 }, { message: "El origen y destino no pueden ser iguales", path: ["transportItems"] });

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
    defaultValues: {
      numStations: 6,
      helicopterCapacity: 4,
      transportItems: [],
      weatherConditions: '',
      operationalNotes: '',
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'transportItems',
  });

  useEffect(() => {
    form.reset({
      numStations: scenario.numStations,
      helicopterCapacity: scenario.helicopterCapacity,
      transportItems: scenario.transportItems.map(p => ({
        ...p,
        id: p.id || crypto.randomUUID(), 
      })),
      weatherConditions: scenario.weatherConditions,
      operationalNotes: scenario.operationalNotes,
    });
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
        setScenario(form.getValues());
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
    <>
      <Form {...form}>
        <form className="flex h-full flex-col" onSubmit={handleFormSubmit} noValidate>
          <div className="flex-1 min-h-0 flex flex-col">
            <SidebarHeader className="group-data-[collapsible=icon]:hidden">
                <Button
                  variant={'ghost'}
                  size="icon"
                  className='h-7 w-7 self-end'
                  onClick={() => setActiveView(v => v === 'editor' ? 'history' : 'editor')}
                  aria-label="Historial"
                  type="button"
                >
                  <History />
                </Button>
                <CurrentDateTime />
            </SidebarHeader>

            <div className="flex-1 min-h-0">
             <ScrollArea className="h-full">
              <div className="group-data-[collapsible=icon]:hidden p-2 space-y-4">
                 {activeView === 'editor' ? (
                  <>
                    <div>
                      <h3 className="text-sm font-medium mb-2">Condiciones del Vuelo</h3>
                      <div className="space-y-4">
                        <FormField control={form.control} name="weatherConditions" render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Condiciones Climáticas</FormLabel>
                              <FormControl><Textarea placeholder="Ej: Viento 15km/h..." {...field} /></FormControl>
                            </FormItem>
                          )}/>
                        <FormField control={form.control} name="operationalNotes" render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Notas Operacionales</FormLabel>
                              <FormControl><Textarea placeholder="Ej: Priorizar carga frágil..." {...field} /></FormControl>
                            </FormItem>
                          )}/>
                      </div>
                    </div>

                    <div>
                       <h3 className="text-sm font-medium mb-2">Configuración</h3>
                       <div className="grid grid-cols-2 gap-4">
                          <FormField control={form.control} name="numStations" render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Estaciones</FormLabel>
                                <FormControl><Input type="number" {...field} /></FormControl>
                                <FormMessage />
                              </FormItem>
                            )}/>
                          <FormField control={form.control} name="helicopterCapacity" render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Cap. Helicóptero</FormLabel>
                                <FormControl><Input type="number" {...field} /></FormControl>
                                <FormMessage />
                              </FormItem>
                            )}/>
                       </div>
                    </div>
                    
                    <div>
                      <h3 className="text-sm font-medium mb-2">Items a Transportar</h3>
                      <div className="space-y-3">
                        {fields.map((field, index) => (
                          <div key={field.id} className="flex flex-col gap-2 rounded-md border p-2">
                            <div className="flex items-end gap-2">
                              <FormField control={form.control} name={`transportItems.${index}.area`} render={({ field }) => (
                                  <FormItem className="flex-1">
                                    <FormLabel className="text-xs">Área</FormLabel>
                                    <FormControl><Input {...field} /></FormControl>
                                  </FormItem>
                                )}/>
                                <Controller control={form.control} name={`transportItems.${index}.priority`} render={({ field }) => (
                                    <FormItem>
                                      <FormLabel className="text-xs">Prio</FormLabel>
                                      <FormControl><Input type="number" min="1" max="5" className="w-16" {...field} /></FormControl>
                                    </FormItem>
                                  )}/>
                                <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => remove(index)}><Trash2 className="h-4 w-4" /></Button>
                            </div>
                             <div className="grid grid-cols-2 gap-2">
                                <FormField control={form.control} name={`transportItems.${index}.type`} render={({ field }) => (
                                    <FormItem>
                                      <FormLabel className="text-xs">Tipo</FormLabel>
                                       <Select onValueChange={field.onChange} defaultValue={field.value}>
                                          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                          <SelectContent><SelectItem value="PAX">PAX</SelectItem><SelectItem value="CARGO">CARGO</SelectItem></SelectContent>
                                        </Select>
                                    </FormItem>
                                  )}/>
                                <FormField control={form.control} name={`transportItems.${index}.shift`} render={({ field }) => (
                                    <FormItem>
                                      <FormLabel className="text-xs">Turno</FormLabel>
                                       <Select onValueChange={field.onChange} defaultValue={field.value}>
                                          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                          <SelectContent><SelectItem value="M">Mañana</SelectItem><SelectItem value="T">Tarde</SelectItem></SelectContent>
                                        </Select>
                                    </FormItem>
                                  )}/>
                            </div>
                            <div className="flex items-center justify-center gap-2">
                                <Controller control={form.control} name={`transportItems.${index}.originStation`} render={({ field }) => (
                                    <FormItem className="flex-1">
                                      <FormLabel className="text-xs">Origen (0=Base)</FormLabel>
                                      <FormControl><Input type="number" min="0" max={maxStation} {...field} /></FormControl>
                                    </FormItem>
                                  )}/>
                                <ArrowRight className="mt-5 h-4 w-4 text-muted-foreground" />
                                <Controller control={form.control} name={`transportItems.${index}.destinationStation`} render={({ field }) => (
                                    <FormItem className="flex-1">
                                      <FormLabel className="text-xs">Destino (0=Base)</FormLabel>
                                      <FormControl><Input type="number" min="0" max={maxStation} {...field} /></FormControl>
                                    </FormItem>
                                  )}/>
                            </div>
                            <FormMessage>{form.formState.errors.transportItems?.[index]?.root?.message || form.formState.errors.transportItems?.[index]?.area?.message}</FormMessage>
                          </div>
                        ))}
                        <Button type="button" variant="outline" className="w-full" onClick={() => append({ id: crypto.randomUUID(), area: '', type: 'PAX', shift: 'M', priority: 3, originStation: 1, destinationStation: 0 })}>
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
                                      <span className="truncate">
                                        Escenario del {new Date(histScenario.id!).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                  </AccordionTrigger>
                                  <AccordionContent className='space-y-4'>
                                    <div className='text-xs text-muted-foreground space-y-2'>
                                      <p><strong>Items:</strong> {histScenario.transportItems.length}</p>
                                      <p><strong>Estaciones:</strong> {histScenario.numStations}</p>
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

          <SidebarFooter className="group-data-[collapsible=icon]:hidden">
            <SidebarMenuButton type="submit" disabled={isLoading} className="w-full" tooltip="Generar Plan de Vuelo">
              {isLoading ? <Wind className="animate-spin" /> : <Wind />}
              <span className="group-data-[collapsible=icon]:hidden">Generar Plan de Vuelo</span>
            </SidebarMenuButton>
          </SidebarFooter>
        </form>
      </Form>
    </>
  );
}
