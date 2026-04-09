@AGENTS.md

# AI Grader

Role-based course management and AI grading platform.

## Roles

- **Admin** — course/enrollment management, AI analytics via MCP
- **Instructor** — assignment authoring (markdown), rubric builder, AI-assisted grading
- **Student** — submissions, grades/feedback, AI companion chat

## Stack

- **Framework:** Next.js 16 (App Router) with Turbopack
- **Language:** TypeScript
- **Auth:** Stack Auth (`@stackframe/stack`)
- **Database:** Neon PostgreSQL (serverless) + Drizzle ORM
- **Styling:** Tailwind CSS 4 + shadcn/ui (Radix UI primitives)
- **AI:** Anthropic Claude API (`@anthropic-ai/sdk`)
- **MCP:** `@modelcontextprotocol/sdk` — analytics server for admin
- **Linter/Formatter:** Biome

## Dev Commands

```bash
npm run dev          # Start dev server (Turbopack)
npm run build        # Production build (Turbopack)
npm run lint         # Biome check
npm run format       # Biome format --write
npm run typecheck    # tsc --noEmit
npm run mcp          # Start MCP analytics server
```

## Database Commands

```bash
npm run db:generate  # Generate Drizzle migrations
npm run db:migrate   # Run migrations
npm run db:seed      # Seed base data
```

## Post-Edit Checks

After editing any file, always run:

```bash
npm run lint && npm run format && npm run typecheck
```

## Project Structure

```
src/
  app/        # Next.js App Router pages and API routes
  components/ # Shared UI components
  db/         # Drizzle schema, migrations, seed scripts
  lib/        # Business logic and data access (analytics.ts, etc.)
  mcp/        # MCP server (server.ts) — exposes analytics tools to Claude
  stack/      # Stack Auth configuration
  types/      # Shared TypeScript types
```

## MCP Analytics Server

Exposes the following tools to Claude:

- `list_courses` — list all courses with enrollment + instructor
- `get_course_summary` — enrollment, assignment count, submission rate, avg grade
- `get_submission_stats` — per-assignment submission and grade stats
- `get_grade_distribution` — grade bands, avg/min/max for an assignment
- `get_students_without_submissions` — students who missed an assignment
- `get_ungraded_submissions` — submissions pending grading

Run with `npm run mcp`. Uses stdio transport.

## Environment Variables

- `DATABASE_URL` — Neon PostgreSQL connection string
- Stack Auth keys (see Stack Auth dashboard)
- Anthropic API key for AI grading and student chat
