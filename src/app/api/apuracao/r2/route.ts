import { after } from "next/server";
import { demoLive2, getLive2 } from "@/lib/live2";

export const dynamic = "force-dynamic";
// a primeira leitura (todas as zonas e o andamento de cada município) pode levar uns 20 s
export const maxDuration = 60;

/**
 * GET /api/apuracao/r2?env=oficial|demo&p=40
 * 2º turno: contagem do Brasil e de cada estado + projeção do resultado final (lê também o andamento por
 * município e as zonas das cidades grandes). O navegador não consegue ler o TSE direto (sem CORS).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const headers = { "Cache-Control": "no-store" };
  try {
    const data = searchParams.get("env") === "demo" ? await demoLive2(Number(searchParams.get("p") ?? 0)) : await getLive2((work) => after(work));
    return Response.json(data, { headers });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "falha ao ler o TSE" }, { status: 502, headers });
  }
}
