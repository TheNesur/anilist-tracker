# AniList Tracker

A lightweight Chrome/Edge extension that automatically detects the manga/manhwa you're reading and syncs your progress to AniList via its GraphQL API. Built with TypeScript and Manifest V3.

## Features

- **Auto-detection**: Detects manga title and chapter number directly from the page DOM
- **AniList sync**: Search and update your reading progress via AniList's GraphQL API
- **Progress tracking**: Shows your current AniList progress and prevents downgrades
- **Title mapping**: Remembers which site title maps to which AniList entry
- **OAuth 2.0**: Secure authentication (Authorization Code flow) — your AniList password is never stored

## Supported Sites

| Site | Status |
|------|--------|
| Raijin Scans | ✅ Fully tested |
| Asura Comics | 🔧 Parser ready, needs DOM validation |
| Flame Comics | 🔧 Parser ready, needs DOM validation |
| Reaper Scans | 🔧 Parser ready, needs DOM validation |

## Setup

### Prerequisites

- Node.js 18+
- npm

### 1. Clone & Install

```bash
git clone https://github.com/TheNesur/anilist-tracker.git
cd anilist-tracker
npm install
```

### 2. Create an AniList App

1. Go to [AniList Developer Settings](https://anilist.co/settings/developer)
2. Create a new client
3. For the **Redirect URL**, load the extension once (step 4), then open the service worker console and run:
   ```js
   chrome.identity.getRedirectURL()
   ```
   Paste the returned URL as your redirect URI on AniList.
4. Copy your **Client ID** and **Client Secret**

### 3. Configure

Create a `.env` file at the project root:

```env
VITE_ANILIST_CLIENT_ID=your_client_id
VITE_ANILIST_CLIENT_SECRET=your_client_secret
```

> ⚠️ Never commit your `.env` file. It is already in `.gitignore`.

### 4. Build & Load

```bash
npm run build
```

Then in your browser:
1. Go to `chrome://extensions/` (or `edge://extensions/`)
2. Enable **Developer mode**
3. Click **Load unpacked** and select the `dist/` folder
4. After any code change: `npm run build` → click the reload button on the extension

## Architecture

```
src/
├── background/     # Service worker — API calls, OAuth, message routing
├── content/        # Content script — injected on manga sites, detects chapters
├── parsers/        # Site-specific DOM parsers (one per supported site)
├── popup/          # Extension popup UI — login, detection display, confirmation
├── types/          # Shared TypeScript types
└── utils/          # AniList API client, Chrome storage helpers
```

### Flow

1. **Content script** runs on a supported manga site → detects title + chapter from the DOM
2. Sends a `MANGA_DETECTED` message to the **background worker**
3. Background searches AniList (or uses saved mapping) → fetches current progress
4. User opens **popup** → sees detection with current progress → picks correct AniList entry → confirms update
5. Background calls `SaveMediaListEntry` mutation → progress updated (only if chapter > current progress)

## Adding a New Site

1. Create a new parser class in `src/parsers/index.ts` implementing `SiteParser`
2. Add the site to the `SupportedSite` type in `src/types/index.ts`
3. Add the hostname detection in `getParser()`
4. Add the URL patterns in `public/manifest.json` → `content_scripts.matches`

> **Tip**: Use the browser DevTools to inspect the chapter page DOM and find reliable selectors for the title and chapter number. Prefer class-based selectors over URL parsing.

## Tech Stack

- **TypeScript** + **Vite** + **CRXJS** (Manifest V3)
- **AniList GraphQL API** (OAuth 2.0 Authorization Code flow)
- **Chrome Extensions API** (storage, identity, messaging)

## License

MIT
