export type CandKey = "lula" | "flavio" | "caiado" | "cury" | "renan" | "zema" | "demais";

export type Shares = Record<CandKey, number>;

export interface Candidate {
  key: CandKey;
  name: string;
  short: string;
  party: string;
  /** número na urna (TSE); "" para o agrupamento "demais" */
  number: string;
  color: string;
}

/** Pesquisa de 1º turno, em % do total de entrevistados (como divulgada). */
export interface Poll {
  institute: string;
  start: string; // yyyy-mm-dd
  end: string; // yyyy-mm-dd
  n: number | null;
  moe: number | null;
  lula: number | null;
  flavio: number | null;
  cury: number | null;
  caiado: number | null;
  renan: number | null;
  zema: number | null;
  /** soma dos demais candidatos nominais */
  demais: number | null;
  outros: number | null;
  indecisos: number | null;
  origin?: "wikipedia" | "manual" | "snapshot";
}

export interface WeightedPoll {
  poll: Poll;
  valid: Shares;
  weight: number;
  /** fatia (0-1) do peso total desta média */
  share: number;
}

export interface Aggregate {
  shares: Shares;
  nPolls: number;
  nInstitutes: number;
  /** dispersão (desvio) entre os institutos, em pontos */
  sdHouse: Shares;
  avgMoe: number;
  latest: string;
  rows: WeightedPoll[];
}

export interface Forecast {
  mean: Shares;
  lo: Shares;
  hi: Shares;
  pLead: Record<"lula" | "flavio" | "outro", number>;
  /** chance de cada candidato passar de 50% dos válidos */
  pWinFirstRound: Shares;
  /** chance de cada candidato ir ao 2º turno (ficar entre os 2 mais votados) */
  pRunoff: Shares;
  /** chance de não haver vencedor no 1º turno */
  pSecondRound: number;
}

export interface LiveCandidate {
  number: string;
  name: string;
  party: string;
  votes: number;
  pct: number;
  status: string;
  key: CandKey;
}

export interface LiveCount {
  env: "oficial" | "simulado" | "demo";
  updatedAt: string;
  started: boolean;
  pctSections: number;
  validVotes: number;
  blank: number;
  nulls: number;
  candidates: LiveCandidate[];
  /** % dos válidos por candidato acompanhado (soma 100) */
  shares: Shares;
}
