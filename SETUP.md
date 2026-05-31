# Fathom Setup Guide

This guide gets Fathom running locally. Fathom is a local lead-intelligence and market-research console: it discovers businesses, enriches them, analyzes them with AI, and stages outreach, with everything persisted in a local SQLite database.

Requirements: Node.js 18 or newer.

## Step 1: Install Dependencies

```bash
npm install
```

This installs Express, Puppeteer (with Chromium), Playwright, the OpenAI SDK, WhatsApp Web.js, Nodemailer, and `better-sqlite3` for local storage.

## Step 2: Configure Environment Variables

1. Create your `.env` file by copying the example:

   ```bash
   # macOS / Linux
   cp .env.example .env

   # Windows PowerShell
   Copy-Item .env.example .env
   ```

2. Open `.env` and set the values you need. A minimal local configuration:

   ```env
   OPENAI_API_KEY=replace-with-your-openai-api-key

   # Bind to localhost only for a strictly local install.
   HOST=127.0.0.1
   PORT=7000
   NODE_ENV=development

   # Required whenever HOST is not loopback (for example 0.0.0.0 on a LAN or Tailscale).
   APP_ACCESS_TOKEN=replace-with-a-long-random-dashboard-token
   ```

3. Get an OpenAI API key if you do not have one:
   - Go to https://platform.openai.com/api-keys
   - Create a new secret key
   - Paste it into `.env` as `OPENAI_API_KEY`

### Host and access token

- For a private, single-machine setup, set `HOST=127.0.0.1`. The dashboard is then reachable only from the same computer and `APP_ACCESS_TOKEN` is optional.
- The example file ships with `HOST=0.0.0.0` so the app is reachable over your LAN or Tailscale. When the host is not loopback, `APP_ACCESS_TOKEN` is required and is enforced on every `/api` route. Open the dashboard once with `?token=<your-token>` so the browser can store the token for later API calls.

### Optional environment variables

```env
# Email outreach through Gmail (use an app password, not your account password).
EMAIL_USER=your-email@example.com
EMAIL_PASS=replace-with-your-gmail-app-password
EMAIL_FROM_NAME=Fathom

# Used by session handling.
SESSION_SECRET=replace-with-a-long-random-string

# Extra CORS origins beyond localhost, private network, and Tailscale.
ALLOWED_ORIGINS=

# Instagram automation is off by default and carries account risk. Leave disabled
# unless you understand the tradeoffs (see SECURITY.md).
ENABLE_INSTAGRAM_AUTOMATION=false

# Override the SQLite file location if you want it outside the project.
SQLITE_PATH=
```

## Step 3: Start the Server

```bash
npm start
```

The server runs at:

```text
http://localhost:7000
```

For development with auto-reload, use `npm run dev`.

## Step 4: Local Data and the SQLite Database

Fathom stores everything in a local SQLite database. On first run it creates a `data/` folder in the project root and a `data/fathom.db` file inside it. There is no external database to host or configure.

That single file holds your saved tables, AI reports, message analyses, behavior and consultant presets, consultant chats, clipboard messages, and all Routines data (routines, scheduled runs, run history, and run logs). To back up Fathom, copy the `data/` folder. To start fresh, stop the server and delete `data/fathom.db`. You can move the database elsewhere by setting `SQLITE_PATH` in `.env`.

Do not commit the `data/` folder to version control.

## Step 5: Use Routines

Routines are the heart of Fathom. A routine is a saved, reusable pipeline that you compose from a small set of steps. The engine runs the steps in order and passes the working set of business rows from one step to the next:

```text
Discover  ->  Filter  ->  Enrich  ->  Analyze  ->  Send  ->  Save
```

- **Discover** scrapes a Google Maps search or place into business rows.
- **Filter** narrows the set by a field (for example, keep only rows that have a website).
- **Enrich** visits each website and adds a contact email.
- **Analyze** drafts a short, per-business outreach opener with AI.
- **Send** delivers email or WhatsApp messages (opt-in, throttled).
- **Save** persists the result as a named saved table.

You do not need every step. A research-only routine might be `Discover -> Filter -> Enrich -> Analyze -> Save` and never send anything.

Run a routine on demand with one click, or attach a cron schedule and let Fathom run it automatically. The built-in scheduler checks once a minute and fires any routine whose 5-field cron expression matches. For example, `0 9 * * 1` runs a routine every Monday at 09:00. Each run executes as a tracked background task with live progress and logs, and its full history is recorded in the SQLite database so you can review it later. If the machine was off when a run was due, the next run time is recomputed forward rather than back-filled, so a restart never triggers a burst of outreach.

## Step 6: Optional Integrations

- **Email.** Set `EMAIL_USER`, `EMAIL_PASS` (a Gmail app password), and `EMAIL_FROM_NAME` to enable email steps and the email sender.
- **WhatsApp.** WhatsApp Web.js uses a QR login. Link your account from the dashboard, then the Send step and bulk sender can message numbers from your saved data.
- **Instagram.** Disabled by default. It depends on a manually installed unofficial package with known audit findings. Only enable it on localhost or a private network, and read SECURITY.md first.

## Security Best Practices

1. Never commit `.env`, the `data/` folder, the WhatsApp auth folder, or browser cache folders.
2. Keep your OpenAI API key and email app password private, and rotate them periodically.
3. Run Fathom on localhost or a private network such as Tailscale, not on a public server.
4. When the host is not loopback, always set a long, random `APP_ACCESS_TOKEN`.
5. Monitor your OpenAI usage and set spending limits in your OpenAI account.

See SECURITY.md for the full security model, including the SSRF note for URL-fetching features.

## Troubleshooting

### "OpenAI API key not found" or AI steps fail

Confirm `.env` exists and contains a valid `OPENAI_API_KEY`, then restart the server. Check that your OpenAI account has available credit.

### Server will not start: "Cannot find module ..."

Run `npm install` again to ensure all dependencies, including `better-sqlite3`, are installed.

### "APP_ACCESS_TOKEN is required when HOST is not loopback"

Either set a long, random `APP_ACCESS_TOKEN` in `.env`, or set `HOST=127.0.0.1` for a strictly local install.

### API calls return 401 "Access token required"

The access token is set but your browser has not stored it. Open the dashboard once with `?token=<your-token>` appended to the URL.

### WhatsApp will not connect

Open the outreach panel and scan the QR code with your phone. If the session is stuck, use the WhatsApp restart action to clear the saved session and scan again.

### Discovery or enrichment hangs

These steps drive a real browser and depend on network conditions and page structure. Use the background task controls to watch progress, and pause or cancel a run if needed.

## You Are Ready

Open `http://localhost:7000`, build your first routine, run it once to see the pipeline work, then attach a schedule when you are happy with the results.
