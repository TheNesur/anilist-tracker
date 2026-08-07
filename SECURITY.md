# Security Policy

## Supported Versions

Only the latest published version of the extension (Edge Add-ons / Chrome
Web Store) is supported with security fixes. Please make sure you're on the
latest version before reporting an issue.

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

If you discover a security issue — for example, something related to the
OAuth flow, token handling, extension permissions, or the community
title-matching system — please report it privately using
[GitHub's private vulnerability reporting](https://github.com/TheNesur/anilist-tracker/security/advisories/new)
("Security" tab → "Report a vulnerability").

Please include:

- A description of the issue and its potential impact
- Steps to reproduce (or a proof of concept, if applicable)
- The extension version and browser (Chrome/Edge) you tested on

## What to expect

This is a solo/small-team project maintained in spare time, so response
times aren't guaranteed, but reports are taken seriously and will be
acknowledged as soon as possible. Once a fix is available, it will be
shipped as a new release and mentioned in the changelog (without
disclosing exploit details until users have had time to update).

## Scope

This covers the extension itself (`anilist-tracker`). For issues with the
backend service (OAuth token exchange, community alias system), please
report them on the [anilist-tracker-backend](https://github.com/TheNesur/anilist-tracker-backend)
repository instead — or here if you're not sure which side is affected.
