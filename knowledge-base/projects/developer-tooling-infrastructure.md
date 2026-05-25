---
source-type: project
category: devops
title: Developer Tooling and Infrastructure - Docker, CRM Migration, and Data Analysis
---

# Developer Tooling and Infrastructure - Docker, CRM Migration, and Data Analysis

## Project Overview

Jacob built a collection of developer tooling and infrastructure projects to improve team productivity, automate workflows, and enable data-driven decision making. These projects span containerized local development environments, secure database access patterns using AWS Systems Manager Session Manager, a CRM data migration tool, and a support ticket analysis tool. Each project demonstrates Jacob's ability to identify operational pain points and build practical solutions using Docker, Python, and AWS services.

## Custom Docker Container for Local Development

### Container Architecture

Jacob created a custom Docker container image to standardize the local development environment across the engineering team. The container packages Nginx as a reverse proxy with SSL termination and the Lucee application server into a single reproducible image.

The container is built on the official Lucee 5.4 Nginx base image with the following customizations:

- **Nginx reverse proxy** — Handles HTTP (port 80) and HTTPS (port 443) traffic, proxying application requests to the Tomcat backend on port 8888
- **Self-signed SSL certificates** — Enables HTTPS locally for testing secure cookie handling, CORS policies, and mixed-content scenarios
- **Custom Nginx configuration** — Upstream keepalive connections (32 connections), extended proxy timeouts (600 seconds), and URL pattern routing for application files
- **Lucee server configuration** — Pre-configured server XML with optimized JVM settings (512MB min, 8GB max heap)
- **Extension deployment** — Lucee extensions (spreadsheet, CSV) pre-deployed into the server context

### Container Distribution

Jacob published the container image to Amazon ECR (Elastic Container Registry) for team-wide distribution. Developers pull the latest image and run it with host networking and bind-mounted source directories, enabling live code editing without container rebuilds.

## Docker Compose Local Development Environment

### Multi-Service Development Stack

Jacob designed a Docker Compose environment that orchestrates multiple services for full-stack local development. The compose configuration provides a complete application stack that mirrors the production environment.

### Services Configuration

- **Lucee application server** — Runs the custom development container image with ports 80 and 443 exposed, bind-mounted source code directory, and environment variables loaded from a secrets file
- **MySQL 8.0** — Local database server on port 3306 with persistent data storage via bind-mounted volume and custom MySQL configuration directory
- **DynamoDB Local** — Amazon DynamoDB Local container on port 8000 for testing DynamoDB-dependent features without AWS connectivity
- **Custom Docker network** — Isolated bridge network with defined subnet (10.28.0.0/16) for predictable container-to-container communication

### AWS Secrets Manager Integration

Jacob implemented a secure credential management workflow for the Docker Compose environment:

- **Startup script** (`start-with-secrets.sh`) — Fetches secrets from AWS Secrets Manager at container startup time
- **Temporary secrets file** — Credentials written to a temporary env file and loaded via Docker Compose `env_file` directive
- **No secrets in Git** — API keys (Stripe secret keys for multiple accounts) stored exclusively in AWS Secrets Manager
- **AWS SSO authentication** — Developers authenticate via `aws sso login` before starting the environment

### Developer Workflow

The environment supports a streamlined daily workflow: developers run a single startup script that authenticates with AWS, fetches current secrets, and launches all services. The bind-mounted source directory enables live code editing with immediate effect in the running container.

## Redmine Report Docker Container with SSM Session Manager

### Secure Database Access Architecture

Jacob built a containerized solution for generating weekly reports from a remote Redmine MySQL database. The architecture replaces traditional VPN or SSH-based database access with AWS Systems Manager Session Manager, providing a more secure and maintainable connection method.

### Two-Stage Tunnel Architecture

The tunnel system uses a two-stage approach for secure database connectivity:

1. **AWS SSM port forwarding** — Creates an encrypted tunnel from localhost:3308 to the MySQL port (3306) on the target EC2 instance using `aws ssm start-session` with the `AWS-StartPortForwardingSession` document
2. **socat relay** — Forwards traffic from all network interfaces (0.0.0.0:3307) to the localhost SSM tunnel, enabling container-to-container connectivity within the Docker network

### Container Components

- **MySQL Redmine container** — Based on Amazon Linux 2023, includes AWS CLI v2, Session Manager plugin, MariaDB client, and socat for port forwarding. Mounts `~/.aws` read-only for SSO credentials.
- **Network debugging container** — nicolaka/netshoot image for troubleshooting connectivity issues
- **Management script** (`manage.sh`) — Provides service lifecycle commands: up, down, status, logs, test, restart

### Security Features

