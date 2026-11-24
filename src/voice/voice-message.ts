export const VOICE_COMMAND = {
  cancel: 'cancel',
  stop: 'stop',
} as const;

export const VOICE_EVENT = {
  error: 'error',
  ready: 'ready',
  recognized: 'recognized',
  result: 'result',
  transcript: 'transcript',
} as const;
