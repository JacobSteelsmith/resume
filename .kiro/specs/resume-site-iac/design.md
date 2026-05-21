# Design Document

## Overview

This design describes the architecture for a resume/portfolio site at `resume.jacob.steelsmith.org`, built as a standalone repository separate from the existing blog. The project uses Terraform as the sole IaC tool, managing all AWS infrastructure (S3, CloudFront, ACM, Route 53, OAC, API Gateway, Lambda, WAF, Bedrock Knowledge Base) and cross-platform resources (GitHub OIDC provider, IAM deploy role, branch protection, Actions environment secrets/variables). It includes a RAG-based AI chatbot powered by Amazon Bedrock Knowledge Bases.

The system comprises five major subsystems:

1. **Static Site (Astro)** — Generates HTML/CSS/JS at build time for all pages (homepage, resume, projects, architecture, contact) with SEO metadata, responsive layout, and an embedded chat widget.
2. **Terraform Infrastructure** — Single Terraform configuration managing all AWS resources (S3, CloudFront, OAC, ACM, Route 53, API Gateway, Lambda, WAF, Bedrock Knowledge Base) and GitHub configuration (OIDC provider, IAM deploy role, branch protection, Actions secrets/variables).
3. **CI/CD Pipeline (GitHub Actions)** — OIDC-authenticated build and deploy workflow with Terraform validation on PRs.
4. **RAG Chatbot (Bedrock)** — Knowledge base content ingestion, vector embeddings via Titan Text Embeddings V2, semantic retrieval, and conversational response generation with content filtering.

### Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| IaC tool | Terraform only (single tool for all infrastructure) | Single state file, unified plan/apply workflow, simpler operations, one language (HCL) for AWS + GitHub resources |
| Vector store | Amazon Bedrock managed (OpenSearch Serverless auto-provisioned) | Reduces operational overhead; Bedrock handles index lifecycle |
| Embedding model | Amazon Titan Text Embeddings V2 (1024 dimensions) | Native Bedrock integration, flexible dimensions, optimized for RAG |
| Foundation model | Anthropic Claude 3 Haiku on Bedrock | Low latency, cost-effective for short conversational responses |
| API type | REST API (API Gateway v1) | Usage plans and API keys for rate limiting; per-IP limiting via WAF |
| Per-IP rate limiting | AWS WAF rate-based rule on API Gateway | API Gateway usage plans don't support per-IP; WAF provides this natively |
| Chat widget state | sessionStorage | Preserves conversation within tab without persisting across sessions |

## Architecture

```mermaid
graph TB
    subgraph "GitHub"
        REPO[Resume Repository]
        GHA[GitHub Actions]
    end

    subgraph "Terraform-Managed (us-east-1)"
        OIDC[IAM OIDC Provider]
        ROLE[Deploy IAM Role]
        BP[Branch Protection]
        SECRETS[Actions Secrets/Vars]

        S3[S3 Bucket]
        CF[CloudFront Distribution]
        OAC[Origin Access Control]
        ACM[ACM Certificate]
        R53[Route 53 Records]
        HEADERS[Security Headers Policy]
        
        subgraph "Chatbot Resources"
            APIGW[API Gateway REST API]
            WAF[AWS WAF WebACL]
            LAMBDA[RAG Lambda Function]
            KB[Bedrock Knowledge Base]
            DS[S3 Data Source]
            KBS3[Knowledge Base S3 Bucket]
        end
    end

    subgraph "Visitor Browser"
        SITE[Static Site]
        WIDGET[Chat Widget]
    end

    REPO -->|push to main| GHA
    GHA -->|OIDC assume role| ROLE
    ROLE -->|s3 sync| S3
    ROLE -->|invalidation| CF
    
    CF -->|OAC| S3
    CF -->|TLS| ACM
    R53 -->|alias| CF
    
    SITE -->|HTTPS| CF
    WIDGET -->|POST /chat| APIGW
    WAF -->|rate limit| APIGW
    APIGW -->|invoke| LAMBDA
    LAMBDA -->|retrieve & generate| KB
    KB -->|embeddings| DS
    DS -->|source files| KBS3
```

### Deployment Flow

