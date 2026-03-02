# NovaProof REST API

Read-only access to on-chain agent reputation data, plus Merkle proof verification and an optional relayer endpoint for agents without wallets.

## Setup

```bash
cd api
npm install
cp ../.env.example .env
# Edit .env with your contract address and RPC URL
npm run dev
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `CONTRACT_ADDRESS` | Yes | NovaProof contract address |
| `BASE_RPC_URL` | Yes | Base RPC endpoint |
| `CHAIN_ID` | No | Chain ID (default: 84532 for Base Sepolia) |
| `PORT` | No | Server port (default: 3100) |
| `RELAYER_PRIVATE_KEY` | No | Private key for relayer mode |
| `API_KEY` | No | API key to protect relayer endpoint |

## Endpoints

### GET /api/v1/agents/:agentId

Get agent info and reputation stats.

```json
{
  "agentId": "0",
  "owner": "0x...",
  "metadataURI": "ipfs://...",
  "stats": {
    "totalTasks": "1234",
    "totalSuccesses": "1200",
    "successRate": "9724",
    "tenure": "7776000",
    "totalCommits": 42
  }
}
```

### GET /api/v1/agents/:agentId/commits

List commit records (most recent 100).

### GET /api/v1/agents/:agentId/commits/:index

Get a specific commit record.

### POST /api/v1/verify

Verify a task against a Merkle proof.

```json
// Request
{
  "agentId": "0",
  "taskHash": "0x...",
  "merkleProof": ["0x...", "0x..."],
  "commitIndex": "5"
}

// Response
{
  "verified": true,
  "commitIndex": "5",
  "committedAt": 1709337600,
  "merkleRoot": "0x..."
}
```

### GET /api/v1/leaderboard

Query params: `sortBy` (totalTasks|successRate|tenure|totalCommits), `minTasks`, `limit` (max 100).

### POST /api/v1/commit (Relayer)

Submit a commit on behalf of an agent. Requires `RELAYER_PRIVATE_KEY` to be configured and optionally `API_KEY` for auth.

```json
// Request (Authorization: Bearer <API_KEY>)
{
  "agentId": "0",
  "merkleRoot": "0x...",
  "taskCount": 50,
  "successCount": 48,
  "periodStart": 1709251200,
  "periodEnd": 1709337600
}

// Response
{
  "txHash": "0x...",
  "status": "submitted"
}
```

## Rate Limiting

60 requests per minute per IP. Headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`.

## Caching

Responses are cached in memory for 30 seconds (leaderboard: 2 minutes). Cache is invalidated on new commits via the relayer endpoint.
