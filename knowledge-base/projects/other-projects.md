# Other Notable Projects

## Portfolio & Blog Site (jacob.steelsmith.org)

A long-running technical blog hosted on AWS Amplify, demonstrating managed hosting as a contrast to the full IaC approach used for the resume site.

### Architecture
- Astro-based static site with zero client-side JavaScript
- Markdown content collections spanning 20 years of posts
- AWS Amplify for managed hosting and CI/CD
- Automatic builds triggered by Git pushes
- Custom domain with Amplify-managed SSL
- Route 53 DNS

### Design Philosophy
Demonstrates the managed hosting approach (Amplify) as a deliberate contrast to the full Terraform approach used for the resume site. Together, both sites showcase different AWS deployment strategies — simplicity vs control.

### Technologies
- Astro, TypeScript, Markdown
- AWS Amplify, Route 53

---

## Remote Proctoring Platform (National Testing Network)

Built in approximately 3 weeks during COVID disruptions, this platform replaced a $50K vendor solution and enabled continued business operations.

### Architecture
- AWS Kinesis Video Streams for video capture and streaming
- Backend services for session management and monitoring
- Real-time video processing and recording
- Custom API for proctor controls

### Impact
- Saved $50K in annual vendor costs
- Enabled business continuity during COVID-19
- Delivered in ~3 weeks from concept to production
- Supported thousands of remote testing sessions

### Technologies
- AWS Kinesis Video Streams, Lambda, API Gateway
- JavaScript, real-time streaming

---

## Real-Time Video Platform (National Testing Network)

A streaming and recording platform for testing workflows built on LiveKit and Kubernetes.

### Architecture
- LiveKit for WebRTC-based video streaming and recording
- Kubernetes (EKS) with Helm for container orchestration
- Auto-scaling based on active sessions
- Recording storage and playback workflows

### Technologies
- LiveKit, Kubernetes, EKS, Helm
- WebRTC, real-time streaming architecture

---

## MySQL-to-RDS Data API Middleware Proxy (National Testing Network)

A middleware proxy that enables standard MySQL clients to connect to AWS RDS Data API, bridging the gap between traditional database tooling and serverless database access.

### Problem Solved
AWS RDS Data API enables serverless database access but uses a proprietary HTTP API. Existing MySQL tools, ORMs, and client libraries can't connect to it directly. This proxy translates MySQL wire protocol to Data API calls.

### Impact
- Improved developer workflows by allowing familiar MySQL tools
- Enabled serverless database usage patterns without code changes
- Reduced operational complexity for serverless architectures

### Technologies
- AWS RDS Data API, MySQL protocol
- Middleware/proxy development

---

## Platform Modernization (National Testing Network)

Led the incremental modernization of a monolithic ColdFusion application to AWS-based distributed architecture over several years.

### Approach
- Strangler fig pattern: incrementally replacing monolith components
- Serverless APIs (Lambda + API Gateway) replacing legacy endpoints
- React frontend replacing server-rendered ColdFusion pages
- AWS managed services (RDS, S3, Cognito) replacing on-premises infrastructure
- CI/CD pipelines replacing manual deployments

### Impact
- Improved deployment efficiency by ~40%
- Enabled independent service development and deployment
- Reduced operational burden through managed services
- Improved system reliability and scalability

### Technologies
- AWS Lambda, API Gateway, RDS, S3, Cognito
- React, JavaScript, CFML (legacy)
- Terraform, GitHub Actions
