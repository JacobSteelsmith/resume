# Implementation Plan: Portfolio Project Highlights

## Overview

This plan implements the portfolio project highlights feature by: (1) updating the ingest pipeline to support `.sql` files, (2) creating 12 knowledge base project documents, (3) creating 3 code sample files, (4) updating the projects page with new ProjectCards, and (5) writing property-based and unit tests to validate content quality. Each task builds incrementally on the previous steps.

## Tasks

- [x] 1. Update ingest pipeline for SQL file support
  - [x] 1.1 Add `.sql` extension support and `--` comment prefix parsing to `scripts/ingest.ts`
    - Add `.sql` to the code file extensions array in `parseFile`
    - Update `parseCodeFrontmatter` to detect and strip `-- ` comment prefix (in addition to existing `// ` and `# ` prefixes)
    - The SQL frontmatter format uses `-- ---` as delimiters and `-- key: value` for metadata lines
    - _Requirements: 6.1, Design: Ingestion Pipeline Compatibility section_

  - [x]* 1.2 Write unit tests for SQL frontmatter parsing
    - Add test cases to `tests/unit/ingest.test.ts` for `.sql` file parsing
    - Test valid SQL frontmatter with `-- ---` delimiters parses correctly
    - Test missing frontmatter returns null
    - Test empty SQL file returns null
    - _Requirements: 6.1, Design: Ingestion Pipeline Compatibility_

- [x] 2. Create knowledge base project documents (core projects)
  - [x] 2.1 Create `knowledge-base/projects/candidates-portal.md`
    - Include frontmatter: source-type: project, category: serverless-architecture, title
    - Include sections: Project Overview, Architecture (React → API Gateway → Lambda → RDS Data API → Aurora), Design Decisions (RDS Data API rationale, small-queries pattern), Security Architecture (JWT/Cognito, AES encryption, input sanitization, Secrets Manager), Scale (90+ Lambdas, Stripe, test scheduling), Technologies
    - Write in third person, keyword-rich, self-contained chunks
    - _Requirements: 1.1–1.9, 9.1–9.5, 16.1_

  - [x] 2.2 Create `knowledge-base/projects/livekit-interview-platform.md`
    - Include frontmatter: source-type: project, category: real-time-infrastructure, title
    - Document EKS architecture, Helm deployments, ALB ingress, S3 recording, HPA auto-scaling
    - Document Node.js Lambda functions for token generation, webhooks, recording management
    - Include infrastructure tooling: eksctl, kubectl, Helm, multi-AZ, Kubernetes 1.33
    - _Requirements: 2.1–2.5, 9.1–9.5, 16.1_

  - [x] 2.3 Create `knowledge-base/projects/livekit-ai-agents.md`
    - Include frontmatter: source-type: project, category: ai-ml, title
    - Document multi-agent handoff architecture: LiveKit Agents SDK, GPT-4o-mini, Deepgram STT, OpenAI TTS
    - Describe lead-agent-delegates-to-specialists pattern and function tools
    - _Requirements: 3.1–3.4, 9.1–9.5, 16.1_

  - [x] 2.4 Create `knowledge-base/projects/dev-data-etl.md`
    - Include frontmatter: source-type: project, category: data-engineering, title
    - Document pipeline: extract from RDS, PII obfuscation, SQL dump with referential integrity
    - Highlight security: PII obfuscation, Secrets Manager, SSM tunneling
    - _Requirements: 4.1–4.4, 9.1–9.5, 16.1_

