# Aani — Roadmap

State of the repo and what's planned. CLAUDE.md holds durable context
(stack, conventions, business logic); this file holds anything that
changes month to month.

## Current state (2026-05)

### `apps/mobile` — shipping
- Expo (SDK 52+) + Clerk auth
- Neon + Drizzle connected directly from the client
- Cloudflare R2 for audio file storage
- File import from device, playlist management
- Player with rate control, live BPM, Discogs enrichment
- Editorial design system in place across screens
  (see `apps/mobile/components/ui` and UI_RULES.md / UI_ARCHITECTURE.md)

### `apps/api` — in development
- Bun + Hono on Railway
- yt-dlp YouTube audio downloader (cookies stored per user in R2)
- Track CRUD endpoints (rename, delete)
- Playlist endpoints
- Discogs sync

### `apps/web` — in development
- Next.js 15 + React 19 + Tailwind 4 on Vercel
- Clerk Next.js SDK for auth
- Library, playlists (index + detail), downloads, settings pages
- **Design system: partially ported from mobile.** Tokens are shared
  (`apps/web/design/raw.js` re-exports the mobile source of truth;
  `tailwind.config.ts` consumes it). 14 primitives exist in
  `apps/web/components/ui/` — Text, Stack, Inline, Surface, Button,
  IconButton, Input, Field, ListRow, StatusDot, PageSection,
  HeroSection, Divider. Screens are on the paper/ink/cobalt palette
  but still mix raw `<div>` + inline Tailwind for patterns the
  primitives don't cover yet (custom selects, chip clusters, settings
  rows). Remaining work: port high-value missing primitives
  (Pressable, Cluster, ListSection, ProgressBar, Banner, Switch,
  SettingsRow, Screen shell, AppBar) and migrate the screens that
  still inline.

## Deferred / not yet implemented
- Automatic BPM detection on ingest (today BPM is entered manually).
- Unified content-addressable R2 path: `tracks/{contentHash}.{ext}`
  (task #12). Today there are two patterns — see CLAUDE.md.
- Per-user track overrides. Today `tracks.title` is global, so a
  rename via the web app's PATCH `/tracks/:id` mutates that title for
  every user who shares the deduped row. Single-user today; worth
  fixing before any second user joins.
- Finish porting the web design system (see `apps/web` above for the
  remaining primitive + screen-migration gap).

## Decisions log
- 2026-05-09: phase-based gating dropped from CLAUDE.md. Phase 2
  scope (API, web, yt-dlp) has started, so the "do not implement"
  rules around it were stale and misleading agents.
