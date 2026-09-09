// server/src/config/ens.ts

/**
 * ENSv2 Sepolia beta. Every address below was verified to carry code, and
 * every signature verified present in that code, on 2026-09-09 — see
 * docs/superpowers/specs/2026-09-09-day-0-spike-findings.md.
 *
 * ENS documents these as beta and "not yet final". If a call starts
 * reverting for no reason, re-verify these before debugging anything else.
 */
export const SEPOLIA_CHAIN_ID = 11155111;

export const ENS = {
  ethRegistrar: '0xa88553f454b77203b0d036a05c894d555eaaa2cc',
  verifiableFactory: '0x10dc6333cdfe1fcef624c6e0a8221b91804cd7ef',
  userRegistryImpl: '0x624a25d67b59d587752ebec8dded8827dae52050',
  publicResolver: '0xe7b9a25607e02da8145e4eb1836ca539e53f11f7',
  mockUsdc: '0x768f42455a2d082e23ceef7d51e5787c82d67a39',
} as const;

/** Read from the deployed registrar, not assumed. */
export const MIN_COMMITMENT_AGE_SECS = 60;
export const MAX_COMMITMENT_AGE_SECS = 86_400;

/** One year, the only duration the dashboard offers. */
export const REGISTRATION_DURATION_SECS = 31_536_000n;

/** No referral programme; the registrar still requires the argument. */
export const NO_REFERRER =
  '0x0000000000000000000000000000000000000000000000000000000000000000' as const;

/**
 * EACBaseRolesLib.ALL_ROLES — bit 0 of every nybble. The business is the
 * root account of its own registry and holds every role in it.
 */
export const ALL_ROLES =
  0x1111111111111111111111111111111111111111111111111111111111111111n;
