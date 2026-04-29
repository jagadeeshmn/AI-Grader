# AI Grader

An intelligent, role-based course management and assignment grading platform built with Next.js 16, powered by Claude for automated evaluation, retrieval-augmented grading, and course analytics.

---

## Overview

AI Grader manages the complete lifecycle of academic courses — from enrollment and assignment creation to AI-powered grading grounded in course reference material. It supports three distinct user roles (Admin, Instructor, Student), each with a tailored experience.

Grading is not a blind LLM call: instructors upload reference material per course, which is chunked, embedded, and stored in pgvector. At grading time, the platform retrieves the most relevant chunks for each rubric criterion and injects them into the prompt, so Claude grades against the instructor's own source of truth.

The platform also ships with a Model Context Protocol (MCP) server that exposes live course analytics as typed tools, letting an admin query the application from Claude Desktop in natural language without writing any code.

---

## Features

### Role-Based Access Control

Three user roles enforced at both the UI and server-action level.

### Admin

- **Course management** — Create courses with a name and batch (e.g. `2025-Spring`).
- **Instructor assignment** — Assign or reassign an instructor to any course.
- **Student enrollment** — Enroll or unenroll students through a dedicated management UI.
- **AI analytics via MCP** — Connect Claude Desktop to the platform's MCP server and ask natural-language questions against live data:
  - _"Which courses have the lowest submission rates?"_
  - _"Show the grade distribution for the Networks midterm."_
  - _"List all students who haven't submitted Assignment 3."_

### Instructor

- **Assignment authoring** — Create and edit assignments with a live split-pane markdown editor, supporting rich text, code blocks, tables, and image attachments.
- **Rubric definition** — Attach a structured rubric to each assignment specifying criterion, description, and max points per criterion.
- **Course reference material** — Upload long-form reference content (lecture notes, textbook excerpts, standards documents). The platform automatically chunks the text (~2,500 chars, 200 char overlap) using LangChain's `RecursiveCharacterTextSplitter`, generates embeddings, and stores them for retrieval at grading time.
- **Submission deadline** — Set a deadline per assignment; submissions close automatically once the deadline passes.
- **RAG-grounded AI grading** — For each rubric criterion, the platform retrieves 15 candidate chunks via pgvector cosine similarity, re-ranks them with Voyage AI's `rerank-2` cross-encoder, injects the top 5 into the grading prompt, and calls Claude with forced tool use to return structured per-criterion scores and feedback. Falls back gracefully when no materials exist.

### Student

- **Course dashboard** — View enrolled courses and their assignments, organized with tabs.
- **Assignment submission** — Submit markdown work before the deadline.
- **Grades & feedback** — See total score, per-criterion breakdown, and AI-generated feedback after grading.

### Retrieval-Augmented Grading Pipeline

A two-stage RAG pipeline built on pgvector with cross-encoder re-ranking — no external vector DB:

```
Instructor uploads reference material
         │
         ▼
  LangChain RecursiveCharacterTextSplitter (~2,500 chars, 200 char overlap)
         │
         ▼
  Voyage AI embeddings (voyage-2, 1024 dims, batched)
         │
         ▼
  pgvector table with HNSW index (vector_cosine_ops)

─────────────────────────────────────────────────────

Instructor clicks "Evaluate"
         │
         ▼
  For each rubric criterion:
    query = criterion + description
    retrieve top 15 candidates (cosine distance, scoped by courseId via JOIN)
         │
         ▼
  Voyage AI rerank-2 cross-encoder → top 5 chunks by relevance score
         │
         ▼
  Prompt = system + rubric + assignment + submission + top 5 chunks
         │
         ▼
  Claude (forced tool use) → { scores[], totalMarks, feedback }
         │
         ▼
  Written to evaluations table
```

### MCP Analytics Server

A built-in Model Context Protocol server exposes the database as typed tools any MCP-compatible client can call:

| Tool                               | Description                                              |
| ---------------------------------- | -------------------------------------------------------- |
| `list_courses`                     | List all courses with enrollment + instructor            |
| `get_course_summary`               | Enrollment, assignment count, submission rate, avg grade |
| `get_submission_stats`             | Per-assignment submission and grade stats                |
| `get_grade_distribution`           | Grade bands, avg/min/max for an assignment               |
| `get_students_without_submissions` | Students who missed an assignment                        |
| `get_ungraded_submissions`         | Submissions pending grading                              |

---

## Tech Stack

| Layer          | Technology                                                              |
| -------------- | ----------------------------------------------------------------------- |
| Framework      | Next.js 16 (App Router, RSC, Server Actions, Turbopack)                 |
| Language       | TypeScript 5                                                            |
| Authentication | Stack Auth (`@stackframe/stack`)                                        |
| Database       | Neon — serverless PostgreSQL                                            |
| ORM            | Drizzle ORM + Drizzle Kit (migrations)                                  |
| Vector Store   | pgvector (HNSW, `vector_cosine_ops`) — colocated in Neon                |
| Embeddings     | Voyage AI (`voyage-2`, 1024 dimensions)                                 |
| Text Splitting | LangChain `RecursiveCharacterTextSplitter` (`@langchain/textsplitters`) |
| Re-ranking     | Voyage AI (`rerank-2` cross-encoder)                                    |
| LLM            | Anthropic Claude (`@anthropic-ai/sdk`) with forced tool use             |
| MCP            | `@modelcontextprotocol/sdk` — stdio transport                           |
| Styling        | Tailwind CSS 4 + shadcn/ui (Radix UI primitives)                        |
| Markdown       | `@uiw/react-md-editor` (editing) + `react-markdown` (rendering)         |
| Icons          | Lucide React                                                            |
| Lint / Format  | Biome                                                                   |
