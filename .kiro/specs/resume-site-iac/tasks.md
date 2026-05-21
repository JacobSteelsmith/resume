# Implementation Plan: Resume Site IaC

## Overview

This plan implements a resume/portfolio site at `resume.jacob.steelsmith.org` using a Terraform-only IaC approach: all AWS hosting infrastructure (S3, CloudFront, ACM, Route 53, OAC, API Gateway, Lambda, WAF, Bedrock Knowledge Base) and cross-platform resources (GitHub OIDC, branch protection, Actions secrets/variables) are managed in a single Terraform root module. The project also uses Astro for static site generation, GitHub Actions CI/CD with OIDC, and a RAG AI chatbot powered by Amazon Bedrock. Tasks are ordered to establish foundational structure first, then build infrastructure, site, chatbot, and CI/CD incrementally.

## Tasks

- [x] 1. Initialize repository structure and core configuration
  - [x] 1.1 Create repository scaffolding with .gitignore, package.json, and directory structure
    - Initialize `package.json` with Astro as primary dependency, build/dev scripts
    - Create `.gitignore` covering Node.js, Astro, Terraform, AWS artifacts
    - Create directory structure: `src/`, `public/`, `infrastructure/`, `infrastructure/terraform/`, `knowledge-base/` with subdirectories (skills, experience, projects, certifications, code-samples), `src/lambda/chat-handler/`
    - Create `README.md` documenting project purpose, directory structure, prerequisites, and deployment instructions
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

  - [x] 1.2 Configure Astro project with static output and sitemap integration
    - Create `astro.config.mjs` with `output: 'static'`, `site: 'https://resume.jacob.steelsmith.org'`, and `@astrojs/sitemap` integration
    - Create `src/layouts/BaseLayout.astro` HTML shell with nav, footer, meta tag slots
    - Create `src/components/SEOHead.astro` component for per-page title, description, OG tags, canonical URL
    - Create `src/styles/global.css` with design tokens, responsive utilities, 16px min body font, max 80ch content width
    - _Requirements: 5.1, 5.3, 6.1, 6.2, 6.3, 7.2_

  - [x] 1.3 Set up Vitest and fast-check testing framework
    - Install `vitest` and `fast-check` as dev dependencies
    - Create `vitest.config.ts` with TypeScript support
    - Create test directory structure: `tests/unit/`, `tests/properties/`
    - _Requirements: (testing infrastructure for all subsequent test tasks)_

- [x] 2. Implement Terraform hosting infrastructure
  - [x] 2.1 Create hosting.tf with S3 bucket, OAC, and bucket policy
    - Define `aws_s3_bucket` for static site hosting
    - Define `aws_s3_bucket_public_access_block` with all public access blocked (BlockPublicAcls, BlockPublicPolicy, IgnorePublicAcls, RestrictPublicBuckets)
    - Define `aws_cloudfront_origin_access_control` for S3 origin
    - Define `aws_s3_bucket_policy` allowing CloudFront-only read via OAC
    - Add `Environment` tag to all taggable resources
    - _Requirements: 2.1, 2.5, 2.20_

  - [x] 2.2 Add CloudFront distribution, ACM certificate, and Route 53 records to hosting.tf
    - Define `aws_acm_certificate` with DNS validation via the existing Route 53 zone
    - Define `aws_acm_certificate_validation` to wait for DNS validation
    - Define `aws_cloudfront_response_headers_policy` with HSTS (max-age 31536000), X-Content-Type-Options nosniff, X-Frame-Options DENY, CSP header (default-src 'self' with API endpoint allowance)
    - Define `aws_cloudfront_distribution` with S3 origin via OAC, HTTPS redirect, TLS 1.2 minimum, HTTP/2+3, compression, default root object `index.html`, custom error responses (403→/404.html with 404 status, 404→/404.html with 404 status)
    - Define `aws_route53_record` A and AAAA alias records pointing to CloudFront
    - Add outputs: `bucket_name`, `distribution_id`, `distribution_domain_name`
    - _Requirements: 2.2, 2.3, 2.4, 2.6, 2.8, 2.9, 2.10, 2.18, 2.19_

  - [ ]* 2.3 Write property test for Terraform resource tagging
    - **Property 13: Terraform resource tagging**
    - Verify all taggable resources include an `Environment` tag referencing the environment variable value
    - Parse HCL files or use `terraform plan` JSON output to verify tag presence on all taggable resource types
    - **Validates: Requirements 2.20, 13.4**

