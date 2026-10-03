"use client";

import { useEffect, useState } from "react";

/** Busca `url` agora e depois a cada `everyMs` (ou só uma vez se `null`). Mantém o último dado bom se uma leitura falhar. */
export function useFetchLoop<T>(url: string, everyMs: number | null) {
  const [state, setState] = useState<{ data: T | null; err: string | null; lastOk: number | null }>({ data: null, err: null, lastOk: null });
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const res = await fetch(url, { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
        if (alive) setState({ data: json as T, err: null, lastOk: Date.now() });
      } catch (e) {
        if (alive) setState((s) => ({ ...s, err: e instanceof Error ? e.message : "falha ao carregar" }));
      }
    };
    void tick();
    if (everyMs === null) return () => { alive = false; };
    const id = setInterval(tick, everyMs);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [url, everyMs]);
  return state;
}
