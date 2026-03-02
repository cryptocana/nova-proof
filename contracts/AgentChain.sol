// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title AgentChain
 * @notice Verifiable execution log protocol for AI agents on Base.
 *         Agents register as ERC-721 NFTs, then commit periodic Merkle roots
 *         of their off-chain task logs. Reputation is derived entirely from
 *         on-chain data — no oracles, no subjective reviews.
 *
 * @dev ERC-8004 compatible: agent identity via ERC-721, reputation via
 *      on-chain aggregated stats, verification via Merkle proof.
 *
 * @author Carlos (named after Carlos Gracie) — built for Nova × Cana
 */
contract AgentChain is ERC721URIStorage, Ownable, ReentrancyGuard {
    // ─── State ───────────────────────────────────────────────────────────

    uint256 private _nextAgentId;

    struct CommitRecord {
        bytes32 merkleRoot;
        uint32  taskCount;
        uint32  successCount;
        uint48  periodStart;
        uint48  periodEnd;
        uint48  committedAt;
    }

    struct AgentStats {
        uint64  totalTasks;
        uint64  totalSuccesses;
        uint48  registeredAt;
        uint48  lastCommitAt;
        uint32  totalCommits;
    }

    /// @notice agentId → ordered array of commit records
    mapping(uint256 => CommitRecord[]) public commits;

    /// @notice agentId → aggregate stats
    mapping(uint256 => AgentStats) public stats;

    /// @notice Optional: approved relayer addresses that can commit on behalf of agents
    mapping(address => bool) public approvedRelayers;

    /// @notice agentId → relayer address (0x0 means owner-only)
    mapping(uint256 => address) public agentRelayer;

    // ─── Events ──────────────────────────────────────────────────────────

    event AgentRegistered(
        uint256 indexed agentId,
        address indexed owner,
        string metadataURI
    );

    event LogCommitted(
        uint256 indexed agentId,
        bytes32 merkleRoot,
        uint32  taskCount,
        uint32  successCount,
        uint48  periodStart,
        uint48  periodEnd
    );

    event RelayerApproved(address indexed relayer, bool approved);
    event AgentRelayerSet(uint256 indexed agentId, address indexed relayer);

    // ─── Errors ──────────────────────────────────────────────────────────

    error NotAgentOwnerOrRelayer();
    error InvalidPeriod();
    error InvalidCounts();

    // ─── Constructor ─────────────────────────────────────────────────────

    constructor() ERC721("AgentChain", "AGENT") Ownable(msg.sender) {}

    // ─── Agent Registration ──────────────────────────────────────────────

    /**
     * @notice Register a new agent. Mints an ERC-721 to the caller.
     * @param metadataURI  IPFS or HTTPS URI pointing to agent metadata JSON
     *                     (name, description, framework, version, etc.)
     * @return agentId     The newly minted agent's token ID
     */
    function registerAgent(string calldata metadataURI) external returns (uint256) {
        uint256 agentId = _nextAgentId++;
        _mint(msg.sender, agentId);
        _setTokenURI(agentId, metadataURI);

        stats[agentId].registeredAt = uint48(block.timestamp);

        emit AgentRegistered(agentId, msg.sender, metadataURI);
        return agentId;
    }

    // ─── Log Commitment ──────────────────────────────────────────────────

    /**
     * @notice Commit a Merkle root of off-chain task logs for a given period.
     * @dev Only the agent owner or an approved relayer for that agent can call.
     *      Gas-optimized: struct packing keeps storage writes minimal.
     *
     * @param agentId       Token ID of the registered agent
     * @param merkleRoot    Root hash of the Merkle tree built from task log hashes
     * @param taskCount     Number of tasks in this commit batch
     * @param successCount  Number of successful tasks in this batch
     * @param periodStart   Unix timestamp — start of the logging period
     * @param periodEnd     Unix timestamp — end of the logging period
     */
    function commitLog(
        uint256 agentId,
        bytes32 merkleRoot,
        uint32  taskCount,
        uint32  successCount,
        uint48  periodStart,
        uint48  periodEnd
    ) external nonReentrant {
        // Access control: owner or approved relayer
        if (ownerOf(agentId) != msg.sender) {
            address relayer = agentRelayer[agentId];
            if (relayer != msg.sender || !approvedRelayers[msg.sender]) {
                revert NotAgentOwnerOrRelayer();
            }
        }

        if (periodEnd <= periodStart) revert InvalidPeriod();
        if (successCount > taskCount) revert InvalidCounts();

        commits[agentId].push(CommitRecord({
            merkleRoot:   merkleRoot,
            taskCount:    taskCount,
            successCount: successCount,
            periodStart:  periodStart,
            periodEnd:    periodEnd,
            committedAt:  uint48(block.timestamp)
        }));

        AgentStats storage s = stats[agentId];
        s.totalTasks     += taskCount;
        s.totalSuccesses += successCount;
        s.lastCommitAt    = uint48(block.timestamp);
        s.totalCommits++;

        emit LogCommitted(agentId, merkleRoot, taskCount, successCount, periodStart, periodEnd);
    }

    // ─── Reputation Queries ──────────────────────────────────────────────

    /**
     * @notice Get the on-chain reputation summary for an agent.
     * @return totalTasks     Lifetime task count
     * @return totalSuccesses Lifetime success count
     * @return successRate    Success rate in basis points (10000 = 100%)
     * @return tenure         Seconds since agent registration
     * @return totalCommits   Number of Merkle root commits
     */
    function getReputation(uint256 agentId) external view returns (
        uint64  totalTasks,
        uint64  totalSuccesses,
        uint256 successRate,
        uint48  tenure,
        uint32  totalCommits
    ) {
        AgentStats storage s = stats[agentId];
        totalTasks     = s.totalTasks;
        totalSuccesses = s.totalSuccesses;
        successRate    = totalTasks > 0
            ? (uint256(totalSuccesses) * 10000) / uint256(totalTasks)
            : 0;
        tenure         = uint48(block.timestamp) - s.registeredAt;
        totalCommits   = s.totalCommits;
    }

    /**
     * @notice Retrieve a specific commit record by index.
     */
    function verifyCommit(uint256 agentId, uint256 commitIndex)
        external view returns (CommitRecord memory)
    {
        return commits[agentId][commitIndex];
    }

    /**
     * @notice How many commits does an agent have?
     */
    function getCommitCount(uint256 agentId) external view returns (uint256) {
        return commits[agentId].length;
    }

    /**
     * @notice Get the total number of registered agents.
     */
    function totalAgents() external view returns (uint256) {
        return _nextAgentId;
    }

    // ─── Relayer Management ──────────────────────────────────────────────

    /**
     * @notice Protocol owner approves/revokes a relayer address.
     */
    function setApprovedRelayer(address relayer, bool approved) external onlyOwner {
        approvedRelayers[relayer] = approved;
        emit RelayerApproved(relayer, approved);
    }

    /**
     * @notice Agent owner assigns a relayer that can commit on their behalf.
     */
    function setAgentRelayer(uint256 agentId, address relayer) external {
        require(ownerOf(agentId) == msg.sender, "Not agent owner");
        agentRelayer[agentId] = relayer;
        emit AgentRelayerSet(agentId, relayer);
    }
}
