export interface Passenger {
  id: string;
  name: string;
  priority: number;
  originStation: number;
  destinationStation: number;
}

export interface FlightStep {
  action: 'TRAVEL' | 'PICKUP' | 'DROPOFF';
  station: number;
  passengers: Passenger[];
  notes: string;
}

export interface FlightPlan {
  id: string;
  title: string;
  steps: FlightStep[];
  metrics: {
    totalStops: number;
    totalDistance: number; 
    passengersTransported: number;
  };
}

export interface WeatherAnalysis {
  summary: string;
  riskLevel: "Bajo" | "Medio" | "Alto";
  details: {
    temperature: number;
    windSpeed: number;
    precipitation: number;
    weatherCode: number;
  };
}

export interface ScenarioData {
    id?: string; // Unique identifier for history
    numStations: number;
    helicopterCapacity: number;
    passengers: Passenger[];
    weatherAnalysis?: WeatherAnalysis;
}

// Type for Open-Meteo API response
export interface WeatherData {
  current: {
    temperature_2m: number;
    precipitation: number;
    weather_code: number;
    wind_speed_10m: number;
  };
  hourly: {
    time: string[];
    temperature_2m: number[];
    precipitation_probability: number[];
    weather_code: number[];
    wind_speed_10m: number[];
  };
}
