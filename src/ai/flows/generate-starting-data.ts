// src/ai/flows/generate-starting-data.ts
'use server';

/**
 * @fileOverview Generates starting data for the OVH application based on a text prompt.
 *
 * - generateStartingData - A function that generates starting data.
 * - GenerateStartingDataInput - The input type for the generateStartingData function.
 * - GenerateStartingDataOutput - The return type for the generateStartingData function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateStartingDataInputSchema = z.object({
  scenarioDescription: z
    .string()
    .describe('Una descripción del escenario para el cual generar datos iniciales.'),
});
export type GenerateStartingDataInput = z.infer<typeof GenerateStartingDataInputSchema>;

const GenerateStartingDataOutputSchema = z.object({
  numStations: z.number().describe('El número de estaciones en el escenario.'),
  helicopterCapacity: z.number().describe('La capacidad del helicóptero.'),
  passengers: z.array(
    z.object({
      name: z.string().describe('El nombre del pasajero.'),
      priority: z.number().describe('La prioridad del pasajero.'),
      station: z.number().describe('La estación donde se encuentra el pasajero.'),
    })
  ).describe('La lista de pasajeros.'),
});
export type GenerateStartingDataOutput = z.infer<typeof GenerateStartingDataOutputSchema>;

export async function generateStartingData(input: GenerateStartingDataInput): Promise<GenerateStartingDataOutput> {
  return generateStartingDataFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateStartingDataPrompt',
  input: {schema: GenerateStartingDataInputSchema},
  output: {schema: GenerateStartingDataOutputSchema},
  prompt: `Eres un experto en generar datos iniciales realistas para una aplicación de optimización de rutas de helicóptero.

  Basado en la siguiente descripción del escenario, genera el número de estaciones, la capacidad del helicóptero y una lista de pasajeros con sus nombres, prioridades y ubicaciones de estación.

  Descripción del Escenario: {{{scenarioDescription}}}

  Asegúrate de que los datos sean realistas y variados. Las prioridades deben ser números enteros entre 1 y 5, siendo 1 la máxima prioridad.
  Las ubicaciones de las estaciones deben ser números enteros, comenzando en 1.
  `,
});

const generateStartingDataFlow = ai.defineFlow(
  {
    name: 'generateStartingDataFlow',
    inputSchema: GenerateStartingDataInputSchema,
    outputSchema: GenerateStartingDataOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
