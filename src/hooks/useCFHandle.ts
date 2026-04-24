import { useState, useEffect } from 'react';

const DEFAULT_HANDLE = 'tourist';

/**
 * Hook to manage the global CF Handle.
 * Resolution order:
 * 1. localStorage ('cf_handle')
 * 2. process.env.NEXT_PUBLIC_CF_HANDLE
 * 3. Fallback (e.g. 'tourist')
 *
 * If the fallback is triggered, it indicates the user hasn't set one up.
 */
export function useCFHandle() {
  const [handle, setHandle] = useState<string>('');
  const [isReady, setIsReady] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);

  useEffect(() => {
    // 1. Check local storage
    const stored = localStorage.getItem('cf_handle');
    if (stored) {
      setHandle(stored);
      setIsReady(true);
      return;
    }

    // 2. Check ENV
    const envHandle = process.env.NEXT_PUBLIC_CF_HANDLE;
    if (envHandle) {
      setHandle(envHandle);
      setIsReady(true);
      return;
    }

    // 3. Fallback & flag for setup
    setHandle(DEFAULT_HANDLE);
    setNeedsSetup(true);
    setIsReady(true);
  }, []);

  const updateHandle = (newHandle: string) => {
    localStorage.setItem('cf_handle', newHandle);
    setHandle(newHandle);
    setNeedsSetup(false);
  };

  return { handle, isReady, needsSetup, updateHandle };
}
