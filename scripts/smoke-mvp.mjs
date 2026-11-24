import { ConfigService } from '@nestjs/config';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

const HTTPS_PROTOCOL = 'https:';
const SECURE_WEBSOCKET_PROTOCOL = 'wss:';
const WEBSOCKET_PROTOCOL = 'ws:';
const BOTH_SCENARIOS = 'both';
const VOICE_SCENARIO = 'voice';
const TEXT_SCENARIO = 'text';
const REJECTED_STATUS = 'rejected';

const VOICE_COMMAND = { cancel: 'cancel', stop: 'stop' };
const VOICE_EVENT = {
  error: 'error',
  ready: 'ready',
  recognized: 'recognized',
  result: 'result',
  transcript: 'transcript',
};

const config = new ConfigService();
const host = new URL(config.get('SMOKE_API_URL', 'http://127.0.0.1:8080'));
const voiceUrl = new URL('/api/assistant/voice', host);
voiceUrl.protocol =
  host.protocol === HTTPS_PROTOCOL
    ? SECURE_WEBSOCKET_PROTOCOL
    : WEBSOCKET_PROTOCOL;
async function api(path, body, key, expected = 200) {
  const response = await fetch(
    new URL('/api/' + path, host),
    body === undefined
      ? { headers: { 'X-Zoya-Contract': 'nuxt' } }
      : {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Zoya-Contract': 'nuxt',
            ...(key ? { 'Idempotency-Key': key } : {}),
          },
          body: JSON.stringify(body),
        },
  );
  const data = await response.json();
  assert.equal(
    response.status,
    expected,
    path +
      (body?.text ? ' [' + body.text + ']' : '') +
      ': ' +
      JSON.stringify(data),
  );
  return data;
}

async function voice(audioPath) {
  const audio = await readFile(audioPath);
  assert(audio.length > 0);
  const socket = new WebSocket(voiceUrl);
  let stop = false;
  let interim = false;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.close();
      reject(new Error('SpeechKit timeout'));
    }, 35_000);
    socket.addEventListener('message', async ({ data }) => {
      const event = JSON.parse(data);
      if (event.type === VOICE_EVENT.ready) {
        for (
          let index = 0;
          index < audio.length && socket.readyState === WebSocket.OPEN;
          index += 3200
        ) {
          socket.send(audio.subarray(index, index + 3200));
          await delay(100);
        }
        if (socket.readyState === WebSocket.OPEN) {
          stop = true;
          socket.send(JSON.stringify({ type: VOICE_COMMAND.stop }));
          socket.send(JSON.stringify({ type: VOICE_COMMAND.stop }));
        }
      } else if (event.type === VOICE_EVENT.transcript && !stop && event.text) {
        interim = true;
      } else if (event.type === VOICE_EVENT.recognized) {
        console.log(
          'SpeechKit interim before stop:',
          interim,
          '| final:',
          event.text,
        );
      } else if (event.type === VOICE_EVENT.error) {
        clearTimeout(timer);
        reject(new Error('Voice result: ' + event.error.code));
      } else if (event.type === VOICE_EVENT.result) {
        clearTimeout(timer);
        try {
          assert(interim, 'No text before stop');
          assert.equal(event.data.intent, 'farmer-products');
          assert.equal(event.data.payload.totalPrice, 497);
          resolve();
        } catch (error) {
          reject(error);
        }
      }
    });
    socket.addEventListener('error', () => {
      clearTimeout(timer);
      reject(new Error('WebSocket failed'));
    });
  });
}

