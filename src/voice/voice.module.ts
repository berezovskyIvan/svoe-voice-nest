import { Module } from '@nestjs/common';
import { AssistantModule } from '../assistant/assistant.module.js';
import { SpeechKit } from './speechkit.service.js';
import { VoiceEndpoint } from './voice-endpoint.service.js';

@Module({
  exports: [VoiceEndpoint],
  imports: [AssistantModule],
  providers: [SpeechKit, VoiceEndpoint],
})
export class VoiceModule {}