- [x] 3. Implement Terraform chatbot infrastructure
  - [x] 3.1 Create chatbot.tf with API Gateway, WAF, and Lambda resources
    - Define `aws_api_gateway_rest_api` with POST /chat resource and method
    - Define `aws_api_gateway_usage_plan` with 100 req/min global rate limit
    - Define `aws_wafv2_web_acl` with per-IP rate-based rule (10 req/min)
    - Define `aws_wafv2_web_acl_association` attaching WAF to API Gateway stage
    - Define `aws_lambda_function` for RAG agent handler
    - Define `aws_iam_role` for Lambda with least-privilege Bedrock access (scoped to specific Knowledge Base and model resources)
    - Add `Environment` tag to all taggable resources
    - Add outputs: `api_endpoint`, `knowledge_base_id`
    - _Requirements: 2.12, 2.20, 10.7, 12.1, 12.2, 12.3, 12.6, 13.5_

  - [x] 3.2 Add Bedrock Knowledge Base and S3 data source to chatbot.tf
    - Define `aws_bedrockagent_knowledge_base` with Titan Text Embeddings V2 (1024 dimensions), fixed-size chunking (1000 max tokens, 10% overlap)
    - Define `aws_bedrockagent_data_source` pointing to knowledge base S3 bucket
    - Define `aws_s3_bucket` for knowledge base content storage
    - Configure OpenSearch Serverless auto-provisioned vector store
    - Add `Environment` tag to all taggable resources
    - _Requirements: 9.4, 9.5, 9.7_

- [x] 4. Checkpoint - Validate Terraform configuration
  - Ensure the Terraform configuration passes `terraform validate`
  - Run `terraform plan` to verify resource definitions are valid
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Refactor existing Terraform and implement unified configuration
  - [x] 5.1 Create Terraform configuration with OIDC provider and IAM deploy role
    - Create `infrastructure/terraform/versions.tf` with AWS and GitHub provider version constraints, S3 backend with DynamoDB state locking
    - Create `infrastructure/terraform/variables.tf` with inputs: github_repository, s3_bucket_name, cloudfront_distribution_id, aws_account_id, aws_region, environment
    - Create `infrastructure/terraform/main.tf` with `unfunco/oidc-github/aws` module (~> 3.0) for OIDC provider and IAM role
    - Define IAM policy scoped to s3:PutObject, s3:DeleteObject, s3:ListBucket on specific bucket and cloudfront:CreateInvalidation on specific distribution
    - Create `infrastructure/terraform/outputs.tf` exporting OIDC role ARN
    - _Requirements: 2.11, 2.12, 2.15, 2.16, 2.17_

  - [x] 5.2 Add GitHub branch protection and Actions environment configuration
    - Define `github_branch_protection` for main branch (1 approval, CI status checks required)
    - Define `github_actions_environment_secret` for AWS_ACCOUNT_ID and OIDC_ROLE_ARN
    - Define `github_actions_environment_variable` for S3_BUCKET_NAME and CLOUDFRONT_DIST_ID
    - _Requirements: 2.13, 2.14_

  - [x] 5.3 Refactor main.tf into oidc.tf and github.tf, update variables.tf
    - Move OIDC provider module and IAM deploy role/policy from `main.tf` into new `oidc.tf`
    - Move GitHub branch protection, environment, secrets, and variables from `main.tf` into new `github.tf`
    - Remove `main.tf` (all content relocated to oidc.tf and github.tf)
    - Update `variables.tf` to add new hosting variables: `domain_name`, `hosted_zone_id`, `bedrock_model_id`
    - Remove `s3_bucket_name` and `cloudfront_distribution_id` variables (now managed internally by hosting.tf)
    - Update IAM deploy policy to reference the internally-managed S3 bucket and CloudFront distribution
    - Update `outputs.tf` to include hosting outputs (bucket_name, distribution_id, distribution_domain_name) and chatbot outputs (api_endpoint, knowledge_base_id)
    - _Requirements: 2.6, 2.16_

  - [x] 5.4 Delete obsolete CloudFormation template
    - Delete `infrastructure/template.yaml` (all resources now managed by Terraform)
    - Update `README.md` to remove CloudFormation references and document Terraform-only approach
    - _Requirements: (cleanup)_

