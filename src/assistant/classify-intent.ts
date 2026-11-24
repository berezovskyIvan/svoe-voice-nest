import { Logger } from '@nestjs/common';
import { z } from 'zod';
import { DELIVERY_DAY, DELIVERY_TIME } from '../shared/delivery-options.js';
import { ERROR_CODE, reject } from '../shared/errors.js';
import { PRODUCT_UNITS } from '../shared/product-units.js';
import { moscowDate } from '../shared/rules.js';
import { ASSISTANT_INTENT } from './assistant-intent-values.js';
import { parseIntent, type AssistantIntent } from './assistant-intent.js';
import type { YandexLanguageModel } from './yandex-language-model.service.js';

const logger = new Logger('AssistantService');

export async function classifyIntent(
  model: YandexLanguageModel,
  recognizedText: string,
  now: Date,
): Promise<AssistantIntent> {
  try {
    const answer = await model.complete(
      `Классифицируй банковскую команду. Отвечай только JSON. Сегодня ${moscowDate(now)} в Москве.
Вопрос о тратах за текущий месяц или без периода: {"intent":"${ASSISTANT_INTENT.analytics}"}.
Просьба открыть банковский вклад: «Хочу открыть вклад» → {"intent":"${ASSISTANT_INTENT.deposit}","amount":null}, «Открой вклад на двести тысяч рублей» → {"intent":"${ASSISTANT_INTENT.deposit}","amount":200000}. Сумму укажи числом в рублях, включая суммы прописью, или null, если точная сумма в рублях не указана. Не принимай срок или ставку за сумму. Вопрос об условиях существующего вклада, его пополнение или закрытие: {"intent":"${ASSISTANT_INTENT.unknown}"}.
Просьба заказать, купить, привезти или доставить продукты — всегда ${ASSISTANT_INTENT.farmerProducts}, в том числе когда назван адрес доставки.
«Закажи молоко 3,2% на субботу утром» → {"intent":"${ASSISTANT_INTENT.farmerProducts}","items":[{"name":"молоко","variant":"3,2%","quantity":null,"unit":null}],"deliveryDay":"saturday","deliveryTime":"${DELIVERY_TIME.morning}","deliveryAddress":null}.
«Привези молоко завтра утром на улицу Садовую, дом пятнадцать, корпус два, квартира семь» → {"intent":"${ASSISTANT_INTENT.farmerProducts}","items":[{"name":"молоко","variant":null,"quantity":null,"unit":null}],"deliveryDay":"${DELIVERY_DAY.tomorrow}","deliveryTime":"${DELIVERY_TIME.morning}","deliveryAddress":"ул. Садовая, 15, корп. 2, кв. 7"}.
Для товара укажи базовое название в именительном падеже, характеристику (например жирность) отдельно. Запиши устное «3 и 2 процента» как «3,2%».
Количество укажи числом, единица ${PRODUCT_UNITS.pack}, ${PRODUCT_UNITS.piece}, ${PRODUCT_UNITS.gram}, ${PRODUCT_UNITS.kilogram}, ${PRODUCT_UNITS.milliliter} или ${PRODUCT_UNITS.liter}. Десяток яиц — 10 ${PRODUCT_UNITS.piece}.
Отсутствующие поля товара равны null. При отсутствии названий items = [].
День доставки: ${DELIVERY_DAY.today}, ${DELIVERY_DAY.tomorrow}, английское название дня недели, YYYY-MM-DD, ${DELIVERY_DAY.unsupported} или null.
Время доставки: ${DELIVERY_TIME.morning} (утро или слот 09–12), ${DELIVERY_DAY.unsupported} (другое время) или null.
Адрес доставки: deliveryAddress — строка до 300 символов с явно названным адресом или null, если адрес не указан. Отделяй адрес от товаров и времени. Приводи название улицы к именительному падежу, номера дома, корпуса и квартиры записывай цифрами. Сохраняй названный город и уточнения к адресу. Не добавляй деталей от себя.
Любая другая команда, включая ЖКХ и аналитику за другой месяц: {"intent":"${ASSISTANT_INTENT.unknown}"}.`,
      recognizedText,
      true,
    );
    return parseIntent.parse(JSON.parse(answer));
  } catch (error) {
    const reason =
      error instanceof z.ZodError
        ? error.issues
            .map((issue) => issue.path.join('.') || issue.code)
            .join(', ')
        : error instanceof Error
          ? error.name
          : 'unknown';
    logger.warn(`Unable to classify command (${reason})`);
    return reject(
      503,
      ERROR_CODE.ASSISTANT_UNAVAILABLE,
      'Помощник временно недоступен',
    );
  }
}
