# Neon Service Discovery & Display Specification

## 1. Core Concepts

### Service

A **Service** is a _logical runtime unit_ discovered from a Docker Compose service.

- One Neon Service maps **1:1 to a docker-compose service**
- A Service may have one or more containers (replicas)
- Services form a **dependency graph**

Neon does **not** manage services — it observes and models them.

---

### Container

A **Container** is a runtime instance of a Service.

- Containers belong to exactly one Service
- Container health drives Service health

---

### Server

A **Server** is a host running Docker.

- Services exist within the context of a Server
- Service IDs are scoped to a Server

---

## 2. Service Types

Each Service declares a **type** using Docker labels.

```text
application   – backend application / API / worker
database      – stateful data store
website       – frontend / UI
agent         – monitoring / background agent
infrastructure – shared infrastructure (e.g. reverse proxy)
```

Used for:

- UI icons and grouping
- Health propagation rules
- Dependency validation

---

## 3. Docker Labels (Authoritative Source)

Neon uses Docker **labels** as its primary service discovery mechanism.

### Required Labels

```yaml
labels:
  neon.type: application | database | website | agent | infrastructure
```

### Optional Labels

```yaml
labels:
  neon.name: Human-readable service name
  neon.description: Short description of the service
```

If `neon.name` is omitted, the docker-compose service name is used.

---

## 4. Service Dependencies

Dependencies exist **between Services**, not between containers.

### Explicit Dependencies (Preferred)

```yaml
labels:
  neon.depends_on: mysql,redis
```

- Comma-separated list of docker-compose service names
- Treated as **REQUIRES** dependencies

Optional dependencies:

```yaml
labels:
  neon.depends_on.optional: mailhog
```

---

### Implicit Dependencies (Agent-Inferred)

The Neon Agent may infer dependencies automatically using the following signals.

#### 1. docker-compose `depends_on`

```yaml
depends_on:
  - mysql
```

→ Inferred as `REQUIRES`

---

#### 2. Environment Variables

If an environment variable value matches a docker-compose service name:

```yaml
environment:
  DATABASE_HOST: mysql
```

→ Inferred as `REQUIRES`

---

#### 3. Heuristics (Low Confidence)

- Shared Docker networks
- Well-known ports (3306, 5432, 6379, etc)

→ Inferred as `USES`

These dependencies may be flagged as **low confidence** in the Neon UI.

---

## 5. Dependency Types

```text
REQUIRES – Service cannot function without the dependency
USES     – Non-critical integration
OPTIONAL – Graceful degradation
```

Dependency resolution priority:

1. Explicit labels
2. docker-compose `depends_on`
3. Environment variable inference
4. Heuristic inference

---

## 6. Service Health

### Container Health

Derived from:

- Docker container state
- Docker health checks (if defined)

---

### Service Health (Derived)

A Service’s health is derived from:

- The health of its containers
- The health of its dependencies

Rules:

- A Service is **DOWN** if any REQUIRED dependency is DOWN
- A Service is **DEGRADED** if any REQUIRED dependency is DEGRADED
- OPTIONAL dependencies do not cause a Service to be marked DOWN

---

## 7. Service Identity

Service IDs must be stable and human-readable.

Format:

```text
<server_id>/<compose_service_name>
```

Example:

```text
saturn-01/argon
saturn-01/mysql
```

---

## 8. Neon Agent Responsibilities

On each Server, the Neon Agent must:

1. Enumerate docker-compose services
2. Read service labels
3. Discover containers per service
4. Collect container health information
5. Infer service dependencies
6. Report the following to Neon:
   - Services
   - Containers
   - Dependencies
   - Health state

The agent **does not compute global or derived health** — it reports observed facts only.

---

## 9. Neon Application Responsibilities

The Neon application is responsible for:

- Persisting the service graph
- Computing derived service health
- Displaying:
  - Server → Services → Containers
  - Inter-service dependency graph

- Showing blast radius when a Service becomes unhealthy

---

## 10. Examples

### Application + Database

```yaml
services:
  argon:
    image: steverayner/argon
    labels:
      neon.type: application
      neon.name: Argon
      neon.depends_on: mysql
    environment:
      DATABASE_HOST: mysql

  mysql:
    image: mysql:8.0
    labels:
      neon.type: database
```

---

### Infrastructure Service (Reverse Proxy)

```yaml
services:
  traefik:
    image: traefik:v3.0
    labels:
      neon.type: infrastructure
      neon.name: Reverse Proxy
      neon.description: Edge reverse proxy and TLS termination
```

Other services may depend on this as `USES` or `OPTIONAL`.

---

## 11. Design Principles

- Docker Compose is the source of truth
- Services are logical, containers are runtime
- Dependencies exist between services
- Explicit configuration overrides inference
- Neon observes and models systems; it never controls them
