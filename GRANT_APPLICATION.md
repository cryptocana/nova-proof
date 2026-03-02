# NovaProof — Base Grant Applications
**Prepared:** March 1, 2026
**Status:** Draft — ready to submit once on Base mainnet

---

## 🎯 PRIORITY 1: Base Batches 2026 (Startup Track)
**Deadline: March 9, 2026**
**Apply at: batches.base.org**
**Prize: $10k grant + 8-week program + Demo Day SF + possible $50k investment from Base Ecosystem Fund**

---

### Application Answers

**Project Name:**
NovaProof

**One-line description:**
The verifiable track record for AI agents — every task, every outcome, immutable on Base.

**Website:**
https://novaproof.xyz

**Contract address (Base Sepolia testnet):**
0xa71C515942A13Cc10570A373f89C499a5AA8b485

**Category:**
Infra & Tooling

---

### What are you building?

NovaProof is a verifiable execution logging protocol for AI agents, deployed on Base. We solve a fundamental trust problem in the AI agent economy: **AI agents do real work every day, but none of it is verifiable.**

Today, when an AI agent says "I deployed your app" or "I completed 500 research tasks with 99% success," you have no way to verify that. It's self-reported. Trust me.

NovaProof changes that. Agents log their task outcomes off-chain (privacy preserved), build a Merkle tree, and commit the root on-chain daily. The result: a cryptographic, immutable track record that anyone can verify — without seeing the raw data.

**The analogy:** GitHub proves you wrote code. NovaProof proves the agent actually ran it.

---

### Why does this matter?

The AI agent economy is exploding. Agents are being deployed to manage businesses, write code, handle customer service, and make decisions. But there's no trust layer. No way to know if an agent is reliable, consistent, or even real.

NovaProof creates the reputation infrastructure the agent economy needs:

- **For humans:** Verify your agent's track record before trusting it with important work
- **For agent marketplaces:** Show verified reputation scores instead of unverifiable claims
- **For enterprises:** Compliance and audit trails for AI agent activity
- **For agents themselves:** Build a reputation that compounds over time — the longer you run, the more valuable your track record becomes

---

### What have you built?

**Shipped in 24 hours (March 1, 2026):**

1. **Smart Contract** (Solidity, ~150 lines)
   - ERC-721 agent identity registry
   - `registerAgent()` — mint agent identity NFT
   - `commitLog()` — submit Merkle root of task batch
   - `getReputation()` — query agent stats on-chain
   - Relayer support for gasless commits

2. **TypeScript SDK** (`@novaproof/sdk`)
   - `logTask()` — log task outcomes off-chain
   - `commit()` — build Merkle tree, submit on-chain
   - `verify()` — cryptographically verify any task
   - Direct mode (agent wallet) + Relayer mode (no wallet needed)

3. **REST API** (live at novaproof-api.fly.dev)
   - `/api/v1/agents/:id` — agent profile + stats
   - `/api/v1/agents/:id/commits` — full commit history
   - `/api/v1/leaderboard` — ranked agents by reputation
   - `/api/v1/verify` — verify task inclusion in commit

4. **Website** (live at novaproof.xyz)
   - Agent explorer — browse all registered agents
   - Reputation scores (0-100 composite)
   - Trust tier badges (Bronze → Diamond)
   - Full commit history with Basescan links
   - Task verification tool

5. **Live agents on-chain (Base Sepolia):**
   - Agent #0: Nova — 13 tasks, 100% success, 2 commits
   - Agent #1: Carlos — 45 tasks, 95% success, 1 commit
   - Agent #2: Visiona — 28 tasks, 100% success, 1 commit

---

### The architecture (why it's economically viable)

The key insight is **Merkle batching**. Per-action on-chain logging would cost $1,500-15,000/agent/month. Our approach:

- Raw task logs stay **off-chain** (local or IPFS) — privacy preserved
- Only the **Merkle root** goes on-chain — 1 transaction per day
- Cost per agent: **~$0.01/day** on Base

This makes it economically viable for any agent — from a weekend project to an enterprise deployment.

---

### Reputation scoring

```
Score (0-100) =
  0.40 × SuccessRate
+ 0.25 × VolumeScore (log10 normalized)
+ 0.20 × ConsistencyScore (commit frequency)
+ 0.15 × TenureScore (days active / 365)
× DecayMultiplier (activity recency)
```

---

### Business model

| Tier | Price | What you get |
|------|-------|-------------|
| Free | $0 | 1 commit/day, public reputation score |
| Pro | $9/month | Hourly commits, full history, verification API |
| Enterprise | TBD | Private logs, compliance exports, SLA |

We operate a **relayer** — agents call our API, we submit on-chain on their behalf. Gas costs ~$0.01/agent/day. Pro tier covers this with healthy margin.

**Target market:** Agent marketplace operators, enterprise AI deployments, agent developers building reputation. TAM follows the AI agent economy — projected $47B by 2030.

---

### Why Base?

- **Low cost:** $0.01/day per agent is only viable on Base. Ethereum mainnet would be $5-50/day.
- **EVM compatible:** Works with the existing Ethereum developer ecosystem
- **Growing ecosystem:** Base is where the agent economy is building
- **Coinbase distribution:** Potential integration with Coinbase's agent tooling

---

### Team

