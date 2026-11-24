import type { Logger } from '@nestjs/common';
import { WebSocket, type RawData } from 'ws';
import type { AssistantResult } from '../assistant/interfaces/index.js';
import { ERROR_CODE, MvpFailure, voiceErrors } from '../shared/errors.js';
import type { SpeechEvent, SpeechStream } from './interfaces/index.js';
import { sessionOptions } from './speechkit.service.js';
import { Transcript } from './transcript.js';
import { VOICE_COMMAND, VOICE_EVENT } from './voice-message.js';

const recordingMs = 30_000;
const maxAudioBytes = 32_000 * (recordingMs / 1000);

const VOICE_PHASE = {
  closed: 'closed',
  processing: 'processing',
  recording: 'recording',
  stopping: 'stopping',
} as const;

type VoicePhase = (typeof VOICE_PHASE)[keyof typeof VOICE_PHASE];

type VoiceEvent =
  | { type: typeof VOICE_EVENT.ready }
  | {
      type: typeof VOICE_EVENT.transcript | typeof VOICE_EVENT.recognized;
      text: string;
    }
  | { type: typeof VOICE_EVENT.result; data: AssistantResult }
  | { type: typeof VOICE_EVENT.error; error: MvpFailure['body']['error'] };

export class VoiceSession {
  private bytes = 0;
  private phase: VoicePhase = VOICE_PHASE.recording;
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

  start(): void {
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
      if (
        this.phase === VOICE_PHASE.closed ||
        this.phase === VOICE_PHASE.processing
      ) {
        return;
      }
      this.session.logger.warn(
        `SpeechKit streaming status: ${error.code ?? 'unknown'}`,
      );
      this.fail(ERROR_CODE.STT_UNAVAILABLE);
    });
    this.session.stream.on('end', () => {
      this.upstreamEnded = true;
      if (this.phase === VOICE_PHASE.stopping) {
        void this.finish();
      } else if (this.phase === VOICE_PHASE.recording) {
        this.fail(ERROR_CODE.STT_UNAVAILABLE);
      }
    });
    this.timeout = setTimeout(
      () => this.fail(ERROR_CODE.RECORDING_LIMIT),
      recordingMs,
    );
    this.session.stream.write({ sessionOptions });
    this.send({ type: VOICE_EVENT.ready });
  }

  private receive(data: RawData, binary: boolean) {
    if (this.phase === VOICE_PHASE.closed) {
      return;
    }

    const chunk = Buffer.isBuffer(data)
      ? data
      : Array.isArray(data)
        ? Buffer.concat(data)
        : Buffer.from(data);

    if (binary) {
      return this.receiveAudio(chunk);
    }

    let type: string | undefined;
    try {
      type = JSON.parse(chunk.toString())?.type;
    } catch {
      return this.fail(ERROR_CODE.INVALID_AUDIO);
    }

    if (type === VOICE_COMMAND.cancel) {
      this.cleanup();
      return this.session.socket.close();
    }

    if (type !== VOICE_COMMAND.stop) {
      return this.fail(ERROR_CODE.INVALID_AUDIO);
    }

    if (this.phase !== VOICE_PHASE.recording) {
      return;
    }

    if (!this.bytes) {
      return this.fail(ERROR_CODE.NO_SPEECH);
    }

    this.phase = VOICE_PHASE.stopping;
    clearTimeout(this.timeout);
    this.timeout = setTimeout(() => {
      if (this.transcript.hasFinalized()) {
        void this.finish();
      } else {
        this.fail(ERROR_CODE.STT_UNAVAILABLE);
      }
    }, 5_000);
    this.session.stream.write({ eou: {} });
    this.session.stream.end();
  }

  private receiveAudio(chunk: Buffer): void {
    if (this.phase !== VOICE_PHASE.recording) {
      return;
    }

    if (
      !chunk.length ||
      chunk.length % 2 ||
      this.session.stream.writableLength > 32
    ) {
      return this.fail(ERROR_CODE.INVALID_AUDIO);
    }

    this.bytes += chunk.length;

    if (this.bytes > maxAudioBytes) {
      return this.fail(ERROR_CODE.RECORDING_LIMIT);
    }

    this.session.stream.write({ chunk: { data: chunk } });
  }

  private update(event: SpeechEvent): void {
    if (
      this.phase !== VOICE_PHASE.recording &&
      this.phase !== VOICE_PHASE.stopping
    ) {
      return;
    }

    if (this.transcript.accept(event)) {
      this.send({
        text: this.transcript.getCurrentText(),
        type: VOICE_EVENT.transcript,
      });
    }

    if (this.phase === VOICE_PHASE.stopping && this.transcript.isComplete()) {
      void this.finish();
    }
  }

  private async finish() {
    if (this.phase !== VOICE_PHASE.stopping) {
      return;
    }

    const text = this.transcript.getFinalText();

    if (text.length < 2) {
      return this.fail(ERROR_CODE.NO_SPEECH);
    }

    this.phase = VOICE_PHASE.processing;
    clearTimeout(this.timeout);

    if (!this.upstreamEnded) {
      this.session.stream.cancel();
    }

    this.send({ type: VOICE_EVENT.recognized, text });

    try {
      const data = await this.session.processText(text);
      this.complete({ type: VOICE_EVENT.result, data });
    } catch (error) {
      if (error instanceof MvpFailure) {
        this.complete({ type: VOICE_EVENT.error, error: error.body.error });
      } else {
        this.fail(ERROR_CODE.ASSISTANT_UNAVAILABLE);
      }
    }
  }

  private send(event: VoiceEvent) {
    if (this.session.socket.readyState === WebSocket.OPEN) {
      this.session.socket.send(JSON.stringify(event));
    }
  }

  private fail(code: keyof typeof voiceErrors) {
    this.complete({
      type: VOICE_EVENT.error,
      error: { code, message: voiceErrors[code] },
    });
  }

  private complete(event: VoiceEvent) {
    if (this.phase === VOICE_PHASE.closed) {
      return;
    }

    this.send(event);
    this.cleanup();
    this.session.socket.close();
  }

  private cleanup() {
    if (this.phase === VOICE_PHASE.closed) {
      return;
    }

    this.phase = VOICE_PHASE.closed;
    clearTimeout(this.timeout);

    if (!this.upstreamEnded) {
      this.session.stream.cancel();
    }
  }
}
