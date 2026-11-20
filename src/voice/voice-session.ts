import type { Logger } from '@nestjs/common';
import { WebSocket, type RawData } from 'ws';
import type { AssistantResult } from '../assistant/assistant.service.js';
import { MvpFailure, voiceErrors } from '../shared/errors.js';
import {
  sessionOptions,
  type SpeechEvent,
  type SpeechStream,
} from './speechkit.service.js';

import { Transcript } from './transcript.js';

const recordingMs = 30_000;
const maxAudioBytes = 32_000 * (recordingMs / 1000);
export class VoiceSession {
  private bytes = 0;
  private phase: 'recording' | 'stopping' | 'processing' | 'closed' =
    'recording';
  private timeout?: NodeJS.Timeout;
  private readonly transcript = new Transcript();
  private upstreamEnded = false;

  constructor(
    private readonly session: {
      logger: Logger;
      processText: (text: string) => Promise<AssistantResult>;
      socket: WebSocket;
      stream: SpeechStream;
    },
  ) {}

  start() {
    this.session.socket.on('close', () => this.cleanup());
    this.session.socket.on('error', () => {
      this.cleanup();
      this.session.socket.terminate();
    });
    this.session.socket.on('message', (data, binary) =>
      this.receive(data, binary),
    );
    this.session.stream.on('data', (event: SpeechEvent) => this.update(event));
    this.session.stream.on('error', (error: { code?: number }) => {
      if (this.phase === 'closed' || this.phase === 'processing') return;
      this.session.logger.warn(
        `SpeechKit streaming status: ${error.code ?? 'unknown'}`,
      );
      this.fail('STT_UNAVAILABLE');
    });
    this.session.stream.on('end', () => {
      this.upstreamEnded = true;
      if (this.phase === 'stopping') {
        void this.finish();
      } else if (this.phase === 'recording') {
        this.fail('STT_UNAVAILABLE');
      }
    });
    this.timeout = setTimeout(() => this.fail('RECORDING_LIMIT'), recordingMs);
    this.session.stream.write({ sessionOptions });
    this.send({ type: 'ready' });
  }

  private receive(data: RawData, binary: boolean) {
    if (this.phase === 'closed') return;
    const chunk = Buffer.isBuffer(data)
      ? data
      : Array.isArray(data)
        ? Buffer.concat(data)
        : Buffer.from(data);
    if (binary) return this.receiveAudio(chunk);
    let type: string | undefined;
    try {
      type = JSON.parse(chunk.toString())?.type;
    } catch {
      return this.fail('INVALID_AUDIO');
    }
    if (type === 'cancel') {
      this.cleanup();
      return this.session.socket.close();
    }
    if (type !== 'stop') return this.fail('INVALID_AUDIO');
    if (this.phase !== 'recording') return;
    if (!this.bytes) return this.fail('NO_SPEECH');
    this.phase = 'stopping';
    clearTimeout(this.timeout);
    this.timeout = setTimeout(() => {
      if (this.transcript.hasFinalized()) void this.finish();
      else this.fail('STT_UNAVAILABLE');
    }, 5_000);
    this.session.stream.write({ eou: {} });
    this.session.stream.end();
  }

  private receiveAudio(chunk: Buffer): void {
    if (this.phase !== 'recording') return;
    if (
      !chunk.length ||
      chunk.length % 2 ||
      this.session.stream.writableLength > 32
    )
      return this.fail('INVALID_AUDIO');
    this.bytes += chunk.length;
    if (this.bytes > maxAudioBytes) return this.fail('RECORDING_LIMIT');
    this.session.stream.write({ chunk: { data: chunk } });
  }

  private update(event: SpeechEvent): void {
    if (this.phase !== 'recording' && this.phase !== 'stopping') return;
    if (this.transcript.accept(event)) {
      this.send({ text: this.transcript.getCurrentText(), type: 'transcript' });
    }
    if (this.phase === 'stopping' && this.transcript.isComplete())
      void this.finish();
  }

  private async finish() {
    if (this.phase !== 'stopping') return;
    const text = this.transcript.getFinalText();
    if (text.length < 2) return this.fail('NO_SPEECH');
    this.phase = 'processing';
    clearTimeout(this.timeout);
    if (!this.upstreamEnded) this.session.stream.cancel();
    this.send({ type: 'recognized', text });
    try {
      const data = await this.session.processText(text);
      this.complete({ type: 'result', data });
    } catch (error) {
      if (error instanceof MvpFailure) {
        this.complete({ type: 'error', error: error.body.error });
      } else {
        this.fail('ASSISTANT_UNAVAILABLE');
      }
    }
  }

  private send(event: object) {
    if (this.session.socket.readyState === WebSocket.OPEN)
      this.session.socket.send(JSON.stringify(event));
  }

  private fail(code: keyof typeof voiceErrors) {
    this.complete({
      type: 'error',
      error: { code, message: voiceErrors[code] },
    });
  }

  private complete(event: object) {
    if (this.phase === 'closed') return;
    this.send(event);
    this.cleanup();
    this.session.socket.close();
  }

  private cleanup() {
    if (this.phase === 'closed') return;
    this.phase = 'closed';
    clearTimeout(this.timeout);
    if (!this.upstreamEnded) this.session.stream.cancel();
  }
}
