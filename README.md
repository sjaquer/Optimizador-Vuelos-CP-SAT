# 🚁 Optimizador de Vuelos CP-SAT

Una plataforma integral de planificación y optimización de operaciones de transporte aéreo en helicóptero. Utiliza el solver CP-SAT de Google OR-Tools para calcular rutas optimizadas considerando restricciones operativas, capacidad de carga, prioridades y múltiples escenarios de vuelo.

---

## 📋 Descripción General

**ORDEV** es una aplicación web especializada para operadores de helicópteros y coordinadores logísticos que necesitan:

- Planificar y optimizar rutas de transporte de pasajeros (PAX) y carga (CARGO)
- Minimizar tiempos de vuelo y costos operativos
- Gestionar restricciones de peso, capacidad y alcance del helicóptero
- Visualizar itinerarios completos con manifiestos detallados
- Comparar múltiples alternativas de vuelo
- Generar reportes para auditoría y documentación

La aplicación modela escenarios logísticos reales con estaciones distribuidas geográficamente, parámetros operativos del helicóptero, y requerimientos de transporte clasificados por turno (Mañana/Tarde) y prioridad (Alta/Media/Baja). El motor de optimización calcula planes viables y alternatives comparables para apoyar la toma de decisiones.

---

## ✨ Características Principales

### 🎯 Gestión de Escenarios Operativos
- **Definición de estaciones**: Crear y gestionar múltiples estaciones con coordenadas geográficas reales
- **Parámetros del helicóptero**: Configurar capacidad de pasajeros, peso máximo permitido, peso por defecto de pasajeros
- **Restricciones de reabastecimiento**: Definir distancia máxima de vuelo antes de retornar a base para refueling
- **Detalles de misión**: Registrar piloto, copiloto, matrícula de aeronave, objetivo de misión y notas operacionales

### 📦 Gestión de Items de Transporte
- **Creación flexible**: Agregar pasajeros o cargas con origen, destino, peso y descripción
- **Clasificación por turno**: Organizar transportes en turnos (Mañana/Tarde) para planificación por período
- **Sistema de prioridades**: Asignar niveles de urgencia (Alta/Media/Baja) para influir en secuencia de vuelos
- **Validación de datos**: Validación en tiempo real de pesos, capacidades y requerimientos
- **Importación desde Excel**: Cargar escenarios completos desde archivos Excel con estructura configurable
- **Descarga de plantilla**: Obtener plantilla Excel pre-formateada para carga de datos estandarizada

### 🧮 Motor de Optimización (CP-SAT)
- **Cálculo automático**: Genera planes de vuelo optimizados considerando todas las restricciones
- **Múltiples variantes**: Calcula alternativas de estrategia para comparación
- **Minimización inteligente**: Optimiza para minimizar tiempos de viaje, cambios de dirección y costos operativos
- **Validación de factibilidad**: Identifica items imposibles de transportar bajo las restricciones actuales
- **Análisis de carga**: Calcula ratios de peso y utilización de capacidad

### 🗺️ Visualización de Resultados
- **Mapa de ruta interactivo**: Representación visual de la ruta del helicóptero con estaciones, paradas y recorridos
- **Tarjetas de planes**: Visualización resumida de alternativas de vuelo con métricas clave
- **Código de colores**: Diferenciación visual de tipos de tramo (PAX, CARGO, VACÍO)
- **Leyenda de estaciones**: Referencias claras de ubicaciones y características de cada estación
- **Alertas de clima**: Indicadores visuales de condiciones meteorológicas que afecten operaciones

### 📋 Manifiestos y Reportes
- **Itinerario detallado**: Desglose completo de cada paso de vuelo con acciones (TRAVEL, PICKUP, DROPOFF, REFUEL)
- **Manifiesto por tramo**: Especificación de items embarcados, desembarcados en cada etapa
- **Métricas de desempeño**:
  - Número total de paradas y distancia volada
  - Cantidad de items transportados vs no entregados
  - Peso total y ratios de utilización
  - Número de refuelings necesarios
  - Estimaciones de tiempo de vuelo
- **Exportación de reportes**: Generar reportes en CSV o PDF para documentación y auditoría

### 🔐 Seguridad y Autenticación
- **Sistema de login**: Autenticación de usuarios antes de acceso a operaciones
- **Gestión de sesión**: Control de acceso con soporte para múltiples usuarios

### 🎨 Experiencia de Usuario
- **Tour de onboarding**: Guía interactiva para nuevos usuarios
- **Modo oscuro/claro**: Toggle de tema para diferentes ambientes
- **Interfaz intuitiva**: Diseño optimizado para operaciones en campo y oficina
- **Validaciones en tiempo real**: Feedback inmediato sobre datos ingresados
- **Historial de escenarios**: Guardar y recuperar escenarios previos para reutilización

