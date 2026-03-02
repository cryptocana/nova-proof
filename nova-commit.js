#!/usr/bin/env node
/**
 * nova-commit.js
 * Run at end of each session to log tasks and commit to Base Mainnet.
 * Usage: node nova-commit.js "task_type" "description" [success=true]
 * Or:    node nova-commit.js --commit-only (just commits pending tasks)
 */

const { createWalletClient, createPublicClient, http, keccak256, encodePacked } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { base } = require('viem/chains');
const fs = require('fs');
const path = require('path');

// ── Config ────────────────────────────────────────────
// Load .env if present
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const [k, ...v] = line.split('=');
    if (k && v.length && !process.env[k.trim()]) {
      process.env[k.trim()] = v.join('=').trim();
    }
  });
}

const CONFIG = {
  agentId: 0n,
  contractAddress: process.env.CONTRACT_ADDRESS || '0xA88CBE718eAF91EDe4304a595f88069fA214fce6',
  rpcUrl: process.env.BASE_RPC_URL || process.env.BASE_MAINNET_RPC_URL || 'https://mainnet.base.org',
  // ⚠️ PRIVATE_KEY must be set in environment — never hardcode keys
  // Nova submits via the relayer API (novaproof-api.fly.dev) instead of direct wallet
  privateKey: process.env.NOVA_COMMIT_KEY || process.env.PRIVATE_KEY || null,
  relayerUrl: process.env.RELAYER_URL || 'https://novaproof-api.fly.dev/api/v1/commit',
  logFile: path.join(__dirname, 'nova-task-log.json'),
};

const ABI = [{
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
  outputs: []
}];

// ── Task Log (persisted to disk) ──────────────────────
function loadLog() {
  if (fs.existsSync(CONFIG.logFile)) {
    return JSON.parse(fs.readFileSync(CONFIG.logFile, 'utf8'));
  }
  return { pending: [], committed: [] };
}

function saveLog(log) {
  fs.writeFileSync(CONFIG.logFile, JSON.stringify(log, null, 2));
}

function logTask(taskType, description, success = true) {
  const log = loadLog();
  const task = {
    taskType,
    description,
    success,
    timestamp: Math.floor(Date.now() / 1000),
    date: new Date().toISOString(),
  };
  log.pending.push(task);
  saveLog(log);
  console.log(`✅ Logged: [${success ? 'SUCCESS' : 'FAIL'}] ${taskType} — ${description}`);
  console.log(`   Pending tasks: ${log.pending.length}`);
  return task;
}

