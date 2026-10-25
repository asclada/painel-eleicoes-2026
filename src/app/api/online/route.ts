export const dynamic = "force-dynamic";

/** Quem mandou sinal nos últimos 70 s (cada aba manda a cada 30 s). Fica na memória do servidor: sem banco. */
const seen = new Map<string, number>();
const TTL_MS = 70_000;

/**
 * POST /api/online  { id }  ->  { n }
 * Contador discreto de pessoas com o painel aberto. É aproximado: se a Vercel abrir mais de uma instância
 * do servidor, cada uma conta só quem caiu nela; se a instância reiniciar, o número volta a subir em ~30 s.
 */
export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  let id = "";
  try {
    const body = (await request.json()) as { id?: unknown };
    if (typeof body.id === "string" && /^[a-z0-9-]{8,40}$/i.test(body.id)) id = body.id;
  } catch {
    // corpo inválido: só devolve a contagem
  }
  const now = Date.now();
  if (id) seen.set(id, now);
  for (const [k, t] of seen) if (now - t > TTL_MS) seen.delete(k);
  return Response.json({ n: seen.size }, { headers });
}
