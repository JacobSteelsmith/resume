# Resume Site — resume.jacob.steelsmith.org

A resume/portfolio site demonstrating AWS engineering expertise through a Terraform-only Infrastructure-as-Code approach. The site uses Astro for static generation, Terraform for all infrastructure (AWS hosting and cross-platform resources), and includes a RAG-based AI chatbot powered by Amazon Bedrock Knowledge Bases.

## Directory Structure

```
resume/
├── src/                          # Astro source files
│   ├── layouts/                  # Page layouts
│   ├── pages/                    # Site pages (index, resume, projects, architecture, contact)
│   ├── components/               # Reusable UI components
│   ├── styles/                   # Global styles and design tokens
│   └── lambda/
│       └── chat-handler/         # RAG chatbot Lambda function source
├── public/                       # Static assets served as-is
├── infrastructure/
│   └── terraform/                # Terraform config (all AWS resources + GitHub OIDC, IAM, branch protection, Actions secrets)
├── knowledge-base/               # RAG chatbot content sources
│   ├── skills/                   # Technical skills documentation
│   ├── experience/               # Work experience descriptions
│   ├── projects/                 # Project descriptions
│   ├── certifications/           # Certification details
│   └── code-samples/             # Representative code samples with language metadata
├── .github/
│   └── workflows/
│       └── deploy.yml            # CI/CD pipeline (build, validate, deploy)
├── astro.config.mjs              # Astro configuration
├── package.json                  # Node.js dependencies and scripts
└── README.md                     # This file
```

## Prerequisites

- **Node.js** >= 18.x
- **npm** >= 9.x
- **AWS CLI** v2 configured with appropriate credentials
- **Terraform** >= 1.5
- **AWS Account** with Route 53 hosted zone for `steelsmith.org`

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run tests
npm test
```

## Infrastructure Deployment

All infrastructure is managed by Terraform in a single root module under `infrastructure/terraform/`. This includes AWS hosting resources (S3, CloudFront, ACM, Route 53, API Gateway, Lambda, WAF, Bedrock Knowledge Base) and cross-platform resources (GitHub OIDC provider, IAM deploy role, branch protection, Actions secrets/variables).

```bash
cd infrastructure/terraform

# Copy and fill in variables
cp terraform.tfvars.example terraform.tfvars

# Initialize (uses S3 backend with DynamoDB state locking)
terraform init

# Plan changes
terraform plan

# Apply
terraform apply
```

### Key Terraform Files

| File | Purpose |
|------|---------|
| `versions.tf` | Provider constraints, S3 backend configuration |
| `variables.tf` | Input variables (domain, hosted zone, environment, etc.) |
| `oidc.tf` | GitHub OIDC provider and IAM deploy role |
| `github.tf` | Branch protection, Actions environment secrets/variables |
| `hosting.tf` | S3 bucket, CloudFront, ACM, Route 53, security headers |
| `chatbot.tf` | API Gateway, WAF, Lambda, Bedrock Knowledge Base |
| `outputs.tf` | Exported values (bucket name, distribution ID, API endpoint) |

## CI/CD Pipeline

The GitHub Actions workflow (`.github/workflows/deploy.yml`) handles:

- **On push to main**: Build Astro site → OIDC auth → S3 sync → CloudFront invalidation
- **On pull request**: Build verification → Terraform validation and plan

Authentication uses GitHub OIDC to assume an IAM role with least-privilege permissions — no long-lived AWS credentials stored in the repository.

## Architecture

This project uses a Terraform-only IaC approach, managing all resources in a single root module:

| Resource Category | Managed By | Rationale |
|-------------------|-----------|-----------|
| AWS hosting (S3, CloudFront, ACM, Route 53) | Terraform | Unified state, consistent tagging, single tool for all resources |
| Chatbot (API Gateway, Lambda, WAF, Bedrock) | Terraform | Same module enables cross-resource references |
| GitHub config (OIDC, branch protection, Actions secrets) | Terraform | Cross-platform resources in the same workflow |

Together with the blog at `jacob.steelsmith.org` (AWS Amplify), this demonstrates both managed hosting and full IaC approaches.

## RAG Chatbot

The site includes an AI chatbot that answers visitor questions about career, skills, and projects:

1. **Knowledge Base**: Structured Markdown/code files in `knowledge-base/`
2. **Ingestion**: Content chunked and embedded via Amazon Titan Text Embeddings V2
3. **Retrieval**: Semantic search via Bedrock Knowledge Bases (OpenSearch Serverless)
4. **Generation**: Conversational responses via Claude 3 Haiku, grounded in retrieved context
5. **Frontend**: Embedded chat widget with sessionStorage conversation history

## License

Private — All rights reserved.
