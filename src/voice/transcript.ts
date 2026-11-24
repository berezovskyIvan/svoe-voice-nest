import type { SpeechEvent } from './interfaces/index.js';

export class Transcript {
  private readonly finalized = new Map<number, string>();
  private hasReachedEnd = false;
  private partial = '';
  private readonly refined = new Set<number>();

  accept(event: SpeechEvent): boolean {
    if (event.partial) {
      this.partial = event.partial.alternatives?.[0]?.text?.trim() ?? '';
    }

    if (event.final) {
      const index = event.audioCursors?.finalIndex ?? 0;

      if (!this.refined.has(index)) {
        this.finalized.set(
          index,
          event.final.alternatives?.[0]?.text?.trim() ?? '',
        );
      }
      this.partial = '';
    }

    if (event.finalRefinement) {
      const index = event.finalRefinement.finalIndex ?? 0;
      const text =
        event.finalRefinement.normalizedText?.alternatives?.[0]?.text?.trim();

      if (text) {
        this.finalized.set(index, text);
        this.refined.add(index);
      }
    }

    if (event.eouUpdate) {
      this.hasReachedEnd = true;
    }

    return !!(event.partial || event.final || event.finalRefinement);
  }

  getCurrentText(): string {
    return [this.getFinalText(), this.partial].filter(Boolean).join(' ');
  }

  getFinalText(): string {
    return [...this.finalized]
      .sort(([left], [right]) => left - right)
      .map(([, text]) => text)
      .join(' ')
      .trim();
  }

  hasFinalized(): boolean {
    return this.hasReachedEnd || this.finalized.size > 0;
  }

  isComplete(): boolean {
    return (
      this.hasReachedEnd &&
      this.finalized.size > 0 &&
      [...this.finalized.keys()].every((index) => this.refined.has(index))
    );
  }
}
