import { CAND_KEYS } from "./candidates";
import type { Shares } from "./types";

export interface LiveSource {
  id: "polls-a" | "polls-b" | "fc-a" | "fc-b";
  label: string;
  short: string;
  shares: Shares;
  band?: { lo: Shares; hi: Shares };
}

export const SERIES_COLORS: Record<string, string> = {
  "polls-a": "#9aa6c7",
  "polls-b": "#6aa7ff",
  "fc-a": "#fbbf24",
  "fc-b": "#34d399",
};

/** Erro médio absoluto (em pontos) entre uma leitura e a contagem, nos 7 grupos. */
export function mae(est: Shares, live: Shares) {
  return CAND_KEYS.reduce((a, k) => a + Math.abs(est[k] - live[k]), 0) / CAND_KEYS.length;
}
