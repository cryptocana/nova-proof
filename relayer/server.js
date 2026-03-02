/**
 * NovaProof Relayer — Gelato-sponsored gas relay for agent registration & log commits.
 * Agents call this REST API instead of the blockchain directly.
 * Gelato signs and submits transactions — this server holds NO private keys.
 *
 * Built by Carlos 🥋 — Gelato migration
 */
import express from 'express';
import cors from 'cors';
import {
  createPublicClient,
  http,
  parseAbi,
  encodeFunctionData,
} from 'viem';
import { base } from 'viem/chains';
import { buildMerkleTree, rootToBytes32 } from './merkle.js';

// ─── Config ──────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3200;
const RPC_URL = process.env.RPC_URL || 'https://base-mainnet.g.alchemy.com/v2/sHcreRgIM4yb_QuIEr335';
const CONTRACT = process.env.CONTRACT_ADDRESS || '0xA88CBE718eAF91EDe4304a595f88069fA214fce6';
const GELATO_SPONSOR_KEY = process.env.GELATO_SPONSOR_KEY;
const GELATO_RELAY_URL = 'https://relay.gelato.digital/relays/v2/sponsored-call';
const GELATO_STATUS_URL = 'https://relay.gelato.digital/tasks/status';

if (!GELATO_SPONSOR_KEY) {
  console.error('❌ GELATO_SPONSOR_KEY env var required');
  process.exit(1);
}

const ABI = parseAbi([
  'function registerAgent(string calldata metadataURI) external returns (uint256)',
  'function commitLog(uint256 agentId, bytes32 merkleRoot, uint32 taskCount, uint32 successCount, uint48 periodStart, uint48 periodEnd) external',
  'function setApprovedRelayer(address relayer, bool approved) external',
  'function setAgentRelayer(uint256 agentId, address relayer) external',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function totalAgents() view returns (uint256)',
  'function approvedRelayers(address) view returns (bool)',
  'function agentRelayer(uint256) view returns (address)',
  'function getReputation(uint256 agentId) view returns (uint64 totalTasks, uint64 totalSuccesses, uint256 successRate, uint48 tenure, uint32 totalCommits)',
  'function getCommitCount(uint256 agentId) view returns (uint256)',
  'event AgentRegistered(uint256 indexed agentId, address indexed owner, string metadataURI)',
]);

const publicClient = createPublicClient({
  chain: base,
  transport: http(RPC_URL),
});

// ─── Gelato Relay Helper ─────────────────────────────────────────────────

/**
 * Submit a sponsored call to Gelato and poll until completion.
 * Returns { taskId, txHash, blockNumber? } on success.
 * Throws on failure or timeout.
 */
async function gelatoRelay(calldata) {
  // Submit to Gelato
  const relayRes = await fetch(GELATO_RELAY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chainId: '8453',
      target: CONTRACT,
      data: calldata,
      sponsorApiKey: GELATO_SPONSOR_KEY,
    }),
  });

  if (!relayRes.ok) {
    const errBody = await relayRes.text();
    throw new Error(`Gelato relay error (${relayRes.status}): ${errBody}`);
  }

  const { taskId } = await relayRes.json();
  if (!taskId) throw new Error('Gelato returned no taskId');

  console.log(`[gelato] task submitted: ${taskId}`);

  // Poll for completion (max ~90 seconds: 30 polls × 3s)
  const MAX_POLLS = 30;
  const POLL_INTERVAL_MS = 3000;

  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    const statusRes = await fetch(`${GELATO_STATUS_URL}/${taskId}`);
    if (!statusRes.ok) continue; // transient error, keep polling

    const statusData = await statusRes.json();
    const task = statusData.task;
    if (!task) continue;

    const state = task.taskState;
    console.log(`[gelato] task ${taskId} state: ${state}`);

    if (state === 'ExecSuccess') {
      return {
        taskId,
        txHash: task.transactionHash,
        blockNumber: task.blockNumber ? Number(task.blockNumber) : undefined,
      };
    }

    if (state === 'ExecReverted' || state === 'Cancelled' || state === 'Blacklisted') {
      throw new Error(`Gelato task ${state}: ${task.lastCheckMessage || 'no details'}`);
    }

    // Still pending — keep polling
  }

  throw new Error(`Gelato task ${taskId} timed out after ${MAX_POLLS * POLL_INTERVAL_MS / 1000}s`);
}

