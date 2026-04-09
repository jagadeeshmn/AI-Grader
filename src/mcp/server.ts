import "dotenv/config";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import {
  getCourseSummary,
  getGradeDistribution,
  getStudentsWithoutSubmissions,
  getSubmissionStats,
  getUngradedSubmissions,
  listCourses,
} from "@/lib/data/analytics";

const server = new Server(
  { name: "aigrader-analytics", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

// ── Tool definitions ──────────────────────────────────────────────────────────
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "list_courses",
      description:
        "List all courses in the system with their enrollment count and instructor. Use this first to find course IDs.",
      inputSchema: { type: "object", properties: {}, required: [] },
    },
    {
      name: "get_course_summary",
      description:
        "Get a high-level summary of a course: enrollment, number of assignments, overall submission rate, and average grade percentage.",
      inputSchema: {
        type: "object",
        properties: {
          courseId: { type: "number", description: "The ID of the course" },
        },
        required: ["courseId"],
      },
    },
    {
      name: "get_submission_stats",
      description:
        "Get per-assignment submission and grade statistics for a course: how many students submitted each assignment, submission rate %, and average grade.",
      inputSchema: {
        type: "object",
        properties: {
          courseId: { type: "number", description: "The ID of the course" },
        },
        required: ["courseId"],
      },
    },
    {
      name: "get_grade_distribution",
      description:
        "Get the grade distribution for a specific assignment: average, min, max score, and breakdown by grade band (0-49%, 50-69%, 70-89%, 90-100%). Also shows how many were AI-graded vs instructor-overridden.",
      inputSchema: {
        type: "object",
        properties: {
          assignmentId: { type: "number", description: "The ID of the assignment" },
        },
        required: ["assignmentId"],
      },
    },
    {
      name: "get_students_without_submissions",
      description:
        "List all students who are enrolled in the course but have NOT submitted a specific assignment. Returns names and emails.",
      inputSchema: {
        type: "object",
        properties: {
          assignmentId: { type: "number", description: "The ID of the assignment" },
        },
        required: ["assignmentId"],
      },
    },
    {
      name: "get_ungraded_submissions",
      description:
        "List submissions that exist but have not been graded yet (no AI grade or instructor grade). Optionally filter by course.",
      inputSchema: {
        type: "object",
        properties: {
          courseId: {
            type: "number",
            description: "Optional course ID to filter results",
          },
        },
        required: [],
      },
    },
  ],
}));

// ── Tool handlers ─────────────────────────────────────────────────────────────
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "list_courses": {
        const data = await listCourses();
        return {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        };
      }

      case "get_course_summary": {
        const { courseId } = args as { courseId: number };
        const data = await getCourseSummary(courseId);
        if (!data) {
          return { content: [{ type: "text", text: `No course found with ID ${courseId}` }] };
        }
        return {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        };
      }

      case "get_submission_stats": {
        const { courseId } = args as { courseId: number };
        const data = await getSubmissionStats(courseId);
        return {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        };
      }

      case "get_grade_distribution": {
        const { assignmentId } = args as { assignmentId: number };
        const data = await getGradeDistribution(assignmentId);
        if (!data) {
          return {
            content: [{ type: "text", text: `No assignment found with ID ${assignmentId}` }],
          };
        }
        return {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        };
      }

      case "get_students_without_submissions": {
        const { assignmentId } = args as { assignmentId: number };
        const data = await getStudentsWithoutSubmissions(assignmentId);
        if (!data) {
          return {
            content: [{ type: "text", text: `No assignment found with ID ${assignmentId}` }],
          };
        }
        return {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        };
      }

      case "get_ungraded_submissions": {
        const { courseId } = (args ?? {}) as { courseId?: number };
        const data = await getUngradedSubmissions(courseId);
        return {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        };
      }

      default:
        return {
          content: [{ type: "text", text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: "text", text: `Error: ${message}` }],
      isError: true,
    };
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("MCP server error:", err);
  process.exit(1);
});
