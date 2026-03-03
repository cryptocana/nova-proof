import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import * as dotenv from 'dotenv';

dotenv.config();

const PRIVATE_KEY = process.env.PRIVATE_KEY || '0x0000000000000000000000000000000000000000000000000000000000000001';
const BASE_RPC_URL = process.env.BASE_RPC_URL || 'https://mainnet.base.org';
const BASE_SEPOLIA_RPC_URL = process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org';
const BASESCAN_API_KEY = process.env.BASESCAN_API_KEY || '';

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.28',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      evmVersion: 'cancun',
      viaIR: false,
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    'base-sepolia': {
      url: BASE_SEPOLIA_RPC_URL,
      accounts: [PRIVATE_KEY],
      chainId: 84532,
      gasMultiplier: 1.2,
    },
    'base-mainnet': {
      url: BASE_RPC_URL,
      accounts: [PRIVATE_KEY],
      chainId: 8453,
      gasMultiplier: 1.1,
    },
  },
  etherscan: {
    apiKey: {
      'base-sepolia': BASESCAN_API_KEY,
      'base-mainnet': BASESCAN_API_KEY,
    },
    customChains: [
      {
        network: 'base-sepolia',
        chainId: 84532,
        urls: {
          apiURL: 'https://api-sepolia.basescan.org/api',
          browserURL: 'https://sepolia.basescan.org',
        },
      },
      {
        network: 'base-mainnet',
        chainId: 8453,
        urls: {
          apiURL: 'https://api.basescan.org/api',
          browserURL: 'https://basescan.org',
        },
      },
    ],
  },
  paths: {
    sources: './contracts',
    tests: './test',
    cache: './cache',
    artifacts: './artifacts',
  },
};

export default config;
