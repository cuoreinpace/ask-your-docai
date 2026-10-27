import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { query } from '../models/database.js';
import { authenticate } from '../middleware/auth.js';
import { z } from 'zod';

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['PATIENT', 'PHYSICIAN']),
  birthDate: z.string().optional(),
  country: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

router.post('/register', async (req, res, next) => {
  try {
    const { email, password, role, birthDate, country } = registerSchema.parse(req.body);

    const existing = await query(
      `SELECT id FROM users WHERE email = $1`,
      [email]
    );
    if (existing.rows.length > 0) {
      res.status(409).json({ code: 'EMAIL_EXISTS', message: 'An account with this email already exists' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = `usr_${uuidv4().replace(/-/g, '').slice(0, 12)}`;

    await query(
      `INSERT INTO users (id, email, password_hash, role, email_verified, identity_level, created_at)
       VALUES ($1, $2, $3, $4, false, 'BASIC', $5)`,
      [userId, email, passwordHash, role, new Date().toISOString()]
    );

    if (role === 'PATIENT' && birthDate && country) {
      await query(
        `INSERT INTO patient_profiles (user_id, birth_date, country, locale)
         VALUES ($1, $2, $3, $4)`,
        [userId, birthDate, country, 'it-IT']
      );
    }

    const token = jwt.sign(
      { sub: userId, role, identityLevel: 'BASIC' },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn }
    );

    res.status(201).json({
      id: userId,
      role,
      email,
      emailVerified: false,
      identityLevel: 'BASIC',
      token,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const result = await query(
      `SELECT id, email, password_hash, role, email_verified, identity_level FROM users WHERE email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      res.status(401).json({ code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' });
      return;
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      res.status(401).json({ code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' });
      return;
    }

    const token = jwt.sign(
      { sub: user.id, role: user.role, identityLevel: user.identity_level },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn }
    );

    res.json({
      id: user.id,
      role: user.role,
      email: user.email,
      emailVerified: user.email_verified,
      identityLevel: user.identity_level,
      token,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/me', authenticate, async (req, res) => {
  const result = await query(
    `SELECT id, email, role, email_verified, identity_level, created_at FROM users WHERE id = $1`,
    [(req as any).user.id]
  );

  if (result.rows.length === 0) {
    res.status(404).json({ code: 'NOT_FOUND', message: 'User not found' });
    return;
  }

  const user = result.rows[0];
  res.json({
    id: user.id,
    role: user.role,
    email: user.email,
    emailVerified: user.email_verified,
    identityLevel: user.identity_level,
    createdAt: user.created_at,
  });
});

export { router as authRoutes };