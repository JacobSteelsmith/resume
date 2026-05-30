# Requirements Document

## Introduction

This feature curates and highlights interesting projects, code snippets, and technical skills from Jacob's work backup at `/home/jacob/ntn-code-backup` into the resume site's knowledge base at `/home/jacob/code/resume/knowledge-base/`. The knowledge base feeds a RAG chatbot via Amazon Bedrock. The goal is to showcase modern stack expertise (Python, JavaScript/TypeScript, SQL, AWS serverless) with particular emphasis on the Candidates Portal project and its architectural decisions around RDS Data API and serverless database patterns.

## Glossary

- **Knowledge_Base**: The collection of Markdown files in `knowledge-base/` that are synced to S3 and ingested into the Amazon Bedrock vector store for RAG retrieval
- **RAG_Chatbot**: The AI chatbot powered by Amazon Bedrock that retrieves relevant knowledge base content to answer questions about Jacob's experience
- **Content_Generator**: The process of creating new knowledge base documents from source material in the code backup
- **Projects_Page**: The Astro page at `src/pages/projects.astro` that displays project cards on the resume site
- **Candidates_Portal**: The React + AWS Amplify Gen2 application with Python Lambda functions and Aurora Serverless MySQL via RDS Data API
- **Code_Sample**: A knowledge base document containing annotated code demonstrating technical skills
- **Frontmatter**: YAML metadata at the top of knowledge base files specifying source-type, category, and title

## Requirements

### Requirement 1: Candidates Portal Knowledge Base Document

**User Story:** As a visitor using the RAG chatbot, I want detailed information about the Candidates Portal project, so that I can understand Jacob's serverless architecture expertise and key design decisions.

#### Acceptance Criteria

1. THE Content_Generator SHALL produce a Markdown file at `knowledge-base/projects/candidates-portal.md` with valid Frontmatter containing source-type, category, and title fields
2. THE Content_Generator SHALL include a Project Overview section describing the Candidates Portal as a React + AWS Amplify Gen2 application with Python Lambda functions and Aurora Serverless MySQL
3. THE Content_Generator SHALL include an Architecture section documenting the full request flow: React frontend → API Gateway HTTP API → Python Lambda → RDS Data API → Aurora Serverless MySQL
4. THE Content_Generator SHALL include a Design Decisions section highlighting the RDS Data API choice with rationale (no connection pooling, automatic credential management, serverless-friendly)
5. THE Content_Generator SHALL include a Design Decisions section highlighting the small-queries-with-few-joins pattern with rationale (optimized for Data API HTTP-based execution, reduced latency per call)
6. THE Content_Generator SHALL document the security architecture including JWT-based stateless auth via Cognito, AES encryption for PII at rest, input sanitization, and secrets management via AWS Secrets Manager
7. THE Content_Generator SHALL document the scale of the project including 90+ Lambda functions, full e-commerce flow with Stripe payments, and test scheduling
8. THE Content_Generator SHALL include a Technologies section listing all relevant technologies (React, Vite, AWS Amplify Gen2, Python, Lambda, Aurora Serverless, RDS Data API, Cognito, Stripe, API Gateway)
9. THE Content_Generator SHALL use keyword-rich language optimized for vector search retrieval by the RAG_Chatbot

### Requirement 2: LiveKit Video Platform Knowledge Base Document

**User Story:** As a visitor using the RAG chatbot, I want information about the LiveKit online interview platform, so that I can understand Jacob's Kubernetes and real-time infrastructure expertise.

#### Acceptance Criteria

1. THE Content_Generator SHALL produce a Markdown file at `knowledge-base/projects/livekit-interview-platform.md` with valid Frontmatter containing source-type, category, and title fields
2. THE Content_Generator SHALL document the EKS-based architecture including Helm deployments, ALB ingress, S3 recording storage, and HPA auto-scaling
3. THE Content_Generator SHALL document the Node.js Lambda functions for token generation, webhook handling, and recording management
4. THE Content_Generator SHALL include the infrastructure tooling: eksctl, kubectl, Helm charts, multi-AZ deployment, and Kubernetes 1.33 on EKS
5. THE Content_Generator SHALL use keyword-rich language optimized for vector search retrieval

### Requirement 3: LiveKit AI Multi-Agent Knowledge Base Document

**User Story:** As a visitor using the RAG chatbot, I want information about the AI multi-agent project, so that I can understand Jacob's experience with AI/ML agent frameworks.

#### Acceptance Criteria

