import { demoUfCounts, fetchAllUfs } from "@/lib/tse";

export const dynamic = "force-dynamic";

/** GET /api/apuracao/uf?env=oficial|simulado|demo&p=40 : contagem de cada estado e do exterior. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const env = searchParams.get("env") ?? "oficial";
  const headers = { "Cache-Control": "no-store" };
  try {
    if (env === "demo") return Response.json(demoUfCounts(Number(searchParams.get("p") ?? 0)), { headers });
    return Response.json(await fetchAllUfs(env === "simulado" ? "simulado" : "oficial"), { headers });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "falha ao ler o TSE" }, { status: 502, headers });
  }
}
