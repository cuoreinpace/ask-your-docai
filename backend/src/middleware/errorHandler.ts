import { Request, Response, NextFunction } from 'express';

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  console.error(err);

  if (res.headersSent) {
    return;
  }

  const statusCode = (err as any).statusCode ?? 500;
  const code = (err as any).code ?? 'INTERNAL_ERROR';
  const message = (err as any).message ?? 'Internal server error';

  res.status(statusCode).json({
    code,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}