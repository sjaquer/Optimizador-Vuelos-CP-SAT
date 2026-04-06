# Optimizador de Vuelos CP-SAT

Aplicacion web para planificar operaciones de transporte aereo en helicoptero, optimizando rutas de pasajeros y carga bajo restricciones operativas reales.

## Resumen

Este proyecto permite modelar un escenario logistico con estaciones, capacidad de helicoptero, peso maximo y requerimientos de transporte por turno (Manana/Tarde). A partir de esos datos, genera un plan optimizado y alternativas comparables para apoyar la toma de decisiones en operaciones.

La interfaz esta disenada para operacion diaria: carga manual de datos, importacion desde Excel, visualizacion de ruta, manifiesto por etapa y metricas de desempeno.

## Funcionalidades principales

- Definicion de escenario operativo (estaciones, capacidad, payload y parametros de mision).
- Gestion de items de transporte para pasajeros (PAX) y carga (CARGO).
- Priorizacion por nivel 1 a 3 (1 = mas urgente).
- Calculo de planes por turno con variantes de estrategia.
- Visualizacion de resultados en tarjetas, ruta y bitacora/itinerario.
- Manifiesto por paso de vuelo (embarque, desembarque y tramos).
- Importacion de escenario desde Excel con validaciones.
- Descarga de plantilla Excel para captura estructurada.

## Stack tecnologico

- Next.js 15 (App Router)
- React 18
- TypeScript
- Tailwind CSS
- shadcn/ui + Radix UI
- React Hook Form + Zod
- ExcelJS

## Estructura del proyecto

```text
.
|-- docs/
|-- public/
|-- src/
|   |-- app/                # Punto de entrada y layout
|   |-- components/
|   |   |-- app/            # Componentes de negocio
|   |   |-- ui/             # Componentes base reutilizables
|   |-- hooks/
|   |-- lib/                # Tipos, optimizador, utilidades y helpers
|-- apphosting.yaml
|-- next.config.ts
|-- package.json
|-- tailwind.config.ts
|-- tsconfig.json
```

## Requisitos

- Node.js 20 o superior recomendado.
- npm 10 o superior recomendado.

## Puesta en marcha

1. Instalar dependencias:

```bash
npm install
```

2. Ejecutar en desarrollo:

```bash
npm run dev
```

La aplicacion corre por defecto en:

```text
http://localhost:9002
```

## Scripts disponibles

- `npm run dev`: inicia el entorno de desarrollo con Turbopack en puerto 9002.
- `npm run build`: genera build de produccion.
- `npm run start`: levanta la aplicacion en modo produccion.
- `npm run lint`: ejecuta linting con Next.js.
- `npm run typecheck`: valida tipos con TypeScript sin emitir artefactos.

## Flujo de uso recomendado

1. Configurar parametros del helicoptero y numero de estaciones.
2. Cargar items manualmente o importar archivo Excel.
3. Ejecutar generacion de planes para ambos turnos.
4. Comparar plan optimo y alternativas.
5. Revisar metricas, mapa de ruta y manifiesto paso a paso.

## Formato Excel

La importacion espera dos hojas:

- `Configuracion`: claves operativas (estaciones, capacidad y peso maximo).
- `Items`: detalle de solicitudes de transporte.

Campos clave de `Items`:

- `tipo`: `PAX` o `CARGO`.
- `turno`: `M` o `T`.
- `prioridad`: valores 1, 2 o 3.
- `origen` y `destino`: IDs de estacion.
- `cantidad`: requerido para PAX.
- `peso`: requerido para CARGO.

Tip: usa la plantilla descargable de la app para evitar errores de formato.

## Estado del proyecto

Proyecto funcional para operacion y simulacion de escenarios logisticos con foco en planificacion tactica de vuelos.

## Licencia

MIT.

## Autor

sjaquer