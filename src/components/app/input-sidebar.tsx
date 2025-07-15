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
import { Bot, Plus, Trash2, Wind } from 'lucide-react';
import { Logo } from './logo';
import { useEffect, useRef } from 'react';

const passengerSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'El nombre es requerido'),
  priority: z.coerce.number().min(1).max(5),
  station: z.coerce.number().min(1),
});

const formSchema = z.object({
  numStations: z.coerce.number().min(1, 'Se requiere al menos una estación'),
  helicopterCapacity: z.coerce.number().min(1, 'La capacidad debe ser al menos 1'),
  passengers: z.array(passengerSchema),
  scenarioDescription: z.string().optional(),
});

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
      scenarioDescription: 'Un escenario de evacuación médica en una remota región montañosa con 5 clínicas de campo y un hospital principal. Varios pacientes con distintos niveles de urgencia necesitan ser transportados.',
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'passengers',
  });

  // Sincronizar el formulario cuando el escenario cambia desde el exterior (ej. importación de Excel)
  useEffect(() => {
    form.reset({
      ...scenario,
      scenarioDescription: form.getValues('scenarioDescription'),
    });
  }, [scenario, form]);


  const watchedFields = form.watch();
  const isMounted = useRef(false);

  useEffect(() => {
    // Evitar sobreescribir el estado al montar el componente
    if (!isMounted.current) {
        isMounted.current = true;
        return;
    }
    const subscription = form.watch((value) => {
      const { scenarioDescription, ...restOfScenario } = value as FormValues;
      setScenario(restOfScenario);
    });
    return () => subscription.unsubscribe();
  }, [form, setScenario]);

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
      const passengersWithId = data.passengers.map(p => ({...p, id: crypto.randomUUID()}));
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
      if (field.station > maxStation) {
        form.setValue(`passengers.${index}.station`, maxStation, { shouldValidate: true });
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
                      <div key={field.id} className="flex items-end gap-2 rounded-md border p-2">
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
                        <Controller
                          control={form.control}
                          name={`passengers.${index}.station`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Est.</FormLabel>
                              <FormControl>
                                <Input type="number" min="1" max={maxStation} className="w-16" {...field} />
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
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={() => append({ id: crypto.randomUUID(), name: '', priority: 3, station: 1 })}
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
