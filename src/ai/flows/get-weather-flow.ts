'use server';
/**
 * @fileOverview A weather analysis AI agent for flight operations.
 *
 * - getWeather - A function that fetches and analyzes weather data for a specific location.
 * - WeatherInput - The input type for the getWeather function (currently empty as location is fixed).
 * - WeatherOutput - The return type for the getWeather function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import type { WeatherData } from '@/lib/types';

// Coordinates for Nuevo Mundo, Cusco, Perú
const LATITUDE = -13.53;
const LONGITUDE = -71.96;

const WeatherInputSchema = z.object({});
export type WeatherInput = z.infer<typeof WeatherInputSchema>;

const WeatherOutputSchema = z.object({
    summary: z.string().describe("Un resumen conciso del pronóstico del tiempo para las próximas horas, relevante para operaciones de helicópteros."),
    riskLevel: z.enum(["Bajo", "Medio", "Alto"]).describe("El nivel de riesgo evaluado para las operaciones de vuelo basado en el pronóstico."),
    details: z.object({
        temperature: z.number().describe("Temperatura actual en grados Celsius."),
        windSpeed: z.number().describe("Velocidad actual del viento en km/h."),
        precipitation: z.number().describe("Probabilidad de precipitación en la próxima hora (%)."),
        weatherCode: z.number().describe("Código numérico del clima actual (WMO).")
    }).describe("Datos meteorológicos detallados y actuales.")
});
export type WeatherOutput = z.infer<typeof WeatherOutputSchema>;


async function fetchWeatherFromAPI(): Promise<WeatherData> {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${LATITUDE}&longitude=${LONGITUDE}&current=temperature_2m,precipitation,weather_code,wind_speed_10m&hourly=temperature_2m,precipitation_probability,weather_code,wind_speed_10m&wind_speed_unit=kmh&timezone=America%2FLima`;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Error fetching weather data: ${response.statusText}`);
        }
        const data = await response.json();
        return data as WeatherData;
    } catch (error) {
        console.error("Failed to fetch weather from API", error);
        throw new Error("No se pudo contactar con el servicio meteorológico.");
    }
}

const getWeatherTool = ai.defineTool(
    {
        name: 'getWeatherTool',
        description: 'Obtiene los datos meteorológicos actuales y el pronóstico para una ubicación específica (Cusco, Perú).',
        inputSchema: z.void(),
        outputSchema: z.any(), // API response can be complex, let the prompt handle it
    },
    async () => {
        return await fetchWeatherFromAPI();
    }
);

const prompt = ai.definePrompt({
  name: 'weatherAnalysisPrompt',
  input: { schema: WeatherInputSchema },
  output: { schema: WeatherOutputSchema },
  tools: [getWeatherTool],
  prompt: `Eres un meteorólogo experto en aviación. Analiza los datos meteorológicos proporcionados por la herramienta para "Nuevo Mundo, Cusco, Perú".

Tu tarea es:
1.  Generar un **resumen conciso** (2-3 frases) del pronóstico, destacando las condiciones más relevantes para la seguridad de los vuelos de helicóptero (viento, visibilidad, precipitación).
2.  Evaluar un **nivel de riesgo** para las operaciones de vuelo (Bajo, Medio, Alto) basado en los datos. Considera lo siguiente como guía:
    - **Alto:** Velocidades de viento superiores a 40 km/h, alta probabilidad de tormentas eléctricas o lluvia intensa, niebla densa.
    - **Medio:** Velocidades de viento entre 25-40 km/h, probabilidad de lluvia moderada, nubes bajas.
    - **Bajo:** Condiciones despejadas o parcialmente nubladas, vientos ligeros por debajo de 25 km/h, sin precipitaciones significativas.
3.  Extraer los **detalles actuales** más importantes: temperatura, velocidad del viento, probabilidad de precipitación y el código del clima.

Utiliza la herramienta 'getWeatherTool' para obtener los datos necesarios. Responde únicamente con el formato JSON solicitado.`,
});


const getWeatherFlow = ai.defineFlow(
  {
    name: 'getWeatherFlow',
    inputSchema: WeatherInputSchema,
    outputSchema: WeatherOutputSchema,
  },
  async () => {
    const { output } = await prompt({});
    return output!;
  }
);


export async function getWeather(input: WeatherInput): Promise<WeatherOutput> {
    return getWeatherFlow(input);
}
