# 🏋️ GymFlow - Sistema de Control de Aforo para Gimnasios

## 📋 Descripción del Proyecto

**GymFlow** es una aplicación web full-stack que permite visualizar en tiempo real la capacidad y aforo de gimnasios cercanos. Los usuarios pueden ver cuántas personas hay en cada gimnasio para tomar decisiones informadas sobre cuándo ir a entrenar.

### ✨ Características Implementadas (Hasta Ahora)

- ✅ **Backend API** con NestJS + TypeScript
- ✅ **Base de datos** PostgreSQL con Prisma ORM
- ✅ **Frontend** con Next.js 14 + React + TypeScript
- ✅ **API REST** para consultar gimnasios
- ✅ **Cálculo de aforo** en tiempo real
- ✅ **4 gimnasios de prueba** en Santiago, Chile

### 🚧 Pendiente de Implementar

- ⏳ Sistema de check-in/check-out
- ⏳ WebSockets para actualizaciones en tiempo real
- ⏳ Búsqueda de gimnasios por ubicación
- ⏳ Autenticación de usuarios
- ⏳ Panel de administración

---

## 🛠️ Stack Tecnológico

### Backend
- **Framework:** NestJS 11
- **Lenguaje:** TypeScript 5.7
- **ORM:** Prisma 5.22
- **Base de Datos:** PostgreSQL 15 (via pgAdmin local)
- **Validación:** class-validator + class-transformer
- **WebSockets:** Socket.io (pendiente)

### Frontend
- **Framework:** Next.js 14 (App Router)
- **Lenguaje:** TypeScript
- **Estilos:** Tailwind CSS
- **UI Components:** React (nativo)
- **HTTP Client:** Fetch API

### DevOps
- **Versionado:** Git + GitHub
- **Containerización:** Docker Compose (Redis - no usado aún)
- **IDE:** Visual Studio Code

---

## 📁 Estructura del Proyecto

```
gymflow-app/
├── backend/                      # API NestJS
│   ├── prisma/
│   │   ├── schema.prisma        # Esquema de base de datos
│   │   └── seed.ts              # Datos de prueba
│   ├── src/
│   │   ├── modules/
│   │   │   ├── prisma/          # Servicio de Prisma
│   │   │   │   ├── prisma.service.ts
│   │   │   │   └── prisma.module.ts
│   │   │   └── gyms/            # Módulo de gimnasios
│   │   │       ├── gyms.controller.ts
│   │   │       ├── gyms.service.ts
│   │   │       └── gyms.module.ts
│   │   ├── main.ts              # Entry point
│   │   └── app.module.ts        # Módulo principal
│   ├── .env                     # Variables de entorno (NO subir a Git)
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/                     # App Next.js
│   ├── src/
│   │   └── app/
│   │       └── page.tsx         # Página principal (lista de gyms)
│   ├── .env.local               # Variables de entorno (NO subir a Git)
│   ├── package.json
│   ├── tailwind.config.ts
│   └── next.config.js
│
├── docker-compose.yml           # Configuración Docker (Redis)
└── README.md                    # Este archivo
```

---

## 🗄️ Modelo de Base de Datos

### Tablas Creadas

#### **users**
```prisma
model User {
  id        String   @id @default(uuid())
  email     String   @unique
  password  String
  name      String
  role      Role     @default(USER)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  checkins  CheckIn[]
}
```

#### **gyms**
```prisma
model Gym {
  id          String   @id @default(uuid())
  name        String
  address     String
  latitude    Float
  longitude   Float
  maxCapacity Int
  description String?
  features    String[]
  imageUrl    String?
  rating      Float    @default(0)
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  checkins    CheckIn[]
}
```

#### **checkins**
```prisma
model CheckIn {
  id         String    @id @default(uuid())
  gymId      String
  userId     String?
  checkedIn  DateTime  @default(now())
  checkedOut DateTime?
  gym        Gym       @relation(...)
  user       User?     @relation(...)
}
```

#### **Role** (enum)
```prisma
enum Role {
  USER
  ADMIN
  GYM_STAFF
}
```

---

## 🚀 Instalación y Configuración

### Prerrequisitos

- ✅ Node.js 20+ instalado
- ✅ PostgreSQL (via pgAdmin 4)
- ✅ Git
- ✅ Visual Studio Code

### Paso 1: Clonar el Repositorio

```bash
git clone https://github.com/alexmqez12/gymflow-app.git
cd gymflow-app
```

