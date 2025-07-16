
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
import type { ScenarioData, WeatherAnalysis } from '@/lib/types';
import { Plus, Trash2, Wind, ArrowRight, History, PanelLeftOpen, CloudSun, AlertTriangle, Thermometer, Gauge, Droplets, Sun } from 'lucide-react';
import { Logo } from './logo';
import { useEffect, useState } from 'react';
import { getHistory, deleteScenarioFromHistory } from '@/lib/history';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { getWeather } from '@/ai/flows/get-weather-flow';
import { Card, CardContent } from '../ui/card';
import { cn } from '@/lib/utils';
import { Skeleton } from '../ui/skeleton';

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
  weatherAnalysis: z.any().optional(),
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
  const [isWeatherLoading, setWeatherLoading] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      numStations: 6,
      helicopterCapacity: 4,
      passengers: [],
      weatherAnalysis: undefined,
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
      weatherAnalysis: scenario.weatherAnalysis,
      passengers: transformedPassengers,
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
  
  const handleGetWeather = async () => {
    setWeatherLoading(true);
    try {
      const weatherResult = await getWeather({});
      form.setValue('weatherAnalysis', weatherResult);
      toast({
        title: 'Pronóstico Obtenido',
        description: 'Se ha actualizado el estado del tiempo.',
      });
    } catch(error) {
       toast({
        variant: "destructive",
        title: "Error de Pronóstico",
        description: error instanceof Error ? error.message : "No se pudo obtener la información meteorológica.",
      });
    } finally {
      setWeatherLoading(false);
    }
  };

  const maxStation = form.watch('numStations');
  const weatherAnalysis = form.watch('weatherAnalysis');

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
              variant={activeView === 'editor' ? 'secondary' : 'ghost'}
              size="icon"
              className='h-7 w-7'
              onClick={() => setActiveView('editor')}
              aria-label="Editor"
            >
              <PanelLeftOpen />
            </Button>
            <Button
              variant={activeView === 'history' ? 'secondary' : 'ghost'}
              size="icon"
              className='h-7 w-7'
              onClick={() => setActiveView('history')}
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
                      <Button type="button" variant="outline" size="sm" onClick={handleGetWeather} disabled={isWeatherLoading} className="w-full">
                        {isWeatherLoading ? <Wind className="mr-2 animate-spin" /> : <CloudSun className="mr-2" />}
                        Obtener Pronóstico
                      </Button>
                      <WeatherDisplay analysis={weatherAnalysis} isLoading={isWeatherLoading} />
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
                                    <div className='text-xs text-muted-foreground space-y-1'>
                                      <p><strong>Pasajeros:</strong> {histScenario.passengers.length}</p>
                                      <p><strong>Estaciones:</strong> {histScenario.numStations}</p>
                                      <p><strong>Clima:</strong> {histScenario.weatherAnalysis?.summary || 'N/A'}</p>
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

function WeatherDisplay({ analysis, isLoading }: { analysis?: WeatherAnalysis, isLoading: boolean }) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-3 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <div className="flex justify-between pt-2">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!analysis) {
    return (
      <div className="text-center text-sm text-muted-foreground py-4">
        Presiona el botón para obtener el último pronóstico.
      </div>
    );
  }

  const riskColor =
    analysis.riskLevel === 'Alto' ? 'text-destructive' :
    analysis.riskLevel === 'Medio' ? 'text-yellow-500' :
    'text-green-500';

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div>
          <div className="flex items-center gap-2">
            <AlertTriangle className={cn("h-5 w-5", riskColor)} />
            <h4 className="font-semibold">Nivel de Riesgo: <span className={riskColor}>{analysis.riskLevel}</span></h4>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{analysis.summary}</p>
        </div>
        <Separator/>
        <div className="grid grid-cols-4 gap-2 text-center text-xs">
          <div className='flex flex-col items-center gap-1'>
            <Thermometer className='h-5 w-5 text-primary'/>
            <span className='font-bold'>{analysis.details.temperature}°C</span>
            <span className='text-muted-foreground'>Temp.</span>
          </div>
          <div className='flex flex-col items-center gap-1'>
            <Wind className='h-5 w-5 text-primary'/>
            <span className='font-bold'>{analysis.details.windSpeed} km/h</span>
            <span className='text-muted-foreground'>Viento</span>
          </div>
           <div className='flex flex-col items-center gap-1'>
            <Droplets className='h-5 w-5 text-primary'/>
            <span className='font-bold'>{analysis.details.precipitation}%</span>
            <span className='text-muted-foreground'>Lluvia</span>
          </div>
           <div className='flex flex-col items-center gap-1'>
            <Sun className='h-5 w-5 text-primary'/>
            <span className='font-bold'>{getWeatherCondition(analysis.details.weatherCode)}</span>
            <span className='text-muted-foreground'>Estado</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function getWeatherCondition(code: number): string {
    // WMO Weather interpretation codes
    const conditions: Record<number, string> = {
        0: 'Despejado', 1: 'Claro', 2: 'Parcial', 3: 'Nublado',
        45: 'Niebla', 48: 'Niebla',
        51: 'Llovizna Ligera', 53: 'Llovizna Mod', 55: 'Llovizna Int',
        61: 'Lluvia Ligera', 63: 'Lluvia Mod', 65: 'Lluvia Int',
        80: 'Chubascos Ligeros', 81: 'Chubascos Mod', 82: 'Chubascos Int',
        95: 'Tormenta',
    };
    return conditions[code] || 'N/A';
}
