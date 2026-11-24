import { Body, Controller, Get, Headers, HttpCode, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DEMO_RESET_MESSAGE, RESPONSE_STATUS } from '../shared/api-contract.js';
import {
  parseDepositRequest,
  parseOrderRequest,
} from './action-request.mapper.js';
import {
  mapActionResponse,
  mapHistoryResponse,
  type ActionResponse,
  type HistoryResponse,
} from './action-response.mapper.js';
import {
  ApiHistory,
  ApiOpenDeposit,
  ApiOrder,
  ApiReset,
} from './actions.openapi.js';
import { ActionsService } from './actions.service.js';
import type { DepositResult, OrderResult } from './interfaces/index.js';

@ApiTags('actions')
@Controller('api/actions')
export class ActionsController {
  constructor(private readonly actionsService: ActionsService) {}

  @Get('history')
  @ApiHistory()
  async history(
    @Headers('x-zoya-contract') contract?: string,
  ): Promise<HistoryResponse> {
    const result = await this.actionsService.history();

    return mapHistoryResponse(result, contract);
  }

  @Post('deposit')
  @HttpCode(200)
  @ApiOpenDeposit()
  async openDeposit(
    @Body() body: unknown,
    @Headers('idempotency-key') key: unknown,
  ): Promise<ActionResponse<DepositResult>> {
    const request = parseDepositRequest(body, key);

    return mapActionResponse(
      await this.actionsService.openDeposit(request.input, request.key),
      request.isOriginal,
    );
  }

  @Post('order')
  @HttpCode(200)
  @ApiOrder()
  async order(
    @Body() body: unknown,
    @Headers('idempotency-key') key: unknown,
  ): Promise<ActionResponse<OrderResult>> {
    const request = parseOrderRequest(body, key);
    return mapActionResponse(
      await this.actionsService.order(request.input, request.key),
      request.isOriginal,
    );
  }

  @Post('reset')
  @HttpCode(200)
  @ApiReset()
  async reset(): Promise<{
    status: typeof RESPONSE_STATUS.ok;
    message: typeof DEMO_RESET_MESSAGE;
  }> {
    await this.actionsService.reset();
    return { status: RESPONSE_STATUS.ok, message: DEMO_RESET_MESSAGE };
  }
}