---

## 🏗️ Stack Tecnológico

### Frontend
- **Next.js 15** - Framework React con App Router para máximo rendimiento
- **React 18** - Biblioteca UI con hooks modernos
- **TypeScript** - Type safety para desarrollo robusto
- **Tailwind CSS** - Utilidades CSS para diseño responsive
- **shadcn/ui** - Componentes accesibles basados en Radix UI
- **Radix UI** - Primitivos de UI con accesibilidad integrada

### Formularios y Validación
- **React Hook Form** - Gestión eficiente de formularios
- **Zod** - Validación de esquemas TypeScript-first

### Datos e Importación
- **ExcelJS** - Lectura/escritura de archivos Excel
- **jsPDF + jspdf-autotable** - Generación de reportes PDF

### Visualización
- **Recharts** - Gráficos y visualizaciones de datos
- **Lucide React** - Iconografía moderna y consistente

### Utilidades
- **next-themes** - Gestión de temas (modo oscuro/claro)
- **clsx & tailwind-merge** - Utilidades CSS avanzadas

---

## 📁 Estructura del Proyecto

```
optimizador-vuelos-cp-sat/
├── src/
│   ├── app/
│   │   ├── globals.css              # Estilos globales
│   │   ├── layout.tsx               # Layout principal de la app
│   │   ├── page.tsx                 # Página principal (home)
│   │   └── api/
│   │       └── download-template/   # Endpoint para descargar plantilla Excel
│   │
│   ├── components/
│   │   ├── app/                     # Componentes de dominio/negocio
│   │   │   ├── login-screen.tsx     # Pantalla de autenticación
│   │   │   ├── input-sidebar.tsx    # Formulario de ingreso de datos
│   │   │   ├── flight-plan-card.tsx # Tarjeta de plan de vuelo
│   │   │   ├── flight-manifest.tsx  # Manifiesto detallado
│   │   │   ├── flight-itinerary.tsx # Itinerario de vuelo
│   │   │   ├── route-map.tsx        # Visualización de ruta
│   │   │   ├── station-legend.tsx   # Leyenda de estaciones
│   │   │   ├── weather-alert.tsx    # Alertas meteorológicas
│   │   │   ├── station-manager.tsx  # Gestión de estaciones
│   │   │   ├── theme-toggle.tsx     # Control de tema
│   │   │   ├── error-boundary.tsx   # Manejo de errores
│   │   │   ├── current-date-time.tsx # Información de fecha/hora
│   │   │   ├── welcome-screen.tsx   # Pantalla de bienvenida
│   │   │   ├── onboarding-tour.tsx  # Tour interactivo
│   │   │   └── theme-provider.tsx   # Proveedor de tema
│   │   │
│   │   └── ui/                      # Componentes reutilizables
│   │       ├── button.tsx, input.tsx, select.tsx
│   │       ├── card.tsx, dialog.tsx, sheet.tsx
│   │       ├── form.tsx, checkbox.tsx, radio-group.tsx
│   │       ├── table.tsx, tabs.tsx, accordion.tsx
│   │       ├── sidebar.tsx, dropdown-menu.tsx
│   │       └── [otros componentes base]
│   │
│   ├── hooks/
│   │   ├── use-mobile.tsx           # Detección de dispositivo móvil
│   │   └── use-toast.ts             # Sistema de notificaciones
│   │
│   └── lib/
│       ├── types.ts                 # Interfaces y tipos principales
│       ├── optimizer.ts             # Motor de optimización CP-SAT
│       ├── stations.ts              # Configuración de estaciones
│       ├── history.ts               # Gestión de historial
│       ├── download-template.ts     # Lógica de plantilla Excel
│       └── utils.ts                 # Utilidades generales
│
├── public/
│   └── images/                      # Recursos estáticos
│
├── docs/
│   └── blueprint.md                 # Especificación de diseño y features
│
├── next.config.ts                   # Configuración de Next.js
├── tsconfig.json                    # Configuración de TypeScript
├── tailwind.config.ts               # Configuración de Tailwind CSS
├── postcss.config.mjs               # Configuración de PostCSS
├── package.json                     # Dependencias y scripts
├── components.json                  # Configuración de shadcn/ui
└── README.md                        # Esta documentación
```

---

## 🚀 Cómo Empezar

### Requisitos
- Node.js 18+ o superior
- npm o yarn como gestor de paquetes

### Instalación

1. **Clonar repositorio**
   ```bash
   git clone <repo-url>
   cd optimizador-vuelos-cp-sat
   ```

