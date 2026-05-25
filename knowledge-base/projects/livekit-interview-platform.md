---
source-type: project
category: real-time-infrastructure
title: LiveKit Online Interview Platform - EKS Kubernetes Deployment
---

# LiveKit Online Interview Platform - EKS Kubernetes Deployment

## Project Overview

Jacob designed and deployed a real-time video interview platform built on LiveKit and Amazon EKS (Elastic Kubernetes Service). The platform provides WebRTC-based video and audio communication for conducting online interviews, with automatic session recording stored in S3. The architecture follows cloud-native Kubernetes patterns with containerized workloads, Helm-based deployments, Application Load Balancer ingress, and Horizontal Pod Autoscaler for elastic capacity. Jacob managed the full infrastructure lifecycle including cluster provisioning with eksctl, Kubernetes upgrades across multiple versions, and Helm chart configuration for both the LiveKit server and egress (recording) services.

## Architecture

### EKS Cluster Infrastructure

Jacob provisioned and manages the EKS cluster using eksctl with declarative YAML cluster configurations. The cluster runs Kubernetes 1.33 in the us-west-2 region with managed node groups using c6i.2xlarge compute-optimized EC2 instances. The architecture deploys across multiple Availability Zones for high availability, with managed node groups configured for auto-scaling between 2 and 4 nodes.

Key infrastructure components:
- Amazon EKS managed control plane (Kubernetes 1.33)
- Managed node groups with c6i.2xlarge instances (compute-optimized for media processing)
- Multi-AZ deployment for fault tolerance
- AWS Load Balancer Controller for ALB ingress provisioning
- ElastiCache Serverless (Redis) for LiveKit state coordination
- Custom security groups with CloudFormation for WebRTC traffic (TURN/UDP, ICE/TCP, ICE/UDP ranges)

### Helm-Based Application Deployment

Jacob deploys and manages the LiveKit platform using official Helm charts with custom values files:

- **LiveKit Server Helm Chart**: Deploys the core WebRTC signaling and media routing server with 2 replicas, pod anti-affinity rules ensuring distribution across nodes, rolling update strategy, and host networking for optimal media performance
- **LiveKit Egress Helm Chart**: Deploys the recording service with separate scaling configuration, S3 output integration, and pod anti-affinity for reliability

Helm commands manage the full deployment lifecycle including installs, upgrades with version pinning, and rollbacks.

### ALB Ingress and Networking

The platform uses the AWS Load Balancer Controller to provision an Application Load Balancer (ALB) for internet-facing traffic:

- ALB routes HTTPS and WebSocket traffic to LiveKit server pods
- SSL/TLS termination at the load balancer for secure connections
- Domain-based routing for the SFU (Selective Forwarding Unit) endpoint
- TURN server integration for NAT traversal with dedicated UDP/TCP ports
- Security group rules for WebRTC media ports: TURN/UDP (3478), ICE/TCP (7881), ICE/UDP range (50000–60000)

### S3 Recording Storage

Interview recordings are stored in Amazon S3 using the LiveKit Egress service:

- HLS segmented output format with M3U8 playlists for web playback
- Organized folder structure: `{applicationId}/{examApplicationId}/{filename}`
- Composite recording combining interviewer and candidate video/audio tracks
- Automatic upload from egress pods to the dedicated S3 bucket
- 6-second segment duration for near-real-time availability

Jacob integrated the interview playback functionality into several legacy portals, enabling the review of recorded interview sessions directly within existing workflows without switching to a separate application.

### HPA Auto-Scaling

Jacob configured Horizontal Pod Autoscaler (HPA) for elastic scaling based on demand:

- LiveKit server: scales from 2 to 6 replicas based on CPU utilization (60% target)
- LiveKit egress: scales from 2 to 6 replicas for recording capacity
- Node group auto-scaling from 2 to 4 nodes via EC2 Auto Scaling Groups
- Pod anti-affinity ensures replicas distribute across physical nodes for resilience

## Node.js Lambda Functions

Jacob built three Node.js Lambda functions (ES modules) that integrate the interview web application with the LiveKit EKS cluster. Each function is containerized via Docker and deployed through Amazon ECR with automated build scripts.

