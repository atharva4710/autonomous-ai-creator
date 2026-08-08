import { Request, Response, NextFunction } from 'express';

/**
 * Middleware to handle unmatched routes (404 errors)
 */
export const notFound = (req: Request, res: Response, next: NextFunction): void => {
  res.status(404).json({
    error: {
      message: `Cannot ${req.method} ${req.originalUrl} - Route not found`,
      status: 404,
    },
  });
};
