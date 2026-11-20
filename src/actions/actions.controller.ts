import { Body, Controller, Get, Headers, HttpCode, Post } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBody, ApiHeader, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { DemoDatabase } from '../persistence/demo-database.service.js';
import { DELIVERY_SLOT } from '../shared/rules.js';
import {
  confirmationKey,
  depositBody,
  orderBody,
  originalOrderBody,
  originalDepositBody,
} from './action-requests.js';
import type {
  HistoryResult,
  OrderResult,
  DepositResult,
} from './actions.service.js';
import { ConfirmOrderCommand } from './commands/confirm-order.command.js';
import { OpenDepositCommand } from './commands/open-deposit.command.js';
import { GetHistoryQuery } from './queries/get-history.query.js';
import { invalid } from '../shared/errors.js';
import { ApiMvpError, openApiSchema } from '../shared/openapi.js';
import {
  depositResponse,
  originalHistoryResponse,
  originalActionResponse,
  resetResponse,
  historyResponse,
  orderResponse,
} from './action-responses.js';

@ApiTags('actions')
@Controller('api/actions')
export class ActionsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly database: DemoDatabase,
  ) {}

  @Get('history')
  @ApiHeader({
    name: 'X-Zoya-Contract',
    required: false,
    description: 'nuxt для потокового контракта',
  })
  @ApiOkResponse({
    schema: openApiSchema(z.union([historyResponse, originalHistoryResponse])),
  })
  @ApiMvpError(503, 'Демо-база или счёт недоступны')
  async history(@Headers('x-zoya-contract') contract?: string) {
    const result = await this.queryBus.execute<GetHistoryQuery, HistoryResult>(
      new GetHistoryQuery(),
    );
    if (contract === 'nuxt') return result;
    return {
      balance: result.balance,
      history: result.history.map((entry) => ({
        ...entry,
        type:
          entry.type === 'order'
            ? 'market'
            : entry.type === 'demo' && entry.amount !== null
              ? 'transfer'
              : 'analytics',
      })),
    };
  }

  @Post('reset')
  @HttpCode(200)
  @ApiOkResponse({ schema: openApiSchema(resetResponse) })
  @ApiMvpError(503, 'Демо-база или счёт недоступны')
  async reset() {
    await this.database.resetHistory();
    return { status: 'ok', message: 'Demo reset completed' };
  }

  @Post('order')
  @HttpCode(200)
  @ApiHeader({
    name: 'Idempotency-Key',
    required: false,
    description: 'Обязателен для формата Nuxt',
  })
  @ApiBody({ schema: openApiSchema(z.union([orderBody, originalOrderBody])) })
  @ApiOkResponse({
    schema: openApiSchema(z.union([orderResponse, originalActionResponse])),
  })
  @ApiMvpError(400, 'Ошибка в запросе')
  @ApiMvpError(404, 'Товар не найден')
  @ApiMvpError(
    409,
    'Изменились цена, остаток или слот, либо ключ подтверждения уже использован',
  )
  @ApiMvpError(503, 'Демо-база или счёт недоступны')
  async order(@Body() body: unknown, @Headers('idempotency-key') key: unknown) {
    const input = orderBody.safeParse(body);
    if (input.success) {
      return this.commandBus.execute(
        new ConfirmOrderCommand(input.data, this.key(key)),
      );
    }
    const original = originalOrderBody.safeParse(body);
    if (!original.success) return invalid();
    const result: OrderResult = await this.commandBus.execute(
      new ConfirmOrderCommand(
        {
          items: original.data.items,
          expectedTotalPrice: original.data.totalPrice,
          deliverySlot: DELIVERY_SLOT,
        },
        this.key(key, true),
      ),
    );
    return { status: 'ok', newBalance: result.newBalance };
  }

  @Post('deposit')
  @HttpCode(200)
  @ApiHeader({
    name: 'Idempotency-Key',
    required: false,
    description: 'Обязателен для формата Nuxt',
  })
  @ApiBody({
    schema: openApiSchema(z.union([depositBody, originalDepositBody])),
  })
  @ApiOkResponse({
    schema: openApiSchema(z.union([depositResponse, originalActionResponse])),
  })
  @ApiMvpError(400, 'Ошибка в запросе')
  @ApiMvpError(
    409,
    'Недостаточно средств или ключ подтверждения уже использован',
  )
  @ApiMvpError(503, 'Демо-база или счёт недоступны')
  async openDeposit(
    @Body() body: unknown,
    @Headers('idempotency-key') key: unknown,
  ) {
    const input = depositBody.safeParse(body);
    if (input.success) {
      return this.commandBus.execute(
        new OpenDepositCommand(input.data.amount, this.key(key)),
      );
    }
    const original = originalDepositBody.safeParse(body);
    if (!original.success) return invalid();
    const result: DepositResult = await this.commandBus.execute(
      new OpenDepositCommand(original.data.amount, this.key(key, true)),
    );
    return { status: 'ok', newBalance: result.newBalance };
  }

  private key(key: unknown, optional = false): string {
    if (optional && key === undefined) return randomUUID();
    const parsed = confirmationKey.safeParse(key);
    if (!parsed.success) return invalid();
    return parsed.data;
  }
}
