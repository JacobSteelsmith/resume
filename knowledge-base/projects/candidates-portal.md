---
source-type: project
category: serverless-architecture
title: Candidates Portal - React Serverless Application with AWS Amplify Gen2
---

# Candidates Portal - React Serverless Application with AWS Amplify Gen2

## Project Overview

Jacob oversaw and was a major contributor to the Candidates Portal project, a full-featured serverless web application for public safety job candidates. The application is built with React and Vite on the frontend, backed by AWS Amplify Gen2 infrastructure with over 120 Python Lambda functions connecting to Aurora Serverless MySQL via the AWS RDS Data API. The portal handles candidate registration, exam scheduling, payment processing with Stripe, document management, and job applications. Jacob was the primary developer on this project, responsible for the architecture, backend Lambda functions, frontend React components, database schema, and CI/CD pipeline.

## Architecture

### Request Flow

The Candidates Portal follows a fully serverless request flow:

1. **React Frontend** — Single-page application built with React and Vite, hosted on AWS Amplify
2. **API Gateway HTTP API** — Routes requests with JWT authorization via Cognito
3. **Python Lambda Functions** — Individual handlers for each API endpoint (120+ functions)
4. **AWS RDS Data API** — HTTP-based interface to Aurora Serverless MySQL (no persistent connections)
5. **Aurora Serverless MySQL** — Relational database with automatic scaling and pause/resume

### Infrastructure as Code

Jacob defined the entire backend using AWS CDK within Amplify Gen2's `backend.ts` configuration. This includes:

- HTTP API Gateway with JWT authorizer referencing the Cognito User Pool
- Lambda function definitions with environment-specific configurations
- IAM policies for RDS Data API, Secrets Manager, SES, S3, DynamoDB, and Cognito
- DynamoDB tables for scheduling session state management
- S3 buckets for document uploads and ID verification with lifecycle policies
- Environment detection logic for sandbox, test, and production deployments

### Shared Utilities Layer

Jacob created a shared Python utilities layer (`python_utils`) used across all Lambda functions, providing:

- `execute_sql_query` — Wrapper for RDS Data API calls with parameter binding
- `create_response` — Standardized HTTP response formatting with CORS headers
- `get_authenticated_applicant_id` — JWT token extraction and applicant identity resolution

## Design Decisions

### RDS Data API Over Traditional Connections

Jacob chose the AWS RDS Data API instead of traditional MySQL connection pooling for the following reasons:

- **No connection management** — RDS Data API is stateless and HTTP-based, eliminating connection pool exhaustion in high-concurrency Lambda environments
- **Automatic credential management** — Integrates directly with AWS Secrets Manager for database credentials without embedding connection strings
- **Serverless-friendly** — No VPC configuration required for Lambda functions, reducing cold start times and simplifying networking
- **Built-in transaction support** — Supports `BeginTransaction`, `CommitTransaction`, and `RollbackTransaction` for multi-statement operations

### Small Queries with Few Joins Pattern

#### High Lambda Concurrency Overcomes Latency

Each Lambda function execution runs in its own isolated container. When hundreds of users hit the application simultaneously, AWS spins up hundreds of concurrent Lambda instances. By keeping queries small, each individual Lambda instance finishes its database work in milliseconds. This allows the Lambda function to return quickly, keeping concurrent Lambda execution counts low and preventing timeouts.

#### HTTP Overhead vs. Database Lock Times

The RDS Data API wraps every query in an HTTPS request/response cycle. While this adds a small amount of network latency per call, it creates a significant benefit at scale:

- **Short-lived locks** — Smaller queries execute instantly inside Aurora, meaning database rows are locked for microseconds rather than seconds
- **No thread blocking** — Traditional database drivers would clog the connection pool waiting for a massive join to finish processing. The Data API thrives on a high volume of rapid, lightweight HTTPS requests.

#### Reduced CPU and Memory Spikes

