import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBody,
  ApiConsumes,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { z } from 'zod';
import { AssistantService } from './assistant.service.js';
import { invalid } from '../shared/errors.js';
import { ApiMvpError, openApiSchema } from '../shared/openapi.js';
import { assistantResponse } from './assistant-response.js';

import {
  originalAssistantResponse,
  originalNoSpeech,
  toOriginalAssistantResponse,
} from './original-assistant-response.js';
import { maxUploadBytes, UploadedSpeech } from './uploaded-speech.service.js';
import { NUXT_CONTRACT } from '../shared/api-contract.js';

const textBody = z.strictObject({ text: z.string().trim().max(1000) });
@ApiTags('assistant')
@Controller('api/assistant')
export class AssistantController {
  constructor(
    private readonly assistant: AssistantService,
    private readonly speech: UploadedSpeech,
  ) {}

  @Post('text')
  @HttpCode(200)
  @ApiOperation({ summary: 'Обработать текстовую команду' })
  @ApiBody({ schema: openApiSchema(textBody) })
  @ApiHeader({
    name: 'X-Zoya-Contract',
    required: false,
    description: 'nuxt для потокового контракта',
  })
  @ApiOkResponse({
    schema: openApiSchema(
      z.union([originalAssistantResponse, assistantResponse]),
    ),
  })
  @ApiMvpError(400, 'Ошибка в запросе')
  @ApiMvpError(503, 'Помощник или демо-база недоступны')
  async text(
    @Body() body: unknown,
    @Headers('x-zoya-contract') contract?: string,
  ) {
    const input = textBody.safeParse(body);
    if (!input.success) {
      return invalid();
    }
    if (contract === NUXT_CONTRACT) {
      if (!input.data.text) {
        return invalid();
      }
      return this.assistant.process(input.data.text);
    }
    return this.original(input.data.text);
  }
  @Post('voice')
  @HttpCode(200)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: maxUploadBytes } }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOkResponse({ schema: openApiSchema(originalAssistantResponse) })
  @ApiMvpError(400, 'Некорректное аудио')
  @ApiMvpError(503, 'Распознавание речи или помощник недоступны')
  async voice(@UploadedFile() file?: { buffer: Buffer }) {
    if (!file?.buffer.length) {
      return invalid();
    }
    return this.original(await this.speech.recognize(file.buffer));
  }

  private async original(text: string) {
    if (text.length < 2) {
      return originalNoSpeech;
    }
    return toOriginalAssistantResponse(await this.assistant.process(text));
  }
}
