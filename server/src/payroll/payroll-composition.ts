import { ARC_CHAIN_KEY } from '../config/chains';
import { parseUsdcAmount } from '../invoices/invoices.service';

export class PayrollCompositionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PayrollCompositionError';
  }
}

/** The subset of an Employee this module needs. */
export interface PayableEmployee {
  id: string;
  name: string;
  walletAddress: string;
  prefChain: string;
  prefAsset: string;
}

export interface ComposedItem {
  employeeId: string;
  name: string;
  walletAddress: string;
  amountBase: bigint;
  destChain: string;
  destAsset: string;
}

export interface UnpayableEmployee {
  employeeId: string;
  name: string;
  destChain: string;
  reason: string;
}

export interface Composition {
  items: ComposedItem[];
  totalBase: bigint;
  unpayable: UnpayableEmployee[];
}

/**
 * Turns a roster and a set of amounts into a batch.
 *
 * An employee with no amount is simply not in this run — that is how a
 * merchant pays half the team. An employee WITH an amount whose chain we
 * cannot reach is a different thing entirely: they are named in
 * `unpayable` with the reason, so the merchant sees who is missing and
 * why before signing anything. Silently dropping them would let someone
 * go unpaid without a trace.
 *
 * Amounts arrive as strings and are parsed with the same parseUsdcAmount
 * the invoice path uses, so payroll and invoicing agree on what a dollar
 * is. Every sum is BigInt: a 40-person batch at nine figures each is past
 * Number.MAX_SAFE_INTEGER, and a float would drift silently.
 */
export function composeBatch(
  employees: PayableEmployee[],
  amounts: Record<string, string>,
): Composition {
  const byId = new Map(employees.map((employee) => [employee.id, employee]));

  for (const id of Object.keys(amounts)) {
    if (!byId.has(id)) {
      throw new PayrollCompositionError(
        `Someone in this run is not on your team (${id})`,
      );
    }
  }

  const items: ComposedItem[] = [];
  const unpayable: UnpayableEmployee[] = [];
  let totalBase = 0n;

  for (const employee of employees) {
    const raw = amounts[employee.id];
    if (raw === undefined) continue;

    let amountBase: bigint;
    try {
      amountBase = parseUsdcAmount(raw);
    } catch (cause) {
      throw new PayrollCompositionError(
        `${employee.name}: ${(cause as Error).message}`,
      );
    }

    if (employee.prefChain !== ARC_CHAIN_KEY) {
      // Cross-chain payroll is not built yet (spec §5.4). Naming the
      // person and the chain is the honest version of that.
      unpayable.push({
        employeeId: employee.id,
        name: employee.name,
        destChain: employee.prefChain,
        reason: 'Yucarn can only pay on Arc for now. Change their chain to Arc to include them.',
      });
      continue;
    }

    items.push({
      employeeId: employee.id,
      name: employee.name,
      walletAddress: employee.walletAddress,
      amountBase,
      destChain: employee.prefChain,
      destAsset: employee.prefAsset,
    });
    totalBase += amountBase;
  }

  if (items.length === 0) {
    throw new PayrollCompositionError('There is no one to pay in this run');
  }

  return { items, totalBase, unpayable };
}
