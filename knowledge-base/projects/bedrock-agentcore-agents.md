# Amazon Bedrock AgentCore Agents - Harness, Confluence, and Microsoft Teams Integration

## Project Overview

Jacob designed and built a production agentic AI platform on Amazon Bedrock AgentCore within a large corporate enterprise environment, deploying LLM-powered agents that answer engineering and operational questions by retrieving knowledge from Confluence and delivering responses directly inside Microsoft Teams. The platform served engineering and operations teams across the organization, integrating with the company's existing enterprise Confluence and Microsoft 365 (Teams) tenants. The system is built around AgentCore's managed runtime and harness, with the harness serving as the agent's execution and testing layer that wires the model to tools, memory, and downstream integrations. Confluence functions as the primary knowledge source through an AgentCore Gateway target, and Microsoft Teams is the conversational front end where users interact with the agents.

Jacob built this platform to consolidate scattered institutional knowledge — runbooks, architecture decisions, onboarding guides, and troubleshooting notes living across many Confluence spaces in a large corporate environment — into a single conversational interface that engineers already use daily in Teams. The agents run on AgentCore Runtime with session isolation, persistent memory, and built-in observability, eliminating the need to manage agent-hosting infrastructure directly.

## Architecture

### AgentCore Runtime and Harness

The core of the platform is the AgentCore Harness, which Jacob implemented as the agent's execution wrapper. The harness defines the agent's model configuration, system prompt, available tools, and the control loop that orchestrates model calls, tool invocations, and memory reads/writes. Jacob used the harness both as the production runtime entrypoint and as a local test rig, allowing agents to be exercised deterministically against recorded inputs before deployment.

Key runtime components:

- **AgentCore Runtime** — Serverless, session-isolated execution environment hosting the agent containers with per-session isolation, so concurrent Teams conversations never share state
- **AgentCore Harness** — Jacob's agent implementation layer defining the model, prompt, tool bindings, and orchestration loop; runs identically in local test mode and in deployed Runtime
- **AgentCore Memory** — Persistent conversation state so multi-turn Teams threads retain context across messages
- **AgentCore Identity** — OAuth2-based authorization so agents securely call Confluence and Microsoft Graph on behalf of the requesting user or as the agent itself
- **AgentCore Gateway** — Converts Confluence and internal APIs into agent-callable tools with managed authentication
- **AgentCore Observability** — Built-in metrics and traces surfaced to Amazon CloudWatch for latency, tool-call success, and token usage

### Harness Implementation

Jacob implemented the harness as the single source of truth for agent behavior. The harness:

- Loads the model and inference configuration (foundation model on Bedrock, temperature, token limits)
- Registers tools — the Confluence retrieval tool exposed via AgentCore Gateway, plus inline utility functions
- Defines the system prompt and guardrails that constrain the agent to knowledge-grounded, cited answers
- Runs the orchestration loop: receive user turn → retrieve relevant Confluence context → call the model → optionally invoke tools → persist to Memory → return the response
- Exposes a local test entrypoint that replays fixture conversations, so Jacob validates prompt and tool changes without deploying

Because the same harness code runs in local test mode and in AgentCore Runtime, behavior verified during development matches production, reducing prompt-regression risk between iterations.

### Confluence Integration (Knowledge Source)

Confluence is the agents' primary knowledge base. Jacob integrated it as a retrieval tool exposed through AgentCore Gateway:

- **Gateway target** — The Confluence REST API is registered as a Gateway target, giving the agent a managed, authenticated tool for searching and fetching page content
- **Authenticated access** — AgentCore Identity handles OAuth2 credentials and token vaulting, so no long-lived Confluence tokens live in the agent code
- **Scoped retrieval** — The agent queries specific Confluence spaces relevant to engineering and operations, using CQL (Confluence Query Language) search to find candidate pages, then fetches and passes page bodies as grounding context
- **Citation of sources** — Retrieved pages are returned with their Confluence URLs so agent answers cite the originating documentation, letting users verify and drill into the full page

