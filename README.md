# StreamOverlay - Kick, TikTok, Twitch y YouTube para OBS Studio 🚀

Sistema para OBS Studio con **MultiChat de Kick, TikTok y Twitch**, alertas para las plataformas que generan eventos y conteo de espectadores de YouTube Live. Puede ejecutarse en el PC del streamer o alojarse en un servidor accesible por internet.

---

## ⚡ Inicio Rápido (1 Clic)

1. Instala Node.js si todavía no está instalado.
2. Haz doble clic en **`start.bat`**. El script instala las dependencias la primera vez y abre `http://localhost:3000`.
3. En el panel, configura los canales que uses y haz clic en **"Conectar Canales"**.

También puedes iniciar el servidor desde una terminal con `npm start`. Para usarlo desde OBS en otro equipo o alojarlo en internet, configura el servicio para ejecutar `npm start` y usa el dominio HTTPS del servidor en las fuentes de navegador. El puerto se toma de la variable `PORT` (por defecto `3000`).

> **Acceso público:** el panel y las rutas de control no tienen inicio de sesión. Si publicas el servicio en internet, cualquier persona que conozca el dominio podrá cambiar la configuración, iniciar o desconectar canales, enviar alertas de prueba y subir medios. No alojes datos privados en la configuración y considera poner el servicio detrás de una capa de acceso privado.

---

## 🎥 Configuración en OBS Studio

### 1. MultiChat Unificado (Kick + TikTok + Twitch)
1. En OBS, en el panel **Fuentes** (Sources), haz clic en el botón **`+`** y selecciona **Navegador** (Browser).
2. Nómbralo: `MultiChat`.
3. Configura:
   - **URL:** `http://localhost:3000/chat.html`
   - **Ancho (Width):** `450`
   - **Alto (Height):** `650`
   - **Controlar audio vía OBS:** Desmarcado.
   - Marca **"Actualizar el navegador cuando la escena se active"** si lo deseas.
4. Haz clic en **Aceptar** y ubica el chat donde prefieras en tu escena.

### 2. Caja de Alertas (Follows, Subs, Regalos de TikTok)
1. En OBS, haz clic en **`+`** y selecciona **Navegador** (Browser).
2. Nómbralo: `Alertas Stream`.
3. Configura:
   - **URL:** `http://localhost:3000/alerts.html`
   - **Ancho (Width):** `800`
   - **Alto (Height):** `400`
   - Marca **"Controlar audio vía OBS"** si deseas ajustar el volumen directamente desde el mezclador de OBS.
4. Haz clic en **Aceptar** y ubica la caja de alertas en el centro superior de tu pantalla.

### 3. Panel Integrado de Chat y Notificaciones (Dock en OBS) 📌
Para leer el chat y ver el historial de alertas dentro de la ventana de OBS (como un panel o pestaña acoplable al lado de tus escenas o mezclador):
1. En el menú superior de OBS Studio, ve a **Paneles** (Docks) > **Paneles de navegador personalizados...** (Custom Browser Docks).
2. En la lista:
   - **Nombre del panel:** `MultiChat y Eventos`
   - **URL:** `http://localhost:3000/dock.html`
3. Haz clic en **Aplicar**.
4. Se abrirá una ventana que puedes **arrastrar y anclar** en cualquier lugar de OBS.
5. Incluye dos pestañas principales:
   - **💬 Chat en Vivo:** Todos los mensajes de Kick y TikTok con sus respectivos colores.
   - **🔔 Notificaciones:** Historial cronológico de quién te siguió, quién se suscribió y qué regalos de monedas te enviaron en TikTok con contador de eventos nuevos.

### 4. Feed de Notificaciones Standalone (Opcional) 📋
Si deseas un dock independiente exclusivamente para el historial de alertas y donaciones:
- **URL:** `http://localhost:3000/events.html`



---

## 🧪 Pruebas en Vivo (Test Center)

Desde el panel de control (`http://localhost:3000`) puedes hacer clic en los botones de prueba:
- **Kick Follow** (Prueba de nuevo seguidor)
- **Kick Sub** (Prueba de suscripción Tier 1)
- **Kick 5 Subs Regaladas** (Prueba de suscripciones comunitarias)
- **TikTok Follow** (Prueba de seguidor)
- **TikTok Rosa** (Prueba de regalo económico con monedas)
- **TikTok León** (Prueba de regalo legendario)
- **Chat Kick / Chat TikTok** (Prueba de mensajes para verificar estilos)

---

## 🧩 Plataformas disponibles

- **Kick:** chat, seguidores, suscripciones y estado/espectadores en directo.
- **TikTok Live:** chat, seguidores, regalos, estado y espectadores. La cuenta debe estar transmitiendo para recibir eventos.
- **Twitch:** chat, seguidores, suscripciones y estado/espectadores en directo.
- **YouTube Live:** detección de directo y espectadores. Este conector no lee el chat ni genera eventos reales de suscripción.

La disponibilidad de eventos depende de los conectores y de los cambios que cada plataforma haga en sus servicios.

## 🗂️ Estructura del proyecto

- `server.js`: servidor Express, estado compartido y arranque.
- `routes/api.js`: rutas HTTP y validación de solicitudes.
- `platforms/`: conectores y comportamiento específico de cada plataforma.
- `services/polling.js`: sondeos, actualización de espectadores y reconexión automática.
- `lib/config.js`: validación y lista permitida de opciones de configuración.
- `lib/upload.js`: validación del tipo, tamaño y firma de los medios antes de guardarlos.
- `lib/logger.js`: registro de errores de sondeo por plataforma.
- `public/`: panel de control, páginas de OBS, dock y medios subidos.

## 💡 Notas importantes

- **Kick:** Se conecta a los WebSockets públicos de Kick en tiempo real. No requiere que estés transmitiendo para probar el chat o seguidores.
- **TikTok Live:** Debido al funcionamiento del conector, solo recibe eventos cuando la cuenta está transmitiendo en directo. Mientras estés offline, usa los botones de prueba del panel para calibrar fuentes y sonido en OBS.
- **Subidas:** GIF, PNG, JPG, WEBP, MP3, WAV, OGG y M4A; máximo 8 MB por archivo.
