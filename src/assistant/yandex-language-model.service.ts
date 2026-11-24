import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';

const completionResponse = z.object({
  result: z.object({
    alternatives: z
      .array(
        z.object({ message: z.object({ text: z.string().trim().min(1) }) }),
      )
      .min(1),
  }),
});

@Injectable()
export class YandexLanguageModel {
  private readonly logger = new Logger(YandexLanguageModel.name);

  constructor(private readonly config: ConfigService) {}

  async complete(
    system: string,
    text: string,
    jsonObject = false,
  ): Promise<string> {
    const apiKey = this.config.get<string>('YC_API_KEY');
    const folderId = this.config.get<string>('YC_FOLDER_ID');
    if (!apiKey || !folderId) {
      throw new Error('YandexGPT configuration is missing');
    }
    const response = await fetch(
      'https://llm.api.cloud.yandex.net/foundationModels/v1/completion',
      {
        method: 'POST',
        headers: {
          Authorization: `Api-Key ${apiKey}`,
          'Content-Type': 'application/json',
          'x-folder-id': folderId,
        },
        signal: AbortSignal.timeout(12_000),
        body: JSON.stringify({
          modelUri: `gpt://${folderId}/yandexgpt-lite/latest`,
          completionOptions: {
            stream: false,
            temperature: 0.1,
            maxTokens: '1000',
          },
          messages: [
            { role: 'system', text: system },
            { role: 'user', text },
          ],
          ...(jsonObject && { jsonObject: true }),
        }),
      },
    );
    if (!response.ok) {
      await response.body?.cancel();
      this.logger.warn(`YandexGPT returned HTTP ${response.status}`);
      throw new Error(`YandexGPT HTTP ${response.status}`);
    }
    return completionResponse.parse(await response.json()).result
      .alternatives[0].message.text;
  }
}
