/**
 * Seeds the eval golden set: 15 submissions (5 quality tiers x 3 Networks
 * assignments) each with a hand-authored instructor ground-truth grade
 * (grades.source = "instructor").
 *
 * Run with: npm run db:seed:golden (after db:seed:networks + db:seed:materials;
 * re-running db:seed:networks cascades these rows away).
 * Safe to re-run — upserts on conflict and restores instructor labels.
 */

import { and, eq, inArray } from "drizzle-orm";
import db from "@/db/index";
import {
  assignments,
  type CriterionScore,
  courseStudents,
  courses,
  grades,
  submissions,
  usersSync,
} from "@/db/schema";

const COURSE_NAME = "Networks";

const STUDENTS = [
  { id: "eval-student-001", name: "Golden Excellent", tier: "excellent" },
  { id: "eval-student-002", name: "Golden Good", tier: "good" },
  { id: "eval-student-003", name: "Golden Partial", tier: "partial" },
  { id: "eval-student-004", name: "Golden Poor", tier: "poor" },
  { id: "eval-student-005", name: "Golden OffTopic", tier: "offtopic" },
] as const;

interface GoldenItem {
  assignmentTitle: string;
  studentId: string;
  content: string;
  groundTruth: {
    criterionScores: CriterionScore[];
    overallFeedback: string;
  };
}

// ---------------------------------------------------------------------------
// Assignment 1: OSI Model & Network Layers (100 pts)
// Rubric: Layer Descriptions 25, HTTP Request Trace 30, Encapsulation
// Explanation 20, Diagram Quality 15, Writing & References 10
// ---------------------------------------------------------------------------

