This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).
 
## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

# Application Deployment Guide

Welcome to the self-hosted deployment guide. This application is distributed as a set of Docker containers. It is stateless, with all persistent data stored in a PostgreSQL database.

## System Requirements

* Docker and Docker Compose (v2) installed.
* Outbound internet access (to pull images from `ghcr.io`).
* Port `3000` available (configurable).

## Deployment Instructions

1. **Clone or Extract:** Place these files in your desired installation directory (e.g., `/opt/cocode-app`).
2. **Environment Setup:** * Copy the example environment file: `cp .env.example .env`
   * Open `.env` in a text editor and update the security secrets and passwords.
3. **Start the Application:**
   * Run `docker compose up -d`
   * The application will pull the latest images, apply necessary database migrations automatically, and start.

## Architecture & "Bring Your Own Database" (BYODB)

By default, the provided `docker-compose.yml` includes a PostgreSQL container (`db`) with a persistent Docker volume (`pgdata`).

If your institution prefers to use an existing managed PostgreSQL cluster:

1. Open `docker-compose.yml`.
2. Delete or comment out the `db` service block and the `volumes` block at the bottom.
3. Remove the `depends_on: - db` array from the `web` service.
4. Open your `.env` file and change the `DATABASE_URL` variable to point to your institution's PostgreSQL connection string.

## Automated Updates

This stack includes `Watchtower`, which is configured to check our registry every hour for critical patches or updates. When an update is found, it will gracefully restart the `web` container. No manual intervention is required for database schema migrations; the application handles them automatically on boot.

If you prefer to manage updates manually, simply remove the `watchtower` service from the `docker-compose.yml` file and run `docker compose pull && docker compose up -d` when you wish to update.
