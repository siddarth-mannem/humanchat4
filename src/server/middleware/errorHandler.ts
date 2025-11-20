import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { ApiError } from '../errors/ApiError.js';

export const errorHandler = (err: Error, _req: Request, res: Response, _next: NextFunction): void => {
  if (err instanceof ApiError) {
    res.status(err.status).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details
      }
    });
    return;
  }

  const isZodError = (candidate: unknown): candidate is ZodError => {
    if (candidate instanceof ZodError) {
      return true;
    }
    return Boolean(
      candidate &&
        typeof candidate === 'object' &&
        'issues' in candidate &&
        Array.isArray((candidate as { issues?: unknown }).issues)
    );
  };

  if (isZodError(err)) {
    res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_REQUEST',
        message: 'Request validation failed',
        details: err.issues
      }
    });
    return;
  }

  console.error('[UnhandledError]', err);
  res.status(500).json({
    success: false,
    error: {
      code: 'SERVER_ERROR',
      message: 'Unexpected server error'
    }
  });
};
