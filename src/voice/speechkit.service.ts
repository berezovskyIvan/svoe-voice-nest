import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Client,
  credentials,
  loadPackageDefinition,
  Metadata,
  type ClientDuplexStream,
} from '@grpc/grpc-js';
import { loadSync } from '@grpc/proto-loader';
import { fileURLToPath } from 'node:url';

interface AlternativeUpdate {
  alternatives?: { text?: string }[];
}

export interface SpeechEvent {
  audioCursors?: { finalIndex?: number };
  partial?: AlternativeUpdate;
  final?: AlternativeUpdate;
  eouUpdate?: { timeMs?: number };
  finalRefinement?: { finalIndex?: number; normalizedText?: AlternativeUpdate };
}

type SpeechRequest =
  { sessionOptions: object } | { chunk: { data: Buffer } } | { eou: object };
export type SpeechStream = ClientDuplexStream<SpeechRequest, SpeechEvent>;

interface Recognizer extends Client {
  recognizeStreaming(
    metadata: Metadata,
    options: { deadline: Date },
  ): SpeechStream;
}

@Injectable()
export class SpeechKit implements OnApplicationShutdown {
  private client?: Recognizer;

  constructor(private readonly config: ConfigService) {}

  open() {
    const apiKey = this.config.get<string>('YC_API_KEY');
    if (!apiKey) throw new Error('SpeechKit API key is missing');
    if (!this.client) {
      const path = fileURLToPath(new URL('./speechkit.proto', import.meta.url));
      const loaded = loadPackageDefinition(
        loadSync(path, { longs: Number }),
      ) as unknown as {
        speechkit: {
          stt: {
            v3: {
              Recognizer: new (
                address: string,
                channel: ReturnType<typeof credentials.createSsl>,
              ) => Recognizer;
            };
          };
        };
      };
      this.client = new loaded.speechkit.stt.v3.Recognizer(
        'stt.api.cloud.yandex.net:443',
        credentials.createSsl(),
      );
    }
    const metadata = new Metadata();
    metadata.set('authorization', `Api-Key ${apiKey}`);
    const stream = this.client.recognizeStreaming(metadata, {
      deadline: new Date(Date.now() + 42_000),
    });
    return stream;
  }

  onApplicationShutdown() {
    this.client?.close();
  }
}

export const sessionOptions = {
  recognitionModel: {
    model: 'general',
    audioFormat: {
      rawAudio: {
        audioEncoding: 1,
        sampleRateHertz: 16_000,
        audioChannelCount: 1,
      },
    },
    textNormalization: { textNormalization: 1 },
    languageRestriction: { restrictionType: 1, languageCode: ['ru-RU'] },
    audioProcessingType: 1,
  },
  eouClassifier: { externalClassifier: {} },
};
