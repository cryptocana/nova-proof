/**
 * NovaProof Contract Tests
 *
 * Tests the core contract functionality:
 * - Agent registration (ERC-721 mint)
 * - Log commitment (Merkle root storage)
 * - Reputation queries
 * - Access control
 * - Relayer management
 */

import { expect } from 'chai';
import { ethers } from 'hardhat';
import { type Contract, type Signer } from 'ethers';

describe('NovaProof', function () {
  let agentChain: Contract;
  let owner: Signer;
  let agent1: Signer;
  let relayer: Signer;
  let ownerAddr: string;
  let agent1Addr: string;
  let relayerAddr: string;

  beforeEach(async function () {
    [owner, agent1, relayer] = await ethers.getSigners();
    ownerAddr = await owner.getAddress();
    agent1Addr = await agent1.getAddress();
    relayerAddr = await relayer.getAddress();

    const NovaProof = await ethers.getContractFactory('NovaProof');
    agentChain = await NovaProof.deploy();
    await agentChain.waitForDeployment();
  });

  describe('Registration', function () {
    it('should register an agent and mint ERC-721', async function () {
      const tx = await agentChain.registerAgent('ipfs://QmTest');
      await tx.wait();

      expect(await agentChain.ownerOf(0)).to.equal(ownerAddr);
      expect(await agentChain.tokenURI(0)).to.equal('ipfs://QmTest');
      expect(await agentChain.totalAgents()).to.equal(1n);
    });

    it('should increment agent IDs', async function () {
      await (await agentChain.registerAgent('ipfs://Agent0')).wait();
      await (await agentChain.connect(agent1).registerAgent('ipfs://Agent1')).wait();

      expect(await agentChain.ownerOf(0)).to.equal(ownerAddr);
      expect(await agentChain.ownerOf(1)).to.equal(agent1Addr);
      expect(await agentChain.totalAgents()).to.equal(2n);
    });

    it('should set registeredAt timestamp', async function () {
      await (await agentChain.registerAgent('ipfs://QmTest')).wait();
      const stats = await agentChain.stats(0);
      expect(stats.registeredAt).to.be.gt(0);
    });

    it('should emit AgentRegistered event', async function () {
      await expect(agentChain.registerAgent('ipfs://QmTest'))
        .to.emit(agentChain, 'AgentRegistered')
        .withArgs(0, ownerAddr, 'ipfs://QmTest');
    });
  });

  describe('Log Commitment', function () {
    const merkleRoot = ethers.keccak256(ethers.toUtf8Bytes('test-root'));
    const now = Math.floor(Date.now() / 1000);

    beforeEach(async function () {
      await (await agentChain.registerAgent('ipfs://QmTest')).wait();
    });

    it('should commit a log successfully', async function () {
      await expect(
        agentChain.commitLog(0, merkleRoot, 10, 9, now - 3600, now)
      )
        .to.emit(agentChain, 'LogCommitted')
        .withArgs(0, merkleRoot, 10, 9, now - 3600, now);
    });

    it('should update aggregate stats', async function () {
      await (await agentChain.commitLog(0, merkleRoot, 10, 9, now - 3600, now)).wait();

      const stats = await agentChain.stats(0);
      expect(stats.totalTasks).to.equal(10n);
      expect(stats.totalSuccesses).to.equal(9n);
      expect(stats.totalCommits).to.equal(1);
    });

    it('should accumulate stats across multiple commits', async function () {
      await (await agentChain.commitLog(0, merkleRoot, 10, 9, now - 7200, now - 3600)).wait();
      await (await agentChain.commitLog(0, merkleRoot, 20, 18, now - 3600, now)).wait();

      const stats = await agentChain.stats(0);
      expect(stats.totalTasks).to.equal(30n);
      expect(stats.totalSuccesses).to.equal(27n);
      expect(stats.totalCommits).to.equal(2);
    });

    it('should reject if not agent owner', async function () {
      await expect(
        agentChain.connect(agent1).commitLog(0, merkleRoot, 10, 9, now - 3600, now)
      ).to.be.revertedWithCustomError(agentChain, 'NotAgentOwnerOrRelayer');
    });

    it('should reject invalid period', async function () {
      await expect(
        agentChain.commitLog(0, merkleRoot, 10, 9, now, now - 3600)
      ).to.be.revertedWithCustomError(agentChain, 'InvalidPeriod');
    });

    it('should reject if successCount > taskCount', async function () {
      await expect(
        agentChain.commitLog(0, merkleRoot, 10, 11, now - 3600, now)
      ).to.be.revertedWithCustomError(agentChain, 'InvalidCounts');
    });
  });

  describe('Reputation', function () {
    beforeEach(async function () {
      await (await agentChain.registerAgent('ipfs://QmTest')).wait();
      const now = Math.floor(Date.now() / 1000);
      const root = ethers.keccak256(ethers.toUtf8Bytes('root'));
      await (await agentChain.commitLog(0, root, 100, 95, now - 86400, now)).wait();
    });

    it('should return correct reputation stats', async function () {
      const rep = await agentChain.getReputation(0);
      expect(rep.totalTasks).to.equal(100n);
      expect(rep.totalSuccesses).to.equal(95n);
      expect(rep.successRate).to.equal(9500n); // 95% in basis points
      expect(rep.totalCommits).to.equal(1);
      expect(rep.tenure).to.be.gt(0);
    });

    it('should return 0 success rate for no tasks', async function () {
      await (await agentChain.connect(agent1).registerAgent('ipfs://Empty')).wait();
      const rep = await agentChain.getReputation(1);
      expect(rep.totalTasks).to.equal(0n);
      expect(rep.successRate).to.equal(0n);
    });
  });

  describe('Commit Verification', function () {
    const merkleRoot = ethers.keccak256(ethers.toUtf8Bytes('verify-root'));
    const now = Math.floor(Date.now() / 1000);

    beforeEach(async function () {
      await (await agentChain.registerAgent('ipfs://QmTest')).wait();
      await (await agentChain.commitLog(0, merkleRoot, 50, 48, now - 3600, now)).wait();
    });

    it('should return commit record by index', async function () {
      const record = await agentChain.verifyCommit(0, 0);
      expect(record.merkleRoot).to.equal(merkleRoot);
      expect(record.taskCount).to.equal(50);
      expect(record.successCount).to.equal(48);
    });

    it('should return correct commit count', async function () {
      expect(await agentChain.getCommitCount(0)).to.equal(1n);
    });
  });

  describe('Relayer Management', function () {
    beforeEach(async function () {
      await (await agentChain.registerAgent('ipfs://QmTest')).wait();
    });

    it('should allow owner to approve a relayer', async function () {
      await expect(agentChain.setApprovedRelayer(relayerAddr, true))
        .to.emit(agentChain, 'RelayerApproved')
        .withArgs(relayerAddr, true);

      expect(await agentChain.approvedRelayers(relayerAddr)).to.be.true;
    });

    it('should allow agent owner to set a relayer', async function () {
      await (await agentChain.setApprovedRelayer(relayerAddr, true)).wait();
      await (await agentChain.setAgentRelayer(0, relayerAddr)).wait();

      expect(await agentChain.agentRelayer(0)).to.equal(relayerAddr);
    });

    it('should allow relayer to commit on behalf of agent', async function () {
      await (await agentChain.setApprovedRelayer(relayerAddr, true)).wait();
      await (await agentChain.setAgentRelayer(0, relayerAddr)).wait();

      const root = ethers.keccak256(ethers.toUtf8Bytes('relayer-root'));
      const now = Math.floor(Date.now() / 1000);

      await expect(
        agentChain.connect(relayer).commitLog(0, root, 25, 24, now - 3600, now)
      ).to.emit(agentChain, 'LogCommitted');
    });

    it('should reject non-approved relayer', async function () {
      await (await agentChain.setAgentRelayer(0, relayerAddr)).wait();
      // relayer is set but not approved globally

      const root = ethers.keccak256(ethers.toUtf8Bytes('bad-root'));
      const now = Math.floor(Date.now() / 1000);

      await expect(
        agentChain.connect(relayer).commitLog(0, root, 10, 9, now - 3600, now)
      ).to.be.revertedWithCustomError(agentChain, 'NotAgentOwnerOrRelayer');
    });

    it('should reject non-owner setting relayer', async function () {
      await expect(
        agentChain.connect(agent1).setAgentRelayer(0, relayerAddr)
      ).to.be.revertedWith('Not agent owner');
    });
  });
});
