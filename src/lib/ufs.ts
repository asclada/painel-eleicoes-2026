export interface Uf {
  code: string; // minúsculo, como nos arquivos do TSE
  sigla: string;
  name: string;
}

// Ordenados do maior para o menor eleitorado (ordem aproximada, só para listar).
export const UFS: Uf[] = [
  { code: "sp", sigla: "SP", name: "São Paulo" },
  { code: "mg", sigla: "MG", name: "Minas Gerais" },
  { code: "rj", sigla: "RJ", name: "Rio de Janeiro" },
  { code: "ba", sigla: "BA", name: "Bahia" },
  { code: "pr", sigla: "PR", name: "Paraná" },
  { code: "rs", sigla: "RS", name: "Rio Grande do Sul" },
  { code: "pe", sigla: "PE", name: "Pernambuco" },
  { code: "ce", sigla: "CE", name: "Ceará" },
  { code: "pa", sigla: "PA", name: "Pará" },
  { code: "sc", sigla: "SC", name: "Santa Catarina" },
  { code: "ma", sigla: "MA", name: "Maranhão" },
  { code: "go", sigla: "GO", name: "Goiás" },
  { code: "pb", sigla: "PB", name: "Paraíba" },
  { code: "es", sigla: "ES", name: "Espírito Santo" },
  { code: "am", sigla: "AM", name: "Amazonas" },
  { code: "pi", sigla: "PI", name: "Piauí" },
  { code: "rn", sigla: "RN", name: "Rio Grande do Norte" },
  { code: "mt", sigla: "MT", name: "Mato Grosso" },
  { code: "al", sigla: "AL", name: "Alagoas" },
  { code: "df", sigla: "DF", name: "Distrito Federal" },
  { code: "ms", sigla: "MS", name: "Mato Grosso do Sul" },
  { code: "se", sigla: "SE", name: "Sergipe" },
  { code: "ro", sigla: "RO", name: "Rondônia" },
  { code: "to", sigla: "TO", name: "Tocantins" },
  { code: "ac", sigla: "AC", name: "Acre" },
  { code: "ap", sigla: "AP", name: "Amapá" },
  { code: "rr", sigla: "RR", name: "Roraima" },
];

/** Votos no exterior (arquivo "zz" do TSE). */
export const EXTERIOR = { code: "zz", sigla: "EXT", name: "Exterior" };

export const UF_CODES = [...UFS.map((u) => u.code), EXTERIOR.code];

export type RegionKey = "N" | "NE" | "CO" | "SE" | "S" | "EXT";

export const REGIONS: { key: RegionKey; name: string; ufs: string[] }[] = [
  { key: "NE", name: "Nordeste", ufs: ["ba", "pe", "ce", "ma", "pb", "pi", "rn", "al", "se"] },
  { key: "SE", name: "Sudeste", ufs: ["sp", "mg", "rj", "es"] },
  { key: "S", name: "Sul", ufs: ["pr", "rs", "sc"] },
  { key: "N", name: "Norte", ufs: ["pa", "am", "ro", "to", "ac", "ap", "rr"] },
  { key: "CO", name: "Centro-Oeste", ufs: ["go", "df", "mt", "ms"] },
  { key: "EXT", name: "Exterior", ufs: ["zz"] },
];

export const REGION_OF: Record<string, RegionKey> = Object.fromEntries(REGIONS.flatMap((r) => r.ufs.map((u) => [u, r.key])));

export const UF_NAME: Record<string, string> = Object.fromEntries([...UFS, EXTERIOR].map((u) => [u.code, u.name]));
