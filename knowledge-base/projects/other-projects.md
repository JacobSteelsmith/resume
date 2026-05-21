---
source-type: project
category: portfolio
title: Other Notable Projects
---

# Other Notable Projects

## Technical Blog (jacob.steelsmith.org)

A long-running technical blog hosted on AWS Amplify, showcasing a complementary deployment approach to the resume site.

### Architecture
- Astro-based static site with content collections
- AWS Amplify for managed hosting and CI/CD
- Automatic builds triggered by Git pushes
- Custom domain with SSL via Amplify

### Purpose
Demonstrates managed hosting approach (Amplify) as a contrast to the full IaC approach (Terraform) used for the resume site. Together, both sites showcase different AWS deployment strategies to prospective employers.

### Technologies
- Astro, TypeScript
- AWS Amplify
- Markdown content collections
- GitHub integration

## Infrastructure Automation Modules

A collection of reusable Terraform modules for common AWS patterns.

### Modules Developed
- Static site hosting (S3 + CloudFront + ACM + Route 53)
- Serverless API (API Gateway + Lambda + IAM)
- VPC with public/private subnets and NAT gateways
- ECS Fargate service with load balancer
- GitHub OIDC provider and deploy role

### Design Principles
- Minimal required inputs with sensible defaults
- Consistent tagging and naming conventions
- Security best practices built-in (encryption, least-privilege)
- Comprehensive outputs for cross-module composition

### Technologies
- Terraform (HCL)
- AWS (multi-service)
- GitHub Actions for module testing

## Serverless Data Pipeline

An event-driven data processing pipeline built entirely on AWS serverless services.

### Architecture
- S3 event notifications trigger Lambda functions
- Step Functions orchestrate multi-stage processing
- DynamoDB for state tracking and metadata
- SNS/SQS for decoupled communication
- CloudWatch for monitoring and alerting

### Key Features
- Zero idle cost (fully serverless)
- Automatic scaling with concurrent Lambda executions
- Dead letter queues for failed processing
- Structured logging with correlation IDs

### Technologies
- AWS Lambda (Python)
- AWS Step Functions
- Amazon DynamoDB
- Amazon S3, SNS, SQS
- Terraform for infrastructure
