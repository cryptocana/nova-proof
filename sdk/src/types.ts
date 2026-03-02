/**
 * NovaProof SDK — Type Definitions
 *
 * All types exported for consumers. No runtime dependencies.
 */

// ─── Configuration ───────────────────────────────────────────────────────

export type NovaProofMode = 'direct' | 'relayer';

export interface NovaProofConfig {
  /** Registered on-chain agent token ID */
  agentId: bigint;

  /** NovaProof contract address on Base */
  contractAddress: `0x${string}`;

  /** Base RPC URL (e.g., https://mainnet.base.org) */
  rpcUrl: string;

  /**
   * Operating mode:
   * - 'direct': agent has a wallet, signs and submits tx directly
   * - 'relayer': agent calls the NovaProof API, relayer submits on its behalf
   */
  mode: NovaProofMode;

  /** Private key hex (required for direct mode) */
  privateKey?: `0x${string}`;

  /** Relayer API base URL (required for relayer mode) */
  relayerUrl?: string;

  /** Relayer API key for authentication (required for relayer mode) */
  relayerApiKey?: string;

  /** Chain ID — defaults to 8453 (Base mainnet) */
  chainId?: number;

  /** Auto-commit after this many pending logs (0 = manual only) */
  autoCommitThreshold?: number;
}

// ─── Task Logging ────────────────────────────────────────────────────────

export interface TaskLog {
  /** Category of task (e.g., "code_deploy", "api_call", "file_write") */
  taskType: string;

  /** Keccak256 hash of the input data */
  inputHash: `0x${string}`;

  /** Keccak256 hash of the output/result data */
  outputHash: `0x${string}`;

  /** Whether the task completed successfully */
  success: boolean;

  /** Unix timestamp (seconds) when the task occurred */
  timestamp: number;
}

// ─── On-Chain Data ───────────────────────────────────────────────────────

export interface CommitRecord {
  merkleRoot: `0x${string}`;
  taskCount: number;
  successCount: number;
  periodStart: number;
  periodEnd: number;
  committedAt: number;
}

export interface AgentReputation {
  agentId: bigint;
  totalTasks: bigint;
  totalSuccesses: bigint;
  /** Basis points — 10000 = 100% */
  successRate: bigint;
  /** Seconds since registration */
  tenure: bigint;
  totalCommits: number;
}

export interface ReputationScore {
  /** Composite score 0–100 */
  score: number;
  /** Component breakdown */
  components: {
    successRate: number;
    volumeScore: number;
    consistencyScore: number;
    tenureScore: number;
  };
  /** Decay multiplier applied (1.0 = fully active) */
  decayMultiplier: number;
}

// ─── Merkle Verification ─────────────────────────────────────────────────

export interface VerificationResult {
  /** Whether the task log is verified against the on-chain Merkle root */
  verified: boolean;
  /** Index of the commit that contains this task */
  commitIndex: number;
  /** When the commit was submitted on-chain */
  committedAt: number;
}

// ─── Commit Result ───────────────────────────────────────────────────────

export interface CommitResult {
  /** Transaction hash (direct mode) or relayer request ID */
  txHash: string;
  /** The Merkle root that was committed */
  merkleRoot: `0x${string}`;
  /** Number of tasks in this commit */
  taskCount: number;
  /** Number of successful tasks */
  successCount: number;
  /** Period covered */
  periodStart: number;
  periodEnd: number;
}

// ─── Relayer Types ───────────────────────────────────────────────────────

export interface RelayerCommitRequest {
  agentId: string;
  merkleRoot: `0x${string}`;
  taskCount: number;
  successCount: number;
  periodStart: number;
  periodEnd: number;
  /** Off-chain task logs for storage */
  logs?: TaskLog[];
}

export interface RelayerCommitResponse {
  txHash: string;
  status: 'submitted' | 'confirmed' | 'failed';
  error?: string;
}

// ─── Contract ABI (minimal, for viem) ────────────────────────────────────

export const AGENT_CHAIN_ABI = [
  {
    name: 'registerAgent',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'metadataURI', type: 'string' }],
    outputs: [{ name: '', type: 'uint256' }],
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
    name: 'setApprovedRelayer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'relayer', type: 'address' },
      { name: 'approved', type: 'bool' },
    ],
    outputs: [],
  },
  {
    name: 'setAgentRelayer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'relayer', type: 'address' },
    ],
    outputs: [],
  },
  {
    name: 'AgentRegistered',
    type: 'event',
    inputs: [
      { name: 'agentId', type: 'uint256', indexed: true },
      { name: 'owner', type: 'address', indexed: true },
      { name: 'metadataURI', type: 'string', indexed: false },
    ],
  },
  {
    name: 'LogCommitted',
    type: 'event',
    inputs: [
      { name: 'agentId', type: 'uint256', indexed: true },
      { name: 'merkleRoot', type: 'bytes32', indexed: false },
      { name: 'taskCount', type: 'uint32', indexed: false },
      { name: 'successCount', type: 'uint32', indexed: false },
      { name: 'periodStart', type: 'uint48', indexed: false },
      { name: 'periodEnd', type: 'uint48', indexed: false },
    ],
  },
] as const;