```mermaid
sequenceDiagram
    participant Dev as Developer
    participant GH as GitHub
    participant GHA as GitHub Actions
    participant AWS as AWS (OIDC)
    participant S3 as S3 Bucket
    participant CF as CloudFront

    Dev->>GH: Push to main
    GH->>GHA: Trigger workflow
    GHA->>GHA: Build Astro site
    GHA->>GHA: Validate Terraform (validate + plan)
    GHA->>AWS: Assume role via OIDC
    AWS-->>GHA: Temporary credentials
    GHA->>S3: aws s3 sync dist/
    GHA->>CF: Create invalidation /*
```

## Components and Interfaces

### 1. Static Site (Astro)

**Responsibility:** Generate all HTML pages, CSS, JavaScript, and static assets at build time.

**Structure:**
```
src/
├── layouts/
│   └── BaseLayout.astro          # HTML shell, meta tags, nav, footer
├── pages/
│   ├── index.astro               # Homepage
│   ├── resume.astro              # Resume/CV page
│   ├── projects.astro            # Projects showcase
│   ├── architecture.astro        # Site architecture documentation
│   └── contact.astro             # Contact information
├── components/
│   ├── Navigation.astro          # Responsive nav with mobile menu
│   ├── ChatWidget.astro          # Chat overlay component
│   ├── ChatWidget.ts             # Chat widget client-side logic
│   ├── SEOHead.astro             # SEO meta tag component
│   └── ProjectCard.astro         # Project display card
└── styles/
    └── global.css                # Design tokens, responsive utilities
```

**Interfaces:**
- Input: Markdown/data files for page content
- Output: Static `dist/` directory with all HTML, CSS, JS, images
- Config: `astro.config.mjs` with `output: 'static'`, `site: 'https://resume.jacob.steelsmith.org'`, sitemap integration

### 2. Terraform Configuration (`infrastructure/terraform/`)

**Responsibility:** Manage ALL infrastructure — AWS hosting resources, chatbot backend, GitHub OIDC, and GitHub repository configuration — in a single Terraform root module.

**Files:**
```
infrastructure/terraform/
├── versions.tf               # Provider constraints, S3 backend config
├── variables.tf              # All input variables
├── outputs.tf                # Exported values (bucket name, distribution ID, OIDC role ARN, API endpoint)
├── hosting.tf                # S3 bucket, CloudFront, OAC, ACM, Route 53, security headers
├── chatbot.tf                # API Gateway, WAF, Lambda, Bedrock Knowledge Base, data source bucket
├── oidc.tf                   # OIDC provider module, IAM deploy role, deploy policy
├── github.tf                 # Branch protection, Actions environment, secrets, variables
└── terraform.tfvars.example  # Example variable values (no secrets)
```

**Key Resources by File:**

**`hosting.tf`:**
- `aws_s3_bucket` + `aws_s3_bucket_public_access_block` — Site hosting bucket (all public access blocked)
- `aws_cloudfront_origin_access_control` — OAC for S3 origin
- `aws_s3_bucket_policy` — CloudFront-only read access
- `aws_acm_certificate` + `aws_acm_certificate_validation` — TLS cert with DNS validation
- `aws_cloudfront_response_headers_policy` — Security headers (HSTS, CSP, X-Frame-Options, X-Content-Type-Options)
- `aws_cloudfront_distribution` — CDN with HTTP/2+3, compression, HTTPS redirect, custom error pages
- `aws_route53_record` (A + AAAA) — DNS alias to CloudFront

**`chatbot.tf`:**
- `aws_api_gateway_rest_api` + resources/methods — Chat API endpoint (POST /chat)
- `aws_api_gateway_usage_plan` — Global rate limit (100 req/min)
- `aws_wafv2_web_acl` + `aws_wafv2_web_acl_association` — Per-IP rate limit (10 req/min)
- `aws_lambda_function` + `aws_iam_role` — RAG agent handler with least-privilege Bedrock access
- `aws_bedrockagent_knowledge_base` — Knowledge base with Titan Embeddings V2
- `aws_bedrockagent_data_source` — S3 data source
- `aws_s3_bucket` — Knowledge base content bucket

