# Shared Components Architecture

## Project Overview

Jacob designed and built a shared components library that served as the architectural backbone for a multi-application enterprise platform. The library provided reusable abstraction layers for database access, environment-aware configuration, and cross-cutting concerns like encryption and query logging. This shared components architecture enabled consistent patterns across more than a dozen applications while supporting incremental modernization and service decomposition.

The components library was maintained as a standalone Git repository and deployed as a shared dependency across all applications in the platform. Jacob's architectural contributions focused on creating clean abstraction boundaries that decoupled application logic from infrastructure concerns such as database routing, connection management, and deployment topology.

## Table API Abstraction Layer

### ORM-Like CRUD Interface

Jacob created a Table API abstraction that provided an ORM-like interface for database operations. Each database table was represented by a component that extended the base Table API, declaring only its table name and datasource. The abstraction handled all CRUD operations (create, read, update, delete) through a consistent interface, eliminating repetitive query boilerplate across the codebase.

The Table API automatically introspected database schema metadata to determine column names, data types, and primary keys. This metadata-driven approach meant that adding a new column to a database table required zero code changes in the data access layer — the abstraction detected new columns automatically.

### Dynamic Where-Clause Builder

The Table API included a dynamic where-clause builder that constructed SQL predicates from method arguments. Developers passed named parameters matching column names, and the abstraction automatically built type-safe WHERE clauses. The builder supported multiple operators through naming conventions.

This convention-over-configuration approach reduced query construction errors and enforced consistent patterns across all database interactions.

### Encrypted Column Support

The Table API provided transparent AES encryption for sensitive columns. Developers declared encrypted columns and their keys in a configuration method. The abstraction automatically applied `AES_ENCRYPT` on insert and update operations and `AES_DECRYPT` with UTF-8 conversion on select operations. This transparent encryption pattern ensured PII protection without requiring developers to manage encryption logic in application code.

### Read Replica Routing

The Table API integrated with the Datasource abstraction to route read operations to database read replicas by default. The `read()` method accepted a parameter (defaulting to true) that directed SELECT queries to the reader endpoint while write operations (create, update, delete) always used the writer endpoint. This read/write splitting pattern distributed database load and improved query performance for read-heavy workloads.

### Query Logging and Data Snapshots

The abstraction included configurable query logging that recorded all database mutations with metadata. Before update and delete operations, the system could capture data snapshots — storing the current state of affected rows before modification. This audit trail pattern provided rollback capability and change tracking without requiring application-level implementation. Logging was disabled by default for performance and enabled per-table as needed.

### Additional Capabilities

- **Parameterized queries**: Automatic type detection and parameterized value binding based on column metadata, preventing SQL injection
- **NULL handling**: Placeholder-based NULL value support for insert and update operations
- **Table save/restore**: Built-in table backup and restore operations for safe schema migrations
- **Create-or-read (upsert)**: A `cread` method that atomically reads or creates-then-reads a record
- **Primary key introspection**: Automatic primary key detection from schema metadata
- **Soft delete support**: Automatic filtering of inactive/deleted records based on table schema conventions

## Datasource Abstraction Layer

### Environment-Aware Connection Routing

Jacob designed a Datasource abstraction layer that replaced hard-coded database connection configurations with environment-aware routing. The abstraction detected the execution environment (local development, test, production) and automatically routed database connections to the appropriate endpoint. This eliminated environment-specific configuration files and reduced deployment errors caused by incorrect connection strings.

The routing logic supported three connection types:

- **Local**: Development environment connections routed to local Docker MySQL containers
- **Reader**: Production read replica connections for SELECT-heavy operations (Aurora cluster read-only endpoint)
- **Writer**: Production primary connections for write operations (Aurora cluster primary endpoint)

### Automatic Environment Detection

The Datasource abstraction automatically detected the execution environment by inspecting the server hostname. Local development environments (localhost, IP addresses, non-production domains) routed to local database containers. Production environments routed to AWS Aurora cluster endpoints with read/write splitting. This detection eliminated manual environment configuration and ensured developers could not accidentally connect to production databases from local machines.

### Per-Database Configuration

Each database in the platform had its own Datasource component that extended the base abstraction. These components declared only the database-specific details (schema name, credentials) while inheriting all routing logic, connection pooling settings, SSL configuration, and environment detection from the parent. This inheritance-based pattern meant that adding a new database to the platform required a single small component with minimal configuration.