### Paso 2: Configurar Backend

```bash
cd backend

# Instalar dependencias
npm install

# Crear archivo .env
copy .env.example .env

# Editar .env con tus credenciales de PostgreSQL
# DATABASE_URL="postgresql://gymflow_user:gymflow_password@localhost:5432/gymflow_db?schema=public"

# Generar Prisma Client
npx prisma generate

# Ejecutar migraciones
npx prisma migrate dev --name init

# Cargar datos de prueba
npm run prisma:seed

# Iniciar servidor
npm run start:dev
```

**Backend corriendo en:** http://localhost:3001/api

### Paso 3: Configurar Frontend

```bash
cd frontend

# Instalar dependencias
npm install

# Crear archivo .env.local
copy .env.example .env.local

# Editar .env.local
# NEXT_PUBLIC_API_URL=http://localhost:3001/api

# Iniciar servidor
npm run dev
```

**Frontend corriendo en:** http://localhost:3000

---

## 🔌 API Endpoints Disponibles

### Gimnasios

| Método | Endpoint | Descripción | Respuesta |
|--------|----------|-------------|-----------|
| `GET` | `/api/gyms` | Listar todos los gimnasios | Array de gimnasios con aforo actual |
| `GET` | `/api/gyms/:id` | Obtener detalle de un gimnasio | Objeto gimnasio con aforo |

#### Ejemplo de Respuesta `/api/gyms`:

```json
[
  {
    "id": "uuid",
    "name": "PowerGym Las Condes",
    "address": "Av. Apoquindo 4800, Las Condes",
    "latitude": -33.4172,
    "longitude": -70.5476,
    "maxCapacity": 80,
    "description": "Gimnasio premium...",
    "features": ["Pesas", "Cardio", "Clases Grupales", "Sauna"],
    "imageUrl": null,
    "rating": 4.5,
    "isActive": true,
    "createdAt": "2026-02-07T...",
    "updatedAt": "2026-02-07T...",
    "currentCapacity": 1,
    "availableSpots": 79,
    "occupancyPercentage": 1
  }
]
```

---

## 🔧 Scripts Disponibles

### Backend

```bash
npm run start:dev       # Modo desarrollo con hot-reload
npm run build           # Compilar para producción
npm run start:prod      # Ejecutar build de producción
npm run prisma:generate # Generar Prisma Client
npm run prisma:migrate  # Crear/ejecutar migraciones
npm run prisma:studio   # Abrir interfaz visual de BD
npm run prisma:seed     # Cargar datos de prueba
```

### Frontend

```bash
npm run dev      # Modo desarrollo
npm run build    # Compilar para producción
npm run start    # Ejecutar build de producción
npm run lint     # Ejecutar linter
```

---

## 🗂️ Variables de Entorno

### Backend `.env`

```env
DATABASE_URL="postgresql://gymflow_user:gymflow_password@localhost:5432/gymflow_db?schema=public"
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000
```

### Frontend `.env.local`

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_WS_URL=http://localhost:3001
```

⚠️ **IMPORTANTE:** Estos archivos NO deben subirse a Git (están en `.gitignore`)

---

## 📊 Datos de Prueba

El comando `npm run prisma:seed` carga:

### Usuarios
- **Email:** admin@gymflow.com
- **Nombre:** Admin User
- **Rol:** ADMIN

### Gimnasios (4)
1. **PowerGym Las Condes** - Av. Apoquindo 4800 (Capacidad: 80)
2. **FitZone Providencia** - Av. Providencia 2100 (Capacidad: 90)
3. **SmartFit Vitacura** - Av. Vitacura 5600 (Capacidad: 100)
4. **BodyTech Costanera** - Av. Costanera 8700 (Capacidad: 85)

### Check-ins
- 1 check-in activo en PowerGym Las Condes

---

## 🐛 Problemas Comunes y Soluciones

### Error: "Cannot connect to database"

**Causa:** PostgreSQL no está corriendo o credenciales incorrectas.

**Solución:**
1. Verifica que pgAdmin esté abierto
2. Verifica que la base de datos `gymflow_db` exista
3. Verifica el usuario `gymflow_user` y su contraseña en `.env`

### Error: "Port 3001 already in use"

**Solución:**
```bash
# Encuentra el proceso
netstat -ano | findstr :3001

