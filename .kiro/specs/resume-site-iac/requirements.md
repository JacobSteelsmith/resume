# Requirements Document

## Introduction

This document defines the requirements for a resume/portfolio site hosted at `resume.jacob.steelsmith.org`, built in a new repository (`/home/steelsmith/code/resume`). The project demonstrates AWS engineering expertise through a Terraform-only Infrastructure-as-Code approach: all AWS hosting infrastructure (S3, CloudFront, ACM, Route 53, OAC, API Gateway, Lambda, WAF, Bedrock Knowledge Base) and cross-platform resources (GitHub configuration, IAM OIDC provider) are managed by Terraform. The site also includes a RAG-based AI chatbot powered by Amazon Bedrock that allows visitors to ask natural language questions about the site owner's career, skills, and projects.

This project is intentionally separate from the existing blog at `jacob.steelsmith.org` (hosted via AWS Amplify in the `portfolio` repository). Together, the two sites showcase complementary deployment approaches to prospective employers: managed hosting (Amplify) for the blog and full IaC (Terraform) for the resume site.

**Infrastructure-as-Code Approach:** Terraform is the sole IaC tool for this project, managing all AWS infrastructure (S3, CloudFront, ACM, Route 53, OAC, API Gateway, Lambda, WAF, Bedrock Knowledge Base) and cross-platform resources (GitHub repository settings, branch protection rules, GitHub Actions environment secrets/variables, IAM OIDC identity provider). The DNS zone `steelsmith.org` is already hosted in Route 53.

## Glossary

- **Astro_Builder**: The Astro static site generator responsible for reading content and producing static HTML/CSS/JS output
- **Terraform_Config**: The Terraform configuration managing all infrastructure for the resume site, including AWS hosting resources (S3, CloudFront, ACM, Route 53, OAC, API Gateway, Lambda, WAF, Bedrock Knowledge Base), IAM OIDC identity provider for GitHub Actions, and cross-platform resources (GitHub repository settings, branch protection, Actions secrets/variables)
- **CI_CD_Pipeline**: The GitHub Actions workflow responsible for building, testing, and deploying the resume site
- **CloudFront_Distribution**: The AWS CloudFront CDN distribution serving the static resume site
- **S3_Bucket**: The AWS S3 bucket storing the built static site assets
- **OAC_Policy**: The Origin Access Control policy restricting S3 access to CloudFront only
- **OIDC_Auth**: The OpenID Connect authentication mechanism used by GitHub Actions to assume AWS IAM roles without long-lived credentials
- **Ingestion_Pipeline**: The data pipeline that processes content sources (resume, skills, project descriptions, code samples) into vector embeddings and stores them in the Vector_Database
- **Vector_Database**: The vector store (Amazon Bedrock Knowledge Bases) holding embedded content chunks for semantic retrieval
- **RAG_Agent**: The Retrieval-Augmented Generation chat agent powered by Amazon Bedrock that answers visitor questions about career, skills, and projects
- **Knowledge_Base**: The structured content source (Markdown/JSON files) containing detailed skills, experience, projects, certifications, and code samples used as input to the Ingestion_Pipeline
- **Bedrock_Model**: The Amazon Bedrock foundation model used by the RAG_Agent to generate conversational responses grounded in retrieved context
- **Chat_Widget**: The frontend UI component embedded in the site that allows visitors to interact with the RAG_Agent
- **API_Gateway**: The Amazon API Gateway endpoint that exposes the RAG_Agent Lambda function as a REST API
- **Resume_Repository**: The GitHub repository (`JacobSteelsmith/resume`) containing the resume site source code, infrastructure definitions, and knowledge base content

## Requirements

### Requirement 1: Repository Initialization

**User Story:** As a site owner, I want the resume site initialized as a new standalone repository so that it is cleanly separated from the blog and can be independently deployed and maintained.

#### Acceptance Criteria

