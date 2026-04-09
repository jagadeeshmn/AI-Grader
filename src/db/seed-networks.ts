/**
 * Seeds sample assignments for the Networks course (course_id = 1).
 * Run with: npm run db:seed:networks
 *
 * Safe to re-run — clears only Networks assignments before inserting.
 */
import db, { sql } from "@/db/index";
import { assignments, usersSync, courses } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import type { RubricCriterion } from "@/db/schema";

const COURSE_NAME = "Networks";

type AssignmentSeed = {
  title: string;
  content: string;
  deadline: string;
  rubric: RubricCriterion[];
};

const ASSIGNMENTS: AssignmentSeed[] = [
  {
    title: "OSI Model & Network Layers",
    deadline: "2026-05-20 23:59:00",
    rubric: [
      {
        criterion: "Layer Descriptions",
        maxPoints: 25,
        description:
          "Accuracy and completeness of each OSI layer explanation including protocols and analogies.",
      },
      {
        criterion: "HTTP Request Trace",
        maxPoints: 30,
        description:
          "Correctness of the end-to-end trace across all layers, both client and server sides.",
      },
      {
        criterion: "Encapsulation Explanation",
        maxPoints: 20,
        description:
          "Clear explanation of PDUs, headers, and trailers at each layer.",
      },
      {
        criterion: "Diagram Quality",
        maxPoints: 15,
        description: "Clarity and accuracy of the layer trace diagram.",
      },
      {
        criterion: "Writing & References",
        maxPoints: 10,
        description:
          "Report is well-structured, grammatically correct, and cites relevant sources.",
      },
    ],
    content: `## Assignment Overview
Analyze the OSI model and explain how data flows through each layer during a typical HTTP request.

## Tasks

### Task 1 – Layer Breakdown
Describe the role of each of the 7 OSI layers. For each layer, include:
- Primary responsibility
- Key protocols or standards at that layer
- A real-world analogy

### Task 2 – HTTP Request Trace
Trace a browser making an HTTP GET request to \`http://example.com\`. Walk through what happens at every OSI layer — from the application layer down to the physical layer on the client side, and back up on the server side.

### Task 3 – Encapsulation
Explain the concept of encapsulation and decapsulation. Draw or describe the PDU (Protocol Data Unit) at each layer and what headers/trailers are added.

## Deliverables
- Written report (Markdown)
- Layer trace diagram (hand-drawn or tool-generated)

## References
- Tanenbaum, A. S. — *Computer Networks*, 5th Edition, Chapter 1
- RFC 2616 — HTTP/1.1`,
  },

  {
    title: "TCP vs UDP — Deep Dive",
    deadline: "2026-06-05 23:59:00",
    rubric: [
      {
        criterion: "Protocol Comparison Table",
        maxPoints: 25,
        description:
          "Accuracy and depth of the TCP vs UDP comparison across all listed dimensions.",
      },
      {
        criterion: "Three-Way Handshake",
        maxPoints: 25,
        description:
          "Correct and complete explanation of SYN/SYN-ACK/ACK and connection teardown.",
      },
      {
        criterion: "Design Justification — Game",
        maxPoints: 20,
        description:
          "Sound reasoning for protocol choice for the real-time game with trade-off discussion.",
      },
      {
        criterion: "Design Justification — File Transfer",
        maxPoints: 20,
        description:
          "Sound reasoning for protocol choice for the file utility with trade-off discussion.",
      },
      {
        criterion: "Diagrams & Presentation",
        maxPoints: 10,
        description:
          "Sequence diagram is correct and the overall submission is clearly organised.",
      },
    ],
    content: `## Assignment Overview
Compare TCP and UDP at a protocol level, and design a scenario where each is the appropriate choice.

## Tasks

### Task 1 – Protocol Comparison
Build a detailed comparison table covering:
- Connection establishment (handshake)
- Reliability and acknowledgement
- Flow control and congestion control
- Ordering of packets
- Header structure and overhead
- Typical use cases

### Task 2 – Three-Way Handshake
Explain the TCP three-way handshake (SYN, SYN-ACK, ACK). Include:
- What each party sends and why
- What happens during connection teardown (FIN/ACK)
- What a half-open connection is

### Task 3 – Design Decision
You are building a real-time multiplayer game. A second team is building a file transfer utility. For each system:
- Justify whether TCP or UDP should be used
- Explain what trade-offs you are accepting
- Propose any application-level reliability mechanisms if using UDP

## Deliverables
- Comparison table
- Handshake sequence diagram
- Written justification (min 400 words)`,
  },

  {
    title: "Subnetting & IP Addressing",
    deadline: "2026-06-18 23:59:00",
    rubric: [
      {
        criterion: "Subnetting Accuracy",
        maxPoints: 35,
        description:
          "All subnet calculations (network address, mask, usable hosts, broadcast) are correct for each department.",
      },
      {
        criterion: "VLSM Optimisation",
        maxPoints: 25,
        description:
          "VLSM applied correctly with clear working and minimal address wastage.",
      },
      {
        criterion: "NAT Explanation",
        maxPoints: 20,
        description:
          "Clear explanation of private/public IP ranges, purpose of NAT, and a NAT limitation scenario.",
      },
      {
        criterion: "Presentation & Working",
        maxPoints: 20,
        description:
          "Tables are clearly formatted, all working is shown, and the submission is easy to follow.",
      },
    ],
    content: `## Assignment Overview
Practice subnetting a given IP block and design an addressing scheme for a small enterprise network.

## Tasks

### Task 1 – Subnetting Calculations
Given the network \`192.168.10.0/24\`, subnet it to support the following departments:

| Department  | Hosts Required |
|-------------|----------------|
| Engineering | 50             |
| HR          | 20             |
| Finance     | 10             |
| Management  | 5              |

For each subnet provide:
- Network address
- Subnet mask (dotted decimal + CIDR)
- First usable host
- Last usable host
- Broadcast address

### Task 2 – VLSM
Using Variable Length Subnet Masking (VLSM), optimise your allocation from Task 1 to minimise wasted addresses. Show your working.

### Task 3 – Private vs Public IP
Explain the difference between private and public IP ranges. Why does NAT exist? Describe a scenario where NAT causes problems and how it can be resolved.

## Deliverables
- Subnetting table (Tasks 1 & 2)
- Written explanation for Task 3 (min 300 words)`,
  },

  {
    title: "DNS Resolution & HTTP Deep Dive",
    deadline: "2026-07-01 23:59:00",
    rubric: [
      {
        criterion: "DNS Resolution Trace",
        maxPoints: 30,
        description:
          "All steps of DNS resolution are correctly described including cache levels, nameserver hierarchy, and TTL.",
      },
      {
        criterion: "HTTP Version Comparison",
        maxPoints: 25,
        description:
          "Accurate comparison of HTTP/1.1, HTTP/2, and HTTP/3 across all listed dimensions.",
      },
      {
        criterion: "Wireshark Analysis",
        maxPoints: 30,
        description:
          "Correct identification and annotation of DNS, TCP handshake, and HTTP packets.",
      },
      {
        criterion: "Clarity & Organisation",
        maxPoints: 15,
        description:
          "Submission is logically structured, well-written, and easy to follow.",
      },
    ],
    content: `## Assignment Overview
Trace the full journey of a web request — from typing a URL to receiving a rendered page — focusing on DNS and HTTP.

## Tasks

### Task 1 – DNS Resolution Chain
Describe step by step what happens when a user types \`www.university.edu\` in a browser for the first time:
- Browser cache check
- OS resolver cache check
- Recursive resolver query
- Root nameserver referral
- TLD nameserver referral
- Authoritative nameserver response

Include the role of TTL and explain what happens on subsequent requests.

### Task 2 – HTTP/1.1 vs HTTP/2 vs HTTP/3
Compare the three versions across:
- Multiplexing
- Header compression
- Connection management
- Performance implications

### Task 3 – Wireshark Exercise
Capture a DNS query and HTTP request using Wireshark (or use the provided packet capture file). Identify and annotate:
- The DNS query and response packets
- The TCP three-way handshake
- The HTTP GET request and 200 OK response

## Deliverables
- Written DNS trace (Task 1)
- Comparison table (Task 2)
- Annotated Wireshark screenshots or packet summary (Task 3)`,
  },
];

