/**
 * merkle.js — Pure JS Merkle tree builder for NovaProof task logs.
 * No external deps — uses Node.js built-in crypto.
 */
import { createHash } from 'crypto';

/**
 * Hash a single leaf (task string → bytes32).
 */
function hashLeaf(data) {
  return createHash('sha256').update(data).digest();
}

/**
 * Hash two sibling nodes together (sorted for deterministic order).
 */
function hashPair(a, b) {
  // Sort to ensure deterministic tree regardless of input order
  const [left, right] = Buffer.compare(a, b) <= 0 ? [a, b] : [b, a];
  return createHash('sha256').update(Buffer.concat([left, right])).digest();
}

/**
 * Build a Merkle tree from an array of task objects.
 *
 * @param {Array<{type: string, description: string, success: boolean}>} tasks
 * @returns {{ root: string, leaves: string[], proofs: string[][] }}
 */
export function buildMerkleTree(tasks) {
  if (!tasks || tasks.length === 0) {
    throw new Error('Cannot build Merkle tree from empty task list');
  }

  // Create leaf strings and hash them
  const leafStrings = tasks.map(
    (t, i) => `${i}:${t.type}:${t.description}:${t.success ? '1' : '0'}`
  );
  const leaves = leafStrings.map(hashLeaf);

  // If only one leaf, root = that leaf's hash
  if (leaves.length === 1) {
    const root = '0x' + leaves[0].toString('hex');
    return {
      root,
      leaves: leafStrings,
      proofs: [[]],
    };
  }

  // Build tree layers bottom-up
  const layers = [leaves.slice()];

  while (layers[layers.length - 1].length > 1) {
    const currentLayer = layers[layers.length - 1];
    const nextLayer = [];

    for (let i = 0; i < currentLayer.length; i += 2) {
      if (i + 1 < currentLayer.length) {
        nextLayer.push(hashPair(currentLayer[i], currentLayer[i + 1]));
      } else {
        // Odd node — promote it
        nextLayer.push(currentLayer[i]);
      }
    }

    layers.push(nextLayer);
  }

  const root = '0x' + layers[layers.length - 1][0].toString('hex');

  // Generate proofs for each leaf
  const proofs = leaves.map((_, leafIndex) => {
    const proof = [];
    let idx = leafIndex;

    for (let layer = 0; layer < layers.length - 1; layer++) {
      const currentLayer = layers[layer];
      const siblingIdx = idx % 2 === 0 ? idx + 1 : idx - 1;

      if (siblingIdx < currentLayer.length) {
        proof.push('0x' + currentLayer[siblingIdx].toString('hex'));
      }

      idx = Math.floor(idx / 2);
    }

    return proof;
  });

  return {
    root,
    leaves: leafStrings,
    proofs,
  };
}

/**
 * Convert a hex root string to bytes32 for Solidity.
 * Pads/truncates to exactly 32 bytes.
 */
export function rootToBytes32(hexRoot) {
  const clean = hexRoot.startsWith('0x') ? hexRoot.slice(2) : hexRoot;
  return '0x' + clean.padStart(64, '0').slice(0, 64);
}