const OSI: GoldenItem[] = [
  {
    assignmentTitle: "OSI Model & Network Layers",
    studentId: "eval-student-001",
    content: `## Task 1 – The Seven Layers

**L7 Application** – interface between user applications and the network. Protocols: HTTP, SMTP, DNS, FTP. Analogy: the waiter taking your order.
**L6 Presentation** – translation, encryption, compression (TLS, JPEG, UTF-8). Analogy: an interpreter.
**L5 Session** – establishes, maintains, and tears down dialogues (RPC, NetBIOS). Analogy: a switchboard operator.
**L4 Transport** – end-to-end delivery, segmentation, flow and error control (TCP, UDP). Analogy: a tracked courier.
**L3 Network** – logical addressing and routing between networks (IP, ICMP, OSPF). Analogy: the postal sorting system.
**L2 Data Link** – node-to-node framing and MAC addressing, error detection via FCS (Ethernet, 802.11). Analogy: the local delivery driver.
**L1 Physical** – raw bit transmission over copper, fibre, or radio. Analogy: the road itself.

## Task 2 – Tracing an HTTP GET for http://example.com

Client, top-down: the browser builds a GET request (L7); text is encoded UTF-8 and TLS would be negotiated on HTTPS (L6); a session is opened (L5); TCP performs the SYN → SYN-ACK → ACK handshake and segments the request with source port 51230 → destination port 80 (L4); IP wraps each segment with 192.168.1.5 → 93.184.216.34 and routers forward hop by hop using their routing tables (L3); each hop rewrites the Ethernet frame with the next-hop MAC discovered via ARP (L2); NIC signals the bits (L1).

Server, bottom-up: bits → frames (MAC checked, FCS verified) → packets (dst IP matched) → segments (reassembled in sequence-number order, ACKed) → session → decoding → the HTTP daemon parses GET / and answers 200 OK with the HTML body, which travels the same path in reverse.

## Task 3 – Encapsulation

Each layer prepends its own header (the Data Link layer also appends a trailer) around the payload from the layer above:

| Layer | PDU | Header added |
|---|---|---|
| Application | Data | HTTP request line + headers |
| Transport | Segment | TCP ports, sequence & ACK numbers |
| Network | Packet | Source/destination IP, TTL |
| Data Link | Frame | MACs + FCS trailer |
| Physical | Bits | — |

Decapsulation reverses the process at the receiver, each layer stripping its header before handing the payload up.

Diagram: [ASCII stack diagram showing Data → Segment → Packet → Frame → Bits with arrows both directions]

References: Kurose & Ross, *Computer Networking* 8th ed.; RFC 791; course reference guide.`,
    groundTruth: {
      criterionScores: [
        {
          criterion: "Layer Descriptions",
          score: 24,
          maxPoints: 25,
          feedback:
            "All seven layers accurate with protocols and apt analogies; presentation layer detail slightly thin.",
        },
        {
          criterion: "HTTP Request Trace",
          score: 29,
          maxPoints: 30,
          feedback:
            "Complete bidirectional trace with handshake, ports, ARP, and reassembly. Only minor omission: DNS lookup before connection.",
        },
        {
          criterion: "Encapsulation Explanation",
          score: 20,
          maxPoints: 20,
          feedback:
            "Correct PDU table including FCS trailer and decapsulation.",
        },
        {
          criterion: "Diagram Quality",
          score: 13,
          maxPoints: 15,
          feedback:
            "Stack diagram referenced and table well laid out, though the diagram itself is schematic.",
        },
        {
          criterion: "Writing & References",
          score: 9,
          maxPoints: 10,
          feedback: "Clear structure, credible references cited.",
        },
      ],
      overallFeedback:
        "Excellent, near-complete work: accurate layer coverage, a rigorous trace, and correct encapsulation detail. Add the DNS step and a fuller diagram for full marks.",
    },
  },
  {
    assignmentTitle: "OSI Model & Network Layers",
    studentId: "eval-student-002",
    content: `## The OSI Layers

7. Application – where apps like browsers and email clients talk to the network (HTTP, SMTP, DNS).
6. Presentation – formats and encrypts data (TLS, JPEG).
5. Session – keeps conversations between computers open.
4. Transport – reliable delivery with TCP, faster unreliable delivery with UDP. Uses port numbers.
3. Network – IP addresses and routing between networks.
2. Data Link – MAC addresses, frames, switches operate here (Ethernet).
1. Physical – cables and signals.

## HTTP Request Trace

When you visit example.com the browser makes an HTTP GET request. It goes down the stack: TCP adds ports (destination 80) and does the three-way handshake, IP adds the source and destination addresses, Ethernet adds MAC addresses, and the bits go over the wire. At the server the process happens in reverse, each layer unwrapping the one below, until the web server reads the request and sends back a 200 OK page.

## Encapsulation

Encapsulation means each layer wraps the data from above with its own header: data becomes a segment (TCP), then a packet (IP), then a frame (Ethernet), then bits. The receiver unwraps them in reverse order (decapsulation).

I did not include a diagram. Reference: class notes.`,
    groundTruth: {
      criterionScores: [
        {
          criterion: "Layer Descriptions",
          score: 20,
          maxPoints: 25,
          feedback:
            "All layers named correctly with protocols, but session and presentation descriptions are one-liners with no analogies or depth.",
        },
        {
          criterion: "HTTP Request Trace",
          score: 22,
          maxPoints: 30,
          feedback:
            "Correct top-down flow with handshake and ports, but the server-side unwrap is glossed over and layers 5-6 are skipped in the trace.",
        },
        {
          criterion: "Encapsulation Explanation",
          score: 16,
          maxPoints: 20,
          feedback:
            "PDU sequence correct; missing the frame trailer (FCS) and any table or per-layer header detail.",
        },
        {
          criterion: "Diagram Quality",
          score: 7,
          maxPoints: 15,
          feedback:
            "No diagram provided; partial credit for the clear textual stack ordering.",
        },
        {
          criterion: "Writing & References",
          score: 7,
          maxPoints: 10,
          feedback: "Readable and organised; only 'class notes' cited.",
        },
      ],
      overallFeedback:
        "Good, accurate work with correct fundamentals throughout. To reach the top band: add depth to layers 5-6, trace both directions fully, include the FCS trailer, and provide a diagram and proper references.",
    },
  },
  {
    assignmentTitle: "OSI Model & Network Layers",
    studentId: "eval-student-003",
    content: `The OSI model has 7 layers.

Application layer is for apps like web browsers, it uses HTTP. Transport layer uses TCP which makes sure data arrives, and UDP which is faster. Network layer is IP addresses and routers. Physical layer is the cables and wifi signals.

I think the other layers are Session, Presentation and Data Link but I am not sure exactly what they do. Data Link might be about MAC addresses.

When you load a website the request goes down through the layers on your computer and up through the layers on the server. TCP connects first and then HTTP sends the GET request and the server sends the page back.

Encapsulation is when data gets wrapped up with extra information at each layer so it can be sent, like putting a letter in an envelope.`,
    groundTruth: {
      criterionScores: [
        {
          criterion: "Layer Descriptions",
          score: 12,
          maxPoints: 25,
          feedback:
            "Four layers described correctly at a basic level; session, presentation, and data link are admitted guesses with no real content.",
        },
        {
          criterion: "HTTP Request Trace",
          score: 12,
          maxPoints: 30,
          feedback:
            "Captures only the high-level idea (down one stack, up the other, TCP before HTTP). No ports, addresses, handshake steps, or per-layer actions.",
        },
        {
          criterion: "Encapsulation Explanation",
          score: 9,
          maxPoints: 20,
          feedback:
            "Envelope analogy shows the concept is understood, but no PDU names or per-layer headers.",
        },
        {
          criterion: "Diagram Quality",
          score: 2,
          maxPoints: 15,
          feedback: "No diagram or structured presentation.",
        },
        {
          criterion: "Writing & References",
          score: 4,
          maxPoints: 10,
          feedback: "Understandable but unstructured; no references.",
        },
      ],
      overallFeedback:
        "Partial understanding: the transport/network/application basics are there, but half the layers, the detailed trace, and PDU-level encapsulation are missing. Review layers 2, 5, and 6 and practice a full request walk-through.",
    },
  },
  {
    assignmentTitle: "OSI Model & Network Layers",
    studentId: "eval-student-004",
    content: `The OSI model is a model for networks with several layers. I believe there are 5 layers: Application, Internet, Hardware, Software and Physical. The application layer is where applications run, and the physical layer is the hardware like routers and monitors.

When you go to a website your computer sends the website name to the internet and the internet finds the website and sends it back. This uses the HTTP layer which is the fastest layer.

Encapsulation is a concept from object oriented programming where you make variables private inside a class so other code cannot change them.`,
    groundTruth: {
      criterionScores: [
        {
          criterion: "Layer Descriptions",
          score: 4,
          maxPoints: 25,
          feedback:
            "Layer count and names are largely wrong ('Internet', 'Hardware', 'Software' are not OSI layers); only Application and Physical are recognisable, and Physical is misdescribed.",
        },
        {
          criterion: "HTTP Request Trace",
          score: 4,
          maxPoints: 30,
          feedback:
            "No layered trace at all; 'HTTP layer which is the fastest layer' is a misconception.",
        },
        {
          criterion: "Encapsulation Explanation",
          score: 0,
          maxPoints: 20,
          feedback:
            "Answers the OOP meaning of encapsulation, not network encapsulation — not the concept asked.",
        },
        {
          criterion: "Diagram Quality",
          score: 0,
          maxPoints: 15,
          feedback: "No diagram.",
        },
        {
          criterion: "Writing & References",
          score: 3,
          maxPoints: 10,
          feedback: "Sentences are readable, but no structure or references.",
        },
      ],
      overallFeedback:
        "This submission shows fundamental misconceptions: the OSI layer set is wrong, the trace is absent, and encapsulation was answered from OOP. Please revisit the course reference guide's layer table and re-do the request trace exercise.",
    },
  },
  {
    assignmentTitle: "OSI Model & Network Layers",
    studentId: "eval-student-005",
    content: `My favourite hobby is baking sourdough bread. The key is maintaining a healthy starter: feed it equal parts flour and water every day and keep it somewhere warm. When the starter doubles in size within four hours it is ready to use.

For the dough, mix 500g bread flour, 350g water, 100g starter and 10g salt. Rest for 30 minutes, then perform four sets of stretch-and-folds over two hours. Bulk ferment until the dough has risen by about half, shape it, and proof overnight in the fridge.

Bake in a preheated dutch oven at 250C for 20 minutes with the lid on, then 20 more minutes uncovered. The steam trapped under the lid is what gives the crust its shine and the crumb its open structure.`,
    groundTruth: {
      criterionScores: [
        {
          criterion: "Layer Descriptions",
          score: 0,
          maxPoints: 25,
          feedback: "No OSI content.",
        },
        {
          criterion: "HTTP Request Trace",
          score: 0,
          maxPoints: 30,
          feedback: "No trace content.",
        },
        {
          criterion: "Encapsulation Explanation",
          score: 0,
          maxPoints: 20,
          feedback: "Not addressed.",
        },
        {
          criterion: "Diagram Quality",
          score: 0,
          maxPoints: 15,
          feedback: "No diagram.",
        },
        {
          criterion: "Writing & References",
          score: 2,
          maxPoints: 10,
          feedback: "Well-written prose, but entirely off-topic.",
        },
      ],
      overallFeedback:
        "The submission is about sourdough baking and contains no networking content. Please submit work addressing the OSI assignment brief.",
    },
  },
];

