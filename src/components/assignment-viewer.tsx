"use client";

import {
  Calendar,
  CalendarClock,
  ChevronRight,
  ClipboardList,
  Edit,
  FileText,
  Home,
  Mail,
  Pencil,
  Send,
  Sparkles,
  Trash,
  User,
  Users,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { deleteAssignmentForm } from "@/app/actions/assignments";
import { gradeSubmissionAction } from "@/app/actions/grading";
import { submitAssignmentForm } from "@/app/actions/submissions";
import type { CriterionScore, RubricCriterion } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GradeOverrideForm } from "@/components/grade-override-form";
import { GradeWithAIButton, ReGradeButton } from "@/components/grade-button";
import { RubricEditor } from "@/components/rubric-editor";

interface ViewerAssignment {
  title: string;
  author: string | null;
  id: number;
  content: string;
  createdAt: string;
  imageUrl?: string | null;
  deadline?: string | null;
  rubric?: RubricCriterion[];
  authorId?: string;
  courseId?: number;
}

interface ExistingSubmission {
  id: number;
  content: string;
  submittedAt: string;
}

interface SubmissionRecord {
  id: number;
  studentId: string;
  studentName: string | null;
  studentEmail: string | null;
  content: string;
  submittedAt: string;
}

interface GradeRecord {
  id: number;
  submissionId: number;
  criterionScores: CriterionScore[];
  overallFeedback: string;
  totalScore: number;
  maxScore: number;
  source: string;
  gradedAt: string;
}

