<p align="center">
  <svg width="120" height="120" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" fill="#436964"/>
    <path d="M15.5 12.5H14v-4c0-.55-.45-1-1-1h-2c-.55 0-1 .45-1 1v4h-1.5c-.83 0-1.5.67-1.5 1.5v0c0 .83.67 1.5 1.5 1.5h1.5v1.5c0 .28.22.5.5.5h3c.28 0 .5-.22.5-.5V14h1.5c.83 0 1.5-.67 1.5-1.5v0c0-.83-.67-1.5-1.5-1.5z" fill="#00EBD1"/>
    <path d="M16 3.5c-1.1 0-2 .9-2 2v1h4v-1c0-1.1-.9-2-2-2z" fill="#436964"/>
  </svg>
</p>

<<<<<<< HEAD
# ORDEV - Optimizador de Vuelo de Helicópteros
=======
# OVH por sjaquer - Optimizador de Vuelo de Helicópteros
>>>>>>> 2624048 (Creame el readme del proyecto que se vea profesional y de una manera con)

> **“Planes de vuelo inteligentes, decisiones más rápidas.”**

---

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-15.x-black?logo=nextdotjs&logoColor=white" />
  <img src="https://img.shields.io/badge/React-18.x-blue?logo=react&logoColor=white" />
  <img src="https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/TailwindCSS-3.x-teal?logo=tailwindcss&logoColor=white" />
  <img src="https://img.shields.io/badge/Genkit-1.x-orange?logo=google&logoColor=white" />
  <img src="https://img.shields.io/badge/License-MIT-green" />
</p>

---

## 🧠 Descripción General

<<<<<<< HEAD
**ORDEV (Optimizador de Vuelo de Helicópteros)** es una aplicación web avanzada desarrollada con Next.js, React y TypeScript, diseñada para resolver el complejo problema de la planificación logística de transporte aéreo. La herramienta permite a los usuarios definir escenarios de transporte (pasajeros y carga), capacidades de helicópteros y múltiples estaciones para generar planes de vuelo optimizados.
=======
**OVH (Optimizador de Vuelo de Helicópteros)** es una aplicación web avanzada desarrollada con Next.js, React y TypeScript, diseñada para resolver el complejo problema de la planificación logística de transporte aéreo. La herramienta permite a los usuarios definir escenarios de transporte (pasajeros y carga), capacidades de helicópteros y múltiples estaciones para generar planes de vuelo optimizados.
>>>>>>> 2624048 (Creame el readme del proyecto que se vea profesional y de una manera con)

El sistema presenta múltiples propuestas de ruta, cada una enfocada en una estrategia diferente (eficiencia, prioridad de pasajeros, etc.), y las visualiza en un mapa interactivo junto a un manifiesto de vuelo detallado para cada parada.

---

## 🛠️ Historia del Desarrollo

### 🔹 Objetivo Inicial

*   Crear una interfaz de usuario intuitiva para la recolección de datos logísticos complejos.
*   Desarrollar un motor de optimización que pueda procesar los datos y generar múltiples planes de vuelo viables.
*   Presentar los resultados de una manera visualmente clara, a través de tarjetas de resumen, un mapa de ruta interactivo y un manifiesto de vuelo paso a paso.
*   Permitir la importación de datos desde archivos Excel para agilizar la carga de escenarios.

### 🔹 Desafíos Principales

*   Diseñar un algoritmo de optimización de rutas que sea rápido y eficiente, capaz de manejar múltiples restricciones (capacidad, peso, tipo de carga).
*   Desarrollar una interfaz de estado (state management) en React que maneje de forma fluida los datos del escenario, los planes calculados y la interacción del usuario sin errores de sincronización.
*   Crear una visualización de mapa SVG interactiva que represente claramente la ruta, las paradas y el progreso del vuelo.
*   Asegurar que la importación de archivos Excel sea robusta y maneje errores de formato de manera elegante.

