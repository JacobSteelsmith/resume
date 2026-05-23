---
source-type: project
category: web-infrastructure
title: Resume Site - Terraform IaC with RAG Chatbot
---

# Resume Site - Terraform IaC with RAG Chatbot

## Project Overview

This resume site (resume.jacob.steelsmith.org) demonstrates AWS engineering expertise through a Terraform-only infrastructure-as-code approach. The site combines static site generation with a RAG-based AI chatbot powered by Amazon Bedrock.

## Architecture

### Static Site Layer
- Built with Astro for zero-JS static HTML generation
- Hosted on S3 with CloudFront CDN distribution
- Origin Access Control (OAC) restricts S3 access to CloudFront only
- CloudFront Function rewrites directory paths to index.html
- Security headers via response headers policy: HSTS, CSP, X-Frame-Options, X-Content-Type-Options
- ACM certificate in us-east-1 via aliased Terraform provider (CloudFront requirement)
- HTTP/2 and HTTP/3 enabled

### RAG Chatbot
- Amazon Bedrock Knowledge Base with Titan Text Embeddings V2 (1024 dimensions)
- OpenSearch Serverless (AOSS) vector store with HNSW/faiss index
- Claude Haiku 4.5 via cross-region inference profile for response generation
- Lambda function calls Bedrock RetrieveAndGenerate API
- API Gateway (REST) with AWS_PROXY integration
- WAF rate limiting: 10 req/min per-IP, 100 req/min global via usage plan
- Knowledge base content stored as Markdown in S3, auto-ingested on deploy
- Source attribution in responses

### CI/CD Pipeline
- GitHub Actions with OIDC authentication (no stored credentials)
- Push to master triggers: build → deploy site → deploy Lambda → sync KB → invalidate cache
- Environment-scoped secrets and variables via Terraform-managed GitHub resources
- OIDC trust policy supports both branch-based and environment-based subject claims

### Infrastructure as Code
- Single Terraform root module managing all resources
- AWS resources: S3, CloudFront, ACM, Route 53, API Gateway, Lambda, WAF, Bedrock Knowledge Base, OpenSearch Serverless, IAM roles/policies
- GitHub resources: OIDC provider, branch protection, Actions secrets and environment variables
- OpenSearch resources: Vector index via opensearch-project/opensearch provider with AWS SigV4 signing (aws_signature_service = "aoss")
- State: S3 backend with lock file

### Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| IaC tool | Terraform | Single state file, unified workflow, declarative |
| Hosting | S3 + CloudFront | Full control, global CDN, cost-effective |
| Auth | OIDC (no stored keys) | Short-lived credentials, no secret rotation |
| Vector store | OpenSearch Serverless | Managed scaling, Bedrock-native integration |
| Rate limiting | WAF + API Gateway | Per-IP via WAF, global via usage plans |
| Model access | Inference profile | Cross-region routing, future-proof |
| Index management | opensearch provider | Declarative, avoids manual console steps |

## Technologies
- Terraform (HCL), Astro (TypeScript), AWS Lambda (JavaScript/ESM)
- Amazon Bedrock (Claude Haiku 4.5, Titan Embeddings V2)
- OpenSearch Serverless, API Gateway, CloudFront, S3, WAF, Route 53
- GitHub Actions with OIDC, opensearch-project/opensearch provider