1. THE Resume_Repository SHALL be initialized with a Git repository containing a `.gitignore` file appropriate for Node.js, Astro, Terraform, and AWS artifacts
2. THE Resume_Repository SHALL contain a `package.json` with Astro as the primary dependency and build/dev scripts configured
3. THE Resume_Repository SHALL contain an Astro project structure with `src/`, `public/`, and `astro.config.mjs` configured for fully static output
4. THE Resume_Repository SHALL contain an `infrastructure/terraform/` directory with Terraform configuration files managing all AWS and GitHub resources
5. THE Resume_Repository SHALL contain a `knowledge-base/` directory with subdirectories for content categories (skills, experience, projects, certifications, code-samples)
6. THE Resume_Repository SHALL contain a `README.md` documenting the project purpose, directory structure, prerequisites, and deployment instructions

### Requirement 2: Terraform Infrastructure

**User Story:** As a site owner, I want all infrastructure defined in Terraform so that the entire hosting stack, chatbot backend, and GitHub configuration are documented, version-controlled, and demonstrate AWS engineering expertise through a single IaC tool.

#### Acceptance Criteria

1. THE Terraform_Config SHALL provision an S3_Bucket configured for static website hosting with all public access blocked via S3 Block Public Access settings (BlockPublicAcls, BlockPublicPolicy, IgnorePublicAcls, RestrictPublicBuckets all set to true)
2. THE Terraform_Config SHALL provision a CloudFront_Distribution with the S3_Bucket as origin using OAC_Policy, a default root object of `index.html`, and custom error responses that return `/404.html` with a 404 status for 403 and 404 origin errors
3. THE Terraform_Config SHALL provision an ACM certificate for `resume.jacob.steelsmith.org` with DNS validation via the existing Route 53 hosted zone for `steelsmith.org`
4. THE Terraform_Config SHALL provision Route 53 alias records (A and AAAA) in the `steelsmith.org` hosted zone pointing `resume.jacob.steelsmith.org` to the CloudFront_Distribution
5. THE Terraform_Config SHALL configure the OAC_Policy so that only the CloudFront_Distribution can read objects from the S3_Bucket
6. THE Terraform_Config SHALL accept the domain name (`resume.jacob.steelsmith.org`) and the Route 53 hosted zone ID for `steelsmith.org` as input variables and export the S3_Bucket name, CloudFront_Distribution ID, and CloudFront_Distribution domain name as outputs
7. THE Terraform_Config SHALL pass `terraform validate` without errors
8. THE Terraform_Config SHALL configure the CloudFront_Distribution to enforce HTTPS with HTTP-to-HTTPS redirect and a minimum TLS version of TLS 1.2
9. THE Terraform_Config SHALL configure a CloudFront response headers policy that sets Strict-Transport-Security with a max-age of at least 31536000 seconds, X-Content-Type-Options set to nosniff, X-Frame-Options set to DENY, and a Content-Security-Policy header restricting resource loading to same-origin by default with allowances for the Chat_Widget API endpoint
10. THE Terraform_Config SHALL be deployable in us-east-1 because ACM certificates for CloudFront must reside in that region
11. THE Terraform_Config SHALL provision an IAM OIDC identity provider for GitHub Actions using the `unfunco/oidc-github/aws` module
12. THE Terraform_Config SHALL provision an IAM role assumable by GitHub Actions via OIDC that permits only s3:PutObject, s3:DeleteObject, and s3:ListBucket on the specific S3_Bucket and cloudfront:CreateInvalidation on the specific CloudFront_Distribution
13. THE Terraform_Config SHALL provision GitHub branch protection on the main branch requiring at least one pull request review approval and passing CI status checks before merge
14. THE Terraform_Config SHALL provision GitHub Actions environment secrets (AWS_ACCOUNT_ID, OIDC_ROLE_ARN) and environment variables (S3_BUCKET_NAME, CLOUDFRONT_DIST_ID) for the production environment
15. THE Terraform_Config SHALL use an S3 backend for state storage with DynamoDB for state locking
16. THE Terraform_Config SHALL accept the GitHub repository name, S3 bucket name, CloudFront distribution ID, and AWS account ID as input variables
17. THE Terraform_Config SHALL export the OIDC role ARN as an output value
18. THE Terraform_Config SHALL enable HTTP/2 and HTTP/3 on the CloudFront_Distribution for optimal transfer performance
19. THE Terraform_Config SHALL enable compression for text-based content types on the CloudFront_Distribution
20. THE Terraform_Config SHALL tag all resources with an Environment tag for cost tracking and resource identification

