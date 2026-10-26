"use client";

import { useState } from "react";

// Foto oficial da Presidência (Ricardo Stuckert/PR), CC BY 2.0, servida pelo Wikimedia Commons no tamanho pedido
const PHOTO =
  "https://commons.wikimedia.org/wiki/Special:FilePath/Foto_oficial_do_Presidente_da_Rep%C3%BAblica_Luiz_In%C3%A1cio_Lula_da_Silva.jpg?width=480";
// se o Commons falhar, usa a foto do TSE que já está no site
const FALLBACK = "/candidatos/lula.jpeg";

export function BannerPhoto() {
  const [src, setSrc] = useState(PHOTO);
  const official = src === PHOTO;
  return (
    <figure className="shrink-0">
      {/* eslint-disable-next-line @next/next/no-img-element -- imagem externa, com troca automática se falhar */}
      <img
        src={src}
        alt="Lula"
        width={176}
        height={220}
        onError={() => setSrc(FALLBACK)}
        className="h-[220px] w-[176px] rounded-2xl bg-white/10 object-cover object-top shadow-2xl ring-4 ring-white/80"
      />
      {official && <figcaption className="mt-1.5 text-center text-[10px] text-white/60">Foto: Ricardo Stuckert/PR (CC BY 2.0)</figcaption>}
    </figure>
  );
}
