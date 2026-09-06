# Grafana Observability Platform - Enterprise Data Store Monitoring and Alerting

## Project Overview

Jacob designed and implemented a Grafana-based observability platform in a large corporate enterprise environment to monitor the health and performance of the organization's core AWS data stores: Amazon DynamoDB, Amazon ElastiCache (Valkey), Amazon Redshift, and Amazon RDS. He built the dashboards from the ground up and configured a multi-channel alerting system so on-call engineers and the wider platform team are notified through the right channel based on severity and service ownership.

The platform gives engineering and operations teams a single pane of glass across heterogeneous data stores that previously required jumping between separate AWS consoles. Jacob built the dashboards to surface the metrics that matter for each store — capacity, latency, saturation, and error signals — and wired Grafana alert rules to multiple notification channels so issues are caught and routed before they impact production workloads.

## Architecture

### Metrics Collection

Grafana visualizes metrics sourced from Amazon CloudWatch, which aggregates native metrics from each AWS data store. Jacob configured the CloudWatch data source in Grafana with scoped IAM permissions following least-privilege principles, so Grafana can read metrics across the organization's accounts without broader access.

Monitored data stores and representative signals:

- **Amazon DynamoDB** — Consumed vs. provisioned read/write capacity, throttled requests, system and user errors, latency percentiles, and hot-partition indicators
- **Amazon ElastiCache (Valkey)** — CPU and engine CPU utilization, memory usage and evictions, cache hit rate, current connections, and replication lag
- **Amazon Redshift** — Cluster CPU utilization, disk space used, query duration and queue wait, WLM concurrency, and connection counts
- **Amazon RDS** — CPU utilization, freeable memory, free storage space, database connections, read/write IOPS and latency, and replica lag

### Grafana Dashboards

Jacob designed and built the Grafana dashboards, organizing them so each data store has a dedicated view plus a rolled-up overview for at-a-glance health across the fleet:

- **Per-service dashboards** — One dashboard per store type (DynamoDB, ElastiCache/Valkey, Redshift, RDS) with panels for capacity, latency, saturation, and errors
- **Fleet overview dashboard** — A consolidated view summarizing the health of all monitored stores for on-call triage
- **Template variables** — Dashboards use Grafana template variables (region, cluster/instance/table selectors) so a single dashboard covers many resources without duplication
- **Thresholds and annotations** — Panels apply color thresholds aligned to alert rules and annotate deploys and incidents for correlation

### Multi-Channel Alerting

Jacob configured Grafana alerting with multiple notification channels (contact points) and routing so alerts reach the right audience based on severity and service:

- **Multiple contact points** — Alerts fan out to several channels (for example chat/ops channels, email distribution lists, and paging for critical severity)
- **Severity-based routing** — Notification policies route warning-level alerts to team channels and critical alerts to on-call paging, reducing noise while ensuring urgent issues escalate
- **Per-service ownership** — Alert labels route each data store's alerts to the team that owns it
- **Threshold and rate-of-change rules** — Alert rules cover both static thresholds (e.g., low free storage, high CPU) and trend-based conditions (e.g., rising throttles or eviction rate)
- **Grouping and de-duplication** — Notification policies group related alerts to avoid flooding channels during broad incidents

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Visualization layer | Grafana | Flexible dashboards, template variables, and unified alerting across many data source types in one tool |
| Metrics source | Amazon CloudWatch | Native, no-agent metrics for DynamoDB, ElastiCache, Redshift, and RDS; avoids running collection infrastructure |
| Cache engine monitoring | ElastiCache (Valkey) | Valkey metrics (memory, evictions, hit rate, replication) are the leading indicators of cache-tier health |
| Dashboard structure | Per-service + fleet overview | Dedicated views for deep debugging plus a rollup for fast on-call triage |
| Alert routing | Severity- and ownership-based notification policies | Right alert to the right team/channel; critical issues page while warnings stay in team channels |
| Access model | Scoped, least-privilege IAM for the CloudWatch data source | Grafana reads metrics without broad AWS permissions |

## Operational Features

- **Single pane of glass** — DynamoDB, ElastiCache/Valkey, Redshift, and RDS health visible together instead of across separate AWS consoles
- **Multi-channel alerting** — Alerts routed to chat, email, and paging channels based on severity and service ownership
- **Reusable dashboards** — Template variables let one dashboard cover many tables, clusters, and instances across regions
- **Incident correlation** — Deploy and incident annotations overlaid on metric panels speed root-cause analysis
- **Proactive thresholds** — Capacity and saturation alerts fire before resource exhaustion impacts production

## Technologies

- Grafana (dashboards, template variables, unified alerting, notification policies)
- Amazon CloudWatch (metrics data source)
- Amazon DynamoDB, Amazon ElastiCache (Valkey), Amazon Redshift, Amazon RDS
- AWS IAM (scoped, least-privilege data source access)
- Multi-channel alerting (chat/ops channels, email, on-call paging)
- Observability, monitoring, and alerting best practices