# Mata el proceso (reemplaza PID)
taskkill /PID <PID> /F
```

### Error: "Prisma Client not generated"

**Solución:**
```bash
cd backend
npx prisma generate
```

### Error de CORS en el frontend

**Solución:** Verifica que `CORS_ORIGIN` en `backend/.env` sea `http://localhost:3000`

---

## 🏗️ Decisiones Técnicas Importantes

### ¿Por qué PostgreSQL local en lugar de Docker?

Durante el desarrollo encontramos problemas de autenticación con PostgreSQL en Docker desde Windows. La solución más práctica fue usar PostgreSQL local via pgAdmin, que ya estaba instalado.

### ¿Por qué Prisma 5.22 y no Prisma 7?

Prisma 7 (la última versión) cambió completamente la configuración y requiere archivos `prisma.config.ts`. Por estabilidad, usamos Prisma 5.22 que tiene una configuración más tradicional y documentación más completa.

### ¿Por qué Next.js App Router?

Next.js 14 usa el App Router por defecto, que es el futuro del framework. Aunque tiene una curva de aprendizaje, es más potente y está mejor optimizado.

---

## 📈 Próximos Pasos del Proyecto

### Corto Plazo
1. ✅ ~~Conectar frontend con backend~~ (HECHO)
2. ⏳ Crear módulo de check-ins en backend
3. ⏳ Implementar WebSockets para actualizaciones en tiempo real
4. ⏳ Crear componentes UI reutilizables
5. ⏳ Agregar búsqueda por ubicación

### Mediano Plazo
6. ⏳ Sistema de autenticación (JWT)
7. ⏳ Panel de administración para gimnasios
8. ⏳ Gráficas de ocupación histórica
9. ⏳ Notificaciones cuando un gym esté disponible
10. ⏳ Sistema de reservas

### Largo Plazo
11. ⏳ App móvil (React Native)
12. ⏳ Integración con wearables
13. ⏳ Sistema de gamificación
14. ⏳ Deploy a producción (Vercel + Railway/Render)

---

## 🤝 Contribución

Este es un proyecto en desarrollo activo. Para contribuir:

1. Fork el repositorio
2. Crea una rama: `git checkout -b feature/nueva-funcionalidad`
3. Commit: `git commit -m 'Add: nueva funcionalidad'`
4. Push: `git push origin feature/nueva-funcionalidad`
5. Abre un Pull Request

---

## 📝 Notas de Desarrollo

### Estado Actual del Proyecto

**Fecha:** 09 de Febrero, 2026  
**Versión:** 0.1.0 (MVP en desarrollo)

**Lo que funciona:**
- ✅ Backend API con NestJS
- ✅ Base de datos PostgreSQL con Prisma
- ✅ Endpoint para listar gimnasios con aforo
- ✅ Frontend básico con Next.js mostrando gimnasios
- ✅ Comunicación frontend ↔ backend funcionando

**Lo que falta:**
- ❌ Check-ins/Check-outs
- ❌ WebSockets en tiempo real
- ❌ Autenticación
- ❌ Búsqueda geolocalizada
- ❌ Panel de admin
- ❌ Tests unitarios
- ❌ Docker funcional para desarrollo
- ❌ Deploy a producción

### Archivos Importantes Creados

**Backend:**
- `src/main.ts` - Entry point con configuración CORS
- `src/app.module.ts` - Módulo raíz
- `src/modules/prisma/*` - Servicio de conexión a BD
- `src/modules/gyms/*` - Módulo de gimnasios (controller + service)
- `prisma/schema.prisma` - Esquema de base de datos
- `prisma/seed.ts` - Datos de prueba
- `tsconfig.seed.json` - Config TypeScript para seed

**Frontend:**
- `src/app/page.tsx` - Página principal con lista de gimnasios
- `tailwind.config.ts` - Configuración Tailwind
- `next.config.js` - Configuración Next.js

---

## 📞 Contacto y Soporte

**Desarrollador:** Alex Márquez  
**GitHub:** [@alexmqez12](https://github.com/alexmqez12)  
**Email:** [Tu email aquí]

---

## 📜 Licencia

MIT License - Este proyecto es de código abierto y puede ser usado libremente.

---

## 🙏 Agradecimientos

- **NestJS** - Por el excelente framework backend
- **Next.js** - Por hacer React tan fácil
- **Prisma** - Por el mejor ORM de TypeScript
- **Tailwind CSS** - Por el sistema de estilos utility-first

---

**Última actualización:** 09 de Febrero, 2026  
**Mantenido por:** Alex Márquez