- **AWS SSO integration** — Uses existing SSO session without storing long-lived credentials
- **Read-only credential mount** — The `~/.aws` directory is mounted read-only into the container
- **Encrypted tunnel** — All database traffic flows through the encrypted SSM tunnel
- **No SSH keys** — Eliminates SSH key management and rotation requirements
- **Network isolation** — Containers communicate through an isolated Docker network
- **Automatic reconnection** — Tunnel maintenance script detects drops and re-establishes the connection

### Report Generation Workflow

The weekly report script automates the complete report generation process:

1. Calculates the date range (previous 7 days)
2. Verifies tunnel connectivity with a MySQL connection test
3. Calls the application report endpoint via HTTPS
4. Uploads generated reports to Google Drive using rclone

## Highrise-to-HubSpot CRM Data Migration Tool

### Project Purpose

Jacob built a Python command-line utility to export data from Highrise CRM for import into HubSpot. The tool handles the complete data extraction process including people, companies, deals, notes, and tasks, producing JSON files formatted for HubSpot's import API.

### Technical Implementation

The migration tool is structured as a Python package (`highrise_export`) with the following components:

- **API client** (`api_client.py`) — HTTP client with Basic Auth, XML response parsing via xmltodict, and automatic pagination using Highrise's offset parameter
- **Retrievers** (`retrievers.py`) — Entity-specific data retrieval logic for people, companies, deals, notes, and tasks
- **Coordinator** (`coordinator.py`) — Orchestrates the export process across multiple entity types
- **Serializer** (`serializer.py`) — Converts retrieved data to JSON format for HubSpot import
- **CLI** (`cli.py`) — Command-line interface with configurable options for entity selection, timeouts, and logging

### Pagination Handling

The tool implements automatic pagination for large datasets:

- Uses Highrise's offset-based pagination (increments of 500 records per page)
- Detects end of pagination when fewer records than the page size (500) are returned
- Yields records individually via Python generators for memory efficiency
- Logs progress every 100 records retrieved

### Retry Logic with Exponential Backoff

Jacob implemented a `retry_with_backoff` decorator that handles transient failures:

- **Rate limiting (HTTP 503)** — Respects the `Retry-After` header, defaults to 60-second wait
- **Server errors (5xx)** — Exponential backoff: 1s, 2s, 4s, 8s, 16s between retries
- **Network errors** — Connection timeouts and request exceptions trigger the same exponential backoff
- **Client errors (4xx)** — Not retried, logged as permanent failures
- **Maximum 5 retry attempts** per request before raising the exception

### Rate Limiting

The tool respects Highrise API rate limits by:

- Honoring HTTP 503 responses with `Retry-After` headers
- Implementing configurable request timeouts (default 30 seconds)
- Logging all rate limit encounters with wait duration

### Testing

Jacob wrote comprehensive tests using pytest covering API client behavior, XML parsing, pagination logic, CLI argument handling, and logging output.

## OTRS Ticket Analysis Tool

### Project Purpose

Jacob built a Python analysis tool to identify call drivers from the organization's OTRS (Open Ticket Request System) support ticket database. The tool analyzed 59,391 unclassified tickets from a two-year period to quantify support volume by category, providing data-driven insights for process improvement.

### Technical Architecture

- **Database access** — Connects to the OTRS MySQL database via AWS SSM Session Manager port forwarding tunnel (localhost:3307 → EC2 instance → MySQL port 3306)
- **Data retrieval** — Executes SQL queries via the `mysql` command-line client using subprocess, joining ticket, article, and article_data_mime tables to get both ticket titles and body text
- **Local caching** — Stores query results in a TSV cache file to avoid repeated database queries during iterative analysis
- **Keyword-based categorization** — Classifies tickets into categories using keyword matching against combined title and body text

### Analysis Results

The tool processed 59,391 unclassified tickets and identified the top call drivers. These findings provided actionable data for prioritizing self-service feature development in the Candidates Portal


### SSM Tunnel Configuration

The tool connects to the database through a multi-hop secure tunnel:

1. AWS SSO authentication (`aws sso login`)
2. SSM Session Manager port forwarding to the EC2 instance running MySQL
3. socat relay for network interface binding
4. MySQL client connection to localhost:3307

## Technologies

- Docker, Docker Compose, Amazon ECR (containerization and distribution)
- Nginx (reverse proxy, SSL termination)
- MySQL 8.0, Amazon DynamoDB Local (local database services)
- AWS Systems Manager Session Manager (secure remote access)
- AWS Secrets Manager (credential management)
- AWS SSO, AWS CLI v2 (authentication)
- Python 3, requests, xmltodict, pytest (CRM migration tool)
- socat (network relay for container tunneling)
- Amazon Linux 2023 (container base image)
- rclone (cloud storage synchronization)
- Bash scripting (automation and orchestration)
