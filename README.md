# Zonewise

See the same moment in every city. Shows both **Standard** and **Daylight** offsets when a city observes DST.

**Live:** [https://zonewise.pages.dev](https://zonewise.pages.dev)

## How to use

1. Choose **Point** (a single time) or **Range** (a start and end).
2. Enter a time like `10:30 am`. In Range mode you can set an end time or use **+30m** / **+1h** / **+2h**.
3. Pick the **From** city (source timezone). Defaults to Bengaluru.
4. Add destination cities with **+ Add city**, or remove any with ×. Results update immediately for each city.
5. Optionally **Save as** a named set of cities (stored in the browser). Switch sets from the chips; **Save** overwrites the active set, **Save as** creates another, or **Delete** removes it.

No dates — only clock times and timezone offsets.

## Develop

```bash
cd app
npm ci
npm run dev
```

## Build

```bash
cd app
npm ci
npm run build
```

Output is in `app/dist/`.

## Cities

~7,300 world cities ship in `app/src/data/world-cities.json` (plus extras like Cupertino).

Regenerate from upstream:

```bash
cd app
npm run generate:cities
```

## Deploy (Cloudflare Pages)

**Dashboard:** create a Pages project named `zonewise`, connect this repo, set:

| Setting                | Value           |
| ---------------------- | --------------- |
| Root directory         | `app`           |
| Build command          | `npm run build` |
| Build output directory | `dist`          |

**CLI:**

```bash
cd app
npm run deploy
```

**GitHub Actions:** [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml) deploys on tag push and manual `workflow_dispatch`. Add these repository secrets:

| Secret                  | Value                                    |
| ----------------------- | ---------------------------------------- |
| `CLOUDFLARE_ACCOUNT_ID` | Account ID from the Cloudflare dashboard |
| `CLOUDFLARE_API_TOKEN`  | API token (see below)                    |
| `GA_MEASUREMENT_ID`     | Google Analytics measurement ID (`G-…`)  |

The deploy workflow passes `GA_MEASUREMENT_ID` into the Vite build as `VITE_GA_MEASUREMENT_ID`. For local Analytics testing, put the same value in `app/.env.local`.

Create the token at [API Tokens](https://dash.cloudflare.com/profile/api-tokens) → **Create Token** → **Custom Token**. Under **Permissions**, select:

1. **Account**
2. **Cloudflare Pages**
3. **Edit**

Then set **Account Resources** to **Include → All accounts** (or only the account that owns `zonewise`).

After deploy: [https://zonewise.pages.dev](https://zonewise.pages.dev)
