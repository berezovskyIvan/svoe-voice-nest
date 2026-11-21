import {
  Injectable,
  Logger,
  type BeforeApplicationShutdown,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import type { Server } from 'node:http';
import { WebSocketServer } from 'ws';
import { voiceErrors } from '../shared/errors.js';
import { ProcessTextCommand } from '../assistant/commands/process-text.command.js';
import { SpeechKit, type SpeechStream } from './speechkit.service.js';
import { VoiceSession } from './voice-session.js';

@Injectable()
export class VoiceEndpoint implements BeforeApplicationShutdown {
  private readonly logger = new Logger(VoiceEndpoint.name);
  private server?: WebSocketServer;

  constructor(
    private readonly commandBus: CommandBus,
    private readonly speechKit: SpeechKit,
  ) {}

  attach(httpServer: Server, allowedOrigins: string[]) {
    const server = new WebSocketServer({
      server: httpServer,
      path: '/api/assistant/voice',
      maxPayload: 32_000,
      verifyClient: ({ origin }: { origin?: string }) =>
        !origin || allowedOrigins.includes(origin),
    });
    this.server = server;
    server.on('connection', (socket) => {
      let stream: SpeechStream;
      try {
        stream = this.speechKit.open();
      } catch {
        socket.send(
          JSON.stringify({
            type: 'error',
            error: {
              code: 'STT_UNAVAILABLE',
              message: voiceErrors.STT_UNAVAILABLE,
            },
          }),
        );
        socket.close();
        return;
      }
      new VoiceSession({
        logger: this.logger,
        processText: (text) =>
          this.commandBus.execute(new ProcessTextCommand(text)),
        socket,
        stream,
      }).start();
    });
  }

  beforeApplicationShutdown() {
    for (const socket of this.server?.clients ?? []) socket.terminate();
    this.server?.close();
  }
}