// ─── Rate Limiting (in-memory) ───────────────────────────────────────────

const registerLimits = new Map();
const commitLimits = new Map();

const MAX_REGISTERS_PER_IP = 1;
const MAX_COMMITS_PER_AGENT = 3;

function today() {
  return new Date().toISOString().slice(0, 10);
}

function checkRegisterLimit(ip) {
  const d = today();
  const entry = registerLimits.get(ip);
  if (!entry || entry.date !== d) {
    registerLimits.set(ip, { date: d, count: 1 });
    return true;
  }
  if (entry.count >= MAX_REGISTERS_PER_IP) return false;
  entry.count++;
  return true;
}

function checkCommitLimit(agentId) {
  const d = today();
  const key = String(agentId);
  const entry = commitLimits.get(key);
  if (!entry || entry.date !== d) {
    commitLimits.set(key, { date: d, count: 1 });
    return true;
  }
  if (entry.count >= MAX_COMMITS_PER_AGENT) return false;
  entry.count++;
  return true;
}

function getClientIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || 'unknown';
}

// ─── Express App ─────────────────────────────────────────────────────────

const app = express();
app.use(cors());
app.use(express.json());
app.set('trust proxy', true);

// ─── Health ──────────────────────────────────────────────────────────────

app.get('/health', async (_req, res) => {
  try {
    const totalAgents = await publicClient.readContract({
      address: CONTRACT,
      abi: ABI,
      functionName: 'totalAgents',
    });

    res.json({
      status: 'ok',
      gelatoEnabled: true,
      contract: CONTRACT,
      chain: 'Base Mainnet (8453)',
      totalAgents: Number(totalAgents),
    });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

// ─── Register Agent ──────────────────────────────────────────────────────

app.post('/api/register', async (req, res) => {
  try {
    const { name, description, framework, metadataUri } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }

    const ip = getClientIP(req);
    if (!checkRegisterLimit(ip)) {
      return res.status(429).json({
        error: 'Rate limit: 1 registration per IP per day',
      });
    }

    const uri =
      metadataUri ||
      `data:application/json,${encodeURIComponent(
        JSON.stringify({
          name,
          description: description || '',
          framework: framework || 'unknown',
          registeredVia: 'novaproof-relayer',
          registeredAt: new Date().toISOString(),
        })
      )}`;

    // Encode calldata (no signing — Gelato handles that)
    const calldata = encodeFunctionData({
      abi: ABI,
      functionName: 'registerAgent',
      args: [uri],
    });

    const result = await gelatoRelay(calldata);
    console.log(`[register] tx confirmed: ${result.txHash} for "${name}" from IP ${ip}`);

    // Try to parse agentId from tx receipt
    let agentId = null;
    if (result.txHash) {
      try {
        const receipt = await publicClient.getTransactionReceipt({ hash: result.txHash });
        for (const log of receipt.logs) {
          if (
            log.topics[0] ===
            '0x7e93fcabeae1aaff5e5e35d703bf2bac4b949a6a2687afb81202f1c10c97cde4'
          ) {
            agentId = Number(BigInt(log.topics[1]));
          }
        }
      } catch (_) {}
    }

    // Fallback: read totalAgents - 1
    if (agentId === null) {
      try {
        const total = await publicClient.readContract({
          address: CONTRACT,
          abi: ABI,
          functionName: 'totalAgents',
        });
        agentId = Number(total) - 1;
      } catch (_) {}
    }

    res.json({
      success: true,
      agentId,
      txHash: result.txHash,
      taskId: result.taskId,
      blockNumber: result.blockNumber,
      name,
      note: 'Agent registered via Gelato-sponsored relay. No private keys held by relayer.',
    });
  } catch (err) {
    console.error('[register] error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Commit Log ──────────────────────────────────────────────────────────

app.post('/api/commit', async (req, res) => {
  try {
    const { agentId, tasks } = req.body;

    if (agentId === undefined || agentId === null) {
      return res.status(400).json({ error: 'agentId is required' });
    }
    if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
      return res.status(400).json({ error: 'tasks array is required and must not be empty' });
    }

    if (!checkCommitLimit(agentId)) {
      return res.status(429).json({
        error: `Rate limit: ${MAX_COMMITS_PER_AGENT} commits per agentId per day`,
      });
    }

    // Build Merkle tree
    const { root, leaves } = buildMerkleTree(tasks);
    const merkleRoot = rootToBytes32(root);

    const taskCount = tasks.length;
    const successCount = tasks.filter((t) => t.success).length;
    const now = Math.floor(Date.now() / 1000);
    const periodStart = now - 3600;
    const periodEnd = now;

    // Encode calldata (no signing — Gelato handles that)
    const calldata = encodeFunctionData({
      abi: ABI,
      functionName: 'commitLog',
      args: [
        BigInt(agentId),
        merkleRoot,
        taskCount,
        successCount,
        periodStart,
        periodEnd,
      ],
    });

    const result = await gelatoRelay(calldata);
    console.log(
      `[commit] tx confirmed: ${result.txHash} for agent ${agentId} (${taskCount} tasks, ${successCount} success)`
    );

    res.json({
      success: true,
      txHash: result.txHash,
      taskId: result.taskId,
      blockNumber: result.blockNumber,
      merkleRoot,
      taskCount,
      successCount,
      leaves,
    });
  } catch (err) {
    console.error('[commit] error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Get Agent (read from chain) ─────────────────────────────────────────

app.get('/api/agent/:id', async (req, res) => {
  try {
    const id = req.params.id;

    const [owner, reputation, commitCount] = await Promise.all([
      publicClient.readContract({
        address: CONTRACT,
        abi: ABI,
        functionName: 'ownerOf',
        args: [BigInt(id)],
      }),
      publicClient.readContract({
        address: CONTRACT,
        abi: ABI,
        functionName: 'getReputation',
        args: [BigInt(id)],
      }),
      publicClient.readContract({
        address: CONTRACT,
        abi: ABI,
        functionName: 'getCommitCount',
        args: [BigInt(id)],
      }),
    ]);

    const [totalTasks, totalSuccesses, successRate, tenure, totalCommits] = reputation;

    res.json({
      agentId: Number(id),
      owner,
      totalTasks: Number(totalTasks),
      totalSuccesses: Number(totalSuccesses),
      successRate: Number(successRate) / 100,
      tenureSeconds: Number(tenure),
      totalCommits: Number(totalCommits),
      commitCount: Number(commitCount),
    });
  } catch (err) {
    res.status(err.message.includes('returned no data') ? 404 : 500).json({
      error: `Agent ${req.params.id} not found or error: ${err.message}`,
    });
  }
});

// ─── Stats ───────────────────────────────────────────────────────────────

app.get('/api/stats', async (_req, res) => {
  try {
    const totalAgents = await publicClient.readContract({
      address: CONTRACT,
      abi: ABI,
      functionName: 'totalAgents',
    });

    res.json({
      totalAgents: Number(totalAgents),
      gelatoEnabled: true,
      contract: CONTRACT,
      chain: 'Base Mainnet (8453)',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Start ───────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`🛡️  NovaProof Relayer running on port ${PORT} (Gelato-sponsored)`);
  console.log(`   Contract: ${CONTRACT}`);
  console.log(`   Chain: Base Mainnet (8453)`);
  console.log(`   Mode: Gelato sponsoredCall — NO private keys`);
});
