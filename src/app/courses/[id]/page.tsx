import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { stackServerApp } from "@/stack/server";
import db from "@/db/index";
import { usersSync } from "@/db/schema";
import {
  getCourseById,
  getCourseStudents,
  getAllStudents,
  getAllInstructors,
  getCourseAssignments,
  getCourseMaterials,
  isStudentEnrolled,
  isInstructorAssigned,
} from "@/lib/data/courses";
import { CourseManage } from "@/components/course-manage";
import { CourseView } from "@/components/course-view";

interface CoursePageProps {
  params: Promise<{ id: string }>;
}

export default async function CoursePage({ params }: CoursePageProps) {
  const { id } = await params;
  const user = await stackServerApp.getUser({ or: "redirect" });

  const [dbUser] = await db
    .select({ role: usersSync.role })
    .from(usersSync)
    .where(eq(usersSync.id, user.id))
    .limit(1);

  const role = dbUser?.role;

  if (role === "student") {
    // Students must be enrolled in the course to view it
    const [enrolled, course, courseAssignments, enrolledStudents] =
      await Promise.all([
        isStudentEnrolled(Number(id), user.id),
        getCourseById(Number(id)),
        getCourseAssignments(Number(id)),
        getCourseStudents(Number(id)),
      ]);

    if (!enrolled || !course) notFound();

    return (
      <CourseView
        course={course}
        courseAssignments={courseAssignments.filter((a) => a.published)}
        enrolledCount={enrolledStudents.length}
      />
    );
  }

  if (role === "instructor") {
    // Instructors can only view courses they are assigned to
    const [assigned, course, courseAssignments, enrolledStudents, materials] =
      await Promise.all([
        isInstructorAssigned(Number(id), user.id),
        getCourseById(Number(id)),
        getCourseAssignments(Number(id)),
        getCourseStudents(Number(id)),
        getCourseMaterials(Number(id)),
      ]);

    if (!assigned || !course) notFound();

    return (
      <CourseView
        course={course}
        courseAssignments={courseAssignments.filter((a) => a.published)}
        enrolledCount={enrolledStudents.length}
        materials={materials}
      />
    );
  }

  // Admin: full management view
  const [
    course,
    enrolledStudents,
    allStudents,
    allInstructors,
    courseAssignments,
    materials,
  ] = await Promise.all([
    getCourseById(Number(id)),
    getCourseStudents(Number(id)),
    getAllStudents(),
    getAllInstructors(),
    getCourseAssignments(Number(id)),
    getCourseMaterials(Number(id)),
  ]);

  if (!course) notFound();

  const enrolledIds = new Set(enrolledStudents.map((s) => s.id));
  const availableStudents = allStudents.filter((s) => !enrolledIds.has(s.id));

  return (
    <CourseManage
      course={course}
      enrolledStudents={enrolledStudents}
      availableStudents={availableStudents}
      allInstructors={allInstructors}
      courseAssignments={courseAssignments}
      materials={materials}
    />
  );
}
