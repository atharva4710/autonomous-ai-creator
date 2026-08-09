import { Request, Response, NextFunction } from 'express';
import { config } from '../config';

export interface CustomError extends Error {
  status?: number;
  statusCode?: number;
}

/**
 * Centralized error handler middleware
 */
export const errorHandler = (
  err: CustomError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  // Log error stack locally (in development/test environments)
  if (config.nodeEnv !== 'test') {
    console.error(`[Error] ${status} - ${message}`);
    if (err.stack) {
      console.error(err.stack);
    }
  }

  const code = (err as any).code || 'INTERNAL_SERVER_ERROR';
  const retryable = (err as any).retryable !== undefined ? (err as any).retryable : false;

  res.status(status).json({
    error: {
      code,
      message,
      retryable,
      status,
    },
  });
};
