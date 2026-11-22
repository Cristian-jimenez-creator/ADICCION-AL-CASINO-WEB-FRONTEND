# Frontend

Interfaz web independiente en React 19.3, JavaScript y Vite 7.3.8.

## Ejecutar localmente

Necesita el backend disponible en `http://localhost:8080` o una URL configurada mediante `VITE_API_URL`.

```powershell
npm install
npm run dev
```

Puedes copiar `.env.example` a `.env` y cambiar:

- `VITE_API_URL`: dirección del backend.
- `VITE_INFORMATIVE_VIDEO_URL`: URL de un archivo de video reproducible por el navegador.
- `VITE_WEBRTC_ICE_SERVERS`: arreglo JSON con los servidores ICE configurados para voz.

## Comprobaciones

```powershell
npm run lint
npm run build
```

La configuración `vercel.json` permite servir las rutas del frontend como aplicación de página única.
