import { Logger, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  namespace: '/notifications',
  cors: {
    origin: '*',
  },
})
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(NotificationsGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(private jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      // Get token from handshake auth or headers
      const token =
        (client.handshake.auth?.token as string) ||
        (client.handshake.headers?.authorization?.split(' ')[1] as string);

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
}
