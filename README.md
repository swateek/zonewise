# Zonewise

See the same moment in every city. Shows both **Standard** and **Daylight** offsets when a city observes DST.

## Develop

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

Output is in `dist/`.

## Cities

~7,300 world cities ship in `src/data/world-cities.json` (plus extras like Cupertino).

Regenerate from upstream:

```bash
npm run generate:cities
```


**Dashboard:** create a Pages project named `zonewise`, connect this repo, set:

| Setting | Value |
|---|---|
| Build command | `npm run build` |
| Build output directory | `dist` |

**CLI:**

```bash
npm run deploy
```

Live URL after deploy: `https://zonewise.pages.dev`
