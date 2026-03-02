/**
 * NovaProof REST API
 *
 * Provides read access to on-chain agent reputation data and
 * Merkle proof verification. Caches on-chain reads in memory
 * to reduce RPC calls.
 *
 * Endpoints:
 *   GET  /api/v1/agents/:agentId
 *   GET  /api/v1/agents/:agentId/commits
 *   GET  /api/v1/agents/:agentId/commits/:index
 *   POST /api/v1/verify
 *   GET  /api/v1/leaderboard
 *   POST /api/v1/commit  (relayer endpoint)
 */

import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import {
  createPublicClient,
  createWalletClient,
  http,
  defineChain,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { MerkleTree } from 'merkletreejs';
import { keccak256 } from 'viem';

// ─── ABI (minimal, matching the contract) ────────────────────────────────

const AGENT_CHAIN_ABI = [
  {
    name: 'getReputation',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [
      { name: 'totalTasks', type: 'uint64' },
      { name: 'totalSuccesses', type: 'uint64' },
      { name: 'successRate', type: 'uint256' },
      { name: 'tenure', type: 'uint48' },
      { name: 'totalCommits', type: 'uint32' },
    ],
  },
  {
    name: 'verifyCommit',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'commitIndex', type: 'uint256' },
    ],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'merkleRoot', type: 'bytes32' },
          { name: 'taskCount', type: 'uint32' },
          { name: 'successCount', type: 'uint32' },
          { name: 'periodStart', type: 'uint48' },
          { name: 'periodEnd', type: 'uint48' },
          { name: 'committedAt', type: 'uint48' },
        ],
      },
    ],
  },
  {
    name: 'getCommitCount',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'totalAgents',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'ownerOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    name: 'tokenURI',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    name: 'commitLog',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'merkleRoot', type: 'bytes32' },
      { name: 'taskCount', type: 'uint32' },
      { name: 'successCount', type: 'uint32' },
      { name: 'periodStart', type: 'uint48' },
      { name: 'periodEnd', type: 'uint48' },
    ],
    outputs: [],
  },
] as const;

// ─── Config ──────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT || '3100', 10);
const CONTRACT_ADDRESS = (process.env.CONTRACT_ADDRESS || '0x0000000000000000000000000000000000000000') as `0x${string}`;

// Agent metadata (off-chain registry until we have IPFS)
const AGENT_METADATA: Record<number, { name: string; framework: string; description: string }> = {
  0: { name: 'Nova', framework: 'OpenClaw', description: 'The first agent on NovaProof. AI partner to Cana. Running since March 1, 2026.' },
  1: { name: 'Carlos', framework: 'OpenClaw', description: 'Research and analysis agent. Named after Carlos Gracie.' },
  2: { name: 'Visiona', framework: 'OpenClaw', description: 'Design critique and brand identity agent.' },
};
const RPC_URL = process.env.BASE_RPC_URL || process.env.BASE_SEPOLIA_RPC_URL || 'https://mainnet.base.org';
const CHAIN_ID = parseInt(process.env.CHAIN_ID || '84532', 10);
const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY as `0x${string}` | undefined;
const API_KEY = process.env.API_KEY; // Optional: protect relayer endpoint

// ─── Clients ─────────────────────────────────────────────────────────────

const chain = defineChain({
  id: CHAIN_ID,
  name: CHAIN_ID === 8453 ? 'Base' : 'Base Sepolia',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
});

const publicClient = createPublicClient({
  chain,
  transport: http(RPC_URL),
});

let walletClient: ReturnType<typeof createWalletClient> | undefined;
if (RELAYER_PRIVATE_KEY) {
  const account = privateKeyToAccount(RELAYER_PRIVATE_KEY);
  walletClient = createWalletClient({
    account,
    chain,
    transport: http(RPC_URL),
  });
}

