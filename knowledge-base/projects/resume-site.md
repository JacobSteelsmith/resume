---
source-type: project
category: web-infrastructure
title: Resume Site - Terraform IaC with RAG Chatbot
---

# Resume Site - Terraform IaC with RAG Chatbot

## Project Overview

This resume site (resume.jacob.steelsmith.org) is a portfolio project demonstrating AWS engineering expertise through a Terraform-only infrastructure-as-code approach. The site combines static site generation with a RAG-based AI chatbot powered by Amazon Bedrock.

## Architecture

### Static Site Layer
- Built with Astro for zero-JS static HTML generation
- Hosted on S3 with CloudFront CDN distribution
- Origin Access Control (OAC) restricts S3 access to CloudFront only
- Custom security headers: HSTS, CSP, X-Frame-Options, X-Content-Type-Options
- HTTP/2 and HTTP/3 enabled for optimal performance
- Custom 404 error page handling

### Infrastructure as Code
- Single Terraform root module managing all resources
- AWS resources: S3, CloudFront, ACM, Route 53, API Gateway, Lambda, WAF, Bedrock Knowledge Base
- GitHub resources: OIDC provider, branch protection, Actions secrets/variables
- S3 backend with DynamoDB state locking
- Environment tagging for cost tracking

### CI/CD Pipeline
- GitHub Actions with OIDC authentication (no stored credentials)
- Automated build and deploy on push to main
- PR validation with Terraform plan and Astro build checks
- Pinned action versions for reproducibility

### RAG Chatbot
- Amazon Bedrock Knowledge Base with Titan Text Embeddings V2
- OpenSearch Serverless vector store (auto-provisioned)
- Lambda function for retrieval and response generation
- API Gateway with WAF rate limiting (100 req/min global, 10 req/min per-IP)
- Content filtering for sensitive information
- Source attribution in responses

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| IaC tool | Terraform only | Single state, unified workflow, one language for all resources |
| Hosting | S3 + CloudFront | Cost-effective, globally distributed, serverless |
| Authentication | OIDC (no stored keys) | Short-lived credentials, no secret rotation needed |
| Vector store | Bedrock managed | Reduced operational overhead |
| Rate limiting | WAF + API Gateway | Per-IP via WAF, global via usage plans |

## Technologies
- Terraform (HCL)
- Astro (TypeScript)
- AWS Lambda (TypeScript)
- Amazon Bedrock (Claude 3 Haiku, Titan Embeddings V2)
- GitHub Actions
- Vitest + fast-check (testing)
