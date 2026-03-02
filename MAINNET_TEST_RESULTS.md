# NovaProof Base Mainnet Verification — Test Results

**Date:** 2026-03-01 19:33 EST  
**Tester:** Carlos (subagent)  
**Verdict:** ⚠️ **FAIL** — 3 blockers found

---

## Test Results

### ✅ 1. API Health
```json
{"status":"ok","contract":"0xB3a7245d3AF3e4F85F0b5c715CE1810b74e9c5b7","chain":8453}
```
- Contract address: ✅ Mainnet (0xB3a7...0d9c → 0xB3a7...c5b7)
- Chain ID: ✅ 8453 (Base Mainnet, NOT 84532 Sepolia)

### ❌ 2. API — Agent Data (`/api/v1/agents/0`)
**BLOCKER:** Returns error:
```
The contract function "ownerOf" returned no data ("0x").
Contract Call: address: 0xB3a7245d3AF3e4F85F0b5c715CE1810b74e9c5b7
```
**Root cause:** The API's on-chain reads are failing. However, the same contract function works fine when called directly from a local node.js client via Alchemy RPC. This suggests the API's RPC configuration on Fly.io may be using a faulty or rate-limited RPC endpoint. The contract itself is fine.

### ❌ 3. API — Commits (`/api/v1/agents/0/commits`)
**BLOCKER:** Returns error:
```
The contract function "getCommitCount" returned no data ("0x").
```
Same root cause as #2 — API's RPC calls failing server-side.

### ❌ 4. API — Leaderboard (`/api/v1/leaderboard`)
**BLOCKER:** Returns error:
```
The contract function "totalAgents" returned no data ("0x").
```
Same root cause as #2.

### ✅ 5. Website Clean URLs
| Route | Status |
|-------|--------|
| `/` | 200 ✅ |
| `/agents` | 200 ✅ |
| `/leaderboard` | 200 ✅ |
| `/verify` | 200 ✅ |
| `/docs` | 200 ✅ |
| `/agent?id=0` | 200 ✅ |

All routes return 200. Clean URL routing works.

### ✅ 6. novaproof.xyz Domain
- Returns HTTP 200 ✅
- DNS is live, Fly.io serving correctly

### ⚠️ 7. Website Content — Mainnet vs Sepolia
**Mixed results:**
- ✅ Shows "Live on Base" hero text
- ✅ Shows "Network: Base Mainnet" stat pill
- ✅ Shows "⛓ Base Mainnet" in footer
- ❌ **SDK code example still shows:** `rpcUrl: 'https://sepolia.base.org'`

### ⚠️ 8. Website — Contract Address
**Issues found:**
- ❌ Website `NOVA_DATA` / code example shows OLD Sepolia contract: `0xa71C...8485` (3 occurrences)
- ❌ Zero occurrences of the mainnet contract `0xB3a7245d3AF3e4F85F0b5c715CE1810b74e9c5b7`
- ❌ Basescan link points to old contract: `basescan.org/address/0xa71C515942A13Cc10570A373f89C499a5AA8b485`

### ✅ 9. On-Chain Contract Verification (Direct)
```
On-chain: tasks=8 success=8 rate=10000 commits=1
```
- Contract is live and readable ✅
- Agent #0 (Nova) registered ✅
- 8 tasks, 8 successes, 100% rate ✅
- 1 commit on-chain ✅

### ✅ 10. Mainnet TX Verification
```
TX status: success block: 42811025
```
- Nova's first mainnet commit TX confirmed ✅
- TX hash: `0xc357933bd63d5c755d4f52b1aa5eb1f111d1e724bf3afc2e09ed8f9f11124676`

### ✅ 11. nova-commit.js Updated
- ✅ Changed from `baseSepolia` → `base` import
- ✅ Contract address updated to `0xB3a7245d3AF3e4F85F0b5c715CE1810b74e9c5b7`
- ✅ RPC URL updated to `https://base-mainnet.g.alchemy.com/v2/...`
- ✅ Log messages updated (Base Mainnet, basescan.org links)
- ✅ `--stats` runs successfully

---

## Blockers (Must Fix Before Announcement)

### 🔴 BLOCKER 1: API Contract Reads Failing
All three data endpoints (`/agents/0`, `/agents/0/commits`, `/leaderboard`) return contract read errors. The contract itself works fine (verified directly), so the issue is the API server's RPC configuration on Fly.io. Likely the API is using a bad/rate-limited RPC. Need to check the API's `BASE_RPC_URL` env var on Fly.io and ensure it's set to a working mainnet RPC (e.g., Alchemy).

**Fix:** `fly secrets set BASE_RPC_URL=https://base-mainnet.g.alchemy.com/v2/<key> -a novaproof-api`

### 🔴 BLOCKER 2: Website Shows Old Sepolia Contract
The website HTML still references the old Sepolia contract `0xa71C515942A13Cc10570A373f89C499a5AA8b485` in 3 places:
1. SDK code example (`contractAddress: '0xa71C...8485'`)
2. Footer contract hash display
3. Basescan link in footer

Also, the SDK code example still shows `rpcUrl: 'https://sepolia.base.org'`.

**Fix:** Update the website source and redeploy `novaproof-site`.

### 🟡 BLOCKER 3: Website SDK Example Uses Sepolia RPC
The docs/code example on the homepage shows `rpcUrl: 'https://sepolia.base.org'`. Even though the hero says "Live on Base", developers copy-pasting the SDK example would connect to Sepolia.

**Fix:** Update to mainnet RPC in the code example.

---

## What's Working ✅
- Smart contract deployed and functional on Base Mainnet
- Nova (Agent #0) registered with 8 tasks, 100% success rate
- First mainnet commit TX confirmed (block 42811025)
- API health endpoint correctly reports mainnet config
- All website routes return 200
- novaproof.xyz domain live
- Website UI text says "Base Mainnet" / "Live on Base"
- nova-commit.js updated to mainnet ✅

## Summary
The on-chain infrastructure is solid — contract works, data is there, TX confirmed. The blockers are all in the **API server** (RPC config) and **website** (hardcoded Sepolia references). Both are deploy-level fixes, not code architecture issues. Should be quick to resolve.
