# AI Grader

Role-based course platform (Admin/Instructor/Student) with a RAG grading pipeline.

## Stack

- Next.js 16 App Router, React Server Components, Server Actions, TypeScript 5
- Neon Postgres + Drizzle ORM (migrations via drizzle-kit)
- Stack Auth, Tailwind 4, shadcn/ui, Biome for lint/format
- Anthropic SDK (@anthropic-ai/sdk), Claude Haiku 4.5, forced tool use
- RAG: LangChain splitter, Voyage voyage-2 embeddings (1024d, HNSW), rerank-2
- Langfuse for tracing (in progress)

## Commands

- npm run dev / npm run build
- npx biome check --write .
- npx drizzle-kit generate && npx drizzle-kit migrate
- [add your test command once tests exist]

## Architecture conventions

- Server actions in src/app/actions/ are thin callers only. Business logic
  lives in pure functions under src/lib/.
- Grading has two modes behind GRADING_MODE=single|agentic. The single-pass
  path is the control in an A/B experiment: NEVER modify its behavior.
- Agent modules live in src/lib/agents/, each an async function
  (state: GradingState) => Partial<GradingState>.
- All structured LLM calls go through callStructured() in
  src/lib/agents/llm.ts (forced tool use, Zod-derived input_schema,
  schema.parse on the result).
- One Langfuse trace per grading run, one span per agent.

## Active work

Implementing docs/plans/AI_Grader_Multi_Agent_Plan.md. Follow its step
numbers. Current step: [update as you go].

## Rules

- Ask before any schema change or new dependency.
- Never touch .env or commit secrets.
- Small diffs: one step of the plan per session, stop after each for review.
- Write or update tests for any pure function you add.