interface AssignmentViewerProps {
  assignment: ViewerAssignment;
  canEdit?: boolean;
  userRole?: string | null;
  existingSubmission?: ExistingSubmission | null;
  allSubmissions?: SubmissionRecord[] | null;
  submissionGrades?: GradeRecord[];
  studentGrade?: GradeRecord | null;
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatDeadline(deadline: string) {
  return new Date(deadline).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isOverdue(deadline: string | null | undefined) {
  if (!deadline) return false;
  return new Date(deadline) < new Date();
}

export default function AssignmentViewer({
  assignment,
  canEdit = false,
  userRole,
  existingSubmission,
  allSubmissions,
  submissionGrades = [],
  studentGrade,
}: AssignmentViewerProps) {
  const overdue = isOverdue(assignment.deadline);
  const totalMarks =
    assignment.rubric?.reduce((sum, c) => sum + c.maxPoints, 0) ?? 0;
  const canManageRubric = userRole === "instructor" || userRole === "admin";
  const [isEditingRubric, setIsEditingRubric] = useState(false);
  const isStudent = userRole === "student";
  const canViewSubmissions = userRole === "instructor" || userRole === "admin";

  // Build a fast lookup: submissionId → grade
  const gradeBySubmissionId = new Map(
    submissionGrades.map((g) => [g.submissionId, g]),
  );

  // Track which submission is currently being overridden
  const [overridingSubmissionId, setOverridingSubmissionId] = useState<
    number | null
  >(null);

  return (
    <div className="flex flex-col gap-6 px-6 py-8 lg:px-10">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link
          href="/"
          className="flex items-center gap-1 hover:text-foreground transition-colors"
        >
          <Home className="h-3.5 w-3.5" />
          Home
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        {assignment.courseId && (
          <>
            <Link
              href={`/courses/${assignment.courseId}`}
              className="hover:text-foreground transition-colors"
            >
              Course
            </Link>
            <ChevronRight className="h-3.5 w-3.5" />
          </>
        )}
        <span className="text-foreground font-medium">{assignment.title}</span>
      </nav>

      {/* Hero */}
      <div className="rounded-xl border bg-card px-6 py-5 flex items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight">
            {assignment.title}
          </h1>
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <User className="h-3.5 w-3.5" />
              {assignment.author ?? "Unknown"}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {formatDate(assignment.createdAt)}
            </span>
            {assignment.deadline && (
              <span
                className={`flex items-center gap-1 ${overdue ? "text-destructive" : ""}`}
              >
                <CalendarClock className="h-3.5 w-3.5" />
                {overdue ? "Closed · " : "Due · "}
                {formatDeadline(assignment.deadline)}
              </span>
            )}
            {assignment.rubric && assignment.rubric.length > 0 && (
              <Badge variant="secondary">{totalMarks} marks</Badge>
            )}
          </div>
        </div>

        {canEdit && (
          <div className="flex items-center gap-2 shrink-0">
            <Link href={`/assignment/edit/${assignment.id}`}>
              <Button variant="outline" size="sm">
                <Edit className="h-4 w-4 mr-1" />
                Edit
              </Button>
            </Link>
            <form action={deleteAssignmentForm}>
              <input type="hidden" name="id" value={String(assignment.id)} />
              <Button type="submit" variant="destructive" size="sm">
                <Trash className="h-4 w-4 mr-1" />
                Delete
              </Button>
            </form>
          </div>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="content" className="flex flex-col gap-4">
        <TabsList className="w-fit">
          <TabsTrigger value="content" className="flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            Assignment
          </TabsTrigger>
          {(canManageRubric ||
            (assignment.rubric && assignment.rubric.length > 0)) && (
            <TabsTrigger value="rubric" className="flex items-center gap-1.5">
              <ClipboardList className="h-3.5 w-3.5" />
              Rubric
              {assignment.rubric && assignment.rubric.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0">
                  {assignment.rubric.length}
                </Badge>
              )}
            </TabsTrigger>
          )}
          {isStudent && (
            <TabsTrigger
              value="submission"
              className="flex items-center gap-1.5"
            >
              <Send className="h-3.5 w-3.5" />
              Submission
              {existingSubmission && (
                <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0">
                  1
                </Badge>
              )}
            </TabsTrigger>
          )}
          {isStudent && studentGrade && (
            <TabsTrigger value="grade" className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              Grade
              <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0">
                {Math.round(
                  (studentGrade.totalScore / studentGrade.maxScore) * 100,
                )}
                %
              </Badge>
            </TabsTrigger>
          )}
          {canViewSubmissions && allSubmissions != null && (
            <TabsTrigger
              value="submissions"
              className="flex items-center gap-1.5"
            >
              <Users className="h-3.5 w-3.5" />
              Submissions
              <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0">
                {allSubmissions.length}
              </Badge>
            </TabsTrigger>
          )}
        </TabsList>

        {/* ── Assignment Content Tab ──────────────────────────── */}
        <TabsContent value="content">
          <Card>
            <CardContent className="pt-6">
              {assignment.imageUrl && (
                <div className="mb-8">
                  <div className="relative w-full h-64 md:h-80 rounded-lg overflow-hidden">
                    <Image
                      src={assignment.imageUrl}
                      alt={`Image for ${assignment.title}`}
                      fill
                      className="object-cover"
                      priority
                    />
                  </div>
                </div>
              )}
              <div className="prose prose-stone dark:prose-invert max-w-none">
                <ReactMarkdown
                  components={{
                    h1: ({ children }) => (
                      <h1 className="text-3xl font-bold mt-8 mb-4 text-foreground">
                        {children}
                      </h1>
                    ),
                    h2: ({ children }) => (
                      <h2 className="text-2xl font-semibold mt-6 mb-3 text-foreground">
                        {children}
                      </h2>
                    ),
                    h3: ({ children }) => (
                      <h3 className="text-xl font-semibold mt-4 mb-2 text-foreground">
                        {children}
                      </h3>
                    ),
                    p: ({ children }) => (
                      <p className="mb-4 text-foreground leading-7">
                        {children}
                      </p>
                    ),
                    ul: ({ children }) => (
                      <ul className="mb-4 ml-6 list-disc text-foreground">
                        {children}
                      </ul>
                    ),
                    ol: ({ children }) => (
                      <ol className="mb-4 ml-6 list-decimal text-foreground">
                        {children}
                      </ol>
                    ),
                    li: ({ children }) => (
                      <li className="mb-1 text-foreground">{children}</li>
                    ),
                    code: ({ children, className }) => {
                      const isInline = !className;
                      return isInline ? (
                        <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono text-foreground">
                          {children}
                        </code>
                      ) : (
                        <code className={className}>{children}</code>
                      );
                    },
                    pre: ({ children }) => (
                      <pre className="bg-muted p-4 rounded-lg overflow-x-auto mb-4 text-sm">
                        {children}
                      </pre>
                    ),
                    blockquote: ({ children }) => (
                      <blockquote className="border-l-4 border-muted-foreground pl-4 italic my-4 text-muted-foreground">
                        {children}
                      </blockquote>
                    ),
                    a: ({ children, href }) => (
                      <a
                        href={href}
                        className="text-primary hover:underline font-medium"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {children}
                      </a>
                    ),
                    table: ({ children }) => (
                      <div className="overflow-x-auto mb-4">
                        <table className="min-w-full border-collapse border border-border">
                          {children}
                        </table>
                      </div>
                    ),
                    th: ({ children }) => (
                      <th className="border border-border bg-muted px-4 py-2 text-left font-semibold">
                        {children}
                      </th>
                    ),
                    td: ({ children }) => (
                      <td className="border border-border px-4 py-2">
                        {children}
                      </td>
                    ),
                  }}
                >
                  {assignment.content}
                </ReactMarkdown>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Rubric Tab ──────────────────────────────────────── */}
        {(canManageRubric ||
          (assignment.rubric && assignment.rubric.length > 0)) && (
          <TabsContent value="rubric">
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <ClipboardList className="h-4 w-4" />
                      Rubric
                    </CardTitle>
                    {!isEditingRubric &&
                      assignment.rubric &&
                      assignment.rubric.length > 0 && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {totalMarks} total marks · {assignment.rubric.length}{" "}
                          criteria
                        </p>
                      )}
                  </div>
                  {canManageRubric && !isEditingRubric && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setIsEditingRubric(true)}
                    >
                      <Pencil className="h-3.5 w-3.5 mr-1" />
                      {assignment.rubric && assignment.rubric.length > 0
                        ? "Edit"
                        : "Add Rubric"}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {isEditingRubric ? (
                  <RubricEditor
                    assignmentId={assignment.id}
                    initialRubric={assignment.rubric ?? []}
                    onClose={() => setIsEditingRubric(false)}
                  />
                ) : assignment.rubric && assignment.rubric.length > 0 ? (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {assignment.rubric.map((criterion, i) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: display only
                      <div key={i} className="rounded-lg border p-4">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <p className="text-sm font-medium">
                            {criterion.criterion}
                          </p>
                          <Badge variant="secondary" className="shrink-0">
                            {criterion.maxPoints} pts
                          </Badge>
                        </div>
                        {criterion.description && (
                          <p className="text-xs text-muted-foreground">
                            {criterion.description}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No rubric defined yet.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* ── Student Submission Tab ──────────────────────────── */}
        {isStudent && (
          <TabsContent value="submission">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Send className="h-4 w-4" />
                  Your Submission
                </CardTitle>
                {assignment.deadline && (
                  <p
                    className={`text-sm ${overdue ? "text-destructive" : "text-muted-foreground"}`}
                  >
                    {overdue ? "Deadline closed · " : "Due · "}
                    {formatDeadline(assignment.deadline)}
                  </p>
                )}
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {existingSubmission && (
                  <>
                    <div className="flex flex-col gap-1">
                      <p className="text-xs text-muted-foreground">
                        Last submitted{" "}
                        {formatDate(existingSubmission.submittedAt)}
                      </p>
                      <div className="bg-muted rounded-lg p-4 text-sm whitespace-pre-wrap font-mono">
                        {existingSubmission.content}
                      </div>
                    </div>
                    {!overdue && <Separator />}
                  </>
                )}

                {overdue && !existingSubmission && (
                  <p className="text-sm text-muted-foreground py-2">
                    The deadline has passed. No submission was recorded.
                  </p>
                )}

                {!overdue && (
                  <form
                    action={submitAssignmentForm}
                    className="flex flex-col gap-3"
                  >
                    <input
                      type="hidden"
                      name="assignmentId"
                      value={assignment.id}
                    />
                    <label className="text-sm font-medium">
                      {existingSubmission
                        ? "Update your submission"
                        : "Write your submission"}
                    </label>
                    <textarea
                      name="content"
                      rows={10}
                      defaultValue={existingSubmission?.content ?? ""}
                      placeholder="Write your answer here…"
                      required
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-y"
                    />
                    <div className="flex justify-end">
                      <Button type="submit" size="sm">
                        <Send className="h-4 w-4 mr-2" />
                        {existingSubmission ? "Resubmit" : "Submit"}
                      </Button>
                    </div>
                  </form>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* ── Student Grade Tab ───────────────────────────────── */}
        {isStudent && studentGrade && (
          <TabsContent value="grade">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Your Grade
                    {studentGrade.source === "instructor" && (
                      <Badge variant="outline" className="text-xs font-normal">
                        Instructor reviewed
                      </Badge>
                    )}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono">
                      {studentGrade.totalScore}/{studentGrade.maxScore}
                    </span>
                    <Badge
                      variant={
                        Math.round(
                          (studentGrade.totalScore / studentGrade.maxScore) *
                            100,
                        ) >= 70
                          ? "default"
                          : "destructive"
                      }
                    >
                      {Math.round(
                        (studentGrade.totalScore / studentGrade.maxScore) * 100,
                      )}
                      %
                    </Badge>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Graded {formatDate(studentGrade.gradedAt)}
                </p>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {studentGrade.criterionScores.map((cs, i) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: display only
                    <div key={i} className="rounded-lg border p-4">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <p className="text-sm font-medium">{cs.criterion}</p>
                        <Badge
                          variant="secondary"
                          className="shrink-0 font-mono"
                        >
                          {cs.score}/{cs.maxPoints}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {cs.feedback}
                      </p>
                    </div>
                  ))}
                </div>

                <Separator />

                <div>
                  <p className="text-sm font-medium mb-1">Overall Feedback</p>
                  <p className="text-sm text-muted-foreground">
                    {studentGrade.overallFeedback}
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* ── All Submissions Tab (Instructor/Admin) ──────────── */}
        {canViewSubmissions && allSubmissions != null && (
          <TabsContent value="submissions">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Users className="h-4 w-4" />
                    Submissions
                  </CardTitle>
                  <Badge variant="secondary">
                    {allSubmissions.length} submitted
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {allSubmissions.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">
                    No submissions yet.
                  </p>
                ) : (
                  <div className="grid gap-4 lg:grid-cols-2">
                    {allSubmissions.map((sub) => {
                      const grade = gradeBySubmissionId.get(sub.id);
                      const pct = grade
                        ? Math.round((grade.totalScore / grade.maxScore) * 100)
                        : null;
                      return (
                        <div
                          key={sub.id}
                          className="rounded-lg border p-4 flex flex-col gap-3"
                        >
                          {/* Student header */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground shrink-0" />
                              <span className="text-sm font-medium">
                                {sub.studentName ?? "Unknown"}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                              <span className="flex items-center gap-1">
                                <Mail className="h-3 w-3" />
                                {sub.studentEmail}
                              </span>
                            </div>
                          </div>

                          {/* Submission content */}
                          <div className="bg-muted rounded-md p-3 text-sm whitespace-pre-wrap font-mono max-h-52 overflow-y-auto">
                            {sub.content}
                          </div>

                          {/* Grade result */}
                          {grade ? (
                            <div className="rounded-lg bg-muted/50 border p-4 flex flex-col gap-3">
                              {overridingSubmissionId === sub.id ? (
                                <GradeOverrideForm
                                  submissionId={sub.id}
                                  initialCriterionScores={grade.criterionScores}
                                  initialOverallFeedback={grade.overallFeedback}
                                  onClose={() =>
                                    setOverridingSubmissionId(null)
                                  }
                                />
                              ) : (
                                <>
                                  <div className="flex items-center justify-between">
                                    <p className="text-sm font-semibold flex items-center gap-1.5">
                                      <Sparkles className="h-4 w-4 text-primary" />
                                      {grade.source === "instructor"
                                        ? "Instructor Grade"
                                        : "AI Grade"}
                                    </p>
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-mono">
                                        {grade.totalScore}/{grade.maxScore}
                                      </span>
                                      <Badge
                                        variant={
                                          pct! >= 70 ? "default" : "destructive"
                                        }
                                      >
                                        {pct}%
                                      </Badge>
                                    </div>
                                  </div>

                                  {/* Criterion breakdown */}
                                  <div className="flex flex-col divide-y text-xs">
                                    {grade.criterionScores.map((cs, i) => (
                                      // biome-ignore lint/suspicious/noArrayIndexKey: display only
                                      <div
                                        key={i}
                                        className="py-2 first:pt-0 last:pb-0"
                                      >
                                        <div className="flex items-center justify-between gap-2 mb-0.5">
                                          <span className="font-medium">
                                            {cs.criterion}
                                          </span>
                                          <span className="shrink-0 font-mono text-muted-foreground">
                                            {cs.score}/{cs.maxPoints}
                                          </span>
                                        </div>
                                        <p className="text-muted-foreground">
                                          {cs.feedback}
                                        </p>
                                      </div>
                                    ))}
                                  </div>

                                  {/* Overall feedback */}
                                  <div className="border-t pt-3">
                                    <p className="text-xs text-muted-foreground font-medium mb-1">
                                      Overall feedback
                                    </p>
                                    <p className="text-xs">
                                      {grade.overallFeedback}
                                    </p>
                                  </div>

                                  {/* Actions */}
                                  <div className="flex items-center justify-end gap-2">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() =>
                                        setOverridingSubmissionId(sub.id)
                                      }
                                    >
                                      Override
                                    </Button>
                                    <form action={gradeSubmissionAction}>
                                      <input
                                        type="hidden"
                                        name="submissionId"
                                        value={sub.id}
                                      />
                                      <ReGradeButton />
                                    </form>
                                  </div>
                                </>
                              )}
                            </div>
                          ) : (
                            <form
                              action={gradeSubmissionAction}
                              className="flex justify-end"
                            >
                              <input
                                type="hidden"
                                name="submissionId"
                                value={sub.id}
                              />
                              <GradeWithAIButton />
                            </form>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Footer */}
      <div className="flex justify-start">
        <Link
          href={assignment.courseId ? `/courses/${assignment.courseId}` : "/"}
        >
          <Button variant="outline" size="sm">
            ← Back to Course
          </Button>
        </Link>
      </div>
    </div>
  );
}
