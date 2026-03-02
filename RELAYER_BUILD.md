# NovaProof Relayer — Build Report

**Date:** 2026-03-01  
**Builder:** Carlos 🥋  
**Status:** ✅ Deployed — ⚠️ Needs wallet funding to process write txs

---

## Deployed URL

**https://novaproof-relayer.fly.dev**

App: `novaproof-relayer` on Fly.io (crypto-cana org, EWR region, 2 machines)

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Relayer status, balance, approval status |
| `POST` | `/api/register` | Register agent on-chain (free, rate limited) |
| `POST` | `/api/commit` | Commit task log Merkle root on-chain (free, rate limited) |
| `GET` | `/api/agent/:id` | Get agent data directly from chain |
| `GET` | `/api/stats` | Protocol stats (total agents, relayer balance) |

### Register Agent
```bash
curl -X POST https://novaproof-relayer.fly.dev/api/register \
  -H "Content-Type: application/json" \
  -d '{"name":"MyAgent","description":"An AI agent","framework":"langchain"}'
```

Response:
```json
{
  "success": true,
  "agentId": 1,
  "txHash": "0x...",
  "blockNumber": 12345,
  "owner": "0xD4Aca60F823C17d981a73656C325b253D050480A",
  "name": "MyAgent",
  "note": "Agent registered via free relayer. NFT held by relayer wallet for free tier."
}
```

### Commit Task Log
```bash
curl -X POST https://novaproof-relayer.fly.dev/api/commit \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": 1,
    "tasks": [
      {"type": "web_search", "description": "Searched for weather", "success": true},
      {"type": "code_gen", "description": "Generated Python script", "success": true}
    ]
  }'
```

Response:
```json
{
  "success": true,
  "txHash": "0x...",
  "merkleRoot": "0x...",
  "taskCount": 2,
  "successCount": 2,
  "leaves": ["0:web_search:Searched for weather:1", "1:code_gen:Generated Python script:1"]
}
```

---

## Rate Limits (Free Tier)

| Action | Limit |
|--------|-------|
| Registration | 1 per IP per day |
| Commit | 3 per agentId per day |

In-memory (Map) — resets on redeploy. Redis later for persistence.

---

## Relayer Wallet

- **Address:** `0xD4Aca60F823C17d981a73656C325b253D050480A`
- **Balance:** `0 ETH` ⚠️
- **Approved Relayer:** `false` (needs `setApprovedRelayer` tx, which also needs ETH)
- **Network:** Base Mainnet (chain ID 8453)

---

## Architecture

```
Agent (any framework)
  │
  ▼  POST /api/register or /api/commit
┌─────────────────────────────────┐
│   NovaProof Relayer (Fly.io)    │
│   - Express.js API              │
│   - Builds Merkle tree          │
│   - Signs tx with relayer key   │
│   - Pays gas for agent          │
│   - Rate limits by IP/agentId   │
│   - Tx queue (nonce safety)     │
└───────────┬─────────────────────┘
            │  viem → Base RPC (Alchemy)
            ▼
┌─────────────────────────────────┐
│   AgentChain Contract (Base)    │
│   0xB3a7...c5b7                 │
│   - ERC-721 agent identity      │
│   - Merkle root storage         │
│   - Reputation scoring          │
└─────────────────────────────────┘
```

---

## ⚠️ Blockers — Must Do Before Live

### 1. Fund the relayer wallet
Send ~0.005 ETH (Base) to `0xD4Aca60F823C17d981a73656C325b253D050480A`.
Base gas is cheap (~$0.001 per tx), so 0.005 ETH covers ~1000+ transactions.

### 2. Approve wallet as relayer on-chain
After funding, run:
```bash
cd agent-chain/relayer && node approve-relayer.js
```
This calls `setApprovedRelayer(Nova_wallet, true)` so the relayer can commit logs for agents it doesn't own.

### 3. For existing agents (Agent #0)
Set the relayer for Agent #0 so it can commit on Nova's behalf:
```bash
# Already handled: when agents are registered via the relayer,
# it auto-sets itself as the agent's relayer.
# For Agent #0 (pre-existing), run setAgentRelayer manually.
```

---

## What's Working ✅

- [x] Server deployed and running at https://novaproof-relayer.fly.dev
- [x] `/health` — returns relayer status, balance, approval
- [x] `/api/agent/:id` — reads agent data directly from chain
- [x] `/api/stats` — protocol stats
- [x] `/api/register` — ready (needs wallet funding)
- [x] `/api/commit` — ready (needs wallet funding + relayer approval)
- [x] Merkle tree builder (pure JS, no deps)
- [x] Rate limiting (1 reg/IP/day, 3 commits/agentId/day)
- [x] Transaction queue (serializes txs to avoid nonce conflicts)
- [x] Auto-sets relayer for newly registered agents
- [x] CORS enabled
- [x] Fly.io secrets configured (PRIVATE_KEY, RPC_URL, CONTRACT_ADDRESS)

---

## Files Created

```
agent-chain/relayer/
├── server.js          # Express API server
├── merkle.js          # Merkle tree builder (pure JS)
├── approve-relayer.js # One-time relayer approval script
├── package.json       # Dependencies (express, viem, cors)
├── Dockerfile         # Node 22 Alpine
├── fly.toml           # Fly.io config
└── .dockerignore      # Excludes node_modules, approve script
```

---

## What's Needed for novaproof.xyz

To mention free registration on the website:
1. Add a "Free Registration" section/badge to the homepage
2. Add relayer API docs to `/docs` page
3. Example: "Register your agent for free — no wallet or ETH needed"
4. Link to `https://novaproof-relayer.fly.dev/api/register`
5. Update SDK examples to show relayer option alongside direct chain calls

---

## Gas Cost Estimates (Base Mainnet)

| Operation | Est. Gas | Est. Cost |
|-----------|----------|-----------|
| registerAgent | ~150k | ~$0.001 |
| setAgentRelayer | ~50k | ~$0.0003 |
| commitLog | ~100k | ~$0.0007 |
| setApprovedRelayer | ~50k | ~$0.0003 |

With 0.005 ETH (~$12 at $2400/ETH), the relayer can process **~1000+ free operations**.
