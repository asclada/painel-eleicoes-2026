import { demoCount, fetchTse } from "@/lib/tse";

export const dynamic = "force-dynamic";

/**
 * GET /api/apuracao?env=oficial|simulado|demo&p=40
 * O navegador não consegue ler o TSE direto (sem CORS), então o servidor busca e repassa.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const env = searchParams.get("env") ?? "oficial";
  const headers = { "Cache-Control": "no-store" };
  try {
    if (env === "demo") {
      return Response.json(demoCount(Number(searchParams.get("p") ?? 0)), { headers });
    }
    const data = await fetchTse(env === "simulado" ? "simulado" : "oficial");
    return Response.json(data, { headers });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "falha ao ler o TSE" }, { status: 502, headers });
  }
}