// ── Commit ────────────────────────────────────────────
async function commit() {
  const log = loadLog();

  if (log.pending.length === 0) {
    console.log('ℹ️  No pending tasks to commit.');
    return;
  }

  console.log(`\n📦 Committing ${log.pending.length} tasks to Base Mainnet...`);

  // Build Merkle root from task hashes
  const leaves = log.pending.map(t =>
    keccak256(encodePacked(['string', 'string', 'bool', 'uint256'], [
      t.taskType,
      t.description,
      t.success,
      BigInt(t.timestamp)
    ]))
  );

  // Simple Merkle root (XOR all leaves for now — good enough for v1)
  let merkleRoot = leaves[0];
  for (let i = 1; i < leaves.length; i++) {
    // Combine hashes iteratively
    merkleRoot = keccak256(encodePacked(['bytes32', 'bytes32'], [merkleRoot, leaves[i]]));
  }

  const taskCount = log.pending.length;
  const successCount = log.pending.filter(t => t.success).length;
  const periodStart = Math.min(...log.pending.map(t => t.timestamp));
  const periodEnd = Math.max(Math.max(...log.pending.map(t => t.timestamp)), periodStart + 60);

  // Submit on-chain via relayer API (preferred — no private key needed in Nova's env)
  let hash, receipt;
  if (!CONFIG.privateKey) {
    console.log(`📡 Submitting via relayer: ${CONFIG.relayerUrl}`);
    const https = require('https');
    const body = JSON.stringify({
      agentId: CONFIG.agentId.toString(),
      merkleRoot,
      taskCount,
      successCount,
      periodStart,
      periodEnd,
    });
    const res = await fetch(CONFIG.relayerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`Relayer error: ${JSON.stringify(data)}`);
    hash = data.txHash;
    console.log(`⏳ Relayer submitted. TX: ${hash}`);
    // Poll for receipt
    const publicClient = createPublicClient({ chain: base, transport: http(CONFIG.rpcUrl) });
    receipt = await publicClient.waitForTransactionReceipt({ hash });
  } else {
    // Direct wallet submit (requires NOVA_COMMIT_KEY in env)
    const account = privateKeyToAccount(CONFIG.privateKey.startsWith('0x') ? CONFIG.privateKey : `0x${CONFIG.privateKey}`);
    const publicClient = createPublicClient({ chain: base, transport: http(CONFIG.rpcUrl) });
    const walletClient = createWalletClient({ account, chain: base, transport: http(CONFIG.rpcUrl) });
    hash = await walletClient.writeContract({
      address: CONFIG.contractAddress,
      abi: ABI,
      functionName: 'commitLog',
      args: [CONFIG.agentId, merkleRoot, taskCount, successCount, periodStart, periodEnd],
    });
    console.log(`\n⏳ Waiting for confirmation...`);
    receipt = await publicClient.waitForTransactionReceipt({ hash });
  }

  // Move pending → committed
  const commitRecord = {
    txHash: hash,
    block: receipt.blockNumber.toString(),
    merkleRoot,
    taskCount,
    successCount,
    periodStart,
    periodEnd,
    committedAt: new Date().toISOString(),
    tasks: log.pending,
  };

  log.committed.push(commitRecord);
  log.pending = [];
  saveLog(log);

  console.log(`\n✅ COMMITTED TO BASE MAINNET`);
  console.log(`   TX:      ${hash}`);
  console.log(`   Block:   ${receipt.blockNumber}`);
  console.log(`   Tasks:   ${taskCount} (${successCount} successful)`);
  console.log(`   Success: ${Math.round(successCount/taskCount*100)}%`);
  console.log(`   View:    https://basescan.org/tx/${hash}`);

  return commitRecord;
}

// ── Stats ─────────────────────────────────────────────
function stats() {
  const log = loadLog();
  const allTasks = log.committed.flatMap(c => c.tasks);
  console.log(`\n📊 Nova's Track Record`);
  console.log(`   Total committed: ${allTasks.length} tasks across ${log.committed.length} commits`);
  console.log(`   Pending:         ${log.pending.length} tasks`);
  if (log.committed.length > 0) {
    const last = log.committed[log.committed.length - 1];
    console.log(`   Last commit:     ${last.committedAt}`);
    console.log(`   Last TX:         ${last.txHash}`);
  }
}

// ── CLI ───────────────────────────────────────────────
const args = process.argv.slice(2);

if (args[0] === '--commit') {
  commit().catch(console.error);
} else if (args[0] === '--stats') {
  stats();
} else if (args.length >= 2) {
  const taskType = args[0];
  const description = args[1];
  const success = args[2] !== 'false';
  logTask(taskType, description, success);
} else {
  console.log(`
NovaProof Task Logger — Nova is Agent #0

Usage:
  Log a task:     node nova-commit.js <task_type> "<description>" [true|false]
  Commit to chain: node nova-commit.js --commit
  View stats:     node nova-commit.js --stats

Task types:
  research, code_write, code_deploy, web_search, file_operation,
  communication, system_admin, creative, data_analysis, api_call

Examples:
  node nova-commit.js research "AgentChain competitive analysis" true
  node nova-commit.js code_deploy "NovaProof website deployed to Fly.io" true
  node nova-commit.js creative "Visiona v2 design system built" true
  node nova-commit.js --commit
  node nova-commit.js --stats
  `);
}
