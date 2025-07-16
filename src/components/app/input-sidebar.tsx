
'use client';

import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  SidebarHeader,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
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
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import type { ScenarioData } from '@/lib/types';
import { Plus, Trash2, Wind, ArrowRight, History } from 'lucide-react';
import { Logo } from './logo';
import { useEffect, useState } from 'react';
import { getHistory, deleteScenarioFromHistory } from '@/lib/history';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Textarea } from '../ui/textarea';


const passengerSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'El nombre es requerido'),
  priority: z.coerce.number().min(1).max(5),
  originStation: z.coerce.number().min(0), // 0 is base
  destinationStation: z.coerce.number().min(0), // 0 is base
});

const formSchema = z.object({
  numStations: z.coerce.number().min(1, 'Se requiere al menos una estación'),
  helicopterCapacity: z.coerce.number().min(1, 'La capacidad debe ser al menos 1'),
  passengers: z.array(passengerSchema),
  weatherConditions: z.string().optional(),
  operationalNotes: z.string().optional(),
}).refine(data => {
    return data.passengers.every(p => p.originStation <= data.numStations && p.destinationStation <= data.numStations);
}, { message: "La estación debe ser menor o igual al número de estaciones", path: ["passengers"] })
 .refine(data => {
    return data.passengers.every(p => p.originStation !== p.destinationStation);
 }, { message: "El origen y destino no pueden ser iguales", path: ["passengers"] });

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
      passengers: [],
      weatherConditions: '',
      operationalNotes: '',
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'passengers',
  });

  useEffect(() => {
    const transformedPassengers = scenario.passengers.map(p => ({
        ...p,
        id: p.id || crypto.randomUUID(), 
        originStation: p.originStation,
        destinationStation: p.destinationStation,
    }))

    form.reset({
      numStations: scenario.numStations,
      helicopterCapacity: scenario.helicopterCapacity,
      passengers: transformedPassengers,
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
            description: "Por favor, corrige los errores en el formulario antes de generar un plan.",
        })
      }
    });
  }

  const loadScenarioFromHistory = (histScenario: ScenarioData) => {
    setScenario(histScenario);
    setActiveView('editor');
    toast({
      title: 'Escenario Cargado',
      description: 'Se cargó el escenario desde el historial.',
    });
  };

  const deleteScenario = (scenarioId: string | undefined) => {
    if(!scenarioId) return;
    deleteScenarioFromHistory(scenarioId);
    setHistory(getHistory()); // Refresh history view
    toast({
      title: 'Escenario Eliminado',
      description: 'El escenario seleccionado ha sido eliminado del historial.',
    });
  }

  const maxStation = form.watch('numStations');

  useEffect(() => {
    fields.forEach((field, index) => {
      const originValue = form.getValues(`passengers.${index}.originStation`);
      const destinationValue = form.getValues(`passengers.${index}.destinationStation`);
      if (originValue > maxStation) {
        form.setValue(`passengers.${index}.originStation`, maxStation, { shouldValidate: true });
      }
      if (destinationValue > maxStation) {
        form.setValue(`passengers.${index}.destinationStation`, maxStation, { shouldValidate: true });
      }
    });
  }, [maxStation, fields, form]);


  return (
    <>
      <SidebarHeader>
        <div className='flex items-center justify-between w-full'>
         <Logo />
         <div className="flex items-center gap-2 rounded-md bg-sidebar-accent p-1">
            <Button
              variant={activeView === 'history' ? 'secondary' : 'ghost'}
              size="icon"
              className='h-7 w-7'
              onClick={() => setActiveView(v => v === 'editor' ? 'history' : 'editor')}
              aria-label="Historial"
            >
              <History />
            </Button>
          </div>
        </div>
      </SidebarHeader>
      <Separator />

      {activeView === 'editor' && (
        <SidebarContent>
          <ScrollArea className="h-full px-2">
            <Form {...form}>
              <form className="flex h-full flex-col" onSubmit={handleFormSubmit} noValidate>
                <div className="flex-1">
                   <SidebarGroup>
                    <SidebarGroupLabel>Condiciones del Vuelo</SidebarGroupLabel>
                    <SidebarGroupContent className="space-y-4">
                       <FormField
                        control={form.control}
                        name="weatherConditions"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Condiciones Climáticas</FormLabel>
                            <FormControl>
                              <Textarea placeholder="Ej: Viento 15km/h, visibilidad buena..." {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                       <FormField
                        control={form.control}
                        name="operationalNotes"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Notas Operacionales</FormLabel>
                            <FormControl>
                              <Textarea placeholder="Ej: Priorizar carga frágil..." {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </SidebarGroupContent>
                  </SidebarGroup>

                  <SidebarGroup>
                    <SidebarGroupLabel>Configuración del Escenario</SidebarGroupLabel>
                    <SidebarGroupContent className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="numStations"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Estaciones</FormLabel>
                            <FormControl>
                              <Input type="number" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="helicopterCapacity"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Cap. Helicóptero</FormLabel>
                            <FormControl>
                              <Input type="number" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </SidebarGroupContent>
                  </SidebarGroup>

                  <SidebarGroup>
                    <SidebarGroupLabel>Pasajeros</SidebarGroupLabel>
                    <SidebarGroupContent className="space-y-3">
                      {fields.map((field, index) => (
                        <div key={field.id} className="flex flex-col gap-2 rounded-md border p-2">
                          <div className="flex items-end gap-2">
                            <FormField
                                control={form.control}
                                name={`passengers.${index}.name`}
                                render={({ field }) => (
                                  <FormItem className="flex-1">
                                    <FormLabel className="text-xs">Nombre</FormLabel>
                                    <FormControl>
                                      <Input {...field} />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                              <Controller
                                control={form.control}
                                name={`passengers.${index}.priority`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-xs">Prio</FormLabel>
                                    <FormControl>
                                      <Input type="number" min="1" max="5" className="w-16" {...field} />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 shrink-0"
                                onClick={() => remove(index)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                          </div>
                          <div className="flex items-center justify-center gap-2">
                              <Controller
                                control={form.control}
                                name={`passengers.${index}.originStation`}
                                render={({ field }) => (
                                  <FormItem className="flex-1">
                                    <FormLabel className="text-xs">Origen (0=Base)</FormLabel>
                                    <FormControl>
                                      <Input type="number" min="0" max={maxStation} {...field} />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                              <ArrowRight className="mt-5 h-4 w-4 text-muted-foreground" />
                              <Controller
                                control={form.control}
                                name={`passengers.${index}.destinationStation`}
                                render={({ field }) => (
                                  <FormItem className="flex-1">
                                    <FormLabel className="text-xs">Destino (0=Base)</FormLabel>
                                    <FormControl>
                                      <Input type="number" min="0" max={maxStation} {...field} />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                          </div>
                          <FormMessage>
                              {form.formState.errors.passengers?.[index]?.root?.message ||
                              form.formState.errors.passengers?.[index]?.originStation?.message ||
                              form.formState.errors.passengers?.[index]?.destinationStation?.message ||
                              form.formState.errors.passengers?.[index]?.name?.message
                              }
                          </FormMessage>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={() => append({ id: crypto.randomUUID(), name: '', priority: 3, originStation: 1, destinationStation: 0 })}
                      >
                        <Plus className="mr-2" /> Agregar Pasajero
                      </Button>
                    </SidebarGroupContent>
                  </SidebarGroup>
                </div>
                <SidebarFooter>
                  <Button type="submit" disabled={isLoading} className="w-full">
                    {isLoading ? <Wind className="mr-2 animate-spin" /> : <Wind className="mr-2" />}
                    Generar Plan de Vuelo
                  </Button>
                </SidebarFooter>
              </form>
            </Form>
          </ScrollArea>
        </SidebarContent>
      )}

      {activeView === 'history' && (
        <SidebarContent>
            <ScrollArea className="h-full px-2">
                <SidebarGroup>
                    <SidebarGroupLabel>Historial de Escenarios</SidebarGroupLabel>
                    <SidebarGroupContent>
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
                                      <p><strong>Pasajeros:</strong> {histScenario.passengers.length}</p>
                                      <p><strong>Estaciones:</strong> {histScenario.numStations}</p>
                                      <p><strong>Clima:</strong> {histScenario.weatherConditions || 'N/A'}</p>
                                      <p><strong>Notas:</strong> {histScenario.operationalNotes || 'N/A'}</p>
                                    </div>
                                    <div className='flex gap-2'>
                                      <Button size="sm" onClick={() => loadScenarioFromHistory(histScenario)} className="flex-1">Cargar</Button>
                                      <Button size="sm" variant="destructive" onClick={() => deleteScenario(histScenario.id)}><Trash2/></Button>
                                    </div>
                                  </AccordionContent>
                                </AccordionItem>
                              ))}
                            </Accordion>
                        ) : (
                            <p className="text-sm text-muted-foreground text-center py-4">No hay escenarios guardados.</p>
                        )}
                    </SidebarGroupContent>
                </SidebarGroup>
            </ScrollArea>
        </SidebarContent>
      )}
    </>
  );
}
