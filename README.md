# MultiChat Live 🚀 - Overlay Unificado & Dock para OBS Studio

El sistema todo-en-uno definitivo para streaming simultáneo en **Kick**, **TikTok Live**, **Twitch** y **YouTube**. Diseñado para creadores de contenido que transmiten en múltiples plataformas a la vez y necesitan un único panel integrado en OBS Studio para leer el chat, monitorizar espectadores, recibir alertas con GIFs y sonidos personalizados, y configurar todo en tiempo real.

---

## ✨ Características Principales

### 📌 1. Panel Dock Integrado para OBS Studio (`/dock.html`)
- **HUD de Espectadores en Vivo:** Contadores en tiempo real de Twitch, Kick, TikTok y YouTube, además de un contador total sincronizado.
- **Feed Unificado de Mensajes:** Mensajes con insignias de color por plataforma:
  - 🟢 **Kick** (verde neón)
  - 📱 **TikTok** (fucsia)
  - 🟣 **Twitch** (morado)
  - 🔴 **YouTube** (rojo)
- **Filtros Rápidos:** Alterna entre *Todos*, *Solo Chat*, o *Solo Alertas* con 1 clic.
- **Botón de Auto-Scroll:** Mantén la vista anclada al último mensaje con alerta de mensajes nuevos.
- **Botón de Silencio Rápido (🔊/🔇):** Apaga o enciende los sonidos del dock con un toque.

### 🎮 2. Simulador de Pruebas en Vivo (`/dock.html` > Pruebas)
- Prueba mensajes de chat simulados de cada plataforma para calibrar estilos sin estar transmitiendo.
- Simula alertas reales con sonido y GIF:
  - ⭐ Suscripciones de Kick y Twitch
  - 🎁 Regalos de monedas de TikTok (Rosas, Leones, etc.)
  - 💰 SuperChats de YouTube
  - 💖 Nuevos seguidores y raids
- Mensajería personalizada de prueba con texto propio.

### 🔔 3. Personalizador de Alertas y GIFs (`/dock.html` > Alertas)
- **Subida de GIFs y Fotos:** Sube cualquier archivo `.gif`, `.png`, `.jpg` o `.webp` (hasta 25 MB) y míralo en miniatura animada en vivo.
- **Enlaces Web Directos (URL):** Pega cualquier URL de Tenor, Giphy, Discord o Imgur.
- **Sonidos Sintéticos Nativos:** 5 efectos limpios mediante Web Audio API (*Chime cristalino, Fanfarria triunfal, Arcade coin, Pop suave, Alerta bronce*).
- **Subida de Audios MP3/WAV:** Usa tus propios audios personalizados para cada evento.
- **Control de Volumen Independiente:** Ajusta el volumen por cada evento específico (0% a 100%).
- **Prueba Inmediata:** Botón `▶ Probar Alerta` en cada tarjeta sin cambiar de pestaña.

### ⚙️ 4. Panel de Ajustes y Canales (`/dock.html` > Ajustes)
- Conecta tus canales:
  - 🟢 **Kick Username:** (ej. `chamukoi`)
  - 📱 **TikTok Username:** (ej. `keviinluna_`)
  - 🟣 **Twitch Username:** (ej. `chamukop`)
  - 🔴 **YouTube Handle:** (ej. `@CHAMUKO`)
- **Estilos del Chat en Pantalla (`/chat.html`):**
  - Tema: *Transparente*, *Glassmorphism (desenfoque translúcido)* o *Sólido Oscuro*.
  - Tamaño de letra: 14px, 16px, 18px, 22px o 26px.
  - Desvanecimiento de mensajes (Fade out): Permanente o tras 10s, 20s, 40s o 60s.
- **Opciones de Alertas (`/alerts.html`):**
  - Duración en pantalla: 3s, 5s, 7s, 10s o 15s.
  - Volumen global y editor de CSS personalizado para OBS.

### 🔗 5. Gestor de Enlaces OBS con 1 Clic (`/dock.html` > OBS)
Copia las URLs con 1 clic y con las dimensiones recomendadas para pegar directamente en OBS Studio.

---

## 🚀 Guías de Instalación

