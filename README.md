# LexCR

LexCR es una aplicación web de productividad legal y notarial para profesionales independientes en Costa Rica. Conecta la gestión de clientes, Machotes reutilizables, Escrituras persistentes, preparación del Índice Notarial y cuentas por cobrar en un mismo espacio de trabajo.

**Trabajo de Fin de Máster de Sebastián Murillo Saborío**

Máster de Desarrollo con IA · 2026

Correo de inscripción: `semurillo25@gmail.com`

## Enlaces de entrega

| Recurso | Acceso |
|---|---|
| Aplicación desplegada | [https://lexcr.vercel.app](https://lexcr.vercel.app) |
| Código fuente | [https://github.com/MurilloS25/legal-saas](https://github.com/MurilloS25/legal-saas) |
| Presentación | [Carpeta pública de entrega en Google Drive](https://drive.google.com/drive/folders/1SUCZKEfDaGb_V5xCViJDb2qrXF0j2-Th?usp=sharing) |
| Vídeo | [Carpeta pública de entrega en Google Drive](https://drive.google.com/drive/folders/1SUCZKEfDaGb_V5xCViJDb2qrXF0j2-Th?usp=sharing) |

## Problema y propuesta

El trabajo notarial suele repartir la información entre documentos, modelos, hojas de cálculo y controles de cobro. Esto obliga a volver a escribir datos, dificulta mantener versiones coherentes de los Machotes y separa tareas que pertenecen al mismo flujo profesional.

LexCR mantiene el contexto desde el cliente y el Machote hasta la Escritura, la preparación del Índice Notarial y el seguimiento del cobro. La aplicación apoya el trabajo del profesional, pero no sustituye su revisión, criterio jurídico ni responsabilidades oficiales.

## Funcionalidades principales

- Autenticación privada mediante Supabase Auth.
- Workspaces con roles de propietario, administrador, asistente y solo lectura.
- Catálogo reutilizable de personas físicas y jurídicas.
- Creación y edición de Machotes con variables, transformaciones y bloques opcionales.
- Creación limitada con IA de nuevos Machotes en estado borrador, siempre sujetos a revisión y publicación humana.
- Escrituras persistentes vinculadas opcionalmente con un cliente.
- Snapshot del Machote utilizado para proteger documentos existentes frente a cambios posteriores.
- Descarga de documentos Word editables generados en memoria.
- Preparación y confirmación interna de metadatos para el Índice Notarial.
- Cuentas por cobrar y registro de pagos básicos en CRC o USD.
- Historial operativo para acciones relevantes sobre Escrituras y espacios de trabajo.
- Búsqueda, filtros, orden y paginación en los principales módulos.

## Límites del producto

LexCR no ofrece asesoría legal, no firma documentos, no presenta trámites oficiales y no sustituye la revisión profesional. Tampoco almacena archivos Word/PDF generados, documentos firmados, cargas oficiales ni rutas de almacenamiento de esos archivos.

La única función de IA incluida crea la estructura de un nuevo Machote en borrador. No publica contenido, no modifica Machotes existentes, no tiene herramientas externas y no funciona como chat jurídico.

## Stack tecnológico

- Next.js App Router 16 con React 19.
- TypeScript 6.
- Tailwind CSS 4.
- Supabase Auth y PostgreSQL.
- Row Level Security para el aislamiento por Workspace.
- Zod para validación.
- TipTap para contenido estructurado.
- `docx` para la generación de Word en memoria.
- Vitest para pruebas unitarias.
- Supabase SQL tests para autorización y RLS.
- Playwright para los flujos E2E de mayor valor.
- GitHub Actions y Dependabot.
- Vercel y Supabase Cloud en producción.
- Docker para la pila local de Supabase.

## Requisitos locales

- Node.js compatible con la versión declarada por el proyecto.
- pnpm `11.1.2`.
- Docker Desktop para Supabase local.
- Supabase CLI disponible mediante la dependencia del proyecto.

## Instalación

```bash
git clone https://github.com/MurilloS25/legal-saas.git
cd legal-saas
pnpm install --frozen-lockfile
```

Copia `.env.example` como `.env.local` y completa únicamente las variables necesarias para tu entorno. Nunca se deben confirmar archivos `.env` reales ni exponer `SUPABASE_SERVICE_ROLE_KEY` al navegador.

## Ejecución local

Inicia Supabase y la aplicación:

```bash
pnpm supabase start
pnpm dev
```

Abre [http://localhost:3000](http://localhost:3000). Para detener la infraestructura local:

```bash
pnpm supabase stop
```

La aplicación usa un piloto privado. Si necesitas una cuenta local, créala en Supabase Studio con el correo confirmado. El trigger de base de datos crea automáticamente su Workspace personal y la membresía de propietario.

## Variables de entorno

Las variables públicas necesarias son:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

Las funciones administrativas y la creación con IA utilizan variables exclusivas del servidor. Consulta `.env.example` y la documentación de seguridad antes de configurarlas. Las claves administrativas o de proveedores nunca deben usar el prefijo `NEXT_PUBLIC_`.

## Estructura del proyecto

```text
src/
  app/                 Rutas, layouts y Server Actions de Next.js
  features/            Módulos de negocio por funcionalidad
  lib/                 Infraestructura y lógica compartida
supabase/
  migrations/          Migraciones versionadas
  tests/               Pruebas SQL y de Row Level Security
e2e/                   Flujos Playwright de alto valor
test/                  Soporte para pruebas unitarias
docs/                  Decisiones de producto, arquitectura y operación
.github/                CI y automatización de dependencias
```

El sistema se organiza como un monolito modular. Las reglas de negocio no viven en componentes React y el acceso a datos respeta los límites de cada feature y las políticas RLS.

## Calidad y pruebas

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Los flujos E2E requieren Supabase local y una cuenta de pruebas configurada:

```bash
pnpm e2e
```

La cobertura prioriza parsing y reemplazo de variables, bloques opcionales, snapshots, exportación Word, reglas del Índice Notarial, cálculos de cobros, autorización y recorridos críticos de interfaz.

## Despliegue

La versión productiva se publica en Vercel y utiliza Supabase Cloud:

- Aplicación: [https://lexcr.vercel.app](https://lexcr.vercel.app)
- Rama de desarrollo oficial: `develop`
- Rama de producción configurada en Vercel: `main`

La configuración operativa, variables y pasos de verificación están documentados en [`docs/VERCEL_PRODUCTION.md`](docs/VERCEL_PRODUCTION.md) y [`docs/SUPABASE_PRODUCTION.md`](docs/SUPABASE_PRODUCTION.md).

## Documentación técnica

- [Alcance del MVP](docs/MVP_SCOPE.md)
- [Reglas del producto](docs/PRODUCT_RULES.md)
- [Arquitectura](docs/ARCHITECTURE.md)
- [Base de datos](docs/DATABASE.md)
- [Seguridad](docs/SECURITY.md)
- [Accesibilidad](docs/ACCESSIBILITY.md)
- [Exportación Word](docs/DOCX_EXPORT.md)
- [Creación de Machotes con IA](docs/AI_TEMPLATE_GENERATION.md)
- [Pruebas](docs/TESTING.md)
- [CI/CD](docs/CI_CD.md)
- [Desarrollo con Docker](docs/DOCKER.md)

## Licencia y uso

El repositorio se presenta como entrega académica. Su publicación no convierte el contenido en asesoría legal ni autoriza el uso de datos reales sin completar antes la revisión de seguridad, privacidad y condiciones de operación correspondientes.
