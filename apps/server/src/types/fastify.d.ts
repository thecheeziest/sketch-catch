import 'fastify';
import type { Server } from 'socket.io';
import type { ClientEvents, ServerEvents } from '@sketch-catch/shared';

declare module 'fastify' {
  interface FastifyRequest {
    userId?: string;
  }
  interface FastifyInstance {
    io: Server<ClientEvents, ServerEvents>;
  }
}
