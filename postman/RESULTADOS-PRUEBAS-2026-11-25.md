# Resultados de pruebas de API en Postman

- Fecha: 25 de noviembre de 2026.
- Ejecución: colección `Pruebas seguras - Simulador`, contra la API de Render.
- Resultado: **5 solicitudes ejecutadas; 9 verificaciones aprobadas; 0 fallidas.**

| # | Solicitud | Respuesta observada | Verificación |
|---|---|---:|---|
| 1 | `GET /api/games` | 200 | Catálogo disponible; aparecen COIN, PUZZLE y WORD; cada juego contiene nombre y disponibilidad (3 verificaciones). |
| 2 | `GET /api/auth/me` sin token | 403 | El endpoint protegido rechaza el acceso sin sesión. |
| 3 | `GET /api/challenges/waiting` sin token | 403 | La lista protegida rechaza la consulta sin sesión. |
| 4 | `POST /api/auth/login` con credenciales ficticias | 400 | Rechaza el inicio de sesión y devuelve mensaje de error sin token (2 verificaciones). |
| 5 | `POST /api/auth/register` con correo Outlook de prueba | 400 | Rechaza el correo que no es Gmail y explica la regla (2 verificaciones). |

Las dos solicitudes `POST` usan datos de prueba inválidos para comprobar los rechazos esperados; no registran un usuario ni crean partidas o retos.

La colección importable y las pruebas automáticas están en `Pruebas-Postman-seguras.postman_collection.json`. El resultado de la ejecución también queda visible en Postman, en la pestaña de resultados de la colección.
