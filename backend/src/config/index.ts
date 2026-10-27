export const config = {
  port: parseInt(process.env.PORT ?? '3001', 10),
  databaseUrl: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/ask_docai',
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  jwtSecret: process.env.JWT_SECRET ?? 'change-me-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '8h',
  uploadMaxSize: parseInt(process.env.UPLOAD_MAX_SIZE ?? '10485760', 10),
  allowedMimeTypes: [
    'application/pdf',
    'text/plain',
    'image/png',
    'image/jpeg',
    'image/webp',
  ],
  auditLogEnabled: process.env.AUDIT_LOG_ENABLED !== 'false',
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  qtspEnabled: process.env.QTSP_ENABLED === 'true',
  pspEnabled: process.env.PSP_ENABLED === 'true',
} as const;