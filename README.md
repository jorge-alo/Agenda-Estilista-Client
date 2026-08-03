# 💈 Agenda Estilista | Sistema de Gestión y Reservas

[![Node.js](https://img.shields.io/badge/Node.js-18.x-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18.x-blue.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![MySQL](https://img.shields.io/badge/MySQL-8.0-orange.svg)](https://www.mysql.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Plataforma **SaaS multi-tenant** diseñada para la gestión integral de salones de belleza, barberías y estilistas independientes. Permite a los clientes reservar turnos y pagar señas online, mientras que los administradores gestionan agendas, servicios, clientes y finanzas desde un panel centralizado.

---

## 🚀 Características Principales

### 💳 Pagos Online (Mercado Pago)
- **Modelo Descentralizado**: Cada local configura su propio Access Token, por lo que el dinero llega **directamente** a su cuenta de Mercado Pago.
- **Flujo de Señas**: Cobro automático del 30% (configurable) al momento de la reserva pública.
- **Webhook Resiliente**: Sistema de fallback que actualiza el estado del turno incluso si la API de MP no devuelve el `preference_id` en la notificación.
- **Anti-"Turnos Fantasma"**: Liberación automática de horarios no pagados tras 15 minutos de inactividad.

### 📅 Gestión de Agenda y Turnos
- **Prevención de Double-Booking**: Transacciones de base de datos con `SELECT ... FOR UPDATE` e índices únicos para evitar condiciones de carrera (race conditions).
- **Disponibilidad Inteligente**: Cálculo de horarios libres considerando duración del servicio, horarios laborales del estilista y bloqueos manuales.
- **Estados de Turno**: `pendiente_pago`, `activo`, `cancelado` y `completado`.

### 🛡️ Seguridad y Robustez
- Autenticación JWT con expiración y middleware de autorización por roles (`admin`, `superadmin`).
- Validación estricta de datos en frontend y backend utilizando **Zod**.
- Protección contra fuerza bruta y spam mediante **Rate Limiting** (global y por endpoint).
- Headers de seguridad HTTP configurados con **Helmet**.
- Respuestas "ciegas" (Blind Response) en recuperación de contraseñas para evitar enumeración de usuarios.

### 🔔 Notificaciones y UX
- Integración con **Evolution API** para envío automático de confirmaciones y recordatorios por WhatsApp.
- Correos transaccionales profesionales mediante **Resend**.
- Interfaz reactiva con **TanStack Query** (caché, invalidación automática, optimistic updates) y feedback visual en tiempo real con **Sonner Toasts**.
- Skeleton loaders y Error Boundaries para una experiencia de usuario fluida y estable.

---

## 🛠️ Tech Stack

| Capa | Tecnologías |
| :--- | :--- |
| **Frontend** | React, Vite, TypeScript, React Hook Form, Zod, TanStack Query, Sonner |
| **Backend** | Node.js, Express, TypeScript, MySQL2 (Pool de conexiones) |
| **Base de Datos** | MySQL 8.0 |
| **Integraciones** | Mercado Pago SDK, Evolution API (WhatsApp), Resend (Email) |
| **DevOps/Deploy** | Vercel (Frontend), Railway (Backend & DB) |

---

## ⚙️ Instalación y Configuración Local

### 1. Prerrequisitos
- Node.js >= 18.x
- MySQL 8.0 (local o en la nube)
- Git

### 2. Clonar el repositorio
```bash
git clone https://github.com/TU_USUARIO/agenda-estilista.git
cd agenda-estilista
```

### 3. Instalar dependencias
```bash
# Instalar dependencias del backend
cd server
npm install

# Instalar dependencias del frontend
cd ../client
npm install
```

### 4. Variables de Entorno
Crea un archivo `.env` en la carpeta `server/` con la siguiente estructura:

```env
# Base de Datos
DATABASE_URL="mysql://usuario:password@localhost:3306/agenda_db"

# Seguridad
JWT_SECRET="tu_clave_secreta_muy_segura_aqui"

# URLs del Sistema (CRÍTICO para CORS y Mercado Pago)
FRONTEND_URL="http://localhost:5173"
BACKEND_URL="http://localhost:3000"
CORS_ORIGINS="http://localhost:5173"

# Mercado Pago (Global)
# NOTA: Se usa exclusivamente para que el webhook tenga permisos de lectura (Payment.get). 
# El cobro real se realiza con el token guardado en la tabla `locales.mp_access_token`.
MP_ACCESS_TOKEN="APP_USR-xxxxxxxxxxxx... o TEST-xxxxxxxxxxxx..."

# Servicios Externos (Opcional para desarrollo local)
RESEND_API_KEY="tu_api_key_de_resend"
EVOLUTION_API_URL="http://localhost:8080"
EVOLUTION_API_KEY="tu_api_key_de_evolution"
```

### 5. Configuración de la Base de Datos
Ejecutá las siguientes consultas SQL para habilitar las funcionalidades de pago y limpieza automática:

```sql
-- 1. Token de MP por local
ALTER TABLE locales ADD COLUMN mp_access_token VARCHAR(255) NULL;

-- 2. Marca de tiempo para limpieza de turnos abandonados
ALTER TABLE turnos ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- 3. Actualizar estados de turnos (si no existe 'pendiente_pago')
ALTER TABLE turnos MODIFY COLUMN estado ENUM('pendiente_pago', 'activo', 'cancelado', 'completado') DEFAULT 'pendiente_pago';
```

### 6. Ejecutar en modo desarrollo
```bash
# Desde la raíz del proyecto (o en dos terminales separadas):
cd server && npm run dev
cd client && npm run dev
```

---

## 🏗️ Arquitectura del Flujo de Pagos

1. El cliente realiza una reserva pública (`POST /api/public/reservar`).
2. El backend inicia una transacción, valida solapamientos (`FOR UPDATE`), crea el turno con estado `pendiente_pago` y hace **COMMIT** inmediato (evitando bloqueos prolongados).
3. Se llama a `pagosService.crearPreference` utilizando el `mp_access_token` específico de la tabla `locales`.
4. El cliente es redirigido al checkout de Mercado Pago.
5. Al completarse el pago, MP envía un webhook a `POST /api/pagos/webhook`.
6. El backend consulta el estado del pago y, usando un sistema de fallback (`preference_id` → `turno_id`), actualiza el estado del turno a `activo`.

---

## 📚 Documentación Adicional

Para más detalles sobre la configuración de Mercado Pago para los locales o la arquitectura interna, consultá la carpeta `/docs`:

- [📖 Guía de Configuración de Mercado Pago para Locales](docs/GUIA_MERCADOPAGO.md)
- [🏗️ Arquitectura del Flujo de Pagos](docs/ARQUITECTURA_PAGOS.md)
- [📜 Changelog Completo](docs/CHANGELOG.md)

---

## 🤝 Contribuir

Las contribuciones son bienvenidas. Por favor, abre un *Issue* primero para discutir el cambio que te gustaría hacer o envía un *Pull Request* siguiendo las convenciones de código del proyecto.

---

Desarrollado con 💛 y mucho ☕ por **Jorge Altamirano**