- [x] 6. Implement GitHub Actions CI/CD pipeline
  - [x] 6.1 Create deploy workflow with OIDC authentication, build, and deploy jobs
    - Create `.github/workflows/deploy.yml` with `id-token: write`, `contents: read` permissions
    - Define `build` job: checkout, setup-node, install deps, build Astro, upload artifact
    - Define `deploy-production` job (main push only): download artifact, OIDC auth via `aws-actions/configure-aws-credentials@v4`, `aws s3 sync dist/`, CloudFront invalidation for all paths
    - Pin all GitHub Actions to specific versions (checkout@v4, setup-node@v4, configure-aws-credentials@v4, upload-artifact@v4, download-artifact@v4)
    - _Requirements: 3.1, 3.2, 3.3, 3.5, 3.7_

  - [x] 6.2 Add PR validation job with linting and Terraform validation
    - Define `validate` job triggered on pull_request to main
    - Run Astro build to verify site compiles
    - Run `terraform validate` on infrastructure/terraform/
    - Run `terraform plan` to preview changes
    - Report failures via GitHub Actions workflow status
    - _Requirements: 3.4, 3.5, 3.6_

- [x] 7. Implement static site pages and components
  - [x] 7.1 Create responsive navigation component with mobile menu
    - Create `src/components/Navigation.astro` with responsive nav
    - Implement collapsible mobile menu for viewports below 768px
    - Ensure touch targets ≥44x44px, keyboard operability, ARIA labels
    - Include links to all pages: Home, Resume, Projects, Architecture, Contact
    - _Requirements: 6.1, 6.3, 6.4_

  - [x] 7.2 Create homepage and contact page
    - Create `src/pages/index.astro` with professional introduction highlighting cloud platform engineering, AWS expertise, serverless/distributed systems, technical leadership
    - Create `src/pages/contact.astro` with email address, LinkedIn link, GitHub profile link
    - Apply SEOHead component with unique title, description, OG tags for each page
    - _Requirements: 4.2, 4.6, 5.1, 5.2, 5.3_

  - [x] 7.3 Create resume page with structured sections
    - Create `src/pages/resume.astro` with sections for skills, work experience, certifications, accomplishments
    - Apply responsive layout with semantic HTML, proper heading hierarchy
    - Apply SEOHead component with unique metadata
    - _Requirements: 4.3, 6.1, 6.4_

  - [x] 7.4 Create projects page with project cards
    - Create `src/components/ProjectCard.astro` for project display
    - Create `src/pages/projects.astro` showcasing key projects with descriptions, technologies, source links
    - Apply SEOHead component with unique metadata
    - _Requirements: 4.4_

  - [x] 7.5 Create architecture page documenting site infrastructure
    - Create `src/pages/architecture.astro` with component diagrams, CI/CD pipeline documentation
    - Include at least 3 design decisions with alternatives considered and rationale
    - Ensure page is included in main navigation
    - _Requirements: 4.5, 4.7_

  - [x] 7.6 Create 404 error page and robots.txt
    - Create `src/pages/404.astro` for custom error page
    - Create `public/robots.txt` allowing all crawlers with sitemap reference
    - Verify sitemap generation at `/sitemap.xml` via Astro sitemap integration
    - _Requirements: 5.4, 5.5_

  - [ ]* 7.7 Write property test for SEO metadata completeness
    - **Property 1: SEO metadata completeness**
    - For each generated HTML page, verify unique title, meta description, OG tags, and canonical URL
    - Verify no two pages share the same title or description
    - **Validates: Requirements 5.1, 5.2, 5.3**

  - [ ]* 7.8 Write property test for internal link resolution
    - **Property 2: Internal link resolution**
    - For all internal links in built HTML, verify referenced files exist in `dist/`
    - **Validates: Requirements 4.8**