// ---------------------------------------------------------------------------
// Assignment 2: TCP vs UDP — Deep Dive (100 pts)
// Rubric: Protocol Comparison Table 25, Three-Way Handshake 25, Design
// Justification — Game 20, Design Justification — File Transfer 20,
// Diagrams & Presentation 10
// ---------------------------------------------------------------------------

const TCP_UDP: GoldenItem[] = [
  {
    assignmentTitle: "TCP vs UDP — Deep Dive",
    studentId: "eval-student-001",
    content: `## Comparison

| Property | TCP | UDP |
|---|---|---|
| Connection | Connection-oriented (handshake) | Connectionless |
| Reliability | Guaranteed via ACKs + retransmission | Best-effort, none |
| Ordering | Sequence numbers guarantee order | No ordering |
| Flow control | Sliding window | None |
| Congestion control | Slow start, AIMD, fast retransmit | None |
| Header size | 20-60 bytes | 8 bytes |
| Speed | Slower (overhead, handshake, ACKs) | Faster, minimal overhead |
| Use cases | HTTP(S), email, file transfer | DNS, VoIP, gaming, streaming |

## Three-Way Handshake

1. **SYN**: client sends SYN with initial sequence number x (state: SYN_SENT).
2. **SYN-ACK**: server replies SYN with its own ISN y and ACK x+1 (state: SYN_RCVD).
3. **ACK**: client acknowledges y+1; both sides are ESTABLISHED and can exchange data.

The randomised ISNs protect against stale/spoofed segments; the exchange also negotiates options such as MSS and window scaling. Teardown uses FIN/ACK pairs in both directions plus TIME_WAIT.

Diagram:
Client            Server
  | ---- SYN(x) ---> |
  | <- SYN(y),ACK(x+1) |
  | -- ACK(y+1) ---> |

## Multiplayer Game → UDP

A fast-paced game sends dozens of position updates per second. A retransmitted packet would arrive describing a position that is already stale — worse than useless. UDP avoids head-of-line blocking and handshake latency; the game layers its own lightweight sequencing on top and simply drops late updates. Latency beats reliability here.

## File Transfer → TCP

A file must arrive byte-for-byte intact and in order — a single corrupted or missing block invalidates the whole file. TCP's ACK/retransmission, sequencing, checksums, and congestion control give exactly this guarantee without the application reimplementing it. Throughput matters more than per-packet latency, so TCP's overhead is the right trade.`,
    groundTruth: {
      criterionScores: [
        {
          criterion: "Protocol Comparison Table",
          score: 24,
          maxPoints: 25,
          feedback:
            "Comprehensive and accurate table including congestion control and header sizes.",
        },
        {
          criterion: "Three-Way Handshake",
          score: 24,
          maxPoints: 25,
          feedback:
            "Correct sequence with ISNs, states, and purpose; teardown noted. Minor: could mention SYN flood/half-open risk.",
        },
        {
          criterion: "Design Justification — Game",
          score: 19,
          maxPoints: 20,
          feedback:
            "Strong justification citing staleness, head-of-line blocking, and app-level sequencing.",
        },
        {
          criterion: "Design Justification — File Transfer",
          score: 19,
          maxPoints: 20,
          feedback: "Correct and well-argued integrity/ordering rationale.",
        },
        {
          criterion: "Diagrams & Presentation",
          score: 9,
          maxPoints: 10,
          feedback: "Clean tables and a clear handshake diagram.",
        },
      ],
      overallFeedback:
        "Excellent: technically precise across the board with well-reasoned design trade-offs. Only marginal depth (e.g. SYN-flood implications) separates this from a perfect score.",
    },
  },
  {
    assignmentTitle: "TCP vs UDP — Deep Dive",
    studentId: "eval-student-002",
    content: `## TCP vs UDP

| Feature | TCP | UDP |
|---|---|---|
| Connection | Yes, connection based | No connection |
| Reliability | Reliable, resends lost data | Unreliable |
| Order | Keeps packets in order | May arrive out of order |
| Speed | Slower | Faster |
| Examples | Web, email, downloads | Streaming, games, DNS |

## Three-Way Handshake

First the client sends a SYN packet to the server. The server responds with SYN-ACK. The client then sends an ACK and the connection is established. This makes sure both sides are ready and agree on starting sequence numbers before data flows.

## Game Design Choice

For a real-time multiplayer game I would use UDP. Games need low latency, and if a position update is lost it is better to just use the next one than wait for a retransmission of old data.

## File Transfer Choice

For file transfer I would use TCP because every byte of the file must arrive correctly and in order, and TCP handles retransmission automatically.`,
    groundTruth: {
      criterionScores: [
        {
          criterion: "Protocol Comparison Table",
          score: 19,
          maxPoints: 25,
          feedback:
            "Accurate core table; missing flow/congestion control and header overhead rows.",
        },
        {
          criterion: "Three-Way Handshake",
          score: 19,
          maxPoints: 25,
          feedback:
            "Correct SYN / SYN-ACK / ACK order and purpose; no sequence-number detail, states, or diagram.",
        },
        {
          criterion: "Design Justification — Game",
          score: 16,
          maxPoints: 20,
          feedback:
            "Right choice with a sound staleness argument; could discuss app-level sequencing or head-of-line blocking.",
        },
        {
          criterion: "Design Justification — File Transfer",
          score: 17,
          maxPoints: 20,
          feedback: "Correct and clearly justified, if brief.",
        },
        {
          criterion: "Diagrams & Presentation",
          score: 6,
          maxPoints: 10,
          feedback: "Tidy table but no handshake diagram.",
        },
      ],
      overallFeedback:
        "Good, correct work. Add mechanism-level depth (sequence numbers, congestion control) and a handshake diagram to reach the top band.",
    },
  },
  {
    assignmentTitle: "TCP vs UDP — Deep Dive",
    studentId: "eval-student-003",
    content: `TCP and UDP are both transport protocols.

TCP is reliable and slower. UDP is unreliable and faster. TCP is used for websites and UDP is used for videos and games.

The three-way handshake is how TCP starts a connection. The computers exchange three messages to make sure they are both ready. I think the messages are called SYN and ACK.

For a game I would use UDP because it is faster. For a file transfer I would use TCP because it is more reliable and files need to be correct.`,
    groundTruth: {
      criterionScores: [
        {
          criterion: "Protocol Comparison Table",
          score: 12,
          maxPoints: 25,
          feedback:
            "Reliability/speed/use-case contrasts correct but no actual table and only three properties compared.",
        },
        {
          criterion: "Three-Way Handshake",
          score: 11,
          maxPoints: 25,
          feedback:
            "Knows it is three messages involving SYN/ACK but cannot give the sequence or its purpose in detail.",
        },
        {
          criterion: "Design Justification — Game",
          score: 10,
          maxPoints: 20,
          feedback:
            "Correct choice but justification is a single word ('faster') without the latency-vs-staleness reasoning.",
        },
        {
          criterion: "Design Justification — File Transfer",
          score: 11,
          maxPoints: 20,
          feedback:
            "Correct choice with a minimal but valid reliability argument.",
        },
        {
          criterion: "Diagrams & Presentation",
          score: 3,
          maxPoints: 10,
          feedback: "No table or diagram; plain paragraphs.",
        },
      ],
      overallFeedback:
        "Partial: the high-level contrasts and protocol choices are right, but the assignment asks for mechanism-level detail — a real comparison table, the exact handshake sequence, and argued justifications.",
    },
  },
  {
    assignmentTitle: "TCP vs UDP — Deep Dive",
    studentId: "eval-student-004",
    content: `TCP and UDP are two kinds of internet. TCP stands for Transfer Control Program and UDP stands for Universal Data Program.

TCP is the newer and better protocol so most things use it. UDP is an older protocol that is being phased out.

The three-way handshake is when three computers connect to each other at the same time to share files faster.

For a game I would use TCP because games are important and TCP is the best protocol. For file transfer I would also use TCP for the same reason.`,
    groundTruth: {
      criterionScores: [
        {
          criterion: "Protocol Comparison Table",
          score: 3,
          maxPoints: 25,
          feedback:
            "Both expansions are wrong, and the newer/older framing is a misconception; no table or valid comparison.",
        },
        {
          criterion: "Three-Way Handshake",
          score: 2,
          maxPoints: 25,
          feedback:
            "'Three computers connecting' is incorrect — the handshake is three messages between two hosts.",
        },
        {
          criterion: "Design Justification — Game",
          score: 3,
          maxPoints: 20,
          feedback:
            "Wrong choice for a fast-paced game and no technical justification ('TCP is the best' is not an argument).",
        },
        {
          criterion: "Design Justification — File Transfer",
          score: 6,
          maxPoints: 20,
          feedback:
            "Choice happens to be correct but the reasoning is not grounded in reliability or ordering.",
        },
        {
          criterion: "Diagrams & Presentation",
          score: 2,
          maxPoints: 10,
          feedback: "No table or diagram.",
        },
      ],
      overallFeedback:
        "The submission contains serious misconceptions about what TCP and UDP are and how the handshake works. Please re-read the transport-layer reference guide before resubmitting.",
    },
  },
  {
    assignmentTitle: "TCP vs UDP — Deep Dive",
    studentId: "eval-student-005",
    content: `Review of my favourite film, Inception (2010), directed by Christopher Nolan.

The film follows Dom Cobb, a thief who steals corporate secrets through dream-sharing technology, and is offered a chance to have his criminal history erased if he can plant an idea in a target's subconscious — "inception". Nolan structures the heist across four nested dream levels, each with its own time dilation, which makes the crosscut finale one of the most ambitious sequences in modern blockbuster cinema.

Hans Zimmer's score, built around a slowed-down Édith Piaf song, ties the levels together sonically. The spinning top ending remains deliberately ambiguous. 9/10.`,
    groundTruth: {
      criterionScores: [
        {
          criterion: "Protocol Comparison Table",
          score: 0,
          maxPoints: 25,
          feedback: "No networking content.",
        },
        {
          criterion: "Three-Way Handshake",
          score: 0,
          maxPoints: 25,
          feedback: "Not addressed.",
        },
        {
          criterion: "Design Justification — Game",
          score: 0,
          maxPoints: 20,
          feedback: "Not addressed.",
        },
        {
          criterion: "Design Justification — File Transfer",
          score: 0,
          maxPoints: 20,
          feedback: "Not addressed.",
        },
        {
          criterion: "Diagrams & Presentation",
          score: 1,
          maxPoints: 10,
          feedback: "Coherent writing, but entirely off-topic.",
        },
      ],
      overallFeedback:
        "This is a film review, not the TCP/UDP assignment. No credit can be given for the technical criteria.",
    },
  },
];

