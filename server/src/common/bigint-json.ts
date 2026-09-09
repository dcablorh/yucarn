/**
 * BigInt is not JSON-serializable by default, and invoice amounts (and the
 * amount nonce arithmetic) are BigInt throughout. Without this, any
 * response that serialises an invoice throws
 * `TypeError: Do not know how to serialize a BigInt`.
 *
 * This lives as a side-effect import off AppModule (see app.module.ts)
 * rather than only in main.ts, so every entrypoint that boots the app
 * graph gets it — including test/app.e2e-spec.ts, which creates a Nest
 * application straight from AppModule without ever importing main.ts.
 */
if (!('toJSON' in BigInt.prototype)) {
  (BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function () {
    return this.toString();
  };
}
