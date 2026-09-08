# LAN Strike Lite

Prototipo de shooter táctico **1 contra 1** para red local. Se ejecuta en un PC/Raspberry Pi/mini servidor con Node.js y se abre desde navegadores de PC o móvil; no depende de Internet ni de cuentas externas.

No es una copia ni usa recursos de Counter-Strike: mapas, armas, habilidades y código son originales.

## Inicio rápido

1. Instala [Node.js 18 o posterior](https://nodejs.org/).
2. Descarga o clona el repositorio y, dentro de la carpeta, ejecuta:

   ```bash
   npm start
   ```

3. En el equipo servidor abre `http://localhost:8080`. Para otros dispositivos conectados al mismo Wi-Fi, usa la URL `http://IP-LOCAL-DEL-SERVIDOR:8080` que imprime la consola.

No hay dependencias de npm: el repositorio está listo para ejecutarse tras descargarlo.

## Seguridad de red local

- El proceso acepta WebSocket sólo desde la subred local detectada al arrancar. Las solicitudes HTTP de IPs ajenas reciben `403`.
- No abras ni reenvíes el puerto 8080 en el router. En Windows, cuando el cortafuegos pregunte, permite **únicamente redes privadas**.
- Para fijar la interfaz/subred, indica tu IPv4 de Wi-Fi al iniciar:

  ```bash
  LAN_IP=192.168.1.50 npm start
  ```

  En PowerShell: `$env:LAN_IP='192.168.1.50'; npm start`

- Usa `PORT=8081` si 8080 ya está ocupado.

## Contenido

- Tres mapas livianos: **Astillero**, **Patio solar** y **Metro**.
- Personajes: Explorador (impulso), Médico (curación) e Ingeniero (escudo temporal).
- Pistola, fusil y subfusil; cada uno con daño, cadencia y cargador distintos.
- Sala de dos plazas: otro jugador entra con el mismo enlace, o el anfitrión puede activar un bot.
- Controles de teclado/ratón y controles táctiles en pantalla.

## Límites de recursos y plataforma

El servidor es Node.js estándar, sin motor 3D ni assets pesados. Una partida de dos entidades normalmente usa unas decenas de MB; el código aplica un máximo de dos jugadores y 30 simulaciones/s, por lo que queda muy por debajo de **2 GB de RAM** y el proyecto ocupa mucho menos de **35 GB de disco**. Mide tu equipo real con el monitor del sistema antes de servicio continuo.

El cliente es Canvas 2D para que funcione igual en navegadores de Android, iOS, Linux, macOS y Windows. Por tanto, no requiere DirectX. Si se abre en Windows, el navegador decide internamente la aceleración gráfica; este proyecto no exige DirectX 11/12 y no puede forzar una versión de DirectX desde la web. Para un binario Windows con tope estricto DirectX 10 haría falta una versión nativa separada (por ejemplo, con un motor compatible), no una tienda de consola.

## Publicar en GitHub

```bash
git init
git add .
git commit -m "Initial LAN Strike Lite"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/lan-strike-lite.git
git push -u origin main
```

No subas una IP pública, archivos `.env`, ni reenvíes el puerto del juego.

## Desarrollo responsable

Este es un prototipo de juego para LAN. Antes de exponer cualquier servicio fuera de tu red, añade autenticación, TLS, limitación de peticiones, registros y una revisión de seguridad.
