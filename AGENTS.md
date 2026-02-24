# AI Agents Guidelines

## Tech Stack
- **Backend Framework**: NestJS (Fastify)
- **Frontend Framework**: Nuxt 4 / Vue 3 (in `ui/` folder)
- **Database/ORM**: Prisma
- **Language**: TypeScript
- **Runtime & Package Manager**: Node.js, `pnpm`
- **Testing**: Jest (Unit & E2E)
- **Containerization**: Docker

## Specific Project Structure
- `src/` — Backend NestJS application (Microservice with REST API).
- `ui/` — Frontend application (Nuxt/Vue).
- `packages/` — Shared workspace packages (e.g., `packages/shared/`).
- `prisma/` — Database schema and migrations.
- `test/unit/` — Unit tests. Setup: `test/setup/unit.setup.ts`.
- `test/e2e/` — E2E tests. Setup: `test/setup/e2e.setup.ts`.
- `docs/` — Guides and `CHANGELOG.md`.
- `dev_docs/` — Development stage docs.

## General Principles
- Communication with the user is conducted in Russian (including plans and reasoning).
- Code, commits, JSDoc, variable and function names, messages, and strings must be in English (except i18n).
- Write minimalist, readable code. Follow DRY and SOLID principles.
- If you find minor issues in a working file (typos, formatting) — fix them. For serious ones (vulnerabilities) — report them, but do not fix without a command.

## Code and Architecture
- Prefer `interface` over `type` for objects.
- Functions with 3 or more arguments should accept a parameters object.
- Use named exports instead of default exports.
- Choose the most common, proven solutions for specific tasks.
- Do not change DB schemas, do not run migrations (unless explicitly requested via `pnpm db:dev:migrate`), and do not change the API without an explicit request.

## Documentation and Tests
- Add detailed comments only to complex blocks; skip them for obvious lines.
- Place single-line comments strictly above the commented line.
- When adding or changing functionality, update relevant tests and documentation (including `README.md` and `docs/CHANGELOG.md`).

## Dependencies & Configuration
- Use only official, well-maintained libraries.
- Rely on the latest stable versions and official documentation.
- Always use Context7 for code generation, setup, or retrieving documentation for libraries/APIs.
- **Environment variables**: `.env.production.example` is the source of truth for expected variables.