### 🔹 Soluciones Adoptadas

*   **Next.js (App Router)** y **React (Server Components)** para una arquitectura moderna, renderizado eficiente y una excelente experiencia de usuario.
*   **TypeScript** para un desarrollo robusto y con tipado estricto, crucial para manejar las complejas estructuras de datos de los planes de vuelo.
*   **ShadCN/UI** y **Tailwind CSS** para construir una interfaz de usuario profesional, personalizable y responsiva rápidamente.
*   **React Hook Form** con **Zod** para la validación de formularios complejos, asegurando la integridad de los datos de entrada.
*   **Lógica de optimización personalizada** en `src/lib/optimizer.ts` para simular y calcular las rutas de vuelo basadas en diferentes estrategias.

---

## 📋 Estructura del Proyecto

```
ovh-sjaquer/
├── public/
├── src/
│   ├── app/
│   │   ├── globals.css         # Estilos globales y variables de tema de Tailwind
│   │   ├── layout.tsx          # Layout principal de la aplicación
│   │   └── page.tsx            # Componente principal de la página (UI y lógica central)
│   ├── components/
│   │   ├── app/                # Componentes específicos de la aplicación (InputSidebar, FlightPlanCard, RouteMap, etc.)
│   │   └── ui/                 # Componentes reutilizables de ShadCN (Button, Card, Select, etc.)
│   ├── hooks/
│   │   └── use-toast.ts        # Hook para notificaciones
│   ├── lib/
│   │   ├── history.ts          # Lógica para guardar/cargar escenarios en localStorage
│   │   ├── optimizer.ts        # **Motor principal de optimización de rutas**
│   │   ├── types.ts            # Definiciones de tipos de TypeScript para el proyecto
│   │   └── utils.ts            # Utilidades generales (cn para clases de Tailwind)
│   └── ai/
│       └── genkit.ts           # Configuración de Genkit para futuras integraciones de IA
├── next.config.ts
├── package.json
├── tailwind.config.ts
└── tsconfig.json
```

---

## 💾 Instalación y Uso

### 1. Clona el Repositorio

```bash
git clone https://github.com/sjaquer/ovh-optimizer.git
cd ovh-optimizer
```

### 2. Instala Dependencias

Asegúrate de tener Node.js instalado. Luego, ejecuta:

```bash
npm install
```

### 3. Ejecuta en Modo Desarrollo

```bash
npm run dev
```

Abre tu navegador en la URL que indique la consola (generalmente `http://localhost:9002`).

### 4. Genera el Build de Producción

Para compilar la aplicación para producción:

```bash
npm run build
```

---

## ✅ Uso y Personalización

*   **Configurar Escenario:** Utiliza la barra lateral para definir el número de estaciones, la capacidad del helicóptero y para añadir ítems (pasajeros o carga) manualmente.
*   **Importar desde Excel:** Usa el botón "Importar Excel" para cargar un escenario desde un archivo `.xlsx`. Asegúrate de que el archivo tenga las hojas "Configuracion" e "Items" con la estructura requerida.
*   **Generar Planes:** Haz clic en "Generar Plan de Vuelo" para que el motor de optimización calcule las rutas.
*   **Analizar Resultados:**
    *   **Vista de Planes:** Compara las diferentes propuestas generadas para los turnos de mañana y tarde.
    *   **Vista de Ruta:** Selecciona un plan para verlo en el mapa interactivo. Usa el slider o los botones para avanzar paso a paso y ver el manifiesto actualizado en cada parada.

---

## 📝 Licencia

Este proyecto está bajo la Licencia MIT. Puedes usarlo, modificarlo y distribuirlo libremente.

---

## 👨‍💻 Autor

<<<<<<< HEAD
Desarrollado con dedicación por **sjaquer**.
=======
Desarrollado con dedicación por **sjaquer**.
>>>>>>> 2624048 (Creame el readme del proyecto que se vea profesional y de una manera con)
