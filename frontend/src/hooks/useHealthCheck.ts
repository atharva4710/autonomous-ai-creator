import { useState, useEffect, useCallback, useRef } from 'react';
import { checkHealth } from '../services/api';

export type ConnectionStatus = 'checking' | 'connected' | 'offline';

export function useHealthCheck(pollingIntervalMs: number = 10000) {
  const [status, setStatus] = useState<ConnectionStatus>('checking');
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const check = useCallback(async () => {
    setIsChecking(true);
    setStatus('checking');
    try {
      const data = await checkHealth();
      if (data && data.status === 'ok') {
        setStatus('connected');
      } else {
        setStatus('offline');
      }
    } catch (error) {
      console.error('Health check failed:', error);
      setStatus('offline');
    } finally {
      setIsChecking(false);
      setLastChecked(new Date());
    }
  }, []);

  // Initial check on mount
  useEffect(() => {
    check();
  }, [check]);

  // Setup periodic polling
  useEffect(() => {
    pollingRef.current = setInterval(() => {
      // Periodic background checks:
      // We don't trigger the global 'checking' state (which shows spinners)
      // to keep the dashboard visual state stable, but we update status silently.
      checkHealth()
        .then((data) => {
          if (data && data.status === 'ok') {
            setStatus('connected');
          } else {
            setStatus('offline');
          }
        })
        .catch(() => {
          setStatus('offline');
        })
        .finally(() => {
          setLastChecked(new Date());
        });
    }, pollingIntervalMs);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [pollingIntervalMs]);

  return {
    status,
    lastChecked,
    isChecking,
    check,
  };
}
