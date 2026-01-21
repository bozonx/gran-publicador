import { Logger, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { SttService } from './stt.service.js';
import { PassThrough } from 'node:stream';

@WebSocketGateway({
  namespace: '/stt',
  cors: {
    origin: '*',
  },
})
export class SttGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(SttGateway.name);

  @WebSocketServer()
  server!: Server;

  // Track active streams per socket ID
  private activeStreams = new Map<string, { stream: PassThrough; promise: Promise<any> }>();

  constructor(
    private jwtService: JwtService,
    private sttService: SttService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token =
        (client.handshake.auth?.token as string) ||
        (client.handshake.headers?.authorization?.split(' ')[1] as string);

      if (!token) {
        this.logger.debug(`Client ${client.id} connected to STT without token, disconnecting`);
        client.disconnect();
        return;
      }

      const payload = await this.jwtService.verifyAsync(token);
      client.data.userId = payload.sub;

      this.logger.debug(`Client ${client.id} (user ${payload.sub}) connected to STT`);
    } catch (error: any) {
      this.logger.debug(`Client ${client.id} STT connection error: ${error.message}, disconnecting`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Client ${client.id} disconnected from STT`);
    this.cleanupStream(client.id, 'disconnect');
  }

  @SubscribeMessage('transcribe-start')
  handleTranscribeStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { mimetype: string; filename?: string },
  ) {
    if (!client.data.userId) {
      this.logger.warn(`Unauthorized transcribe-start attempt from client ${client.id}`);
      client.emit('transcription-error', { message: 'Unauthorized' });
      client.disconnect();
      return;
    }
    this.cleanupStream(client.id, 'new-session');

    const filename = data.filename || `recording-${Date.now()}.webm`;
    const mimetype = data.mimetype || 'audio/webm';

    this.logger.log(`Starting STT stream for client ${client.id}: ${filename} (${mimetype})`);

    const passThrough = new PassThrough();
    passThrough.on('error', (err) => {
      this.logger.error(`Stream error for client ${client.id}: ${err.message}`);
    });
    
    // Start transcription promise
    const transcriptionPromise = this.sttService
      .transcribeAudioStream(passThrough, filename, mimetype)
      .then((result) => {
        client.emit('transcription-result', result);
      })
      .catch((error) => {
        this.logger.error(`Transcription error for client ${client.id}: ${error.message}`);
        client.emit('transcription-error', { message: error.message });
      })
      .finally(() => {
        // Only delete from map if this is still the active stream for this client
        const current = this.activeStreams.get(client.id);
        if (current && current.stream === passThrough) {
          this.logger.debug(`Transcription finished for client ${client.id}, cleaning up`);
          this.activeStreams.delete(client.id);
        }
      });

    this.activeStreams.set(client.id, {
      stream: passThrough,
      promise: transcriptionPromise,
    });
  }

  @SubscribeMessage('audio-chunk')
  handleAudioChunk(@ConnectedSocket() client: Socket, @MessageBody() chunk: any) {
    const active = this.activeStreams.get(client.id);
    if (!active) {
      this.logger.warn(`Received audio chunk for client ${client.id} without active stream`);
      return;
    }

    // chunk might be a Buffer or ArrayBuffer depending on socket.io configuration
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    
    if (active.stream.writable && !active.stream.writableEnded) {
      active.stream.write(buffer, (err) => {
        if (err) {
          this.logger.error(`Error writing to STT stream for client ${client.id}: ${err.message}`);
          this.cleanupStream(client.id, 'write-error');
        }
      });
    }
  }

  @SubscribeMessage('transcribe-end')
  handleTranscribeEnd(@ConnectedSocket() client: Socket) {
    const active = this.activeStreams.get(client.id);
    if (active) {
      this.logger.log(`Ending STT stream for client ${client.id}`);
      active.stream.end();
    }
  }

  private cleanupStream(socketId: string, reason: string) {
    const active = this.activeStreams.get(socketId);
    if (active) {
      this.logger.log(`Cleaning up stream for client ${socketId}. Reason: ${reason}`);
      // If disconnecting, treat as stream end rather than destroy to allow processing to finish if possible
      // But if it's a new session or error, we must destroy
      if (reason === 'disconnect') {
        if (!active.stream.writableEnded) {
           active.stream.end(); 
        }
      } else {
        active.stream.destroy();
      }
      this.activeStreams.delete(socketId);
    }
  }
}
