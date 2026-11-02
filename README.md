# MultiChat Live 🚀 - Overlay Unificado & Dock para OBS Studio

El sistema todo-en-uno definitivo para streaming simultáneo en **Kick**, **TikTok Live**, **Twitch** y **YouTube**. Diseñado para creadores de contenido que transmiten en múltiples plataformas a la vez y necesitan un único panel integrado en OBS Studio para leer el chat, monitorizar espectadores, recibir alertas con GIFs y sonidos personalizados, y configurar todo en tiempo real.

> ⚡ **100% Local y Portable:** Funciona en cualquier PC con Windows sin necesidad de instalar Node.js ni programas complicados. Solo descargas y haces doble clic en `start.bat`.

---

## ✨ Características Principales

### 📌 1. Panel Dock Integrado para OBS Studio (`/dock.html`)
- **HUD de Espectadores en Vivo:** Contadores en tiempo real de Twitch, Kick, TikTok y YouTube, además de un contador total sincronizado.
- **Feed Unificado de Mensajes:** Mensajes con insignias de color por plataforma:
  - 🟢 **Kick** (verde neón con WebSocket Centrifugo en tiempo real)
  - 📱 **TikTok** (fucsia)
  - 🟣 **Twitch** (morado vía IRC WebSocket)
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
- Conecta tus canales en segundos:
  - 🟢 **Kick Username:** (ej. `tu_canal`)
  - 📱 **TikTok Username:** (ej. `@tu_usuario`)
  - 🟣 **Twitch Username:** (ej. `tu_canal`)
  - 🔴 **YouTube Handle:** (ej. `@tu_canal`)
- **Estilos del Chat en Pantalla (`/chat.html`):**
  - Tema: *Transparente*, *Glassmorphism (desenfoque translúcido)* o *Sólido Oscuro*.
  - Tamaño de letra: 14px, 16px, 18px, 22px o 26px.
  - Desvanecimiento de mensajes (Fade out): Permanente o tras 10s, 20s, 40s o 60s.
- **Opciones de Alertas (`/alerts.html`):**
  - Duración en pantalla: 3s, 5s, 7s, 10s o 15s.
  - Volumen global y editor de CSS personalizado para OBS.

### 🔗 5. Gestor de Enlaces OBS con 1 Clic (`/dock.html` > OBS)
Copia las URLs con 1 solo clic y con las dimensiones recomendadas listas para pegar en tu OBS Studio.

---

## 🚀 Inicio Rápido en PC Local (Windows)

No requieres conocimientos técnicos ni instalar programas pesados:

### Paso 1: Descargar el Proyecto
- Haz clic en el botón verde **`Code` > `Download ZIP`** arriba a la derecha en GitHub y descomprime la carpeta en tu computadora.
- *(O si usas Git: `git clone https://github.com/mukocha/Multichat.git`)*.

### Paso 2: Iniciar
- Haz doble clic en el archivo **`start.bat`**.
- El lanzador inteligente preparará el entorno portable automáticamente en segundos y abrirá tu navegador predeterminado en:
  👉 **`http://localhost:3000/dock.html`**

### Paso 3: Configurar tus Canales
1. En el panel que se abre en tu navegador, haz clic en la pestaña **Canales** (o Ajustes).
2. Escribe los nombres de tus cuentas de Kick, TikTok, Twitch o YouTube.
3. Haz clic en **"Guardar Canales"** y comenzará a conectar en vivo inmediatamente.

---

## ⚡ Opcional: Iniciar Automático con Windows en Segundo Plano

Si quieres que MultiChat arranque automáticamente cada vez que enciendas tu PC, sin tener que abrir nada a mano y sin molestas ventanas de consola:

1. Haz doble clic en **`activar-inicio-con-windows.bat`**.
2. ¡Listo! El script creará un acceso directo en el inicio de Windows que ejecutará el servidor en segundo plano silencioso mediante `iniciar-oculto.vbs`.

---

## 🎥 Configuración en OBS Studio

Una vez iniciado `start.bat`, agrega las siguientes fuentes en OBS Studio:

| Fuente / Panel | URL en OBS | Dimensiones Recomendadas | Tipo en OBS |
| :--- | :--- | :--- | :--- |
| **MultiChat Dock** | `http://localhost:3000/dock.html` | Panel lateral acoplable | **Docks (Paneles)** > Paneles de navegador personalizados |
| **Chat en Pantalla** | `http://localhost:3000/chat.html` | `400 x 650` px | **Fuentes (+)** > Navegador (Browser) |
| **Alertas en Pantalla** | `http://localhost:3000/alerts.html` | `800 x 400` px | **Fuentes (+)** > Navegador (Browser) |
| **Barra de Viewers** | `http://localhost:3000/viewers.html` | `600 x 60` px | **Fuentes (+)** > Navegador (Browser) |
| **Historial de Eventos** | `http://localhost:3000/events.html` | `380 x 500` px | **Fuentes (+)** > Navegador (Browser) |

> 💡 **Consejo en OBS:** Marca la casilla *"Actualizar el navegador cuando la escena se active"* en las propiedades de la fuente de navegador si deseas un refresco limpio.

---

## 📁 Estructura del Proyecto

```text
Multichat/
├── config.example.json      # Plantilla limpia de configuración inicial
├── config.json              # Tu configuración personal local (protegida en .gitignore)
├── server.js                # Servidor Node.js Express, Socket.IO y WebSocket
├── start.bat                # Lanzador inteligente 1-clic con auto-instalador portable
├── iniciar-oculto.vbs       # Inicio silencioso en segundo plano sin ventana
├── activar-inicio-con-windows.bat # Instalador de arranque automático con Windows
├── subir-a-github.bat       # Utilidad para sincronizar cambios a GitHub
├── bin/                     # Entorno portable de Node.js (descargado automáticamente)
├── platforms/               # Conectores de streaming en tiempo real
│   ├── kick.js              # WebSocket Centrifugo v2 directo de Kick y polling
│   ├── tiktok.js            # Conector TikTok Live Connector
│   ├── twitch.js            # IRC WebSocket anónimo de Twitch
│   └── youtube.js           # Monitorización de estado y espectadores de YouTube
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

## 🛡️ Privacidad y Seguridad

- **100% Privado:** Tu archivo `config.json` con tus canales y configuraciones locales está excluido de Git (`.gitignore`). Nadie más verá tus nombres al clonar el repositorio.
- **Sin Contraseñas ni Tokens:** El sistema se conecta a los chats y espectadores mediante conexiones públicas, sin necesidad de tokens OAuth privados ni contraseñas.
- **Validación Estricta de Archivos:** Las subidas en `/api/upload` validan extensiones MIME y firmas de bytes reales (`magic bytes`) para evitar archivos maliciosos.

---

## 📄 Licencia

Este proyecto es de código abierto bajo la licencia [MIT](LICENSE). Siéntete libre de utilizarlo y adaptarlo a tu propio setup de streaming.
