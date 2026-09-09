import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PayrollBatchStatus, PayrollItemStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmployeesService } from '../employees/employees.service';
import { ArcRpcClient } from '../watcher/arc-rpc.client';
import { composeBatch, PayrollCompositionError } from './payroll-composition';
import { buildPayrollCalls, UnsupportedRouteError } from './payroll-calls';

export interface ExecutionResult {
  itemId: string;
  txHash: string;
}

/**
 * The statuses a run can be (re-)sent to a wallet from. PARTIAL and FAILED
 * are here because `getCalls` filters to PENDING items: re-entering one of
 * those pays only the people who have not been paid, which is the only
 * recovery path an unverifiable transfer has.
 */
const RETRYABLE_STATUSES: PayrollBatchStatus[] = [
  PayrollBatchStatus.DRAFT,
  PayrollBatchStatus.PARTIAL,
  PayrollBatchStatus.FAILED,
];

/**
 * The statuses a report is accepted for: the run this server locked, plus
 * the terminal ones, so a retried report is idempotent rather than a 400.
 */
const REPORTABLE_STATUSES: PayrollBatchStatus[] = [
  PayrollBatchStatus.EXECUTING,
  PayrollBatchStatus.COMPLETED,
  PayrollBatchStatus.PARTIAL,
  PayrollBatchStatus.FAILED,
];

/** Shown against an item whose hash Arc could not be asked about. */
export const UNVERIFIED_REASON =
  'Arc could not be reached to check this payment yet — it has not been confirmed either way. Re-run this batch to check again.';

