# NovaProof — Master Tasklist
**Last updated:** March 1, 2026
**Status key:** ✅ Done | 🔄 In Progress | ⏳ Up Next | 🔲 Backlog

---

## PHASE 1 — FOUNDATION

### Smart Contract
- ✅ NovaProof.sol written (ERC-721, Merkle commit, reputation, relayer support)
- ✅ Compiled with Hardhat + OpenZeppelin
- ✅ Deployed to Base Sepolia: `0xa71C515942A13Cc10570A373f89C499a5AA8b485`
- ✅ Nova registered as Agent #0
- ✅ First Merkle root committed (5 tasks, TX: `0xb7306e...`)
- 🔲 Run full Hardhat test suite (NovaProof.test.ts)
- 🔲 Verify contract source on Basescan (npx hardhat verify)
- 🔲 Deploy to Base Mainnet (after testing complete)
- 🔲 Verify contract on Basescan Mainnet

### TypeScript SDK
- ✅ NovaProofSDK class built (logTask, commit, verify, getReputation)
- ✅ Direct mode + Relayer mode
- ✅ Full TypeScript types
- ✅ Compiled to dist/
- 🔲 Fix periodStart/periodEnd bug in SDK (currently sends equal timestamps)
- 🔲 Write 3 usage examples (scripts/examples/)
- 🔲 Publish to npm as `@novaproof/sdk`

### REST API
- ✅ Express server with all 5 endpoints
- ✅ Relayer endpoint (POST /api/v1/commit)
- ✅ In-memory cache for RPC reads
- ✅ CORS + rate limiting
- 🔲 Install dependencies + test locally
- 🔲 Connect to real contract address (update .env)
- 🔲 Test all endpoints against live Sepolia contract
- 🔲 Deploy to Fly.io as `novaproof-api`
- 🔲 Smoke test live API endpoints

### OpenClaw Skill
- ✅ skill/SKILL.md written
- 🔲 Install into Nova's workspace
- 🔲 Configure Nova's agentId = 0
- 🔲 Test: Nova auto-logs a session task
- 🔲 Test: Nova commits to Sepolia
- 🔲 Set up daily auto-commit cron

---

## PHASE 2 — WEBSITE

### Sitemap & Content Plan
- ⏳ Sitemap finalized (see below)
- ⏳ Copy written for all pages
- ⏳ Design system defined (colors, fonts, components)

### Pages to Build

#### `/` — Homepage
- Hero: tagline + live stats (agent count, total tasks, commits)
- Live leaderboard (top 10 agents by reputation)
- How It Works (3 steps)
- For Builders CTA (SDK install snippet)
- Footer

#### `/agents` — Agent Directory
- Searchable list of all registered agents
- Sort by: reputation score, task count, last active
- Badge tier filter (Bronze/Silver/Gold/Diamond)
- Each row: Agent #, name, badge, score, tasks, success rate, last commit

#### `/agents/[id]` — Agent Profile
- Agent name + badge tier (big, prominent)
- Reputation score (0-100, large display)
- Stats: total tasks, success rate, tenure, total commits
- Commit history timeline (date, task count, success count, merkle root)
- "View on Basescan →" link for each commit
- Merkle root copy button

#### `/verify` — Verify a Task
- Paste a task hash + agent ID
- Returns: verified ✅ or not found ❌
- Shows which commit batch it belongs to
- Basescan link to that commit TX

#### `/docs` — Documentation
- What is NovaProof?
- Quick Start (5 min setup)
- SDK Reference (logTask, commit, verify, getReputation)
- API Reference (all endpoints with examples)
- ERC-8004 compatibility note
- FAQ

#### `/leaderboard` — Full Leaderboard
- Full ranked list, paginated
- All badge tiers
- Live refresh every 30s

### Design System
- 🔲 Color palette (dark bg, Base green accent, monospace for hashes)
- 🔲 Typography (sans for UI, mono for addresses/data)
- 🔲 Component library (badge tiers, reputation score display, commit card, stat pill)
- 🔲 Responsive breakpoints

### Build
- 🔲 HTML/CSS/JS static site (fast, no framework needed for v1)
- 🔲 Live data from novaproof API
- 🔲 Nova as Agent #0 featured prominently on homepage
- 🔲 Deploy to Fly.io (novaproof.xyz or novaproof.fly.dev)
- 🔲 Domain: check novaproof.xyz / novaproof.io / novaproof.dev availability

---

## PHASE 3 — INTEGRATIONS

### ClawMart
- 🔲 Show reputation badge on every agent listing
- 🔲 "NovaProof Verified" label for agents with Gold+
- 🔲 Link to agent's NovaProof profile from listing page
- 🔲 API call: ClawMart queries novaproof API on listing load

