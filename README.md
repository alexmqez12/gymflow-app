# 🏋️ GymFlow

**Plataforma de gestión de aforo en tiempo real para gimnasios**

GymFlow permite a los miembros ver el aforo actual de sus gimnasios, recibir predicciones de ocupación y acceder mediante QR. El staff operativo gestiona el acceso desde un kiosko de torniquete, y los dueños monitorizan métricas de negocio desde un dashboard dedicado.

---

## 📋 Tabla de Contenidos

- [Stack Tecnológico](#stack-tecnológico)
- [Arquitectura](#arquitectura)
- [Funcionalidades](#funcionalidades)
- [Estructura del Proyecto](#estructura-del-proyecto)
- [Instalación y Setup](#instalación-y-setup)
- [Variables de Entorno](#variables-de-entorno)
- [Base de Datos](#base-de-datos)
- [API Reference](#api-reference)
- [Roles y Permisos](#roles-y-permisos)
- [Roadmap](#roadmap)

---

## Stack Tecnológico

### Backend
| Tecnología | Versión | Uso |
|---|---|---|
| NestJS | ^10 | Framework API REST |
| Prisma | ^5 | ORM + migraciones |
| PostgreSQL | 15 | Base de datos principal |
| Socket.io | ^4 | WebSockets tiempo real |
| JWT | — | Autenticación |
| bcrypt | — | Hash de contraseñas |
| Docker | — | Contenedor PostgreSQL |

### Frontend
| Tecnología | Versión | Uso |
|---|---|---|
| Next.js | 15 | Framework React |
| TypeScript | ^5 | Tipado estático |
| Tailwind CSS | ^3 | Estilos |
| Framer Motion | ^11 | Animaciones |
| Recharts | ^2 | Gráficos de ocupación |
| QRCode | ^1 | Generación de QR |

---

## Arquitectura

```
gymflow-app/
├── backend/          ← API NestJS (puerto 3001)
│   ├── src/
│   │   └── modules/
│   │       ├── auth/         ← Login, JWT, validación RUT
│   │       ├── checkins/     ← Registros entrada/salida + dashboards
│   │       ├── gyms/         ← CRUD gyms + estadísticas predictivas
│   │       ├── memberships/  ← Gestión membresías
│   │       └── users/        ← Perfil usuarios
│   └── prisma/
│       ├── schema.prisma     ← Modelos de datos
│       └── seed.ts           ← Datos de prueba
│
└── frontend/         ← App Next.js (puerto 3000)
    └── src/
        ├── app/
        │   ├── page.tsx              ← Homepage con grid de gyms
        │   ├── perfil/page.tsx       ← Login + perfil usuario
        │   ├── registro/page.tsx     ← Registro 3 pasos
        │   ├── gym/[gymId]/page.tsx  ← Detalle gym + gráficos
        │   ├── torniquete/[gymId]/   ← Kiosko torniquete (STAFF/ADMIN)
        │   └── dashboard/page.tsx   ← Dashboard Staff + Owner
        ├── components/
        │   ├── Navbar.tsx            ← Navegación global
        │   └── OwnerDashboard.tsx    ← Métricas de negocio
        └── hooks/
            └── useRealtimeCapacity.ts ← WebSocket hook
```

### Flujo de Acceso (Torniquete)

```
Usuario (app móvil)
    ↓ Ve aforo en tiempo real
    ↓ Decide ir al gym
    ↓ Va físicamente
    ↓ Presenta QR al lector físico USB
Torniquete (panel operativo STAFF)
    ↓ Valida QR o RUT
    ↓ Registra entrada/salida en BD
    ↓ Emite evento WebSocket
Homepage + Detalle
    ↓ Actualiza aforo en tiempo real
```

---

## Funcionalidades

### 👤 Para Miembros (USER)
- **Homepage**: Ver gymns de su membresía con aforo en tiempo real
- **Filtros**: Todos / Con espacio / Mi membresía
- **Detalle gym**: Gráficos de ocupación con 3 vistas:
  - *Hoy*: Datos reales del día
  - *Predicción*: Real + proyección futura (algoritmo híbrido)
  - *Semana*: Comparativa hoy vs ayer vs promedio 7 días
- **Insights**: Mejor hora para ir, próximas 3 horas, tendencia vs ayer
- **Perfil**: QR personal descargable, datos de membresía, días restantes
- **Registro**: Flujo 3 pasos (datos personales → membresía → gimnasio)
- **Control de acceso**: Solo ve gyms de su membresía activa

### 🧑‍💼 Para Staff (GYM_STAFF)
- **Torniquete kiosko**: Panel físico con lector QR/RUT USB
  - Detección de lector físico (ráfagas < 50ms entre teclas)
  - Estado visual: éxito entrada / éxito salida / error / denegado
  - Sonidos diferenciados por tipo de evento
  - Lookup en tiempo real del estado del usuario
  - Panel lateral: aforo, actividad reciente, reloj
- **Dashboard Staff**:
  - Aforo actual con barra animada
  - Visitas totales del día, hora punta, tiempo promedio
  - Gráfico de ocupación por hora
  - Feed de actividad en tiempo real (entradas/salidas)
  - Tabla de usuarios actualmente dentro
  - Alertas automáticas (aforo crítico, tiempo alto)

### 🏢 Para Owner/Admin (ADMIN)
- Todo lo de Staff +
- **Dashboard Owner**:
  - KPIs financieros: ingresos estimados, proyección próximo mes
  - KPIs membresías: total, activos, inactivos, churn rate, retención
  - Gráfico de visitas diario/mensual con selector 7/30/90 días
  - Pie chart distribución de tipos de membresía
  - Ranking de horas más rentables
  - Gauge de tasa de retención
  - Top 3 días con más actividad
  - Ingresos estimados por tipo de membresía

### 🔄 Tiempo Real (WebSockets)
- Actualización automática de aforo al registrar entrada/salida
- Reconexión automática con backoff exponencial
- Indicador visual de estado de conexión

---

## Estructura del Proyecto

### Modelos de Base de Datos

```prisma
model User {
  id         String   @id @default(uuid())
  email      String   @unique
  password   String
  name       String
  rut        String?  @unique
  qrCode     String?  @unique
  role       Role     @default(USER)
  membership Membership?
  checkins   CheckIn[]
}

model Gym {
  id              String   @id @default(uuid())
  name            String
  address         String
  latitude        Float
  longitude       Float
  maxCapacity     Int
  description     String?
  features        String[]
  rating          Float    @default(0)
  chain           String?
  isActive        Boolean  @default(true)
  checkins        CheckIn[]
  membershipGyms  MembershipGym[]
}

model Membership {
  id        String         @id @default(uuid())
  userId    String         @unique
  type      MembershipType
  status    String         @default("ACTIVE")
  startDate DateTime
  endDate   DateTime
  gyms      MembershipGym[]
}

model MembershipGym {
  membershipId String
  gymId        String
}

model CheckIn {
  id         String    @id @default(uuid())
  userId     String
  gymId      String
  checkedIn  DateTime  @default(now())
  checkedOut DateTime?
}

enum Role {
  USER
  GYM_STAFF
  ADMIN
}

enum MembershipType {
  BASIC
  SMARTFIT
  POWERFIT
  PREMIUM
  CUSTOM
}
```

---

## Instalación y Setup

### Prerequisitos
- Node.js 18+
- Docker Desktop
- npm o yarn

### 1. Clonar el repositorio

```bash
git clone https://github.com/tuusuario/gymflow-app.git
cd gymflow-app
```

### 2. Levantar base de datos

```bash
docker run --name gymflow-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=gymflow \
  -p 5432:5432 \
  -d postgres:15
```

### 3. Backend

```bash
cd backend
npm install

# Configurar variables de entorno
cp .env.example .env

# Correr migraciones
npx prisma migrate dev

# Generar cliente Prisma
npx prisma generate

# Cargar datos de prueba
npm run prisma:seed

# Iniciar servidor
npm run start:dev
```

El backend estará disponible en `http://localhost:3001`

### 4. Frontend

```bash
cd frontend
npm install
npm run dev
```

La app estará disponible en `http://localhost:3000`

---

## Variables de Entorno

### Backend (`backend/.env`)

```env
# Base de datos
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/gymflow"

# JWT
JWT_SECRET="tu-secreto-seguro-aqui"
JWT_EXPIRES_IN="7d"

# App
PORT=3001
```

### Frontend (`frontend/.env.local`)

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=http://localhost:3001
```

---

## Base de Datos

### Migrations

```bash
# Crear nueva migración
npx prisma migrate dev --name nombre_migracion

# Aplicar migraciones en producción
npx prisma migrate deploy

# Ver estado de migraciones
npx prisma migrate status
```

### Seed (datos de prueba)

```bash
npm run prisma:seed
```

Crea los siguientes usuarios de prueba:

| Email | Password | Rol | Membresía |
|---|---|---|---|
| admin@gymflow.com | password123 | ADMIN | — |
| staff@gymflow.com | password123 | GYM_STAFF | — |
| juan@test.com | password123 | USER | SmartFit (SmartFit Vitacura) |
| maria@test.com | password123 | USER | Basic (FitZone Providencia) |

Y 4 gimnasios en Santiago:
- PowerGym Las Condes (cap. 80)
- FitZone Providencia (cap. 90)
- SmartFit Vitacura (cap. 100)
- BodyTech Costanera (cap. 85)

---

## API Reference

### Auth
| Método | Endpoint | Descripción |
|---|---|---|
| POST | `/api/auth/login` | Login con email + password |
| POST | `/api/auth/register` | Registro nuevo usuario |

### Gyms
| Método | Endpoint | Descripción | Auth |
|---|---|---|---|
| GET | `/api/gyms` | Todos los gimnasios | — |
| GET | `/api/gyms/:id` | Detalle de un gym | — |
| GET | `/api/gyms/for-user/:userId` | Gyms según membresía | — |
| GET | `/api/gyms/:id/predictive` | Estadísticas predictivas | — |

### CheckIns
| Método | Endpoint | Descripción | Auth |
|---|---|---|---|
| POST | `/api/checkins` | Registrar entrada/salida | JWT |
| GET | `/api/checkins/active/:gymId/:identifier` | Estado actual de usuario | JWT |
| GET | `/api/checkins/dashboard/staff/:gymId` | Dashboard operativo | JWT |
| GET | `/api/checkins/dashboard/owner/:gymId?days=30` | Dashboard métricas negocio | JWT |

### Memberships
| Método | Endpoint | Descripción | Auth |
|---|---|---|---|
| GET | `/api/memberships/user/:userId` | Membresía de un usuario | — |
| POST | `/api/memberships` | Crear membresía | JWT |

### WebSockets (Socket.io)

```javascript
// Conectar
const socket = io('http://localhost:3001');

// Unirse a sala de un gym
socket.emit('join-gym', gymId);

// Escuchar actualizaciones de aforo
socket.on('capacity-update', (data) => {
  // data: { gymId, current, max, percentage }
});
```

---

## Roles y Permisos

| Funcionalidad | USER | GYM_STAFF | ADMIN |
|---|:---:|:---:|:---:|
| Ver gyms propios | ✅ | ✅ | ✅ |
| Ver aforo en tiempo real | ✅ | ✅ | ✅ |
| Ver gráficos predictivos | ✅ | ✅ | ✅ |
| Perfil + QR | ✅ | ✅ | ✅ |
| Torniquete kiosko | ❌ | ✅ | ✅ |
| Dashboard Staff | ❌ | ✅ | ✅ |
| Dashboard Owner | ❌ | ❌ | ✅ |
| Ver todos los gyms | ❌ | ✅ | ✅ |

---

## Roadmap

### ✅ v0.5.0 — Completado
- [x] Sistema de membresías con control de acceso por cadena
- [x] Autenticación JWT con persistencia localStorage
- [x] Registro en 3 pasos con validación RUT
- [x] Homepage con aforo en tiempo real y filtros
- [x] Detalle gym con gráficos predictivos (3 tabs)
- [x] Perfil usuario con QR descargable
- [x] Torniquete kiosko con simulación lector físico USB
- [x] Dashboard Staff operativo con feed tiempo real
- [x] Dashboard Owner con métricas de negocio
- [x] WebSockets para actualizaciones en tiempo real
- [x] Control de acceso: usuarios solo ven sus gyms
- [x] Navbar con navegación por roles

### 🔄 v0.6.0 — En progreso
- [ ] Script de simulación de tráfico para datos de prueba
- [ ] Precios reales de membresías en BD (campo `price` en `Membership`)
- [ ] Registro de membresía desde el flujo de registro

### 📋 v0.7.0 — Planificado
- [ ] Webhooks para integración con torniquetes físicos reales
- [ ] Gestión de membresías desde panel ADMIN
- [ ] Exportación de reportes CSV/PDF desde Dashboard Owner
- [ ] Configuración de capacidad máxima por gym desde ADMIN

### 🚀 v1.0.0 — Futuro (SaaS)
- [ ] Multi-tenant: cada cadena es un tenant independiente
- [ ] Planes de suscripción con facturación
- [ ] App móvil nativa (React Native)
- [ ] Integración con torniquetes físicos (API webhooks)
- [ ] Notificaciones push cuando el gym tiene bajo aforo

---

## Contribuir

```bash
# Crear rama de feature
git checkout -b feat/nombre-feature

# Commit con convención
git commit -m "feat: descripción del cambio"

# Push y PR
git push origin feat/nombre-feature
```

### Convención de commits

| Prefijo | Uso |
|---|---|
| `feat:` | Nueva funcionalidad |
| `fix:` | Corrección de bug |
| `refactor:` | Refactorización sin cambio funcional |
| `docs:` | Documentación |
| `style:` | Cambios de estilo/formato |
| `chore:` | Mantenimiento, dependencias |

---

## Licencia

MIT © 2026 GymFlow