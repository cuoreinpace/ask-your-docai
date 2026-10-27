import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import pinoHttp from 'pino-http';
import { config } from './config/index.js';
import { authRoutes } from './routes/auth.js';
import { caseRoutes } from './routes/cases.js';
import { opinionRoutes } from './routes/opinions.js';
import { messageRoutes } from './routes/messages.js';
import { uploadRoutes } from './routes/upload.js';
import { paymentRoutes } from './routes/payments.js';
import { auditMiddleware } from './middleware/audit.js';
import { errorHandler } from './middleware/errorHandler.js';
import { rateLimiter } from './middleware/rateLimiter.js';

const app = express();

app.use(helmet());
app.use(cors({
  origin: config.frontendUrl,
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(pinoHttp());
app.use(rateLimiter);
app.use(auditMiddleware);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/v1/auth', authRoutes);
app.use('/v1/cases', caseRoutes);
app.use('/v1/clinical', opinionRoutes);
app.use('/v1/cases', messageRoutes);
app.use('/v1/cases', uploadRoutes);
app.use('/v1/payments', paymentRoutes);

app.use(errorHandler);

const PORT = config.port;
app.listen(PORT, () => {
  console.log(`ask-your-docai backend running on port ${PORT}`);
});

export { app };