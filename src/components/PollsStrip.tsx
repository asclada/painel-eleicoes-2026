import { dmy } from "@/lib/format";
import { todayBR } from "@/lib/model";
import { getPolls, publishedOf } from "@/lib/polls";

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full border border-line bg-[#0f1630] px-2.5 py-0.5 text-xs text-fg">{children}</span>;
}

/** Quais pesquisas já entraram nas contas (as mais recentes) e quais ainda estão para sair. */
export async function PollsStrip() {
  const { polls, pending } = await getPolls();
  const today = todayBR();
  const withDay = polls.map((p) => ({ p, day: publishedOf(p, today) }));
  const latest = withDay.reduce((a, x) => (x.day > a ? x.day : a), "");
  const latestNames = [...new Set(withDay.filter((x) => x.day === latest).map((x) => x.p.institute))];
  const waiting = [...new Map(pending.map((x) => [x.institute, x])).values()].sort((a, b) => a.institute.localeCompare(b.institute));

  return (
    <div className="card space-y-2 p-3 text-sm text-muted">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <span className="font-medium text-fg">Pesquisas e previsões atualizadas com as mais recentes do dia {dmy(latest)}:</span>
        {latestNames.map((n) => (
          <Chip key={n}>{n}</Chip>
        ))}
      </div>
      {waiting.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <span className="font-medium text-fg">Aguardando divulgação:</span>
          {waiting.map((x) => (
            <Chip key={x.institute}>
              {x.institute} {dmy(x.end > today ? x.end : today)}
            </Chip>
          ))}
        </div>
      )}
    </div>
  );
}