### Requirement 3: GitHub Actions CI/CD Pipeline

**User Story:** As a site owner, I want a GitHub Actions pipeline with OIDC authentication so that deployments are automated and use short-lived credentials instead of stored secrets.

#### Acceptance Criteria

1. WHEN a commit is pushed to the main branch, THE CI_CD_Pipeline SHALL build the Astro site and deploy the output to the production S3_Bucket
2. THE CI_CD_Pipeline SHALL authenticate to AWS using OIDC_Auth to assume an IAM role without long-lived access keys
3. WHEN a deployment to S3 completes, THE CI_CD_Pipeline SHALL create a CloudFront invalidation for all paths to clear cached content
4. WHEN a pull request is opened or updated against the main branch, THE CI_CD_Pipeline SHALL build the Astro site and run linting and validation checks without deploying
5. IF the build or deployment fails, THEN THE CI_CD_Pipeline SHALL halt the pipeline and report the failure via the GitHub Actions workflow status on the associated commit or pull request
6. THE CI_CD_Pipeline SHALL validate the Terraform configuration using `terraform validate` and `terraform plan` as part of the CI checks on pull requests
7. THE CI_CD_Pipeline SHALL use pinned versions for all GitHub Actions and dependencies to ensure reproducible builds

### Requirement 4: Static Resume Site Generation

**User Story:** As a site owner, I want the resume site generated as static HTML at build time so that no server-side runtime is required and pages load quickly.

#### Acceptance Criteria

1. THE Astro_Builder SHALL produce static HTML, CSS, and JavaScript files for all pages at build time, with output configured for fully static generation requiring no server-side runtime to serve
2. THE Astro_Builder SHALL generate a homepage with a professional introduction highlighting cloud platform engineering, AWS expertise, serverless/distributed systems, and technical leadership
3. THE Astro_Builder SHALL generate a Resume page presenting content organized into distinct sections for skills, work experience, certifications, and accomplishments
4. THE Astro_Builder SHALL generate a Projects page showcasing key projects with descriptions, technologies used, and links to source code where available
5. THE Astro_Builder SHALL generate an Architecture page documenting how the resume site infrastructure is built, including component diagrams, CI/CD pipeline documentation, and at least 3 design decisions with alternatives and rationale
6. THE Astro_Builder SHALL generate a Contact page displaying at least an email address and links to LinkedIn and GitHub profiles
7. THE Astro_Builder SHALL include the Architecture page in the site's main navigation
8. IF the build completes successfully, THEN THE Astro_Builder SHALL produce a self-contained output directory where all internal links resolve to files within that directory

### Requirement 5: SEO and Metadata

**User Story:** As a site owner, I want proper SEO metadata on every page so that search engines and social media platforms display my content correctly.

#### Acceptance Criteria

1. THE Astro_Builder SHALL render a unique `<title>` tag and `<meta name="description">` tag for each page
2. THE Astro_Builder SHALL render Open Graph meta tags (og:title, og:description, og:type, og:url) for each page using og:type "website" for all pages
3. THE Astro_Builder SHALL render a canonical URL `<link rel="canonical">` tag for each page using the absolute URL on `resume.jacob.steelsmith.org`
4. THE Astro_Builder SHALL produce a `robots.txt` file allowing all crawlers and referencing the sitemap location
5. THE Astro_Builder SHALL produce an XML sitemap at `/sitemap.xml` conforming to the Sitemaps.org protocol 0.9 schema, listing all pages on the site

### Requirement 6: Responsive Layout and Accessibility

**User Story:** As a visitor, I want the site to be readable and visually polished on any device so that I have a good experience on mobile, tablet, and desktop.

#### Acceptance Criteria

1. THE Astro_Builder SHALL render all pages using a responsive layout that adapts to viewport widths from 320px to 2560px without horizontal scrolling and without content overflowing the viewport
2. THE Astro_Builder SHALL use a consistent typographic scale with a minimum body font size of 16px and constrain content width to a maximum of 80 characters per line on viewports wider than 1200px
3. WHILE the viewport width is below 768px, THE Astro_Builder SHALL render navigation as a collapsible menu that is operable via touch targets of at least 44x44px and accessible via keyboard
4. THE Astro_Builder SHALL produce valid semantic HTML with no skipped heading levels, alt text on all non-decorative images, and ARIA labels on all interactive elements that lack visible text labels
5. THE Astro_Builder SHALL produce pages that achieve a Lighthouse Accessibility score of 90 or above when tested in mobile mode on the homepage and resume page

