# Clase-003 — BabylonJS (texturas y modelos locales)

Pasos para usar este ejemplo:

1. Coloca tus texturas en `Clase-003/assets/textures/` con nombres:
   - `wood.jpg`, `marble.jpg`, `metal.jpg`, `brick.jpg`, `grass.jpg` (o actualiza `main.js` con tus nombres).
2. (Opcional) Coloca modelos en `Clase-003/assets/models/`, por ejemplo `model.glb`.
3. Desde la raíz del repo (o cualquier carpeta), instala dependencias npm:

```powershell
cd "C:\Users\pckev\Documents\Proyectos VS Code\asimbaya-2025b-kpac-sw-gr1"
npm install
```

4. Inicia el servidor HTTP (sirve la carpeta `Clase-003` en el puerto `9000`):

```powershell
npm run start
```

5. Abre en tu navegador: `http://localhost:9000/index.html`

Notas:
- Si prefieres no añadir `http-server` como dependencia, puedes instalarlo globalmente: `npm i -g http-server` y luego ejecutar `http-server Clase-003 -p 9000`.
- Si tus texturas tienen otros nombres o formatos (`.png`, `.webp`), actualiza las rutas en `main.js`.
- Para modelos glTF/GLB, los loaders están incluidos desde `https://cdn.babylonjs.com/loaders/babylonjs.loaders.min.js`.
