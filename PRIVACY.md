# Privacy Policy — AniList Tracker

**Last updated:** June 10, 2026

## Overview

AniList Tracker is a browser extension that detects manga, manhwa, and anime titles on supported reading and streaming sites, and syncs your progress to your AniList account. This policy explains what data the extension accesses and how it is handled.

## Data collected

The extension stores the following data **locally on your device** using the browser's built-in storage API:

- **AniList OAuth access token** — used to authenticate API requests to AniList on your behalf
- **AniList user ID** — used to fetch and update your progress
- **Title mappings** — associations between titles on reading/streaming sites and their corresponding AniList entries

## Third-party services

The extension communicates with the following services:

- **AniList API** (`https://graphql.anilist.co`) — to authenticate your account, search for media entries, read your current progress, and update it
- **Authentication endpoint** (`https://auth.mraitchkovitch.fr`) — solely to exchange the OAuth authorization code for an access token. No user data is retained by this endpoint.

No analytics, tracking, or advertising services are used.

## Data sharing

Your data is **never shared, sold, or transmitted** to any third party. All data remains on your device and is only sent to AniList at your explicit request (when you confirm a progress update).

## Permissions

- **Storage**: to save your authentication token, user ID, and title mappings locally
- **Identity**: to handle the AniList OAuth login flow
- **Tabs**: to detect the URL of the active tab and determine whether the current page is on a supported site
- **Alarms**: to schedule badge clearing on the extension icon after a progress update
- **Host permissions** (`graphql.anilist.co`, `auth.mraitchkovitch.fr`, supported reading/streaming sites): to communicate with the AniList API, the authentication endpoint, and to inject the content script on supported pages

## Data deletion

You can remove all stored data at any time by:

1. Right-clicking the extension icon → "Remove extension", or
2. Going to your browser's extension settings and clearing the extension's data

You can also revoke the extension's access to your AniList account at [AniList App Settings](https://anilist.co/settings/apps).

## Contact

For any questions regarding this privacy policy, please open an issue on the [GitHub repository](https://github.com/TheNesur/anilist-tracker/issues).