async function main() {
  try {
    console.log(`🌱 Seeding assignments for "${COURSE_NAME}"...`);

    // Resolve course
    const [course] = await db
      .select({ id: courses.id, instructorId: courses.instructorId })
      .from(courses)
      .where(eq(courses.name, COURSE_NAME))
      .limit(1);

    if (!course) {
      throw new Error(`Course "${COURSE_NAME}" not found. Run course seed first.`);
    }

    // Resolve instructor
    const [instructor] = await db
      .select({ id: usersSync.id })
      .from(usersSync)
      .where(eq(usersSync.id, course.instructorId))
      .limit(1);

    if (!instructor) {
      throw new Error("Instructor for this course not found in usersSync.");
    }

    console.log(`📚 Course ID: ${course.id} | Instructor ID: ${instructor.id}`);

    // Clear existing assignments for this course only
    console.log(`🧹 Clearing existing assignments for course ${course.id}...`);
    await db
      .delete(assignments)
      .where(eq(assignments.courseId, course.id));

    // Insert
    for (const data of ASSIGNMENTS) {
      const slug = `${data.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`;
      const [inserted] = await db
        .insert(assignments)
        .values({
          title: data.title,
          slug,
          content: data.content,
          published: true,
          deadline: data.deadline,
          rubric: data.rubric,
          courseId: course.id,
          authorId: instructor.id,
        })
        .returning({ id: assignments.id, title: assignments.title });

      console.log(`  ✅ [${inserted.id}] ${inserted.title}`);
    }

    // Sync sequence
    await sql.query(
      `SELECT setval(pg_get_serial_sequence('assignments','id'), COALESCE((SELECT MAX(id) FROM assignments), 1), true);`
    );

    console.log(`\n✅ Seeded ${ASSIGNMENTS.length} assignments for "${COURSE_NAME}".`);
  } catch (err) {
    console.error("💥 Seed failed:", err);
    process.exit(1);
  }
}

void main();
