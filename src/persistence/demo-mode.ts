export const DEMO_MODE = {
  reset: 'reset',
  resetHistory: 'reset-history',
  seed: 'seed',
} as const;

export type DemoMode = (typeof DEMO_MODE)[keyof typeof DEMO_MODE];
