# Neon Agent

A lightweight agent that runs on remote servers and reports metrics and Docker container status to the Neon master server.

## Architecture

```
┌─────────────────┐                        ┌─────────────────┐
│  Remote Server  │   POST /api/agent/*    │  Master Server  │
│                 │ ---------------------->│  (Neon App)     │
│  ┌───────────┐  │                        │                 │
│  │  Agent    │  │  - Register            │  ┌───────────┐  │
│  │  (Docker) │  │  - Metrics (every 5m)  │  │ PostgreSQL│  │
│  └───────────┘  │  - Containers (15m)    │  └───────────┘  │
│                 │  - Heartbeat (60s)     │                 │
└─────────────────┘                        └─────────────────┘
```

## Quick Start (Local Development)

### 1. Start the Master Server

```bash
# Ensure .env has these variables
cat >> .env << 'EOF'
AGENT_SECRET=dev-agent-secret-change-in-production
JWT_SECRET=dev-jwt-secret-change-in-production
EOF

# Start the master
npm run dev
```

### 2. Run the Agent Locally

```bash
# In a new terminal
SERVER_NAME=local-test \
MASTER_URL=http://localhost:3000 \
AGENT_SECRET=dev-agent-secret-change-in-production \
npm run agent:dev
```

You should see:
```
[Client] Registered successfully (serverId: X)
[Scheduler] Collected metrics: CPU X%, Memory X%
[Scheduler] Collected N containers
[Agent] Running. Press Ctrl+C to stop.
```

### 3. Verify Data

Open http://localhost:3000 or check the API:
```bash
curl http://localhost:3000/api/servers | jq
```

---

## Production Deployment

### Master Server Setup

Add to your production `.env`:
```env
# Generate secure secrets for production!
AGENT_SECRET=your-secure-random-secret-here
JWT_SECRET=your-jwt-signing-secret-here
```

### Build the Agent Docker Image

```bash
# Build the bundled agent (160MB image)
npm run docker:build:agent

# Tag and push to your registry
docker tag neon-agent:latest your-registry.com/neon-agent:latest
docker push your-registry.com/neon-agent:latest
```

### Deploy Agent to Remote Servers

On each server you want to monitor:

```bash
# Pull the image
docker pull your-registry.com/neon-agent:latest

# Run the agent
docker run -d \
  --name neon-agent \
  --restart unless-stopped \
  -e SERVER_NAME=$(hostname) \
  -e MASTER_URL=https://your-neon-master.com \
  -e AGENT_SECRET=your-secure-random-secret-here \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  --group-add $(stat -c '%g' /var/run/docker.sock) \
  your-registry.com/neon-agent:latest
```

Or use docker-compose (copy `packages/agent/docker-compose.yml` to the server):

```bash
# Create .env file
cat > .env << 'EOF'
SERVER_NAME=web-server-01
MASTER_URL=https://your-neon-master.com
AGENT_SECRET=your-secure-random-secret-here
DOCKER_GID=999
EOF

# Start
docker-compose up -d

# View logs
docker-compose logs -f
```

---

## Configuration

### Agent Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SERVER_NAME` | Yes | - | Unique name for this server |
| `MASTER_URL` | Yes | - | URL of the Neon master server |
| `AGENT_SECRET` | Yes | - | Shared secret for authentication |
| `METRICS_INTERVAL` | No | 300 | Seconds between metrics collection |
| `CONTAINERS_INTERVAL` | No | 900 | Seconds between container sync |
| `HEARTBEAT_INTERVAL` | No | 60 | Seconds between heartbeats |
| `BUFFER_ENABLED` | No | true | Buffer metrics when master is down |
| `BUFFER_MAX_SIZE` | No | 100 | Max buffered metrics before dropping |

### Network Requests

With default settings, each agent makes:
- 60 heartbeats/hour
- 12 metrics reports/hour
- 4 container syncs/hour
- **Total: 76 requests/hour per server**

### Database Growth

- ~288 metric rows per server per day
- Containers are updated in place (no growth)

---

## Project Structure

```
packages/
├── shared/                 # @neon/shared - shared TypeScript types
│   └── src/types/
│       ├── metrics.ts      # ServerInfo, ServerMetrics, ContainerInfo
│       └── api.ts          # API request/response types
│
└── agent/                  # @neon/agent - standalone agent
    ├── Dockerfile          # Minimal 160MB image
    ├── docker-compose.yml  # Example deployment
    ├── esbuild.config.mjs  # Bundle configuration
    └── src/
        ├── index.ts        # Entry point
        ├── config.ts       # Environment config
        ├── scheduler.ts    # Cron task scheduler
        ├── collectors/
        │   ├── metrics.ts  # CPU, memory, disk, network
        │   └── docker.ts   # Container collection
        └── transport/
            ├── client.ts   # HTTP client with retry
            └── buffer.ts   # Offline buffering

app/api/agent/              # Master API endpoints
├── register/route.ts       # POST - Agent registration
├── metrics/route.ts        # POST - Receive metrics
├── containers/route.ts     # POST - Receive containers
└── heartbeat/route.ts      # POST - Health check
```

---

## NPM Scripts

```bash
# Master
npm run dev              # Start master in dev mode
npm run build            # Build master for production
npm run start            # Start production master

# Agent
npm run agent:dev        # Run agent in dev mode (requires env vars)
npm run agent:bundle     # Bundle agent with esbuild
npm run build:agent      # Build agent TypeScript

# Docker
npm run docker:build:agent  # Build agent Docker image (160MB)
```

---

## Troubleshooting

### Agent can't connect to master

```
[Client] Request failed (attempt 1/3): fetch failed
```

- Check `MASTER_URL` is correct and reachable from the agent
- Ensure master is running and `/api/agent/register` endpoint responds
- Check firewall rules

### Agent rejected by master

```
Invalid or missing agent secret
```

- Ensure `AGENT_SECRET` matches on both master and agent

### Docker containers not detected

```
[Scheduler] Docker is not available
```

- Ensure Docker socket is mounted: `-v /var/run/docker.sock:/var/run/docker.sock:ro`
- Ensure correct group permissions: `--group-add $(stat -c '%g' /var/run/docker.sock)`

### View agent logs

```bash
# Docker
docker logs -f neon-agent

# Docker Compose
docker-compose logs -f
```

---

## Security Notes

- `AGENT_SECRET` is a pre-shared key - use a strong random value in production
- `JWT_SECRET` signs authentication tokens - keep it secret
- Docker socket access gives the agent read-only visibility into all containers
- Agent runs as non-root user inside the container
- All agent→master communication should use HTTPS in production
