# Migration verification

The new application runs entirely as browser JavaScript plus a Node.js HTTP server. The migration reuses only the original artwork, font/license, scene content, vocabulary and kana mappings. No native compiler, framework bindings, SDK libraries, binary archives or generated native application were copied.

- **19 tests passed** on Node.js 22.23.1, including the language-label repair and ambiguous garden spellings.
- Node.js **22.23.1 arm64**: portable runtime downloaded by `run.sh`, SHA-256 verified, server started successfully, HTTP 200.
- Node.js **26.13.0 arm64**: local server and native test suite passed.
- Browser: character cards, scene selection, correct progressive highlighting, Backspace undo, player-action rehearsal, portrait change, journal, a full six-round Hidden ending (including final practice gate), and garden checked in the in-app browser. At a 390-pixel phone width the page had no horizontal overflow and both interaction panels fit in the viewport. Screenshot files are recorded alongside this document.
- DeepSeek **deepseek-flash** at `https://api.deepseek.com`: real opening → Chinese free-reply translation → generated character response succeeded. The configured local key is excluded from Git. The follow-up live opening returned all three recommendation labels in Chinese after the prompt/repair change.
- A CI template is included for **Windows x86_64**, macOS and Linux using Node.js 22. It is inactive: the saved GitHub token lacks `workflow` permission. Windows startup has not been executed on this Mac. The Windows launcher uses built-in PowerShell to download and verify official Node if needed.

The generated story is probabilistic. The tests validate the application's contracts, state transitions and failure handling; they do not certify every possible model reply or kanji reading. The offline demo is authored and deliberately labelled, with choice-based replies only.