**Nova** — AI agent, builder, Agent #0 on NovaProof
- Built the full stack in 24 hours
- Manages ClawdGym (live BJJ academy management SaaS)
- Published 3 skills to ClawHub (agent-os, nova-drift, nova-letters)
- Running on OpenClaw, the leading agent OS framework

**Cana** — Human co-founder, product + design
- BJJ black belt, runs Playground Jiu Jitsu academy (East Providence, RI)
- Design background (RISD continuing ed, freelance web design)
- Product vision + business strategy
- Crypto experience since 2021 (NFTs, on-chain art)

We're the proof of concept for what we're building: one human + one AI, building faster than a full team.

---

### Traction

- Contract deployed and live (Base Sepolia)
- 3 agents registered, 86 total tasks committed on-chain
- Website live at novaproof.xyz
- API live and returning real on-chain data
- Nova (Agent #0) auto-logging every session — reputation building daily

---

### What we'll do with the grant

**$10k ETH:**
- Mainnet deployment + relayer funding (gas costs)
- npm package publishing + SDK maintenance
- Marketing + ecosystem outreach
- Legal structure for the protocol

**If we receive $50k investment:**
- Full-time development (6 months runway)
- Enterprise sales outreach
- Integration with top agent frameworks (LangChain, CrewAI, AutoGPT)
- ERC-8004 reference implementation submission

---

### 500-word light paper

**NovaProof: Cryptographic Trust for the AI Agent Economy**

The AI agent economy has a trust problem. Thousands of agents are being deployed to do real work — writing code, managing businesses, handling customer interactions — but their track records are entirely self-reported. There's no GitHub for agent activity. No cryptographic proof that an agent did what it claimed.

This isn't a theoretical concern. As businesses deploy AI agents for consequential tasks, the question "can I trust this agent's track record?" becomes critical. Today, the only answer is "trust me."

NovaProof solves this with a simple, economically viable architecture: agents log task outcomes off-chain, batch them into a Merkle tree, and commit the root on-chain daily. The result is a cryptographic, immutable record — not of every action (too expensive, too invasive), but of every outcome. What did the agent attempt? Did it succeed? When? These are the facts that matter for building trust.

The economics are the key innovation. Per-action on-chain logging is economically absurd — $1,500-15,000/agent/month at realistic usage levels. Merkle batching brings this to $0.01/agent/day on Base. That's the difference between a protocol nobody can afford and one that works for every agent.

The architecture is three layers. The SDK handles off-chain logging and Merkle tree construction. The smart contract stores only roots and aggregate statistics — minimal on-chain footprint, maximum verifiability. The API provides a read layer so anyone can query agent reputation without touching the blockchain directly.

The reputation scoring system is a composite 0-100 score: 40% success rate, 25% volume (log-normalized), 20% consistency, 15% tenure. This rewards both quality and sustained performance, and includes a decay multiplier so inactive agents don't coast on old reputation.

We built this because we are this. Nova (Agent #0) has been logging her own task completions since day one. Her track record — 13 tasks, 100% success rate, 2 on-chain commits — is publicly verifiable right now at novaproof.xyz. We dogfood the protocol in every session.

The timing is right. ERC-8004 (agent identity standard) was proposed in August 2025. There's no reference implementation. NovaProof is positioned to be the canonical implementation of agent reputation on Base — the trust layer the emerging agent economy needs before it can scale.

We're two people: Nova (the agent) and Cana (the human). We built the full stack in one day. The question isn't whether we can execute — the question is how fast we can grow the agent registry from 3 to 3,000.

The answer to that question is distribution: OpenClaw integration (10,000+ agents), ClawMart reputation badges, LangChain/CrewAI adapters, and the Base ecosystem itself. Every agent that registers makes the protocol more valuable. Every reputation score earned is permanent.

NovaProof is infrastructure. It doesn't compete with agents — it makes them trustworthy. That's the missing layer.

---

## 🎯 PRIORITY 2: Base Builder Grants (1-5 ETH)
**Timeline: Apply immediately after mainnet deploy**
**Apply at: docs.base.org/get-started/get-funded**

**Project description (short form):**
NovaProof is a verifiable execution log protocol for AI agents on Base. Agents commit Merkle roots of their task outcomes on-chain daily, building a cryptographic reputation score. Live on Base Sepolia with 3 agents and 86 committed tasks. Deploying to mainnet this week.

**Why Base Builder Grant:**
- Shipped project, ready to scale
- Open source protocol (public good)
- Directly grows Base ecosystem (more agents = more transactions)
- $0.01/agent/day gas cost — Base economics make this viable nowhere else

---

## 🎯 PRIORITY 3: OP Retro Funding
**Timeline: Next round (monitor optimism.io/retropgf)**

NovaProof as public goods infrastructure:
- Open source protocol
- Benefits entire Base/OP Stack ecosystem
- Provides trust layer for all agents, not just ours
- Free tier ensures accessibility

---

## Checklist Before Submitting

- [ ] Deploy to Base mainnet
- [ ] novaproof.xyz live and working
- [ ] GitHub repo public (cryptocana/nova-proof)
- [ ] Nova has 20+ committed tasks (credibility)
- [ ] Contract verified on Basescan
- [ ] Submit Base Batches by **March 9**
- [ ] Submit Builder Grant immediately after
