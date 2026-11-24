import { applyDecorators } from '@nestjs/common';
import { ApiBody, ApiHeader, ApiOkResponse } from '@nestjs/swagger';
import { z } from 'zod';
import { ApiMvpError, openApiSchema } from '../shared/openapi.js';
import {
  depositBody,
  orderBody,
  originalDepositBody,
  originalOrderBody,
} from './action-requests.js';
import {
  depositResponse,
  historyResponse,
  orderResponse,
  originalActionResponse,
  originalHistoryResponse,
  resetResponse,
} from './action-responses.js';

export function ApiHistory(): MethodDecorator {
  return applyDecorators(
    ApiHeader({
      name: 'X-Zoya-Contract',
      required: false,
      description: 'nuxt для потокового контракта',
    }),
    ApiOkResponse({
      schema: openApiSchema(
        z.union([historyResponse, originalHistoryResponse]),
      ),
    }),
    ApiMvpError(503, 'Демо-база или счёт недоступны'),
  );
}

export function ApiOpenDeposit(): MethodDecorator {
  return applyDecorators(
    ApiHeader({
      name: 'Idempotency-Key',
      required: false,
      description: 'Обязателен для формата Nuxt',
    }),
    ApiBody({
      schema: openApiSchema(z.union([depositBody, originalDepositBody])),
    }),
    ApiOkResponse({
      schema: openApiSchema(z.union([depositResponse, originalActionResponse])),
    }),
    ApiMvpError(400, 'Ошибка в запросе'),
    ApiMvpError(
      409,
      'Недостаточно средств или ключ подтверждения уже использован',
    ),
    ApiMvpError(503, 'Демо-база или счёт недоступны'),
  );
}

export function ApiOrder(): MethodDecorator {
  return applyDecorators(
    ApiHeader({
      name: 'Idempotency-Key',
      required: false,
      description: 'Обязателен для формата Nuxt',
    }),
    ApiBody({ schema: openApiSchema(z.union([orderBody, originalOrderBody])) }),
    ApiOkResponse({
      schema: openApiSchema(z.union([orderResponse, originalActionResponse])),
    }),
    ApiMvpError(400, 'Ошибка в запросе'),
    ApiMvpError(404, 'Товар не найден'),
    ApiMvpError(
      409,
      'Изменились цена, остаток или слот, либо ключ подтверждения уже использован',
    ),
    ApiMvpError(503, 'Демо-база или счёт недоступны'),
  );
}

export function ApiReset(): MethodDecorator {
  return applyDecorators(
    ApiOkResponse({ schema: openApiSchema(resetResponse) }),
    ApiMvpError(503, 'Демо-база или счёт недоступны'),
  );
}
