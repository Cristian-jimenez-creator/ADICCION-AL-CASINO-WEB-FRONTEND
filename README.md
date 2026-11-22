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

## Qué sucede en los minijuegos

- **Moneda:** cada jugador elige cara o sello; la interfaz muestra la animación del lanzamiento y el resultado que envía el backend.
- **Rompecabezas:** los dos jugadores resuelven el mismo reto visual; las imágenes dependen de las referencias disponibles en el contenido del backend.
- **Palabra o acertijo:** ambos ven la pista compartida; el tablero muestra espacios según la respuesta y la ronda tiene 40 segundos.
- La interfaz incluye controles de música/volumen, efectos de resultado, chat y una opción de voz. La música se pausa mientras se reproduce el video informativo configurado.

## Variables visibles y privacidad

VITE_API_URL, VITE_INFORMATIVE_VIDEO_URL y VITE_WEBRTC_ICE_SERVERS se incorporan al código que recibe el navegador. No son variables secretas: usa aquí solo URLs y configuración pública. La URI y contraseña de MongoDB pertenecen exclusivamente al backend y se guardan en Render como MONGODB_URI.

La opción de voz usa WebRTC. Para conexiones entre redes puede necesitar servidores ICE configurados como JSON en VITE_WEBRTC_ICE_SERVERS; una señalización exitosa por la API no garantiza por sí sola que se establezca el audio entre todos los dispositivos.

## Diagnóstico de conexión

1. Comprueba que VITE_API_URL apunta a la URL pública correcta de Render y vuelve a desplegar Vercel tras cambiar una variable VITE_*.
2. Comprueba que Render tenga APP_CORS_ALLOWED_ORIGIN con el dominio del frontend, sin una ruta adicional.
3. Abre la URL de la API desde el navegador para comprobar que el servicio responde; la ruta raíz puede mostrar una página de error de Spring aunque la API esté activa. Usa una ruta API documentada para validar una operación concreta.
4. En móvil, actualiza el sitio después del despliegue para descartar recursos almacenados en caché.