### Opción A: En tu PC Local (Windows)
1. Asegúrate de tener instalado [Node.js](https://nodejs.org/) (versión 18 o superior).
2. Clona o descarga este repositorio:
   ```bash
   git clone https://github.com/mukocha/Multichat.git
   cd Multichat
   ```
3. Haz doble clic en **`start.bat`**.
   - El script instalará las dependencias automáticamente y abrirá tu navegador en:
     👉 **`http://localhost:3000/dock.html`**

---

### Opción B: Despliegue 24/7 en la Nube (AWS EC2 / Ubuntu / Linux)
Ideal para que el bot y los overlays funcionen 24/7 desde una dirección IP pública:

1. Conéctate a tu servidor por SSH (vía PuTTY o terminal):
   ```bash
   ssh -i "tu-llave.pem" ubuntu@tu-ip-ec2
   ```
2. Instala Node.js y Git si aún no los tienes:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs git
   ```
3. Clona el repositorio:
   ```bash
   git clone https://github.com/mukocha/Multichat.git
   cd Multichat
   npm install
   ```
4. Instala **PM2** para mantener el proceso corriendo de forma permanente:
   ```bash
   sudo npm install -g pm2
   pm2 start server.js --name "multichat"
   pm2 startup
   pm2 save
   ```
5. En el panel de AWS (Security Groups), abre el puerto de entrada:
   - **Tipo:** TCP personalizado
   - **Puerto:** `3000`
   - **Origen:** `0.0.0.0/0` (o tu IP)
6. Abre tu navegador en:
   👉 **`http://TU-IP-EC2:3000/dock.html`**

> 💡 **Para actualizar cambios futuros en AWS:**
> ```bash
> cd ~/Multichat
> git pull
> pm2 restart multichat
> ```

---

## 🎥 Configuración en OBS Studio

| Fuente / Panel | URL | Dimensiones Recomendadas | Tipo en OBS |
| :--- | :--- | :--- | :--- |
| **MultiChat Dock** | `http://localhost:3000/dock.html` | Panel lateral acoplable | **Docks (Paneles)** > Paneles de navegador personalizados |
| **Chat en Pantalla** | `http://localhost:3000/chat.html` | `400 x 650` px | **Fuentes (+)** > Navegador (Browser) |
| **Alertas en Pantalla** | `http://localhost:3000/alerts.html` | `800 x 400` px | **Fuentes (+)** > Navegador (Browser) |
| **Barra de Viewers** | `http://localhost:3000/viewers.html` | `600 x 60` px | **Fuentes (+)** > Navegador (Browser) |
| **Historial de Eventos** | `http://localhost:3000/events.html` | `380 x 500` px | **Fuentes (+)** > Navegador (Browser) |

*(Nota: Si usas AWS EC2, sustituye `localhost:3000` por la IP pública de tu servidor, ej: `3.22.167.107:3000`).*

---

## 📁 Estructura del Proyecto

```text
Multichat/
├── config.json              # Configuración activa (canales, sonidos, temas, volúmenes)
├── config.example.json      # Plantilla de ejemplo de configuración
├── server.js                # Servidor Node.js Express y Socket.IO
├── start.bat                # Lanzador automático de 1 clic para Windows
├── platforms/               # Conectores de streaming en tiempo real
│   ├── kick.js              # WebSocket directo de Kick y polling
│   ├── tiktok.js            # Conector TikTok Live Connector
│   ├── twitch.js            # IRC WebSocket anónimo de Twitch
│   └── youtube.js           # Scraper de estado y espectadores de YouTube
├── routes/
│   └── api.js               # Rutas REST (/api/status, /api/upload, /api/config, etc.)
├── services/
│   └── polling.js           # Monitorización de viewers y reconexión automática
├── lib/
│   ├── config.js            # Validador de esquemas de configuración
│   ├── upload.js            # Validador de subida de imágenes y audios (magic bytes)
│   └── logger.js            # Registro estructurado de eventos
└── public/
    ├── dock.html            # Panel Dock todo-en-uno para OBS Studio
    ├── alerts.html          # Overlay animado de alertas para OBS
    ├── chat.html            # Overlay flotante de chat transparente
    ├── viewers.html         # Widget minimalista de espectadores
    ├── events.html          # Feed secundario de donaciones y eventos
    └── uploads/             # Directorio de GIFs, imágenes y audios subidos
```

---

## 🛡️ Seguridad y Consideraciones Públicas

- **No se requieren contraseñas ni tokens privados:** Los conectores de chat y espectadores utilizan APIs y WebSockets públicos de las plataformas.
- **Validación de Archivos:** Las subidas en `/api/upload` validan tanto la extensión MIME como las firmas de bytes reales (`magic bytes`) para evitar archivos maliciosos.
- **Tamaño Máximo:** Hasta 25 MB por archivo multimedia.

---

## 📄 Licencia

Este proyecto es de código abierto bajo la licencia [MIT](LICENSE). Siéntete libre de modificarlo y adaptarlo a tu propio setup de streaming.
