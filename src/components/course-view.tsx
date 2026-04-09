"use client";

import Link from "next/link";
import {
  BookOpen,
  CalendarClock,
  ChevronRight,
  ClipboardList,
  FileText,
  GraduationCap,
  Home,
  Users,
} from "lucide-react";
import { CourseMaterials } from "@/components/course-materials";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type CourseAssignment = {
  id: number;
  title: string;
  slug: string;
  published: boolean;
  deadline: string | null;
  rubric: { criterion: string; maxPoints: number; description: string }[];
  createdAt: string;
};

type Course = {
  id: number;
  name: string;
  batch: string;
  instructorId: string;
  instructorName: string | null;
  createdAt: string;
};

type Material = {
  id: number;
  title: string;
  content: string;
  createdAt: string;
};

interface CourseViewProps {
  course: Course;
  courseAssignments: CourseAssignment[];
  enrolledCount: number;
  materials?: Material[];
}

function formatDeadline(deadline: string | null) {
  if (!deadline) return null;
  return new Date(deadline).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isOverdue(deadline: string | null) {
  if (!deadline) return false;
  return new Date(deadline) < new Date();
}

export function CourseView({
  course,
  courseAssignments,
  enrolledCount,
  materials,
}: CourseViewProps) {
  const hasMaterials = materials && materials.length >= 0;

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
        <Link
          href="/courses"
          className="hover:text-foreground transition-colors"
        >
          Courses
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground font-medium">{course.name}</span>
      </nav>

      {/* Course hero */}
      <div className="rounded-xl border bg-card px-6 py-5 flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight">{course.name}</h1>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Badge variant="outline">{course.batch}</Badge>
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {enrolledCount} student{enrolledCount !== 1 ? "s" : ""}
            </span>
            <span className="flex items-center gap-1">
              <GraduationCap className="h-3.5 w-3.5" />
              {course.instructorName ?? "No instructor assigned"}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs — Materials tab only shown for instructors */}
      <Tabs defaultValue="assignments" className="flex flex-col gap-4">
        <TabsList className="w-fit">
          <TabsTrigger
            value="assignments"
            className="flex items-center gap-1.5"
          >
            <BookOpen className="h-3.5 w-3.5" />
            Assignments
            <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0">
              {courseAssignments.length}
            </Badge>
          </TabsTrigger>
          {hasMaterials && (
            <TabsTrigger
              value="materials"
              className="flex items-center gap-1.5"
            >
              <FileText className="h-3.5 w-3.5" />
              Materials
              <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0">
                {materials.length}
              </Badge>
            </TabsTrigger>
          )}
        </TabsList>

        {/* ── Assignments Tab ─────────────────────────────────── */}
        <TabsContent value="assignments">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <BookOpen className="h-4 w-4" />
                  Assignments
                </CardTitle>
                <Badge variant="secondary">{courseAssignments.length}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {courseAssignments.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">
                  No assignments yet.
                </p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {courseAssignments.map((assignment) => {
                    const totalMarks = assignment.rubric.reduce(
                      (sum, c) => sum + c.maxPoints,
                      0
                    );
                    const overdue = isOverdue(assignment.deadline);
                    return (
                      <Link
                        key={assignment.id}
                        href={`/assignment/${assignment.id}`}
                        className="group rounded-lg border bg-card p-4 hover:border-foreground/20 hover:shadow-sm transition-all"
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                            <ClipboardList className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <Badge
                            variant={
                              assignment.published ? "default" : "outline"
                            }
                          >
                            {assignment.published ? "Published" : "Draft"}
                          </Badge>
                        </div>
                        <p className="text-sm font-medium group-hover:underline truncate">
                          {assignment.title}
                        </p>
                        <div className="flex items-center gap-3 mt-2 flex-wrap">
                          {assignment.deadline ? (
                            <span
                              className={`flex items-center gap-1 text-xs ${
                                overdue
                                  ? "text-destructive"
                                  : "text-muted-foreground"
                              }`}
                            >
                              <CalendarClock className="h-3 w-3" />
                              {overdue ? "Closed · " : "Due · "}
                              {formatDeadline(assignment.deadline)}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              No deadline
                            </span>
                          )}
                          {assignment.rubric.length > 0 && (
                            <span className="text-xs text-muted-foreground">
                              {totalMarks} marks · {assignment.rubric.length}{" "}
                              criteria
                            </span>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Materials Tab (instructors only) ─────────────────── */}
        {hasMaterials && (
          <TabsContent value="materials">
            <CourseMaterials courseId={course.id} materials={materials} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
