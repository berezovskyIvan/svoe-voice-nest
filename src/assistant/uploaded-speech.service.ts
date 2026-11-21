import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { z } from 'zod';
import { reject, voiceErrors } from '../shared/errors.js';

const run = promisify(execFile);
const recognition = z.object({ result: z.string() });
export const maxUploadBytes = 10 * 1024 * 1024;

@Injectable()
export class UploadedSpeech {
  constructor(private readonly config: ConfigService) {}

  async recognize(file: Buffer): Promise<string> {
    const apiKey = this.config.get<string>('YC_API_KEY');
    if (!apiKey) this.unavailable();

    const audio = await this.convert(file);
    const url = new URL(
      'https://stt.api.cloud.yandex.net/speech/v1/stt:recognize',
    );
    url.search = new URLSearchParams({
      format: 'oggopus',
      lang: 'ru-RU',
    }).toString();
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Api-Key ${apiKey}`,
          'Content-Type': 'application/octet-stream',
        },
        body: new Uint8Array(audio),
        signal: AbortSignal.timeout(12_000),
      });
      if (!response.ok) {
        await response.body?.cancel();
        this.unavailable();
      }
      return recognition.parse(await response.json()).result.trim();
    } catch {
      return this.unavailable();
    }
  }

  private async convert(file: Buffer): Promise<Buffer> {
    const dir = await mkdtemp(join(tmpdir(), 'zoya-audio-'));
    try {
      const input = join(dir, 'audio');
      await writeFile(input, file);
      const { stdout } = await run(
        'ffmpeg',
        [
          '-nostdin',
          '-loglevel',
          'error',
          '-protocol_whitelist',
          'file,pipe',
          '-format_whitelist',
          'matroska,webm,mov,mp4,m4a,3gp,3g2,mj2',
          '-i',
          input,
          '-map',
          '0:a:0',
          '-t',
          '29',
          '-ac',
          '1',
          '-c:a',
          'libopus',
          '-b:a',
          '32k',
          '-f',
          'ogg',
          'pipe:1',
        ],
        { encoding: 'buffer', maxBuffer: 1_000_000, timeout: 10_000 },
      );
      return stdout;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT')
        this.unavailable();
      return reject(400, 'INVALID_AUDIO', voiceErrors.INVALID_AUDIO);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }

  private unavailable(): never {
    return reject(503, 'STT_UNAVAILABLE', voiceErrors.STT_UNAVAILABLE);
  }
}
