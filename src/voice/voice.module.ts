import { Module } from '@nestjs/common';
import { SpeechKit } from './speechkit.service.js';
import { VoiceEndpoint } from './voice-endpoint.service.js';

@Module({
  exports: [VoiceEndpoint],
  providers: [SpeechKit, VoiceEndpoint],
})
export class VoiceModule {}