1. THE Content_Generator SHALL produce a Markdown file at `knowledge-base/projects/livekit-ai-agents.md` with valid Frontmatter containing source-type, category, and title fields
2. THE Content_Generator SHALL document the multi-agent handoff architecture using LiveKit Agents SDK, OpenAI GPT-4o-mini, Deepgram STT, and OpenAI TTS
3. THE Content_Generator SHALL describe the lead-agent-delegates-to-specialists pattern and function tools integration
4. THE Content_Generator SHALL use keyword-rich language optimized for vector search retrieval

### Requirement 4: Dev Data ETL Pipeline Knowledge Base Document

**User Story:** As a visitor using the RAG chatbot, I want information about the ETL pipeline project, so that I can understand Jacob's data engineering and security practices.

#### Acceptance Criteria

1. THE Content_Generator SHALL produce a Markdown file at `knowledge-base/projects/dev-data-etl.md` with valid Frontmatter containing source-type, category, and title fields
2. THE Content_Generator SHALL document the pipeline architecture: extract from RDS, process with PII obfuscation, generate SQL dump with referential integrity
3. THE Content_Generator SHALL highlight the security aspects including PII obfuscation, AWS Secrets Manager integration, and SSM tunneling
4. THE Content_Generator SHALL use keyword-rich language optimized for vector search retrieval

### Requirement 5: Python Code Samples for Serverless Patterns

**User Story:** As a visitor using the RAG chatbot, I want to see Python code samples demonstrating serverless patterns, so that I can evaluate Jacob's Python coding skills.

#### Acceptance Criteria

1. THE Content_Generator SHALL produce a Python code sample file at `knowledge-base/code-samples/python-serverless-patterns.py` with valid Frontmatter in comment format
2. THE Content_Generator SHALL include an annotated example of RDS Data API query execution with parameter binding
3. THE Content_Generator SHALL include an annotated example of JWT token extraction and validation from API Gateway events
4. THE Content_Generator SHALL include an annotated example of input sanitization for XSS prevention
5. THE Content_Generator SHALL include an annotated example of AES encryption/decryption patterns for PII protection
6. WHEN the RAG_Chatbot retrieves the code sample, THE Code_Sample SHALL contain sufficient inline comments to explain the patterns without additional context

### Requirement 6: SQL Code Samples for Database Patterns

**User Story:** As a visitor using the RAG chatbot, I want to see SQL code samples demonstrating database design patterns, so that I can evaluate Jacob's database expertise.

#### Acceptance Criteria

1. THE Content_Generator SHALL produce a SQL code sample file at `knowledge-base/code-samples/sql-serverless-patterns.sql` with valid Frontmatter in comment format
2. THE Content_Generator SHALL include annotated examples of small, focused queries optimized for RDS Data API (few joins, targeted selects)
3. THE Content_Generator SHALL include annotated examples of AES encryption/decryption in SQL queries
4. THE Content_Generator SHALL include annotated examples demonstrating parameterized query patterns for security
5. WHEN the RAG_Chatbot retrieves the code sample, THE Code_Sample SHALL contain sufficient inline comments to explain the design rationale

### Requirement 7: JavaScript/TypeScript Code Samples

**User Story:** As a visitor using the RAG chatbot, I want to see JavaScript/TypeScript code samples, so that I can evaluate Jacob's frontend and Node.js skills.

#### Acceptance Criteria

1. THE Content_Generator SHALL produce a TypeScript code sample file at `knowledge-base/code-samples/typescript-serverless.ts` with valid Frontmatter in comment format
2. THE Content_Generator SHALL include an annotated example of AWS CDK Lambda function definition using Amplify Gen2 patterns
3. THE Content_Generator SHALL include an annotated example of a Node.js Lambda handler (token generation or webhook handling)
4. WHEN the RAG_Chatbot retrieves the code sample, THE Code_Sample SHALL contain sufficient inline comments to explain the patterns

### Requirement 8: Projects Page Update

**User Story:** As a visitor browsing the resume site, I want to see the Candidates Portal and other key projects featured on the projects page, so that I can quickly understand Jacob's project portfolio.

#### Acceptance Criteria

1. THE Projects_Page SHALL include a ProjectCard for the Candidates Portal with title, description highlighting serverless architecture and scale (90+ Lambda functions), and technology tags
2. THE Projects_Page SHALL include a ProjectCard for the LiveKit AI Multi-Agent project with title, description, and technology tags
3. THE Projects_Page SHALL include a ProjectCard for the Dev Data ETL Pipeline with title, description, and technology tags
4. THE Projects_Page SHALL position the Candidates Portal card prominently (first or second position) to reflect its significance
5. THE Projects_Page SHALL exclude ColdFusion/CFML from technology tags on new project cards