### Requirement 7: Performance

**User Story:** As a site owner, I want the site to load quickly so that it demonstrates engineering quality and provides a good visitor experience.

#### Acceptance Criteria

1. THE Astro_Builder SHALL produce pages that achieve a Lighthouse Performance score of 90 or above when tested in mobile mode on the homepage and resume page
2. THE Astro_Builder SHALL produce pages with a total page weight under 300KB for the homepage and static pages (excluding images within content sections)

### Requirement 8: Knowledge Base Content Authoring

**User Story:** As a site owner, I want to maintain a structured knowledge base of my skills, experience, and projects so that the RAG agent has rich, accurate content to draw from when answering visitor questions.

#### Acceptance Criteria

1. THE Knowledge_Base SHALL consist of Markdown or JSON files stored in the `knowledge-base/` directory within the Resume_Repository, with each file containing a metadata header identifying its content category (skills, work experience, projects, certifications, or career narrative)
2. THE Knowledge_Base SHALL include at least one code sample file per claimed language or framework, with each code sample file annotated with metadata specifying the programming language and the associated project or skill area
3. THE Knowledge_Base SHALL organize files using a directory structure that separates content by category (skills, experience, projects, certifications, code-samples) so that the Ingestion_Pipeline can discover and classify content by path
4. THE Knowledge_Base SHALL include content covering the resume page, dedicated skills/project description files, and representative code samples, with each content source identifiable by a source-type metadata field
5. WHEN a commit modifying files in the `knowledge-base/` directory is pushed to the repository, THE Ingestion_Pipeline SHALL be manually triggerable via a CI workflow dispatch or CLI command to re-process the changed content

### Requirement 9: Vector Embedding Ingestion Pipeline

**User Story:** As a site owner, I want an automated pipeline that converts my knowledge base content into vector embeddings so that the RAG agent can perform semantic search over my career information.

#### Acceptance Criteria

1. THE Ingestion_Pipeline SHALL chunk Knowledge_Base content into segments of 500–1000 tokens per chunk with an overlap of 50–100 tokens between consecutive chunks
2. THE Ingestion_Pipeline SHALL support ingestion of Markdown text content (experience, skills, project descriptions) and code sample files
3. WHEN processing code samples, THE Ingestion_Pipeline SHALL preserve language metadata and associate the code with its parent project or skill context based on the Knowledge_Base directory structure or file-level metadata
4. THE Ingestion_Pipeline SHALL generate vector embeddings for each chunk using an Amazon Bedrock embedding model
5. THE Ingestion_Pipeline SHALL store the embeddings and associated metadata (source type, language, project, skill area) in the Vector_Database
6. WHEN the Ingestion_Pipeline processes updated content, THE Ingestion_Pipeline SHALL delete all embeddings previously generated from the affected source documents and store newly generated embeddings in their place
7. THE Ingestion_Pipeline SHALL be defined as infrastructure-as-code in the Terraform_Config or as a reproducible script within the Resume_Repository
8. IF the Amazon Bedrock embedding API call fails or a Knowledge_Base source file is empty or unparseable, THEN THE Ingestion_Pipeline SHALL log the error with the affected source file identifier, skip the failed item, and continue processing remaining content
9. WHEN the Ingestion_Pipeline completes a run, THE Ingestion_Pipeline SHALL produce a summary report indicating the number of source files processed, chunks generated, embeddings stored, and any files that were skipped due to errors
10. WHEN processing content, THE Ingestion_Pipeline SHALL filter out and exclude any content chunk that references "National Testing Network", "NTN", "Ergometrics", or any encryption keys, and SHALL NOT store embeddings for excluded chunks in the Vector_Database

### Requirement 10: RAG Chat Agent on Amazon Bedrock

**User Story:** As a visitor, I want to ask natural language questions about the site owner's career, skills, and projects so that I can quickly find relevant information without reading every page.

#### Acceptance Criteria

