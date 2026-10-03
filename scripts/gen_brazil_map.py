#!/usr/bin/env python3
"""
Gera src/lib/brazilPaths.ts com o contorno dos estados (malha do IBGE, domínio público).

  python scripts/gen_brazil_map.py

Baixa o SVG de https://servicodados.ibge.gov.br/api/v3/malhas (qualidade mínima, por UF), converte os
caminhos relativos em absolutos, aplica a escala (1 unidade = 0,1 grau) e calcula onde escrever a sigla.
"""
import re
import urllib.request
from pathlib import Path

URL = "https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?qualidade=minima&intrarregiao=UF&formato=image/svg+xml"
OUT = Path(__file__).resolve().parent.parent / "src" / "lib" / "brazilPaths.ts"

IBGE = {"11": "ro", "12": "ac", "13": "am", "14": "rr", "15": "pa", "16": "ap", "17": "to", "21": "ma", "22": "pi",
        "23": "ce", "24": "rn", "25": "pb", "26": "pe", "27": "al", "28": "se", "29": "ba", "31": "mg", "32": "es",
        "33": "rj", "35": "sp", "41": "pr", "42": "sc", "43": "rs", "50": "ms", "51": "mt", "52": "go", "53": "df"}

# ajuste fino da posição da sigla (em unidades do mapa) para estados pequenos ou de formato estranho
LABEL_SHIFT = {"df": (0.0, 0.0), "es": (1.2, 0.0), "rj": (0.0, 0.6), "pe": (0.0, 0.0), "pb": (0.5, 0.0), "rn": (0.4, 0.0)}


def rings(d):
    out, cur, x, y = [], [], 0.0, 0.0
    for cmd, args in re.findall(r"([MmLlHhVvZz])([^MmLlHhVvZz]*)", d):
        nums = [float(n) for n in re.findall(r"-?\d+(?:\.\d+)?", args)]
        if cmd == "M":
            if cur:
                out.append(cur)
            cur = []
            x, y = nums[0], nums[1]
            cur.append((x, y))
            for i in range(2, len(nums), 2):
                x, y = nums[i], nums[i + 1]
                cur.append((x, y))
        elif cmd == "l":
            for i in range(0, len(nums), 2):
                x, y = x + nums[i], y + nums[i + 1]
                cur.append((x, y))
        elif cmd == "h":
            for n in nums:
                x += n
                cur.append((x, y))
        elif cmd == "v":
            for n in nums:
                y += n
                cur.append((x, y))
        elif cmd in "Zz":
            if cur:
                out.append(cur)
                cur = []
    if cur:
        out.append(cur)
    return out


def main():
    req = urllib.request.Request(URL, headers={"User-Agent": "eleicoes-2026-simulacao/1.0"})
    svg = urllib.request.urlopen(req, timeout=60).read().decode("utf-8")
    vb = [float(v) for v in re.search(r'viewBox="([^"]+)"', svg).group(1).split()]
    min_lon, min_lat = vb[0], vb[1]
    paths = re.findall(r'<path id="(\d+)" d="([^"]+)"', svg)

    def tr(p):  # coordenadas do arquivo -> unidades do mapa (0,1 grau)
        return ((p[0] * 0.0001 - min_lon) * 10, (-p[1] * 0.0001 - min_lat) * 10)

    items = []
    for pid, d in paths:
        rs = [[tr(p) for p in r] for r in rings(d)]
        dd = " ".join("M" + " L".join(f"{x:.1f},{y:.1f}" for x, y in r) + "Z" for r in rs)
        # centro da sigla: centroide do maior anel
        big = max(rs, key=lambda r: abs(sum(r[i][0] * r[(i + 1) % len(r)][1] - r[(i + 1) % len(r)][0] * r[i][1] for i in range(len(r)))))
        a = cx = cy = 0.0
        for i in range(len(big)):
            x0, y0 = big[i]
            x1, y1 = big[(i + 1) % len(big)]
            c = x0 * y1 - x1 * y0
            a += c
            cx += (x0 + x1) * c
            cy += (y0 + y1) * c
        a /= 2
        cx, cy = cx / (6 * a), cy / (6 * a)
        code = IBGE[pid]
        sx, sy = LABEL_SHIFT.get(code, (0.0, 0.0))
        items.append((code, dd, cx + sx, cy + sy))

    w = (vb[2]) * 10
    h = (vb[3]) * 10
    lines = [
        "// GERADO por scripts/gen_brazil_map.py a partir da malha do IBGE (qualidade mínima). Não editar à mão.",
        f"export const BRAZIL_VIEWBOX = {{ w: {w:.1f}, h: {h:.1f} }};",
        "",
        "export const BRAZIL_PATHS: { code: string; d: string; cx: number; cy: number }[] = [",
    ]
    for code, dd, cx, cy in items:
        lines.append(f'  {{ code: "{code}", d: "{dd}", cx: {cx:.1f}, cy: {cy:.1f} }},')
    lines.append("];")
    OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"{len(items)} estados -> {OUT} ({OUT.stat().st_size // 1024} KB), viewBox {w:.0f}x{h:.0f}")


if __name__ == "__main__":
    main()
