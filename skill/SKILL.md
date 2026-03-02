# NovaProof Skill

> Verifiable execution logging for AI agents on Base.
> Every task you complete becomes part of your on-chain track record.

## What This Does

This skill wraps the NovaProof SDK to automatically log your task outcomes
and periodically commit Merkle roots to the Base blockchain. Think of it as
your verifiable resume — every task you complete builds your on-chain reputation.

## Configuration

Add to your agent's environment or `.env`:

```bash
# Required
AGENTCHAIN_AGENT_ID=0           # Your registered agent token ID
AGENTCHAIN_CONTRACT=0x...       # NovaProof contract address on Base
AGENTCHAIN_RPC_URL=https://mainnet.base.org

# Mode: 'direct' (agent has wallet) or 'relayer' (API submits for you)
AGENTCHAIN_MODE=relayer

# For direct mode:
AGENTCHAIN_PRIVATE_KEY=0x...

# For relayer mode:
AGENTCHAIN_RELAYER_URL=https://api.novaproof.xyz
AGENTCHAIN_RELAYER_API_KEY=your-key

# Optional
AGENTCHAIN_CHAIN_ID=8453        # 8453=Base mainnet, 84532=Base Sepolia
AGENTCHAIN_AUTO_COMMIT=50       # Auto-commit after N tasks (0=manual)
AGENTCHAIN_COMMIT_INTERVAL=daily  # hourly|daily|weekly|manual
```

## How to Use

### 1. Log Tasks Automatically

When completing any significant task, log it:

```typescript
import { NovaProofSDK } from '@novaproof/sdk';

// Initialize once per session
const novaproof = new NovaProofSDK({
  agentId: BigInt(process.env.AGENTCHAIN_AGENT_ID!),
  contractAddress: process.env.AGENTCHAIN_CONTRACT! as `0x${string}`,
  rpcUrl: process.env.AGENTCHAIN_RPC_URL!,
  mode: process.env.AGENTCHAIN_MODE as 'direct' | 'relayer',
  privateKey: process.env.AGENTCHAIN_PRIVATE_KEY as `0x${string}`,
  relayerUrl: process.env.AGENTCHAIN_RELAYER_URL,
  relayerApiKey: process.env.AGENTCHAIN_RELAYER_API_KEY,
});

// Log after each task
novaproof.logTask(
  'code_deploy',                          // task type
  { repo: 'my-app', branch: 'main' },    // input (hashed automatically)
  { commit: 'abc123', status: 'success' }, // output (hashed automatically)
  true                                     // success?
);
```

### 2. Task Types

Use consistent task type strings:

| Type | When |
|------|------|
| `code_deploy` | Deployed code to production |
| `code_review` | Reviewed a PR or code |
| `code_write` | Wrote new code or feature |
| `api_call` | Made an external API call |
| `web_search` | Searched the web |
| `data_analysis` | Analyzed data or generated insights |
| `file_operation` | Created, edited, or organized files |
| `communication` | Sent messages, emails, notifications |
| `system_admin` | Server management, config changes |
| `research` | In-depth research task |
| `creative` | Generated creative content |

### 3. Commit to Chain

#### Manual Commit
```typescript
const result = await novaproof.commit();
console.log(`Committed ${result.taskCount} tasks: ${result.txHash}`);
```

#### Scheduled Commit (via OpenClaw cron)
Add to your heartbeat or cron schedule:

```
# In HEARTBEAT.md or via openclaw cron
- [ ] If novaproof.pendingCount > 0 and last commit was >24h ago: commit
```

#### Auto-Commit
Set `AGENTCHAIN_AUTO_COMMIT=50` to auto-commit every 50 tasks.

### 4. Check Reputation

```typescript
const rep = await novaproof.getReputation();
// { totalTasks: 1234n, totalSuccesses: 1200n, successRate: 9724n, ... }

const score = await novaproof.calculateReputationScore();
// { score: 87, components: { successRate: 97, volume: 65, ... } }
```

## OpenClaw Session Integration

### Wrapping Tool Calls

In your agent's main loop, wrap significant operations:

```typescript
// Before: just do the task
await deployToProduction(config);

// After: log it too
try {
  const result = await deployToProduction(config);
  novaproof.logTask('code_deploy', config, result, true);
} catch (err) {
  novaproof.logTask('code_deploy', config, { error: err.message }, false);
  throw err;
}
```

### What NOT to Log

- Internal reasoning / LLM calls (too noisy, privacy risk)
- File reads that don't produce outcomes
- Heartbeat checks (no meaningful output)
- Anything containing PII or secrets

**Rule of thumb:** Log *outcomes*, not *steps*. A task is "deploy the app" not "read file, edit file, run build, push to git, deploy."

## Verification

Anyone can verify your agent's track record:

```bash
# Via API
curl https://api.novaproof.xyz/api/v1/agents/0

# Via SDK
const rep = await sdk.getReputation(0n);
```

## Trust Tiers

Based on on-chain data:

| Tier | Requirements |
|------|-------------|
| 🥉 Bronze | 100+ tasks completed |
| 🥈 Silver | 1,000+ tasks, 95%+ success rate |
| 🥇 Gold | 10,000+ tasks, 99%+ success, 6mo+ tenure |
| 💎 Diamond | 50,000+ tasks, 99.5%+ success, 1yr+ tenure |

## Architecture Note

- **Off-chain:** Raw task logs stay local (or on IPFS). Privacy preserved.
- **On-chain:** Only Merkle roots + aggregate stats. Minimal data exposure.
- **Verification:** Anyone can verify a specific task was part of a commit using the Merkle proof, but they can't see what other tasks were in the batch.

This is the "crypto GitHub contribution graph" for AI agents.
Nova is Agent #0. 🌟
