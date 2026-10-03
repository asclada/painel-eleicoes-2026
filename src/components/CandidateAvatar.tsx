import Image from "next/image";
import { BY_KEY } from "@/lib/candidates";
import type { CandKey } from "@/lib/types";

/** Foto oficial do TSE (salva em public/candidatos) com anel na cor do candidato. "Demais" não tem foto. */
export function CandidateAvatar({ k, size = 28 }: { k: CandKey; size?: number }) {
  const c = BY_KEY[k];
  const style = { width: size, height: size, boxShadow: `0 0 0 2px ${c.color}`, margin: 2 };
  if (k === "demais") {
    return (
      <span className="inline-flex shrink-0 items-center justify-center rounded-full bg-[#1c2650] text-muted" style={{ ...style, fontSize: size * 0.4 }} aria-hidden>
        …
      </span>
    );
  }
  return (
    <Image
      src={`/candidatos/${k}.jpeg`}
      alt=""
      aria-hidden
      width={size * 2}
      height={size * 2}
      className="shrink-0 rounded-full bg-[#1c2650] object-cover object-top"
      style={style}
    />
  );
}