When a massive query with complex joins runs on Aurora, the database engine allocates heavy CPU and memory to build temporary tables and sort data in memory. If multiple users trigger that large query at the same time, the database CPU spikes to 100%. Breaking queries down distributes that processing load evenly over time.

#### Additional Benefits
- **Improved maintainability** — Each Lambda function handles a single responsibility with one or two focused queries
- **Better error isolation** — Failures in one query path do not cascade to unrelated data retrieval

### HTTP API Gateway Over REST API Gateway

Jacob selected HTTP API Gateway for the Candidates Portal because:

- **Automatic CORS handling** — Built-in CORS configuration without manual OPTIONS method setup
- **Lower cost** — HTTP API is approximately 70% cheaper than REST API for the same request volume
- **JWT authorizer** — Native JWT validation with Cognito integration, no custom authorizer Lambda required
- **Simpler configuration** — Fewer resources to define in CDK compared to REST API

## Security Architecture

### Authentication and Authorization

- **AWS Cognito User Pool** — Manages candidate accounts with email verification, password policies, and custom auth challenges
- **JWT-based stateless auth** — Every API request includes a Cognito-issued JWT token validated by the HTTP API Gateway JWT authorizer
- **Impersonation system** — Secure admin impersonation flow using DynamoDB-stored tokens with TTL expiration
- **Custom auth challenges** — Cognito Lambda triggers for define, create, and verify auth challenge flows

### Encryption at Rest

- **AES encryption for PII** — Sensitive fields (first name, last name, address, SSN, phone numbers) are encrypted with AES in the database using encryption keys stored in AWS Secrets Manager
- **Key caching** — Encryption keys are cached in Lambda memory with a 5-minute TTL to reduce Secrets Manager API calls
- **Separate encryption keys** — Different keys for different data domains (applicant PII, practice test data)

### Input Sanitization

- **DOMPurify on frontend** — All user-generated content is sanitized before rendering to prevent XSS attacks
- **Parameterized queries** — All database queries use RDS Data API parameter binding to prevent SQL injection
- **Gitleaks integration** — Automated secret scanning in CI/CD pipeline blocks deployments containing exposed credentials

### Secrets Management

- **AWS Secrets Manager** — All sensitive configuration (database credentials, encryption keys, Stripe API keys) stored in Secrets Manager
- **Environment-specific secrets** — Separate secret ARNs for sandbox, test, and production environments
- **No hardcoded credentials** — Zero secrets in source code, enforced by Gitleaks scanning on every deployment

## Scale and Features

### Lambda Function Scale

The Candidates Portal includes over 120 Python Lambda functions covering:

- Candidate registration and profile management
- Exam scheduling with capacity checking and conflict detection
- Shopping cart with discount calculations and voucher redemption
- Payment processing with Stripe (Payment Intents, tax calculation)
- Document upload and management (applicant documents, ID verification)
- Job applications and recruitment workflows
- Email notifications via Amazon SES
- Score transfers and retest eligibility checks
- Waiver acceptance and compliance workflows
- SSO token generation for external exam platforms

### Test Scheduling System

The scheduling system manages complex exam logistics:

- Multi-step scheduling workflow with session state persisted in DynamoDB
- Capacity checking against available test center slots
- Batch scheduling for multiple exams in a single transaction
- Rescheduling and cancellation with fee calculations
- Standby queue eligibility for missed appointments

## Technologies

- React, Vite, JavaScript/TypeScript (frontend)
- Python 3.12 (Lambda functions)
- AWS Amplify Gen2, AWS CDK (infrastructure as code)
- AWS Lambda, API Gateway HTTP API (compute and routing)
- Aurora Serverless MySQL, AWS RDS Data API (database)
- AWS Cognito (authentication and user management)
- AWS Secrets Manager (credentials and encryption keys)
- Stripe Payment Intents API (payment processing)
- Amazon SES (email notifications)
- Amazon S3 (document storage)
- Amazon DynamoDB (session state management)
- Playwright (end-to-end testing)
- pytest (unit testing with process isolation)
- Gitleaks (secret scanning)
- GitHub Actions (CI/CD pipeline)