2. **Instalar dependencias**
   ```bash
   npm install
   ```

3. **Variables de entorno** (si aplica)
   ```bash
   # Crear archivo .env.local
   # Agregar variables necesarias para autenticación u otros servicios
   ```

### Desarrollo

**Iniciar servidor de desarrollo:**
```bash
npm run dev
```

La aplicación estará disponible en `http://localhost:9002`

**Verificación de tipos:**
```bash
npm run typecheck
```

**Linting:**
```bash
npm run lint
```

### Producción

**Build de producción:**
```bash
npm run build
npm start
```

---

## 📖 Uso de la Aplicación

### 1. **Autenticación**
   - Ingresar credenciales en la pantalla de login
   - Acceso autorizado a la plataforma de optimización

### 2. **Definir Escenario Operativo**
   - Configurar estaciones geográficas (coordenadas en km)
   - Establecer parámetros del helicóptero (capacidad, peso máximo)
   - Opcionalmente configurar restricciones de reabastecimiento

### 3. **Cargar Items de Transporte**
   Opción A: **Manual**
   - Agregar cada pasajero/carga con origen, destino, peso y prioridad
   
   Opción B: **Importar desde Excel**
   - Descargar plantilla desde la app
   - Completar datos en Excel
   - Cargar archivo en la aplicación

### 4. **Ejecutar Optimización**
   - Clic en botón "Calcular Plan"
   - El motor CP-SAT genera alternativas de vuelo automáticamente

### 5. **Revisar Resultados**
   - **Tarjetas**: Ver resumen de cada plan alternativo
   - **Mapa**: Visualizar ruta geográfica con paradas
   - **Itinerario**: Desglose detallado de cada paso
   - **Manifiesto**: Items embarcados por tramo
   - **Métricas**: Análisis de desempeño (distancia, carga, tiempo)

### 6. **Exportar y Documentar**
   - Descargar reporte en PDF o CSV
   - Guardar escenario en historial local
   - Imprimir o compartir planes

---

## 🔧 Características Técnicas

### Algoritmo de Optimización
- **Solver**: Google OR-Tools CP-SAT (Constraint Programming)
- **Objetivo**: Minimizar distancia total, número de vuelos y cambios de dirección
- **Restricciones**:
  - Capacidad máxima del helicóptero (PAX y CARGO)
  - Peso máximo permitido
  - Distancia máxima de vuelo (con reabastecimiento)
  - Prioridades de entrega
  - Segregación de turnos (Mañana/Tarde)

### Tipos de Datos Principales

**Estación (StationConfig)**
- ID único (slug), nombre, coordenadas X/Y en km, indicador de base

**Item de Transporte (TransportItem)**
- ID, área, tipo (PAX/CARGO), turno (M/T), prioridad, cantidad, peso, origen, destino

**Plan de Vuelo (FlightPlan)**
- Título, descripción, pasos de vuelo (TRAVEL/PICKUP/DROPOFF/REFUEL)
- Métricas: distancia, paradas, items transportados, ratios de carga

**Escenario (ScenarioData)**
- Estaciones, capacidades, items, condiciones climáticas, planes calculados

### Almacenamiento
- **Local Storage**: Historial de escenarios en navegador
- **IndexedDB**: Datos persistentes (opcional)
- **No requiere backend**: Toda la lógica de optimización es client-side

---

## 🎨 Guía de Estilo

- **Color primario**: Azul fuerte (#436964) - competencia y seguridad
- **Color de fondo**: Gris claro (#E8C020) - diseño minimalista
- **Color de acento**: Turquesa (#00EBD1) - CTAs e información destacada
- **Tipografía**: Inter, sans-serif - claridad en presentación de datos
- **Iconografía**: Lucide React con peso de trazo consistente

---

## 📊 Casos de Uso

✅ **Operadores de Helicópteros**: Planificar vuelos diarios optimizando combustible y tiempo

✅ **Coordinadores Logísticos**: Gestionar múltiples transportes simultáneamente

✅ **Empresas de Transporte Aéreo**: Comparar alternativas antes de ejecutar operaciones

✅ **Estudios de Factibilidad**: Modelar escenarios hipotéticos y analizar viabilidad

✅ **Auditoría**: Documentar decisiones operacionales con reportes detallados

---

## 📝 Licencia

Este proyecto está desarrollado como herramienta interna. Revisar términos específicos con el propietario.

---

## 👤 Autor

**sjaquer** - Desarrollador principal

---

## 🤝 Soporte y Contribuciones

Para reportar bugs, sugerencias o contribuciones, contactar al equipo de desarrollo.

---

**Última actualización**: Junio 2026

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