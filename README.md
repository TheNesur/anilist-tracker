# AniList Tracker

A lightweight Chrome extension that automatically detects the manga/manhwa you're reading and syncs your progress to AniList via its GraphQL API. Built with TypeScript and Manifest V3.

## Features

- **Auto-detection**: Detects manga title and chapter number on supported sites
- **AniList sync**: Search and update your reading progress via AniList's GraphQL API
- **Title mapping**: Remembers which site title maps to which AniList entry
- **OAuth 2.0**: Secure authentication — your AniList password is never stored

## Supported Sites

| Site | Status |
|------|--------|
| Asura Comics | ✅ |
| Flame Comics | ✅ |
| Reaper Scans | ✅ |
| Luminous Scans | 🔜 |

## Setup

### Prerequisites

- Node.js 18+
- npm

### 1. Clone & Install

```bash
git clone https://github.com/YOUR_USERNAME/anilist-tracker.git
cd anilist-tracker
npm install
```

### 2. Create an AniList App

1. Go to [AniList Developer Settings](https://anilist.co/settings/developer)
2. Create a new app
3. Set the redirect URL to your Chrome extension's redirect URL (you'll get this from `chrome.identity.getRedirectURL()` after loading the extension once)
4. Copy your **Client ID**

### 3. Configure

Edit `src/background/index.ts` and replace `YOUR_ANILIST_CLIENT_ID` with your actual Client ID.

### 4. Build & Load

```bash
# Development (with hot reload)
npm run dev

# Production build
npm run build
```

Then in Chrome:
1. Go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" and select the `dist/` folder

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

1. **Content script** runs on a supported manga site → detects title + chapter
2. Sends a `MANGA_DETECTED` message to the **background worker**
3. Background searches AniList (or uses saved mapping) → stores results
4. User opens **popup** → sees detection → picks correct AniList entry → confirms update
5. Background calls `SaveMediaListEntry` mutation → progress updated

## Adding a New Site

1. Create a new parser class in `src/parsers/index.ts` implementing `SiteParser`
2. Add the hostname detection in `getParser()`
3. Add the URL patterns in `public/manifest.json` → `content_scripts.matches`

## Tech Stack

- **TypeScript** + **Vite** + **CRXJS** (Manifest V3)
- **AniList GraphQL API** (OAuth 2.0 Implicit Grant)
- **Chrome Extensions API** (storage, identity, messaging)

## License

MIT
