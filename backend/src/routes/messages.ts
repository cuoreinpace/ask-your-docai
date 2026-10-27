import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { authenticate } from '../middleware/auth.js';
import { query } from '../models/database.js';

const router = Router();

router.post('/:caseId/messages', authenticate, async (req, res, next) => {
  try {
    const { caseId } = req.params;
    const userId = (req as any).user.id;
    const userRole = (req as any).user.role;
    const { content } = req.body;

    if (!content || content.trim().length === 0) {
      res.status(422).json({ code: 'EMPTY_MESSAGE', message: 'Message content cannot be empty' });
      return;
    }

    const caseResult = await query(
      `SELECT * FROM medical_cases WHERE id = $1`,
      [caseId]
    );

    if (caseResult.rows.length === 0) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Case not found' });
      return;
    }

    if (userRole === 'PHYSICIAN') {
      const assignment = await query(
        `SELECT 1 FROM case_assignments WHERE case_id = $1 AND physician_id = $2 AND ended_at IS NULL`,
        [caseId, userId]
      );
      if (assignment.rows.length === 0) {
        res.status(403).json({ code: 'FORBIDDEN', message: 'You are not assigned to this case' });
        return;
      }
    }

    const messageId = `msg_${uuidv4().replace(/-/g, '').slice(0, 12)}`;

    await query(
      `INSERT INTO clinical_messages (id, case_id, sender_id, sender_role, content, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [messageId, caseId, userId, userRole, content, new Date().toISOString()]
    );

    res.status(201).json({
      id: messageId,
      caseId,
      senderId: userId,
      senderRole: userRole,
      content,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:caseId/messages', authenticate, async (req, res, next) => {
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

    const messages = await query(
      `SELECT * FROM clinical_messages WHERE case_id = $1 ORDER BY created_at ASC`,
      [caseId]
    );

    res.json(messages.rows);
  } catch (err) {
    next(err);
  }
});

export { router as messageRoutes };