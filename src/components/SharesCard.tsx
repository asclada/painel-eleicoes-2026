import { BY_KEY, CANDIDATES } from "@/lib/candidates";
import { dec, pct } from "@/lib/format";
import type { CandKey, Shares } from "@/lib/types";
import { CandidateAvatar } from "./CandidateAvatar";

export function orderedKeys(shares: Shares): CandKey[] {
  const named = CANDIDATES.filter((c) => c.key !== "demais").map((c) => c.key);
  return [...named.sort((a, b) => shares[b] - shares[a]), "demais"];
}

export function CandidateDot({ k, size = 30 }: { k: CandKey; size?: number }) {
  return <CandidateAvatar k={k} size={size} />;
}

/** Cartão com a média em votos válidos, uma barra por candidato. */
export function SharesCard({
  badge,
  title,
  subtitle,
  shares,
  footer,
  keys: onlyKeys,
}: {
  badge: string;
  title: string;
  subtitle: string;
  shares: Shares;
  footer: React.ReactNode;
  /** mostra só estes candidatos (2º turno) */
  keys?: CandKey[];
}) {
  const keys = onlyKeys ?? orderedKeys(shares);
  return (
    <section className="card flex flex-col p-5">
      <div className="flex items-center gap-2">
        <span className="rounded-md bg-[#243059] px-2 py-0.5 text-[11px] font-semibold tracking-wide text-accent">{badge}</span>
        <h2 className="text-base font-semibold">{title}</h2>
      </div>
      <p className="mt-1 text-sm text-muted">{subtitle}</p>
      <ul className="mt-5 space-y-3">
        {keys.map((k, i) => {
          const c = BY_KEY[k];
          const big = i < 2;
          return (
            <li key={k}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="flex items-center gap-2 text-sm">
                  <CandidateDot k={k} size={big ? 34 : 26} />
                  <span className={big ? "font-medium" : "text-muted"}>{c.short}</span>
                  {c.party && <span className="text-xs text-faint">{c.party}</span>}
                </span>
                <span className={`num ${big ? "text-2xl font-semibold" : "text-base text-muted"}`}>{pct(shares[k])}</span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#1c2650]" role="presentation">
                <div className="h-full rounded-full" style={{ width: `${Math.min(100, (shares[k] / 55) * 100)}%`, background: c.color }} />
              </div>
            </li>
          );
        })}
      </ul>
      <div className="mt-5 border-t border-line pt-3 text-xs leading-relaxed text-muted">{footer}</div>
    </section>
  );
}

export function Gap({ shares }: { shares: Shares }) {
  const d = shares.lula - shares.flavio;
  const who = d > 0 ? "Lula" : "Flávio";
  return (
    <span>
      {who} à frente por <strong className="text-fg">{dec(Math.abs(d))} p.p.</strong>
    </span>
  );
}
