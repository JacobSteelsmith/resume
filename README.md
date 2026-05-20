# Resume Site — resume.jacob.steelsmith.org

A resume/portfolio site demonstrating AWS engineering expertise through a hybrid Infrastructure-as-Code approach. The site uses Astro for static generation, CloudFormation for AWS hosting infrastructure, Terraform for cross-platform resources, and includes a RAG-based AI chatbot powered by Amazon Bedrock Knowledge Bases.

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
│   ├── template.yaml             # CloudFormation template (S3, CloudFront, ACM, Route 53, API Gateway, Lambda, Bedrock)
│   └── terraform/                # Terraform config (GitHub OIDC, IAM, branch protection, Actions secrets)
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

### CloudFormation (AWS Hosting)

The CloudFormation stack provisions S3, CloudFront, ACM, Route 53, API Gateway, Lambda, WAF, and Bedrock Knowledge Base resources.

```bash
# Validate template
aws cloudformation validate-template \
  --template-body file://infrastructure/template.yaml \
  --region us-east-1

# Deploy stack
aws cloudformation deploy \
  --template-file infrastructure/template.yaml \
  --stack-name resume-site \
  --parameter-overrides \
    DomainName=resume.jacob.steelsmith.org \
    HostedZoneId=<your-zone-id> \
    Environment=production \
  --capabilities CAPABILITY_IAM \
  --region us-east-1
```

### Terraform (Cross-Platform Config)

Terraform manages the GitHub OIDC provider, IAM deploy role, branch protection, and Actions environment secrets/variables.

```bash
cd infrastructure/terraform

# Copy and fill in variables
cp terraform.tfvars.example terraform.tfvars

# Initialize
terraform init

# Plan changes
terraform plan

# Apply
terraform apply
```

## CI/CD Pipeline

The GitHub Actions workflow (`.github/workflows/deploy.yml`) handles:

- **On push to main**: Build Astro site → OIDC auth → S3 sync → CloudFront invalidation
- **On pull request**: Build verification → CloudFormation template validation

Authentication uses GitHub OIDC to assume an IAM role with least-privilege permissions — no long-lived AWS credentials stored in the repository.

## Architecture

This project intentionally uses a hybrid IaC approach to demonstrate complementary deployment strategies:

| Tool | Scope | Rationale |
|------|-------|-----------|
| CloudFormation | AWS hosting (S3, CloudFront, ACM, Route 53, API Gateway, Lambda, Bedrock) | Native AWS service, deep integration, single-stack deployment |
| Terraform | GitHub config (OIDC, branch protection, Actions secrets) | Cross-platform resources CloudFormation cannot manage; mature OIDC module |

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
