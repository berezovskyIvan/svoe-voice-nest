import type { Client, ClientDuplexStream, Metadata } from '@grpc/grpc-js';

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

export interface Recognizer extends Client {
  recognizeStreaming(
    metadata: Metadata,
    options: { deadline: Date },
  ): SpeechStream;
}
