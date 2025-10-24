# A2A Database Setup with Prisma

This directory contains the Prisma schema and migrations for the A2A MCP Server. The database provides persistent storage for agents, workflows, memories, and analytics.

## Prerequisites

- PostgreSQL 12+ (recommended) or another Prisma-supported database
- Node.js 18+
- npm or yarn

## Quick Start

### 1. Install Dependencies

Dependencies are already installed if you ran `npm install` in the project root.

### 2. Set Up Database Connection

Copy the example environment file and configure your database URL:

```bash
cp .env.example .env
```

Edit `.env` and set your `DATABASE_URL`:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/a2a?schema=public"
```

#### Database URL Format

```
postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=SCHEMA
```

### 3. Initialize Database

Run migrations to create the database schema:

```bash
npm run db:push
```

Or for a production setup with migration history:

```bash
npm run db:migrate
```

### 4. Generate Prisma Client

Generate the TypeScript client:

```bash
npm run db:generate
```

### 5. Seed Database (Optional)

Populate the database with default agents and sample data:

```bash
npm run db:seed
```

## Database Schema

### Core Models

#### Agent
Stores agent definitions with capabilities, configuration, and metadata.

- **Fields**: id, name, version, category, tags, enabled, capabilities, config
- **Relations**: memories, workflows

#### Memory
Agent memory system with 6 types: conversation, procedural, episodic, semantic, tool_usage, preference.

- **Fields**: id, agentId, type, content, importance, timestamp, context
- **Relations**: agent

#### Workflow
Multi-step workflow orchestration with dependencies and conditional execution.

- **Fields**: id, name, description, status, priority, steps, context, result
- **Relations**: agent, steps

#### WorkflowStep
Individual workflow steps with dependencies and retry logic.

- **Fields**: id, workflowId, name, order, status, input, output, dependsOn
- **Relations**: workflow

### Supporting Models

- **AgentPersonality**: Learning and personality traits
- **ToolUsage**: Tool execution analytics
- **MCPServer**: MCP server registry
- **AgentCommunication**: Agent-to-agent communication logs

## Available Scripts

```bash
# Generate Prisma client
npm run db:generate

# Push schema to database (dev)
npm run db:push

# Create and apply migrations (prod)
npm run db:migrate

# Open Prisma Studio (database GUI)
npm run db:studio

# Seed database with sample data
npm run db:seed
```

## Prisma Studio

Prisma Studio provides a GUI for browsing and editing your database:

```bash
npm run db:studio
```

Opens at: http://localhost:5555

## Database Providers

### PostgreSQL (Recommended)

**Local Development:**
```bash
# Using Docker
docker run --name a2a-postgres \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=a2a \
  -p 5432:5432 \
  -d postgres:15

# DATABASE_URL
postgresql://postgres:password@localhost:5432/a2a?schema=public
```

**Production Options:**
- [Railway](https://railway.app) - Easy PostgreSQL hosting
- [Render](https://render.com) - Managed PostgreSQL
- [Neon](https://neon.tech) - Serverless PostgreSQL
- [Supabase](https://supabase.com) - PostgreSQL with extras

### Other Supported Databases

Prisma supports multiple databases. To change the provider:

1. Edit `prisma/schema.prisma`:
```prisma
datasource db {
  provider = "mysql" // or "sqlite", "sqlserver", "mongodb"
  url      = env("DATABASE_URL")
}
```

2. Update your `DATABASE_URL` in `.env`

3. Re-run migrations:
```bash
npm run db:migrate
```

## Migration Workflow

### Development

For rapid schema changes during development:

```bash
npm run db:push
```

This syncs your schema without creating migration files.

### Production

For production deployments with migration history:

```bash
# Create a new migration
npm run db:migrate

# This will:
# 1. Prompt for a migration name
# 2. Create migration SQL files in prisma/migrations/
# 3. Apply the migration to your database
# 4. Regenerate Prisma Client
```

### Resetting Database

**⚠️ Warning: This will delete all data!**

```bash
npx prisma migrate reset
```

This will:
1. Drop the database
2. Create a new database
3. Apply all migrations
4. Run seed script

## Environment Variables

```env
# Required
DATABASE_URL=postgresql://user:pass@host:5432/database?schema=public

# Optional
LOG_LEVEL=info                    # Set to 'debug' for query logging
NODE_ENV=production               # Affects Prisma client caching
```

## Troubleshooting

### Connection Errors

```bash
# Test database connection
npx prisma db pull
```

If this fails, check:
- Database is running
- DATABASE_URL is correct
- Firewall allows connection
- SSL mode if required: `?sslmode=require`

### Migration Issues

```bash
# Mark migrations as applied (if manually applied)
npx prisma migrate resolve --applied "MIGRATION_NAME"

# Mark migration as rolled back
npx prisma migrate resolve --rolled-back "MIGRATION_NAME"
```

### Prisma Client Errors

```bash
# Regenerate Prisma Client
npm run db:generate

# Or manually
npx prisma generate
```

### Engine Download Issues

If you encounter 403 errors when downloading Prisma engines:

```bash
# Set environment variable
export PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1

# Then regenerate
npm run db:generate
```

## Performance Tips

### Indexing

The schema includes indexes on frequently queried fields:
- Agent: `category`, `enabled`, `tags`
- Memory: `agentId`, `type`, `timestamp`, `importance`
- Workflow: `status`, `priority`, `agentId`

### Connection Pooling

For production, consider connection pooling:

```env
# PgBouncer example
DATABASE_URL="postgresql://user:pass@pgbouncer:6432/database?schema=public&pgbouncer=true"
```

### Query Optimization

```typescript
// Include relations to avoid N+1 queries
const agents = await prisma.agent.findMany({
  include: {
    memories: true,
    workflows: true,
  },
});

// Use select to fetch only needed fields
const agents = await prisma.agent.findMany({
  select: {
    id: true,
    name: true,
    enabled: true,
  },
});
```

## Backup and Restore

### Backup

```bash
# PostgreSQL
pg_dump -h localhost -U postgres a2a > backup.sql

# With Docker
docker exec a2a-postgres pg_dump -U postgres a2a > backup.sql
```

### Restore

```bash
# PostgreSQL
psql -h localhost -U postgres a2a < backup.sql

# With Docker
docker exec -i a2a-postgres psql -U postgres a2a < backup.sql
```

## Integration with A2A

### Using Persisted Registry

Replace the in-memory agent registry with the persisted version:

```typescript
// Before
import { agentRegistry } from './agents.js';

// After
import { persistedAgentRegistry as agentRegistry } from './db/persisted-agent-registry.js';
```

The persisted registry maintains O(1) lookup performance while ensuring agents survive server restarts.

### Health Checks

```typescript
import { testDatabaseConnection } from './db/prisma-client.js';

// In your health check endpoint
const dbHealthy = await testDatabaseConnection();
```

## Resources

- [Prisma Documentation](https://www.prisma.io/docs)
- [Prisma Schema Reference](https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference)
- [PostgreSQL Best Practices](https://www.prisma.io/docs/guides/performance-and-optimization/connection-management)
- [A2A Documentation](../README.md)
