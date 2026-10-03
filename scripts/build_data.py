#!/usr/bin/env python3
"""
Monta a base de pesquisas a partir da Wikipédia (pt) e grava JSONs em data/.

  python scripts/build_data.py

Gera:
  data/polls2026.json   pesquisas nacionais de 1º turno de 2026 (candidatos oficiais)
  data/history.json     últimas pesquisas de 2018 e 2022 + resultado real (votos válidos)

Requer: pip install beautifulsoup4 lxml
Fonte das pesquisas: páginas "Pesquisas de opinião para a eleição presidencial no Brasil em
2018/2022/2026" da Wikipédia, que por sua vez citam os registros do TSE (PesqEle).
"""
import json
import re
import sys
import urllib.parse
import unicodedata
import urllib.request
from datetime import date
from pathlib import Path

from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data"
OUT.mkdir(exist_ok=True)

PAGES = {
    2026: "Pesquisas_de_opinião_para_a_eleição_presidencial_no_Brasil_em_2026",
    2022: "Pesquisas_de_opinião_para_a_eleição_presidencial_no_Brasil_em_2022",
    2018: "Pesquisas_de_opinião_para_a_eleição_presidencial_no_Brasil_em_2018",
}
ELECTION_DAY = {2026: date(2026, 10, 4), 2022: date(2022, 10, 2), 2018: date(2018, 10, 7)}

# Resultado oficial do 1º turno (TSE), em % dos votos válidos.
RESULTS = {
    2022: {"Lula": 48.43, "Bolsonaro": 43.20, "Tebet": 4.16, "Ciro": 3.04},
    2018: {"Bolsonaro": 46.03, "Haddad": 29.28, "Ciro": 12.47, "Alckmin": 4.76},
}

MONTHS = {"jan": 1, "fev": 2, "mar": 3, "abr": 4, "mai": 5, "jun": 6, "jul": 7, "ago": 8,
          "set": 9, "out": 10, "nov": 11, "dez": 12,
          "janeiro": 1, "fevereiro": 2, "março": 3, "abril": 4, "maio": 5, "junho": 6, "julho": 7,
          "agosto": 8, "setembro": 9, "outubro": 10, "novembro": 11, "dezembro": 12}


