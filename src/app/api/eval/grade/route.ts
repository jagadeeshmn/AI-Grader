import { eq } from "drizzle-orm";
import { z } from "zod";
import db from "@/db/index";
import { assignments, submissions } from "@/db/schema";
import { withUsageCollection } from "@/lib/agents/usage";
import { runGrading } from "@/lib/grading";

// Offline eval endpoint (Enhancement Guide Phase 1): grades a submission in
// the requested GRADING_MODE and returns the result plus usage/latency
// diagnostics. Never writes to the grades table, so instructor golden
// labels are safe. Guarded by EVAL_SECRET; effectively absent when unset.

export const maxDuration = 300;

const bodySchema = z.object({
  submissionId: z.number().int(),
  mode: z.enum(["single", "agentic"]),
});

export async function POST(req: Request): Promise<Response> {
  const secret = process.env.EVAL_SECRET;
  if (!secret) return new Response(null, { status: 404 });
  if (req.headers.get("x-eval-secret") !== secret) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }
  const { submissionId, mode } = parsed.data;

  const [submission] = await db
    .select({
      content: submissions.content,
      assignmentId: submissions.assignmentId,
    })
    .from(submissions)
    .where(eq(submissions.id, submissionId))
    .limit(1);
  if (!submission) {
    return Response.json({ error: "submission not found" }, { status: 404 });
  }

  const [assignment] = await db
    .select({
      title: assignments.title,
      content: assignments.content,
      rubric: assignments.rubric,
      courseId: assignments.courseId,
    })
    .from(assignments)
    .where(eq(assignments.id, submission.assignmentId))
    .limit(1);
  if (!assignment) {
    return Response.json({ error: "assignment not found" }, { status: 404 });
  }
  if (!assignment.rubric || assignment.rubric.length === 0) {
    return Response.json(
      { error: "assignment has no rubric" },
      { status: 400 },
    );
  }

  try {
    const start = performance.now();
    const { value: result, usage } = await withUsageCollection(() =>
      runGrading(
        {
          submissionId: String(submissionId),
          courseId: assignment.courseId,
          assignmentTitle: assignment.title,
          assignmentContent: assignment.content,
          rubric: assignment.rubric,
          submissionText: submission.content,
        },
        mode,
      ),
    );
    const latencyMs = performance.now() - start;

    const revisionCount = result.diagnostics?.revisionCount ?? 0;
    return Response.json({
      mode,
      submissionId,
      result,
      usage,
      latencyMs,
      revisionCount,
      critiqueTriggered: revisionCount > 0,
      critiqueVerdict: result.diagnostics?.critiqueVerdict ?? "none",
      needsReview: result.diagnostics?.needsReview ?? false,
    });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
