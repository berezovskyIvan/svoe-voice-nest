import { ArgumentsHost, Catch, type ExceptionFilter } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';

export const ERROR_CODE = {
  ASSISTANT_UNAVAILABLE: 'ASSISTANT_UNAVAILABLE',
  DATABASE_UNAVAILABLE: 'DATABASE_UNAVAILABLE',
  DELIVERY_UNAVAILABLE: 'DELIVERY_UNAVAILABLE',
  IDEMPOTENCY_CONFLICT: 'IDEMPOTENCY_CONFLICT',
  INSUFFICIENT_FUNDS: 'INSUFFICIENT_FUNDS',
  INVALID_AUDIO: 'INVALID_AUDIO',
  INVALID_REQUEST: 'INVALID_REQUEST',
  NO_SPEECH: 'NO_SPEECH',
  PRICE_CHANGED: 'PRICE_CHANGED',
  PRODUCT_NOT_FOUND: 'PRODUCT_NOT_FOUND',
  RECORDING_LIMIT: 'RECORDING_LIMIT',
  STT_UNAVAILABLE: 'STT_UNAVAILABLE',
} as const;

export class MvpFailure extends Error {
  readonly body: { error: { code: string; details?: object; message: string } };

  constructor(
    readonly status: number,
    code: string,
    message: string,
    details?: object,
  ) {
    super(message);
    this.body = { error: { code, ...(details && { details }), message } };
  }
}

@Catch(MvpFailure)
export class MvpFailureFilter implements ExceptionFilter<MvpFailure> {
  constructor(private readonly adapterHost: HttpAdapterHost) {}

  catch(error: MvpFailure, host: ArgumentsHost): void {
    this.adapterHost.httpAdapter.reply(
      host.switchToHttp().getResponse(),
      error.body,
      error.status,
    );
  }
}

export function reject(
  status: number,
  code: string,
  message: string,
  details?: object,
): never {
  throw new MvpFailure(status, code, message, details);
}

export function invalid(): never {
  return reject(400, ERROR_CODE.INVALID_REQUEST, 'Проверьте поля запроса');
}

export const voiceErrors = {
  [ERROR_CODE.INVALID_AUDIO]: 'Не удалось прочитать аудио',
  [ERROR_CODE.NO_SPEECH]: 'Не расслышала. Повторите, пожалуйста',
  [ERROR_CODE.RECORDING_LIMIT]: 'Достигнут предел длительности записи',
  [ERROR_CODE.STT_UNAVAILABLE]: 'Распознавание речи временно недоступно',
  [ERROR_CODE.ASSISTANT_UNAVAILABLE]: 'Помощник временно недоступен',
};
