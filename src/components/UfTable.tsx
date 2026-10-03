import { BY_KEY } from "@/lib/candidates";
import { dec, pct } from "@/lib/format";
import { EXTERIOR, UFS } from "@/lib/ufs";
import { CandidateAvatar } from "./CandidateAvatar";
import { type UfCounts, ufLeader } from "./BrazilMap";

export function UfTable({ counts }: { counts: UfCounts | null }) {
  const rows = [...UFS.map((u) => ({ code: u.code, name: u.name })), { code: EXTERIOR.code, name: EXTERIOR.name }];
  return (
    <div className="scroll-x max-h-[520px] overflow-y-auto">
      <table className="w-full min-w-[420px] text-sm">
        <thead className="sticky top-0 bg-[#131b36] text-xs text-faint">
          <tr className="border-b border-line">
            <th className="py-2 pr-2 text-left font-medium">Estado</th>
            <th className="py-2 pr-2 text-right font-medium">Apurado</th>
            <th className="py-2 pr-2 text-right font-medium" style={{ color: BY_KEY.lula.color }}>Lula</th>
            <th className="py-2 pr-2 text-right font-medium" style={{ color: BY_KEY.flavio.color }}>Flávio</th>
            <th className="py-2 text-left font-medium">Na frente</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const c = counts?.[r.code];
            const l = ufLeader(c);
            return (
              <tr key={r.code} className="border-b border-line/50">
                <td className="py-1.5 pr-2">{r.name}</td>
                <td className="num py-1.5 pr-2 text-right text-muted">{c ? pct(c.pctSections, 0) : "—"}</td>
                <td className="num py-1.5 pr-2 text-right">{l && c ? pct(c.shares.lula) : "—"}</td>
                <td className="num py-1.5 pr-2 text-right">{l && c ? pct(c.shares.flavio) : "—"}</td>
                <td className="py-1.5">
                  {l ? (
                    <span className="flex items-center gap-1.5">
                      <CandidateAvatar k={l.key} size={18} />
                      <span className="text-xs text-muted">+{dec(l.margin)}</span>
                    </span>
                  ) : (
                    <span className="text-xs text-faint">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
