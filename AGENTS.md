# Repository Guidelines

## Project Structure & Module Organization

This is a Tauri desktop application with a React/Vite frontend.

- `App.tsx`, `index.tsx`, and `index.css` contain the application entry point and global styling.
- `components/` contains UI components and shared primitives; `hooks/` contains application state and behavior.
- `utils/` contains parsing, persistence, AI, Anki, and desktop adapters. Route Tauri calls through `utils/desktop.ts`.
- `src-tauri/` contains the Rust backend, capabilities, icons, and Tauri configuration.
- `docs/` contains the current technical overview and desktop/import conventions. Focused checks live at the root.

Keep new handwritten source files cohesive and preferably below 500 lines. Update both `utils/i18n.zh.ts` and `utils/i18n.en.ts` when adding user-facing text.

## Build, Test, and Development Commands

Install dependencies with `npm install`. Use the desktop runtime for development:

```bash
npx tauri dev
npx tsc --noEmit
cargo test --manifest-path src-tauri/Cargo.toml
node test-resegment.mjs
npm run release
```

`npx tauri dev` starts Vite and the macOS desktop shell. `npm run release` builds the app and runs the installer script. `npm run dev` lacks the Tauri APIs required by the application.

## Coding Style & Naming Conventions

Use two-space indentation, semicolons, PascalCase for components, camelCase for functions and variables, and `use*` names for hooks. Keep UI primitives in `components/ui.tsx` and preserve the light notebook visual language. Run `cargo fmt` before Rust changes.

## Testing Guidelines

There is no frontend test framework. Run `test-resegment.mjs`, and when relevant `test-tokenizer.js` or `test-flexible-case.js`, plus the TypeScript check. Add Rust unit tests alongside Rust behavior changes. Manually verify desktop behavior, especially file selection, playback, subtitle import, Anki, and persistence.

## Commit & Pull Request Guidelines

Recent commits use concise subjects describing a completed change, in English or Chinese. Prefer an imperative, user-focused subject such as `Fix subtitle import progress`. Pull requests should explain the behavior changed, list validation commands, link related issues, and include screenshots or a short recording for UI changes. Call out configuration, database, or Tauri capability changes.

## Data and Architecture Constraints

Do not change IndexedDB `DB_VERSION` or remove the legacy `fileHandles` table. Update video records with `patchVideoRecord` rather than replacing whole records. Keep video paths on disk, preserve `crossOrigin="anonymous"`, and keep import-task listeners in `App.tsx` so progress events remain visible across pages.
