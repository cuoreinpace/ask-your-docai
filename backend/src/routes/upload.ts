import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/index.js';
import { query } from '../models/database.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import multer from 'multer';
import crypto from 'crypto';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.uploadMaxSize },
  fileFilter: (_req, file, cb) => {
    if (config.allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
  },
});

router.post('/:caseId/uploads', authenticate, requireRole('PATIENT'), async (req, res, next) => {
  try {
    const { caseId } = req.params;
    const userId = (req as any).user.id;

    const caseResult = await query(
      `SELECT * FROM medical_cases WHERE id = $1 AND patient_id = $2`,
      [caseId, userId]
    );

    if (caseResult.rows.length === 0) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Case not found' });
      return;
    }

    res.json({
      uploadId: `upl_${uuidv4().replace(/-/g, '').slice(0, 12)}`,
      uploadUrl: `https://storage.example.it/upload/${caseId}`,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      maxSizeBytes: config.uploadMaxSize,
      status: 'AWAITING_UPLOAD',
    });
  } catch (err) {
    next(err);
  }
});

router.post('/:caseId/uploads/:uploadId/complete', authenticate, requireRole('PATIENT'), upload.single('file'), async (req, res, next) => {
  try {
    const { caseId, uploadId } = req.params;
    const userId = (req as any).user.id;

    if (!req.file) {
      res.status(400).json({ code: 'NO_FILE', message: 'No file uploaded' });
      return;
    }

    const sha256 = crypto.createHash('sha256').update(req.file.buffer).digest('hex');

    await query(
      `INSERT INTO case_sources (id, case_id, category, media_type, sha256, provenance_verified, malware_scan_status, uploaded_at, object_storage_key)
       VALUES ($1, $2, 'AI_CONVERSATION', $3, $4, false, 'PENDING', $5, $6)`,
      [uuidv4(), caseId, req.file.mimetype, sha256, new Date().toISOString(), `quarantine/${caseId}/${uploadId}`]
    );

    res.json({
      uploadId,
      caseId,
      filename: req.file.originalname,
      mediaType: req.file.mimetype,
      sizeBytes: req.file.size,
      sha256,
      malwareScanStatus: 'PENDING',
      uploadedAt: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

export { router as uploadRoutes };