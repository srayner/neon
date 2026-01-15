# Neon

Multi-server monitoring and management platform with real-time metrics collection.

## Features

- 🖥️ **Server Monitoring**: Track CPU, memory, and disk usage across multiple servers
- 🐳 **Docker Container Management**: Monitor and manage Docker containers
- 📊 **Real-time Metrics**: Collect system metrics every 60 seconds
- 🎨 **Beautiful Dashboard**: Dark-themed UI with neon accents
- 📈 **Historical Data**: Time-series metrics storage for trend analysis

## Tech Stack

- **Frontend**: Next.js 15, React 19, Tailwind CSS 4
- **Backend**: Next.js API Routes, Prisma ORM
- **Database**: PostgreSQL
- **Monitoring**: systeminformation, dockerode
- **Scheduling**: node-cron

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database
- Docker (for container monitoring)

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd neon
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.dist .env
```

Edit `.env` and configure:
- `DATABASE_URL`: PostgreSQL connection string (e.g., `postgresql://user:password@localhost:5432/neon?schema=public`)
- `SERVER_NAME`: Name for this server instance (e.g., `localhost`, `production-01`)

4. Set up the database:
```bash
npx prisma db push
```

5. (Optional) Seed fake servers for demo:
```bash
npx tsx scripts/seed-servers.ts
```

### Running the Application

1. Start the metrics collection service:
```bash
npm run sync
```

2. In a separate terminal, start the Next.js dev server:
```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
neon/
├── app/
│   ├── api/              # API routes
│   ├── components/       # Reusable UI components
│   ├── docker/           # Docker containers page
│   └── page.tsx          # Dashboard home page
├── lib/
│   ├── docker-sync.ts    # Docker container synchronization
│   ├── server-metrics.ts # Server metrics collection
│   └── prisma.ts         # Prisma client singleton
├── prisma/
│   └── schema.prisma     # Database schema
└── scripts/
    ├── seed-servers.ts   # Seed fake servers for demo
    └── sync-containers.ts # Background sync service
```

## Database Schema

- **server**: Server information and current metrics
- **server_metric**: Historical time-series metrics
- **container**: Docker container information

## Metrics Collection

- **Server metrics**: Collected every 60 seconds
- **Container sync**: Collected every 5 minutes
- Data stored in PostgreSQL for historical analysis

## Future Features

- Application deployment tracking
- Framework/library version monitoring
- Time-series charts (hourly/daily/monthly)
- Alert notifications
- Multi-server deployment support
