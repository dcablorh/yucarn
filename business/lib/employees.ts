'use client';

import { usePrivy } from '@privy-io/react-auth';
import { useCallback, useMemo } from 'react';
import { ApiError } from './api';
import { apiUrl } from './api-url';

const API_URL = apiUrl();

export interface Employee {
  id: string;
  name: string;
  walletAddress: string;
  subname: string | null;
  prefChain: string;
  prefAsset: string;
  createdAt: string;
}

export interface EmployeeInput {
  name: string;
  walletAddress: string;
  prefChain: string;
  prefAsset: string;
}

export function useEmployeesApi() {
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

      // DELETE answers 204 with no body; parsing that throws.
      const body = await response.text();
      return (body ? JSON.parse(body) : null) as T;
    },
    [getAccessToken],
  );

  return useMemo(
    () => ({
      list: () => request<Employee[]>('/employees'),

      create: (input: EmployeeInput) =>
        request<Employee>('/employees', {
          method: 'POST',
          body: JSON.stringify(input),
        }),

      update: (id: string, input: EmployeeInput) =>
        request<Employee>(`/employees/${id}`, {
          method: 'PATCH',
          body: JSON.stringify(input),
        }),

      remove: (id: string) =>
        request<null>(`/employees/${id}`, { method: 'DELETE' }),
    }),
    [request],
  );
}
