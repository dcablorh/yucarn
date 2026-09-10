import { Buffer } from 'buffer';

if (typeof window !== 'undefined') {
  (window as any).Buffer = (window as any).Buffer || Buffer;
  (window as any).global = (window as any).global || window;
  (window as any).process = (window as any).process || { env: {} };

  // Guard against wallet extensions conflicting on window.ethereum definition
  try {
    let _eth = (window as any).ethereum;
    const desc = Object.getOwnPropertyDescriptor(window, 'ethereum');
    if (!desc || desc.configurable) {
      Object.defineProperty(window, 'ethereum', {
        configurable: true,
        enumerable: true,
        get: () => _eth,
        set: (val) => {
          _eth = val;
        }
      });
    }
  } catch (_) {}
}

if (typeof globalThis !== 'undefined') {
  (globalThis as any).Buffer = (globalThis as any).Buffer || Buffer;
  (globalThis as any).global = (globalThis as any).global || globalThis;
  (globalThis as any).process = (globalThis as any).process || { env: {} };
}
