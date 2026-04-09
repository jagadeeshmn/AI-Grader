/**
 * Seeds sample reference materials for the Networks course (course_id = 1).
 * Run with: npm run db:seed:materials
 *
 * Safe to re-run — clears only Networks materials before inserting.
 *
 * NOTE: Chunks are inserted WITHOUT embeddings. To generate embeddings, run
 * the embed-materials script (or upload via the UI, which embeds automatically).
 */
import "dotenv/config";
import db from "@/db/index";
import { courses, courseMaterials, materialChunks } from "@/db/schema";
import { eq } from "drizzle-orm";
import { chunkText } from "@/lib/rag/chunker";
import { embedBatch } from "@/lib/rag/embeddings";

const COURSE_NAME = "Networks";

type MaterialSeed = {
  title: string;
  content: string;
};

const MATERIALS: MaterialSeed[] = [
  {
    title: "OSI Model — Complete Reference Guide",
    content: `The Open Systems Interconnection (OSI) model is a conceptual framework that standardises the functions of a telecommunication or computing system into seven distinct layers. It was developed by the International Organization for Standardization (ISO) and published in 1984 as ISO 7498. The model serves as a universal language for computer networking, allowing diverse communication systems to communicate using standard protocols.

Layer 1 — Physical Layer

The Physical layer is the lowest layer of the OSI model and is concerned with the transmission and reception of raw, unstructured bit streams over a physical medium. It defines the electrical, mechanical, procedural, and functional specifications for activating, maintaining, and deactivating the physical link between communicating network systems. Common physical layer technologies include Ethernet (IEEE 802.3), Wi-Fi radio signals (IEEE 802.11), fiber optic cables, coaxial cables, and twisted pair cables. The physical layer deals with bit rate control, physical topologies (bus, star, ring, mesh), transmission modes (simplex, half-duplex, full-duplex), and line encoding schemes such as Manchester encoding and Non-Return-to-Zero (NRZ). A critical concept at this layer is the relationship between bandwidth and data rate, described by the Nyquist theorem for noiseless channels and the Shannon-Hartley theorem for noisy channels. The Nyquist formula states that the maximum data rate = 2B × log2(V) bits per second, where B is bandwidth in hertz and V is the number of signal levels. The Shannon-Hartley theorem gives the channel capacity as C = B × log2(1 + S/N), where S/N is the signal-to-noise ratio. Understanding these formulas is essential for calculating theoretical maximum throughput on any communication channel.

Layer 2 — Data Link Layer

The Data Link layer provides node-to-node data transfer — a link between two directly connected nodes. It detects and possibly corrects errors that may occur in the Physical layer. The Data Link layer is divided into two sublayers: the Logical Link Control (LLC) sublayer and the Media Access Control (MAC) sublayer. The MAC sublayer controls how devices on a network gain access to the medium and permission to transmit data. It uses MAC addresses — 48-bit hardware addresses burned into network interface cards (NICs) — to uniquely identify devices on a local network segment. A MAC address is written in hexadecimal notation, for example 00:1A:2B:3C:4D:5E, where the first 24 bits represent the Organizationally Unique Identifier (OUI) assigned to the manufacturer, and the last 24 bits are the device-specific identifier. The Ethernet frame structure includes a preamble (7 bytes), start frame delimiter (1 byte), destination MAC address (6 bytes), source MAC address (6 bytes), EtherType/length field (2 bytes), payload (46-1500 bytes), and Frame Check Sequence (FCS) using a 32-bit CRC for error detection. Switches operate at this layer, maintaining a MAC address table (also called a CAM table) that maps MAC addresses to physical ports. When a switch receives a frame, it reads the destination MAC address and forwards the frame only to the port associated with that address. If the address is not in the table, the switch floods the frame to all ports except the source port. The Address Resolution Protocol (ARP) bridges Layer 2 and Layer 3 by mapping IP addresses to MAC addresses. When a device needs to communicate with another device on the same subnet, it broadcasts an ARP request asking "Who has IP address X?" The device with that IP responds with its MAC address, and the requesting device caches this mapping in its ARP table for future use.

Layer 3 — Network Layer

The Network layer is responsible for packet forwarding including routing through intermediate routers. It provides logical addressing (IP addresses), determines the best path for data to travel from source to destination, and handles packet fragmentation and reassembly when the packet size exceeds the Maximum Transmission Unit (MTU) of a network segment. IPv4 addresses are 32-bit numbers divided into four octets, written in dotted decimal notation (e.g. 192.168.1.1). The address space is divided into network and host portions using a subnet mask. A subnet mask is also a 32-bit number where contiguous 1s represent the network portion and 0s represent the host portion. For example, the mask 255.255.255.0 (or /24 in CIDR notation) means the first 24 bits identify the network and the last 8 bits identify hosts, allowing 254 usable host addresses (2^8 - 2, subtracting the network address and broadcast address). Variable Length Subnet Masking (VLSM) is a technique that allows a network administrator to divide an IP address space into subnets of different sizes, unlike classful subnetting where all subnets must be the same size. VLSM is essential for efficient IP address allocation — for instance, a point-to-point link needs only 2 host addresses (/30), while a department LAN might need 200 (/24). To perform VLSM, you start by allocating the largest subnet first, then work downward in size, ensuring no subnets overlap. Routing protocols operate at this layer: OSPF (Open Shortest Path First) is a link-state protocol that uses Dijkstra's algorithm to find the shortest path; BGP (Border Gateway Protocol) is a path-vector protocol used for inter-domain routing on the internet; RIP (Routing Information Protocol) is a simpler distance-vector protocol that uses hop count as its metric with a maximum of 15 hops. Network Address Translation (NAT) translates private IP addresses (defined in RFC 1918: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16) to public IP addresses for internet communication. NAT conserves the limited IPv4 address space but can cause problems with certain protocols and peer-to-peer applications because it breaks the end-to-end principle of IP communication.

Layer 4 — Transport Layer

The Transport layer provides end-to-end communication services for applications. It is responsible for segmentation and reassembly of data, flow control, and error checking. The two primary protocols at this layer are TCP (Transmission Control Protocol) and UDP (User Datagram Protocol). TCP is a connection-oriented protocol that provides reliable, ordered, and error-checked delivery of data. It uses a three-way handshake to establish a connection: (1) the client sends a SYN segment with an initial sequence number, (2) the server responds with a SYN-ACK segment acknowledging the client's sequence number and providing its own, (3) the client sends an ACK confirming the server's sequence number. After this handshake, data can flow in both directions. TCP implements flow control using a sliding window mechanism, where the receiver advertises a window size indicating how many bytes it can accept. Congestion control is handled through algorithms like Slow Start, Congestion Avoidance, Fast Retransmit, and Fast Recovery. The TCP header is 20-60 bytes and includes source port, destination port, sequence number, acknowledgement number, data offset, flags (SYN, ACK, FIN, RST, PSH, URG), window size, checksum, and urgent pointer. Connection teardown uses a four-way handshake: either side sends FIN, the other acknowledges with ACK, then sends its own FIN, which is acknowledged with a final ACK. A half-open connection occurs when one side has terminated but the other has not. UDP is a connectionless protocol that provides a best-effort delivery service with no guarantees of ordering or reliability. The UDP header is only 8 bytes: source port, destination port, length, and checksum. UDP is used when speed is prioritised over reliability — applications include DNS queries, real-time video streaming, online gaming, and VoIP. When reliability is needed over UDP, it must be implemented at the application layer (e.g., QUIC protocol).

Layer 5 — Session Layer

The Session layer establishes, manages, and terminates sessions between applications. It provides mechanisms for opening, closing, and managing a session, including checkpointing and recovery. In practice, this layer's functionality is often incorporated into the application layer in modern TCP/IP networking. Protocols associated with this layer include NetBIOS, RPC (Remote Procedure Call), and PPTP (Point-to-Point Tunneling Protocol). The session layer handles dialog control (determining which device transmits, simplex or duplex), token management, and synchronisation (inserting checkpoints into data streams for recovery in case of failure).

Layer 6 — Presentation Layer

The Presentation layer is responsible for data translation, encryption, and compression. It ensures that data sent from the application layer of one system can be read by the application layer of another system. Translation functions include converting between character encoding formats (ASCII, EBCDIC, Unicode). Encryption services at this layer include TLS/SSL, which provides confidentiality and integrity for data in transit. Compression reduces the number of bits that need to be transmitted, which is important for multimedia data. Common formats handled at this layer include JPEG, GIF, PNG for images, MPEG for video, and MIDI for audio. In the modern TCP/IP stack, these functions are typically handled by libraries within the application itself rather than by a separate protocol layer.

Layer 7 — Application Layer

The Application layer is the closest layer to the end user and provides network services directly to user applications. It is not the application itself but rather the layer that provides services the application uses to communicate over the network. Key protocols at this layer include HTTP/HTTPS for web browsing (HTTP uses port 80, HTTPS uses port 443), FTP for file transfer (ports 20 and 21), SMTP for sending email (port 25), POP3 for retrieving email (port 110), IMAP for email access (port 143), DNS for domain name resolution (port 53), DHCP for dynamic IP address assignment (ports 67/68), SSH for secure remote login (port 22), and Telnet for unencrypted remote login (port 23). The application layer is where users interact with network-aware applications — web browsers, email clients, file transfer utilities, and many more.

Encapsulation and Decapsulation

Encapsulation is the process by which data is wrapped with protocol information at each layer of the OSI model as it descends from the application layer to the physical layer. At each layer, a Protocol Data Unit (PDU) is created by adding layer-specific headers (and sometimes trailers) to the data received from the layer above. The PDU names at each layer are: Data (Application/Presentation/Session), Segment (Transport — TCP) or Datagram (Transport — UDP), Packet (Network), Frame (Data Link), and Bits (Physical). As data moves down the stack, each layer's header is prepended, creating a nested structure. Decapsulation is the reverse process on the receiving end: each layer reads and strips its own header, passing the payload up to the next layer until the original application data is recovered. This layered approach allows each protocol to operate independently without needing to understand the inner workings of protocols at other layers, which is the fundamental design principle behind the OSI model.`,
  },

  {
    title: "TCP/IP Transport Protocols — Detailed Reference",
    content: `Transmission Control Protocol (TCP) — In-Depth

TCP is defined in RFC 793 (original specification) with significant updates in RFC 5681 (congestion control), RFC 7323 (TCP extensions), and RFC 9293 (consolidated specification). It provides a reliable, ordered, and error-checked byte stream between applications running on hosts communicating via an IP network.

Connection Establishment — Three-Way Handshake

The TCP three-way handshake is the process used to establish a TCP connection. It serves three purposes: (1) both sides agree to initiate the connection, (2) both sides synchronise their initial sequence numbers (ISN), and (3) both sides exchange TCP options like Maximum Segment Size (MSS), window scaling, and selective acknowledgements (SACK). The process works as follows:

Step 1 (SYN): The client sends a TCP segment with the SYN flag set and a randomly chosen Initial Sequence Number (ISN), say ISN_C = 1000. The segment contains no application data. The client enters the SYN_SENT state.

Step 2 (SYN-ACK): The server receives the SYN, allocates resources for the connection (TCB — Transmission Control Block), and responds with a segment that has both SYN and ACK flags set. The server provides its own ISN (say ISN_S = 5000) and acknowledges the client's ISN by setting the acknowledgement number to ISN_C + 1 = 1001. The server enters the SYN_RECEIVED state.

Step 3 (ACK): The client acknowledges the server's SYN by sending a segment with the ACK flag set and the acknowledgement number set to ISN_S + 1 = 5001. The client enters the ESTABLISHED state. When the server receives this ACK, it also enters the ESTABLISHED state. Data transfer can now begin.

A SYN flood attack exploits this process by sending a large number of SYN packets with spoofed source addresses, causing the server to allocate resources for each half-open connection and eventually exhaust its connection table. SYN cookies are a defence mechanism where the server encodes connection state in the ISN itself, avoiding the need to store state until the handshake completes.

Connection Teardown — Four-Way Handshake

TCP uses a four-way handshake for connection termination because TCP connections are full-duplex, meaning each direction must be shut down independently:

Step 1 (FIN): The initiating host sends a FIN segment, indicating it has finished sending data. It enters the FIN_WAIT_1 state.

Step 2 (ACK): The receiving host acknowledges the FIN with an ACK. The initiator moves to FIN_WAIT_2 state. The receiver is now in CLOSE_WAIT state and can still send data.

Step 3 (FIN): When the receiver has also finished sending data, it sends its own FIN segment. It enters the LAST_ACK state.

Step 4 (ACK): The initiator acknowledges this FIN with an ACK and enters the TIME_WAIT state, where it remains for 2×MSL (Maximum Segment Lifetime, typically 60 seconds) before the connection is fully closed. This waiting period ensures any delayed segments from the connection are discarded and prevents a new connection from receiving old segments.

A half-open connection occurs when one side has sent a FIN but the other side has not yet done so. During this period, data can still flow in one direction (from the side that has not closed).

TCP Flow Control — Sliding Window

TCP uses a sliding window protocol for flow control. The receiver advertises a receive window (rwnd) in every ACK segment, telling the sender how many bytes it can accept beyond the last acknowledged byte. The sender must not have more unacknowledged bytes in flight than the minimum of rwnd and cwnd (congestion window). If the receiver's buffer fills up, it advertises a window of zero, and the sender pauses transmission. The sender periodically sends window probe segments (1-byte segments) to check if the window has reopened.

TCP Congestion Control

TCP congestion control prevents the sender from overwhelming the network. The four main algorithms (defined in RFC 5681) are:

Slow Start: When a new connection is established, cwnd starts at a small value (typically 1-10 MSS). For each ACK received, cwnd increases by 1 MSS, resulting in exponential growth. This continues until cwnd reaches the slow start threshold (ssthresh) or a loss event occurs.

Congestion Avoidance: Once cwnd exceeds ssthresh, TCP enters congestion avoidance mode. Now cwnd increases by approximately 1 MSS per round-trip time (RTT) rather than per ACK, resulting in linear growth. This conservative approach probes for available bandwidth without aggressively increasing the sending rate.

Fast Retransmit: If the sender receives three duplicate ACKs (four identical ACKs total) for the same segment, it retransmits the missing segment immediately without waiting for the retransmission timeout (RTO) to expire. This provides faster recovery from single packet losses.

Fast Recovery: After fast retransmit, instead of returning to slow start, TCP sets ssthresh = cwnd/2, sets cwnd = ssthresh + 3 MSS (for the three duplicate ACKs), and enters congestion avoidance mode directly. This avoids the performance penalty of returning to slow start after every loss event.

User Datagram Protocol (UDP) — In-Depth

UDP is defined in RFC 768 and provides a minimal, connectionless transport service. The entire UDP header is only 8 bytes: source port (2 bytes), destination port (2 bytes), length (2 bytes), and checksum (2 bytes). Unlike TCP, UDP does not provide reliability, ordering, flow control, or congestion control.

UDP Characteristics:
- No handshake: Packets are sent immediately without establishing a connection.
- No acknowledgements: The sender has no way to know if a packet arrived.
- No ordering: Packets may arrive out of order; the application must handle reordering if needed.
- No flow control: A fast sender can overwhelm a slow receiver.
- Lower overhead: The 8-byte header versus TCP's 20-60 bytes makes UDP more efficient for small messages.
- No head-of-line blocking: In TCP, a lost segment blocks all subsequent segments even if they have arrived; UDP does not have this problem.

UDP is ideal for applications where timeliness is more important than reliability: real-time video and audio streaming (where a lost frame is preferable to a delayed one), online gaming (where stale game state is useless), DNS queries (single request-response, small payloads), DHCP (bootstrapping, no existing connection), NTP (time synchronisation), and SNMP (network monitoring). When reliability is needed over UDP, the application layer must implement it — for example, QUIC (RFC 9000) is a transport protocol built on UDP that provides TCP-like reliability with additional features like multiplexed streams without head-of-line blocking, built-in TLS 1.3 encryption, and connection migration across network changes.

TCP vs UDP — Summary Comparison

Connection: TCP is connection-oriented (three-way handshake), UDP is connectionless.
Reliability: TCP guarantees delivery with retransmissions, UDP provides best-effort delivery.
Ordering: TCP delivers data in order using sequence numbers, UDP provides no ordering guarantee.
Flow Control: TCP uses a sliding window mechanism, UDP has no flow control.
Congestion Control: TCP implements slow start, congestion avoidance, fast retransmit, and fast recovery. UDP has no congestion control.
Header Size: TCP header is 20-60 bytes, UDP header is 8 bytes.
Speed: TCP is slower due to overhead, UDP is faster due to simplicity.
Use Cases: TCP is used for web browsing (HTTP), email (SMTP), file transfer (FTP). UDP is used for streaming, gaming, DNS, VoIP.`,
  },

  {
    title: "IP Addressing, Subnetting & VLSM — Complete Guide",
    content: `Internet Protocol Addressing

An IPv4 address is a 32-bit logical address assigned to a network interface. It is written in dotted decimal notation as four octets separated by dots, e.g. 192.168.10.1. Each octet represents 8 bits, ranging from 0 to 255. The total IPv4 address space contains 2^32 = 4,294,967,296 addresses.

Classful Addressing (Historical)

Before CIDR, IP addresses were divided into five classes based on the leading bits of the first octet:

Class A: First bit = 0. Range 1.0.0.0 to 126.255.255.255. Default mask /8. Supports 126 networks with approximately 16.7 million hosts each. Designed for very large organisations.

Class B: First two bits = 10. Range 128.0.0.0 to 191.255.255.255. Default mask /16. Supports 16,384 networks with 65,534 hosts each. Designed for medium to large organisations.

Class C: First three bits = 110. Range 192.0.0.0 to 223.255.255.255. Default mask /24. Supports approximately 2.1 million networks with 254 hosts each. Designed for small organisations.

Class D: First four bits = 1110. Range 224.0.0.0 to 239.255.255.255. Reserved for multicast.

Class E: First four bits = 1111. Range 240.0.0.0 to 255.255.255.255. Reserved for experimental use.

Private IP Address Ranges (RFC 1918)

RFC 1918 defines three blocks of private IP addresses that are not routable on the public internet: 10.0.0.0/8 (Class A — 16,777,216 addresses), 172.16.0.0/12 (Class B — 1,048,576 addresses), and 192.168.0.0/16 (Class C — 65,536 addresses). These addresses are used within private networks and must be translated to public addresses via Network Address Translation (NAT) before communicating on the internet. This design dramatically extends the usable lifetime of the IPv4 address space because millions of private networks can reuse the same private address ranges independently.

Subnetting Fundamentals

Subnetting is the practice of dividing a single network into two or more smaller logical networks (subnets). This is accomplished by borrowing bits from the host portion of an IP address and designating them as subnet bits. The benefits of subnetting include: reduced broadcast domains (smaller broadcast domains reduce unnecessary traffic), improved security (subnets can be isolated with firewalls and ACLs), simplified management (logical grouping by department, floor, or function), and efficient IP address utilisation.

To subnet a network, you need to determine how many subnets are needed and how many hosts each subnet must support. The number of usable hosts in a subnet is 2^h - 2, where h is the number of host bits. The subtraction of 2 accounts for the network address (all host bits = 0) and the broadcast address (all host bits = 1). The number of subnets created is 2^s, where s is the number of subnet bits borrowed.

Example — Subnetting 192.168.10.0/24 for four departments:

Given: 192.168.10.0/24 (256 total addresses, 254 usable hosts)

Engineering (50 hosts needed): Requires at least 6 host bits (2^6 - 2 = 62 usable). Subnet mask: /26 (255.255.255.192). Network: 192.168.10.0/26. First usable: 192.168.10.1. Last usable: 192.168.10.62. Broadcast: 192.168.10.63.

HR (20 hosts needed): Requires at least 5 host bits (2^5 - 2 = 30 usable). Subnet mask: /27 (255.255.255.224). Network: 192.168.10.64/27. First usable: 192.168.10.65. Last usable: 192.168.10.94. Broadcast: 192.168.10.95.

Finance (10 hosts needed): Requires at least 4 host bits (2^4 - 2 = 14 usable). Subnet mask: /28 (255.255.255.240). Network: 192.168.10.96/28. First usable: 192.168.10.97. Last usable: 192.168.10.110. Broadcast: 192.168.10.111.

Management (5 hosts needed): Requires at least 3 host bits (2^3 - 2 = 6 usable). Subnet mask: /29 (255.255.255.248). Network: 192.168.10.112/29. First usable: 192.168.10.113. Last usable: 192.168.10.118. Broadcast: 192.168.10.119.

This VLSM approach uses addresses from 192.168.10.0 through 192.168.10.119, leaving 192.168.10.120 through 192.168.10.255 (136 addresses) available for future use. Without VLSM, using a uniform /26 mask would require four subnets of 62 hosts each (248 addresses used), wasting significantly more address space.

Network Address Translation (NAT)

NAT operates at the network layer and translates private IP addresses to public IP addresses as packets cross the boundary between a private network and the public internet. There are several types of NAT:

Static NAT: A one-to-one mapping between a private IP and a public IP. Used when an internal server needs to be consistently reachable from the internet (e.g., a web server). Every internal device that needs internet access requires its own public IP.

Dynamic NAT: A pool of public IP addresses is shared among internal devices on a first-come, first-served basis. When an internal device initiates a connection, it is assigned an available public IP from the pool. Once the connection ends, the public IP is returned to the pool.

Port Address Translation (PAT / NAT Overload): The most common form of NAT, where many internal devices share a single public IP address. The NAT device differentiates connections by assigning unique source port numbers to each internal connection. For example, Host A (192.168.1.5:3000) and Host B (192.168.1.6:3001) both translate to 203.0.113.1 but with different source ports (e.g., 203.0.113.1:40001 and 203.0.113.1:40002). This allows thousands of devices to share one public IP.

NAT Limitations: NAT breaks the end-to-end connectivity principle of IP because external hosts cannot initiate connections to internal hosts without explicit port forwarding rules. This causes problems for peer-to-peer applications (P2P file sharing, VoIP, online gaming), certain VPN configurations, and protocols that embed IP addresses in the payload (e.g., FTP active mode, SIP). Solutions include STUN (Session Traversal Utilities for NAT), TURN (Traversal Using Relays around NAT), and ICE (Interactive Connectivity Establishment), which are used together in WebRTC to establish peer-to-peer connections despite NAT.`,
  },

  {
    title: "DNS & HTTP — Application Layer Protocols Reference",
    content: `Domain Name System (DNS) — Complete Reference

The Domain Name System is a hierarchical, distributed naming system that translates human-readable domain names into IP addresses. Defined primarily in RFC 1034 and RFC 1035, DNS is one of the most critical infrastructure services on the internet. Without DNS, users would need to remember IP addresses for every website they visit.

DNS Hierarchy and Components

The DNS namespace is organised as an inverted tree structure with the root at the top:

Root Level: Represented by a dot (.) and served by 13 sets of root name servers (labelled A through M), distributed globally using anycast addressing. The root servers do not contain information about every domain — they only know where to direct queries for top-level domains (TLDs).

Top-Level Domains (TLDs): Divided into generic TLDs (gTLDs: .com, .org, .net, .edu, .gov, .info, .io) and country-code TLDs (ccTLDs: .uk, .de, .jp, .in, .au). Each TLD has its own set of authoritative nameservers that maintain information about which nameservers are authoritative for second-level domains within that TLD.

Second-Level Domains: Registered by organisations and individuals (e.g., "google" in google.com, "university" in university.edu). The registrant configures authoritative nameservers for their domain.

Subdomains: Created by the domain owner to organise their namespace (e.g., www.university.edu, mail.university.edu, cs.university.edu).

DNS Resolution Process — Step by Step

When a user types www.university.edu into their browser for the first time, the following resolution chain occurs:

Step 1 — Browser Cache: The browser checks its own DNS cache for a recent mapping. Modern browsers cache DNS results for the duration specified by the TTL (Time To Live) field in the DNS response. If found and not expired, the cached IP is used immediately — no network query needed.

Step 2 — Operating System Resolver Cache: If the browser cache misses, the OS stub resolver is consulted. The OS maintains its own DNS cache (viewable on Windows with "ipconfig /displaydns" and flushable with "ipconfig /flushdns"). The OS also checks the local hosts file (/etc/hosts on Unix, C:\Windows\System32\drivers\etc\hosts on Windows) before making any network queries.

Step 3 — Recursive Resolver Query: The OS sends the query to its configured recursive resolver (typically provided by the ISP, or a public resolver like Google's 8.8.8.8 or Cloudflare's 1.1.1.1). The recursive resolver acts on behalf of the client and will perform the iterative queries needed to resolve the domain. The resolver first checks its own cache — if it recently resolved this domain or any parent domain, it can skip directly to the relevant nameserver.

Step 4 — Root Nameserver Referral: If the recursive resolver has no cached information, it queries a root nameserver: "Where can I find information about .edu domains?" The root server responds with a referral — the IP addresses of the .edu TLD nameservers. The root server does not know the answer; it only directs the resolver to the next level.

Step 5 — TLD Nameserver Referral: The recursive resolver queries the .edu TLD nameserver: "Where can I find information about university.edu?" The TLD server responds with the IP addresses of the authoritative nameservers for university.edu (e.g., ns1.university.edu and ns2.university.edu).

Step 6 — Authoritative Nameserver Response: The recursive resolver queries university.edu's authoritative nameserver: "What is the A record for www.university.edu?" The authoritative server responds with the IP address (e.g., 93.184.216.34) and a TTL value indicating how long this answer may be cached.

The recursive resolver caches this result for the TTL duration and returns it to the client's OS, which caches it as well, and the browser receives the IP address and proceeds to establish a TCP connection.

DNS Record Types

A record: Maps a hostname to an IPv4 address. Example: www.example.com → 93.184.216.34
AAAA record: Maps a hostname to an IPv6 address. Example: www.example.com → 2606:2800:220:1:248:1893:25c8:1946
CNAME record: Creates an alias from one domain name to another. Example: blog.example.com → example.wordpress.com
MX record: Specifies mail servers for a domain, with priority values. Example: example.com MX 10 mail1.example.com, MX 20 mail2.example.com
NS record: Delegates a DNS zone to use the specified authoritative nameservers. Example: example.com NS ns1.dnsprovider.com
TXT record: Stores arbitrary text, commonly used for SPF, DKIM, and domain verification. Example: example.com TXT "v=spf1 include:_spf.google.com ~all"
SOA record: Start of Authority — contains administrative information about the zone (primary nameserver, admin email, serial number, refresh/retry/expire timers).
PTR record: Used for reverse DNS lookups — maps an IP address to a hostname.

TTL and Caching

The Time To Live (TTL) is a value in seconds that tells resolvers and clients how long to cache a DNS response. A TTL of 3600 means the record can be cached for one hour. After the TTL expires, the resolver must query the authoritative server again for a fresh answer. Short TTLs (60-300 seconds) allow rapid changes (useful during DNS migrations) but increase query load on authoritative servers. Long TTLs (3600-86400 seconds) reduce query load but mean changes propagate slowly. When an administrator changes a DNS record, they often lower the TTL in advance (e.g., to 60 seconds, a day before the change), make the change, then raise the TTL again once propagation is complete.

HTTP — Hypertext Transfer Protocol

HTTP is the foundation of data communication on the World Wide Web. It is an application-layer protocol built on top of TCP (HTTP/1.1 and HTTP/2) or UDP via QUIC (HTTP/3).

HTTP/1.1 (RFC 2616, updated by RFC 7230-7235): Uses persistent connections by default (Connection: keep-alive), allowing multiple requests over a single TCP connection. However, it suffers from head-of-line blocking — responses must be received in the order requests were sent. Pipelining was introduced to allow sending multiple requests without waiting for responses, but it was poorly implemented by browsers and servers and was largely abandoned. Each request requires its own set of uncompressed headers, which can add significant overhead when many resources are requested.

HTTP/2 (RFC 7540, updated by RFC 9113): A major revision that introduces binary framing — all communication is split into smaller messages and frames that are interleaved on a single TCP connection. Key features: multiplexing allows multiple request-response exchanges simultaneously on one connection without head-of-line blocking at the HTTP level (though TCP-level head-of-line blocking remains); HPACK header compression significantly reduces header overhead by using a shared static table, a dynamic table, and Huffman encoding; server push allows the server to proactively send resources the client hasn't requested yet (e.g., pushing a CSS file when the HTML references it); stream prioritisation lets clients indicate relative priority of resources.

HTTP/3 (RFC 9114): Replaces TCP with QUIC as the transport protocol. QUIC runs on UDP and provides its own reliability, ordering, and congestion control per-stream, eliminating TCP's head-of-line blocking entirely. If one stream loses a packet, other streams are unaffected. QUIC also integrates TLS 1.3 into the transport layer, reducing connection establishment from TCP's 1-3 RTT (depending on TLS version) to 0-1 RTT. Connection migration is supported — when a client changes IP address (e.g., switching from Wi-Fi to cellular), the QUIC connection persists using a connection ID rather than the IP 4-tuple.`,
  },
];

