import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/index.js';
import { query, transaction } from '../models/database.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { z } from 'zod';

const router = Router();

const createCaseSchema = z.object({
  serviceCode: z.string().default('AI_CONVERSATION_MEDICAL_REVIEW'),
  patientSummary: z.string().max(10000),
  source: z.object({
    declaredProvider: z.string().max(100).optional(),
    sourceType: z.enum(['USER_UPLOAD', 'USER_PASTED_TEXT']).optional(),
    provenanceVerified: z.boolean().optional(),
  }).optional(),
  serviceScopeAcknowledged: z.boolean().default(false),
});

router.post('/', authenticate, requireRole('PATIENT'), async (req, res, next) => {
  try {
    const { serviceCode, patientSummary, source, serviceScopeAcknowledged } = createCaseSchema.parse(req.body);
    const userId = (req as any).user.id;

    if (!serviceScopeAcknowledged) {
      res.status(422).json({ code: 'SCOPE_NOT_ACKNOWLEDGED', message: 'You must acknowledge the service scope before submitting' });
      return;
    }

    const caseId = `case_${uuidv4().replace(/-/g, '').slice(0, 12)}`;

    await transaction(async (client: any) => {
      await client.query(
        `INSERT INTO medical_cases (id, patient_id, service_code, status, patient_summary, version, created_at)
         VALUES ($1, $2, $3, 'DRAFT', $4, 1, $5)`,
        [caseId, userId, serviceCode, patientSummary, new Date().toISOString()]
      );

      if (source) {
        await client.query(
          `INSERT INTO case_sources (id, case_id, category, declared_provider, source_type, provenance_verified, uploaded_at)
           VALUES ($1, $2, 'AI_CONVERSATION', $3, $4, $5, $6)`,
          [uuidv4(), caseId, source.declaredProvider ?? 'unknown', source.sourceType ?? 'USER_PASTED_TEXT', source.provenanceVerified ?? false, new Date().toISOString()]
        );
      }
    });

    res.status(201).json({
      id: caseId,
      status: 'DRAFT',
      serviceCode,
      version: 1,
      createdAt: new Date().toISOString(),
      requiredSteps: ['IDENTITY', 'SOURCE_UPLOAD', 'SERVICE_ACKNOWLEDGEMENTS', 'PAYMENT_AUTHORIZATION'],
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.id;
    const userRole = (req as any).user.role;

    const result = await query(
      `SELECT * FROM medical_cases WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Case not found' });
      return;
    }

    const caseData = result.rows[0];

    if (userRole !== 'ADMIN' && userRole !== 'PRIVACY' && caseData.patient_id !== userId) {
      const assignment = await query(
        `SELECT 1 FROM case_assignments WHERE case_id = $1 AND physician_id = $2 AND ended_at IS NULL`,
        [id, userId]
      );
      if (assignment.rows.length === 0) {
        res.status(403).json({ code: 'FORBIDDEN', message: 'You do not have access to this case' });
        return;
      }
    }

    res.json(caseData);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/submit', authenticate, requireRole('PATIENT'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.id;

    const result = await query(
      `SELECT * FROM medical_cases WHERE id = $1 AND patient_id = $2`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Case not found' });
      return;
    }

    const caseData = result.rows[0];
    if (caseData.status !== 'DRAFT') {
      res.status(409).json({ code: 'INVALID_STATUS', message: `Case is in ${caseData.status} state and cannot be submitted` });
      return;
    }

    await query(
      `UPDATE medical_cases SET status = 'SUBMITTED', submitted_at = $1, version = version + 1 WHERE id = $2`,
      [new Date().toISOString(), id]
    );

    res.json({ id, status: 'SUBMITTED', submittedAt: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/upload', authenticate, requireRole('PATIENT'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.id;

    const result = await query(
      `SELECT * FROM medical_cases WHERE id = $1 AND patient_id = $2`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Case not found' });
      return;
    }

    const uploadId = `upl_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    res.status(201).json({
      uploadId,
      uploadUrl: `${config.frontendUrl}/upload/${uploadId}`,
      expiresAt,
      maxSizeBytes: config.uploadMaxSize,
      status: 'AWAITING_UPLOAD',
    });
  } catch (err) {
    next(err);
  }
});

export { router as caseRoutes };