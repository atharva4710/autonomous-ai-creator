import { AppError } from './errors';

export interface RetryOptions {
  maxAttempts?: number;
  delayMs?: number;
  backoffFactor?: number;
}

/**
 * Retries an asynchronous operation with exponential backoff and retryable error verification.
 */
export async function retry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {},
  onRetry?: (attempt: number, error: any) => void
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 3;
  let delay = options.delayMs ?? 1000;
  const factor = options.backoffFactor ?? 2;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (err: any) {
      // Determine if error is retryable
      const isRetryable = err instanceof AppError ? err.retryable : true;

      if (attempt === maxAttempts || !isRetryable) {
        throw err;
      }

      if (onRetry) {
        onRetry(attempt, err);
      }

      await new Promise((resolve) => setTimeout(resolve, delay));
      delay *= factor;
    }
  }
  throw new AppError('RETRY_FAILED', 'Operation failed after retries');
}

/**
 * Wraps an operation with a timeout constraint.
 */
export function withTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number,
  operationName = 'Operation'
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new AppError('TIMEOUT', `${operationName} timed out after ${timeoutMs}ms`, true, 504));
    }, timeoutMs);

    operation()
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}
