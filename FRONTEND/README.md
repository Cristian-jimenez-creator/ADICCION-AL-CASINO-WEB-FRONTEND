# Frontend

Interfaz web del **Simulador de juegos con créditos ficticios**. El problema que resuelve es ofrecer a los jugadores una forma clara de registrarse, publicar retos, jugar y consultar resultados. La solución es una aplicación React que consume la API del backend; no se conecta directamente a MongoDB ni contiene credenciales de base de datos.

El frontend se despliega como sitio estático en Vercel. El backend se ejecuta por separado en Render y se conecta a MongoDB Atlas. La presentación de diseño del proyecto se usa como referencia y no se incluye en este repositorio.

## Funciones de la interfaz

- Registro e inicio de sesión.
- Saldo de créditos ficticios, recompensa diaria y límite de tiempo de juego.
- Retos públicos y partidas de moneda, rompecabezas y palabra/acertijo.
- Animaciones de los minijuegos, controles de música y efectos de resultado.
- Chat de partida, reportes y opción de voz entre jugadores.
- Diseños adaptables a pantallas de computador y teléfono.

La disponibilidad del rompecabezas y de palabra depende de que el backend tenga cargado su contenido. La voz entre redes necesita servidores ICE; sin esa configuración puede no establecerse la conexión de audio.

## Tecnologías

- React 19.3 y React DOM.
- JavaScript con módulos ES.
- Vite 7.3.8 para desarrollo y compilación.
- ESLint 9 para análisis estático.
- CSS adaptable para escritorio y móvil.
- Fetch/HTTP para comunicarse con la API y WebRTC para voz entre jugadores.

## Archivos principales

- `src/App.jsx`: pantallas, estado de sesión, llamadas a la API y minijuegos.
- `src/App.css` y `src/index.css`: estilos de las vistas y adaptación móvil.
- `package.json`: dependencias y comandos de desarrollo, análisis y compilación.
- `.env.example`: configuración pública de URL de API, video e ICE.
- `vercel.json`: reescritura de rutas para la aplicación de página única.

## Ejecutar localmente

Requisitos: Node.js y el backend iniciado en `http://localhost:8080`.

Desde la raíz del repositorio:

```powershell
cd FRONTEND
npm install
npm run dev
```

Vite muestra la URL local, normalmente `http://localhost:5173`. Para acceder a los datos y jugar, el backend y MongoDB también deben estar disponibles.

## Variables de entorno

Copia `.env.example` como `.env` dentro de esta carpeta y ajusta los valores:

| Variable | Uso |
| --- | --- |
| `VITE_API_URL` | URL base del backend; localmente `http://localhost:8080`. |
| `VITE_INFORMATIVE_VIDEO_URL` | URL de un video reproducible por el navegador para el flujo de pausa, si se configura. |
| `VITE_WEBRTC_ICE_SERVERS` | Arreglo JSON de servidores ICE para voz; queda vacío en la plantilla. |

En Vercel configura `VITE_API_URL` con la URL pública del backend de Render. `VITE_*` se incorpora al JavaScript entregado a todos los visitantes: úsalo solo para configuración pública. Nunca coloques contraseñas, tokens privados ni `MONGODB_URI` aquí. Configura el origen de Vercel también en `APP_CORS_ALLOWED_ORIGIN` del backend.

## Comprobaciones

```powershell
npm run lint
npm run build
```

La compilación se genera en `dist/`. `vercel.json` permite las rutas de una aplicación de página única.

## Despliegue en Vercel

1. Importa el repositorio `ADICCION-AL-CASINO-WEB-FRONTEND`.
2. Configura **Root Directory** como `FRONTEND`.
3. Usa `npm install` y `npm run build`; el directorio de salida es `dist`.
4. Agrega `VITE_API_URL` con la URL del servicio backend de Render.
5. Despliega y configura en Render `APP_CORS_ALLOWED_ORIGIN` con el dominio Vercel final.

El recorrido de solicitudes es: navegador → frontend en Vercel → API en Render → MongoDB Atlas. El frontend no debe conectarse directamente a Atlas.

