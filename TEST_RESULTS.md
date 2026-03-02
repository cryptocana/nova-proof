# Test Results — 2026-03-01 19:02 EST

## API Tests
- [x] **Health endpoint** — `{"status":"ok","contract":"0xa71C...0485","chain":84532}`
- [x] **Agent #0 (Nova)** — Name: Nova, Tasks: 13, Successes: 13, Rate: 10000bp (100%), Commits: 2
- [x] **Agent #1 (Carlos)** — Name: Carlos, Tasks: 45, Successes: 43, Rate: 9555bp (95%), Commits: 1
- [x] **Agent #2 (Visiona)** — Name: Visiona, Tasks: 28, Successes: 28, Rate: 10000bp (100%), Commits: 1
- [x] **Leaderboard** — All 3 agents returned with names (Carlos, Visiona, Nova). Sorted by totalTasks desc.
- [x] **Nova commits** — 2 commits returned with merkle roots, task/success counts, and timestamps

## Clean URL Tests
- [x] `/` — 200
- [x] `/agents` — 200
- [x] `/leaderboard` — 200
- [x] `/verify` — 200
- [x] `/docs` — 200
- [x] `/agent?id=0` — 200

## Data Accuracy
- [x] **Leaderboard has names** — Carlos, Visiona, Nova all present (no "NO NAME")
- [x] **Nova successRate in basis points** — Raw value: 10000 (correct, = 100%)
- [x] **Homepage shows 3 agents** — `stat-agents` value is "3" ✅
- [x] **No .html links in nav** — None found ✅
- [x] **Query param routing works** — `/agent?id=0` returns 200 (nginx try_files working)

## Issues Found
None. All tests passed.

## Verdict
**PASS** ✅ — All API endpoints return correct data with agent names. All clean URLs resolve to 200. Homepage stats show 3 agents. No legacy .html links remain. Success rates correctly stored in basis points. Leaderboard sorted and complete.

---
*Tested by Carlos 🥋*
