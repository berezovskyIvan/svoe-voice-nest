import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { CqrsModule } from '@nestjs/cqrs';
import { ServeStaticModule } from '@nestjs/serve-static';
import { fileURLToPath } from 'node:url';
import { ActionsModule } from './actions/actions.module.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AssistantModule } from './assistant/assistant.module.js';
import { MvpFailureFilter } from './shared/errors.js';
import { VoiceModule } from './voice/voice.module.js';

@Module({
  controllers: [AppController],
  imports: [
    ActionsModule,
    AssistantModule,
    ConfigModule.forRoot({ isGlobal: true }),
    CqrsModule.forRoot(),
    ServeStaticModule.forRoot({
      renderPath: '/__catalog_index_disabled__',
      rootPath: fileURLToPath(new URL('../public/products/', import.meta.url)),
      serveRoot: '/static/products',
      serveStaticOptions: { fallthrough: true, index: false, redirect: false },
    }),
    VoiceModule,
  ],
  providers: [AppService, { provide: APP_FILTER, useClass: MvpFailureFilter }],
})
export class AppModule {}
