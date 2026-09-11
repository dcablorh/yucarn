'use client';

import { createContext, useContext } from 'react';
import type { Business } from './api';

interface BusinessContextValue {
  business: Business;
  setBusiness: (business: Business) => void;
}

const BusinessContext = createContext<BusinessContextValue | null>(null);

export const BusinessProvider = BusinessContext.Provider;

/**
 * The dashboard layout loads the business and renders nothing until it
 * exists, so every page below it can assume one is present.
 */
export function useBusiness(): Business {
  const value = useContext(BusinessContext);
  if (!value) {
    throw new Error('useBusiness must be used inside the dashboard layout');
  }
  return value.business;
}

/**
 * Lets a page that updates the business server-side push the new row into
 * context, so other pages do not keep rendering the stale one.
 */
export function useSetBusiness(): (business: Business) => void {
  const value = useContext(BusinessContext);
  if (!value) {
    throw new Error('useSetBusiness must be used inside the dashboard layout');
  }
  return value.setBusiness;
}
