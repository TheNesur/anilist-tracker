# Privacy Policy — AniList Tracker

**Last updated:** July 24, 2026

## Overview

AniList Tracker is a browser extension that detects manga, manhwa, and anime titles on supported reading and streaming sites — and, on a best-effort basis, on other sites too — then syncs your progress to your AniList account. This policy explains what data the extension accesses, what is sent to our servers, and how it is handled.

## Data stored locally on your device

The extension stores the following data **locally on your device** using the browser's built-in storage API. This data never leaves your device unless stated otherwise below.

- **AniList OAuth access token** — used to authenticate API requests to AniList on your behalf
- **AniList user ID and username** — used to fetch and update your progress
- **Title mappings** — associations between titles on reading/streaming sites and their corresponding AniList entries
- **Preferences** — theme, auto-update, auto-map, and title-matching contribution settings

## Data sent to our servers

### Authentication (always required)

To sign in, the extension exchanges an OAuth authorization code for an access token via our authentication endpoint (`auth.mraitchkovitch.fr`). This endpoint does not store your token, your code, or any personal data — it performs the exchange and returns the result to the extension.

### Generic title detection (when a site is not on our supported list)

If you open a page on a site we don't have a dedicated parser for, the extension attempts to detect the title and chapter/episode number directly from the page (title tag, headings, URL) — this processing happens **entirely on your device**, nothing is sent anywhere for this step.

### Community title matching (opt-in, disabled by default)

If AniList's search doesn't find a match for a detected title and you manually pick the correct entry yourself, the extension can optionally send this correction to our server so other users benefit from it too. This feature is **off by default** and only activates if you enable "Contribute title matches" in the extension's settings.

When enabled, submitting a correction sends:
- The detected title (normalized — lowercase, punctuation stripped)
- The media type (manga or anime)
- The AniList entry you selected (its ID and title)
- The **hostname only** of the site you were on (e.g. `example.com`) — never the full page URL or any content of the page itself
- A pseudonymized identifier derived from your AniList account ID using a one-way cryptographic function (HMAC), so we can detect and prevent abuse (e.g. spam or repeated submissions) without storing your AniList account ID directly alongside this data

This data is used to build a community-verified list of title corrections: a correction is only suggested to other users once it has been independently submitted by several different accounts, to prevent a single mistaken or malicious submission from affecting others. Looking up whether a correction already exists for a title (which happens automatically, regardless of whether contribution is enabled) does not send any identifying information — only the normalized title and media type.

## Third-party services

The extension communicates with the following services:

- **AniList API** (`https://graphql.anilist.co`) — to authenticate your account, search for media entries, read your current progress, and update it
- **Authentication endpoint** (`https://auth.mraitchkovitch.fr`) — to exchange the OAuth authorization code for an access token, and to handle the community title-matching feature described above

No analytics, tracking, or advertising services are used.

## Data sharing

Your data is **never shared, sold, or transmitted** to any third party. Community title-matching data (when you opt in) is used exclusively to power the title-suggestion feature within the extension itself, and is never published, exported, or made accessible outside of that purpose.

## Permissions

- **Storage**: to save your authentication token, user ID, and title mappings locally
- **Identity**: to handle the AniList OAuth login flow
- **Tabs**: to detect the URL of the active tab and determine whether the current page is on a supported site
- **Alarms**: to schedule badge clearing on the extension icon after a progress update
- **Scripting** and **activeTab**: to detect the manga/anime title on sites not covered by our supported list, only when you open the extension popup on that tab — no code is injected automatically or in the background
- **Host permissions** (`graphql.anilist.co`, `auth.mraitchkovitch.fr`, supported reading/streaming sites): to communicate with the AniList API, our authentication endpoint, and to inject the content script on supported pages

## Data deletion

You can remove all data stored **locally on your device** at any time by:

1. Right-clicking the extension icon → "Remove extension", or
2. Going to your browser's extension settings and clearing the extension's data

You can also revoke the extension's access to your AniList account at [AniList App Settings](https://anilist.co/settings/apps).

If you have enabled "Contribute title matches" and want your past contributions removed from our server, open an issue on the GitHub repository (see [Contact](#contact)) — we can locate and delete entries tied to your account using your AniList user ID.

## Contact

For any questions regarding this privacy policy, please open an issue on the [GitHub repository](https://github.com/TheNesur/anilist-tracker/issues).