const nf = (d: number) => new Intl.NumberFormat("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
const f1 = nf(1);
const f0 = nf(0);
const f2 = nf(2);

export const pct = (v: number, d = 1) => `${(d === 0 ? f0 : d === 2 ? f2 : f1).format(v)}%`;
export const dec = (v: number, d = 1) => (d === 0 ? f0 : d === 2 ? f2 : f1).format(v);
export const int = (v: number) => f0.format(v);
export const signed = (v: number, d = 1) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${dec(Math.abs(v), d)}`;

/** yyyy-mm-dd -> 03/10 */
export const dmy = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

export function timeAgo(iso: string, now = Date.now()) {
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 60) return "agora há pouco";
  if (s < 3600) return `há ${Math.round(s / 60)} min`;
  return `há ${Math.round(s / 3600)} h`;
}

/** Chance em %, sem prometer certeza: ">99%" e "<1%" nas pontas. */
export function chance(v: number) {
  if (v >= 99.5) return ">99%";
  if (v < 0.5) return v <= 0 ? "0%" : "<1%";
  return `${v < 10 ? dec(v, 1) : dec(v, 0)}%`;
}
