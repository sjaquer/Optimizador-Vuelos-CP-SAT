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
    .describe('A description of the scenario for which to generate starting data.'),
});
export type GenerateStartingDataInput = z.infer<typeof GenerateStartingDataInputSchema>;

const GenerateStartingDataOutputSchema = z.object({
  numStations: z.number().describe('The number of stations in the scenario.'),
  helicopterCapacity: z.number().describe('The capacity of the helicopter.'),
  passengers: z.array(
    z.object({
      name: z.string().describe('The name of the passenger.'),
      priority: z.number().describe('The priority of the passenger.'),
      station: z.number().describe('The station where the passenger is located.'),
    })
  ).describe('The list of passengers.'),
});
export type GenerateStartingDataOutput = z.infer<typeof GenerateStartingDataOutputSchema>;

export async function generateStartingData(input: GenerateStartingDataInput): Promise<GenerateStartingDataOutput> {
  return generateStartingDataFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateStartingDataPrompt',
  input: {schema: GenerateStartingDataInputSchema},
  output: {schema: GenerateStartingDataOutputSchema},
  prompt: `You are an expert at generating realistic starting data for a helicopter routing optimization application.

  Based on the following scenario description, generate the number of stations, helicopter capacity, and a list of passengers with their names, priorities, and station locations.

  Scenario Description: {{{scenarioDescription}}}

  Ensure that the data is realistic and varied.  Priorities should be integers between 1 and 5, with 1 being the highest priority.
  Station locations should be integers, starting at 1.
  `,config: {
    safetySettings: [
      {
        category: 'HARM_CATEGORY_HATE_SPEECH',
        threshold: 'BLOCK_ONLY_HIGH',
      },
      {
        category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
        threshold: 'BLOCK_NONE',
      },
      {
        category: 'HARM_CATEGORY_HARASSMENT',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE',
      },
      {
        category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
        threshold: 'BLOCK_LOW_AND_ABOVE',
      },
    ],
  },
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
