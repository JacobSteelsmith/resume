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
- CloudFront Function for directory index rewriting

### RAG Chatbot
- Amazon Bedrock Knowledge Base with Titan Text Embeddings V2
- OpenSearch Serverless vector store
- Lambda function for retrieval and response generation using Claude Haiku 4.5
- API Gateway with WAF rate limiting
- Source attribution in responses

### CI/CD Pipeline
- GitHub Actions with OIDC authentication (no stored credentials)
- Automated build, deploy, and knowledge base ingestion on push to master
- Lambda function deployment
- CloudFront cache invalidation

### Infrastructure as Code
- Single Terraform root module managing all AWS and GitHub resources
- OpenSearch provider for vector index management
- S3 backend with state locking

## Technologies
- Terraform (HCL), Astro (TypeScript), AWS Lambda (JavaScript)
- Amazon Bedrock (Claude Haiku 4.5, Titan Embeddings V2)
- OpenSearch Serverless, API Gateway, CloudFront, S3, WAF
- GitHub Actions with OIDC
