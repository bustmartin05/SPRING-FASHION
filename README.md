# Spring Fashion 2026 — Plataforma Integral de Producción, Comercialización y Finanzas

Plataforma Web Full-Stack, modular y responsiva para la gestión integral del evento **Spring Fashion** (Desfile Show de Alta Costura, Sunset Experience & B2B Networking).

---

## 🌟 Características Principales

### 1. Landing de Experiencia & Conversión (Frontend Público)
- **Modo Día / Noche Persistente**: Switcher interactivo con guardado en `localStorage` y soporte de `color-scheme` (Sunset Dark & Golden Light).
- **Hero Inmersivo**: Titular de alto impacto, video teaser/aftermovie en background con lightbox HD, locación, fecha destacada y cuenta regresiva en vivo.
- **La Experiencia**: 4 tarjetas conceptuales (Desfile Show de Alta Costura, DJs & Live Sunset Beats, Networking Lounge B2B y Gastronomía de Bodega).
- **Galería Multimedia Interactiva**: Cuadrícula con filtros por categoría (Desfile, Sunset, Backstage, Gastronomía, Aftermovie) y visor Lightbox con soporte de fotos y videos.
- **Speakers & Artistas Invitados**: Fichas con perfiles, disciplinas y redes sociales de diseñadores, DJs y sommeliers.
- **Grilla de Sponsors & Media Kit**: Marcas aliadas por nivel (Platinum, Gold, Silver, Media) y modal con métricas y descarga de Media Kit oficial en PDF.
- **Tabla de Entradas / Selector de Tickets**:
  - Precios y cupos editables desde el panel de administración / base de datos sin tocar código.
  - Calculador dinámico con contador de entradas, desglose de subtotal y modal de checkout.
  - Botones de medios de pago seleccionables (MercadoPago, Tarjetas, Transferencia, Stripe).
  - Emisión de **Voucher Digital con Código QR** único descargable e imprimible.
- **Carrusel de Testimonios (5 Segundos)**:
  - Rotación automática cada 5s, pausa al pasar el cursor (hover), controles manuales y puntos indicadores.
  - Muestra reseñas y calificaciones reales de asistentes aprobadas desde el panel.
- **Mini Formulario de Comunidad / Captación de Leads**:
  - Calificación con estrellas (1 a 5), nombre, email y comentario.
  - Captación automática de correos para newsletter/preventas e integración directa a moderación.
- **FAQ Acordeón**: Preguntas y respuestas frecuentes con animaciones fluidas.
- **Portal de Alianzas B2B**: Pestañas segmentadas para postulaciones de Sponsors y Staff/Proveedores técnicos.

---

### 2. Panel de Administración / Backoffice (Protegido)
- **Autenticación Encriptada**:
  - Usuario: `tu_usuario_admin`
  - Contraseña: `tu_password_configurado_en_env` (Hasheada con `bcryptjs` en la base de datos).
  - Sesiones seguras mediante Tokens JWT.
- **Configuración Dinámica de Evento**:
  - Selector en caliente del formato de evento: `"Desfile Show / Sunset"`, `"Cena Show"`, `"Fiesta / Solo Baile"`, `"Conferencia B2B"`.
  - Editor en tiempo real de precios y stock de entradas.
- **Gestor Modular de Recursos, Staff y Rubros (CRUD Completo)**:
  - Botón interactivo `+ Agregar nuevo rubro` para crear categorías personalizadas.
  - Alta, edición, asignación de costos acordados y toggle de estado de pago (Abonado / Pendiente).
- **Roadmap Secuencial de Producción**:
  - 5 hitos clave con bloqueo/desbloqueo progresivo (Paso 1 -> Paso 2 -> Paso 3 -> Paso 4 -> Paso 5).
  - Barra de progreso porcentual y persistencia en base de datos.
- **Calculadora Financiera en Tiempo Real & Semáforo de Rentabilidad**:
  - `Costo Total Operativo`: Suma automática de todos los rubros/proveedores contratados.
  - `Ingreso Total Bruto`: Suma calculada automáticamente de la venta de entradas.
  - `Beneficio Real Neto`: `Ingresos Totales - Costos Operativos`.
  - Margen de ganancia (%) y Semáforo visual (🟢 Verde: Rentable, 🔴 Rojo: Déficit, 🟡 Amarillo: Break-even).
  - Desglose gráfico de costos por categoría.
- **Bandeja de CRM & Leads**:
  - Tabla de compradores de tickets con exportación a CSV.
  - Moderador de reseñas con botón para publicar u ocultar del carrusel público con 1 clic.
  - Carga y gestión de Sponsors y Galería multimedia (soporte de URLs y subida directa de archivos con Multer).

---

## 🚀 Puesta en Marcha Local

### 1. Requisitos Previos
- Node.js v18+ (o Node.js v24+)
- npm

### 2. Instalación
```bash
# 1. Instalar dependencias
npm install

# 2. Configurar variables de entorno (ya configurado en .env)
# Revisa .env.example para ver los parámetros disponibles

# 3. Iniciar el servidor
node server.js
# o en modo desarrollo:
npm run dev
```

### 3. Acceso en el Navegador
- **Landing Pública**: `http://localhost:3000`
- **Panel de Administración**: Clic en el botón **"Backoffice"** en la barra superior o en el enlace del footer.
  - **Usuario**: `tu_usuario_admin`
  - **Contraseña**: `tu_password_configurado_en_env`

---

## 🗄️ Base de Datos & SQL

La aplicación incluye persistencia inmediata con **SQLite** (`database/spring_fashion.db`) con inicialización y seed data automáticos.

Además, el archivo `database/schema.sql` contiene el esquema DDL relacional estándar listo para migrar a **PostgreSQL**, **Supabase** o **MySQL**.

### Tablas Principales:
1. `events`: Configuración general del evento y formato activo.
2. `ticket_tiers`: Niveles de entradas, precios y stock.
3. `ticket_sales`: Registro de compras de entradas con códigos y datos QR.
4. `categories`: Rubros operativos estándar y personalizados.
5. `expenses_providers`: Proveedores, presupuestos acordados y estado de pago.
6. `sponsors`: Marcas aliadas, logos, niveles y propuestas.
7. `gallery_media`: Fotos y videos para la galería interactiva.
8. `feedback_comments`: Reseñas, estrellas y leads de correo para mailing.
9. `roadmap_steps`: Hitos secuenciales de producción.
10. `admin_users`: Usuarios con contraseñas encriptadas con `bcrypt`.

---

## 🔒 Seguridad y Git

- Las credenciales sensibles y secretos de JWT están aislados en el archivo `.env`.
- El archivo `.gitignore` excluye `node_modules`, archivos `.env` y bases de datos locales para garantizar que ningún dato sensible quede expuesto al subirlo a GitHub.
- Las contraseñas de administración se almacenan exclusivamente como hashes unidireccionales generados con `bcryptjs` con 10 rondas de salting.
