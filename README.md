# AniList Tracker

> Automatically sync your manga, manhwa, and anime progress to AniList — directly from your reading or streaming site.

![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)
![Version](https://img.shields.io/badge/version-0.4.1-green)
![License](https://img.shields.io/badge/License-MIT-green)
[![Edge Add-ons](https://img.shields.io/badge/Edge%20Add--ons-available-0078D4?logo=microsoftedge)](https://microsoftedge.microsoft.com/addons/detail/anilist-tracker)

---

<!-- Screenshot placeholder -->
<!-- ![Demo](docs/demo.gif) -->

---

## Features

- **Auto-detection** — reads title and chapter/episode directly from the page DOM, no manual input
- **Generic detection fallback** — on sites without a dedicated parser, the extension still attempts to detect the title and chapter/episode on a best-effort basis
- **Community title matching** — when AniList's search can't find a title automatically, corrections manually resolved by users can (opt-in) help other users hit the same title instantly, once independently confirmed by several accounts
- **One-click sync** — update your AniList progress without leaving the page
- **Progress guard** — never accidentally downgrades your progress
- **Title mapping** — remembers site title → AniList entry associations for instant future detection
- **Anime & Manga** — tracks both reading and watching progress
- **Auto-update mode** — optionally skip the confirmation step entirely
- **Dark & light theme** — follows your preference
- **EN/FR localization** — full interface in English and French
- **Secure OAuth 2.0** — your password is never stored; token exchange happens server-side
- **Privacy-conscious** — every data-sharing feature is opt-in and clearly disclosed, see [PRIVACY.md](./PRIVACY.md)

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

### Any other site

If a site isn't in our supported list, the extension attempts **generic detection** — reading the page title, headings, and URL to guess the manga/anime title and chapter/episode number. It's less reliable than a dedicated parser, but it means the extension isn't limited to a fixed list of sites.

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
VITE_TOKEN_ENDPOINT=https://auth.mraitchkovitch.fr/callback
```

> To get your extension ID: load the extension once in developer mode, open the service worker DevTools console and run `chrome.identity.getRedirectURL()`.

> The `CLIENT_SECRET` is **never bundled** in the extension. Token exchange is handled server-side — see [Security](#security). The backend that powers authentication and community title matching lives in a separate repository: [anilist-tracker-backend](https://github.com/TheNesur/anilist-tracker-backend).

**Build:**

```bash
npm run build
```

For a stable local extension ID during development (useful for testing OAuth without re-registering a redirect URI on every reload), see `npm run build:dev` and `dev-key.txt` in the repository.

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
(or, on unsupported sites, generic detection runs on demand)
        ↓
Background worker looks up your title mapping, searches AniList,
or checks the community title-matching database as a last resort
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
├── background/         # Service worker — OAuth, AniList API, message routing, alias system
├── content/             # Content script — injected on supported sites
├── parsers/
│   ├── manga/          # Site-specific DOM parsers (manga/webtoon)
│   ├── anime/          # Site-specific DOM parsers (anime)
│   ├── generic.ts      # Best-effort detection for unsupported sites
│   └── index.ts        # Parser factory
├── popup/              # Extension popup UI
├── options/             # Settings page
├── types/               # Shared TypeScript types
└── utils/               # AniList GraphQL client, storage, i18n
_locales/
├── en/messages.json    # English strings
└── fr/messages.json    # French strings
```

The OAuth token exchange and community title-matching endpoints are handled by a separate backend service — see [anilist-tracker-backend](https://github.com/TheNesur/anilist-tracker-backend).

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
- Rate limiting on the token and title-matching endpoints
- Tokens are never logged
- Community title-matching submissions are tied to a pseudonymized (HMAC-derived) identifier rather than your raw AniList account ID, and require a valid AniList access token to submit — preventing anonymous spam
- Generic detection scripts are injected on demand only, scoped to the active tab (`activeTab`), never running automatically in the background

---

## Tech Stack

- **TypeScript** + **Vite** + **CRXJS** (Manifest V3)
- **AniList GraphQL API** (OAuth 2.0 Authorization Code flow)
- **Chrome Extensions API** (`storage`, `identity`, `alarms`, `scripting`, `activeTab`)
- **i18n** — EN/FR via `_locales`
- **Express** + **SQLite** backend on a personal VPS for authentication and community title matching

---

## Contributing

1. Fork the repository
2. Create a feature branch from `dev`: `git checkout -b feature/my-feature`
3. Commit your changes
4. Open a Pull Request toward `dev`

Please keep PRs focused and avoid mixing unrelated changes.

---

## Privacy

No analytics, no tracking, no ads. All data stays on your device by default; the only data-sharing feature (community title matching) is opt-in and fully disclosed.

See [PRIVACY.md](./PRIVACY.md) for the full privacy policy.

---

## License

MIT — see [LICENSE](./LICENSE)