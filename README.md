# AniList Tracker

> A Chrome/Edge extension that automatically detects manga, manhwa, and anime progress on supported sites and syncs it to your AniList account in one click.

![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)
![License](https://img.shields.io/badge/License-MIT-green)

---

## Features

- **Auto-detection** — detects title and chapter/episode directly from the page DOM
- **One-click sync** — update your AniList progress without switching tabs
- **Progress guard** — never downgrades your progress accidentally
- **Title mapping** — remembers site title → AniList entry associations for instant future detection
- **Anime & Manga** — tracks both reading and watching progress
- **Theme support** — dark and light mode
- **Secure OAuth 2.0** — your AniList password is never stored; token exchange happens server-side

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

---

## Installation

### From the Edge Add-ons Store
Search for **AniList Tracker** on the [Microsoft Edge Add-ons store](https://microsoftedge.microsoft.com/addons/).

### Manual / Development

**Prerequisites:** Node.js 18+, npm

```bash
git clone https://github.com/TheNesur/anilist-tracker.git
cd anilist-tracker
npm install
```

**Configure environment:**

Create a `.env` file at the project root:

```env
VITE_ANILIST_CLIENT_ID=your_client_id
VITE_ANILIST_REDIRECT_URL=https://<your-extension-id>.chromiumapp.org/
```

> To get your extension ID and redirect URL: load the extension once in developer mode, then open the service worker console and run `chrome.identity.getRedirectURL()`.

> The `CLIENT_SECRET` is **not** stored in the extension. Token exchange is handled by a backend endpoint — see [Security](#security).

**Build:**

```bash
npm run build
```

Then in your browser:
1. Go to `edge://extensions/` (or `chrome://extensions/`)
2. Enable **Developer mode**
3. Click **Load unpacked** → select the `dist/` folder

---

## Architecture

```
src/
├── background/         # Service worker — OAuth, AniList API, message routing
├── content/            # Content script — injected on supported sites, detects progress
├── parsers/
│   ├── manga/          # Site-specific DOM parsers for manga/webtoon sites
│   ├── anime/          # Site-specific DOM parsers for anime sites
│   └── index.ts        # Parser factory
├── popup/              # Extension popup — login, detection display, update confirmation
├── options/            # Options page — theme, auto-update, title mappings
├── types/              # Shared TypeScript types
└── utils/              # AniList GraphQL client, storage helpers, i18n
_locales/
├── en/messages.json    # English strings
└── fr/messages.json    # French strings
```

### Detection Flow

```
Content script detects title + chapter/episode
        ↓
Sends MANGA_DETECTED to background worker
        ↓
Background looks up title mapping or searches AniList
        ↓
Fetches current progress from AniList
        ↓
User opens popup → confirms update
        ↓
Background calls SaveMediaListEntry mutation
```

---

## Security

The AniList `CLIENT_SECRET` is **never bundled** in the extension. Token exchange happens via a dedicated backend endpoint (`auth.mraitchkovitch.fr`) that holds the secret server-side and returns only the `access_token` to the extension.

---

## Adding a New Site

1. Create a parser class in `src/parsers/manga/` or `src/parsers/anime/` implementing `SiteParser`
2. Add the site to `SupportedSite` in `src/types/index.ts`
3. Register the parser in `src/parsers/index.ts` → `getParser()`
4. Add URL patterns to `public/manifest.json` → `content_scripts.matches`
5. Add hostname mapping in `src/popup/popup.ts` → `SUPPORTED_HOSTNAMES`

```typescript
// Example parser
export class MySiteParser implements SiteParser {
  site: SupportedSite = "mysite";

  isChapterPage(): boolean {
    return /\/chapter\/\d+/.test(window.location.pathname);
  }

  detect(): MediaDetection | null {
    if (!this.isChapterPage()) return null;
    const title = document.querySelector("h1")?.textContent?.trim() ?? null;
    const chapter = parseInt(window.location.pathname.match(/\/chapter\/(\d+)/)?.[1] ?? "");
    if (!title || isNaN(chapter)) return null;
    return { title, progress: chapter, mediaType: "MANGA", source: this.site, url: window.location.href };
  }
}
```

---

## Tech Stack

- **TypeScript** + **Vite** + **CRXJS** (Manifest V3)
- **AniList GraphQL API** (OAuth 2.0 Authorization Code flow)
- **Chrome Extensions API** (storage, identity, activeTab)
- **i18n** — English and French via `_locales`

---

## Privacy

No analytics, no tracking, no ads. All data stays on your device. See [PRIVACY.md](./PRIVACY.md) for details.

---

## License

MIT — see [LICENSE](./LICENSE)