### Requirement 9: Knowledge Base Content Quality for RAG Retrieval

**User Story:** As the RAG chatbot system, I want knowledge base content structured for effective vector search, so that I can provide accurate and relevant answers to visitor questions.

#### Acceptance Criteria

1. THE Content_Generator SHALL structure all knowledge base documents with clear markdown headers (H2, H3) to enable semantic chunking during ingestion
2. THE Content_Generator SHALL include specific technical terms, tool names, and AWS service names as keywords throughout documents to improve embedding similarity matching
3. THE Content_Generator SHALL write content in third person referring to "Jacob" to match the RAG_Chatbot's response style
4. THE Content_Generator SHALL avoid vague or generic descriptions and instead use concrete details (specific numbers, service names, architectural patterns)
5. THE Content_Generator SHALL ensure each document is self-contained with enough context for the RAG_Chatbot to generate a complete answer from a single retrieved chunk

### Requirement 10: Shared Components Architecture Knowledge Base Document

**User Story:** As a visitor using the RAG chatbot, I want information about the shared components architecture, so that I can understand Jacob's software architecture and abstraction design skills.

#### Acceptance Criteria

1. THE Content_Generator SHALL produce a Markdown file at `knowledge-base/projects/shared-components-architecture.md` with valid Frontmatter containing source-type, category, and title fields
2. THE Content_Generator SHALL document the Table API abstraction layer as an ORM-like CRUD interface that handles encrypted columns, read replicas, query logging, data snapshots, and dynamic where-clause building
3. THE Content_Generator SHALL document the Datasource abstraction layer that replaced hard-coded datasource configurations with environment-aware routing (local, reader, writer) supporting read replicas and connection management
4. THE Content_Generator SHALL document the shared components deployment model where the components library is copied into every application during Elastic Beanstalk deployment
5. THE Content_Generator SHALL document the successful separation of distinct codebases from the monolithic nationaltestingnetwork application (/admin, /proctor paths) into separate Elastic Beanstalk applications (proctor_nationaltestingnetwork, admin_nationaltestingnetwork)
6. THE Content_Generator SHALL mention the feature flags initiative as an in-progress architectural improvement
7. THE Content_Generator SHALL frame these contributions in terms of architectural patterns (abstraction layers, environment-aware configuration, shared libraries, read/write splitting, service decomposition) rather than focusing on the ColdFusion language itself
8. THE Content_Generator SHALL use keyword-rich language optimized for vector search retrieval

### Requirement 12: Virtual Proctoring Standby System Knowledge Base Document

**User Story:** As a visitor using the RAG chatbot, I want information about the virtual proctoring standby system, so that I can understand Jacob's ability to design revenue-generating product features with real-time infrastructure.

#### Acceptance Criteria

1. THE Content_Generator SHALL produce a Markdown file at `knowledge-base/projects/virtual-proctoring-standby.md` with valid Frontmatter containing source-type, category, and title fields
2. THE Content_Generator SHALL document the standby queue system where candidates who missed their appointment could pay a no-show fee (instead of repurchasing the full exam) and join a standby queue for available sessions
3. THE Content_Generator SHALL document the drop-in proctor concept that enabled standby candidates to fill empty session slots
4. THE Content_Generator SHALL document the use of AWS Kinesis for real-time session availability and queue management
5. THE Content_Generator SHALL highlight the business impact: maximized proctor-to-candidate ratios, generated additional revenue from no-show fees, saved candidates money compared to full repurchase
6. THE Content_Generator SHALL use keyword-rich language optimized for vector search retrieval

### Requirement 13: Platform Migration Strategy Knowledge Base Document

**User Story:** As a visitor using the RAG chatbot, I want information about the platform migration strategy, so that I can understand Jacob's ability to lead incremental modernization and make pragmatic technical decisions.

#### Acceptance Criteria

