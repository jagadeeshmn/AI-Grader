import Link from "next/link";
import { eq } from "drizzle-orm";
import { stackServerApp } from "@/stack/server";
import db from "@/db/index";
import { usersSync } from "@/db/schema";
import {
  getCourses,
  getCoursesByInstructor,
  getEnrolledCourses,
} from "@/lib/data/courses";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { BookOpen, ChevronRight, GraduationCap, Home } from "lucide-react";

const PALETTE = [
  { borderColor: "#6366f1", iconBg: "#e0e7ff", iconColor: "#4f46e5" },
  { borderColor: "#8b5cf6", iconBg: "#ede9fe", iconColor: "#7c3aed" },
  { borderColor: "#3b82f6", iconBg: "#dbeafe", iconColor: "#2563eb" },
  { borderColor: "#10b981", iconBg: "#d1fae5", iconColor: "#059669" },
  { borderColor: "#f59e0b", iconBg: "#fef3c7", iconColor: "#d97706" },
  { borderColor: "#f43f5e", iconBg: "#ffe4e6", iconColor: "#e11d48" },
];

function getInitials(name: string | null) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default async function CoursesPage() {
  const user = await stackServerApp.getUser({ or: "redirect" });

  const [dbUser] = await db
    .select({ role: usersSync.role })
    .from(usersSync)
    .where(eq(usersSync.id, user.id))
    .limit(1);

  const role = dbUser?.role;
  const isStudent = role === "student";
  const isInstructor = role === "instructor";

  const courses = isStudent
    ? await getEnrolledCourses(user.id)
    : isInstructor
      ? await getCoursesByInstructor(user.id)
      : await getCourses();

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
        <span className="text-foreground font-medium">Courses</span>
      </nav>

      {/* Page hero */}
      <div className="rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-6 flex items-center justify-between gap-4 shadow-sm">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight text-white">
            {isStudent ? "My Courses" : isInstructor ? "My Courses" : "Courses"}
          </h1>
          <p className="text-sm text-indigo-100">
            {isStudent
              ? "Courses you are currently enrolled in."
              : isInstructor
                ? "Courses you are assigned to teach."
                : "Manage course enrollments and instructor assignments."}
          </p>
        </div>
        <Badge className="bg-white/20 text-white border border-white/30 text-sm px-3 py-1 shrink-0">
          {courses.length} {isStudent || isInstructor ? "assigned" : "total"}
        </Badge>
      </div>

      {/* Course grid */}
      {courses.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {isStudent
            ? "You are not enrolled in any courses yet."
            : isInstructor
              ? "You are not assigned to any courses yet."
              : "No courses found."}
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {courses.map((course, idx) => {
            const palette = PALETTE[idx % PALETTE.length];
            return (
              <Card
                key={course.id}
                className="group hover:shadow-md transition-all border-t-2"
                style={{ borderTopColor: palette.borderColor }}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-10 w-10 items-center justify-center rounded-lg"
                        style={{
                          backgroundColor: palette.iconBg,
                          color: palette.iconColor,
                        }}
                      >
                        <BookOpen className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-base leading-tight">
                          {course.name}
                        </CardTitle>
                        <Badge variant="outline" className="mt-1 text-xs">
                          {course.batch}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="flex flex-col gap-4">
                  {/* Instructor row */}
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <GraduationCap className="h-4 w-4 shrink-0" />
                    <div className="flex items-center gap-2">
                      <Avatar size="sm">
                        <AvatarFallback>
                          {getInitials(course.instructorName)}
                        </AvatarFallback>
                      </Avatar>
                      <span>{course.instructorName ?? "No instructor"}</span>
                    </div>
                  </div>

                  <Separator />

                  <div className="flex items-center justify-end">
                    <Button
                      asChild
                      size="sm"
                      variant={
                        isStudent || isInstructor ? "outline" : "default"
                      }
                      className="gap-1"
                    >
                      <Link href={`/courses/${course.id}`}>
                        {isStudent || isInstructor ? "View" : "Manage"}
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