- [x] 8. Checkpoint - Verify site builds and infrastructure validates
  - Ensure `astro build` succeeds with zero errors
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Implement knowledge base content and ingestion pipeline
  - [x] 9.1 Create knowledge base content files with YAML frontmatter
    - Create content files in `knowledge-base/skills/`, `knowledge-base/experience/`, `knowledge-base/projects/`, `knowledge-base/certifications/`
    - Create code sample files in `knowledge-base/code-samples/` with language and project metadata
    - Each file includes YAML frontmatter with source-type, category, title, and optional language/project fields
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [ ]* 9.2 Write property test for knowledge base file metadata validity
    - **Property 3: Knowledge base file metadata validity**
    - For any file in knowledge-base/, verify valid YAML frontmatter with source-type matching allowed categories and title field present
    - **Validates: Requirements 8.1**

  - [x] 9.3 Implement ingestion pipeline script with chunking and content exclusion
    - Create ingestion script (TypeScript) that reads knowledge-base files, chunks content (500-1000 tokens, 50-100 token overlap)
    - Implement content exclusion filter for "National Testing Network", "NTN", "Ergometrics", encryption key patterns
    - Implement error handling: skip empty/unparseable files, log errors with file identifiers
    - Produce summary report (files processed, chunks generated, embeddings stored, files skipped)
    - Integrate with Bedrock embedding API for vector generation
    - Support re-ingestion by deleting previous embeddings for updated source documents
    - _Requirements: 8.5, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9, 9.10_

  - [ ]* 9.4 Write property test for chunking size and overlap invariants
    - **Property 4: Chunking size and overlap invariants**
    - For any valid text input, verify all chunks are 500-1000 tokens and consecutive chunks share 50-100 tokens overlap
    - **Validates: Requirements 9.1**

  - [ ]* 9.5 Write property test for code sample metadata preservation
    - **Property 5: Code sample metadata preservation**
    - For code sample files with language/project metadata, verify chunking preserves these associations in chunk metadata
    - **Validates: Requirements 9.3**

  - [ ]* 9.6 Write property test for ingestion error resilience
    - **Property 6: Ingestion error resilience**
    - For batches with some empty/unparseable files, verify pipeline skips invalid files, processes valid ones, and produces accurate summary
    - **Validates: Requirements 9.8, 9.9**

  - [ ]* 9.7 Write property test for ingestion content exclusion
    - **Property 7: Ingestion content exclusion**
    - For chunks containing sensitive terms, verify they are excluded and not stored
    - **Validates: Requirements 9.10**

- [x] 10. Implement RAG Lambda function
  - [x] 10.1 Create Lambda handler with input validation and Bedrock integration
    - Create `src/lambda/chat-handler/index.ts` with ChatRequest/ChatResponse interfaces
    - Implement input validation (question present, ≤500 chars)
    - Integrate with Bedrock Knowledge Base `RetrieveAndGenerate` API (top 5 chunks, relevance threshold filtering)
    - Implement "not enough information" fallback when zero chunks pass threshold
    - Scope responses to professional topics only
    - Limit response to 1024 tokens maximum
    - _Requirements: 10.1, 10.2, 10.4, 10.5, 10.7, 10.8_

  - [x] 10.2 Implement response content filtering and source attribution
    - Implement sensitive term filter for "National Testing Network", "NTN", "Ergometrics", encryption key patterns
    - Replace occurrences with `[REDACTED]` marker
    - Format source attributions (title, category) from retrieved chunks
    - Return 503 with "service temporarily unavailable" if Bedrock is unavailable
    - _Requirements: 10.3, 10.6, 10.8_

  - [ ]* 10.3 Write property test for retrieval threshold filtering
    - **Property 8: Retrieval threshold filtering**
    - For any set of chunks with similarity scores, verify only chunks at/above threshold are included, max 5 chunks, and fallback message when zero pass
    - **Validates: Requirements 10.1, 10.4**

  - [ ]* 10.4 Write property test for source attribution presence
    - **Property 9: Source attribution presence**
    - For any response generated from non-empty context chunks, verify source attributions are present
    - **Validates: Requirements 10.3**

  - [ ]* 10.5 Write property test for response content filtering
    - **Property 10: Response content filtering**
    - For any response text, verify all sensitive terms are replaced with [REDACTED] and final output contains zero sensitive terms
    - **Validates: Requirements 10.6**

