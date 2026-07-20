# 🦖 Yoshi — AI Work Agent

Yoshi is a unified AI work agent delivered as a responsive SaaS web app. You never pick a
capability — you describe a goal, and Yoshi understands it, asks clarifying questions when
genuinely needed, builds an execution plan, runs it through a durable task engine, requests
approval before anything irreversible, verifies the result, and delivers the finished output
with files, citations, and notifications.

## The ten capabilities — one agent

All capabilities execute through the **same** task engine, planner, memory, auth, database,
file storage, notification system, and activity history. Nothing is duplicated; a workflow
run, a scheduled run, and a chat request all travel the same execution path.

| # | Capability | How it's implemented |
|---|------------|----------------------|
| 1 | **Long-running agents** | Tasks & steps persist in SQLite. Work survives refresh, browser close, logout, and server restarts (in-flight tasks are re-queued on boot). Progress = actually completed steps — never timer-faked. Pause / resume / retry / cancel / download outputs / completion notifications. |
| 2 | **Deep research** | Generates real web-search queries (DuckDuckGo HTML endpoint), fetches and reads real pages, synthesizes a cited report strictly from fetched sources, validates every cited link, and flags gaps/uncertainty explicitly. Follow-up questions adapt the plan. |
| 3 | **Browser automation** | A model-driven tool loop operates real Chromium via Playwright (navigate, click, type, scroll, extract, upload, download). Irreversible actions (submit, purchase, publish, send, delete, account creation) hard-pause the task for user approval — they cannot run without it. |
| 4 | **Scheduled tasks** | Cron or one-time schedules persist in the DB with timezone-aware next-run computation (cron-parser). A server loop fires them while you're offline/logged out. Edit, pause, resume, delete, run-now, full run history. |
| 5 | **Website monitoring** | Interval checks per monitor (content / price / availability / keyword / uptime). Saves HTML evidence snapshots, diffs normalized content, filters cosmetic noise (AI classification with a heuristic fallback), dedupes by content hash, and explains each change in the notification. |
| 6 | **File analysis** | PDF & images go to Claude natively; DOCX (mammoth), XLSX (exceljs), PPTX (slide XML), CSV/TXT are extracted with location markers (page / sheet+row / slide) so answers reference where evidence lives. Multi-file comparison supported. |
| 7 | **Document creation** | Real downloadable files: PDF (pdfkit), DOCX (docx), XLSX (exceljs), PPTX (pptxgenjs) rendered from model-drafted structured content. Download, rename, duplicate, delete, regenerate via follow-up. |
| 8 | **Multi-step planning** | The planner turns goals into dependency-ordered capability steps and appends a verification step. Users can view, edit, add, remove, and reorder steps (while paused), approve gated steps, and retry failures. Follow-ups trigger adaptive replanning against completed outputs. |
| 9 | **Memory** | Per-user memories (preferences, writing style, projects, companies, instructions) injected into planning and execution. Editable, deletable, searchable, per-item and globally disableable. Never stored automatically — only when explicitly saved or requested. Strictly scoped per user. |
| 10 | **Workflow builder** | Visual block builder + natural-language generation. Blocks: every capability plus approval, condition, and notification. Dependencies pipe outputs between steps; condition blocks gate branches. Save, edit (auto-versioned), duplicate, delete, test-run, schedule, run history, version restore. Runs compile into ordinary tasks on the same engine. |

## Architecture

```
yoshi/
├── server/            Node.js (ESM) + Express 5 + better-sqlite3
│   └── src/
│       ├── taskEngine.js      durable queue, step executor, approvals, recovery
│       ├── planner.js         goal → plan, clarifications, adaptive replanning
│       ├── capabilities/      research, browser, files, documents + registry
│       ├── scheduler.js       persistent cron/one-time scheduling (tz-aware)
│       ├── monitors.js        change detection, evidence, dedupe
│       ├── workflowSteps.js   workflow definition → engine steps (topological)
│       ├── memory.js, fileStore.js, events.js (SSE), auth.js (JWT), ai.js
│       └── routes/api.js      REST API
├── client/            React 19 + Vite SPA (dark SaaS UI, live SSE updates)
└── package.json       root scripts
```

- **Single execution path**: chat tasks, scheduled runs, workflow runs, and monitor-triggered
  work all become rows in `tasks`/`task_steps` executed by the same engine.
- **Real-time**: one SSE stream per session pushes task/step updates, notifications, and
  approval requests to every open tab.
- **Honesty guarantees**: research only cites fetched sources and validates links; progress
  reflects completed steps; AI-dependent steps fail with a clear error (never fabricate) when
  the model is unreachable.

## Running it

```bash
# 1. Install
npm run install:all

# 2. Configure AI (required for research/planning/analysis/document drafting)
export ANTHROPIC_API_KEY=sk-ant-...

# 3. Build the client and start
npm run build
npm start            # serves app + API on http://localhost:4020
```

Development mode (hot reload): `npm run dev:server` and `npm run dev:client` (Vite proxies `/api`).

### Configuration (env vars)

| Variable | Default | Purpose |
|----------|---------|---------|
| `ANTHROPIC_API_KEY` | — | Enables all AI capabilities |
| `PORT` | `4020` | HTTP port |
| `YOSHI_DATA_DIR` | `server/data` | SQLite DB, files, snapshots |
| `YOSHI_MODEL` / `YOSHI_PLANNER_MODEL` / `YOSHI_FAST_MODEL` | sonnet / sonnet / haiku | Model selection |
| `YOSHI_TASK_CONCURRENCY` | `3` | Parallel task workers |
| `YOSHI_JWT_SECRET` | auto-generated & persisted | Session signing |
| `PLAYWRIGHT_BROWSERS_PATH` / `YOSHI_CHROMIUM_PATH` | auto | Chromium for browser automation |

Browser automation needs a Chromium install (`npx playwright install chromium` or point
`YOSHI_CHROMIUM_PATH` at an existing binary).

## Tests

```bash
npm test
```

13 end-to-end tests boot a real server on a scratch database and verify: auth + per-user data
isolation, workflow runs through the engine with approval gates (approve and reject paths),
plan editing + resume, cancel, file upload/download/rename/duplicate/delete, monitor change
detection with evidence snapshots and alert dedupe, timezone-correct scheduling with history,
memory CRUD/search/toggles, workflow versioning/restore/validation, clean failure of
AI-dependent tasks when unconfigured, and that all four document renderers produce real files.
