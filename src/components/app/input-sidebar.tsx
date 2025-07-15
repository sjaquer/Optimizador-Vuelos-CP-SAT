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
import { useEffect } from 'react';

const passengerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  priority: z.coerce.number().min(1).max(5),
  station: z.coerce.number().min(1),
});

const formSchema = z.object({
  numStations: z.coerce.number().min(1, 'At least one station is required'),
  helicopterCapacity: z.coerce.number().min(1, 'Capacity must be at least 1'),
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
      numStations: scenario.numStations,
      helicopterCapacity: scenario.helicopterCapacity,
      passengers: scenario.passengers,
      scenarioDescription: 'A medical evacuation scenario in a remote mountainous region with 5 field clinics and one main hospital. Several patients with varying urgency levels need to be transported.',
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'passengers',
  });

  const watchAllFields = form.watch();

  useEffect(() => {
    const { scenarioDescription, ...restOfScenario } = watchAllFields;
    const passengersWithId = restOfScenario.passengers.map(p => ({ ...p, id: crypto.randomUUID() }));
    setScenario({ ...restOfScenario, passengers: passengersWithId });
  }, [watchAllFields, setScenario]);

  const handleGenerateData = async () => {
    const scenarioDescription = form.getValues('scenarioDescription');
    if (!scenarioDescription) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please provide a scenario description.',
      });
      return;
    }

    try {
      const data = await generateStartingData({ scenarioDescription });
      form.setValue('numStations', data.numStations);
      form.setValue('helicopterCapacity', data.helicopterCapacity);
      form.setValue('passengers', data.passengers);
      toast({
        title: 'Data Generated',
        description: 'Scenario data has been populated successfully.',
      });
    } catch (error) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'AI Error',
        description: 'Failed to generate data from the scenario.',
      });
    }
  };
  
  const maxStation = form.getValues('numStations');
  
  useEffect(() => {
    fields.forEach((field, index) => {
      if (field.station > maxStation) {
        form.setValue(`passengers.${index}.station`, maxStation);
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
        <ScrollArea className="h-full">
          <Form {...form}>
            <form className="flex h-full flex-col">
              <div className="flex-1">
                <SidebarGroup>
                  <SidebarGroupLabel>AI Generator</SidebarGroupLabel>
                  <SidebarGroupContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="scenarioDescription"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Scenario Prompt</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="e.g., An offshore oil rig evacuation..."
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="button" onClick={handleGenerateData} className="w-full">
                      <Bot className="mr-2" /> Generate with AI
                    </Button>
                  </SidebarGroupContent>
                </SidebarGroup>

                <SidebarGroup>
                  <SidebarGroupLabel>Scenario Setup</SidebarGroupLabel>
                  <SidebarGroupContent className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="numStations"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Stations</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="helicopterCapacity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Heli Capacity</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </SidebarGroupContent>
                </SidebarGroup>

                <SidebarGroup>
                  <SidebarGroupLabel>Passengers</SidebarGroupLabel>
                  <SidebarGroupContent className="space-y-3">
                    {fields.map((field, index) => (
                      <div key={field.id} className="flex items-end gap-2 rounded-md border p-2">
                        <FormField
                          control={form.control}
                          name={`passengers.${index}.name`}
                          render={({ field }) => (
                            <FormItem className="flex-1">
                              <FormLabel>Name</FormLabel>
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
                              <FormLabel>Prio</FormLabel>
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
                              <FormLabel>Station</FormLabel>
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
                      onClick={() => append({ name: '', priority: 3, station: 1 })}
                    >
                      <Plus className="mr-2" /> Add Passenger
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
          Generate Flight Plan
        </Button>
      </SidebarFooter>
    </>
  );
}