// ─── Cache ───────────────────────────────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class MemoryCache {
  private store = new Map<string, CacheEntry<unknown>>();
  private readonly defaultTTL: number;

  constructor(defaultTTLSeconds: number = 60) {
    this.defaultTTL = defaultTTLSeconds * 1000;
  }

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.data as T;
  }

  set<T>(key: string, data: T, ttlMs?: number): void {
    this.store.set(key, {
      data,
      expiresAt: Date.now() + (ttlMs ?? this.defaultTTL),
    });
  }

  invalidate(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
  }
}

const cache = new MemoryCache(30); // 30-second default TTL

// ─── Rate Limiting (simple in-memory) ────────────────────────────────────

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 60_000; // 1 minute
const RATE_LIMIT_MAX = 60; // 60 requests per minute per IP

function rateLimit(req: Request, res: Response, next: NextFunction): void {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();

  let entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + RATE_LIMIT_WINDOW };
    rateLimitMap.set(ip, entry);
  }

  entry.count++;
  res.setHeader('X-RateLimit-Limit', RATE_LIMIT_MAX);
  res.setHeader('X-RateLimit-Remaining', Math.max(0, RATE_LIMIT_MAX - entry.count));

  if (entry.count > RATE_LIMIT_MAX) {
    res.status(429).json({ error: 'Rate limit exceeded. Try again later.' });
    return;
  }

  next();
}

// ─── App ─────────────────────────────────────────────────────────────────

const app = express();

app.use(cors());
app.use(express.json());
app.use(rateLimit);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', contract: CONTRACT_ADDRESS, chain: CHAIN_ID });
});

// ─── GET /api/v1/agents/:agentId ─────────────────────────────────────────

app.get('/api/v1/agents/:agentId', async (req: Request, res: Response) => {
  try {
    const agentId = BigInt(req.params.agentId);
    const cacheKey = `agent:${agentId}`;

    const cached = cache.get<object>(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    const [reputation, owner, metadataURI] = await Promise.all([
      publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: AGENT_CHAIN_ABI,
        functionName: 'getReputation',
        args: [agentId],
      }) as unknown as Promise<[bigint, bigint, bigint, bigint, number]>,
      publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: AGENT_CHAIN_ABI,
        functionName: 'ownerOf',
        args: [agentId],
      }) as Promise<string>,
      publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: AGENT_CHAIN_ABI,
        functionName: 'tokenURI',
        args: [agentId],
      }) as Promise<string>,
    ]);

    const meta = AGENT_METADATA[Number(agentId)] || {};
    const result = {
      agentId: agentId.toString(),
      owner,
      metadataURI,
      name: meta.name || `Agent #${agentId}`,
      framework: meta.framework || 'Unknown',
      description: meta.description || '',
      stats: {
        totalTasks: reputation[0].toString(),
        totalSuccesses: reputation[1].toString(),
        successRate: reputation[2].toString(),
        tenure: reputation[3].toString(),
        totalCommits: reputation[4],
      },
    };

    cache.set(cacheKey, result);
    res.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message.includes('ERC721') || message.includes('nonexistent token')) {
      res.status(404).json({ error: `Agent ${req.params.agentId} not found` });
      return;
    }
    res.status(500).json({ error: message });
  }
});

// ─── GET /api/v1/agents/:agentId/commits ─────────────────────────────────

