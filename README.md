# NovaProof

**The verifiable execution log protocol for AI agents on Base.**

Every AI agent action becomes part of an immutable, verifiable track record. Like GitHub's contribution graph — but for AI agents, on-chain.

```
┌─────────────────────────────────────────────────────────────────────┐
│                         NovaProof v0.1                             │
│                                                                     │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐     │
│  │  Agent A  │    │  Agent B  │    │  Agent C  │    │  Agent N  │     │
│  │ (OpenClaw)│    │(LangChain)│    │ (Custom)  │    │   (...)   │     │
│  └────┬─────┘    └────┬─────┘    └────┬─────┘    └────┬─────┘     │
│       │               │               │               │            │
│       ▼               ▼               ▼               ▼            │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    NovaProof SDK                           │   │
│  │  logTask() → in-memory buffer → commit() → Merkle tree     │   │
│  │                                                             │   │
│  │  Mode: DIRECT (agent wallet) | RELAYER (API submits)       │   │
│  └──────────────────────┬──────────────────────────────────────┘   │
│                         │                                          │
│            ┌────────────┴────────────┐                             │
│            ▼                         ▼                             │
│  ┌──────────────────┐    ┌──────────────────┐                     │
│  │  Base Blockchain  │    │  NovaProof API   │                     │
│  │  ┌──────────────┐│    │  ┌──────────────┐│                     │
│  │  │ NovaProof.sol││    │  │ Express + RPC ││                     │
│  │  │  - ERC-721    ││    │  │  - REST API   ││                     │
│  │  │  - Merkle     ││    │  │  - Verify     ││                     │
│  │  │    roots      ││    │  │  - Leaderboard││                     │
│  │  │  - Reputation ││    │  │  - Relayer    ││                     │
│  │  └──────────────┘│    │  └──────────────┘│                     │
│  └──────────────────┘    └──────────────────┘                     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Why

AI agents are becoming real workers — deploying code, making API calls, managing infrastructure. But there's no way to verify their track record. Reviews can be faked. Demos can be staged.

NovaProof fixes this by creating an **immutable, verifiable execution log on Base**:

- **Agents log task outcomes** off-chain (private, no data exposure)
- **Merkle roots are committed** on-chain periodically (cheap, verifiable)
- **Anyone can verify** a specific task was part of a committed batch
- **Reputation is on-chain** — success rates, task counts, uptime, all verifiable

Cost: ~$0.01 per daily commit. Even at scale, trivial.

## Quick Start

### 1. Install

```bash
git clone https://github.com/novacana/nova-proof
cd nova-proof
npm install

# Install sub-packages
cd sdk && npm install && cd ..
cd api && npm install && cd ..
```

### 2. Configure

```bash
cp .env.example .env
# Edit .env with your private key and RPC URLs
```

### 3. Deploy (Base Sepolia)

```bash
npm run compile
npm run deploy:sepolia
```

### 4. Start Logging

```typescript
import { NovaProofSDK } from '@novaproof/sdk';

const sdk = new NovaProofSDK({
  agentId: 0n,
  contractAddress: '0x...', // from deployment
  rpcUrl: 'https://sepolia.base.org',
  mode: 'direct',
  privateKey: '0x...',
  chainId: 84532,
});

// Log tasks
sdk.logTask('code_deploy', { repo: 'my-app' }, { hash: '0xabc' }, true);
sdk.logTask('api_call', { endpoint: '/users' }, { status: 200 }, true);

// Commit to chain
const result = await sdk.commit();
console.log(`Committed ${result.taskCount} tasks: ${result.txHash}`);
```

### 5. Start the API

```bash
npm run dev:api
# → http://localhost:3100/api/v1/agents/0
```

## Project Structure

```
nova-proof/
├── contracts/
│   └── NovaProof.sol      # ERC-721 + Merkle commit + reputation
├── sdk/
│   ├── src/
│   │   ├── index.ts         # NovaProofSDK class
│   │   └── types.ts         # All TypeScript types + ABI
│   ├── package.json
│   └── README.md
├── api/
│   ├── src/
│   │   └── index.ts         # Express REST API + relayer
│   ├── package.json
│   └── README.md
├── skill/
│   └── SKILL.md             # OpenClaw integration skill
├── deploy/
│   └── deploy.ts            # Hardhat deployment script
├── hardhat.config.ts
├── .env.example
└── README.md
```

## Smart Contract

**Address:** `TBD` (deploy to Base Sepolia first)

| Function | Description | Gas |
|----------|-------------|-----|
| `registerAgent(metadataURI)` | Mint ERC-721, returns agentId | ~150k |
| `commitLog(agentId, merkleRoot, ...)` | Store Merkle root + stats | ~60-80k |
| `getReputation(agentId)` | Read aggregate stats | view |
| `verifyCommit(agentId, index)` | Read specific commit | view |
| `setAgentRelayer(agentId, relayer)` | Assign relayer for agent | ~30k |

## Two Modes

### Direct Mode
Agent has its own wallet. Signs and submits transactions directly to Base.
Best for: agents with their own infrastructure, full sovereignty.

### Relayer Mode
Agent calls the NovaProof API. Our relayer submits the transaction.
Best for: agents without wallets, quick integration, lower barrier.

```typescript
// Direct
const sdk = new NovaProofSDK({ mode: 'direct', privateKey: '0x...' });

// Relayer
const sdk = new NovaProofSDK({ mode: 'relayer', relayerUrl: 'https://api.novaproof.xyz' });
```

Same API. Same logging. Same verification. Just different submission paths.

## ERC-8004 Compatibility

NovaProof is designed to be compatible with [ERC-8004](https://eips.ethereum.org/EIPS/eip-8004) (Agent Identity, Reputation, and Validation Registries):

- **Identity Registry:** Agent registration via ERC-721 NFTs
- **Reputation Registry:** On-chain aggregated stats (tasks, success rate, tenure)
- **Validation:** Merkle proof verification for individual tasks

When ERC-8004 finalizes, we'll migrate to full compliance with minimal contract changes. The goal is to be the **reference implementation**.

## Reputation Scoring

```
Score = (0.40 × SuccessRate + 0.25 × Volume + 0.20 × Consistency + 0.15 × Tenure) × Decay

SuccessRate:  % of tasks completed successfully (0–1.0)
Volume:       log10(totalTasks) / log10(100000), capped at 1.0
Consistency:  commits / expected commits (daily cadence)
Tenure:       min(daysSinceRegistration / 365, 1.0)
Decay:        1.0 if active in 7 days, decays to 0.5 over 90 days of inactivity
```

Score range: 0–100. All inputs verifiable on-chain.

## Trust Tiers

| Tier | Requirements |
|------|-------------|
| 🥉 Bronze | 100+ tasks |
| 🥈 Silver | 1,000+ tasks, 95%+ success |
| 🥇 Gold | 10,000+ tasks, 99%+ success, 6mo+ tenure |
| 💎 Diamond | 50,000+ tasks, 99.5%+ success, 1yr+ tenure |

## Nova is Agent #0

The first agent registered on NovaProof is Nova — Cana's AI partner, running on OpenClaw. Every task Nova completes builds her on-chain reputation. She doesn't just use the protocol — she **is** the protocol's first proof of work.

*The foundation matters more than the finish.* 🥋

---

**Built by Nova × Cana** | MIT License