**`oidc.tf`:**
- `unfunco/oidc-github/aws` module (~> 3.0) — OIDC provider + IAM role
- `aws_iam_policy_document` — Least-privilege deploy policy (S3 + CloudFront)

**`github.tf`:**
- `github_branch_protection` — Main branch protection (1 approval, CI checks)
- `github_repository_environment` — Production environment
- `github_actions_environment_secret` — AWS_ACCOUNT_ID, OIDC_ROLE_ARN
- `github_actions_environment_variable` — S3_BUCKET_NAME, CLOUDFRONT_DIST_ID

**Backend:** S3 with DynamoDB state locking (`jacobsteelsmith-terraform-state` bucket, `resume/terraform.tfstate` key).

### 3. CI/CD Pipeline (`.github/workflows/deploy.yml`)

**Responsibility:** Automated build, validation, and deployment.

**Jobs:**
1. `build` — Checkout, install deps, build Astro, upload artifact
2. `validate` (PR only) — Lint, `terraform validate`, `terraform plan`
3. `deploy-production` (main push only) — OIDC auth, S3 sync, CloudFront invalidation

**Permissions:** `id-token: write`, `contents: read`

**Pinned Actions:**
- `actions/checkout@v4`
- `actions/setup-node@v4`
- `aws-actions/configure-aws-credentials@v4`
- `actions/upload-artifact@v4`
- `actions/download-artifact@v4`

### 4. RAG Chatbot

**Responsibility:** Answer visitor questions about career, skills, and projects using retrieved context.

**Components:**

#### 4a. Knowledge Base Content (`knowledge-base/`)
```
knowledge-base/
├── skills/
│   ├── cloud-platforms.md
│   ├── programming-languages.md
│   └── frameworks-tools.md
├── experience/
│   ├── current-role.md
│   └── previous-roles.md
├── projects/
│   ├── resume-site.md
│   └── other-projects.md
├── certifications/
│   └── aws-certifications.md
└── code-samples/
    ├── typescript-example.ts
    ├── python-example.py
    └── terraform-example.tf
```

Each file includes a YAML frontmatter header:
```yaml
---
source-type: skills | experience | project | certification | code-sample
category: cloud-platforms | programming | frameworks | ...
language: typescript | python | terraform  # for code samples only
project: resume-site  # for code samples only
---
```

#### 4b. Lambda Function (`src/lambda/chat-handler/`)

**Interface:**
```typescript
// Request (from API Gateway)
interface ChatRequest {
  question: string;  // max 500 chars
}

// Response
interface ChatResponse {
  answer: string;           // max 1024 tokens
  sources: SourceAttribution[];
  filtered: boolean;        // true if content was redacted
}

interface SourceAttribution {
  title: string;
  category: string;
}
```

**Logic Flow:**
1. Validate input (question present, ≤500 chars)
2. Call Bedrock Knowledge Base `RetrieveAndGenerate` API
3. Filter response for sensitive terms (NTN, Ergometrics, encryption keys)
4. Return formatted response with source attributions

#### 4c. Chat Widget (`src/components/ChatWidget.ts`)

**State Management:**
- Conversation history stored in `sessionStorage` under key `resume-chat-history`
- Loading state, error state, character count tracked in component state

**API Interface:**
```typescript
POST https://{api-id}.execute-api.us-east-1.amazonaws.com/prod/chat
Content-Type: application/json

{ "question": "What AWS services has Jacob worked with?" }
```

**Timeout:** 30-second client-side timeout with retry button on failure.

## Data Models

### Knowledge Base Document Schema

```typescript
interface KnowledgeBaseDocument {
  // YAML frontmatter fields
  sourceType: 'skills' | 'experience' | 'project' | 'certification' | 'code-sample';
  category: string;
  language?: string;      // programming language (code samples only)
  project?: string;       // associated project (code samples only)
  title: string;
  
  // Body content (Markdown or code)
  content: string;
}
```

### Bedrock Knowledge Base Configuration

