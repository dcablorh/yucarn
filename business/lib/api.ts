'use client';

import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useCallback } from 'react';
import { apiUrl } from './api-url';

const API_URL = apiUrl();

export type InvoiceStatus =
  | 'PENDING' | 'PROCESSING' | 'PAID' | 'EXPIRED' | 'UNDERPAID' | 'FAILED';

export interface Business {
  id: string;
  privyUserId: string;
  walletAddress: string;
  name: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Invoice {
  id: string;
  amountBase: string;   // BigInt serialized as a string
  payableBase: string;
  recipient: string;
  destChain: string;
  asset: string;
  status: InvoiceStatus;
  description: string | null;
  sourceTxHash: string | null;
  destTxHash: string | null;
  paidAt: string | null;
  expiresAt: string;
  createdAt: string;
}

/**
 * Carries the HTTP status so callers can branch on it. The dashboard layout
 * needs to tell "this merchant has no Business row yet" (401 from
 * PrivyAuthGuard) apart from "the API is down", because those two cases
 * differ by whether it is safe to POST /auth/register.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: string,
  ) {
    super(`${status}: ${body}`);
    this.name = 'ApiError';
  }
}

export function useApi() {
  const { getAccessToken } = usePrivy();
  const { wallets } = useWallets();

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

      if (!response.ok) {
        const body = await response.text();
        throw new ApiError(response.status, body);
      }
      return response.json() as Promise<T>;
    },
    [getAccessToken],
  );

  const walletAddress = wallets[0]?.address;

  /** Idempotent; call after login so the server has a Business row. */
  const registerBusiness = useCallback(
    (name?: string) =>
      request<Business>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ walletAddress, name }),
      }),
    [request, walletAddress],
  );

  const listInvoices = useCallback(() => request<Invoice[]>('/invoices'), [request]);

  const createInvoice = useCallback(
    (amount: string, description?: string) =>
      request<Invoice>('/invoices', {
        method: 'POST',
        body: JSON.stringify({ amount, description }),
      }),
    [request],
  );

  const getInvoice = useCallback(
    (id: string) => request<Invoice>(`/invoices/${id}`),
    [request],
  );

  const getMe = useCallback(() => request<Business>('/auth/me'), [request]);

  return { registerBusiness, getMe, listInvoices, createInvoice, getInvoice };
}
