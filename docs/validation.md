# Version 3 verification — 2026-11-05

- **32 automated tests** pass on the bundled **Node.js 22.23.1 arm64** and system Node.js 26.13.0. The tests use Node's native test runner with temporary/in-memory SQLite databases and no third-party package installation.
- Every supported romaji table spelling and each prefix is checked. Every bundled dictionary reading completes its canonical local spelling. Variable-length aliases, rejected wrong sounds, small-tsu boundaries and Backspace-compatible chunk progress are covered.
- Custom scene limits are checked for English and Japanese text; the setting remains in the prompt on later turns. The original nine authored scenes and three ending directions retain their existing tests.
- Accounts are tested for distinct salted hashes, case-insensitive sign-in, expiring/revocable hashed sessions, HttpOnly/SameSite cookies, cross-site rejection, private database permissions, and persistence after close/reopen.
- Learning tests cover a 30-new-word plan, due and early warm-up reviews, six spaced successful encounters, failure/hint retry intervals, pass exclusion, reading-before-meaning gates, reading-qualified dictionary choices, per-account isolation and duplicate-submit rejection.
- Tutor tests verify cached/coalesced examples, the Flash model/output caps, no chat messages in SQLite, bounded recent chat context, wrong-account rejection and invalid-example rejection.
- The macOS/Linux launcher was exercised with a private temporary data directory: HTTP 200, 1,200 bundled words, no pre-created account, directory mode 0700 and database mode 0600.
- A real DeepSeek round created a custom rainy-bookshop scene with Japanese dialogue, an emotion and three choices. Real study examples and an explicitly English follow-up reply also succeeded. These checks used an in-memory database and a temporary test account, leaving no test users in the application's data directory.
- On 2026-11-05, an isolated headless Google Chrome session exercised the actual version 3 UI: account creation/sign-in, a 30-word goal, kanji reading and meaning choices, saved records, a live AI example/follow-up, a custom-scene editor and generated opening, alternate `syo` input with green Japanese highlighting, player-action practice, and a complete six-round Hidden ending. No browser page errors were reported. Screenshots were refreshed at 1440 × 1050 and 390 × 844; the mobile view had no horizontal overflow. The demo account and learning records existed only in an in-memory SQLite database.
- Windows startup has not been executed on this Mac. The Windows launcher downloads official Node.js 22.23.1 x86_64, verifies its checksum and starts the same dependency-free server. The optional CI template remains inactive because the saved GitHub credential lacks workflow permission.

## Dictionary provenance

The bundled starter deck contains 1,200 JMdict headwords. The source archive URL, retrieval date, SHA-256, source entry IDs and transformation notes are embedded in `public/data/jmdict-starter.json`. English senses are filtered by written-form and reading restrictions before entering a quiz. Dictionary-derived data is shared under CC BY-SA 4.0 with EDRDG attribution on each garden screen. AI example sentences are separate supplementary material; they do not define quiz answer keys.

## Earlier migration

Version 2's portable Node.js download, original RPG browser loop (including green highlighting, expression change, journal and a complete Hidden ending), 390-pixel responsive layout, and live translated story round were verified before this feature update. The migration commit preserved the project without native SDK dependencies. The new-screen verification and refreshed captures are documented above and in [the screenshot index](screenshots.md).