- [x] 3. Create knowledge base project documents (architecture and strategy)
  - [x] 3.1 Create `knowledge-base/projects/shared-components-architecture.md`
    - Include frontmatter: source-type: project, category: software-architecture, title
    - Document Table API abstraction (ORM-like CRUD, encrypted columns, read replicas, query logging, snapshots, dynamic where-clause)
    - Document Datasource abstraction (environment-aware routing: local/reader/writer)
    - Document shared components deployment model (copied into apps during EB deployment)
    - Document codebase separation from monolith into separate EB applications
    - Mention feature flags initiative
    - Frame in terms of architectural patterns, not ColdFusion language specifics
    - _Requirements: 10.1–10.8, 9.1–9.5, 16.2, 16.3_

  - [x] 3.2 Create `knowledge-base/projects/virtual-proctoring-standby.md`
    - Include frontmatter: source-type: project, category: real-time-infrastructure, title
    - Document standby queue system (no-show fee, standby queue for available sessions)
    - Document drop-in proctor concept
    - Document AWS Kinesis for real-time session availability
    - Highlight business impact: maximized proctor ratios, revenue from no-show fees, saved candidates money
    - _Requirements: 12.1–12.6, 9.1–9.5, 16.1_

  - [x] 3.3 Create `knowledge-base/projects/platform-migration-strategy.md`
    - Include frontmatter: source-type: project, category: platform-modernization, title
    - Document three-phase migration: CFML monolith → React + Python Lambda via SAM → pure serverless (Amplify Gen2)
    - Document REST to HTTP API Gateway migration with rationale
    - Document business impact: expanded hiring pool, modern skills, React reuse
    - Document intermediate SAM architecture at awscode/nationaltestingnetwork
    - _Requirements: 13.1–13.6, 9.1–9.5, 16.2, 16.3_

  - [x] 3.4 Create `knowledge-base/projects/ai-development-testing.md`
    - Include frontmatter: source-type: project, category: developer-productivity, title
    - Document progression: Amazon Q custom agents → Kiro with hooks and steering files
    - Document Kiro steering files for Candidates Portal (schema, Lambda patterns, frontend, E2E, env vars, workflow)
    - Document custom Kiro hook for timezone-aware datetime validation
    - Document testing infrastructure: pytest with process isolation, custom test runner, Playwright E2E framework
    - Document CI/CD pipeline and custom E2E library
    - Highlight property-based testing in E2E tests
    - _Requirements: 14.1–14.8, 9.1–9.5, 16.1_

  - [x] 3.5 Create `knowledge-base/projects/developer-tooling-infrastructure.md`
    - Include frontmatter: source-type: project, category: devops, title
    - Document custom Docker container (ntn-dev-lucee) with Nginx, SSL, Lucee
    - Document Docker Compose environment (Lucee, MySQL, DynamoDB Local, Secrets Manager)
    - Document Redmine report Docker container with SSM Session Manager (socat relay)
    - Document Highrise-to-HubSpot CRM migration tool (Python, pagination, retry, rate limiting)
    - Document OTRS ticket analysis tool (Python, 59,391 tickets, SSM tunnel, call driver analysis)
    - _Requirements: 15.1–15.7, 9.1–9.5, 16.1_

  - [x] 3.6 Create `knowledge-base/projects/payment-platform-migrations.md`
    - Include frontmatter: source-type: project, category: payments, title
    - Document 3 payment vendor migrations across the organization's history
    - Document Candidates Portal Stripe integration (Stripe Elements, Payment Intents API, webhooks, tax calculation via Lambda)
    - Document cosmetologykansas and cosmopracticetest active Stripe migrations from legacy vendor
    - Highlight migration challenges: transaction continuity, cross-system refunds, PCI compliance, cutover timing
    - Document architectural patterns: idempotent payment processing, webhook-driven status updates, environment-specific keys, Secrets Manager
    - _Requirements: 17.1–17.7, 9.1–9.5, 16.1_

  - [x] 3.7 Create `knowledge-base/projects/database-refresh-pipeline.md`
    - Include frontmatter: source-type: project, category: devops, title
    - Document architecture: CloudFormation-deployed ECS Fargate task, EventBridge weekly schedule, mysqldump piped from prod read-only to test cluster
    - Document Fargate over Lambda rationale (15-min timeout, Aurora pause/resume, long-running ops)
    - Document multi-layer safety guardrails: ARN name validation, cluster identifier validation, read-only endpoint enforcement (cluster-ro-), SSL verification with RDS CA bundle, identical ARN/cluster abort checks
    - Document secrets management: AWS Secrets Manager, separate read-only/write secrets, no hardcoded credentials
    - Document PII anonymization post-copy step
    - Document operational features: SNS notifications, CloudWatch logging, manual trigger, configurable database list
    - _Requirements: 18.1–18.8, 9.1–9.5, 16.1_

  - [x] 3.8 Create `knowledge-base/projects/chrome-kiosk-extension.md`
    - Include frontmatter: source-type: project, category: security, title
    - Document that Jacob built and published a Chrome extension to the Chrome Web Store early in his career, deployed organization-wide at test centers
    - Document security features: fullscreen enforcement (overrideEscFullscreen), blur/focus-loss detection with audio warnings, key interception (Escape, PrintScreen, Alt, Ctrl), automatic exam termination after repeated violations, webview data clearing on close
    - Document Chrome App architecture: kiosk_enabled manifest, Chrome App Window API, webview sandboxing, custom user agent, postMessage communication
    - Highlight self-directed early-career initiative solving a real business need (secure exam delivery without expensive third-party kiosk software)
    - _Requirements: 19.1–19.6, 9.1–9.5, 16.1_

- [x] 4. Checkpoint - Verify knowledge base documents
  - Ensure all 12 project documents have valid frontmatter and correct structure, ask the user if questions arise.

