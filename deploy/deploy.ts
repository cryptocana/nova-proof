/**
 * NovaProof Deployment Script
 *
 * Deploys the NovaProof contract to Base (Sepolia or Mainnet).
 *
 * Usage:
 *   npx hardhat run deploy/deploy.ts --network base-sepolia
 *   npx hardhat run deploy/deploy.ts --network base-mainnet
 */

import { ethers } from 'hardhat';

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log('\n  🔗 NovaProof Deployment');
  console.log('  ──────────────────────────────────');
  console.log(`  Deployer:  ${deployer.address}`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`  Balance:   ${ethers.formatEther(balance)} ETH`);

  const network = await ethers.provider.getNetwork();
  console.log(`  Network:   ${network.name} (chainId: ${network.chainId})`);
  console.log('  ──────────────────────────────────\n');

  // Deploy
  console.log('  📦 Deploying NovaProof...');
  const NovaProof = await ethers.getContractFactory('NovaProof');
  const agentChain = await NovaProof.deploy();

  await agentChain.waitForDeployment();
  const address = await agentChain.getAddress();

  console.log(`  ✅ Deployed to: ${address}\n`);

  // Register Nova as Agent #0
  console.log('  🌟 Registering Nova as Agent #0...');
  const tx = await agentChain.registerAgent(
    'ipfs://QmNovaAgentZeroMetadata' // Placeholder — replace with real IPFS hash
  );
  await tx.wait();
  console.log('  ✅ Nova is Agent #0\n');

  // Print summary
  console.log('  ══════════════════════════════════');
  console.log('  DEPLOYMENT COMPLETE');
  console.log('  ──────────────────────────────────');
  console.log(`  Contract:  ${address}`);
  console.log(`  Chain:     ${network.chainId}`);
  console.log(`  Agent #0:  Nova (${deployer.address})`);
  console.log('  ──────────────────────────────────');
  console.log('');
  console.log('  Next steps:');
  console.log(`  1. Verify: npx hardhat verify --network ${network.name} ${address}`);
  console.log('  2. Update .env with CONTRACT_ADDRESS=' + address);
  console.log('  3. Update sdk/src/types.ts with the contract address');
  console.log('  4. Start the API: cd api && npm run dev');
  console.log('');

  // Optional: verify on Basescan
  if (process.env.BASESCAN_API_KEY) {
    console.log('  🔍 Verifying on Basescan...');
    try {
      const { run } = await import('hardhat');
      await run('verify:verify', {
        address,
        constructorArguments: [],
      });
      console.log('  ✅ Verified on Basescan\n');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(`  ⚠️  Verification failed: ${message}\n`);
      console.log('  Run manually: npx hardhat verify --network <network> ' + address);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Deployment failed:', error);
    process.exit(1);
  });
