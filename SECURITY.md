# Security Notes

## Secrets

Do not commit `.env`, WhatsApp auth folders, browser cache folders, or local export files. Copy `.env.example` to `.env` and fill in local values.

The app reads secrets from environment variables only. Source files should not contain API keys, passwords, session secrets, WhatsApp session data, or Instagram credentials.

Set `APP_ACCESS_TOKEN` before running the app on `HOST=0.0.0.0`. API routes require this token through the dashboard prompt, `X-App-Access-Token`, `Authorization: Bearer ...`, or a local `?token=...` bootstrap query.

## Dependency Audit

`npm audit fix` has been run with non-breaking updates, and direct high-severity issues were reduced by upgrading Puppeteer and Nodemailer.

The default dependency graph is kept audit-clean and does not install `instagram-private-api`.

Instagram automation is a manual opt-in integration. If you run `npm install instagram-private-api`, npm will report known transitive audit findings from that package's deprecated `request` dependency chain. There is no safe automatic fix for that chain. Treat Instagram automation as higher risk and keep the app limited to localhost or a private network such as Tailscale.

Use conservative Instagram rules: prefer explicit account lists, keep batches small, pause between runs, and stop when challenge, checkpoint, rate-limit, or spam warnings appear. Do not run this from a public server.

## Network Exposure

The default server host is `0.0.0.0` so local network and Tailscale access work. API routes require an access token, but you should still use firewall rules or Tailscale ACLs when needed.

Website analysis and email extraction intentionally fetch user-supplied URLs with browser automation. On an exposed deployment this is SSRF-capable, because a user with API access can ask the server to request internal or private network URLs. Keep deployments on localhost, Tailscale, or another private network, and do not expose these routes to untrusted users.