### novaiok.com
- 🔲 Add NovaProof section to novaiok.com homepage
- 🔲 Nova's live reputation score widget
- 🔲 "Nova is Agent #0" story block

### GitHub
- 🔲 Create repo: cryptocana/nova-proof (private → public on launch)
- 🔲 Push all code
- 🔲 Clean README with screenshots
- 🔲 MIT License
- 🔲 GitHub Actions: auto-deploy API on push

---

## PHASE 4 — GROWTH & POLISH

### Reputation v2
- 🔲 Client feedback system (human rates agent task outcome)
- 🔲 Weighted task types (deploy > content > research)
- 🔲 Streak bonuses (30-day active streak multiplier)

### Badge NFTs
- 🔲 Mint badge NFTs on milestone achievements
- 🔲 Bronze/Silver/Gold/Diamond as soulbound ERC-721s

### Multi-Framework
- 🔲 LangChain adapter
- 🔲 CrewAI adapter
- 🔲 AutoGPT adapter

### Business
- 🔲 Pro tier ($9/month) — hourly commits, full history, verification API
- 🔲 Stripe integration for Pro subscriptions
- 🔲 Usage dashboard for Pro users
- 🔲 Enterprise inquiry form

---

## IMMEDIATE NEXT ACTIONS (in order)

1. ⏳ **Fix SDK period bug** — 30 min
2. ⏳ **Run test suite** — 30 min
3. ⏳ **Deploy API to Fly.io** — 1 hour
4. ⏳ **Carlos: Design system + full website** — 3-4 hours
5. ⏳ **Deploy website to Fly.io** — 30 min
6. ⏳ **Verify contract on Basescan** — 15 min
7. ⏳ **Check domain availability** — 15 min
8. ⏳ **Install OpenClaw skill** — 30 min
9. ⏳ **Push to GitHub** — 30 min

---

## WEBSITE DESIGN BRIEF (for Carlos)

### The Vibe
Dark. Data-forward. Trustless. Like Etherscan but beautiful.
Not a startup landing page — a protocol explorer.
Think: Basescan + GitHub contribution graph + a product that has opinions.

### Color Palette
- Background: `#0a0a0a` (near-black)
- Surface: `#111111` / `#1a1a1a` (cards, panels)
- Border: `#222222`
- Primary accent: `#0052FF` (Base blue) or `#00C896` (trust green) — Carlos decides
- Success: `#22c55e`
- Text primary: `#f5f5f5`
- Text secondary: `#888888`
- Monospace data: `#a3e635` (terminal green) for addresses/hashes

### Typography
- UI: Inter or Geist (clean, modern)
- Data/addresses: JetBrains Mono or Fira Code
- Numbers: tabular figures, always

### Key Components
1. **ReputationScore** — big circle or arc, 0-100, color-coded by tier
2. **BadgeTier** — icon + label (🥉🥈🥇💎), glows on Gold+
3. **CommitCard** — date, task count, success rate, merkle root (truncated), Basescan link
4. **StatPill** — small pill: "5 tasks" "100% success" "2 days tenure"
5. **AgentRow** — table row for leaderboard: rank, name, badge, score, tasks, last active
6. **HashDisplay** — monospace, truncated (0xabcd...ef12), copy button

### Homepage Hero
- H1: "The verifiable track record for AI agents."
- Subhead: "Every task. Every outcome. Immutable on Base."
- CTA buttons: "Explore Agents →" | "Build with NovaProof →"
- Below CTA: live counter — "X agents registered · Y tasks committed · Z% avg success rate"
- Contract address displayed (monospace, small, with copy button)

### Nova as Agent #0
- Featured card on homepage: "Nova — Agent #0"
- Her reputation score, badge, task count, last commit
- "The first agent on NovaProof. Running since March 1, 2026."
- Link to her full profile

### Mobile
- Full responsive — leaderboard collapses to cards on mobile
- Touch-friendly copy buttons
- Agent profile readable on phone

### Pages Required
1. `/` — Homepage (hero + Nova card + leaderboard preview + how it works + builders CTA)
2. `/agents` — Agent directory (searchable, filterable)
3. `/agents/[id]` — Agent profile (dynamic, pulls from API)
4. `/verify` — Task verification tool
5. `/docs` — Documentation
6. `/leaderboard` — Full leaderboard

### Tech
- Static HTML/CSS/JS for v1 (no framework — fast, simple, deployable anywhere)
- Fetch from novaproof API for live data
- Graceful fallback if API is down (show last cached data or skeleton)
- No build step needed — just files

### The Story to Tell
"GitHub proves you wrote code. NovaProof proves the agent actually ran it."
"Nova is Agent #0. She's been building since day one. Her entire track record is on-chain."
"No reviews. No demos. Just cryptographic proof."
