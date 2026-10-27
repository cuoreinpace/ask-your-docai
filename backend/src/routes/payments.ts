import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/index.js';
import { query } from '../models/database.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { z } from 'zod';

const router = Router();

const authorizePaymentSchema = z.object({
  amountCents: z.number().int().positive(),
  currency: z.string().default('EUR'),
});

router.post('/authorization', authenticate, requireRole('PATIENT'), async (req, res, next) => {
  try {
    const { amountCents, currency } = authorizePaymentSchema.parse(req.body);
    const userId = (req as any).user.id;
    const caseId = req.query.caseId as string;

    if (!caseId) {
      res.status(400).json({ code: 'MISSING_CASE_ID', message: 'caseId query parameter is required' });
      return;
    }

    const caseResult = await query(
      `SELECT * FROM medical_cases WHERE id = $1 AND patient_id = $2`,
      [caseId, userId]
    );

    if (caseResult.rows.length === 0) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Case not found' });
      return;
    }

    const paymentId = `pay_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
    const merchantReference = `ord_${uuidv4().replace(/-/g, '').slice(0, 12)}`;

    await query(
      `INSERT INTO payments (id, case_id, provider_reference, amount_cents, currency, status, created_at)
       VALUES ($1, $2, $3, $4, $5, 'AUTHORIZED', $6)`,
      [paymentId, caseId, merchantReference, amountCents, currency, new Date().toISOString()]
    );

    res.status(201).json({
      paymentId,
      merchantReference,
      amountCents,
      currency,
      status: 'AUTHORIZED',
      clientSecret: `pi_${uuidv4().replace(/-/g, '').slice(0, 16)}`,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/webhooks/payment-provider', async (req, res, next) => {
  try {
    const { event, data } = req.body;

    if (event === 'payment.succeeded') {
      await query(
        `UPDATE payments SET status = 'SUCCEEDED', provider_reference = $1 WHERE id = $2`,
        [data.transactionId, data.paymentId]
      );

      await query(
        `UPDATE medical_cases SET status = 'PAYMENT_AUTHORIZED', version = version + 1 WHERE id = $1`,
        [data.caseId]
      );
    }

    if (event === 'payment.failed') {
      await query(
        `UPDATE payments SET status = 'FAILED' WHERE id = $1`,
        [data.paymentId]
      );
    }

    res.json({ received: true });
  } catch (err) {
    next(err);
  }
});

router.get('/:paymentId', authenticate, async (req, res, next) => {
  try {
    const { paymentId } = req.params;
    const userId = (req as any).user.id;

    const result = await query(
      `SELECT p.* FROM payments p
       JOIN medical_cases c ON p.case_id = c.id
       WHERE p.id = $1 AND c.patient_id = $2`,
      [paymentId, userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Payment not found' });
      return;
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

export { router as paymentRoutes };