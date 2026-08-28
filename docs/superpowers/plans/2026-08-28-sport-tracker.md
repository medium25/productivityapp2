# Sport Tracker (Фитнес) — implementation plan

## Context

`README.md` documents a React + Vite app ("Productivity Hub") with 6 sections
(Фокус, Задачи и цели, Мысли, Привычки, Фитнес, Финансовый учёт) and a
`src/` layout (`layout/`, `pages/`, `store/`, `i18n/`, `export/`,
`constants/`, `icons/`). At the time this plan was written, the repository
contained only built/minified output at the root (no `src/` tree at all —
history shows files were pushed via GitHub's web uploader). There is no
existing plan document or app shell to build on.

This plan scaffolds the minimum app shell described by the README (routing,
layout, settings store, i18n) and implements one section fully: **Фитнес
(Sport tracker)**. The other five sections get simple placeholder pages so
routing/sidebar/settings are exercised end-to-end, matching the README's
"один раздел за раз" (one section at a time) approach. No backend — all data
in localStorage via zustand persist, matching the README.

## Tasks

Each task is implemented by a separate subagent, in order (each depends on
the previous), with review between steps.

### T1 — App scaffold: routing + layout
- `index.html`: point at `/src/main.jsx` (currently points at built `index.js`/`index.css`).
- `src/main.jsx`, `src/App.jsx`: React root, `react-router-dom` routes for the 6 sections + `/settings`.
- `src/constants/sections.js`: id, route path, ru/en/uz labels (labels can live here temporarily, i18n wired in T3), icon key for all 6 sections.
- `src/layout/Sidebar.jsx`, `src/layout/TopBar.jsx`: nav links from `sections.js`, active-route highlighting.
- `src/pages/`: `Focus.jsx`, `Tasks.jsx`, `Thoughts.jsx`, `Habits.jsx`, `Finance.jsx` as minimal "in development" placeholders, `Settings.jsx` as an empty stub (filled in T2/T3).
- `src/icons/`: reuse/reference existing root `icons.svg` sprite (don't duplicate icon assets).
- Verify `npm run dev` boots and all routes render without console errors.

### T2 — Settings store (zustand)
- `src/store/settingsStore.js`: zustand store with `persist` (localStorage) for `language` (ru default), `theme` (light/dark), `visibleSections` (map of section id → boolean, default all true).
- Wire `TopBar`/`Sidebar` to theme (toggle class on root) and to `visibleSections` (hidden section disappears from nav but its data stays, per README).
- `Settings.jsx`: controls for theme toggle and per-section visibility checkboxes (language switcher wired in T3).

### T3 — i18n (react-i18next)
- `src/i18n/index.js`: react-i18next init, ru/en/uz resources, ru as fallback/default.
- `src/i18n/ru.json`, `en.json`, `uz.json`: keys for layout (sidebar section names, topbar), settings page, and the Fitness page strings that T5 will need (agree on key names now so T5 doesn't invent parallel ones).
- Replace hardcoded labels in Sidebar/TopBar/Settings from T1/T2 with `t()` calls.
- Language switcher in `Settings.jsx` writes to the settings store from T2 and actually changes rendered text.

### T4 — Fitness data store
- `src/store/fitnessStore.js`: zustand store with `persist`, workout entries `{ id, type, date (ISO), durationMin, calories, notes }`. Actions: `addWorkout`, `updateWorkout`, `deleteWorkout`.
- `type` is a small fixed set (e.g. run, walk, gym, cycling, swim, other) — define as a constant, translatable via i18n keys added in this task.

### T5 — Fitness page UI
- `src/pages/Fitness.jsx`: replace placeholder.
  - Form to add/edit an entry (type select, date, duration, calories, notes).
  - List/table of entries, newest first, with edit/delete.
  - Simple stats header: total workouts, total duration, total calories — for the current week and current month.
  - Filter by type and by date range.
  - All strings via i18n (T3 keys), respects theme.
- Manual check: add/edit/delete a few entries, reload the page, confirm persistence.

### T6 — Export (PDF/Word/Excel) for Fitness
- `src/export/fitness.js`: three functions using the already-installed `jspdf`+`jspdf-autotable`, `docx`, `xlsx` packages — export the current (filtered) workout list as PDF, Word, Excel.
- Buttons on `Fitness.jsx` (or wired through `Settings.jsx`'s per-section export area per README) to trigger each export.
- Manual check: each export produces a downloadable file with correct rows.

### T7 — Polish and verification
- `npm run lint` (oxlint) clean.
- `npm run build` succeeds (respect existing `vite.config.js` — flat output, no hashed filenames, `base: /productivityapp2/`).
- Fix any issues found by lint/build.
- Update `README.md`'s "в разработке" line: note Фитнес is implemented, others still pending.
- Final review pass over the whole `src/` diff for consistency (naming, i18n key coverage, store shape) before final push.

## Out of scope
- Firebase integration (an unused `firebase` dep and `firestore.rules` exist but README says "без бэкенда" — not touched here).
- The other five sections' real functionality — placeholders only.
- Auth/user accounts.
