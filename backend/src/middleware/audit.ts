import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/index.js';
import { pool } from '../models/database.js';

export function auditMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const requestId = uuidv4();
  (req as any).requestId = requestId;

  res.on('finish', async () => {
    if (!config.auditLogEnabled) return;

    const user = (req as any).user;
    const actorId = user?.id ?? 'anonymous';
    const actorRole = user?.role ?? 'ANONYMOUS';

    const action = `${req.method} ${req.route?.path ?? req.path}`;
    const resourceType = 'HTTP_REQUEST';
    const resourceId = (req.params as any)?.id ?? null;
    const caseId = (req.params as any)?.caseId ?? (req.body as any)?.caseId ?? null;

    try {
      await pool.query(
        `INSERT INTO audit_events (id, actor_id, actor_role, action, resource_type, resource_id, case_id, authorization_basis, request_id, ip_hash, success, occurred_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          uuidv4(),
          actorId,
          actorRole,
          action,
          resourceType,
          resourceId,
          caseId,
          'AUTH_TOKEN',
          requestId,
          null,
          res.statusCode < 400,
          new Date().toISOString(),
        ]
      );
    } catch {
      // Audit failures must not break the request
    }
  });

  next();
}