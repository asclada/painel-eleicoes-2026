"use client";

import { useEffect, useState } from "react";

const EVERY_MS = 30_000;

/** Um id por aba (some ao fechar a aba). */
function tabId() {
  const fresh = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
  try {
    let id = sessionStorage.getItem("online-id");
    if (!id) {
      id = fresh();
      sessionStorage.setItem("online-id", id);
    }
    return id;
  } catch {
    return fresh();
  }
}

/** Contador discreto de quem está com o painel aberto agora (aproximado; ver /api/online). */
export function OnlineCount() {
  const [n, setN] = useState<number | null>(null);

  useEffect(() => {
    const id = tabId();
    let alive = true;
    const ping = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const r = await fetch("/api/online", { method: "POST", body: JSON.stringify({ id }), cache: "no-store" });
        const j = (await r.json()) as { n?: number };
        if (alive && typeof j.n === "number") setN(j.n);
      } catch {
        // sem rede ou servidor fora: o contador só não atualiza
      }
    };
    ping();
    const t = setInterval(ping, EVERY_MS);
    const onVis = () => document.visibilityState === "visible" && ping();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      alive = false;
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  if (!n) return null;
  return (
    <div className="mt-2 text-[10px] text-faint/70" aria-live="off">
      ● {n} {n === 1 ? "pessoa" : "pessoas"} online agora
    </div>
  );
}
