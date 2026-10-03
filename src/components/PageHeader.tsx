import { SourceStatus } from "./SourceStatus";
import { TurnoToggle } from "./TurnoToggle";

export function PageHeader({
  title,
  subtitle,
  turno,
  basePath,
  keep,
  source,
}: {
  title: string;
  subtitle: string;
  turno: 1 | 2;
  basePath: string;
  keep?: Record<string, string | undefined>;
  source: "wikipedia" | "snapshot";
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-muted">{subtitle}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <SourceStatus source={source} />
        <TurnoToggle basePath={basePath} turno={turno} keep={keep} />
      </div>
    </div>
  );
}
