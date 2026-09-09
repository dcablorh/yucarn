import {
  assertTransactionSucceeded,
  findMatchingProxyDeployedLog,
  RevertedTransactionError,
} from './sepolia-rpc.client';

describe('assertTransactionSucceeded', () => {
  it('does nothing for a successful receipt', () => {
    expect(() =>
      assertTransactionSucceeded({ status: 'success' }, '0xabc'),
    ).not.toThrow();
  });

  it('throws RevertedTransactionError for a reverted receipt', () => {
    expect(() =>
      assertTransactionSucceeded({ status: 'reverted' }, '0xabc'),
    ).toThrow(RevertedTransactionError);
  });
});

describe('findMatchingProxyDeployedLog', () => {
  const txHash = '0x' + 'ab'.repeat(32);
  const ownSalt = 123n;
  const proxyAddress = '0x9999999999999999999999999999999999999999';

  it('returns the proxy address when the log salt matches the expected salt', () => {
    const logs = [
      { transactionHash: txHash, args: { proxyAddress, salt: ownSalt } },
    ];
    expect(findMatchingProxyDeployedLog(logs, txHash, ownSalt)).toBe(
      proxyAddress,
    );
  });

  it('rejects a deploy tx whose ProxyDeployed salt belongs to a different registration', () => {
    // A different business's deploy tx: same event, same tx hash pattern,
    // but the salt (deterministic from *that* registration's id) does not
    // match what this registration expects. Without this check, this
    // business could adopt the other business's registry as its own.
    const someoneElsesSalt = 999n;
    const logs = [
      {
        transactionHash: txHash,
        args: { proxyAddress, salt: someoneElsesSalt },
      },
    ];
    expect(() => findMatchingProxyDeployedLog(logs, txHash, ownSalt)).toThrow(
      /does not belong to this registration/,
    );
  });

  it('throws when no ProxyDeployed log matches the transaction hash', () => {
    const logs = [
      {
        transactionHash: '0x' + 'ff'.repeat(32),
        args: { proxyAddress, salt: ownSalt },
      },
    ];
    expect(() => findMatchingProxyDeployedLog(logs, txHash, ownSalt)).toThrow(
      /No ProxyDeployed event/,
    );
  });
});
