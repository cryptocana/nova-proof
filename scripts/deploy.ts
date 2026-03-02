import { ethers } from 'hardhat';

async function main() {
  console.log('Deploying AgentChain to Base Mainnet...');
  const [deployer] = await ethers.getSigners();
  console.log('Deployer:', deployer.address);
  console.log('Balance:', ethers.formatEther(await ethers.provider.getBalance(deployer.address)), 'ETH');

  const AgentChain = await ethers.getContractFactory('AgentChain');
  const contract = await AgentChain.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log('\n✅ AgentChain deployed to Base Mainnet!');
  console.log('Contract:', address);
  console.log('View:', `https://basescan.org/address/${address}`);

  // Register Nova as Agent #0
  console.log('\nRegistering Nova as Agent #0...');
  const tx = await contract.registerAgent('ipfs://QmNovaAgentZeroMetadata');
  await tx.wait();
  console.log('✅ Nova is Agent #0');
  console.log('TX:', tx.hash);
}

main().catch((err) => { console.error(err); process.exit(1); });