1. WHEN a visitor submits a question through the Chat_Widget, THE RAG_Agent SHALL retrieve the top 5 most semantically similar chunks from the Vector_Database and discard any chunk with a similarity score below the configured relevance threshold
2. WHEN the RAG_Agent has relevant context chunks, THE RAG_Agent SHALL generate a conversational response using the Bedrock_Model with the retrieved chunks as grounding context, limited to 1024 tokens maximum
3. WHEN the RAG_Agent generates a response, THE RAG_Agent SHALL include source attributions identifying the origin content by title, project name, or skill area
4. IF all retrieved chunks fall below the relevance threshold, THEN THE RAG_Agent SHALL return a message stating it does not have enough information to answer the question
5. THE RAG_Agent SHALL scope responses to career, skills, projects, and professional topics only, and SHALL decline to answer questions unrelated to the site owner's professional background
6. WHEN the RAG_Agent generates a response, THE RAG_Agent SHALL filter the response text for sensitive terms ("National Testing Network", "NTN", "Ergometrics", encryption key patterns) and replace any occurrences with a redaction marker or return a safe fallback message
7. THE RAG_Agent SHALL be deployed as a Lambda function invoked through the API_Gateway
8. IF the Bedrock_Model is unavailable or returns an error, THEN THE RAG_Agent SHALL return a message indicating the service is temporarily unavailable

### Requirement 11: Chat Widget Frontend

**User Story:** As a visitor, I want an embedded chat interface on the resume site so that I can ask questions without leaving the page.

#### Acceptance Criteria

1. THE Chat_Widget SHALL render as a collapsible overlay with a persistent trigger button visible on all pages
2. THE Chat_Widget SHALL accept text input up to 500 characters and display a character count indicator
3. IF a visitor submits a question exceeding 500 characters, THEN THE Chat_Widget SHALL prevent submission and display an error message indicating the maximum length
4. THE Chat_Widget SHALL display the RAG_Agent response along with source attributions when available
5. THE Chat_Widget SHALL display a loading indicator while awaiting a response from the RAG_Agent
6. IF the API response takes longer than 30 seconds, THEN THE Chat_Widget SHALL display a timeout error message and enable a retry button
7. THE Chat_Widget SHALL store conversation history in sessionStorage so that navigating between pages preserves the chat history within the same browser session
8. THE Chat_Widget SHALL be keyboard-operable with touch targets of at least 44x44px and include appropriate ARIA labels for accessibility

### Requirement 12: API Gateway and Rate Limiting

**User Story:** As a site owner, I want rate limiting on the chat API so that the service is protected from abuse and costs remain predictable.

#### Acceptance Criteria

1. THE API_Gateway SHALL expose a POST endpoint at `/chat` that accepts a JSON body with a `question` field
2. THE API_Gateway SHALL enforce a global rate limit of 100 requests per minute
3. THE API_Gateway SHALL enforce a per-IP rate limit of 10 requests per minute
4. WHEN a request exceeds the rate limit, THE API_Gateway SHALL return an HTTP 429 response with a JSON body containing an error message indicating the rate limit has been exceeded
5. THE API_Gateway SHALL validate that the `question` field is present and does not exceed 500 characters, returning an HTTP 400 response for invalid requests
6. THE API_Gateway SHALL be defined as infrastructure-as-code within the Terraform_Config

### Requirement 13: Security Baseline

**User Story:** As a site owner, I want security best practices applied from the start so that the site and infrastructure are protected against common threats.

#### Acceptance Criteria

1. THE S3_Bucket SHALL block all public access and allow reads only through the OAC_Policy
2. THE CI_CD_Pipeline SHALL use OIDC_Auth with an IAM role scoped to only the permissions required for deployment (s3:PutObject, s3:DeleteObject, s3:ListBucket on the specific bucket; cloudfront:CreateInvalidation on the specific distribution)
3. THE Terraform_Config SHALL store no secrets in plain text within the repository; all sensitive values SHALL be provided via environment variables or secret management
4. THE Terraform_Config SHALL tag all resources with an Environment tag for cost tracking and resource identification
5. THE RAG_Agent Lambda function SHALL use an execution role with least-privilege permissions scoped to the specific Bedrock Knowledge Base and model resources it requires
