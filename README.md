<div align="center">

# Fathom

**Turn a Google Maps search into a researched, enriched, ready-to-work lead list, then automate the entire pipeline. A local lead-intelligence console that runs end to end on one machine you control.**

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org) [![Express](https://img.shields.io/badge/Express-4.x-000000?logo=express&logoColor=white)](https://expressjs.com) [![SQLite](https://img.shields.io/badge/SQLite-better--sqlite3-003B57?logo=sqlite&logoColor=white)](https://www.sqlite.org) [![Puppeteer](https://img.shields.io/badge/Puppeteer-Chromium-40B5A4?logo=puppeteer&logoColor=white)](https://pptr.dev) [![Playwright](https://img.shields.io/badge/Playwright-extraction-2EAD33?logo=playwright&logoColor=white)](https://playwright.dev) [![OpenAI](https://img.shields.io/badge/OpenAI-GPT--4o-412991?logo=openai&logoColor=white)](https://platform.openai.com) [![WhatsApp](https://img.shields.io/badge/WhatsApp-Web.js-25D366?logo=whatsapp&logoColor=white)](https://wwebjs.dev) [![SMS](https://img.shields.io/badge/SMS-gateway-FF6B35)](#sms-gateway) [![License](https://img.shields.io/badge/License-ISC-3DA639)](LICENSE)

</div>

---

## What It Is

Fathom is a single-user research console you run on your own machine. It turns a Google Maps search into a structured table of businesses, enriches those rows with contact details, studies each prospect with AI, and stages outreach drafts, all stored locally in SQLite.

The goal is research and qualification, not mass blasting. The valuable work in lead generation is deciding who is worth contacting and what to say. Fathom moves the tedious parts (collecting listings, cleaning tables, finding emails, reading websites, drafting first messages, tracking long jobs) into one place so you can spend your attention on judgment instead of busywork.

Everything stays on your computer. Data lives in a local SQLite file, integrations authenticate through your own accounts and API keys, and the server is built to run on localhost or a private network such as Tailscale.

## Features

- **Routines, a visual pipeline engine.** Compose a research workflow once, then run it on demand or on a schedule. Each step hands its working set of business rows to the next: `Discover -> Filter -> Enrich -> Analyze -> Send -> Save`. Build it, save it, let it run.
- **A built-in cron scheduler.** Attach a 5-field cron expression to any routine and it runs itself. The scheduler ticks every minute and records every run. Runs missed while the machine was off are recomputed forward, never back-filled, so a restart never fires a burst of outreach.
- **Local SQLite persistence.** Tables, reports, analyses, consultant chats, routines, run history, schedules, and settings all live in one local `better-sqlite3` file (`data/fathom.db`). Nothing to host, nothing leaves your machine.
- **An operations console.** Every long job (Discover, Enrich, bulk send, a full routine) runs as a tracked background task with live progress, logs, pause, resume, and cancel, surfaced in a live dock so the interface never blocks.
- **Discover.** Puppeteer drives Google Maps for a search or a place and extracts `Name`, `Address`, `Phone`, and `Website`.
- **Enrich.** Visits each saved website and pulls a contact email into the table.
- **AI you can steer.** Research websites into reports, draft per-business outreach, and run a saved-context consultant chat. Switch between OpenAI models and pick from a prompt-template library, both editable right in the UI.
- **Three outreach channels.** Email (Gmail SMTP), WhatsApp (QR-linked Web session), and SMS through a pluggable HTTP gateway you point at a self-hosted Android gateway or any provider. Templated with `{{placeholders}}`, throttled by design.
- **Run it from your phone.** Text your linked WhatsApp to list, run, schedule, and toggle routines, and get a message back when a run finishes. Only your authorized number can send commands.
- **In-app docs and settings.** A built-in operating guide, a timezone-aware console, and UI settings for the model lineup and the SMS gateway. No config files required to start.
- **Saved tables and comparison.** Reusable lead lists; compare two lists to find duplicates or unique rows.

## Architecture

```text
server.js                 Thin entry point -> startServer()
src/
  server/
    start.js              Boots config, app, and listener
    createApp.js          Express factory: wires routes, engine, scheduler, SQLite
  routines/
    engine.js             RoutineEngine: runs a pipeline as a tracked task
    scheduler.js          Cron scheduler: ticks every minute, fires due routines
    cron.js               5-field cron parser (matching + nextRun)
  routes/                 HTTP route families (data, routines, scraping, ai, ...)
  tasks/                  Background task manager and task API
lib/
  db.js                   SQLite connection + schema (better-sqlite3, WAL)
  store.js                Typed data-access layer over the database
  steps/                  Composable routine steps (one file per step)
    discover.js  filter.js  enrich.js  analyze.js
    sendEmail.js  sendWhatsapp.js  save.js  _shared.js  index.js
  config.js  accessControl.js  openaiClient.js  websiteExtractor.js
public/                   Dashboard: HTML, CSS, vanilla JS feature scripts
data/                     Local SQLite database (created on first run)
docs/                     Setup and feature guides, plus archived notes
```

How the pieces fit together:

- **Steps** (`lib/steps`) are the unit of work. Each is a small function `(rows, config, ctx) -> rows` that takes the previous working set and returns the next one. Steps are decoupled from any transport: they report progress, log, and check for cancellation through a `ctx` object, so the same step code serves both a single HTTP endpoint and a full routine.
- **Engine** (`src/routines/engine.js`) reads a saved routine, runs its steps in order, threads the working set from one step to the next, and records progress and logs against both the in-memory task manager (for the live UI) and SQLite (for durable run history).
- **Scheduler** (`src/routines/scheduler.js`) checks enabled schedules once a minute and asks the engine to start any routine whose cron expression matches the current minute.
- **Store** (`lib/store.js`) is the only place that talks SQL. Routes and the engine call typed functions on it; JSON-shaped columns (business rows, chat history, routine steps) are parsed on read and serialized on write here. `lib/db.js` owns the connection and schema.

## Quick Start

Requirements: Node.js 18 or newer.

```bash
npm install
cp .env.example .env       # On Windows PowerShell: Copy-Item .env.example .env
npm start
```

Then open:

```text
http://localhost:7000
```

The SQLite database is created automatically at `data/fathom.db` on first run. Set your `OPENAI_API_KEY` in `.env` to enable AI features. See [SETUP.md](SETUP.md) for the full walkthrough.

> By default the server binds to `0.0.0.0` for LAN and Tailscale access, which makes `APP_ACCESS_TOKEN` required. For a strictly local install, set `HOST=127.0.0.1` and the token becomes optional. See [Security](#security).

## Routines

A routine is a saved, reusable research pipeline. You compose it from a small set of composable steps and the engine runs them in order, passing the working set of business rows from each step to the next:

```text
Discover  ->  Filter  ->  Enrich  ->  Analyze  ->  Send  ->  Save
 (Maps)      (narrow)    (emails)    (AI draft)   (opt-in)  (SQLite)
```

| Step           | What it does                                                            |
| -------------- | ----------------------------------------------------------------------- |
| `discover`     | Scrape a Google Maps search or place into business rows                 |
| `filter`       | Narrow the set by a field predicate (for example, keep rows with a site)|
| `enrich`       | Visit each website and add a contact `Email` column                     |
| `analyze`      | Draft a short, per-business outreach opener with AI                      |
| `send_email`   | Send templated email through Gmail SMTP, with throttling                 |
| `send_whatsapp`| Message numbers through a linked WhatsApp Web session, with throttling   |
| `save`         | Persist the working set as a named saved table                          |

You do not need every step. A pure research routine might be `Discover -> Filter -> Enrich -> Analyze -> Save` and never send anything. Run a routine on demand with one click, or attach a cron schedule (for example `0 9 * * 1` for every Monday at 09:00) and let the scheduler run it for you. Every run is tracked as a background task and recorded with its logs in SQLite, so you can review what happened after the fact.

## API Surface

All routes are mounted under `/api`. When `APP_ACCESS_TOKEN` is set, requests must carry it via an `X-App-Access-Token` header, an `Authorization: Bearer ...` header, or a one-time `?token=...` bootstrap from the dashboard.

```http
# Routines, runs, and schedules
GET    /api/routines
POST   /api/routines
GET    /api/routines/:id
PUT    /api/routines/:id
DELETE /api/routines/:id
POST   /api/routines/:id/run
GET    /api/routines/:id/runs
GET    /api/runs/:runId
GET    /api/schedules
POST   /api/routines/:id/schedule
DELETE /api/schedules/:id

# Saved data (SQLite-backed)
GET/POST/DELETE   /api/tables       /api/tables/:id
GET/POST/DELETE   /api/reports      /api/reports/:id
GET/POST/DELETE   /api/analyses     /api/analyses/:id
GET/POST/DELETE   /api/chats        /api/chats/:id
GET/POST/DELETE   /api/clipboard    /api/clipboard/:id
GET/POST/DELETE   /api/presets/behavior      /api/presets/consultant
GET/PUT/POST      /api/cost-tracking         /api/cost-tracking/reset
POST              /api/import       # one-time import of legacy localStorage data

# Research and AI
POST   /api/analyze                      # probe whether a page is scrapable
POST   /api/scrape                       # discover businesses from a Maps URL
POST   /api/extract-emails               # enrich websites with contact emails
POST   /api/analyze-websites             # AI research report from a table
POST   /api/generate-message
POST   /api/generate-marketing-message
POST   /api/analyze-messages             # AI analysis of chats, photos, files
POST   /api/consultant-chat
POST   /api/consultant-chat/end-session

# Outreach (opt-in, throttled)
GET    /api/whatsapp/status
POST   /api/whatsapp/send
POST   /api/whatsapp/send-bulk
POST   /api/whatsapp/restart
POST   /api/send-email
POST   /api/email/send-bulk

# Background tasks
GET    /api/tasks
GET    /api/tasks/active
GET    /api/tasks/:taskId
POST   /api/tasks/:taskId/pause
POST   /api/tasks/:taskId/resume
DELETE /api/tasks/:taskId
GET    /api/tasks/stats/summary
POST   /api/tasks/cleanup

# Optional Instagram automation (manual opt-in, off by default)
POST   /api/instagram/connect
POST   /api/instagram/disconnect
GET    /api/instagram/status
GET    /api/instagram/progress
POST   /api/instagram/search-only
POST   /api/instagram/search-and-message
```

## Stack

- **Runtime:** Node.js and Express
- **Persistence:** SQLite via `better-sqlite3` (WAL mode, local file)
- **Browser automation:** Puppeteer with Chromium for discovery and enrichment
- **Frontend extraction:** Playwright for rendered website and JS context capture
- **AI:** OpenAI GPT-4o for reports, drafts, analysis, and consultant chat
- **Outreach:** WhatsApp Web.js with QR login and local auth, Nodemailer with Gmail SMTP
- **Parsing:** Cheerio for HTML inspection
- **Frontend:** HTML, CSS, and vanilla JavaScript dashboard
- **Optional:** Instagram automation through a manually installed unofficial package (off by default)

## Security

Fathom is designed to run locally. Please keep it that way.

- **Run on a private surface.** The default host is `0.0.0.0` so LAN and Tailscale access work. When the host is not loopback, `APP_ACCESS_TOKEN` is required and is enforced on every `/api` route. For a strictly local setup, set `HOST=127.0.0.1`.
- **Secrets stay in `.env`.** API keys, the email app password, the session secret, and the access token are read from environment variables only. Never commit `.env`, the WhatsApp auth folder, or browser cache folders.
- **SSRF awareness.** Website analysis and email enrichment intentionally fetch user-supplied URLs with browser automation. On an exposed deployment a caller could ask the server to reach internal or private addresses. Do not expose these routes to untrusted users.
- **Outreach is opt-in and throttled.** Sending steps require explicit configuration and connected accounts, and they space messages out. Use small batches and respect platform limits.
- **Instagram automation is higher risk.** It depends on a manually installed unofficial package with known transitive audit findings and is disabled by default.

Full details are in [SECURITY.md](SECURITY.md).

## License

Released under the ISC License. See [LICENSE](LICENSE).
