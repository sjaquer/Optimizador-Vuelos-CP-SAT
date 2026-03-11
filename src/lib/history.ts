
'use client';

import type { FlightPlan, ScenarioData } from './types';

const HISTORY_KEY = 'ovh_flight_history_v2';
const MAX_HISTORY_ITEMS = 20;

export const getHistory = (): ScenarioData[] => {
  if (typeof window === 'undefined') {
    return [];
  }
  try {
    const historyJson = window.localStorage.getItem(HISTORY_KEY);
    return historyJson ? JSON.parse(historyJson) : [];
  } catch (error) {
    console.error("Failed to parse history from localStorage", error);
    return [];
  }
};

export const saveScenarioToHistory = (scenario: ScenarioData, plans?: Record<string, FlightPlan>): void => {
   if (typeof window === 'undefined') {
    return;
  }
  let history = getHistory();
  
  // Add a unique ID if it doesn't have one
  const newScenarioWithId: ScenarioData = {
      ...scenario,
      id: new Date().toISOString(),
      calculatedPlans: plans,
  };

  const newHistory = [newScenarioWithId, ...history].slice(0, MAX_HISTORY_ITEMS);
  
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory));
  } catch (error) {
    console.error("Failed to save history to localStorage", error);
  }
};

export const deleteScenarioFromHistory = (scenarioId: string): void => {
  if (typeof window === 'undefined') {
    return;
  }
  let history = getHistory();
  history = history.filter(s => s.id !== scenarioId);

  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch (error) {
     console.error("Failed to update history in localStorage", error);
  }
}
