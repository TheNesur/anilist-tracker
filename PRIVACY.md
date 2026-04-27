# Privacy Policy — AniList Tracker

**Last updated:** April 27, 2026

## Overview

AniList Tracker is a browser extension that detects manga/manhwa chapters on supported reading sites and syncs your reading progress to your AniList account. This policy explains what data the extension accesses and how it is handled.

## Data collected

The extension stores the following data **locally on your device** using the browser's built-in storage API:

- **AniList OAuth access token** — used to authenticate API requests to AniList on your behalf
- **AniList user ID** — used to fetch and update your reading progress
- **Title mappings** — associations between manga titles on reading sites and their corresponding AniList entries

No data is collected, stored, or transmitted to any server other than the official AniList API (`https://graphql.anilist.co`).

## Third-party services

The extension communicates exclusively with the **AniList API** to:

- Authenticate your account (OAuth 2.0)
- Search for manga entries
- Read your current reading progress
- Update your reading progress

No analytics, tracking, or advertising services are used.

## Data sharing

Your data is **never shared, sold, or transmitted** to any third party. All data remains on your device and is only sent to AniList at your explicit request (when you confirm a progress update).

## Permissions

- **Storage**: to save your authentication token, user ID, and title mappings locally
- **Identity**: to handle the AniList OAuth login flow
- **Host permissions** (`graphql.anilist.co`, `anilist.co`): to communicate with the AniList API

## Data deletion

You can remove all stored data at any time by:

1. Right-clicking the extension icon → "Remove extension", or
2. Going to your browser's extension settings and clearing the extension's data

You can also revoke the extension's access to your AniList account at [AniList App Settings](https://anilist.co/settings/apps).

## Contact

For any questions regarding this privacy policy, please open an issue on the [GitHub repository](https://github.com/TheNesur/anilist-tracker/issues).
