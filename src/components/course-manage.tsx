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
  Mail,
  UserMinus,
  UserPlus,
  Users,
} from "lucide-react";
import {
  enrollStudentForm,
  unenrollStudentForm,
  updateCourseInstructorForm,
} from "@/app/actions/courses";
import { CourseMaterials } from "@/components/course-materials";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

type Person = {
  id: string;
  name: string | null;
  email: string | null;
};

type Material = {
  id: number;
  title: string;
  content: string;
  createdAt: string;
};

interface CourseManageProps {
  course: Course;
  enrolledStudents: Person[];
  availableStudents: Person[];
  allInstructors: Person[];
  courseAssignments: CourseAssignment[];
  materials: Material[];
}

function getInitials(name: string | null) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
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

export function CourseManage({
  course,
  enrolledStudents,
  availableStudents,
  allInstructors,
  courseAssignments,
  materials,
}: CourseManageProps) {
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
      <div className="rounded-xl border bg-card px-6 py-5 flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight">{course.name}</h1>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Badge variant="outline">{course.batch}</Badge>
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {enrolledStudents.length} student
              {enrolledStudents.length !== 1 ? "s" : ""}
            </span>
            <span className="flex items-center gap-1">
              <GraduationCap className="h-3.5 w-3.5" />
              {course.instructorName ?? "No instructor"}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="assignments" className="flex flex-col gap-4">
        <TabsList className="w-fit">
          <TabsTrigger value="assignments" className="flex items-center gap-1.5">
            <BookOpen className="h-3.5 w-3.5" />
            Assignments
            <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0">
              {courseAssignments.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="students" className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            Students
            <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0">
              {enrolledStudents.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="materials" className="flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            Materials
            <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0">
              {materials.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-1.5">
            <GraduationCap className="h-3.5 w-3.5" />
            Settings
          </TabsTrigger>
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

        {/* ── Students Tab ─────────────────────────────────────── */}
        <TabsContent value="students">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Enrolled students */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Users className="h-4 w-4" />
                    Enrolled Students
                  </CardTitle>
                  <Badge variant="secondary">
                    {enrolledStudents.length} enrolled
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {enrolledStudents.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">
                    No students enrolled yet.
                  </p>
                ) : (
                  <div className="flex flex-col divide-y">
                    {enrolledStudents.map((student) => (
                      <div
                        key={student.id}
                        className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarFallback>
                              {getInitials(student.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium">
                              {student.name ?? "Unnamed"}
                            </p>
                            <p className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Mail className="h-3 w-3" />
                              {student.email}
                            </p>
                          </div>
                        </div>
                        <form action={unenrollStudentForm}>
                          <input
                            type="hidden"
                            name="courseId"
                            value={course.id}
                          />
                          <input
                            type="hidden"
                            name="studentId"
                            value={student.id}
                          />
                          <Button
                            type="submit"
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <UserMinus className="h-4 w-4 mr-1" />
                            Remove
                          </Button>
                        </form>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Enroll student */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <UserPlus className="h-4 w-4" />
                  Enroll a Student
                </CardTitle>
              </CardHeader>
              <CardContent>
                {availableStudents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    All students are already enrolled.
                  </p>
                ) : (
                  <form
                    action={enrollStudentForm}
                    className="flex items-center gap-3"
                  >
                    <input type="hidden" name="courseId" value={course.id} />
                    <Select
                      name="studentId"
                      defaultValue={availableStudents[0]?.id}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a student" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableStudents.map((student) => (
                          <SelectItem key={student.id} value={student.id}>
                            <span className="flex items-center gap-2">
                              <Avatar size="sm">
                                <AvatarFallback>
                                  {getInitials(student.name)}
                                </AvatarFallback>
                              </Avatar>
                              {student.name ?? "Unnamed"}
                              <span className="text-muted-foreground">
                                ({student.email})
                              </span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button type="submit" size="sm" className="shrink-0">
                      <UserPlus className="h-4 w-4 mr-1" />
                      Enroll
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Materials Tab ────────────────────────────────────── */}
        <TabsContent value="materials">
          <CourseMaterials courseId={course.id} materials={materials} />
        </TabsContent>

        {/* ── Settings Tab ─────────────────────────────────────── */}
        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <GraduationCap className="h-4 w-4" />
                Instructor
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              {/* Current instructor */}
              <div className="flex items-center gap-3">
                <Avatar size="lg">
                  <AvatarFallback>
                    {getInitials(course.instructorName)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-sm">
                    {course.instructorName ?? "No instructor assigned"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Current instructor
                  </p>
                </div>
              </div>

              <Separator />

              {/* Reassign */}
              {allInstructors.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No instructors available.
                </p>
              ) : (
                <form
                  action={updateCourseInstructorForm}
                  className="flex items-center gap-3"
                >
                  <input type="hidden" name="courseId" value={course.id} />
                  <Select
                    name="instructorId"
                    defaultValue={course.instructorId}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select an instructor" />
                    </SelectTrigger>
                    <SelectContent>
                      {allInstructors.map((instructor) => (
                        <SelectItem key={instructor.id} value={instructor.id}>
                          <span className="flex items-center gap-2">
                            <Avatar size="sm">
                              <AvatarFallback>
                                {getInitials(instructor.name)}
                              </AvatarFallback>
                            </Avatar>
                            {instructor.name ?? "Unnamed"}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="submit"
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                  >
                    Reassign
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
