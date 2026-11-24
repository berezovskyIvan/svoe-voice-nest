import {
  Injectable,
  Logger,
  type BeforeApplicationShutdown,
} from '@nestjs/common';
import type { Server } from 'node:http';
import { WebSocketServer } from 'ws';
import { AssistantService } from '../assistant/assistant.service.js';
import { ERROR_CODE, voiceErrors } from '../shared/errors.js';
import type { SpeechStream } from './interfaces/index.js';
import { SpeechKit } from './speechkit.service.js';
import { VOICE_EVENT } from './voice-message.js';
import { VoiceSession } from './voice-session.js';

@Injectable()
export class VoiceEndpoint implements BeforeApplicationShutdown {
  private readonly logger = new Logger(VoiceEndpoint.name);
  private server?: WebSocketServer;

  constructor(
    private readonly assistant: AssistantService,
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
            type: VOICE_EVENT.error,
            error: {
              code: ERROR_CODE.STT_UNAVAILABLE,
              message: voiceErrors.STT_UNAVAILABLE,
            },
          }),
        );
        socket.close();
        return;
      }

      new VoiceSession({
        logger: this.logger,
        processText: (text) => this.assistant.process(text),
        socket,
        stream,
      }).start();
    });
  }

  beforeApplicationShutdown() {
    for (const socket of this.server?.clients ?? []) {
      socket.terminate();
    }
    this.server?.close();
  }
}
