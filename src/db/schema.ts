import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  boolean,
  primaryKey,
  jsonb,
  unique,
  index,
} from "drizzle-orm/pg-core";
import { vector } from "drizzle-orm/pg-core";

// ─── Users ────────────────────────────────────────────────────────────────────
// Mirrors Stack Auth users. Role controls what the user can do.
export const usersSync = pgTable("usersSync", {
  id: text("id").primaryKey(), // Stack Auth user ID
  name: text("name"),
  email: text("email"),
  role: text("role", { enum: ["admin", "student", "instructor"] })
    .default("student")
    .notNull(),
});

export type User = typeof usersSync.$inferSelect;
export type NewUser = typeof usersSync.$inferInsert;

// ─── Courses ──────────────────────────────────────────────────────────────────
// Admin creates courses and assigns an instructor to each.
// Students are linked via the courseStudents junction table.
export const courses = pgTable("courses", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  batch: text("batch").notNull(), // e.g. "2024-Spring"
  instructorId: text("instructor_id")
    .notNull()
    .references(() => usersSync.id),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "string" }).defaultNow().notNull(),
});

export type Course = typeof courses.$inferSelect;
export type NewCourse = typeof courses.$inferInsert;

// ─── Course ↔ Student enrollment ─────────────────────────────────────────────
// Admin assigns students to courses. Composite PK prevents duplicate enrollment.
export const courseStudents = pgTable(
  "course_students",
  {
    courseId: integer("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    studentId: text("student_id")
      .notNull()
      .references(() => usersSync.id, { onDelete: "cascade" }),
    enrolledAt: timestamp("enrolled_at", { mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [primaryKey({ columns: [table.courseId, table.studentId] })],
);

export type CourseStudent = typeof courseStudents.$inferSelect;

// ─── Assignments ──────────────────────────────────────────────────────────────
// Created by an instructor and belong to a specific course.
// rubric: array of { criterion: string, maxPoints: number, description: string }
export const assignments = pgTable("assignments", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  content: text("content").notNull(),
  imageUrl: text("image_url"),
  published: boolean("published").default(false).notNull(),
  deadline: timestamp("deadline", { mode: "string" }),
  rubric: jsonb("rubric").$type<RubricCriterion[]>().default([]).notNull(),
  courseId: integer("course_id")
    .notNull()
    .references(() => courses.id, { onDelete: "cascade" }),
  authorId: text("author_id")
    .notNull()
    .references(() => usersSync.id),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "string" }).defaultNow().notNull(),
});

export type RubricCriterion = {
  criterion: string;
  maxPoints: number;
  description: string;
};

export type Assignment = typeof assignments.$inferSelect;
export type NewAssignment = typeof assignments.$inferInsert;

// ─── Submissions ──────────────────────────────────────────────────────────────
// A student's response to an assignment. One submission per student per assignment
// (enforced via unique constraint); resubmitting before the deadline overwrites.
export const submissions = pgTable(
  "submissions",
  {
    id: serial("id").primaryKey(),
    assignmentId: integer("assignment_id")
      .notNull()
      .references(() => assignments.id, { onDelete: "cascade" }),
    studentId: text("student_id")
      .notNull()
      .references(() => usersSync.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    submittedAt: timestamp("submitted_at", { mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("uq_submission_student_assignment").on(
      table.assignmentId,
      table.studentId,
    ),
  ],
);

export type Submission = typeof submissions.$inferSelect;

// ─── Grades ───────────────────────────────────────────────────────────────────
// AI-generated (or instructor-overridden) grade for a submission.
// One grade per submission; re-grading overwrites via onConflictDoUpdate.
export type CriterionScore = {
  criterion: string;
  score: number;
  maxPoints: number;
  feedback: string;
};

export const grades = pgTable("grades", {
  id: serial("id").primaryKey(),
  submissionId: integer("submission_id")
    .notNull()
    .unique()
    .references(() => submissions.id, { onDelete: "cascade" }),
  criterionScores: jsonb("criterion_scores")
    .$type<CriterionScore[]>()
    .notNull(),
  overallFeedback: text("overall_feedback").notNull(),
  totalScore: integer("total_score").notNull(),
  maxScore: integer("max_score").notNull(),
  source: text("source", { enum: ["ai", "instructor"] })
    .default("ai")
    .notNull(),
  gradedAt: timestamp("graded_at", { mode: "string" }).defaultNow().notNull(),
});

export type Grade = typeof grades.$inferSelect;

// ─── Course Reference Materials ───────────────────────────────────────────────
// Instructors upload reference material per course (e.g. lecture notes, rubric
// guides). Content is chunked and embedded for RAG-based grading.
export const courseMaterials = pgTable("course_materials", {
  id: serial("id").primaryKey(),
  courseId: integer("course_id")
    .notNull()
    .references(() => courses.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  content: text("content").notNull(), // full raw text
  uploadedBy: text("uploaded_by")
    .notNull()
    .references(() => usersSync.id),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
});

export type CourseMaterial = typeof courseMaterials.$inferSelect;
export type NewCourseMaterial = typeof courseMaterials.$inferInsert;

// ─── Material Chunks ──────────────────────────────────────────────────────────
// Each material is split into ~2,500-char chunks. Embeddings (Voyage AI,
// 1024-dim) enable cosine-similarity retrieval at grading time.
// Query = concatenated rubric criterion descriptions → top 3–5 chunks returned.
export const materialChunks = pgTable(
  "material_chunks",
  {
    id: serial("id").primaryKey(),
    materialId: integer("material_id")
      .notNull()
      .references(() => courseMaterials.id, { onDelete: "cascade" }),
    chunkIndex: integer("chunk_index").notNull(), // ordering within material
    content: text("content").notNull(), // ~2,500 chars with overlap
    embedding: vector("embedding", { dimensions: 1024 }), // Voyage AI voyage-2
  },
  (table) => [
    index("idx_material_chunks_embedding").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops"),
    ),
  ],
);

export type MaterialChunk = typeof materialChunks.$inferSelect;
export type NewMaterialChunk = typeof materialChunks.$inferInsert;

const schema = {
  usersSync,
  courses,
  courseStudents,
  assignments,
  submissions,
  grades,
  courseMaterials,
  materialChunks,
};
export default schema;
