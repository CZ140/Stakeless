import { Router, type IRouter } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import { register, verifyEmail } from '../services/authService.js';

export const authRouter: IRouter = Router();

const registerSchema = z.object({
  email: z.string().email('Must be a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

// POST /api/auth/register
authRouter.post('/register', authLimiter, validate(registerSchema), async (req, res) => {
  try {
    await register(req.body.email as string, req.body.password as string);
    res.status(201).json({ message: 'Registration successful. Check your email to verify your account.' });
  } catch (err: unknown) {
    if (err instanceof Error && (err as NodeJS.ErrnoException & { code?: string }).code === 'DUPLICATE_EMAIL') {
      // Return same 201 to avoid email enumeration — attacker cannot distinguish new vs existing email
      res.status(201).json({ message: 'Registration successful. Check your email to verify your account.' });
      return;
    }
    console.error('[auth] register error:', err);
    res.status(500).json({ error: 'An unexpected error occurred' });
  }
});

// GET /api/auth/verify-email?token=<raw>
authRouter.get('/verify-email', async (req, res) => {
  const token = req.query['token'];
  if (typeof token !== 'string' || !token) {
    res.status(400).json({ error: 'Missing verification token' });
    return;
  }
  try {
    await verifyEmail(token);
    // Redirect to frontend login with success message
    res.redirect(`${process.env['FRONTEND_URL'] ?? 'http://localhost:5173'}/login?verified=true`);
  } catch (err: unknown) {
    if (err instanceof Error && (err as NodeJS.ErrnoException & { code?: string }).code === 'INVALID_TOKEN') {
      res.status(400).json({ error: 'Invalid or expired verification link' });
      return;
    }
    console.error('[auth] verify-email error:', err);
    res.status(500).json({ error: 'An unexpected error occurred' });
  }
});