// ---------------------------------------------------------------------------
// Assignment 3: Subnetting & IP Addressing (100 pts)
// Rubric: Subnetting Accuracy 35, VLSM Optimisation 25, NAT Explanation 20,
// Presentation & Working 20
// ---------------------------------------------------------------------------

const SUBNET: GoldenItem[] = [
  {
    assignmentTitle: "Subnetting & IP Addressing",
    studentId: "eval-student-001",
    content: `## Task 1 – Subnetting 192.168.10.0/24 into 4 equal subnets

4 subnets need 2 borrowed bits → /26, block size 64, 62 usable hosts each.

| Subnet | Network | First host | Last host | Broadcast |
|---|---|---|---|---|
| A | 192.168.10.0/26 | .1 | .62 | .63 |
| B | 192.168.10.64/26 | .65 | .126 | .127 |
| C | 192.168.10.128/26 | .129 | .190 | .191 |
| D | 192.168.10.192/26 | .193 | .254 | .255 |

Working: 2^2 = 4 subnets; host bits remaining = 6 → 2^6 − 2 = 62 usable.

## Task 2 – VLSM for departments of 100, 50, 25, and 10 hosts

Allocate largest first from 192.168.20.0/24:
- 100 hosts → need 7 host bits (2^7−2=126) → /25: 192.168.20.0/25 (.1–.126)
- 50 hosts → 6 bits (62) → /26: 192.168.20.128/26 (.129–.190)
- 25 hosts → 5 bits (30) → /27: 192.168.20.192/27 (.193–.222)
- 10 hosts → 4 bits (14) → /28: 192.168.20.224/28 (.225–.238)

Remaining 192.168.20.240/28 stays free for growth. Fixed-length /26s would fail outright: the 100-host department cannot fit in 62 usable addresses, and the smaller departments would waste most of their blocks. VLSM sizes each allocation to demand.

## Task 3 – NAT

NAT lets many private hosts (RFC 1918 ranges: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16) share one public IP. With PAT (NAT overload), the router rewrites the source IP:port of each outbound packet to its public IP with a unique port, records the mapping in its translation table, and reverses the mapping for replies. This conserves scarce IPv4 addresses and hides internal topology, but breaks end-to-end connectivity — inbound connections need port forwarding, and protocols embedding IPs (e.g. FTP, SIP) need helpers. NAT is a workaround whose pressure IPv6's vast address space removes.`,
    groundTruth: {
      criterionScores: [
        {
          criterion: "Subnetting Accuracy",
          score: 34,
          maxPoints: 35,
          feedback:
            "All four /26 subnets, ranges, and broadcasts correct with working shown.",
        },
        {
          criterion: "VLSM Optimisation",
          score: 24,
          maxPoints: 25,
          feedback:
            "Correct largest-first allocation with per-block ranges and a sound fixed-length comparison.",
        },
        {
          criterion: "NAT Explanation",
          score: 19,
          maxPoints: 20,
          feedback:
            "Accurate PAT mechanics, RFC 1918 ranges, drawbacks, and the IPv6 connection.",
        },
        {
          criterion: "Presentation & Working",
          score: 18,
          maxPoints: 20,
          feedback:
            "Clear tables and arithmetic throughout; a small address-plan diagram would perfect it.",
        },
      ],
      overallFeedback:
        "Excellent, essentially faultless subnetting and VLSM work with a strong NAT discussion. Near full marks.",
    },
  },
  {
    assignmentTitle: "Subnetting & IP Addressing",
    studentId: "eval-student-002",
    content: `## Subnetting 192.168.10.0/24 into 4 subnets

Borrow 2 bits → /26. Each subnet has 64 addresses, 62 usable.
- 192.168.10.0/26 — hosts .1 to .62
- 192.168.10.64/26 — hosts .65 to .126
- 192.168.10.128/26 — hosts .129 to .190
- 192.168.10.192/26 — hosts .193 to .254

## VLSM

Departments: 100, 50, 25, 10 hosts. Assign biggest first:
- 100 → /25 (126 usable): 192.168.20.0/25
- 50 → /26 (62 usable): 192.168.20.128/26
- 25 → /27 (30 usable): 192.168.20.192/27
- 10 → /28 (14 usable): 192.168.20.224/28

This wastes far fewer addresses than giving every department the same size subnet.

## NAT

NAT (Network Address Translation) translates private IP addresses to a public one at the router so a whole network can share one public address. The router keeps a table of which internal host each connection belongs to and rewrites addresses on the way in and out. It saves IPv4 addresses. A downside is that outside hosts cannot directly reach machines behind the NAT.`,
    groundTruth: {
      criterionScores: [
        {
          criterion: "Subnetting Accuracy",
          score: 29,
          maxPoints: 35,
          feedback:
            "Subnets and host ranges correct; broadcast addresses not listed and working only sketched.",
        },
        {
          criterion: "VLSM Optimisation",
          score: 20,
          maxPoints: 25,
          feedback:
            "Correct allocations largest-first; missing host ranges per block and the leftover /28 observation.",
        },
        {
          criterion: "NAT Explanation",
          score: 15,
          maxPoints: 20,
          feedback:
            "Core translation-table idea and motivation correct; no PAT/port detail, RFC 1918 ranges, or protocol caveats.",
        },
        {
          criterion: "Presentation & Working",
          score: 14,
          maxPoints: 20,
          feedback:
            "Organised lists, but limited shown arithmetic and no tables/diagram.",
        },
      ],
      overallFeedback:
        "Good and numerically correct. Show broadcast addresses and full working, add per-block ranges, and deepen NAT (ports, private ranges) for a top grade.",
    },
  },
  {
    assignmentTitle: "Subnetting & IP Addressing",
    studentId: "eval-student-003",
    content: `## Subnetting

To split 192.168.10.0/24 into 4 subnets you change the mask to /26. The subnets are 192.168.10.0, 192.168.10.64, 192.168.10.128 and 192.168.10.192. I think each one holds 64 hosts.

## VLSM

VLSM means Variable Length Subnet Mask. It means you can use different sized subnets for different departments instead of making them all the same. The biggest department gets the biggest subnet. I was not sure how to calculate the exact masks for 100, 50, 25 and 10 hosts.

## NAT

NAT changes your private IP address into a public IP address so you can use the internet. Routers at home do this. It exists because there are not enough IPv4 addresses for everyone.`,
    groundTruth: {
      criterionScores: [
        {
          criterion: "Subnetting Accuracy",
          score: 20,
          maxPoints: 35,
          feedback:
            "Correct /26 boundaries, but 'holds 64 hosts' misses the network/broadcast subtraction (62 usable) and no ranges or working shown.",
        },
        {
          criterion: "VLSM Optimisation",
          score: 8,
          maxPoints: 25,
          feedback:
            "Concept stated correctly but the actual allocation — the core of the task — was not attempted.",
        },
        {
          criterion: "NAT Explanation",
          score: 11,
          maxPoints: 20,
          feedback:
            "Purpose and motivation right at a consumer level; no mechanism (translation table, ports) or drawbacks.",
        },
        {
          criterion: "Presentation & Working",
          score: 8,
          maxPoints: 20,
          feedback: "Sections used, but no tables, arithmetic, or diagrams.",
        },
      ],
      overallFeedback:
        "Partial: subnet boundaries and concepts are right, but usable-host counts, the entire VLSM calculation, and NAT mechanics are missing. Practice the 2^n−2 arithmetic — it unlocks most of the lost marks.",
    },
  },
  {
    assignmentTitle: "Subnetting & IP Addressing",
    studentId: "eval-student-004",
    content: `Subnetting is when you divide the internet into smaller internets. To make 4 subnets from 192.168.10.0 you just add 4 to the last number: 192.168.10.4, 192.168.10.8, 192.168.10.12 and 192.168.10.16. Each subnet can hold 255 computers.

VLSM is a type of cable used to connect subnets together at variable lengths.

NAT stands for Network Access Terminal. It is the box your internet company gives you that the cables plug into. Without a NAT you cannot access the internet because the terminal is what sends the signals.`,
    groundTruth: {
      criterionScores: [
        {
          criterion: "Subnetting Accuracy",
          score: 5,
          maxPoints: 35,
          feedback:
            "The 'add 4' method and 255-host claim are wrong; no understanding of masks, block sizes, or borrowed bits.",
        },
        {
          criterion: "VLSM Optimisation",
          score: 0,
          maxPoints: 25,
          feedback:
            "VLSM is not a cable; the concept was not understood at all.",
        },
        {
          criterion: "NAT Explanation",
          score: 2,
          maxPoints: 20,
          feedback:
            "Wrong expansion and a hardware misidentification; only the vague association with home internet access earns anything.",
        },
        {
          criterion: "Presentation & Working",
          score: 4,
          maxPoints: 20,
          feedback: "Readable paragraphs but no working, tables, or structure.",
        },
      ],
      overallFeedback:
        "The core concepts (masks, VLSM, NAT) are fundamentally misunderstood. Please work through the subnetting practice sheet and the addressing reference guide, then resubmit.",
    },
  },
  {
    assignmentTitle: "Subnetting & IP Addressing",
    studentId: "eval-student-005",
    content: `Training log — half marathon preparation, week 6.

Monday: rest day with 20 minutes of stretching. Tuesday: 6x800m intervals at 5K pace with 90-second recovery jogs; splits were consistent within three seconds. Wednesday: easy 5K recovery run, heart rate kept under 140. Thursday: tempo run — 2K warm-up, 5K at threshold pace, 1K cool-down. Friday: rest. Saturday: parkrun at a controlled effort, finishing 24:10. Sunday: long run of 16K at conversational pace, fuelled with a gel at the halfway point.

Weekly total: 34K. Legs feeling strong; next week increases the long run to 18K and adds strides after the recovery run.`,
    groundTruth: {
      criterionScores: [
        {
          criterion: "Subnetting Accuracy",
          score: 0,
          maxPoints: 35,
          feedback: "No subnetting content.",
        },
        {
          criterion: "VLSM Optimisation",
          score: 0,
          maxPoints: 25,
          feedback: "Not addressed.",
        },
        {
          criterion: "NAT Explanation",
          score: 0,
          maxPoints: 20,
          feedback: "Not addressed.",
        },
        {
          criterion: "Presentation & Working",
          score: 2,
          maxPoints: 20,
          feedback: "Well-organised writing, but entirely off-topic.",
        },
      ],
      overallFeedback:
        "This is a running training log, not the subnetting assignment. Please submit work addressing the assignment brief.",
    },
  },
];

