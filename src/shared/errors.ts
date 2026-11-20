import { ArgumentsHost, Catch, type ExceptionFilter } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';

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
  return reject(400, 'INVALID_REQUEST', 'Проверьте поля запроса');
}

export const voiceErrors = {
  INVALID_AUDIO: 'Не удалось прочитать аудио',
  NO_SPEECH: 'Не расслышала. Повторите, пожалуйста',
  RECORDING_LIMIT: 'Достигнут предел длительности записи',
  STT_UNAVAILABLE: 'Распознавание речи временно недоступно',
  ASSISTANT_UNAVAILABLE: 'Помощник временно недоступен',
};