async function scenarios() {
  assert.equal((await api('actions/history')).balance, 1_800_000);
  const orderDraft = await api('assistant/text', {
    text: 'Закажи молоко 3,2%, творог и десяток яиц на субботу утром',
  });
  assert.equal(orderDraft.intent, 'farmer-products');
  assert.equal(orderDraft.payload.totalPrice, 497);
  assert.deepEqual(orderDraft.payload.unmatchedItems, []);
  const { items, delivery } = orderDraft.payload;
  assert.equal(items.find((item) => item.id === 3).qty, 1);
  const order = {
    items: items.map(({ id, qty }) => ({ id, qty })),
    expectedTotalPrice: 497,
    deliveryDate: delivery.date,
    deliverySlot: delivery.slot,
  };
  const drift = await api(
    'actions/order',
    { ...order, expectedTotalPrice: 1 },
    randomUUID(),
    409,
  );
  assert.equal(drift.error.code, 'PRICE_CHANGED');
  const key = randomUUID();
  const [first, repeated] = await Promise.all([
    api('actions/order', order, key),
    api('actions/order', order, key),
  ]);
  assert.deepEqual(first, repeated);
  assert.equal(first.newBalance, 1_799_503);
  assert.equal(
    (await api('actions/order', { ...order, expectedTotalPrice: 1 }, key, 409))
      .error.code,
    'IDEMPOTENCY_CONFLICT',
  );

  const analytics = await api('assistant/text', {
    text: 'Куда я тратила больше всего в этом месяце?',
  });
  assert.equal(analytics.intent, 'analytics');
  assert.equal(analytics.payload.totalSpent, 87_500);
  assert.equal(analytics.payload.depositOffer.rate, 14);
  assert.equal(analytics.payload.depositOffer.accountBalance, first.newBalance);
  assert.equal(
    (await api('actions/deposit', { amount: 2_000_000 }, randomUUID(), 409))
      .error.code,
    'INSUFFICIENT_FUNDS',
  );
  const depositKey = randomUUID();
  const deposit = await api('actions/deposit', { amount: 800_000 }, depositKey);
  assert.equal(deposit.estimatedInterest, 56_000);
  assert.equal(deposit.newBalance, 999_503);
  assert.deepEqual(
    await api('actions/deposit', { amount: 800_000 }, depositKey),
    deposit,
  );
  assert.equal(
    (await api('assistant/text', { text: 'Оплати ЖКХ' })).intent,
    'unknown',
  );
  const history = await api('actions/history');
  assert.equal(history.balance, 999_503);
  assert.deepEqual(
    history.history.slice(0, 3).map(({ type }) => type),
    ['deposit', 'analytics', 'order'],
  );
  console.log(
    'Text: order → 497 ₽; analytics → 87,500 ₽; deposit → 56,000 ₽ interest; balance → 999,503 ₽.',
  );
}

async function voiceEdge(command) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(voiceUrl);
    const timer = setTimeout(() => {
      socket.close();
      reject(new Error('Voice edge case timed out: ' + command));
    }, 8000);
    let result;
    socket.addEventListener('message', ({ data }) => {
      const event = JSON.parse(data);
      if (event.type === VOICE_EVENT.ready) {
        socket.send(JSON.stringify({ type: command }));
      } else {
        result = event;
      }
    });
    socket.addEventListener('close', () => {
      clearTimeout(timer);
      try {
        if (command === VOICE_COMMAND.stop) {
          assert.equal(result?.error?.code, 'NO_SPEECH');
        } else {
          assert.equal(result, undefined);
        }
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  });
}

async function checkContract() {
  const swagger = await fetch(new URL('/openapi.json', host));
  assert.equal(swagger.status, 200);
  const definition = await swagger.json();
  for (const [method, path] of [
    ['post', '/api/assistant/text'],
    ['post', '/api/assistant/voice'],
    ['post', '/api/actions/reset'],
    ['get', '/api/actions/history'],
    ['post', '/api/actions/deposit'],
    ['post', '/api/actions/order'],
  ]) {
    assert(
      definition.paths?.[path]?.[method]?.responses?.['200']?.content?.[
        'application/json'
      ]?.schema,
      path,
    );
  }
  const preflight = await fetch(new URL('/api/actions/order', host), {
    headers: {
      'Access-Control-Request-Headers':
        'content-type,idempotency-key,x-zoya-contract',
      'Access-Control-Request-Method': 'POST',
      Origin: config.get('SMOKE_FRONTEND_ORIGIN', 'http://localhost:3000'),
    },
    method: 'OPTIONS',
  });
  assert.equal(preflight.status, 204);
  assert.match(
    preflight.headers.get('access-control-allow-headers') ?? '',
    /idempotency-key/i,
  );
  for (const id of [1, 2, 3, 100]) {
    const image = await fetch(
      new URL('/static/products/' + id + '.webp', host),
    );
    assert.equal(image.status, 200);
    assert.equal(image.headers.get('content-type'), 'image/webp');
    const bytes = Buffer.from(await image.arrayBuffer());
    assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
  }
}

const requested = process.argv[2] ?? BOTH_SCENARIOS;
const tasks = [['OpenAPI, CORS and catalog images', checkContract()]];
if (requested !== VOICE_SCENARIO) {
  tasks.push(['Text scenarios', scenarios()]);
}
const audioPath = config.get('SMOKE_AUDIO_PCM');
if (requested !== TEXT_SCENARIO && audioPath) {
  tasks.push(['SpeechKit WebSocket', voice(audioPath)]);
}
if (requested !== TEXT_SCENARIO) {
  tasks.push([
    'Voice silence and cancel',
    Promise.all([
      voiceEdge(VOICE_COMMAND.stop),
      voiceEdge(VOICE_COMMAND.cancel),
    ]),
  ]);
}
const outcomes = await Promise.allSettled(tasks.map(([, task]) => task));
for (const [index, outcome] of outcomes.entries()) {
  console.log(tasks[index][0] + ': ' + outcome.status);
  if (outcome.status === REJECTED_STATUS) {
    process.exitCode = 1;
    console.log(outcome.reason.message);
  }
}
