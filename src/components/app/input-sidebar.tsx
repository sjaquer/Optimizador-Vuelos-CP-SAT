
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
        const processedValues = {
            ...values,
            transportItems: values.transportItems.map(item => ({
                ...item,
                weight: item.type === 'PAX' ? 80 : item.weight!,
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
          <SidebarHeader className="group-data-[collapsible=icon]:hidden">
              <div className='flex items-center justify-between'>
                <h2 className='font-semibold'>Configurar Escenario</h2>
                <Button
                  variant={'ghost'}
                  size="icon"
                  className='h-7 w-7'
                  onClick={() => setActiveView(v => v === 'editor' ? 'history' : 'editor')}
                  type="button"
                  aria-label="Historial"
                >
                  <History />
                </Button>
              </div>
              <CurrentDateTime />
          </SidebarHeader>

          <div className="min-h-0 flex-1">
           <ScrollArea className="h-full">
            <div className="space-y-4 p-2 group-data-[collapsible=icon]:hidden">
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
                     <h3 className="text-sm font-medium mb-2">Configuración Helicóptero</h3>
                     <div className="grid grid-cols-3 gap-2">
                        <FormField control={form.control} name="numStations" render={({ field }) => ( <FormItem><FormLabel className="text-xs">Estaciones</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem> )}/>
                        <FormField control={form.control} name="helicopterCapacity" render={({ field }) => ( <FormItem><FormLabel className="text-xs">Cap. Asientos</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem> )}/>
                        <FormField control={form.control} name="helicopterMaxWeight" render={({ field }) => ( <FormItem><FormLabel className="text-xs">Peso Máx. (kg)</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem> )}/>
                     </div>
                     <FormMessage>{form.formState.errors.numStations?.message || form.formState.errors.helicopterCapacity?.message || form.formState.errors.helicopterMaxWeight?.message}</FormMessage>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium mb-2">Items a Transportar</h3>
                    <div className="space-y-3">
                      {fields.map((field, index) => {
                        const itemType = watchedItems[index]?.type;
                        const isPax = itemType === 'PAX';
                        return (
                          <div key={field.id} className="flex flex-col gap-2 rounded-md border p-2 relative">
                            <Button type="button" variant="ghost" size="icon" className="absolute top-1 right-1 h-7 w-7 shrink-0" onClick={() => remove(index)}><Trash2 className="h-4 w-4" /></Button>
                            <div className="grid grid-cols-2 gap-2">
                              <FormField control={form.control} name={`transportItems.${index}.area`} render={({ field }) => ( <FormItem><FormLabel className="text-xs">Área</FormLabel><FormControl><Input {...field} /></FormControl></FormItem> )}/>
                              <FormField control={form.control} name={`transportItems.${index}.priority`} render={({ field }) => ( <FormItem><FormLabel className="text-xs">Prioridad</FormLabel><FormControl><Input type="number" min="1" max="5" {...field} /></FormControl></FormItem> )}/>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <FormField control={form.control} name={`transportItems.${index}.type`} render={({ field }) => ( <FormItem><FormLabel className="text-xs">Tipo</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="PAX">PAX</SelectItem><SelectItem value="CARGO">CARGO</SelectItem></SelectContent></Select></FormItem> )}/>
                                <FormField control={form.control} name={`transportItems.${index}.shift`} render={({ field }) => ( <FormItem><FormLabel className="text-xs">Turno</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="M">Mañana</SelectItem><SelectItem value="T">Tarde</SelectItem></SelectContent></Select></FormItem> )}/>
                            </div>
                            <FormField 
                                control={form.control} 
                                name={`transportItems.${index}.description`} 
                                render={({ field }) => ( 
                                    <FormItem>
                                        <FormLabel className="text-xs">Descripción</FormLabel>
                                        <FormControl>
                                            <Input 
                                                placeholder={isPax ? 'Grupo de pasajeros (auto)' : 'Carga Frágil...'} 
                                                {...field} 
                                                disabled={isPax}
                                                value={isPax ? '' : field.value || ''}
                                            />
                                        </FormControl>
                                    </FormItem> 
                                )}
                            />
                            <div className="grid grid-cols-2 gap-2">
                               <FormField 
                                  control={form.control} 
                                  name={`transportItems.${index}.quantity`} 
                                  render={({ field }) => ( 
                                      <FormItem>
                                          <FormLabel className="text-xs">{isPax ? "Cantidad" : "Cantidad"}</FormLabel>
                                          <FormControl>
                                              <Input 
                                                  type="number" min="1"
                                                  placeholder="1"
                                                  {...field} 
                                                  disabled={!isPax}
                                                  value={isPax ? field.value || 1 : 1}
                                              />
                                          </FormControl>
                                      </FormItem> 
                                  )}
                              />
                               <FormField 
                                  control={form.control} 
                                  name={`transportItems.${index}.weight`} 
                                  render={({ field }) => ( 
                                      <FormItem>
                                          <FormLabel className="text-xs">Peso (kg)</FormLabel>
                                          <FormControl>
                                              <Input 
                                                  type="number" 
                                                  {...field} 
                                                  disabled={isPax}
                                                  placeholder={isPax ? '80 (auto)' : '0'}
                                                  value={isPax ? '' : field.value || ''}
                                              />
                                          </FormControl>
                                      </FormItem> 
                                  )}
                              />
                            </div>
                            <div className="flex items-center justify-center gap-2">
                                <Controller control={form.control} name={`transportItems.${index}.originStation`} render={({ field }) => ( <FormItem className="flex-1"><FormLabel className="text-xs">Origen (0=B)</FormLabel><FormControl><Input type="number" min="0" max={maxStation} {...field} /></FormControl></FormItem> )}/>
                                <ArrowRight className="mt-5 h-4 w-4 text-muted-foreground" />
                                <Controller control={form.control} name={`transportItems.${index}.destinationStation`} render={({ field }) => ( <FormItem className="flex-1"><FormLabel className="text-xs">Destino (0=B)</FormLabel><FormControl><Input type="number" min="0" max={maxStation} {...field} /></FormControl></FormItem> )}/>
                            </div>
                            <FormMessage>{form.formState.errors.transportItems?.[index]?.root?.message || form.formState.errors.transportItems?.[index]?.area?.message || form.formState.errors.transportItems?.[index]?.weight?.message || form.formState.errors.transportItems?.[index]?.quantity?.message}</FormMessage>
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

        <SidebarFooter className="group-data-[collapsible=icon]:hidden">
          <SidebarMenuButton type="submit" disabled={isLoading} className="w-full" tooltip="Generar Plan de Vuelo">
            {isLoading ? <Wind className="animate-spin" /> : <Wind />}
            <span className="group-data-[collapsible=icon]:hidden">Generar Plan de Vuelo</span>
          </SidebarMenuButton>
        </SidebarFooter>
      </form>
    </Form>
  );
}
