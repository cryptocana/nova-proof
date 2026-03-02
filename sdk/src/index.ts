/**
 * NovaProof SDK
 *
 * The verifiable execution log for AI agents on Base.
 * Logs task outcomes off-chain, commits Merkle roots on-chain.
 *
 * Supports two modes:
 * - Direct: agent has a wallet, signs and submits transactions
 * - Relayer: agent calls the NovaProof API, relayer submits on its behalf
 *
 * @example
 * ```typescript
 * import { NovaProofSDK } from '@novaproof/sdk';
 *
 * const sdk = new NovaProofSDK({
 *   agentId: 0n,
 *   contractAddress: '0x...',
 *   rpcUrl: 'https://mainnet.base.org',
 *   mode: 'direct',
 *   privateKey: '0x...',
 * });
 *
 * sdk.logTask('code_deploy', { repo: 'my-app' }, { hash: '0xabc' }, true);
 * sdk.logTask('api_call', { endpoint: '/users' }, { status: 200 }, true);
 *
 * const result = await sdk.commit();
 * console.log('Committed:', result.txHash);
 * ```
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  keccak256,
  toHex,
  type PublicClient,
  type WalletClient,
  type Chain,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base, baseSepolia } from 'viem/chains';
import { MerkleTree } from 'merkletreejs';

import {
  type NovaProofConfig,
  type TaskLog,
  type CommitRecord,
  type AgentReputation,
  type CommitResult,
  type VerificationResult,
  type ReputationScore,
  type RelayerCommitRequest,
  type RelayerCommitResponse,
  AGENT_CHAIN_ABI,
} from './types.js';

// Re-export all types
export * from './types.js';

// ─── Helpers ─────────────────────────────────────────────────────────────

/**
 * Hash any value deterministically for use as input/output hash.
 * Stringifies objects, then keccak256s the UTF-8 bytes.
 */
export function hashData(data: unknown): `0x${string}` {
  const str = typeof data === 'string' ? data : JSON.stringify(data);
  return keccak256(toHex(str));
}

/**
 * Compute the leaf hash for a single task log entry.
 * This is the hash that goes into the Merkle tree.
 */
export function computeLeafHash(log: TaskLog): `0x${string}` {
  // Pack: taskType + inputHash + outputHash + success + timestamp
  // Using keccak256 of the concatenated hex representation
  const packed =
    keccak256(toHex(log.taskType)).slice(2) +
    log.inputHash.slice(2) +
    log.outputHash.slice(2) +
    (log.success ? '01' : '00') +
    BigInt(log.timestamp).toString(16).padStart(16, '0');

  return keccak256((`0x${packed}`) as `0x${string}`);
}

/**
 * Get the chain object for a given chain ID.
 */
function getChain(chainId: number): Chain {
  switch (chainId) {
    case 8453:
      return base;
    case 84532:
      return baseSepolia;
    default:
      return {
        ...base,
        id: chainId,
        name: `Chain ${chainId}`,
      } as Chain;
  }
}

// ─── SDK Class ───────────────────────────────────────────────────────────

export class NovaProofSDK {
  private pendingLogs: TaskLog[] = [];
  private readonly config: Required<
    Pick<NovaProofConfig, 'agentId' | 'contractAddress' | 'rpcUrl' | 'mode' | 'chainId'>
  > &
    NovaProofConfig;

  private publicClient: PublicClient;
  private walletClient?: WalletClient;

  constructor(config: NovaProofConfig) {
    // Validate config
    if (config.mode === 'direct' && !config.privateKey) {
      throw new Error('NovaProofSDK: privateKey is required in direct mode');
    }
    if (config.mode === 'relayer' && !config.relayerUrl) {
      throw new Error('NovaProofSDK: relayerUrl is required in relayer mode');
    }

    this.config = {
      chainId: 8453, // Base mainnet default
      autoCommitThreshold: 0,
      ...config,
    };

    const chain = getChain(this.config.chainId);

    // Public client for reads (both modes need this)
    this.publicClient = createPublicClient({
      chain,
      transport: http(this.config.rpcUrl),
    });

    // Wallet client for writes (direct mode only)
    if (this.config.mode === 'direct' && this.config.privateKey) {
      const account = privateKeyToAccount(this.config.privateKey);
      this.walletClient = createWalletClient({
        account,
        chain,
        transport: http(this.config.rpcUrl),
      });
    }
  }

