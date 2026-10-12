# MOCHEX

> MEXC Technical Analysis & Charting Platform

MOCHEX is a responsive, web-based technical analysis workstation built exclusively for MEXC Spot markets. It focuses strictly on responsive charting, indicator development, and visual backtesting.

## Tech Stack

- **Framework:** Next.js 15 (App Router) + TypeScript
- **Styling:** Tailwind CSS + Lucide Icons + dark workstation theme
- **Market Data:** MEXC Spot V3 REST & WebSockets (hybrid direct fetch + fallback proxy)
- **Charting:** TradingView JS API compliant `IBasicDataFeed` (`MexcDatafeed`)
- **Script Sandbox:** Web Worker runtime with `technicalindicators` (50+ indicators) & 1,000ms timeout guard
- **Backtesting:** In-memory Bar Replay Engine state machine (`IDLE`, `SELECTING`, `PAUSED`, `PLAYING`, `STEP`)
- **Database & Auth:** PostgreSQL + Prisma ORM with HTTP-only cookie JWT and RBAC (`TRADER` vs `ADMIN`)
- **Testing:** Automated Vitest regression test suite (25/25 passing)

## Getting Started

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Configure environment:
   ```bash
   cp .env.example .env
   ```

3. Generate Prisma client & sync schema:
   ```bash
   npx prisma generate
   npx prisma db push
   ```

4. Run the development server (default port 3018):
   ```bash
   pnpm dev
   ```
   Open [http://localhost:3018](http://localhost:3018) in your browser.

5. Run test suite:
   ```bash
   pnpm test
   ```
