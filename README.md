# VECTOR//STRIKE

Prototipo web ligero de un shooter táctico. No necesita Node.js, paquetes ni proceso de compilación: el cliente sirve los tres archivos estáticos del proyecto.

## Ejecutarlo en tu PC

### Opción recomendada: servidor local con Python

1. Instala [Python 3](https://www.python.org/downloads/) si todavía no lo tienes.
2. Abre una terminal dentro de la carpeta descargada del proyecto.
3. Ejecuta:

   ```bash
   python -m http.server 8080
   ```

   En macOS o Linux, si `python` no existe, usa `python3`:

   ```bash
   python3 -m http.server 8080
   ```

4. Abre `http://localhost:8080` en Chrome, Edge, Firefox o cualquier navegador moderno.
5. Para detener el servidor, vuelve a la terminal y pulsa `Ctrl + C`.

### Opción sin instalar nada: VS Code

1. Abre la carpeta del proyecto con Visual Studio Code.
2. Instala la extensión **Live Server** de Ritwick Dey.
3. Haz clic derecho en `index.html` y selecciona **Open with Live Server**.

## Publicarlo en GitHub Pages

1. Crea un repositorio vacío en GitHub, por ejemplo `vector-strike`.
2. En la terminal de esta carpeta, conecta el repositorio y publica la rama actual:

   ```bash
   git remote add origin https://github.com/TU_USUARIO/vector-strike.git
   git push -u origin work
   ```

3. En GitHub, abre **Settings → Pages**.
4. En **Build and deployment**, selecciona **Deploy from a branch**.
5. Elige la rama `work` y la carpeta `/(root)`, y guarda.
6. GitHub mostrará la URL pública del juego tras el despliegue.

> Si prefieres usar `main`, renombra la rama antes del `push`: `git branch -M main`, y en Pages selecciona `main`.

## Archivos principales

- `index.html`: estructura y contenido de la interfaz.
- `style.css`: diseño responsive, arte CSS y estilos visuales.
- `app.js`: selección de mapa, armas y notificaciones de interfaz.

## Requisitos

- Un navegador actualizado con JavaScript activado.
- Conexión a Internet solo para cargar las fuentes de Google; el resto funciona como archivos estáticos.
