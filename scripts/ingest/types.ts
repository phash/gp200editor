export type PresetCandidate = {
  buffer: Buffer;
  sourceUrl: string;
  sourceLabel: string;
  suggestedName?: string;
  hint?: string;
};

export interface IngestSource {
  readonly id: string;
  readonly description: string;
  fetch(): AsyncIterable<PresetCandidate>;
}

export type IngestCounters = {
  accepted: number;
  rejected: number;
  duplicates: number;
};