@Injectable()
export class PayrollService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly employees: EmployeesService,
    private readonly arc: ArcRpcClient,
  ) {}

  /**
   * Resolved as {id, businessId}, so a batch belonging to another business
   * simply does not exist as far as this caller is concerned.
   */
  private async requireOwned(businessId: string, id: string) {
    const batch = await this.prisma.payrollBatch.findFirst({
      where: { id, businessId },
      include: { items: true },
    });
    if (!batch) throw new NotFoundException('Payroll run not found');
    return batch;
  }

  list(businessId: string) {
    return this.prisma.payrollBatch.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
      include: { items: true },
    });
  }

  async create(businessId: string, amounts: Record<string, string>) {
    const roster = await this.employees.list(businessId);

    let composition: ReturnType<typeof composeBatch>;
    try {
      composition = composeBatch(roster, amounts);
    } catch (cause) {
      if (cause instanceof PayrollCompositionError) {
        throw new BadRequestException(cause.message);
      }
      throw cause;
    }

    const batch = await this.prisma.payrollBatch.create({
      data: {
        businessId,
        totalBase: composition.totalBase,
        items: {
          create: composition.items.map((item) => ({
            employeeId: item.employeeId,
            name: item.name,
            walletAddress: item.walletAddress,
            amountBase: item.amountBase,
            destChain: item.destChain,
            destAsset: item.destAsset,
          })),
        },
      },
      include: { items: true },
    });

    return { ...batch, unpayable: composition.unpayable };
  }

  get(businessId: string, id: string) {
    return this.requireOwned(businessId, id);
  }

  /**
   * Hands back the unsigned calls for everyone still awaiting payment, and
   * — in the same breath — takes the batch out of circulation.
   *
   * Handing out calls without recording that a run is in flight is how the
   * same team gets paid twice: the browser signs twelve transfers, the
   * report back fails (a dropped connection, an expired token), the page
   * reloads a DRAFT batch with twelve PENDING items, and the only live
   * button says "Pay everyone". The batch has to carry the fact that it is
   * being paid, and it has to start carrying it here, because this is the
   * last moment the server hears from the browser before money moves.
   *
   * The flip is a CONDITIONAL update, not a read-then-write: two tabs (or
   * two clicks) can both read a DRAFT batch, but `updateMany` filtered on
   * `status` is decided by the database, so exactly one of them changes a
   * row and the other is told the run is already going. It is filtered by
   * `businessId` as well as `id`, so it can never reach across tenants —
   * the same rule every other read here follows.
   *
   * PARTIAL and FAILED are re-entrant on purpose: they are what a run
   * becomes when some payments landed and others did not, and the items
   * that did not are exactly the PENDING ones filtered below. Refusing
   * them would leave an employee whose transfer could not be verified with
   * no way to ever be paid. EXECUTING and COMPLETED are not re-entrant:
   * one is in flight, the other is done.
   */
  async getCalls(businessId: string, id: string) {
    const batch = await this.requireOwned(businessId, id);

    if (!RETRYABLE_STATUSES.includes(batch.status)) {
      throw new BadRequestException(
        batch.status === PayrollBatchStatus.EXECUTING
          ? 'This payroll run is already being paid. Check your wallet before starting it again.'
          : 'This payroll run has already been executed',
      );
    }

    // Anything we could not verify last time is re-checked first, because
    // it decides whether the person is owed money at all. This is the
    // recovery path for an `unknown` verification: the merchant presses
    // pay, and the first thing that press does is ask Arc again about the
    // hashes we could not read. Merchant-initiated, like every other
    // transition here.
    const rechecked = await this.recheckUnverified(batch.items);

    // A PENDING item that already carries a hash is NOT payable. Its
    // transfer may well have landed — that is exactly what `unknown`
    // means — and sending a second transfer to settle it is the double
    // payment this whole path exists to prevent. It is held back and
    // named instead, so a human decides.
    const payable: typeof batch.items = [];
    const unresolved: typeof batch.items = [];
    for (const item of batch.items) {
      const status = rechecked.get(item.id) ?? item.status;
      if (status !== PayrollItemStatus.PENDING) continue;
      if (item.payTxHash) unresolved.push(item);
      else payable.push(item);
    }

    if (payable.length === 0) {
      // The re-check above may have settled items; record that before
      // refusing, so the merchant's press is not wasted work.
      await this.rollUpBatch(batch.id, batch.items, rechecked);
      throw new BadRequestException(
        unresolved.length > 0
          ? `Arc still cannot confirm ${unresolved.length === 1 ? 'a payment' : `${unresolved.length} payments`} in this run (${unresolved
              .map((item) => item.name)
              .join(
                ', ',
              )}). Check ${unresolved.length === 1 ? 'it' : 'them'} on the explorer before paying anyone again.`
          : 'Every payment in this run has already been settled',
      );
    }

    // Built BEFORE the batch is locked. An unroutable item throws, and a
    // batch left EXECUTING by a request that never handed out a single
    // call would be stuck for nothing.
    let prepared: {
      calls: ReturnType<typeof buildPayrollCalls>;
      itemIds: string[];
    };
    try {
      prepared = {
        calls: buildPayrollCalls(payable),
        itemIds: payable.map((item) => item.id),
      };
    } catch (cause) {
      if (cause instanceof UnsupportedRouteError) {
        throw new BadRequestException(cause.message);
      }
      throw cause;
    }

    const claimed = await this.prisma.payrollBatch.updateMany({
      where: { id, businessId, status: { in: RETRYABLE_STATUSES } },
      data: { status: PayrollBatchStatus.EXECUTING },
    });
    if (claimed.count === 0) {
      throw new BadRequestException(
        'This payroll run is already being paid. Check your wallet before starting it again.',
      );
    }

    return prepared;
  }

  /**
   * Releases a run the merchant says never left their wallet.
   *
   * `getCalls` locks a batch precisely so a failure between signing and
   * reporting cannot be answered by paying everyone again — but a merchant
   * who simply dismissed the wallet prompt would then be locked out of
   * their own run forever. This is the way back, and it is deliberately
   * NOT automatic: the page cannot know that a broadcast which errored did
   * not in fact reach the chain, so the person who watched the wallet says
   * so, by pressing a button that says what it means.
   *
   * Only EXECUTING is releasable, conditionally, so this can never disturb
   * a run in any other state. Items already PAID are why it releases to
   * PARTIAL rather than DRAFT — a run with money already out of the door
   * is not a draft.
   */
  async abandonExecution(businessId: string, id: string) {
    const batch = await this.requireOwned(businessId, id);

    if (batch.status !== PayrollBatchStatus.EXECUTING) {
      throw new BadRequestException('This payroll run is not being paid');
    }

    const anyPaid = batch.items.some(
      (item) => item.status === PayrollItemStatus.PAID,
    );

    const released = await this.prisma.payrollBatch.updateMany({
      where: { id, businessId, status: PayrollBatchStatus.EXECUTING },
      data: {
        status: anyPaid ? PayrollBatchStatus.PARTIAL : PayrollBatchStatus.DRAFT,
      },
    });
    if (released.count === 0) {
      throw new BadRequestException('This payroll run is not being paid');
    }

    return this.requireOwned(businessId, id);
  }

  /**
   * Records what the browser says happened, after checking each claim.
   *
   * A transaction hash from a client is a claim, not proof — the same
   * stance the invoice path takes toward its payment callback: neither
   * trusts the hash itself, both require it to match on-chain. Here that
   * means the hash must resolve to a successful transaction that emitted
   * a USDC Transfer to this item's wallet for exactly this item's amount
   * (see `ArcRpcClient.verifyUsdcTransfer`) — a successful transaction
   * alone is not proof of what it paid. A hash for an item that is not in
   * this batch is ignored rather than trusted, and an item already PAID
   * is left untouched: it is a terminal state, so a replayed report can
   * never regress it (and overwrite its real payTxHash) even if the
   * replay carries a hash that fails verification.
   *
   * Three outcomes, three different records. `confirmed` is PAID and
   * `rejected` is FAILED, but an outcome of `unknown` — a 429 from a
   * public endpoint, a timeout, a hash that is not mined yet — leaves the
   * item PENDING with its hash saved and a reason that says so. Writing
   * "we could not check" down as "it did not happen" is how an employee
   * who WAS paid ends up on next week's run: the dashboard says FAILED,
   * the merchant believes it, and pays them again. An item we could not
   * verify is unresolved, never failed.
   */
  async reportExecution(
    businessId: string,
    id: string,
    results: ExecutionResult[],
  ) {
    const batch = await this.requireOwned(businessId, id);

    // A report is only meaningful for a run this server handed calls out
    // for. Without this, `POST /:id/executed {results: []}` against a
    // fresh DRAFT batch marked it FAILED with an executedAt, after which
    // getCalls refused it and its PENDING items could never be paid — a
    // stranded run, from a request that reported nothing at all. The
    // terminal statuses stay accepted so a retried report (the first one
    // having already landed) is idempotent rather than a 400.
    if (!REPORTABLE_STATUSES.includes(batch.status)) {
      throw new BadRequestException(
        'This payroll run has not been sent to your wallet yet',
      );
    }

    if (results.length === 0) {
      throw new BadRequestException(
        'A payroll report must name at least one payment',
      );
    }

    // Every hash is checked for prior use BEFORE anything is written.
    //
    // Two monthly runs pay the same person the same salary, so September's
    // hash verifies perfectly against October's item: same recipient, same
    // amount, a genuinely successful transaction. A stale or replayed
    // report would mark October PAID against September's receipt, and the
    // employee is never paid while the UI shows a working receipt link.
    // The hash is what distinguishes them, so a hash already spent on
    // another run cannot be spent again here.
    //
    // Scoped to OTHER batches on purpose: within one batch a single hash
    // legitimately covers many items, because an atomic EIP-5792 batch is
    // one transaction that pays everyone in it.
    await this.rejectAlreadyRecordedHashes(batch.id, results);

    const ownItems = new Map(batch.items.map((item) => [item.id, item]));

    // Records each item's outcome as it is decided, so the roll-up below
    // can count from this map instead of re-reading the chain per item.
    const outcomes = new Map<string, PayrollItemStatus>();

    for (const result of results) {
      const item = ownItems.get(result.itemId);
      if (!item) continue;
      if (item.status === PayrollItemStatus.PAID) continue;

      const { outcome } = await this.arc.verifyUsdcTransfer(
        result.txHash,
        item.walletAddress,
        item.amountBase,
      );

      const data =
        outcome === 'confirmed'
          ? {
              status: PayrollItemStatus.PAID,
              payTxHash: result.txHash,
              failureReason: null,
            }
          : outcome === 'rejected'
            ? {
                status: PayrollItemStatus.FAILED,
                payTxHash: result.txHash,
                failureReason: 'Arc did not confirm this transfer',
              }
            : {
                // Still PENDING. The hash is kept regardless — losing it
                // would lose the only pointer to a transaction that may
                // well have paid this person.
                status: PayrollItemStatus.PENDING,
                payTxHash: result.txHash,
                failureReason: UNVERIFIED_REASON,
              };

      outcomes.set(result.itemId, data.status);
      await this.prisma.payrollItem.update({
        where: { id: result.itemId },
        data,
      });
    }

    await this.rollUpBatch(batch.id, batch.items, outcomes, new Date());

    return this.requireOwned(businessId, id);
  }

  /**
   * Asks Arc again about every PENDING item that already carries a hash.
   *
   * These are the items a previous report could not resolve — the RPC
   * threw, timed out, or the transaction was not mined yet. Re-reading the
   * receipt is the only thing that can settle them, and it is safe to do
   * as often as the merchant likes: reading a receipt moves no money.
   *
   * Returns the statuses that changed, so a caller can roll the batch up
   * without re-reading it. An item that is still `unknown` is not written
   * at all — its row already says exactly this.
   */
  private async recheckUnverified(
    items: readonly {
      id: string;
      status: PayrollItemStatus;
      payTxHash: string | null;
      walletAddress: string;
      amountBase: bigint;
    }[],
  ): Promise<Map<string, PayrollItemStatus>> {
    const settled = new Map<string, PayrollItemStatus>();

    for (const item of items) {
      if (item.status !== PayrollItemStatus.PENDING) continue;
      if (!item.payTxHash) continue;

      const { outcome } = await this.arc.verifyUsdcTransfer(
        item.payTxHash,
        item.walletAddress,
        item.amountBase,
      );
      if (outcome === 'unknown') continue;

      const status =
        outcome === 'confirmed'
          ? PayrollItemStatus.PAID
          : PayrollItemStatus.FAILED;
      settled.set(item.id, status);
      await this.prisma.payrollItem.update({
        where: { id: item.id },
        data: {
          status,
          failureReason:
            outcome === 'confirmed'
              ? null
              : 'Arc did not confirm this transfer',
        },
      });
    }

    return settled;
  }

  /**
   * Derives the batch status from its items' outcomes.
   *
   * An item still PENDING keeps the run out of a terminal state. COMPLETED
   * and FAILED both say "nothing left to do here", and there is: someone
   * has to re-check that hash, and only a re-runnable status gives the
   * merchant a button to do it with.
   */
  private async rollUpBatch(
    id: string,
    items: readonly { id: string; status: PayrollItemStatus }[],
    outcomes: Map<string, PayrollItemStatus>,
    executedAt?: Date,
  ) {
    let paid = 0;
    let unresolved = 0;
    for (const item of items) {
      const status = outcomes.get(item.id) ?? item.status;
      if (status === PayrollItemStatus.PAID) paid += 1;
      else if (status === PayrollItemStatus.PENDING) unresolved += 1;
    }

    const status =
      paid === items.length
        ? PayrollBatchStatus.COMPLETED
        : unresolved > 0
          ? PayrollBatchStatus.PARTIAL
          : paid === 0
            ? PayrollBatchStatus.FAILED
            : PayrollBatchStatus.PARTIAL;

    await this.prisma.payrollBatch.update({
      where: { id },
      data: executedAt ? { status, executedAt } : { status },
    });
  }

  /**
   * Refuses any reported hash that is already recorded against an item in
   * a different batch. See `reportExecution` for why that matters.
   */
  private async rejectAlreadyRecordedHashes(
    batchId: string,
    results: ExecutionResult[],
  ) {
    const hashes = [...new Set(results.map((result) => result.txHash))];
    if (hashes.length === 0) return;

    const clash = await this.prisma.payrollItem.findFirst({
      where: { payTxHash: { in: hashes }, batchId: { not: batchId } },
      select: { payTxHash: true },
    });

    if (clash) {
      throw new BadRequestException(
        `Transaction ${clash.payTxHash} is already recorded against another payroll run`,
      );
    }
  }
}
