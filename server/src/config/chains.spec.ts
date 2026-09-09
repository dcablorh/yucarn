import { arcTestnet } from 'viem/chains';
import { ARC_CHAIN_ID } from './chains';

describe('ARC_CHAIN_ID', () => {
  it('matches the chain id viem actually uses for the RPC client', () => {
    // Nothing in the watcher reads ARC_CHAIN_ID today — ArcRpcClient takes
    // its chain straight from viem's arcTestnet (see
    // src/watcher/arc-rpc.client.ts). If a viem upgrade ever repoints
    // arcTestnet to a different chain id, this constant would silently go
    // stale and no longer describe what the watcher is actually talking
    // to. This test exists purely as a tripwire for that drift.
    expect(arcTestnet.id).toBe(ARC_CHAIN_ID);
  });
});