  // ─── Task Logging (Off-Chain) ──────────────────────────────────────

  /**
   * Log a task outcome. Stored in memory until commit() is called.
   *
   * @param taskType  Category string (e.g., "code_deploy", "api_call")
   * @param input     Raw input data (will be hashed)
   * @param output    Raw output data (will be hashed)
   * @param success   Whether the task completed successfully
   * @returns The TaskLog entry that was created
   */
  logTask(taskType: string, input: unknown, output: unknown, success: boolean): TaskLog {
    const log: TaskLog = {
      taskType,
      inputHash: hashData(input),
      outputHash: hashData(output),
      success,
      timestamp: Math.floor(Date.now() / 1000),
    };

    this.pendingLogs.push(log);

    // Auto-commit if threshold is set and reached
    const threshold = this.config.autoCommitThreshold ?? 0;
    if (
      threshold > 0 &&
      this.pendingLogs.length >= threshold
    ) {
      // Fire and forget — caller can await commit() explicitly for confirmation
      this.commit().catch((err) => {
        console.error('[NovaProof] Auto-commit failed:', err.message);
      });
    }

    return log;
  }

  /**
   * Get the number of pending (uncommitted) task logs.
   */
  get pendingCount(): number {
    return this.pendingLogs.length;
  }

  /**
   * Get a copy of the pending logs (for inspection/backup).
   */
  getPendingLogs(): TaskLog[] {
    return [...this.pendingLogs];
  }

  // ─── On-Chain Commit ───────────────────────────────────────────────

  /**
   * Build a Merkle tree from pending logs and commit the root on-chain.
   *
   * In direct mode: signs and submits the transaction.
   * In relayer mode: sends the data to the relayer API.
   *
   * @returns CommitResult with transaction hash and metadata
   * @throws If no pending logs or transaction fails
   */
  async commit(): Promise<CommitResult> {
    if (this.pendingLogs.length === 0) {
      throw new Error('NovaProofSDK: no pending logs to commit');
    }

    // Snapshot and clear pending logs
    const logsToCommit = [...this.pendingLogs];
    this.pendingLogs = [];

    // Build Merkle tree
    const leaves = logsToCommit.map((log) => computeLeafHash(log));
    const tree = new MerkleTree(leaves, keccak256, { sort: true });
    const merkleRoot = tree.getHexRoot() as `0x${string}`;

    const taskCount = logsToCommit.length;
    const successCount = logsToCommit.filter((l) => l.success).length;
    const timestamps = logsToCommit.map((l) => l.timestamp);
    const periodStart = Math.min(...timestamps);
    // Ensure periodEnd is always strictly greater than periodStart
    // (contract requires periodEnd > periodStart)
    const periodEnd = Math.max(Math.max(...timestamps), periodStart + 60);

    let txHash: string;

    if (this.config.mode === 'direct') {
      txHash = await this.commitDirect(
        merkleRoot,
        taskCount,
        successCount,
        periodStart,
        periodEnd,
      );
    } else {
      txHash = await this.commitViaRelayer(
        merkleRoot,
        taskCount,
        successCount,
        periodStart,
        periodEnd,
        logsToCommit,
      );
    }

    return {
      txHash,
      merkleRoot,
      taskCount,
      successCount,
      periodStart,
      periodEnd,
    };
  }

  private async commitDirect(
    merkleRoot: `0x${string}`,
    taskCount: number,
    successCount: number,
    periodStart: number,
    periodEnd: number,
  ): Promise<string> {
    if (!this.walletClient?.account) {
      throw new Error('NovaProofSDK: wallet client not initialized');
    }

    const { request } = await this.publicClient.simulateContract({
      address: this.config.contractAddress,
      abi: AGENT_CHAIN_ABI,
      functionName: 'commitLog',
      args: [
        this.config.agentId,
        merkleRoot,
        taskCount,
        successCount,
        periodStart,
        periodEnd,
      ],
      account: this.walletClient.account,
    });

    const hash = await this.walletClient.writeContract(request);
    return hash;
  }

