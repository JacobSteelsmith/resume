# Virtual Proctoring Standby Queue System

## Project Overview

Jacob designed and built a virtual proctoring standby queue system that solved a critical business problem: maximizing proctor utilization while recovering revenue from candidate no-shows. The system introduced a standby queue where candidates who missed their scheduled exam appointment could pay a reduced no-show fee (instead of repurchasing the full exam) and join a first-come-first-served queue for available session slots. This real-time infrastructure project combined queue management, WebRTC video streaming via AWS Kinesis Video Streams, and a drop-in proctor workflow to fill empty exam slots dynamically.

## Standby Queue Architecture

### No-Show Fee and Queue Entry

When a candidate was marked as a no-show for their scheduled virtual exam, the system presented them with an option to enter the standby queue by paying a no-show fee. This fee was significantly less than repurchasing a full exam registration, creating a win-win: the organization recovered partial revenue from missed appointments while candidates saved money compared to a full repurchase. Administrators could waive the standby fee in special circumstances through an admin interface with audit logging.

### Queue Management System

The standby queue operated on a per-session basis, tracking candidates by their scheduled exam session. Key queue behaviors included:

- **First-come-first-served ordering** — candidates who logged in earliest received priority placement
- **Real-time position tracking** — candidates saw their queue position and number of people ahead of them
- **Automatic polling** — the system refreshed queue status every 10 seconds to detect when slots opened
- **Requeue capability** — proctors could requeue candidates back into the standby pool if needed
- **Session-scoped queues** — each exam session maintained its own independent standby queue

### Candidate Standby Flow

1. Candidate marked as no-show after missing scheduled appointment
2. Candidate pays the no-show fee through the payment system
3. Candidate schedules into an available standby session
4. Candidate logs in at least 30 minutes before the session start time
5. System places candidate in the standby queue ordered by arrival time
6. When a slot opens, the first candidate in queue is connected to the check-in proctor
7. After identity verification, the candidate is referred to a drop-in proctor to begin their exam

## Drop-In Proctor Concept

Jacob designed the drop-in proctor role as a specialized proctor workflow optimized for standby candidates. Unlike standard proctors who managed a full session of pre-scheduled candidates, drop-in proctors handled one standby candidate at a time from the queue.

### Drop-In Proctor Workflow

The drop-in proctor interface provided:

- **Real-time standby queue visibility** — proctors saw the current queue of waiting candidates with names displayed
- **WebRTC video connection** — bidirectional video and audio streaming between proctor and candidate using AWS Kinesis Video Streams signaling channels
- **Candidate controls** — start drop-in exam, requeue candidate, view candidate ID documents
- **Security monitoring** — real-time alerts for print screen detection, exam blur (candidate leaving the exam window), restricted application detection, and secondary monitor detection
- **Connection management** — automatic reconnection handling, volume metering, and mute/pause controls

### Proctor-to-Candidate Matching

When the check-in proctor confirmed a standby candidate's identity and readiness, the system referred the candidate to an available drop-in proctor. This referral process used server-side session management to route the candidate to the correct proctor's WebRTC signaling channel, enabling seamless handoff between the check-in and exam proctoring stages.

## Real-Time Infrastructure with AWS Kinesis Video Streams

### WebRTC Signaling via Kinesis Video Streams

The standby system leveraged AWS Kinesis Video Streams WebRTC signaling channels for real-time communication between proctors and candidates. Each exam session created a dedicated signaling channel identified by the session ID.

Key technical components:

- **KVS Signaling Client** — WebSocket-based signaling for SDP offer/answer exchange and ICE candidate negotiation
- **STUN/TURN servers** — ICE server configuration from Kinesis Video Streams for NAT traversal
- **Peer-to-peer connections** — RTCPeerConnection with both webcam video and screen share tracks
- **Data channels** — bidirectional messaging for proctor commands (mute, pause, reload) and candidate status updates
- **Automatic reconnection** — signaling client reconnected immediately on disconnection to maintain session continuity

### Real-Time Session Availability

The system tracked session availability in real-time through:

- **Proctor sign-in detection** — the system recorded when proctors signed into their standby sessions, triggering candidate queue processing
- **Polling-based queue advancement** — candidates' browsers polled every 10 seconds to detect when they reached the front of the queue and a proctor was available
- **Connection state monitoring** — ICE connection state changes triggered automatic cleanup and candidate slot release when connections dropped

## Business Impact

### Revenue Optimization

- **No-show fee revenue** — generated additional income from candidates who would otherwise represent pure loss (empty exam slots with no payment)
- **Reduced full-repurchase friction** — candidates who missed appointments were more likely to pay a smaller standby fee than repurchase an entirely new exam, increasing overall conversion
- **Maximized proctor utilization** — standby candidates filled slots that would otherwise go empty, improving the proctor-to-candidate ratio and reducing per-exam operational cost

### Candidate Experience

- **Cost savings for candidates** — standby fee was significantly less than purchasing a new exam registration
- **Faster rescheduling** — candidates could attempt to test the same day rather than waiting for the next available scheduled session
- **Transparent queue position** — real-time visibility into queue status reduced uncertainty and frustration

### Operational Efficiency

- **Maximized proctor-to-candidate ratios** — every no-show slot could be filled by a standby candidate, ensuring proctors were never idle during sessions with available capacity
- **Drop-in proctor specialization** — dedicated standby proctors handled queue candidates without disrupting standard session flow
- **Automated queue management** — first-come-first-served ordering and automatic advancement eliminated manual scheduling overhead

## Technologies

- AWS Kinesis Video Streams (WebRTC signaling channels, STUN/TURN, ICE negotiation)
- WebRTC (RTCPeerConnection, SDP offer/answer, data channels, screen sharing)
- JavaScript (real-time client-side queue management, video streaming)
- Server-side queue management (session-scoped queues, position tracking, candidate routing)
- Real-time polling architecture (10-second intervals for queue status and proctor availability)
- Payment integration (no-show fee processing, fee waiver workflow)
