'use client';

import { useState } from 'react';
import {
  SidebarProvider,
  Sidebar,
  SidebarInset,
  SidebarHeader,
  SidebarContent,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { InputSidebar } from '@/components/app/input-sidebar';
import type { FlightPlan, ScenarioData } from '@/lib/types';
import { generatePlan, generateAlternativePlan } from '@/lib/optimizer';
import { FlightPlanCard } from '@/components/app/flight-plan-card';
import { RouteMap } from '@/components/app/route-map';
import { Logo } from '@/components/app/logo';
import { Bot, Map, ListCollapse, Wind } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export default function Home() {
  const [scenario, setScenario] = useState<ScenarioData>({
    numStations: 6,
    helicopterCapacity: 4,
    passengers: [],
  });
  const [flightPlans, setFlightPlans] = useState<FlightPlan[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('plans');

  const handleGeneratePlans = () => {
    setIsLoading(true);
    setFlightPlans([]);
    setTimeout(() => {
      const plan1 = generatePlan(scenario);
      const plan2 = generateAlternativePlan(scenario);
      setFlightPlans([plan1, plan2]);
      setIsLoading(false);
      setActiveTab('plans');
    }, 500);
  };

  const selectedPlan = flightPlans[0];

  return (
    <SidebarProvider>
      <Sidebar>
        <InputSidebar
          scenario={scenario}
          setScenario={setScenario}
          onGeneratePlans={handleGeneratePlans}
          isLoading={isLoading}
        />
      </Sidebar>
      <SidebarInset>
        <div className="flex h-full flex-col">
          <header className="flex h-14 items-center justify-between border-b bg-card/50 px-4">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="md:hidden" />
              <Logo />
            </div>
            <Button variant="outline" size="sm" disabled>
              Importar desde Excel
            </Button>
          </header>
          <main className="flex-1 overflow-auto p-4 md:p-6">
            {flightPlans.length === 0 ? (
              <WelcomeScreen isLoading={isLoading} />
            ) : (
              <div className="flex flex-col gap-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold tracking-tight">
                    Planes de Vuelo Optimizados
                  </h2>
                  <div className="flex items-center gap-2 rounded-md bg-muted p-1">
                    <Button
                      variant={activeTab === 'plans' ? 'secondary' : 'ghost'}
                      size="sm"
                      onClick={() => setActiveTab('plans')}
                      className="h-8"
                    >
                      <ListCollapse className="mr-2 h-4 w-4" />
                      Planes
                    </Button>
                    <Button
                      variant={activeTab === 'map' ? 'secondary' : 'ghost'}
                      size="sm"
                      onClick={() => setActiveTab('map')}
                      className="h-8"
                    >
                      <Map className="mr-2 h-4 w-4" />
                      Ruta
                    </Button>
                  </div>
                </div>
                {activeTab === 'plans' && (
                  <div className="grid gap-6 lg:grid-cols-2">
                    {flightPlans.map((plan) => (
                      <FlightPlanCard key={plan.id} plan={plan} scenario={scenario} />
                    ))}
                  </div>
                )}
                {activeTab === 'map' && selectedPlan && (
                  <RouteMap plan={selectedPlan} numStations={scenario.numStations} />
                )}
              </div>
            )}
          </main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

function WelcomeScreen({ isLoading }: { isLoading: boolean }) {
  return (
    <div className="flex h-full items-center justify-center">
      <Card className="w-full max-w-lg text-center">
        <CardContent className="p-8">
          {isLoading ? (
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <Wind className="h-16 w-16 animate-spin text-primary" style={{ animationDuration: '3s' }} />
                <Bot className="absolute inset-0 m-auto h-8 w-8 text-primary/80" />
              </div>
              <h3 className="text-xl font-semibold">Generando Planes...</h3>
              <p className="text-muted-foreground">
                Nuestra IA está calculando las rutas más eficientes. Por favor espera un momento.
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <Bot className="h-16 w-16 text-primary" />
              <h3 className="text-xl font-semibold">Bienvenido a OVH</h3>
              <p className="text-muted-foreground">
                Define tu escenario en la barra lateral izquierda, luego haz clic en "Generar Plan de Vuelo" para comenzar.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
