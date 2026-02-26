import { Logger, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

const getCookieValue = (cookieHeader: unknown, key: string): string | null => {
  if (typeof cookieHeader !== 'string' || cookieHeader.length === 0) return null;

  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const [rawName, ...rest] = part.trim().split('=');
    if (!rawName) continue;
    if (rawName !== key) continue;
    const rawValue = rest.join('=');
    if (!rawValue) return null;
    try {
      return decodeURIComponent(rawValue);
    } catch {
      return rawValue;
    }
  }

  return null;
};

@WebSocketGateway({
  namespace: '/notifications',
  cors: {
    origin: true,
    credentials: true,
  },
})
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(NotificationsGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(private jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      const cookieToken = getCookieValue(client.handshake.headers?.cookie, 'access_token');
      const authToken = client.handshake.auth?.token as string;
      const bearerToken = client.handshake.headers?.authorization?.split(' ')[1] as string;

      const token = cookieToken || authToken || bearerToken;

      if (!token) {
        this.logger.debug(`Client ${client.id} connected without token, disconnecting`);
        client.disconnect();
        return;
      }

      const payload = await this.jwtService.verifyAsync(token);
      const userId = payload.sub;

      if (!userId) {
        this.logger.debug(`Client ${client.id} payload has no sub, disconnecting`);
        client.disconnect();
        return;
      }

      client.data.userId = userId;
      await client.join(userId);

      this.logger.debug(`Client ${client.id} (user ${userId}) connected`);
    } catch (error: any) {
      this.logger.debug(`Client ${client.id} connection error: ${error.message}, disconnecting`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Client ${client.id} disconnected`);
  }

  /**
   * Send a notification to all connected sockets of a user.
   */
  sendToUser(userId: string, notification: any) {
    this.logger.debug(`Sending notification to user ${userId}`);
    this.server.to(userId).emit('notification', notification);
  }

  /**
   * Notify user that notifications were read (sync between tabs).
   */
  sendReadStatusToUser(userId: string, data: { id?: string; all: boolean }) {
    this.logger.debug(`Sending read status sync to user ${userId}`);
    this.server.to(userId).emit('notification_read', data);
  }
}