app.get('/api/v1/agents/:agentId/commits', async (req: Request, res: Response) => {
  try {
    const agentId = BigInt(req.params.agentId);
    const cacheKey = `commits:${agentId}`;

    const cached = cache.get<object[]>(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    const count = (await publicClient.readContract({
      address: CONTRACT_ADDRESS,
      abi: AGENT_CHAIN_ABI,
      functionName: 'getCommitCount',
      args: [agentId],
    })) as bigint;

    const commits: object[] = [];
    // Fetch up to 100 most recent commits
    const start = count > 100n ? count - 100n : 0n;
    for (let i = start; i < count; i++) {
      const record = (await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: AGENT_CHAIN_ABI,
        functionName: 'verifyCommit',
        args: [agentId, i],
      })) as {
        merkleRoot: string;
        taskCount: number;
        successCount: number;
        periodStart: number;
        periodEnd: number;
        committedAt: number;
      };

      commits.push({
        index: i.toString(),
        merkleRoot: record.merkleRoot,
        taskCount: record.taskCount,
        successCount: record.successCount,
        periodStart: record.periodStart,
        periodEnd: record.periodEnd,
        committedAt: record.committedAt,
      });
    }

    cache.set(cacheKey, commits);
    res.json(commits);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// ─── GET /api/v1/agents/:agentId/commits/:index ─────────────────────────

app.get('/api/v1/agents/:agentId/commits/:index', async (req: Request, res: Response) => {
  try {
    const agentId = BigInt(req.params.agentId);
    const index = BigInt(req.params.index);

    const record = (await publicClient.readContract({
      address: CONTRACT_ADDRESS,
      abi: AGENT_CHAIN_ABI,
      functionName: 'verifyCommit',
      args: [agentId, index],
    })) as {
      merkleRoot: string;
      taskCount: number;
      successCount: number;
      periodStart: number;
      periodEnd: number;
      committedAt: number;
    };

    res.json({
      agentId: agentId.toString(),
      index: index.toString(),
      merkleRoot: record.merkleRoot,
      taskCount: record.taskCount,
      successCount: record.successCount,
      periodStart: record.periodStart,
      periodEnd: record.periodEnd,
      committedAt: record.committedAt,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// ─── POST /api/v1/verify ─────────────────────────────────────────────────

interface VerifyBody {
  agentId: string;
  taskHash: string;
  merkleProof: string[];
  commitIndex: string;
}

app.post('/api/v1/verify', async (req: Request<object, object, VerifyBody>, res: Response) => {
  try {
    const { agentId, taskHash, merkleProof, commitIndex } = req.body;

    if (!agentId || !taskHash || !merkleProof || commitIndex === undefined) {
      res.status(400).json({
        error: 'Required fields: agentId, taskHash, merkleProof, commitIndex',
      });
      return;
    }

    // Get the on-chain commit record
    const record = (await publicClient.readContract({
      address: CONTRACT_ADDRESS,
      abi: AGENT_CHAIN_ABI,
      functionName: 'verifyCommit',
      args: [BigInt(agentId), BigInt(commitIndex)],
    })) as {
      merkleRoot: string;
      taskCount: number;
      successCount: number;
      periodStart: number;
      periodEnd: number;
      committedAt: number;
    };

    // Verify the Merkle proof
    const tree = new MerkleTree([], keccak256, { sort: true });
    const verified = tree.verify(
      merkleProof,
      taskHash,
      record.merkleRoot,
    );

    res.json({
      verified,
      commitIndex,
      committedAt: record.committedAt,
      merkleRoot: record.merkleRoot,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// ─── GET /api/v1/leaderboard ─────────────────────────────────────────────

app.get('/api/v1/leaderboard', async (req: Request, res: Response) => {
  try {
    const sortBy = (req.query.sortBy as string) || 'totalTasks';
    const minTasks = parseInt((req.query.minTasks as string) || '0', 10);
    const limit = Math.min(parseInt((req.query.limit as string) || '50', 10), 100);
    const cacheKey = `leaderboard:${sortBy}:${minTasks}:${limit}`;

    const cached = cache.get<object[]>(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    const totalAgents = (await publicClient.readContract({
      address: CONTRACT_ADDRESS,
      abi: AGENT_CHAIN_ABI,
      functionName: 'totalAgents',
    })) as bigint;

    const agents: Array<{
      agentId: string;
      totalTasks: bigint;
      totalSuccesses: bigint;
      successRate: bigint;
      tenure: bigint;
      totalCommits: number;
    }> = [];

    // Fetch all agents (cap at 500 for performance)
    const cap = totalAgents > 500n ? 500n : totalAgents;
    for (let i = 0n; i < cap; i++) {
      try {
        const rep = (await publicClient.readContract({
          address: CONTRACT_ADDRESS,
          abi: AGENT_CHAIN_ABI,
          functionName: 'getReputation',
          args: [i],
        })) as unknown as [bigint, bigint, bigint, bigint, number];

        if (Number(rep[0]) >= minTasks) {
          agents.push({
            agentId: i.toString(),
            totalTasks: rep[0],
            totalSuccesses: rep[1],
            successRate: rep[2],
            tenure: rep[3],
            totalCommits: rep[4],
          });
        }
      } catch {
        // Agent may not exist (burned token), skip
      }
    }

    // Sort
    agents.sort((a, b) => {
      switch (sortBy) {
        case 'successRate':
          return Number(b.successRate - a.successRate);
        case 'tenure':
          return Number(b.tenure - a.tenure);
        case 'totalCommits':
          return b.totalCommits - a.totalCommits;
        case 'totalTasks':
        default:
          return Number(b.totalTasks - a.totalTasks);
      }
    });

    const result = agents.slice(0, limit).map((a) => {
      const meta = AGENT_METADATA[parseInt(a.agentId)] || {};
      return {
        agentId: a.agentId,
        name: meta.name || `Agent #${a.agentId}`,
        framework: meta.framework || 'Unknown',
        totalTasks: a.totalTasks.toString(),
        totalSuccesses: a.totalSuccesses.toString(),
        successRate: a.successRate.toString(),
        tenure: a.tenure.toString(),
        totalCommits: a.totalCommits,
      };
    });

    cache.set(cacheKey, result, 120_000); // Cache leaderboard for 2 minutes
    res.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// ─── POST /api/v1/commit (Relayer Endpoint) ──────────────────────────────

interface CommitBody {
  agentId: string;
  merkleRoot: `0x${string}`;
  taskCount: number;
  successCount: number;
  periodStart: number;
  periodEnd: number;
}

app.post('/api/v1/commit', async (req: Request<object, object, CommitBody>, res: Response) => {
  try {
    // Auth check
    if (API_KEY) {
      const auth = req.headers.authorization;
      if (!auth || auth !== `Bearer ${API_KEY}`) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
    }

    if (!walletClient?.account) {
      res.status(503).json({
        error: 'Relayer not configured. Set RELAYER_PRIVATE_KEY.',
      });
      return;
    }

    const { agentId, merkleRoot, taskCount, successCount, periodStart, periodEnd } = req.body;

    if (!agentId || !merkleRoot || taskCount === undefined) {
      res.status(400).json({
        error: 'Required: agentId, merkleRoot, taskCount, successCount, periodStart, periodEnd',
      });
      return;
    }

    const { request } = await publicClient.simulateContract({
      address: CONTRACT_ADDRESS,
      abi: AGENT_CHAIN_ABI,
      functionName: 'commitLog',
      args: [
        BigInt(agentId),
        merkleRoot,
        taskCount,
        successCount,
        periodStart,
        periodEnd,
      ],
      account: walletClient.account,
    });

    const txHash = await walletClient.writeContract(request);

    // Invalidate cache for this agent
    cache.invalidate(`agent:${agentId}`);
    cache.invalidate(`commits:${agentId}`);
    cache.invalidate('leaderboard');

    res.json({
      txHash,
      status: 'submitted',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({
      txHash: '',
      status: 'failed',
      error: message,
    });
  }
});

// ─── Start ───────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n  🔗 NovaProof API`);
  console.log(`  ├─ Port:     ${PORT}`);
  console.log(`  ├─ Chain:    ${CHAIN_ID} (${chain.name})`);
  console.log(`  ├─ Contract: ${CONTRACT_ADDRESS}`);
  console.log(`  ├─ Relayer:  ${walletClient ? 'enabled' : 'disabled'}`);
  console.log(`  └─ API key:  ${API_KEY ? 'required' : 'open'}\n`);
});

export default app;