The platform managed over a dozen separate databases through this pattern, including databases for logging, recruiting, licensing, exam delivery, and shared exam content.

### Connection Management

The Datasource abstraction centralized connection pool settings including connection limits, timeout configuration, SSL mode enforcement, character encoding, and timezone handling. Changes to connection parameters propagated automatically to all applications using the shared components, eliminating the need to update connection settings across multiple deployment configurations.

## Shared Components Deployment Model

### Library Distribution Pattern

The shared components library was maintained as a standalone Git repository, separate from any individual application. During AWS Elastic Beanstalk deployment, the components library was copied into each application's deployment artifact. This distribution pattern allowed all applications to share identical abstraction layers while maintaining independent deployment lifecycles.

This approach provided several architectural benefits:

- **Single source of truth**: Bug fixes and improvements to shared abstractions propagated to all applications on their next deployment
- **Version consistency**: All applications in the platform used the same version of core abstractions
- **Independent deployability**: Applications could be deployed independently without coordinating shared library releases
- **Testability**: The components library included its own test suite that validated abstractions in isolation

### Cross-Application Consistency

The shared library enforced consistent patterns for database access, error handling, logging, and security across all applications. New developers joining any application in the platform encountered the same Table API and Datasource patterns, reducing onboarding time and cognitive load when moving between codebases.

## Service Decomposition

### Monolith to Multi-Application Architecture

Jacob led the separation of distinct functional areas from a monolithic application into separate Elastic Beanstalk applications. The original monolith served multiple user types (administrators, proctors, candidates, clients) through URL path routing (`/admin`, `/proctor`, `/clients`). Jacob decomposed this into independent applications:

- **proctor application**: Separated proctor-facing functionality into its own Elastic Beanstalk environment
- **admin application**: Separated administrative functionality into its own Elastic Beanstalk environment
- **Additional applications**: Further decomposition for recruiting, reporting, and other functional areas

Each separated application maintained access to the shared components library, ensuring consistent database access patterns and abstraction layers across the decomposed architecture. The shared Datasource abstraction was critical to this decomposition — applications could be separated without rewriting database connection logic because the environment-aware routing handled endpoint resolution automatically.

### Benefits of Decomposition

- **Independent scaling**: Each application scaled independently based on its traffic patterns
- **Isolated deployments**: Changes to one functional area did not require redeploying the entire platform
- **Reduced blast radius**: Failures in one application did not cascade to other user-facing services
- **Team autonomy**: Different team members could work on separate applications without merge conflicts

## Feature Flags Initiative

Jacob initiated a feature flags system as an architectural improvement to enable safer deployments and gradual rollouts. The feature flags pattern allowed new functionality to be deployed to production in a disabled state and activated incrementally. This approach supported:

- Safe rollout of new features with instant rollback capability
- A/B testing of implementation approaches
- Decoupling deployment from release timing
- Gradual migration between old and new implementations

The feature flags initiative represented a shift toward continuous delivery practices, enabling the team to deploy more frequently with lower risk.

## Architectural Patterns Summary

Jacob's shared components architecture demonstrates expertise in several software architecture patterns:

- **Abstraction layers**: Clean separation between application logic and infrastructure concerns
- **Environment-aware configuration**: Automatic routing based on execution context without manual configuration
- **Read/write splitting**: Database load distribution through transparent replica routing
- **Shared library distribution**: Consistent patterns across multiple applications via a single source of truth
- **Service decomposition**: Incremental extraction of bounded contexts from a monolithic architecture
- **Convention over configuration**: Reducing boilerplate through naming conventions and metadata introspection
- **Transparent encryption**: Security concerns handled at the abstraction layer without application awareness
- **Audit logging**: Configurable mutation tracking with pre-change data snapshots
- **Feature flags**: Decoupling deployment from release for safer continuous delivery

## Technologies

- AWS Elastic Beanstalk, Aurora MySQL, Read Replicas, AES Encryption
- Git (standalone shared library repository), Docker (local development)
- Object-oriented component architecture, inheritance-based abstraction layers
- Dynamic SQL generation, parameterized queries, schema introspection
- Environment detection, connection pooling, SSL/TLS database connections
