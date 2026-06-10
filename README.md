# AniList Tracker

> Automatically sync your manga, manhwa, and anime progress to AniList — directly from your reading or streaming site.

![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)
![Version](https://img.shields.io/badge/version-0.3.2-green)
![License](https://img.shields.io/badge/License-MIT-green)
[![Edge Add-ons](https://img.shields.io/badge/Edge%20Add--ons-available-0078D4?logo=microsoftedge)](https://microsoftedge.microsoft.com/addons/detail/anilist-tracker)

---

<!-- Screenshot placeholder -->
<!-- ![Demo](docs/demo.gif) -->

---

## Features

- **Auto-detection** — reads title and chapter/episode directly from the page DOM, no manual input
- **One-click sync** — update your AniList progress without leaving the page
- **Progress guard** — never accidentally downgrades your progress
- **Title mapping** — remembers site title → AniList entry associations for instant future detection
- **Anime & Manga** — tracks both reading and watching progress
- **Auto-update mode** — optionally skip the confirmation step entirely
- **Dark & light theme** — follows your preference
- **EN/FR localization** — full interface in English and French
- **Secure OAuth 2.0** — your password is never stored; token exchange happens server-side

---

## Supported Sites

### Manga & Webtoon

| Site | URL |
|------|-----|
| MangaDex | mangadex.org |
| MangaPlus | mangaplus.shueisha.co.jp |
| Webtoon | webtoons.com |

### Anime

| Site | URL |
|------|-----|
| Crunchyroll | crunchyroll.com |

> More sites are supported. The full list is available in the extension settings.

---

## Installation

### From the Store

| Store | Status |
|-------|--------|
| [Microsoft Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/anilist-tracker) | ✅ Available |
| Chrome Web Store | 🔜 Coming soon |

### Manual / Development

**Prerequisites:** Node.js 18+, npm

```bash
git clone https://github.com/TheNesur/anilist-tracker.git
cd anilist-tracker
npm install
```

**Configure environment** — create a `.env` file at the project root:

```env
VITE_ANILIST_CLIENT_ID=your_client_id
VITE_ANILIST_REDIRECT_URI=https://<your-extension-id>.chromiumapp.org/
```

> To get your extension ID: load the extension once in developer mode, open the service worker DevTools console and run `chrome.identity.getRedirectURL()`.

> The `CLIENT_SECRET` is **never bundled** in the extension. Token exchange is handled server-side — see [Security](#security).

**Build:**

```bash
npm run build
```

**Load in browser:**

1. Go to `edge://extensions/` or `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked** → select the `dist/` folder

---

## How It Works

```
You open a chapter or episode page
        ↓
Content script detects title + chapter/episode from the DOM
        ↓
Background worker looks up your title mapping or searches AniList
        ↓
Your current AniList progress is fetched
        ↓
You open the popup → confirm the update (or it's automatic)
        ↓
AniList progress is updated via GraphQL API
```

---

## Architecture

```
src/
├── background/         # Service worker — OAuth, AniList API, message routing
├── content/            # Content script — injected on supported sites
├── parsers/
│   ├── manga/          # Site-specific DOM parsers (manga/webtoon)
│   ├── anime/          # Site-specific DOM parsers (anime)
│   └── index.ts        # Parser factory
├── popup/              # Extension popup UI
├── options/            # Settings page
├── types/              # Shared TypeScript types
└── utils/              # AniList GraphQL client, storage, i18n
_locales/
├── en/messages.json    # English strings
└── fr/messages.json    # French strings
```

---

## Adding a New Site

1. Create a parser class in `src/parsers/manga/` or `src/parsers/anime/` implementing `SiteParser`
2. Add the site to `SupportedSite` in `src/types/index.ts`
3. Register the parser in `src/parsers/index.ts` → `getParser()`
4. Add URL patterns to `public/manifest.json` → `content_scripts.matches`
5. Add the hostname mapping in `src/popup/popup.ts` → `SUPPORTED_HOSTNAMES`

```typescript
export class MySiteParser implements SiteParser {
  site: SupportedSite = "mysite";

  isChapterPage(): boolean {
    return /\/chapter\/\d+/.test(window.location.pathname);
  }

  detect(): MediaDetection | null {
    if (!this.isChapterPage()) return null;
    const title = document.querySelector("h1")?.textContent?.trim() ?? null;
    const chapter = parseInt(
      window.location.pathname.match(/\/chapter\/(\d+)/)?.[1] ?? ""
    );
    if (!title || isNaN(chapter)) return null;
    return {
      title,
      progress: chapter,
      mediaType: "MANGA",
      source: this.site,
      url: window.location.href,
    };
  }
}
```

---

## Security

The AniList `CLIENT_SECRET` is **never bundled** in the extension. The OAuth token exchange happens via a dedicated backend endpoint that holds the secret server-side and returns only the `access_token` to the extension.

Additional security measures:
- CSRF state parameter on every OAuth flow
- Extension ID allowlist on the backend
- Origin enforcement middleware
- Rate limiting on the token endpoint
- Tokens are never logged

---

## Tech Stack

- **TypeScript** + **Vite** + **CRXJS** (Manifest V3)
- **AniList GraphQL API** (OAuth 2.0 Authorization Code flow)
- **Chrome Extensions API** (`storage`, `identity`, `alarms`)
- **i18n** — EN/FR via `_locales`
- **Express** backend on a personal VPS for token exchange

---

## Contributing

1. Fork the repository
2. Create a feature branch from `dev`: `git checkout -b feature/my-feature`
3. Commit your changes
4. Open a Pull Request toward `dev`

Please keep PRs focused and avoid mixing unrelated changes.

---

## Privacy

No analytics, no tracking, no ads. All data stays on your device and is only sent to AniList at your explicit request.

See [PRIVACY.md](./PRIVACY.md) for the full privacy policy.

---

## License

MIT — see [LICENSE](./LICENSE)