### Microsoft Teams Integration (Delivery Channel)

Microsoft Teams is the conversational interface. Jacob built the Teams integration so users invoke the agents naturally from chat:

- **Teams bot front end** — Users message the bot (or @mention it in a channel/thread); incoming activities are received via the Bot Framework and forwarded to the AgentCore Runtime endpoint
- **Microsoft Graph via Identity** — AgentCore Identity manages the Microsoft OAuth2 flow, letting the agent act on behalf of the requesting user where appropriate
- **Threaded, multi-turn conversations** — AgentCore Memory keyed on the Teams conversation/thread ID preserves context across turns, so follow-up questions resolve against prior messages
- **Rich responses** — Answers render as Teams messages with formatting and source links back to the originating Confluence pages
- **Async handling** — Longer retrieval-and-reason turns use typing indicators and asynchronous replies to stay within Teams responsiveness expectations

### End-to-End Request Flow

1. A user asks a question by messaging the bot in Microsoft Teams
2. The Teams bot forwards the activity to the AgentCore Runtime endpoint hosting the harness
3. AgentCore Identity authorizes the request and provides scoped credentials for downstream tools
4. The harness loads conversation context from AgentCore Memory (keyed by Teams thread)
5. The agent calls the Confluence retrieval tool via AgentCore Gateway to find and fetch relevant pages
6. The model reasons over the retrieved context and produces a grounded, cited answer
7. The turn is persisted to Memory and the response is returned to Teams with source links
8. AgentCore Observability emits traces and metrics to CloudWatch for the full turn

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Agent platform | Amazon Bedrock AgentCore | Managed runtime with session isolation, memory, identity, and observability removes the need to build and operate agent-hosting infrastructure |
| Execution layer | AgentCore Harness | A single harness that runs identically in local test mode and production Runtime keeps verified behavior consistent and enables deterministic prompt/tool testing |
| Tool connectivity | AgentCore Gateway | Turns Confluence and internal APIs into authenticated, agent-callable tools without hand-rolling auth per integration |
| Auth model | AgentCore Identity (OAuth2) | Vaulted tokens and on-behalf-of authorization avoid long-lived secrets for Confluence and Microsoft Graph |
| Knowledge source | Confluence | Institutional knowledge already lives in Confluence; retrieval-grounded answers with citations keep responses trustworthy and verifiable |
| Delivery channel | Microsoft Teams | Meets engineers where they already work; no new tool to adopt |
| Conversation state | AgentCore Memory keyed on Teams thread | Preserves multi-turn context per conversation while keeping sessions isolated |
| Observability | AgentCore Observability → CloudWatch | Built-in traces and metrics give production visibility into latency, tool success, and token cost without custom instrumentation |

## Operational Features

- **Grounded, cited answers** — Every response links back to the Confluence pages used as context, so users can verify sources
- **Session isolation** — Concurrent Teams conversations run in isolated AgentCore Runtime sessions with no shared state
- **Persistent memory** — Multi-turn threads retain context across messages
- **Deterministic testing** — The harness's local test mode replays fixture conversations to validate prompt and tool changes before deployment
- **Production observability** — CloudWatch dashboards and traces from AgentCore Observability track latency, tool-call success rates, and token usage per agent

## Technologies

- Amazon Bedrock AgentCore (Runtime, Harness, Memory, Identity, Gateway, Observability)
- Amazon Bedrock foundation models, Retrieval-Augmented Generation (RAG)
- Confluence REST API, Confluence Query Language (CQL)
- Microsoft Teams, Bot Framework, Microsoft Graph API
- OAuth2 authorization, token vaulting
- Amazon CloudWatch (agent metrics, traces, dashboards)
- Python, asynchronous request handling
- Infrastructure as Code (agent and integration provisioning)
