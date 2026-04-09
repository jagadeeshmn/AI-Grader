import { notFound } from "next/navigation";
import AssignmentViewer from "@/components/assignment-viewer";
import { getAssignmentById, getAssignmentSubmissions, getSubmissionByStudent } from "@/lib/data/assignments";
import { getGradesForSubmissions, getGradeForStudent } from "@/lib/data/grades";
import { stackServerApp } from "@/stack/server";
import { authorizeUserToEditArticle } from "@/db/authz";
import db from "@/db/index";
import { usersSync } from "@/db/schema";
import { eq } from "drizzle-orm";

interface ViewAssignmentPageProps {
  params: Promise<{ id: string }>;
}

export default async function ViewAssignmentPage({ params }: ViewAssignmentPageProps) {
  const { id } = await params;

  let canEdit = false;
  let userRole: string | null = null;
  let userId: string | null = null;

  try {
    const user = await stackServerApp.getUser();
    if (user) {
      userId = user.id;
      const [dbUser, editAllowed] = await Promise.all([
        db.select({ role: usersSync.role }).from(usersSync).where(eq(usersSync.id, user.id)).limit(1),
        authorizeUserToEditArticle(user.id, +id),
      ]);
      userRole = dbUser[0]?.role ?? null;
      canEdit = editAllowed;
    }
  } catch (_err) {
    canEdit = false;
  }

  const canViewSubmissions = userRole === "instructor" || userRole === "admin";
  const isStudent = userRole === "student";

  const [assignment, existingSubmission, allSubmissions] = await Promise.all([
    getAssignmentById(+id),
    userId && isStudent ? getSubmissionByStudent(+id, userId) : Promise.resolve(null),
    canViewSubmissions ? getAssignmentSubmissions(+id) : Promise.resolve(null),
  ]);

  if (!assignment) notFound();

  // Fetch grades based on role
  const [submissionGrades, studentGrade] = await Promise.all([
    // Instructor: grades keyed by submissionId for all submissions
    allSubmissions && allSubmissions.length > 0
      ? getGradesForSubmissions(allSubmissions.map((s) => s.id))
      : Promise.resolve([]),
    // Student: their own grade
    userId && isStudent ? getGradeForStudent(+id, userId) : Promise.resolve(null),
  ]);

  return (
    <AssignmentViewer
      assignment={assignment}
      canEdit={canEdit}
      userRole={userRole}
      existingSubmission={existingSubmission}
      allSubmissions={allSubmissions}
      submissionGrades={submissionGrades}
      studentGrade={studentGrade}
    />
  );
}
