"""
Base da projeção do 2º turno: resultado do 1º turno de 2026 (presidente) em cada município e, nas cidades com
mais de uma zona eleitoral, em cada zona. Lê os arquivos públicos do TSE (eleição 6257) e grava data/base-r1.json.

Rodar uma vez depois do 1º turno:  python scripts/build_base_r1.py
São ~6.500 arquivos pequenos; leva poucos minutos.
"""

import json
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from pathlib import Path

BASE = "https://resultados.tse.jus.br/oficial/ele2026/6257"
UA = {"User-Agent": "Mozilla/5.0 (compatible; eleicoes-2026-simulacao/1.0)"}
OUT = Path(__file__).resolve().parent.parent / "data" / "base-r1.json"
START = datetime(2026, 10, 4, 17, 0)  # início da apuração (Brasília)


def get(url: str, tries: int = 4):
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=20) as r:
                raw = r.read()
            try:
                txt = raw.decode("utf-8")
            except UnicodeDecodeError:
                txt = raw.decode("latin-1")
            return json.loads(txt.lstrip("﻿"))
        except Exception:  # noqa: BLE001 - rede instável: tenta de novo
            if i == tries - 1:
                raise
            time.sleep(1.5 * (i + 1))


def n(s) -> int:
    return int(str(s or "0").replace(".", "").split(",")[0] or 0)


def votes(j) -> list[int]:
    """[seções, eleitorado, comparecimento, válidos, lula, flávio]"""
    lula = flavio = 0
    for agr in j["carg"][0].get("agr", []):
        for par in agr.get("par", []):
            for c in par.get("cand", []):
                if c["n"] == "13":
                    lula = n(c["vap"])
                elif c["n"] == "22":
                    flavio = n(c["vap"])
    return [n(j["s"]["ts"]), n(j["e"]["te"]), n(j["e"]["c"]), n(j["v"]["vv"]), lula, flavio]


def minutes(dt: str, ht: str) -> int:
    """Minutos depois das 17h de 04/10 em que o município terminou de apurar (para reproduzir a ordem da contagem)."""
    if not dt or not ht:
        return -1
    d = datetime.strptime(f"{dt} {ht}", "%d/%m/%Y %H:%M:%S")
    return max(0, round((d - START).total_seconds() / 60))


def main():
    cfg = get(f"{BASE}/config/mun-e006257-cm.json")
    jobs = []  # (uf, mun, zona|None)
    for uf in cfg["abr"]:
        for m in uf["mu"]:
            jobs.append((uf["cd"], m["cd"], None))
            if len(m["z"]) > 1:
                jobs += [(uf["cd"], m["cd"], z) for z in m["z"]]

    def fetch(job):
        uf, mun, z = job
        zpart = f"-z{z}" if z else ""
        return job, votes(get(f"{BASE}/dados/{uf}/{uf}{mun}{zpart}-c0001-e006257-u.json"))

    print(f"{len(jobs)} arquivos…")
    res = {}
    with ThreadPoolExecutor(max_workers=12) as ex:
        for i, (job, v) in enumerate(ex.map(fetch, jobs), 1):
            res[job] = v
            if i % 500 == 0:
                print(i)

    finish = {}
    for uf in cfg["abr"]:
        ab = get(f"{BASE}/dados/{uf['cd']}/{uf['cd']}-e006257-ab.json")
        for a in ab["abr"]:
            if a["tpabr"] == "mun":
                finish[(uf["cd"], a["cdabr"])] = minutes(a.get("dt", ""), a.get("ht", ""))

    ufs = {}
    tot = [0, 0, 0]
    for uf in cfg["abr"]:
        code = uf["cd"]
        mun, zones = [], {}
        for m in uf["mu"]:
            v = res[(code, m["cd"], None)]
            mun.append([m["cd"], *v, finish.get((code, m["cd"]), -1)])
            tot[0] += v[3]
            tot[1] += v[4]
            tot[2] += v[5]
            if len(m["z"]) > 1:
                zones[m["cd"]] = [[z, *res[(code, m["cd"], z)]] for z in m["z"]]
        ufs[code] = {"mun": mun, "zones": zones}

    out = {
        "source": "TSE · resultado do 1º turno de 2026 (eleição 6257), por município e por zona",
        "generatedAt": datetime.now().strftime("%Y-%m-%d"),
        "columns": {
            "mun": ["município", "seções", "eleitorado", "comparecimento", "válidos", "lula", "flávio", "minutos após 17h até fechar"],
            "zones": ["zona", "seções", "eleitorado", "comparecimento", "válidos", "lula", "flávio"],
        },
        "national": {"valid": tot[0], "lula": tot[1], "flavio": tot[2]},
        "ufs": ufs,
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"ok: {OUT} · Lula {tot[1] / tot[0] * 100:.2f}% · Flávio {tot[2] / tot[0] * 100:.2f}%")


if __name__ == "__main__":
    main()