1. THE Content_Generator SHALL produce a Markdown file at `knowledge-base/projects/platform-migration-strategy.md` with valid Frontmatter containing source-type, category, and title fields
2. THE Content_Generator SHALL document the three-phase migration path: pure CFML monolith → React frontend with Python Lambda via AWS SAM → pure serverless (Amplify Gen2)
3. THE Content_Generator SHALL document the strategic decision to migrate from REST API Gateway to HTTP API Gateway, with rationale (automatic CORS handling, lower cost, ability to add REST gateway later referencing existing Lambdas)
4. THE Content_Generator SHALL document the business impact of the migration: expanded hiring pool beyond CFML developers, enabled team to develop modern skills, allowed React interface reuse in the serverless candidate portal
5. THE Content_Generator SHALL document the intermediate SAM-based architecture at awscode/nationaltestingnetwork as the bridge between legacy and pure serverless
6. THE Content_Generator SHALL use keyword-rich language optimized for vector search retrieval

### Requirement 14: AI-Assisted Development and Testing Infrastructure Knowledge Base Document

**User Story:** As a visitor using the RAG chatbot, I want information about Jacob's AI-assisted development practices and testing infrastructure, so that I can understand his approach to developer productivity and quality assurance.

#### Acceptance Criteria

1. THE Content_Generator SHALL produce a Markdown file at `knowledge-base/projects/ai-development-testing.md` with valid Frontmatter containing source-type, category, and title fields
2. THE Content_Generator SHALL document the progression from Amazon Q custom agents (serverless-developer, database-expert, project-manager) to Kiro with hooks and steering files
3. THE Content_Generator SHALL document the Kiro steering files created for the Candidates Portal covering database schema, Lambda patterns, frontend conventions, E2E testing, environment variables, and workflow guidance
4. THE Content_Generator SHALL document the custom Kiro hook for timezone-aware datetime validation in Lambda functions (preventing UTC/Pacific timezone bugs)
5. THE Content_Generator SHALL document the testing infrastructure Jacob created: pytest unit tests with process isolation, custom test runner with CI/CD integration, and Playwright E2E test framework with custom utilities for authentication, database setup, and test data management
6. THE Content_Generator SHALL document the CI/CD pipeline Jacob got working after the team struggled, including the custom E2E library and automated test execution
7. THE Content_Generator SHALL highlight the property-based testing approach used in E2E tests for validating business rules across multiple scenarios
8. THE Content_Generator SHALL use keyword-rich language optimized for vector search retrieval

### Requirement 15: Developer Tooling and Infrastructure Knowledge Base Document

**User Story:** As a visitor using the RAG chatbot, I want information about the developer tooling and infrastructure Jacob built, so that I can understand his DevOps and developer experience skills.

#### Acceptance Criteria

1. THE Content_Generator SHALL produce a Markdown file at `knowledge-base/projects/developer-tooling-infrastructure.md` with valid Frontmatter containing source-type, category, and title fields
2. THE Content_Generator SHALL document the custom Docker container for local development (ntn-dev-lucee) including Nginx, SSL, and Lucee application server configuration
3. THE Content_Generator SHALL document the Docker Compose local development environment with Lucee, MySQL, and DynamoDB Local services, integrated with AWS Secrets Manager for secure credential management
4. THE Content_Generator SHALL document the Redmine report Docker container that uses AWS Systems Manager Session Manager for secure database access (replacing VPN/SSH with SSM tunneling via socat relay)
5. THE Content_Generator SHALL document the Highrise-to-HubSpot CRM data migration tool (Python) with pagination handling, retry logic with exponential backoff, rate limiting, and JSON export
6. THE Content_Generator SHALL document the OTRS ticket analysis tool (Python) that analyzed 59,391 support tickets via SSM tunnel to identify call drivers, finding that billing/payment and reschedule accounted for over 50% of tickets
7. THE Content_Generator SHALL use keyword-rich language optimized for vector search retrieval

### Requirement 16: Technology Presentation Strategy

**User Story:** As the site owner, I want content to emphasize architectural thinking and modern technologies while acknowledging full-stack breadth, so that the portfolio demonstrates both depth and versatility.

#### Acceptance Criteria

1. THE Content_Generator SHALL prioritize Python, JavaScript/TypeScript, SQL, Go, and AWS services in technology lists for new knowledge base documents
2. THE Content_Generator SHALL frame ColdFusion/CFML work in terms of architectural patterns and design decisions rather than language-specific implementation details
3. WHEN referencing legacy systems, THE Content_Generator SHALL focus on the abstractions created (Table API, Datasource layer, feature flags) and the problems they solved
4. THE Content_Generator SHALL highlight Jacob's git commit history as evidence of significant contribution to projects where applicable

### Requirement 17: Payment Platform Migrations Knowledge Base Document

