# Frontend del simulador

Aplicación web para registrarse, publicar retos y jugar con créditos ficticios. Resuelve la necesidad de dar a los jugadores una interfaz accesible para usar los minijuegos; React consume la API del backend para consultar y guardar el estado de la cuenta y las partidas.

## Tecnologías

- React 19.3 y JavaScript.
- Vite 7.3.8 y ESLint 9.
- CSS adaptable, HTTP/REST y WebRTC para voz entre jugadores.

## Cómo se conecta

```text
Navegador → Frontend en Vercel → Backend en Render → MongoDB Atlas
```

El frontend no usa ni debe contener la URI, contraseña o credenciales de MongoDB. En Vercel configura `VITE_API_URL` con la URL pública de Render. En Render, `APP_CORS_ALLOWED_ORIGIN` debe permitir el dominio de Vercel.

## Funciones principales

- Registro e inicio de sesión.
- Saldo ficticio, retos públicos y minijuegos de moneda, rompecabezas y palabras.
- Animaciones, música, efectos, chat, reportes y controles de voz.
- Diseño adaptable a computadores y teléfonos.

Los rompecabezas y las palabras dependen del contenido cargado en el backend. La voz entre redes requiere servidores ICE configurados.

## Archivos

- `FRONTEND/src/App.jsx`: pantallas, estado, llamadas al backend y juegos.
- `FRONTEND/src/App.css` y `FRONTEND/src/index.css`: estilos.
- `FRONTEND/package.json`: dependencias y comandos.
- `FRONTEND/.env.example`: variables de entorno públicas de ejemplo.
- `FRONTEND/vercel.json`: rutas de la aplicación de página única.
- `FRONTEND/README.md`: pasos de desarrollo, configuración y despliegue.

Para Vercel, configura la carpeta raíz como `FRONTEND`, el comando de compilación como `npm run build` y el directorio de salida como `dist`. Consulta la [guía completa](FRONTEND/README.md).