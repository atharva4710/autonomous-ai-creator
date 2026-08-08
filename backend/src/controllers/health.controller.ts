import { Request, Response } from 'express';

/**
 * Health check endpoint handler
 * Returns HTTP 200 with JSON status: 'ok'
 */
export const getHealth = (req: Request, res: Response): void => {
  res.status(200).json({ status: 'ok' });
};
