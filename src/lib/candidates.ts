import type { Candidate, CandKey, Shares } from "./types";

// Ordem de exibição. Cores escolhidas para ficarem distintas entre si e sempre acompanhadas do nome.
export const CANDIDATES: Candidate[] = [
  { key: "lula", name: "Lula", short: "Lula", party: "PT", number: "13", color: "#ef4d52" },
  { key: "flavio", name: "Flávio Bolsonaro", short: "Flávio", party: "PL", number: "22", color: "#4c8dff" },
  { key: "caiado", name: "Ronaldo Caiado", short: "Caiado", party: "PSD", number: "55", color: "#2fb67c" },
  { key: "cury", name: "Augusto Cury", short: "Cury", party: "Avante", number: "70", color: "#f2c14e" },
  { key: "renan", name: "Renan Santos", short: "Renan", party: "Missão", number: "14", color: "#22c3d6" },
  { key: "zema", name: "Romeu Zema", short: "Zema", party: "Novo", number: "30", color: "#f58a3b" },
  { key: "demais", name: "Demais candidatos", short: "Demais", party: "", number: "", color: "#8b95a8" },
];

export const CAND_KEYS: CandKey[] = CANDIDATES.map((c) => c.key);

export const BY_KEY = Object.fromEntries(CANDIDATES.map((c) => [c.key, c])) as Record<CandKey, Candidate>;

export const BY_NUMBER: Record<string, CandKey> = Object.fromEntries(
  CANDIDATES.filter((c) => c.number).map((c) => [c.number, c.key]),
);

export function emptyShares(v = 0): Shares {
  return { lula: v, flavio: v, caiado: v, cury: v, renan: v, zema: v, demais: v };
}
