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
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { generateStartingData } from '@/ai/flows/generate-starting-data';
import type { ScenarioData } from '@/lib/types';
import { Bot, Plus, Trash2, Wind, ArrowRight } from 'lucide-react';
import { Logo } from './logo';
import { useEffect, useRef } from 'react';

const passengerSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'El nombre es requerido'),
  priority: z.coerce.number().min(1).max(5),
  originStation: z.coerce.number().min(1),
  destinationStation: z.coerce.number().min(0), // 0 is base
});

const formSchema = z.object({
  numStations: z.coerce.number().min(1, 'Se requiere al menos una estación'),
  helicopterCapacity: z.coerce.number().min(1, 'La capacidad debe ser al menos 1'),
  passengers: z.array(passengerSchema),
  scenarioDescription: z.string().optional(),
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
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      numStations: 6,
      helicopterCapacity: 4,
      passengers: [],
      scenarioDescription: 'Un escenario de evacuación médica en una remota región montañosa con 5 clínicas de campo y un hospital principal (Base 0). Varios pacientes con distintos niveles de urgencia necesitan ser transportados entre las clínicas y hacia el hospital principal.',
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'passengers',
  });

  // Sync form when scenario changes from outside (e.g., Excel import)
  useEffect(() => {
    // Transform passenger data to fit new schema if needed
    const transformedPassengers = scenario.passengers.map(p => ({
        ...p,
        originStation: (p as any).station ?? p.originStation, // Handle old format
        destinationStation: p.destinationStation ?? 0, // Default to base
    }))

    form.reset({
      ...scenario,
      passengers: transformedPassengers,
      scenarioDescription: form.getValues('scenarioDescription'),
    });
  }, [scenario, form]);


  const watchedFields = form.watch();
  const isMounted = useRef(false);

  useEffect(() => {
    if (!isMounted.current) {
        isMounted.current = true;
        return;
    }
    const subscription = form.watch((value, { name }) => {
        if(name?.startsWith('passengers') || name === 'numStations' || name === 'helicopterCapacity') {
             const { scenarioDescription, ...restOfScenario } = value as FormValues;
             if (form.formState.isValid) {
               setScenario(restOfScenario);
             }
        }
    });
    return () => subscription.unsubscribe();
  }, [form, setScenario, form.formState.isValid]);

  const handleGenerateData = async () => {
    const scenarioDescription = form.getValues('scenarioDescription');
    if (!scenarioDescription) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Por favor, proporciona una descripción del escenario.',
      });
      return;
    }

    try {
      const data = await generateStartingData({ scenarioDescription });
      const passengersWithId = (data as any).passengers.map((p: any) => ({
          ...p,
          id: crypto.randomUUID(),
          originStation: p.station, // Adapt from old AI output
          destinationStation: 0, // Default AI destination to base
        }));
      form.setValue('numStations', data.numStations);
      form.setValue('helicopterCapacity', data.helicopterCapacity);
      form.setValue('passengers', passengersWithId);
      
      const { scenarioDescription: desc, ...restOfScenario } = form.getValues();
      setScenario(restOfScenario);

      toast({
        title: 'Datos Generados',
        description: 'Los datos del escenario se han completado con éxito.',
      });
    } catch (error) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'Error de IA',
        description: 'No se pudieron generar los datos del escenario.',
      });
    }
  };
  
  const maxStation = form.getValues('numStations');
  
  useEffect(() => {
    fields.forEach((field, index) => {
      if (field.originStation > maxStation) {
        form.setValue(`passengers.${index}.originStation`, maxStation, { shouldValidate: true });
      }
      if (field.destinationStation > maxStation) {
        form.setValue(`passengers.${index}.destinationStation`, maxStation, { shouldValidate: true });
      }
    });
  }, [maxStation, fields, form]);


  return (
    <>
      <SidebarHeader>
        <Logo />
      </SidebarHeader>
      <Separator />
      <SidebarContent>
        <ScrollArea className="h-full px-2">
          <Form {...form}>
            <form className="flex h-full flex-col" onSubmit={(e) => e.preventDefault()}>
              <div className="flex-1">
                <SidebarGroup>
                  <SidebarGroupLabel>Generador IA</SidebarGroupLabel>
                  <SidebarGroupContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="scenarioDescription"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Prompt del Escenario</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Ej: Evacuación de una plataforma petrolífera..."
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="button" onClick={handleGenerateData} className="w-full">
                      <Bot className="mr-2" /> Generar con IA
                    </Button>
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
                                  <FormLabel className="text-xs">Origen</FormLabel>
                                  <FormControl>
                                    <Input type="number" min="1" max={maxStation} {...field} />
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
                            {form.formState.errors.passengers?.[index] && <p className="text-xs text-destructive">{form.formState.errors.passengers[index]?.root?.message}</p>}
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
            </form>
          </Form>
        </ScrollArea>
      </SidebarContent>
      <Separator />
      <SidebarFooter>
        <Button onClick={onGeneratePlans} disabled={isLoading || scenario.passengers.length === 0} className="w-full">
          {isLoading ? <Wind className="mr-2 animate-spin" /> : <Wind className="mr-2" />}
          Generar Plan de Vuelo
        </Button>
      </SidebarFooter>
    </>
  );
}
