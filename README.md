# resume.jacob.steelsmith.org

A resume and portfolio site demonstrating AWS engineering expertise through a Terraform-only Infrastructure-as-Code approach. Built with Astro for static generation, Terraform for all infrastructure, and a RAG-powered AI chatbot using Amazon Bedrock. Companion to the [portfolio/blog site](https://jacob.steelsmith.org) which uses AWS Amplify for managed hosting.

## Architecture

### Static Site Layer

- **Framework**: Astro (static HTML, zero client-side JS by default)
- **Hosting**: S3 + CloudFront CDN
- **Access Control**: Origin Access Control (OAC) restricts S3 to CloudFront only
- **URL Rewriting**: CloudFront Function appends `/index.html` to directory paths
- **Security Headers**: HSTS, CSP (with `unsafe-inline` for Astro), X-Frame-Options, X-Content-Type-Options
- **SSL**: ACM certificate in us-east-1 via aliased Terraform provider
- **Protocols**: HTTP/2 and HTTP/3 enabled

### RAG Chatbot

- **Knowledge Base**: Amazon Bedrock with Titan Text Embeddings V2 (1024 dimensions)
- **Vector Store**: OpenSearch Serverless (AOSS) with HNSW/faiss index
- **Generation**: Claude Haiku 4.5 via cross-region inference profile (`us.anthropic.claude-haiku-4-5-20251001-v1:0`)
- **API**: API Gateway (REST) → Lambda (Node.js ESM) → Bedrock RetrieveAndGenerate
- **Rate Limiting**: WAF (10 req/min per-IP via rate-based rule) + API Gateway usage plan (100 req/min global)
- **Data Source**: Markdown files in `knowledge-base/`, auto-synced and ingested on deploy
- **CORS**: Lambda returns headers (required with AWS_PROXY integration)

### CI/CD Pipeline (GitHub Actions)

1. Push to `master` triggers workflow
2. OIDC authenticates to AWS (no stored credentials, environment-based subject claim)
3. Astro site builds with `PUBLIC_CHAT_API_URL` injected
4. Static assets sync to S3
5. Lambda function zipped and deployed via `update-function-code`
6. Knowledge base content syncs to S3, ingestion job triggered
7. CloudFront cache invalidated

### Infrastructure as Code (Terraform)

Single root module managing all resources:

| File | Resources |
|------|-----------|
| `versions.tf` | Provider constraints (AWS, GitHub, OpenSearch), S3 backend |
| `hosting.tf` | S3, CloudFront, ACM (us-east-1 alias), Route 53, CloudFront Function, response headers |
| `chatbot.tf` | API Gateway, WAF, Lambda, Bedrock Knowledge Base, OpenSearch Serverless (collection + policies + index), IAM |
| `oidc.tf` | GitHub OIDC provider, IAM deploy role with least-privilege permissions |
| `github.tf` | Branch protection, Actions environment secrets/variables |
| `variables.tf` | Input variables |
| `outputs.tf` | Exported values |

### Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| IaC tool | Terraform only | Single state, unified workflow, one language for all resources |
| Hosting | S3 + CloudFront | Full control, global CDN, cost-effective |
| Auth | OIDC | Short-lived credentials, no secret rotation, environment-aware subjects |
| Vector store | OpenSearch Serverless | Managed scaling, Bedrock-native, AOSS signature service |
| Rate limiting | WAF + API Gateway | Per-IP via WAF, global via usage plans |
| Model access | Inference profile | Cross-region routing, `*` region in IAM for foundation model ARN |
| Index management | opensearch provider | Declarative, `aws_signature_service = "aoss"`, `lifecycle { ignore_changes }` for drift |

## Directory Structure

```
├── src/
│   ├── pages/              # Site pages (index, resume, projects, 404)
│   ├── components/         # UI components (ChatWidget, SEOHead, etc.)
│   ├── layouts/            # BaseLayout
│   └── utils/              # Utilities
├── lambda/
│   └── chat-handler/       # RAG chatbot Lambda (Node.js ESM)
├── knowledge-base/         # RAG content sources
│   ├── experience/         # Work experience
│   ├── skills/             # Technical skills
│   ├── projects/           # Project descriptions
│   └── certifications/     # Certifications and education
├── infrastructure/
│   └── terraform/          # All Terraform configuration
│       └── apply.sh        # Wrapper script (exports credentials for opensearch provider)
├── .github/
│   └── workflows/
│       └── deploy.yml      # CI/CD pipeline
├── tests/                  # Vitest tests
└── astro.config.mjs
```

## Prerequisites

- Node.js >= 18
- Terraform >= 1.5
- AWS CLI v2 with `aws login` configured
- `uv` (for AWS MCP server, optional)

## Getting Started

```bash
npm install
npm run dev       # Start dev server
npm run build     # Build for production
npm test          # Run tests
```

## Infrastructure Deployment

```bash
cd infrastructure/terraform
cp terraform.tfvars.example terraform.tfvars  # Fill in values
terraform init
./apply.sh        # Exports credentials and runs terraform apply
./apply.sh plan   # Preview changes
```

The `apply.sh` script exports AWS credentials as environment variables before running Terraform. This is required because the `opensearch-project/opensearch` provider doesn't support the `aws login` credential type directly.

## Companion Project

The **portfolio site** ([jacob.steelsmith.org](https://jacob.steelsmith.org)) uses the same Astro framework but with AWS Amplify for managed hosting. Together they demonstrate two deployment strategies:

| Aspect | Portfolio (Amplify) | Resume (Terraform) |
|--------|--------------------|--------------------|
| Deployment | Git push → auto-build | Git push → GitHub Actions pipeline |
| Infrastructure | Fully managed | Fully codified |
| SSL | Amplify-managed | ACM + aliased provider |
| CDN | Amplify CDN | CloudFront |
| Ops overhead | Minimal | Moderate (state management, IAM) |
| Flexibility | Limited | Full control |
| AI features | None | RAG chatbot |

## License

Private — All rights reserved.
