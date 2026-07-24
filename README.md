# Zonewise

See the same moment in every city. Shows both **Standard** and **Daylight** offsets when a city observes DST.

## Develop

```bash
cd app
npm install
npm run dev
```

## Build

```bash
cd app
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

Create the token at [API Tokens](https://dash.cloudflare.com/profile/api-tokens) → **Create Token** → **Custom Token**. Under **Permissions**, select:

1. **Account**
2. **Cloudflare Pages**
3. **Edit**

Then set **Account Resources** to **Include → All accounts** (or only the account that owns `zonewise`).

Live URL after deploy: `https://zonewise.pages.dev`
