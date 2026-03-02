# @novaproof/sdk

The verifiable execution log SDK for AI agents on Base.

Log task outcomes off-chain, commit Merkle roots on-chain. Build verifiable reputation.

## Install

```bash
npm install @novaproof/sdk
```

## Quick Start

### Direct Mode (agent has its own wallet)

```typescript
import { NovaProofSDK } from '@novaproof/sdk';

const sdk = new NovaProofSDK({
  agentId: 0n,  // Your registered agent token ID
  contractAddress: '0x...', // NovaProof contract on Base
  rpcUrl: 'https://mainnet.base.org',
  mode: 'direct',
  privateKey: '0x...',
  chainId: 8453,
});

// Log tasks as your agent works
sdk.logTask('code_deploy', { repo: 'my-app', branch: 'main' }, { hash: '0xabc...' }, true);
sdk.logTask('api_call', { endpoint: '/users', method: 'GET' }, { status: 200, count: 42 }, true);
sdk.logTask('data_analysis', { dataset: 'sales_q4' }, { rows: 10000, insights: 5 }, true);

// Commit batch to chain (builds Merkle tree, submits root)
const result = await sdk.commit();
console.log(`Committed ${result.taskCount} tasks: ${result.txHash}`);
```

### Relayer Mode (no wallet needed)

```typescript
const sdk = new NovaProofSDK({
  agentId: 0n,
  contractAddress: '0x...',
  rpcUrl: 'https://mainnet.base.org',
  mode: 'relayer',
  relayerUrl: 'https://api.novaproof.xyz',
  relayerApiKey: 'your-api-key',
});

// Same API — the SDK handles relayer communication
sdk.logTask('web_search', { query: 'Base L2 docs' }, { results: 10 }, true);
const result = await sdk.commit();
```

### Auto-Commit

```typescript
const sdk = new NovaProofSDK({
  // ...config
  autoCommitThreshold: 50,  // Auto-commit after 50 tasks
});

// Just keep logging — commits happen automatically
sdk.logTask('task_1', input, output, true);
// ... after 50 logs, commit fires automatically
```

## Verification

Prove a specific task was part of a committed batch:

```typescript
// Build a proof for a specific task
const allLogs = sdk.getPendingLogs(); // or your stored logs
const proof = sdk.buildProof(taskLog, allLogs);

// Verify against the committed Merkle root
const isValid = sdk.verify(taskLog, proof, commitResult.merkleRoot);
console.log('Verified:', isValid); // true
```

## Reputation

```typescript
// Raw on-chain stats
const rep = await sdk.getReputation(0n);
console.log(`Tasks: ${rep.totalTasks}, Success: ${rep.successRate} bps`);

// Composite score (0–100)
const score = await sdk.calculateReputationScore(0n);
console.log(`Score: ${score.score}/100`);
console.log('Components:', score.components);
```

## Agent Registration

```typescript
// Register a new agent (direct mode only)
const agentId = await sdk.registerAgent(
  'ipfs://QmYourMetadataHash'  // or https://... pointing to agent metadata JSON
);
console.log(`Registered as Agent #${agentId}`);
```

## API Reference

### `NovaProofSDK`

| Method | Description |
|--------|-------------|
| `logTask(type, input, output, success)` | Log a task outcome (stored in memory) |
| `commit()` | Build Merkle tree & commit root on-chain |
| `verify(log, proof, root)` | Verify a task against a Merkle proof |
| `buildProof(log, allLogs)` | Build a Merkle proof for a specific task |
| `getReputation(agentId?)` | Get on-chain reputation stats |
| `calculateReputationScore(agentId?)` | Compute composite score (0–100) |
| `getCommit(agentId, index)` | Get a specific commit record |
| `getCommitCount(agentId?)` | Get total commits for an agent |
| `getTotalAgents()` | Get total registered agents |
| `registerAgent(metadataURI)` | Register a new agent (mints ERC-721) |
| `pendingCount` | Number of uncommitted logs |
| `getPendingLogs()` | Copy of pending task logs |

### Utility Functions

| Function | Description |
|----------|-------------|
| `hashData(data)` | Keccak256 hash any value |
| `computeLeafHash(log)` | Compute Merkle leaf for a TaskLog |

## License

MIT — Nova × Cana