const GOLDEN: GoldenItem[] = [...OSI, ...TCP_UDP, ...SUBNET];

async function main() {
  try {
    console.log("🌱 Seeding golden eval set...");

    const [course] = await db
      .select({ id: courses.id })
      .from(courses)
      .where(eq(courses.name, COURSE_NAME))
      .limit(1);
    if (!course) {
      throw new Error(
        `Course "${COURSE_NAME}" not found. Run db:seed:networks first.`,
      );
    }

    // Resolve the three assignments up front.
    const titles = [...new Set(GOLDEN.map((g) => g.assignmentTitle))];
    const rows = await db
      .select({ id: assignments.id, title: assignments.title })
      .from(assignments)
      .where(
        and(
          eq(assignments.courseId, course.id),
          inArray(assignments.title, titles),
        ),
      );
    const assignmentIdByTitle = new Map(rows.map((r) => [r.title, r.id]));
    for (const title of titles) {
      if (!assignmentIdByTitle.has(title)) {
        throw new Error(`Assignment "${title}" not found in Networks course.`);
      }
    }

    // Upsert eval students and enrol them.
    for (const s of STUDENTS) {
      await db
        .insert(usersSync)
        .values({
          id: s.id,
          name: s.name,
          email: `${s.id}@example.com`,
          role: "student",
        })
        .onConflictDoUpdate({
          target: usersSync.id,
          set: { name: s.name, email: `${s.id}@example.com` },
        });
      await db
        .insert(courseStudents)
        .values({ courseId: course.id, studentId: s.id })
        .onConflictDoNothing();
    }
    console.log(`👤 Upserted ${STUDENTS.length} eval students`);

    // Upsert submissions + instructor ground-truth grades.
    for (const item of GOLDEN) {
      const assignmentId = assignmentIdByTitle.get(item.assignmentTitle);
      if (!assignmentId) continue; // validated above

      const [submission] = await db
        .insert(submissions)
        .values({
          assignmentId,
          studentId: item.studentId,
          content: item.content,
        })
        .onConflictDoUpdate({
          target: [submissions.assignmentId, submissions.studentId],
          set: { content: item.content },
        })
        .returning({ id: submissions.id });

      const totalScore = item.groundTruth.criterionScores.reduce(
        (sum, c) => sum + c.score,
        0,
      );
      const maxScore = item.groundTruth.criterionScores.reduce(
        (sum, c) => sum + c.maxPoints,
        0,
      );

      await db
        .insert(grades)
        .values({
          submissionId: submission.id,
          criterionScores: item.groundTruth.criterionScores,
          overallFeedback: item.groundTruth.overallFeedback,
          totalScore,
          maxScore,
          source: "instructor",
        })
        .onConflictDoUpdate({
          target: grades.submissionId,
          set: {
            criterionScores: item.groundTruth.criterionScores,
            overallFeedback: item.groundTruth.overallFeedback,
            totalScore,
            maxScore,
            source: "instructor",
            gradedAt: new Date().toISOString(),
          },
        });

      console.log(
        `✅ ${item.assignmentTitle} / ${item.studentId} → ${totalScore}/${maxScore}`,
      );
    }

    console.log(`\n🎉 Golden set seeded: ${GOLDEN.length} labelled items.`);
  } catch (err) {
    console.error("💥 Seed failed:", err);
    process.exit(1);
  }
}

void main();
