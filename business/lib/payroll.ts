'use client';

import { usePrivy } from '@privy-io/react-auth';
import { useCallback, useMemo } from 'react';
import { ApiError } from './api';
import { apiUrl } from './api-url';

const API_URL = apiUrl();

export interface UnsignedCall {
  to: string;
  data: string;
  value: string;
  chainId: number;
}

export type PayrollItemStatus = 'PENDING' | 'PAID' | 'FAILED';
export type PayrollBatchStatus = 'DRAFT' | 'EXECUTING' | 'COMPLETED' | 'PARTIAL' | 'FAILED';

export interface PayrollItem {
  id: string;
  employeeId: string;
  name: string;
  walletAddress: string;
  /** Micro-USDC as a decimal string. Convert with BigInt, never Number. */
  amountBase: string;
  destChain: string;
  destAsset: string;
  status: PayrollItemStatus;
  payTxHash: string | null;
  failureReason: string | null;
}

export interface PayrollBatch {
  id: string;
  status: PayrollBatchStatus;
  fundingChain: string;
  totalBase: string;
  executedAt: string | null;
  createdAt: string;
  items: PayrollItem[];
}

export interface UnpayableEmployee {
  employeeId: string;
  name: string;
  destChain: string;
  reason: string;
}

export function usePayrollApi() {
  const { getAccessToken } = usePrivy();

  const request = useCallback(
    async <T,>(path: string, init: RequestInit = {}): Promise<T> => {
      const token = await getAccessToken();
      const response = await fetch(`${API_URL}${path}`, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          ...init.headers,
        },
      });
      if (!response.ok) throw new ApiError(response.status, await response.text());

      const body = await response.text();
      return (body ? JSON.parse(body) : null) as T;
    },
    [getAccessToken],
  );

  return useMemo(
    () => ({
      list: () => request<PayrollBatch[]>('/payroll'),

      create: (amounts: Record<string, string>) =>
        request<PayrollBatch & { unpayable: UnpayableEmployee[] }>('/payroll', {
          method: 'POST',
          body: JSON.stringify({ amounts }),
        }),

      get: (id: string) => request<PayrollBatch>(`/payroll/${id}`),

      getCalls: (id: string) =>
        request<{ calls: UnsignedCall[]; itemIds: string[] }>(`/payroll/${id}/calls`, {
          method: 'POST',
        }),

      /**
       * Says that nothing was signed, so a run locked by getCalls can be
       * started again. Merchant-initiated on purpose — see the server.
       */
      abandon: (id: string) =>
        request<PayrollBatch>(`/payroll/${id}/abandon`, { method: 'POST' }),

      reportExecuted: (id: string, results: { itemId: string; txHash: string }[]) =>
        request<PayrollBatch>(`/payroll/${id}/executed`, {
          method: 'POST',
          body: JSON.stringify({ results }),
        }),
    }),
    [request],
  );
}
