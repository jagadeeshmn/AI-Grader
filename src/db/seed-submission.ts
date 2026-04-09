/**
 * Seeds a sample submission for the "OSI Model & Network Layers" assignment
 * in the Networks course, attributed to the seed student user.
 *
 * Run with: npm run db:seed:submission
 * Safe to re-run — upserts on conflict.
 */
import db from "@/db/index";
import { assignments, courses, courseStudents, submissions, usersSync } from "@/db/schema";
import { and, eq } from "drizzle-orm";

const COURSE_NAME = "Networks";
const ASSIGNMENT_TITLE = "OSI Model & Network Layers";
const STUDENT_ID = "seed-student-001";
const STUDENT_NAME = "Alex Chen";
const STUDENT_EMAIL = "alex.chen@example.com";

const SUBMISSION_CONTENT = `## Task 1 – Layer Breakdown

### Layer 7 – Application
Provides network services directly to end-user applications. Protocols: HTTP, FTP, SMTP, DNS.
Analogy: The waiter who takes your order and brings your food.

### Layer 6 – Presentation
Translates data between application format and network format. Handles encryption and compression. Protocols: TLS/SSL, JPEG, ASCII.
Analogy: A translator converting between two languages.

### Layer 5 – Session
Manages sessions (opening, maintaining, closing) between applications. Protocols: NetBIOS, RPC.
Analogy: A phone operator who connects and holds your call.

### Layer 4 – Transport
Ensures reliable end-to-end delivery. Handles segmentation, flow control, and error correction. Protocols: TCP, UDP.
Analogy: A courier service that tracks packages and confirms delivery.

### Layer 3 – Network
Handles logical addressing and routing across networks. Protocols: IP, ICMP, OSPF.
Analogy: The postal system deciding which route your letter takes.

### Layer 2 – Data Link
Responsible for node-to-node delivery on the same network. Handles MAC addressing and framing. Protocols: Ethernet, Wi-Fi (802.11).
Analogy: A local delivery driver who knows every house on the street.

### Layer 1 – Physical
Transmits raw bits over a physical medium (cables, radio waves). Standards: Ethernet cables, fiber optic, USB.
Analogy: The actual road the delivery truck drives on.

---

## Task 2 – HTTP GET Request Trace

User types http://example.com in browser.

**Client side (top-down):**
- **Application (L7):** Browser constructs an HTTP GET request.
- **Presentation (L6):** Data encoded as ASCII/UTF-8; TLS negotiated if HTTPS.
- **Session (L5):** A TCP session is established with the server.
- **Transport (L4):** TCP segments the request, adds source/destination port (80 for HTTP). Three-way handshake occurs.
- **Network (L3):** IP header added with source IP (e.g. 192.168.1.5) and destination IP (93.184.216.34 – example.com).
- **Data Link (L2):** Ethernet frame created with source and destination MAC addresses (gateway MAC).
- **Physical (L1):** Bits transmitted as electrical signals over the cable.

**Server side (bottom-up):**
- **Physical (L1):** Bits received from the wire.
- **Data Link (L2):** Frame unpacked, MAC address verified.
- **Network (L3):** IP header checked, packet routed to correct process.
- **Transport (L4):** TCP segment reassembled, ACK sent back to client.
- **Session (L5):** Session state maintained.
- **Presentation (L6):** Data decoded/decrypted.
- **Application (L7):** HTTP server reads the GET request and returns a 200 OK response with HTML body.

---

## Task 3 – Encapsulation

Encapsulation is the process of wrapping data with protocol-specific headers (and sometimes trailers) as it moves down the OSI stack.

| Layer       | PDU Name | Added Header/Trailer          |
|-------------|----------|-------------------------------|
| Application | Data     | HTTP headers                  |
| Transport   | Segment  | TCP header (ports, seq no.)   |
| Network     | Packet   | IP header (src/dst IP)        |
| Data Link   | Frame    | Ethernet header + FCS trailer |
| Physical    | Bits     | —                             |

Decapsulation is the reverse process on the receiving side — each layer strips its own header and passes the payload up to the next layer.`;

async function main() {
  try {
    console.log("🌱 Seeding sample submission...");

    // 1. Resolve the course
    const [course] = await db
      .select({ id: courses.id })
      .from(courses)
      .where(eq(courses.name, COURSE_NAME))
      .limit(1);

    if (!course) throw new Error(`Course "${COURSE_NAME}" not found. Run course seed first.`);

    // 2. Resolve the assignment
    const [assignment] = await db
      .select({ id: assignments.id })
      .from(assignments)
      .where(and(eq(assignments.courseId, course.id), eq(assignments.title, ASSIGNMENT_TITLE)))
      .limit(1);

    if (!assignment) throw new Error(`Assignment "${ASSIGNMENT_TITLE}" not found.`);

    console.log(`📚 Assignment ID: ${assignment.id}`);

    // 3. Ensure the seed student exists in usersSync
    await db
      .insert(usersSync)
      .values({ id: STUDENT_ID, name: STUDENT_NAME, email: STUDENT_EMAIL, role: "student" })
      .onConflictDoUpdate({
        target: usersSync.id,
        set: { name: STUDENT_NAME, email: STUDENT_EMAIL },
      });

    console.log(`👤 Student: ${STUDENT_NAME} (${STUDENT_ID})`);

    // 4. Enroll the student in the course if not already enrolled
    await db
      .insert(courseStudents)
      .values({ courseId: course.id, studentId: STUDENT_ID })
      .onConflictDoNothing();

    console.log(`📋 Enrolled student in course ${course.id}`);

    // 5. Upsert the submission
    await db
      .insert(submissions)
      .values({
        assignmentId: assignment.id,
        studentId: STUDENT_ID,
        content: SUBMISSION_CONTENT,
      })
      .onConflictDoUpdate({
        target: [submissions.assignmentId, submissions.studentId],
        set: { content: SUBMISSION_CONTENT, submittedAt: new Date().toISOString() },
      });

    console.log(`\n✅ Submission seeded for "${ASSIGNMENT_TITLE}" by ${STUDENT_NAME}.`);
  } catch (err) {
    console.error("💥 Seed failed:", err);
    process.exit(1);
  }
}

void main();