### Token Generation (livekit-token)

A Node.js Lambda function using the livekit-server-sdk that generates JWT access tokens for interview participants. The function accepts room name, participant identity, and display name as query parameters, then returns a signed JWT with room-join permissions including publish and subscribe grants. The token controls which interview room a participant can access and what actions they can perform.

### Webhook Handler (livekit-webhook)

A Node.js Lambda function that receives webhook events from the LiveKit server for interview session lifecycle tracking. The function processes events including room start/finish, participant join/leave, track publication, and recording status changes. Events are logged to CloudWatch for session monitoring and integration with the interview management system.

### Recording Management (cflivekit)

A Node.js Lambda function that manages interview recording operations through the LiveKit Egress API. The function supports two actions:
- **Record**: Initiates composite track recording (audio + video) with HLS segmented output uploaded directly to S3, using structured file naming based on application and exam identifiers
- **Stop**: Terminates an active recording by egress ID

The function uses the LiveKit EgressClient and RoomServiceClient SDKs for server-side control of recording operations.

### Lambda Deployment Architecture

All Lambda functions use a containerized deployment model:
- Docker images built from Node.js base with livekit-server-sdk dependency
- Amazon ECR repositories with image scanning enabled
- Separate build scripts for production, staging, and local testing
- API Gateway integration for HTTP access with CORS headers

## Infrastructure Tooling

Jacob manages the platform using the following infrastructure tools:

- **eksctl**: EKS cluster lifecycle management — cluster creation from YAML configs, node group provisioning, IAM service account creation for the AWS Load Balancer Controller, and cluster upgrades
- **kubectl**: Day-to-day Kubernetes operations — pod management, log inspection, scaling, configuration application, health monitoring, and cluster state backups
- **Helm 3**: Package management for Kubernetes — LiveKit server and egress chart installation, version-pinned upgrades, AWS Load Balancer Controller deployment, and release status monitoring
- **Multi-AZ Deployment**: Node groups span multiple Availability Zones with pod anti-affinity rules ensuring high availability across failure domains
- **Kubernetes 1.33 on EKS**: Latest stable Kubernetes version with managed control plane, upgraded incrementally one minor version at a time with automated upgrade scripts handling control plane, add-ons (CoreDNS, aws-node, kube-proxy), and node groups sequentially

### Cluster Upgrade Process

Jacob developed and executed a structured upgrade process for the EKS cluster:
1. Pre-upgrade cluster state backup via kubectl
2. Control plane version upgrade via AWS CLI
3. Add-on updates (CoreDNS, aws-node, kube-proxy) via eksctl
4. Node group rolling upgrade
5. Post-upgrade verification of LiveKit application health

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Container orchestration | EKS (Kubernetes) | LiveKit requires persistent WebRTC connections, host networking, and specific port ranges that map well to Kubernetes pod networking |
| Deployment tool | Helm charts | Official LiveKit Helm charts provide tested configurations; custom values files enable environment-specific overrides |
| Instance type | c6i.2xlarge | Compute-optimized instances for real-time media processing workloads |
| Recording format | HLS segments | Web-compatible playback, near-real-time availability, resilient to interruption |
| Lambda runtime | Node.js (ESM) | LiveKit server SDK is JavaScript-native; containerized deployment enables consistent dependencies |
| State coordination | ElastiCache Serverless (Redis) | LiveKit requires Redis for multi-node room state; serverless eliminates capacity planning |
| Networking | Host networking + ALB | Host networking eliminates NAT overhead for media; ALB handles HTTP/WebSocket routing |

## Technologies

- Amazon EKS, Kubernetes 1.33, eksctl, kubectl, Helm 3
- LiveKit Server, LiveKit Egress, livekit-server-sdk (Node.js)
- AWS Lambda (Node.js ES modules), Amazon ECR, API Gateway
- Application Load Balancer (ALB), AWS Load Balancer Controller
- Amazon S3 (HLS recording storage), ElastiCache Serverless (Redis)
- Docker, WebRTC, HLS streaming
- CloudFormation (security groups), IAM (RBAC, service accounts)
- c6i.2xlarge EC2 instances, multi-AZ deployment, HPA auto-scaling