async function main() {
  try {
    console.log(`🌱 Seeding reference materials for "${COURSE_NAME}"...`);

    // Resolve course
    const [course] = await db
      .select({ id: courses.id, instructorId: courses.instructorId })
      .from(courses)
      .where(eq(courses.name, COURSE_NAME))
      .limit(1);

    if (!course) {
      throw new Error(`Course "${COURSE_NAME}" not found. Run course seed first.`);
    }

    console.log(`📚 Course ID: ${course.id}`);

    // Clear existing materials for this course only (cascade deletes chunks)
    console.log(`🧹 Clearing existing materials for course ${course.id}...`);
    await db
      .delete(courseMaterials)
      .where(eq(courseMaterials.courseId, course.id));

    // Insert materials and their chunks
    for (const data of MATERIALS) {
      const [material] = await db
        .insert(courseMaterials)
        .values({
          courseId: course.id,
          title: data.title,
          content: data.content,
          uploadedBy: course.instructorId,
        })
        .returning({ id: courseMaterials.id });

      // Chunk the content
      const chunks = chunkText(data.content);

      // Embed all chunks via Voyage AI
      console.log(
        `  🔄 [${material.id}] ${data.title} — ${data.content.length} chars → ${chunks.length} chunks, embedding...`
      );
      const embeddings = await embedBatch(chunks);

      // Insert chunks with embeddings
      await db.insert(materialChunks).values(
        chunks.map((text, i) => ({
          materialId: material.id,
          chunkIndex: i,
          content: text,
          embedding: embeddings[i],
        }))
      );

      console.log(
        `  ✅ [${material.id}] ${data.title} — ${chunks.length} chunks embedded`
      );
    }

    console.log(
      `\n✅ Seeded ${MATERIALS.length} reference materials for "${COURSE_NAME}" with embeddings.`
    );
  } catch (err) {
    console.error("💥 Seed failed:", err);
    process.exit(1);
  }
}

void main();
