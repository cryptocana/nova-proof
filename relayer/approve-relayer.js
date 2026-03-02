/**
 * One-time script: Approve the Nova wallet as a global relayer on AgentChain.
 * Run: node approve-relayer.js
 */
import { createWalletClient, createPublicClient, http, parseAbi } from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const RPC_URL = 'https://base-mainnet.g.alchemy.com/v2/sHcreRgIM4yb_QuIEr335';
const CONTRACT = '0xA88CBE718eAF91EDe4304a595f88069fA214fce6';
const PRIVATE_KEY = '0x2b82e737aa5cbd7a6bdbc789e094eedc12d7efcde386a68de313d60588f839eb';

const abi = parseAbi([
  'function setApprovedRelayer(address relayer, bool approved) external',
  'function approvedRelayers(address) view returns (bool)',
]);

const account = privateKeyToAccount(PRIVATE_KEY);

const publicClient = createPublicClient({
  chain: base,
  transport: http(RPC_URL),
});

const walletClient = createWalletClient({
  account,
  chain: base,
  transport: http(RPC_URL),
});

async function main() {
  // Check if already approved
  const isApproved = await publicClient.readContract({
    address: CONTRACT,
    abi,
    functionName: 'approvedRelayers',
    args: [account.address],
  });

  console.log(`Nova wallet: ${account.address}`);
  console.log(`Already approved relayer: ${isApproved}`);

  if (isApproved) {
    console.log('✅ Already approved — nothing to do.');
    return;
  }

  console.log('Sending setApprovedRelayer tx...');
  const hash = await walletClient.writeContract({
    address: CONTRACT,
    abi,
    functionName: 'setApprovedRelayer',
    args: [account.address, true],
  });

  console.log(`Tx sent: ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`✅ Confirmed in block ${receipt.blockNumber}, status: ${receipt.status}`);
}

main().catch(console.error);
