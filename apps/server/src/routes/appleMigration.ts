import type { FastifyPluginAsync } from 'fastify';
import { appleMigrationCodeSchema } from '@sketch-catch/shared';
import { verifyAppleToken } from '../auth/apple.js';
import { authenticate } from '../middleware/authenticate.js';
import { AppleMigrationError, issueAppleMigrationCode } from '../services/appleMigration.service.js';
import { logger } from '../lib/logger.js';

export const appleMigrationRoutes: FastifyPluginAsync = async app => {
  app.post('/me/apple-migration-code', { preHandler: authenticate }, async (request, reply) => {
    const parsed = appleMigrationCodeSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'INVALID_INPUT' });
    let claims: Awaited<ReturnType<typeof verifyAppleToken>>;
    try {
      claims = await verifyAppleToken(parsed.data.identityToken);
    } catch {
      return reply.status(403).send({ error: 'MIGRATION_PROOF_FAILED' });
    }
    try {
      const result = await issueAppleMigrationCode(request.userId!, claims);
      return reply.header('Cache-Control', 'no-store').send(result);
    } catch (error) {
      if (error instanceof AppleMigrationError) return reply.status(error.statusCode).send({ error: error.code });
      logger.error({ error }, 'Apple migration code issuance failed');
      return reply.status(503).send({ error: 'MIGRATION_UNAVAILABLE' });
    }
  });
};