```typescript
interface KnowledgeBaseConfig {
  name: string;                          // 'resume-knowledge-base'
  embeddingModel: string;                // 'amazon.titan-embed-text-v2:0'
  embeddingDimensions: number;           // 1024
  chunkingStrategy: 'FIXED_SIZE';
  maxTokens: number;                     // 1000
  overlapPercentage: number;             // 10 (= ~100 token overlap)
  vectorStore: 'OPENSEARCH_SERVERLESS';  // auto-provisioned by Bedrock
}
```

### Chat Session State

```typescript
interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  sources?: SourceAttribution[];
  timestamp: number;
}

interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
}
```

### Terraform Variables

```typescript
interface TerraformVariables {
  // Domain and DNS
  domain_name: string;                   // 'resume.jacob.steelsmith.org'
  hosted_zone_id: string;                // Route 53 zone ID for steelsmith.org
  
  // Environment
  environment: string;                   // 'production'
  
  // Chatbot
  bedrock_model_id: string;              // 'anthropic.claude-3-haiku-20240307-v1:0'
  
  // GitHub
  github_repository: string;             // 'JacobSteelsmith/resume'
  
  // AWS
  aws_account_id: string;                // sensitive
  aws_region: string;                    // 'us-east-1'
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: SEO metadata completeness

*For any* page generated by the Astro build, it SHALL contain a unique `<title>` tag, a unique `<meta name="description">` tag, Open Graph meta tags (og:title, og:description, og:type, og:url), and a `<link rel="canonical">` tag with an absolute URL on `resume.jacob.steelsmith.org`. No two pages shall share the same title or description.

**Validates: Requirements 5.1, 5.2, 5.3**

### Property 2: Internal link resolution

*For any* internal link (relative href) found in the built HTML output, the referenced file SHALL exist within the `dist/` directory, ensuring the site is fully self-contained.

**Validates: Requirements 4.8**

### Property 3: Knowledge base file metadata validity

*For any* file in the `knowledge-base/` directory, it SHALL contain valid YAML frontmatter with a `source-type` field matching one of the allowed categories (skills, experience, project, certification, code-sample) and a `title` field.

**Validates: Requirements 8.1**

### Property 4: Chunking size and overlap invariants

*For any* valid text input processed by the ingestion pipeline, all generated chunks SHALL be between 500 and 1000 tokens in length, and any two consecutive chunks from the same source document SHALL share between 50 and 100 tokens of overlapping content.

**Validates: Requirements 9.1**

### Property 5: Code sample metadata preservation

*For any* code sample file with language and project metadata in its frontmatter, the chunking pipeline SHALL preserve the language and project association in the metadata attached to each resulting chunk.

**Validates: Requirements 9.3**

### Property 6: Ingestion error resilience

*For any* batch of knowledge base files where some files are empty or unparseable, the ingestion pipeline SHALL skip the invalid files (logging errors with file identifiers), successfully process all valid files, and produce a summary report with accurate counts.

**Validates: Requirements 9.8, 9.9**

### Property 7: Ingestion content exclusion

*For any* text chunk that contains the terms "National Testing Network", "NTN", "Ergometrics", or patterns matching encryption keys, the ingestion pipeline SHALL exclude that chunk and NOT store its embedding in the vector database.

**Validates: Requirements 9.10**

### Property 8: Retrieval threshold filtering

*For any* set of retrieved chunks with similarity scores, the RAG agent SHALL include only chunks scoring at or above the configured relevance threshold, include at most 5 chunks, and return a "not enough information" fallback message when zero chunks pass the threshold.

**Validates: Requirements 10.1, 10.4**

### Property 9: Source attribution presence

*For any* RAG agent response generated from a non-empty set of retrieved context chunks, the response SHALL include source attributions identifying each chunk's origin by title, project name, or skill area.

**Validates: Requirements 10.3**

### Property 10: Response content filtering

*For any* response text produced by the Bedrock model, the content filter SHALL detect and replace all occurrences of sensitive terms ("National Testing Network", "NTN", "Ergometrics", encryption key patterns) with a `[REDACTED]` marker, and the final output SHALL contain zero instances of any sensitive term.

**Validates: Requirements 10.6**

### Property 11: Chat input validation

*For any* string input to the chat system, the character count display SHALL equal the actual string length. *For any* string exceeding 500 characters, the chat widget SHALL prevent submission and the API handler SHALL return HTTP 400. *For any* request body missing the `question` field, the API handler SHALL return HTTP 400.

**Validates: Requirements 11.2, 11.3, 12.5**

### Property 12: Conversation history round-trip

*For any* valid conversation history (array of ChatMessage objects with role, content, sources, and timestamp fields), serializing to sessionStorage and deserializing back SHALL produce an equivalent array with all messages, sources, and timestamps preserved.

**Validates: Requirements 11.7**

### Property 13: Terraform resource tagging

*For any* taggable resource defined in the Terraform configuration, it SHALL include a tag with key `Environment` referencing the environment variable value.

**Validates: Requirements 2.20, 13.4**

## Error Handling

### CI/CD Pipeline Failures

| Failure | Behavior |
|---------|----------|
| Build failure | Job fails, GitHub status check blocks merge |
| Terraform validate/plan failure | PR check fails with validation error details |
| OIDC auth failure | Deploy job fails, reported on commit status |
| S3 sync failure | Deploy halts, partial upload may exist (next deploy fixes) |
| CloudFront invalidation failure | Non-fatal warning; cached content serves until TTL expires |

### RAG Chatbot Errors

| Failure | Behavior |
|---------|----------|
| Bedrock model unavailable | Lambda returns 503 with "service temporarily unavailable" message |
| All chunks below relevance threshold | Return message stating insufficient information |
| Question exceeds 500 chars | API Gateway returns 400 before Lambda invocation |
| Rate limit exceeded (global) | API Gateway returns 429 with error message |
| Rate limit exceeded (per-IP) | WAF blocks request, returns 403 |
| Lambda timeout (30s) | API Gateway returns 504; widget shows timeout message with retry |
| Sensitive content in response | Filter replaces terms with `[REDACTED]` marker |

### Ingestion Pipeline Errors

| Failure | Behavior |
|---------|----------|
| Empty/unparseable source file | Log error with filename, skip file, continue processing |
| Bedrock embedding API failure | Log error, skip affected chunk, continue |
| Excluded content detected | Skip chunk silently (not counted as error) |
| Pipeline completion | Produce summary: files processed, chunks generated, embeddings stored, files skipped |

### Static Site Build Errors

| Failure | Behavior |
|---------|----------|
| Missing content file | Astro build fails, CI reports error |
| Invalid frontmatter | Astro build fails with parse error |
| Broken internal link | Build succeeds but link checker (if added) would catch |

## Testing Strategy

### Infrastructure Testing

**Terraform:**
- `terraform fmt -check` in CI to enforce consistent formatting
- `terraform validate` in CI on every PR to catch syntax and configuration errors
- `terraform plan` in CI on every PR to preview changes and catch resource conflicts
- State stored in S3 with DynamoDB locking for safe concurrent access
- Manual `terraform apply` to staging environment before production (future enhancement)

### Static Site Testing

- **Build verification:** `astro build` must succeed with zero errors
- **Lighthouse CI:** Automated Performance and Accessibility scoring (target ≥90)
- **Link checking:** Verify all internal links resolve within `dist/`

### RAG Chatbot Testing

**Unit tests (Vitest):**
- Lambda handler input validation (empty question, oversized question)
- Response content filtering (sensitive term detection and redaction)
- Source attribution formatting
- Chat widget character count logic
- Chat widget sessionStorage serialization/deserialization

**Integration tests:**
- API Gateway → Lambda invocation with mock Bedrock responses
- End-to-end chat flow with test knowledge base

**Property-based tests (fast-check):**
- Content filtering correctness across arbitrary inputs
- Chunking logic invariants (overlap, size bounds)
- Input validation boundary behavior

### CI/CD Testing

- Workflow syntax validation via `actionlint`
- OIDC authentication tested on first deployment (manual verification)

### Test Configuration

- **Framework:** Vitest (consistent with existing portfolio project)
- **PBT Library:** fast-check (already used in portfolio project)
- **Minimum PBT iterations:** 100 per property
- **Tag format:** `Feature: resume-site-iac, Property {N}: {description}`
