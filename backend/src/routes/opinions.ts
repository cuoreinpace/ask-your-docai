import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/index.js';
import { query, transaction } from '../models/database.js';
import { authenticate, requireRole, requireStrongAuth } from '../middleware/auth.js';
import { z } from 'zod';

const router = Router();

const finalizeOpinionSchema = z.object({
  assessmentOfAiOutput: z.enum(['AGREE', 'PARTIALLY_AGREE', 'DISAGREE', 'INSUFFICIENT_INFORMATION', 'CANNOT_ASSESS']),
  clinicalAssessment: z.string().min(1),
  limitations: z.array(z.string()).optional(),
  recommendations: z.array(z.string()).optional(),
  requiresInPersonAssessment: z.boolean().default(false),
  physicianAssignedUrgency: z.enum(['EMERGENCY', 'URGENT', 'ROUTINE', 'UNDETERMINED']).default('ROUTINE'),
});

router.post('/cases/:caseId/opinions', authenticate, requireRole('PHYSICIAN'), async (req, res, next) => {
  try {
    const { caseId } = req.params;
    const physicianId = (req as any).user.id;
    const data = finalizeOpinionSchema.parse(req.body);

    const assignment = await query(
      `SELECT 1 FROM case_assignments WHERE case_id = $1 AND physician_id = $2 AND ended_at IS NULL`,
      [caseId, physicianId]
    );

    if (assignment.rows.length === 0) {
      res.status(403).json({ code: 'NOT_ASSIGNED', message: 'You are not assigned to this case' });
      return;
    }

    const caseResult = await query(
      `SELECT status FROM medical_cases WHERE id = $1`,
      [caseId]
    );

    if (caseResult.rows.length === 0) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Case not found' });
      return;
    }

    const opinionId = `opn_${uuidv4().replace(/-/g, '').slice(0, 12)}`;

    await transaction(async (client: any) => {
      await client.query(
        `INSERT INTO medical_opinions (id, case_id, physician_id, assessment_of_ai_output, clinical_assessment, limitations, recommendations, requires_in_person_assessment, physician_assigned_urgency, clinical_decision_source, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'HUMAN_PHYSICIAN', 'DRAFT', $10)`,
        [opinionId, caseId, physicianId, data.assessmentOfAiOutput, data.clinicalAssessment,
         data.limitations ?? [], data.recommendations ?? [], data.requiresInPersonAssessment,
         data.physicianAssignedUrgency, new Date().toISOString()]
      );

      await client.query(
        `UPDATE medical_cases SET status = 'OPINION_DRAFT', version = version + 1 WHERE id = $1`,
        [caseId]
      );
    });

    res.status(201).json({
      id: opinionId,
      caseId,
      physicianId,
      assessmentOfAiOutput: data.assessmentOfAiOutput,
      clinicalAssessment: data.clinicalAssessment,
      limitations: data.limitations ?? [],
      recommendations: data.recommendations ?? [],
      requiresInPersonAssessment: data.requiresInPersonAssessment,
      physicianAssignedUrgency: data.physicianAssignedUrgency,
      status: 'DRAFT',
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

router.put('/opinions/:opinionId', authenticate, requireRole('PHYSICIAN'), async (req, res, next) => {
  try {
    const { opinionId } = req.params;
    const physicianId = (req as any).user.id;
    const data = finalizeOpinionSchema.parse(req.body);

    const existing = await query(
      `SELECT * FROM medical_opinions WHERE id = $1 AND physician_id = $2`,
      [opinionId, physicianId]
    );

    if (existing.rows.length === 0) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Opinion not found or not owned by you' });
      return;
    }

    const opinion = existing.rows[0];
    if (opinion.status !== 'DRAFT') {
      res.status(409).json({ code: 'NOT_DRAFT', message: 'Only draft opinions can be updated' });
      return;
    }

    await query(
      `UPDATE medical_opinions SET assessment_of_ai_output = $1, clinical_assessment = $2, limitations = $3, recommendations = $4, requires_in_person_assessment = $5, physician_assigned_urgency = $6, finalized_at = $7 WHERE id = $8`,
      [data.assessmentOfAiOutput, data.clinicalAssessment, data.limitations ?? [],
       data.recommendations ?? [], data.requiresInPersonAssessment, data.physicianAssignedUrgency,
       new Date().toISOString(), opinionId]
    );

    res.json({ id: opinionId, status: 'DRAFT', updatedAt: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

router.post('/opinions/:opinionId/finalize', authenticate, requireRole('PHYSICIAN'), requireStrongAuth, async (req, res, next) => {
  try {
    const { opinionId } = req.params;
    const physicianId = (req as any).user.id;

    const existing = await query(
      `SELECT * FROM medical_opinions WHERE id = $1 AND physician_id = $2`,
      [opinionId, physicianId]
    );

    if (existing.rows.length === 0) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Opinion not found' });
      return;
    }

    const opinion = existing.rows[0];
    if (opinion.status !== 'DRAFT') {
      res.status(409).json({ code: 'NOT_DRAFT', message: 'Only draft opinions can be finalized' });
      return;
    }

    await query(
      `UPDATE medical_opinions SET status = 'FINALIZED', finalized_at = $1 WHERE id = $2`,
      [new Date().toISOString(), opinionId]
    );

    res.json({ id: opinionId, status: 'FINALIZED', finalizedAt: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

router.post('/opinions/:opinionId/sign', authenticate, requireRole('PHYSICIAN'), requireStrongAuth, async (req, res, next) => {
  try {
    const { opinionId } = req.params;
    const physicianId = (req as any).user.id;

    const existing = await query(
      `SELECT * FROM medical_opinions WHERE id = $1 AND physician_id = $2`,
      [opinionId, physicianId]
    );

    if (existing.rows.length === 0) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Opinion not found' });
      return;
    }

    const opinion = existing.rows[0];
    if (opinion.status !== 'FINALIZED') {
      res.status(409).json({ code: 'NOT_FINALIZED', message: 'Only finalized opinions can be signed' });
      return;
    }

    const signatureArtifactId = `sig_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
    const documentHash = `sha256:${uuidv4().replace(/-/g, '')}`;

    await transaction(async (client: any) => {
      await client.query(
        `INSERT INTO signature_artifacts (id, opinion_version_id, document_hash, signature_type, signed_at, qtsp_transaction_id)
         VALUES ($1, $2, $3, 'PAdES_QUALIFIED', $4, $5)`,
        [signatureArtifactId, opinionId, documentHash, new Date().toISOString(), null]
      );

      await client.query(
        `UPDATE medical_opinions SET status = 'SIGNED', signed_at = $1 WHERE id = $2`,
        [new Date().toISOString(), opinionId]
      );

      await client.query(
        `UPDATE medical_cases SET status = 'SIGNED', signed_at = $1, version = version + 1 WHERE id = $2`,
        [new Date().toISOString(), opinion.case_id]
      );
    });

    res.json({
      id: opinionId,
      status: 'SIGNED',
      signedAt: new Date().toISOString(),
      signatureArtifactId,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/cases/:caseId/opinion', authenticate, async (req, res, next) => {
  try {
    const { caseId } = req.params;
    const userId = (req as any).user.id;
    const userRole = (req as any).user.role;

    const caseResult = await query(
      `SELECT * FROM medical_cases WHERE id = $1`,
      [caseId]
    );

    if (caseResult.rows.length === 0) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Case not found' });
      return;
    }

    if (userRole !== 'ADMIN' && userRole !== 'PRIVACY') {
      const caseData = caseResult.rows[0];
      if (caseData.patient_id !== userId) {
        const assignment = await query(
          `SELECT 1 FROM case_assignments WHERE case_id = $1 AND physician_id = $2 AND ended_at IS NULL`,
          [caseId, userId]
        );
        if (assignment.rows.length === 0) {
          res.status(403).json({ code: 'FORBIDDEN', message: 'You do not have access to this case' });
          return;
        }
      }
    }

    const opinion = await query(
      `SELECT * FROM medical_opinions WHERE case_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [caseId]
    );

    res.json(opinion.rows[0] ?? null);
  } catch (err) {
    next(err);
  }
});

router.get('/:opinionId/document', authenticate, async (req, res, next) => {
  try {
    const { opinionId } = req.params;
    const userId = (req as any).user.id;
    const userRole = (req as any).user.role;

    const opinion = await query(
      `SELECT * FROM medical_opinions WHERE id = $1`,
      [opinionId]
    );

    if (opinion.rows.length === 0) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Opinion not found' });
      return;
    }

    const opinionData = opinion.rows[0];

    if (userRole !== 'ADMIN' && userRole !== 'PRIVACY') {
      const caseResult = await query(
        `SELECT * FROM medical_cases WHERE id = $1`,
        [opinionData.case_id]
      );
      const caseData = caseResult.rows[0];

      if (caseData.patient_id !== userId) {
        const assignment = await query(
          `SELECT 1 FROM case_assignments WHERE case_id = $1 AND physician_id = $2 AND ended_at IS NULL`,
          [opinionData.case_id, userId]
        );
        if (assignment.rows.length === 0) {
          res.status(403).json({ code: 'FORBIDDEN', message: 'You do not have access to this case' });
          return;
        }
      }
    }

    res.json({
      opinionId: opinionData.id,
      caseId: opinionData.case_id,
      status: opinionData.status,
      documentUrl: `/v1/opinions/${opinionId}/document.pdf`,
      signedAt: opinionData.signed_at,
    });
  } catch (err) {
    next(err);
  }
});

export { router as opinionRoutes };