  private async commitViaRelayer(
    merkleRoot: `0x${string}`,
    taskCount: number,
    successCount: number,
    periodStart: number,
    periodEnd: number,
    logs: TaskLog[],
  ): Promise<string> {
    if (!this.config.relayerUrl) {
      throw new Error('NovaProofSDK: relayerUrl not configured');
    }

    const body: RelayerCommitRequest = {
      agentId: this.config.agentId.toString(),
      merkleRoot,
      taskCount,
      successCount,
      periodStart,
      periodEnd,
      logs,
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.config.relayerApiKey) {
      headers['Authorization'] = `Bearer ${this.config.relayerApiKey}`;
    }

    const res = await fetch(`${this.config.relayerUrl}/api/v1/commit`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`NovaProofSDK: relayer commit failed (${res.status}): ${errorText}`);
    }

    const data = (await res.json()) as RelayerCommitResponse;
    if (data.status === 'failed') {
      throw new Error(`NovaProofSDK: relayer commit failed: ${data.error}`);
    }

    return data.txHash;
  }

  // ─── Verification ─────────────────────────────────────────────────

  /**
   * Verify a task log against a Merkle proof.
   *
   * @param taskLog     The task log entry to verify
   * @param merkleProof Array of sibling hashes for the Merkle proof
   * @param merkleRoot  The root to verify against (from on-chain commit)
   * @returns true if the proof is valid
   */
  verify(taskLog: TaskLog, merkleProof: string[], merkleRoot: string): boolean {
    const leaf = computeLeafHash(taskLog);
    const tree = new MerkleTree([], keccak256, { sort: true });
    return tree.verify(merkleProof, leaf, merkleRoot);
  }

  /**
   * Build a Merkle proof for a specific task log from a set of logs.
   * Useful for proving a single task was part of a committed batch.
   */
  buildProof(taskLog: TaskLog, allLogs: TaskLog[]): string[] {
    const leaves = allLogs.map((log) => computeLeafHash(log));
    const tree = new MerkleTree(leaves, keccak256, { sort: true });
    const leaf = computeLeafHash(taskLog);
    return tree.getHexProof(leaf);
  }

  // ─── On-Chain Reads ────────────────────────────────────────────────

  /**
   * Get the on-chain reputation stats for an agent.
   */
  async getReputation(agentId?: bigint): Promise<AgentReputation> {
    const id = agentId ?? this.config.agentId;

    const result = (await this.publicClient.readContract({
      address: this.config.contractAddress,
      abi: AGENT_CHAIN_ABI,
      functionName: 'getReputation',
      args: [id],
    })) as unknown as [bigint, bigint, bigint, bigint, number];

    return {
      agentId: id,
      totalTasks: result[0],
      totalSuccesses: result[1],
      successRate: result[2],
      tenure: result[3],
      totalCommits: result[4],
    };
  }

  /**
   * Get a specific commit record from the chain.
   */
  async getCommit(agentId: bigint, commitIndex: bigint): Promise<CommitRecord> {
    const result = (await this.publicClient.readContract({
      address: this.config.contractAddress,
      abi: AGENT_CHAIN_ABI,
      functionName: 'verifyCommit',
      args: [agentId, commitIndex],
    })) as {
      merkleRoot: `0x${string}`;
      taskCount: number;
      successCount: number;
      periodStart: number;
      periodEnd: number;
      committedAt: number;
    };

    return {
      merkleRoot: result.merkleRoot,
      taskCount: result.taskCount,
      successCount: result.successCount,
      periodStart: result.periodStart,
      periodEnd: result.periodEnd,
      committedAt: result.committedAt,
    };
  }

  /**
   * Get the number of commits for an agent.
   */
  async getCommitCount(agentId?: bigint): Promise<bigint> {
    const id = agentId ?? this.config.agentId;
    return (await this.publicClient.readContract({
      address: this.config.contractAddress,
      abi: AGENT_CHAIN_ABI,
      functionName: 'getCommitCount',
      args: [id],
    })) as bigint;
  }

  /**
   * Get the total number of registered agents.
   */
  async getTotalAgents(): Promise<bigint> {
    return (await this.publicClient.readContract({
      address: this.config.contractAddress,
      abi: AGENT_CHAIN_ABI,
      functionName: 'totalAgents',
    })) as bigint;
  }

  // ─── Reputation Scoring ────────────────────────────────────────────

  /**
   * Calculate a composite reputation score (0–100) from on-chain data.
   *
   * Formula:
   *   Score = (0.40 × SuccessRate + 0.25 × Volume + 0.20 × Consistency + 0.15 × Tenure)
   *           × DecayMultiplier
   *
   * @param agentId  Optional — defaults to configured agent
   */
  async calculateReputationScore(agentId?: bigint): Promise<ReputationScore> {
    const rep = await this.getReputation(agentId);

    // Success rate: 0–1.0
    const successRateNorm =
      Number(rep.totalTasks) > 0
        ? Number(rep.totalSuccesses) / Number(rep.totalTasks)
        : 0;

    // Volume: log10(totalTasks) / log10(100000), capped at 1.0
    const volumeScore = Math.min(
      Number(rep.totalTasks) > 0
        ? Math.log10(Number(rep.totalTasks)) / Math.log10(100000)
        : 0,
      1.0,
    );

    // Tenure: min(days / 365, 1.0)
    const tenureDays = Number(rep.tenure) / 86400;
    const tenureScore = Math.min(tenureDays / 365, 1.0);

    // Consistency: commits / expected commits (assume daily commits, tenure in days)
    const expectedCommits = Math.max(tenureDays, 1);
    const consistencyScore = Math.min(
      rep.totalCommits / expectedCommits,
      1.0,
    );

    // Decay: 1.0 if active within 7 days, decays linearly to 0.5 over 90 days
    const daysSinceLastCommit = tenureDays > 0 ? tenureDays : 0; // approximate
    let decayMultiplier = 1.0;
    if (daysSinceLastCommit > 7) {
      const decayDays = Math.min(daysSinceLastCommit - 7, 83);
      decayMultiplier = 1.0 - (decayDays / 83) * 0.5;
    }

    const rawScore =
      0.4 * successRateNorm +
      0.25 * volumeScore +
      0.2 * consistencyScore +
      0.15 * tenureScore;

    const score = Math.round(rawScore * decayMultiplier * 100);

    return {
      score: Math.max(0, Math.min(100, score)),
      components: {
        successRate: Math.round(successRateNorm * 100),
        volumeScore: Math.round(volumeScore * 100),
        consistencyScore: Math.round(consistencyScore * 100),
        tenureScore: Math.round(tenureScore * 100),
      },
      decayMultiplier: Math.round(decayMultiplier * 100) / 100,
    };
  }

  // ─── Agent Registration ────────────────────────────────────────────

  /**
   * Register a new agent on-chain (direct mode only).
   *
   * @param metadataURI  IPFS or HTTPS URI for agent metadata JSON
   * @returns The new agent's token ID
   */
  async registerAgent(metadataURI: string): Promise<bigint> {
    if (this.config.mode !== 'direct' || !this.walletClient?.account) {
      throw new Error('NovaProofSDK: registerAgent requires direct mode with wallet');
    }

    const { request } = await this.publicClient.simulateContract({
      address: this.config.contractAddress,
      abi: AGENT_CHAIN_ABI,
      functionName: 'registerAgent',
      args: [metadataURI],
      account: this.walletClient.account,
    });

    const hash = await this.walletClient.writeContract(request);

    // Wait for receipt to get the agent ID from the event
    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });

    // Parse AgentRegistered event to get the agentId
    // The agentId is the first indexed topic (after the event signature)
    const registrationLog = receipt.logs.find(
      (log) => log.topics.length >= 2,
    );

    if (registrationLog?.topics[1]) {
      return BigInt(registrationLog.topics[1]);
    }

    throw new Error('NovaProofSDK: could not parse agentId from registration event');
  }
}
