import { Module } from '@nestjs/common';
import { PersistenceModule } from '../persistence/persistence.module.js';
import { Analytics } from './analytics.service.js';
import { AssistantController } from './assistant.controller.js';
import { AssistantService } from './assistant.service.js';
import { ProcessTextHandler } from './commands/handlers/process-text.handler.js';
import { YandexLanguageModel } from './yandex-language-model.service.js';

import { UploadedSpeech } from './uploaded-speech.service.js';

@Module({
  controllers: [AssistantController],
  exports: [AssistantService],
  imports: [PersistenceModule],
  providers: [
    Analytics,
    AssistantService,
    ProcessTextHandler,
    YandexLanguageModel,
    UploadedSpeech,
  ],
})
export class AssistantModule {}