- [x] 5. Create code sample files
  - [x] 5.1 Create `knowledge-base/code-samples/python-serverless-patterns.py`
    - Use `# ---` comment-style frontmatter with source-type: code-sample, category: serverless, language: python, project: candidates-portal
    - Include annotated RDS Data API query execution with parameter binding
    - Include annotated JWT token extraction and validation from API Gateway events
    - Include annotated input sanitization for XSS prevention
    - Include annotated AES encryption/decryption for PII protection
    - Ensure comment density ≥ 20% of non-empty lines
    - _Requirements: 5.1–5.6, 9.1–9.5, 16.1_

  - [x] 5.2 Create `knowledge-base/code-samples/sql-serverless-patterns.sql`
    - Use `-- ---` comment-style frontmatter with source-type: code-sample, category: database, language: sql, project: candidates-portal
    - Include annotated small focused queries optimized for RDS Data API (few joins, targeted selects)
    - Include annotated AES encryption/decryption in SQL queries
    - Include annotated parameterized query patterns for security
    - Ensure comment density ≥ 20% of non-empty lines
    - _Requirements: 6.1–6.5, 9.1–9.5, 16.1_

  - [x] 5.3 Create `knowledge-base/code-samples/typescript-serverless.ts`
    - Use `// ---` comment-style frontmatter with source-type: code-sample, category: serverless, language: typescript, project: candidates-portal
    - Include annotated AWS CDK Lambda function definition using Amplify Gen2 patterns
    - Include annotated Node.js Lambda handler (token generation or webhook handling)
    - Ensure comment density ≥ 20% of non-empty lines
    - _Requirements: 7.1–7.4, 9.1–9.5, 16.1_

- [x] 6. Update the projects page
  - [x] 6.1 Update `src/pages/projects.astro` with new ProjectCard entries
    - Add Candidates Portal card in first or second position with title, description highlighting serverless architecture and scale (90+ Lambda functions), and technology tags (React, AWS Amplify Gen2, Python, Lambda, Aurora Serverless, RDS Data API, Cognito, Stripe, API Gateway)
    - Add LiveKit AI Multi-Agent card with title, description, and technology tags (LiveKit Agents SDK, OpenAI GPT-4o-mini, Deepgram, Python)
    - Add Dev Data ETL Pipeline card with title, description, and technology tags (Python, AWS RDS, Secrets Manager, SSM, SQL)
    - Exclude ColdFusion/CFML from technology tags on all new cards
    - _Requirements: 8.1–8.5, 16.1, 16.2_

- [x] 7. Checkpoint - Verify all content files and page update
  - Ensure all 12 project documents, 3 code samples, and projects page update are complete. Run `npm run build` to verify no Astro build errors. Ask the user if questions arise.

- [x] 8. Write property-based and unit tests
  - [x]* 8.1 Write property test for document structure validity
    - Create `tests/properties/portfolio-content.test.ts`
    - **Property 1: Document Structure Validity** — For any generated knowledge base file, parsing frontmatter produces valid metadata with non-empty source-type, category, and title fields, AND project documents contain at least two H2 headers
    - **Validates: Requirements 1.1, 2.1, 3.1, 4.1, 5.1, 6.1, 7.1, 9.1, 10.1, 12.1, 13.1, 14.1, 15.1, 17.1, 18.1, 19.1**

  - [x]* 8.2 Write property test for ingestion pipeline compatibility
    - **Property 2: Ingestion Pipeline Compatibility** — For any generated file, passing through parseFile returns non-null ParsedDocument, chunkText produces at least one non-empty chunk, and no chunk is excluded by shouldExcludeChunk
    - **Validates: Requirements 1.1, 9.1, 9.5**

  - [x]* 8.3 Write property test for code sample comment density
    - **Property 3: Code Sample Comment Density** — For any generated code sample, the ratio of comment lines to total non-empty lines is at least 0.20 (20%)
    - **Validates: Requirements 5.6, 6.5, 7.4**

  - [x]* 8.4 Write property test for third person voice consistency
    - **Property 4: Third Person Voice Consistency** — For any generated knowledge base document, the content body (excluding code blocks and frontmatter) contains no first-person singular subject pronouns and contains at least one reference to "Jacob"
    - **Validates: Requirements 9.3**

  - [x]* 8.5 Write property test for technology presentation strategy
    - **Property 5: Technology Presentation Strategy** — For any document referencing legacy systems or ColdFusion, architectural pattern terms outnumber CFML-specific terms
    - **Validates: Requirements 10.7, 16.2, 16.3**

  - [x]* 8.6 Write unit tests for specific content validation
    - Create `tests/unit/portfolio-content.test.ts`
    - Verify each specific file exists with expected content sections
    - Verify ProjectCard additions on projects page (Candidates Portal in first/second position)
    - Verify no CFML in new card technology tags
    - Verify Candidates Portal document includes all required sections (Overview, Architecture, Design Decisions, Security, Scale, Technologies)
    - _Requirements: 1.1–1.9, 8.1–8.5, 16.2_

- [x] 9. Final checkpoint - Ensure all tests pass
  - Run `npm run test` to verify all property-based and unit tests pass. Ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific content requirements for individual files
- The ingest pipeline change (task 1) is a prerequisite for the SQL code sample (task 5.2)
- Knowledge base documents (tasks 2–3) can be implemented in any order but are listed sequentially for clarity
- All content must avoid excluded terms (National Testing Network, NTN, Ergometrics) to pass ingestion filtering

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "2.1", "2.2", "2.3", "2.4", "3.1", "3.2", "3.3", "3.4", "3.5", "3.6", "3.7", "3.8"] },
    { "id": 2, "tasks": ["5.1", "5.2", "5.3", "6.1"] },
    { "id": 3, "tasks": ["8.1", "8.2", "8.3", "8.4", "8.5", "8.6"] }
  ]
}
```