def fetch(title):
    url = ("https://pt.wikipedia.org/w/api.php?action=parse&prop=text&format=json&formatversion=2&page="
           + urllib.parse.quote(title))
    req = urllib.request.Request(url, headers={"User-Agent": "eleicoes-2026-simulacao/1.0 (uso pessoal)"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return BeautifulSoup(json.load(r)["parse"]["text"], "lxml")


def text(c):
    for s in c.select("sup,style,.mw-editsection"):
        s.decompose()
    return re.sub(r"\s+", " ", c.get_text(" ", strip=True)).strip()


def grid(t):
    """Expande rowspan/colspan numa matriz de strings."""
    rows, pend = [], {}
    for tr in t.find_all("tr"):
        row, ci = [], 0

        def fill():
            nonlocal ci
            while ci in pend and pend[ci][0] > 0:
                row.append(pend[ci][1])
                pend[ci][0] -= 1
                ci += 1

        for c in tr.find_all(["td", "th"]):
            fill()
            rs, cs = int(c.get("rowspan", 1) or 1), int(c.get("colspan", 1) or 1)
            v = text(c)
            for _ in range(cs):
                row.append(v)
                if rs > 1:
                    pend[ci] = [rs - 1, v]
                ci += 1
        fill()
        rows.append(row)
    return rows


def tables(soup):
    cur = {"h2": "", "h3": "", "h4": ""}
    for el in soup.find_all(["h2", "h3", "h4", "table"]):
        if el.name in ("h2", "h3", "h4"):
            cur[el.name] = text(el)
            if el.name == "h2":
                cur["h3"] = cur["h4"] = ""
            if el.name == "h3":
                cur["h4"] = ""
        elif "wikitable" in (el.get("class") or []):
            yield dict(cur), el


def strip_accents(s):
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")


def num(s):
    """'43,9%' -> 43.9 ; '<1%' -> 0.5 ; '-'/'—' -> None ; '4 006' -> 4006."""
    s = s.replace("\xa0", " ").strip()
    if not s or s in {"-", "—", "–", "N/A", "n/d"}:
        return None
    if s.startswith("<"):
        return 0.5
    m = re.search(r"(\d[\d\s.]*(?:,\d+)?)", s)
    if not m:
        return None
    raw = m.group(1).strip().replace(" ", "")
    if "," in raw:
        raw = raw.replace(".", "").replace(",", ".")
    elif re.fullmatch(r"\d{1,3}(\.\d{3})+", raw):
        raw = raw.replace(".", "")
    try:
        return float(raw)
    except ValueError:
        return None


def parse_dates(s, year):
    """Retorna (inicio, fim) como date a partir de textos como '28 Set – 1 Out', '25–26 Set',
    '5–6 de outubro de 2018'. O mês final é o último mês citado."""
    s = re.sub(r"(19|20)\d{2}", "", strip_accents(s.lower()))
    toks = re.findall(r"(\d{1,2})(?:\s*de)?\s*(?:([a-z]{3,9}))?", s)
    toks = [(int(d), MONTHS.get(m) or MONTHS.get(m[:3]) if m else None) for d, m in toks if 1 <= int(d) <= 31]
    if not toks:
        return None
    end_month = next((m for _, m in reversed(toks) if m), None)
    if end_month is None:
        return None
    end_day = toks[-1][0]
    start_day, start_month = toks[0]
    start_month = start_month or end_month
    try:
        end = date(year, end_month, end_day)
        start = date(year, start_month, start_day)
    except ValueError:
        return None
    if start > end:  # '30–2 Out' sem mês no início
        start = date(year if start_month < 12 else year - 1, start_month - 1 or 12, start_day)
    return start, end


# --- Institutos -------------------------------------------------------------------------------
ALIASES = [  # (trecho em minúsculas sem acento, nome canônico) — a ordem importa
    ("datafolha", "Datafolha"), ("ipec", "Ipec"), ("ibope", "Ipec"), ("quaest", "Quaest"),
    ("atlas", "AtlasIntel"), ("parana", "Paraná Pesquisas"), ("poderdata", "PoderData"),
    ("datapoder", "PoderData"), ("real time", "Real Time Big Data"), ("mda", "CNT/MDA"),
    ("verita", "Veritá"), ("futura", "Futura"), ("gerp", "Gerp"), ("ideia", "Ideia"),
    ("nexus", "Nexus"), ("fsb", "Nexus"), ("ipespe", "Ipespe"), ("brasmarket", "Brasmarket"),
    ("vox populi", "Vox Populi"), ("vox", "Vox Brasil"), ("palver", "Palver"), ("indexa", "Indexa"),
    ("alfa", "Alfa Inteligência"), ("datatrends", "DataTrends"), ("data trends", "DataTrends"),
    ("american analytics", "American Analytics"), ("times", "American Analytics"),
    ("equilibrio", "Equilíbrio Brasil"), ("meio", "Ideia"), ("vetor", "Vetor/Arrow"),
    ("arrow", "Vetor/Arrow"), ("paranapesquisas", "Paraná Pesquisas"),
]


def inst_name(raw):
    raw = re.sub(r"BR-\d+/\d{4}", "", raw).strip()
    key = strip_accents(raw.lower())
    for frag, name in ALIASES:
        if frag in key:
            return name
    return raw.split("/")[-1].strip() or raw


# --- 2026 --------------------------------------------------------------------------------------
CAND26 = {"lula": "lula", "flavio": "flavio", "cury": "cury", "caiado": "caiado", "renan": "renan", "zema": "zema"}
NAMED_OTHERS26 = {"samara", "grassi", "clariana", "dias", "costa", "pimenta", "avalanche"}


def parse_2026():
    soup = fetch(PAGES[2026])
    polls, seen = [], set()
    month_h4 = {"Outubro", "Setembro", "Agosto", "Julho", "Junho", "Maio", "Abril", "Março", "Janeiro - Fevereiro"}
    for h, t in tables(soup):
        if h["h2"] != "Primeiro turno" or h["h3"] != "2026" or h["h4"] not in month_h4:
            continue
        g = grid(t)
        hdr = next((r for r in g if any(strip_accents(c.lower()).startswith("lula") for c in r)), None)
        if not hdr:
            continue
        cols = {}
        for i, c in enumerate(hdr):
            k = strip_accents(c.lower().split(" ")[0])
            if k in CAND26:
                cols[CAND26[k]] = i
            elif k in NAMED_OTHERS26:
                cols.setdefault("_demais", []).append(i)
            elif k.startswith("outros"):
                cols["outros"] = i
            elif k.startswith("indecis"):
                cols["indecisos"] = i
        for r in g:
            if len(r) != len(hdr) or r[0].startswith("Contratante") or len(set(r[:4])) == 1:
                continue
            vals = {k: num(r[i]) for k, i in cols.items() if k != "_demais"}
            if vals.get("lula") is None or vals.get("flavio") is None:
                continue
            demais = [num(r[i]) for i in cols.get("_demais", [])]
            dts = parse_dates(r[1], 2026)
            if not dts:
                continue
            inst = inst_name(r[0])
            n = num(r[2])
            moe = num(r[3])
            key = (inst, dts[1], int(n or 0))
            if key in seen:
                continue
            seen.add(key)
            polls.append({
                "institute": inst,
                "start": dts[0].isoformat(),
                "end": dts[1].isoformat(),
                "n": int(n) if n else None,
                "moe": moe,
                "lula": vals.get("lula"), "flavio": vals.get("flavio"), "cury": vals.get("cury"),
                "caiado": vals.get("caiado"), "renan": vals.get("renan"), "zema": vals.get("zema"),
                "demais": round(sum(d for d in demais if d is not None), 2),
                "outros": vals.get("outros"),
                "indecisos": vals.get("indecisos"),
            })
    polls.sort(key=lambda p: (p["end"], p["institute"]), reverse=True)
    return polls


# --- 2022 --------------------------------------------------------------------------------------
def parse_2022():
    soup = fetch(PAGES[2022])
    out = []
    for h, t in tables(soup):
        if h["h2"] != "Primeiro turno" or h["h3"] != "2022" or not h["h4"].startswith("3"):
            continue
        g = grid(t)
        hdr = next(r for r in g if any(c.startswith("Bolsonaro") for c in r))
        cols = {}
        for i, c in enumerate(hdr):
            k = c.split(" ")[0]
            if k in ("Bolsonaro", "Lula", "Gomes", "Tebet"):
                cols[{"Gomes": "Ciro"}.get(k, k)] = i
            elif k.startswith("Outros"):
                cols["outros"] = i
            elif k.startswith("Indecisos"):
                cols["indecisos"] = i
        for r in g:
            if len(r) != len(hdr) or r[0].startswith("Contratante") or len(set(r[:4])) == 1:
                continue
            vals = {k: num(r[i]) for k, i in cols.items()}
            if any(vals.get(k) is None for k in ("Bolsonaro", "Lula", "Ciro", "Tebet")):
                continue
            named = sum(num(c) or 0 for c in r[4:cols["outros"]])  # todos os candidatos nominais
            dts = parse_dates(r[1], 2022)
            if not dts:
                continue
            out.append({"institute": inst_name(r[0]), "end": dts[1].isoformat(), "n": num(r[2]), "moe": num(r[3]),
                        "Lula": vals["Lula"], "Bolsonaro": vals["Bolsonaro"], "Ciro": vals["Ciro"],
                        "Tebet": vals["Tebet"], "nominalTotal": round(named + (vals.get("outros") or 0), 2)})
    return out


# --- 2018 --------------------------------------------------------------------------------------
def parse_2018():
    soup = fetch(PAGES[2018])
    out = []
    for h, t in tables(soup):
        if h["h2"] != "Primeiro turno" or h["h3"] != "Pesquisas":
            continue
        g = grid(t)
        if len(g) < 50:
            continue
        for r in g[2:]:
            if len(r) < 14:
                continue
            dts = parse_dates(r[0], 2018)
            if not dts:
                continue
            cells = r[4:13]
            vals = {}
            nominal = 0.0
            for c in cells:
                m = re.match(r"\s*([\d.,]+)\s*%?\s*\(([^)]+)\)", c)
                if not m:
                    continue
                v = num(m.group(1))
                name = strip_accents(m.group(2)).strip()
                nominal += v or 0
                key = {"Haddad": "Haddad", "Gomes": "Ciro", "Bolsonaro": "Bolsonaro", "Alckmin": "Alckmin"}.get(name)
                if key:
                    vals[key] = v
            if len(vals) < 4:
                continue
            nominal += num(r[13]) or 0
            out.append({"institute": inst_name(r[1]), "end": dts[1].isoformat(), "n": num(r[2]), "moe": num(r[3]),
                        **vals, "nominalTotal": round(nominal, 2)})
    return out


def last_week(polls, year, days=10):
    cutoff = ELECTION_DAY[year].toordinal() - days
    return [p for p in polls if date.fromisoformat(p["end"]).toordinal() >= cutoff
            and date.fromisoformat(p["end"]) < ELECTION_DAY[year]]


def main():
    p26 = parse_2026()
    (OUT / "polls2026.json").write_text(json.dumps(
        {"source": "Wikipédia (pt) – pesquisas registradas no TSE", "generatedAt": date.today().isoformat(),
         "polls": p26}, ensure_ascii=False, indent=1), encoding="utf-8")
    hist = {"results": RESULTS, "elections": {}}
    for y, fn in ((2022, parse_2022), (2018, parse_2018)):
        hist["elections"][str(y)] = last_week(fn(), y)
    (OUT / "history.json").write_text(json.dumps(hist, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"2026: {len(p26)} pesquisas | 2022: {len(hist['elections']['2022'])} finais | "
          f"2018: {len(hist['elections']['2018'])} finais")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
