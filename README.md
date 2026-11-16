# Landing HydroSmart

Página pública de HydroSmart, desarrollada por AquaPulse. Incluye los perfiles y retratos del capítulo 1 del informe `TP1_1ASI0657_202620_1832_GRUPO5.md`.

## Vista previa local

Desde esta carpeta, ejecuta `npx --yes vite@8.3.8 --host 127.0.0.1 --port 4173` y abre [la landing](http://127.0.0.1:4173/). Este comando sirve la página estática. El registro y el inicio de sesión requieren la aplicación en el mismo origen.

El entorno local de HydroSmart sirve la landing y la aplicación mediante Caddy. Consulta [el arranque local](../README.md). Lenis y la API DOM de Framer Motion se cargan desde jsDelivr con versiones fijas. La navegación y el contenido siguen disponibles si falla la conexión o el navegador tiene activada la reducción de movimiento.