- [x] 11. Implement chat widget frontend
  - [x] 11.1 Create chat widget component with UI and accessibility
    - Create `src/components/ChatWidget.astro` as collapsible overlay with persistent trigger button
    - Implement text input with 500-character limit and character count indicator
    - Implement loading indicator, error display, timeout handling (30s), retry button
    - Ensure keyboard operability, touch targets ≥44x44px, ARIA labels
    - Display on all pages via BaseLayout
    - _Requirements: 11.1, 11.2, 11.3, 11.5, 11.6, 11.8_

  - [x] 11.2 Implement chat widget client-side logic with sessionStorage
    - Create `src/components/ChatWidget.ts` with ChatMessage/ChatState interfaces
    - Implement API call to POST /chat endpoint with 30s timeout
    - Store/retrieve conversation history in sessionStorage under `resume-chat-history`
    - Display RAG_Agent responses with source attributions
    - Handle error states (timeout, API errors, rate limiting)
    - _Requirements: 11.4, 11.6, 11.7_

  - [ ]* 11.3 Write property test for chat input validation
    - **Property 11: Chat input validation**
    - For any string input, verify character count equals actual length; for strings >500 chars, verify submission is prevented
    - **Validates: Requirements 11.2, 11.3, 12.5**

  - [ ]* 11.4 Write property test for conversation history round-trip
    - **Property 12: Conversation history round-trip**
    - For any valid ChatMessage array, verify serializing to sessionStorage and deserializing back produces equivalent data
    - **Validates: Requirements 11.7**

- [x] 12. Checkpoint - Full integration verification
  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. Final wiring and CSP header update
  - [x] 13.1 Update Terraform CSP header to allow chat API endpoint
    - Update Content-Security-Policy in the `aws_cloudfront_response_headers_policy` in `hosting.tf` to allow connect-src to the API Gateway endpoint
    - Verify all resource loading restrictions remain (default-src 'self' with API endpoint allowance)
    - _Requirements: 2.9_

  - [x] 13.2 Wire all components together and verify end-to-end flow
    - Ensure chat widget API URL references the correct API Gateway endpoint (via environment variable or build-time config)
    - Verify Astro build produces complete self-contained output
    - Verify all internal links resolve within dist/
    - Verify sitemap.xml and robots.txt are generated correctly
    - _Requirements: 4.8, 5.4, 5.5_

- [x] 14. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The project uses TypeScript for application code (Astro site, Lambda) and HCL for Terraform
- Testing uses Vitest with fast-check for property-based tests
- All infrastructure must be deployed in us-east-1 (ACM requirement for CloudFront)
- Terraform state uses S3 backend with DynamoDB locking
- Tasks 5.1 and 5.2 are complete (OIDC + GitHub config exists in main.tf); task 5.3 refactors into the new file structure (oidc.tf, github.tf)
- The obsolete CloudFormation template.yaml is removed in task 5.4

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3"] },
    { "id": 2, "tasks": ["5.3", "7.1"] },
    { "id": 3, "tasks": ["2.1", "5.4", "7.2", "7.3", "7.4", "7.5", "7.6"] },
    { "id": 4, "tasks": ["2.2", "7.7", "7.8"] },
    { "id": 5, "tasks": ["2.3", "3.1", "6.1", "6.2"] },
    { "id": 6, "tasks": ["3.2", "9.1"] },
    { "id": 7, "tasks": ["9.2", "9.3"] },
    { "id": 8, "tasks": ["9.4", "9.5", "9.6", "9.7", "10.1"] },
    { "id": 9, "tasks": ["10.2", "10.3", "10.4", "10.5"] },
    { "id": 10, "tasks": ["11.1"] },
    { "id": 11, "tasks": ["11.2", "11.3", "11.4"] },
    { "id": 12, "tasks": ["13.1", "13.2"] }
  ]
}
```
