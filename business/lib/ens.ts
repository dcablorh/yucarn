'use client';

import { usePrivy } from '@privy-io/react-auth';
import { useCallback, useMemo } from 'react';
import { ApiError } from './api';
import { apiUrl } from './api-url';

const API_URL = apiUrl();

export type EnsStatus = 'DRAFT' | 'REGISTRY_DEPLOYED' | 'COMMITTED' | 'REGISTERED' | 'FAILED';

/** An unsigned call the server prepared. The browser is what signs it. */
export interface UnsignedCall {
  to: string;
  data: string;
  value: string;
  chainId: number;
}

export interface Registration {
  id: string;
  label: string;
  name: string;
  status: EnsStatus;
  ownerAddress: string;
  subregistry: string | null;
  priceBase: string;
  readyAtSecs: number | null;
  expiresAtSecs: number | null;
  deployTxHash: string | null;
  commitTxHash: string | null;
  registerTxHash: string | null;
  recordsTxHash: string | null;
}

export interface Availability {
  label: string;
  available: boolean;
  priceBase: string | null;
}

type WithCalls = Registration & { calls: UnsignedCall[] };

export function useEnsApi() {
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
      // Read the body once, as text. GET /ens/registrations/me answers a
      // merchant with no registration by returning null, and Nest's
      // express adapter sends that as a zero-length 200 — response.json()
      // on that throws "Unexpected end of JSON input", which is what every
      // merchant's first visit to /dashboard/identity used to render above
      // the claim form. An empty body is the null, not a parse failure.
      const body = await response.text();
      if (!response.ok) throw new ApiError(response.status, body);
      return (body ? JSON.parse(body) : null) as T;
    },
    [getAccessToken],
  );

  return useMemo(
    () => ({
      checkAvailability: (label: string) =>
        request<Availability>(`/ens/availability?label=${encodeURIComponent(label)}`),

      createRegistration: (label: string) =>
        request<WithCalls>('/ens/registrations', {
          method: 'POST',
          body: JSON.stringify({ label }),
        }),

      getRegistration: () => request<Registration | null>('/ens/registrations/me'),

      getDeployCalls: () =>
        request<WithCalls>('/ens/registrations/me/deploy-calls', { method: 'POST' }),

      recordDeployed: (txHash: string) =>
        request<WithCalls>('/ens/registrations/me/deployed', {
          method: 'POST',
          body: JSON.stringify({ txHash }),
        }),

      recordCommitted: (txHash: string) =>
        request<Registration>('/ens/registrations/me/committed', {
          method: 'POST',
          body: JSON.stringify({ txHash }),
        }),

      getRegisterCalls: () =>
        request<WithCalls>('/ens/registrations/me/register-calls', { method: 'POST' }),

      recordRegistered: (txHash: string, recordsTxHash?: string) =>
        request<Registration>('/ens/registrations/me/registered', {
          method: 'POST',
          body: JSON.stringify({ txHash, recordsTxHash }),
        }),
    }),
    [request],
  );
}