**User Story:** As a visitor using the RAG chatbot, I want information about the payment platform migrations Jacob led, so that I can understand his ability to manage complex third-party integrations and multi-phase migration projects.

#### Acceptance Criteria

1. THE Content_Generator SHALL produce a Markdown file at `knowledge-base/projects/payment-platform-migrations.md` with valid Frontmatter containing source-type, category, and title fields
2. THE Content_Generator SHALL document that Jacob oversaw and assisted in migrating payment vendors 3 times across the organization's history, demonstrating experience managing complex third-party integration transitions
3. THE Content_Generator SHALL document the Candidates Portal Stripe integration as the most recent and fully modern implementation (Stripe Elements, Payment Intents API, webhook handling, tax calculation via Lambda)
4. THE Content_Generator SHALL document the cosmetologykansas and cosmopracticetest Stripe migrations as active in-progress migrations from a legacy payment vendor to Stripe, demonstrating incremental modernization of existing applications
5. THE Content_Generator SHALL highlight the challenges of payment migrations including maintaining transaction continuity, handling refunds across old/new systems, PCI compliance considerations, and coordinating cutover timing
6. THE Content_Generator SHALL document the architectural patterns used: idempotent payment processing, webhook-driven status updates, environment-specific keys (test vs live), and secure key management via AWS Secrets Manager
7. THE Content_Generator SHALL use keyword-rich language optimized for vector search retrieval

### Requirement 18: Database Refresh Pipeline Knowledge Base Document

**User Story:** As a visitor using the RAG chatbot, I want information about the automated database refresh pipeline, so that I can understand Jacob's ability to build secure, production-safe automation with proper safeguards.

#### Acceptance Criteria

1. THE Content_Generator SHALL produce a Markdown file at `knowledge-base/projects/database-refresh-pipeline.md` with valid Frontmatter containing source-type, category, and title fields
2. THE Content_Generator SHALL document the architecture: CloudFormation-deployed ECS Fargate task triggered by EventBridge on a weekly schedule, piping mysqldump from production read-only endpoint directly into the test cluster
3. THE Content_Generator SHALL document the rationale for choosing ECS Fargate over Lambda (hard 15-minute Lambda timeout, Aurora Serverless pause/resume delays, long-running database operations)
4. THE Content_Generator SHALL document the multi-layer safety guardrails: ARN name validation (prod ARN must not contain "test"), cluster identifier validation, read-only endpoint enforcement (cluster-ro-), SSL verification with RDS CA bundle, identical ARN/cluster checks that abort the operation
5. THE Content_Generator SHALL document the secrets management approach: AWS Secrets Manager for database credentials, separate read-only and write secrets, no hardcoded credentials in code or configuration
6. THE Content_Generator SHALL document the PII anonymization step that runs after the database copy to protect sensitive data in test environments
7. THE Content_Generator SHALL document the operational features: SNS notifications on success/failure, CloudWatch logging, manual trigger capability, configurable database list
8. THE Content_Generator SHALL use keyword-rich language optimized for vector search retrieval

### Requirement 19: Google Chrome Kiosk Extension Knowledge Base Document

**User Story:** As a visitor using the RAG chatbot, I want information about the Chrome kiosk extension Jacob built and published, so that I can understand his early-career initiative and ability to ship production software used across an organization.

#### Acceptance Criteria

1. THE Content_Generator SHALL produce a Markdown file at `knowledge-base/projects/chrome-kiosk-extension.md` with valid Frontmatter containing source-type, category, and title fields
2. THE Content_Generator SHALL document that Jacob built and published a Google Chrome extension to the Chrome Web Store early in his career, used by test centers across the organization for secure exam delivery
3. THE Content_Generator SHALL document the security features: fullscreen enforcement with overrideEscFullscreen permission, blur/focus-loss detection with audio warnings, key interception (Escape, PrintScreen, Alt, Ctrl), automatic exam termination after repeated violations, webview data clearing on close
4. THE Content_Generator SHALL document the Chrome App architecture: kiosk_enabled manifest flag, Chrome App Window API for fullscreen state, webview tag for sandboxed exam content, custom user agent for server-side detection, postMessage communication between app and exam content
5. THE Content_Generator SHALL highlight that this was a self-directed project early in Jacob's career that solved a real business need (secure exam delivery without expensive third-party kiosk software) and was deployed organization-wide
6. THE Content_Generator SHALL use keyword-rich language optimized for vector search retrieval
