@AGENTS.md

# Eleição 2026 · Simulação

## Objetivo
Painel pessoal (Lucas e o pai) para acompanhar a eleição presidencial de 2026: pesquisas em votos válidos, previsões e apuração ao vivo (1º turno em 04/10/2026; 2º turno Lula × Flávio em 25/10/2026, resultados a partir das 17h de Brasília) com projeção do resultado final, comparando a contagem real com o que pesquisas e previsões apontavam. Inspirado no EleiçãoBR (eleicaobr.netlify.app), de forma simplificada. Candidatos acompanhados: Lula, Flávio Bolsonaro, Caiado, Cury, Renan Santos, Zema (+ "Demais").

## Stack e arquitetura
- Next.js 16 (App Router, TypeScript, Tailwind v4), hospedagem na Vercel (https://painel-eleicoes-2026.vercel.app, região `gru1` em `vercel.json`; repo público asclada/painel-eleicoes-2026 (github.com/asclada/painel-eleicoes-2026), push na `master` publica). Sem banco de dados.
- `src/lib/polls.ts`: lê a seção "Primeiro turno > 2026" da Wikipédia (API `action=parse`, ~5 min de cache em memória), com fallback em `data/polls2026.json`, mais `data/manual-polls.json` para pesquisas ainda não registradas lá. Também lista as pesquisas "aguardando divulgação".
- `src/lib/model.ts`: votos válidos, média ponderada (recência, margem de erro, amortecimento por instituto), histórico de acerto 2018/2022, institutos "certeiros", previsão com 20 mil simulações.
- `src/lib/tse.ts` + `src/app/api/apuracao/route.ts`: leitura do JSON público do TSE (o navegador não consegue por CORS). Eleição 6257 = 1º turno, 6258 = 2º turno (campo `cdt2` de `oficial/comum/config/ele-c.json`). Modos `?env=demo` e `?env=simulado` (só 1º turno) para testar.
- Apuração do 2º turno: `src/lib/live2.ts` + `/api/apuracao/r2` juntam Brasil, UFs, andamento por município (arquivos `{uf}-e006258-ab.json`) e as 725 zonas das 190 cidades com mais de uma zona (`{uf}{mun}-z{zona}-c0001-e006258-u.json`); cache de 15 s servindo a última leitura na hora e atualizando com `after`.
- `src/lib/projection.ts`: projeção do resultado final. Base = 1º turno de 2026 por município/zona (`data/base-r1.json`, gerado por `scripts/build_base_r1.py`); swing do que já foi apurado aplicado ao que falta, encolhido zona → UF → região → Brasil → média das pesquisas. `src/lib/sim2.ts` gera apurações inventadas (demo e teste) na ordem real em que os municípios fecharam no 1º turno.
- Telas da apuração: `ApuracaoLive2` (2º turno) e `ApuracaoLive` (1º turno); `StatesPanel` (mapa com toque + regiões recolhíveis) substituiu `BrazilMap`/`UfTable`.
- `scripts/build_data.py`: regenera `data/history.json` (últimas pesquisas de 2018/2022 + resultado oficial) e `data/polls2026.json`.

## Decisões importantes (sessão de 03/10/2026)
- Duas leituras lado a lado em tudo: **A** = todas as pesquisas (janela de 90 dias, meia-vida de 7 dias) e **B** = só os 6 institutos ativos com melhor nota histórica (2018 e 2022; 2022 pesa o dobro; 2014 ficou de fora porque poucos institutos de hoje existiam).
- Nota de acerto: erro nos 4 mais votados, com os 2 primeiros valendo o dobro, encolhida para a média quando há só uma eleição. Ibope (2018) foi tratado como Ipec.
- Previsão usa 20% do viés histórico por padrão (chave 0/20/50% em `/previsoes`), como no EleiçãoBR; sem a correção, Previsão e Pesquisa teriam a mesma média.
- Atualização: páginas dinâmicas; a Wikipédia é lida pelo cache de dados do Next (`next.revalidate` = 90 s, compartilhado e com serve-stale), e as contas ficam em memória por versão das pesquisas (`estimates.ts`). A seção do 1º turno pesa 1,1 MB e a Wikipédia leva 4-7 s para montá-la, por isso nada espera por ela (limite de 8 s só na 1ª carga a frio, depois cai para `data/polls2026.json`). Após cada deploy, aquecer o cache abrindo `/`.
- A Wikipédia atrasa horas para registrar pesquisas novas. Para publicar rápido, lançar a pesquisa em `data/manual-polls.json` (1º turno) e `data/manual-polls-r2.json` (2º turno) com `published` = dia da divulgação; ela substitui a da Wikipédia do mesmo instituto e dia. Fontes de conferência: Poder360, Gazeta do Povo, Exame, CNN Brasil, g1 (texto corrido, não há fonte estruturada rápida).
- Faixa `PollsStrip`: "Pesquisas e previsões atualizadas com as mais recentes do dia DD/MM" (dia = `published` ou fim do campo + 1) e "Aguardando divulgação" (só as anunciadas nos últimos 2 dias e ainda sem resultado).
- Apuração por estado: mapa real do Brasil (contorno IBGE em `src/lib/brazilPaths.ts`, gerado por `scripts/gen_brazil_map.py`) + tabela (`BrazilMap`, `UfTable`). O Lucas decidiu NÃO ter Modo TV. Só contagem real por UF; não há pesquisas/previsões por estado.
- O aviso verde "pesquisas lidas da Wikipédia" foi removido a pedido; só aparece um alerta âmbar se a leitura falhar.
- 2º turno (Lula × Flávio apenas, decisão do Lucas) em Pesquisas e Previsões. Desde 14/10/2026 o **2º turno é o padrão** em `/` e `/previsoes`; o 1º turno fica em `?turno=1` (botão no topo): média A (todas), média B (certeiros em 2018/2022), previsão com curva normal (`forecast2` em `model.ts`, `getEstimates2`). A apuração abre no 2º turno (ver decisões de 23/10).
- Correção do viés: padrão 20% em ambos os turnos. No backtest com 2018+2022 (um de fora), corrigir mais (50-100%) reduz o erro, mas o efeito sobre as chances é pequeno (~1 p.p.). Lucas preferiu não mudar o método.
- Fotos oficiais dos candidatos em `public/candidatos/` (baixadas do TSE).
- Não enviar o e-mail do Lucas em requisições externas (o User-Agent da Wikipédia não leva contato).

## Decisões importantes (sessão de 23/10/2026)
- Média e previsão do 2º turno só com pesquisas de campo terminado a partir de 05/10 (`R2_SINCE` em `polls.ts`); as "se o 2º turno fosse hoje" de antes do 1º turno saíram. Pesquisas pendentes do 2º turno também são lidas da Wikipédia.
- `/apuracao` abre no 2º turno; `?turno=1` mostra o resultado oficial do 1º turno (contas do 1º turno congeladas em 04/10, `ELECTION_DAY_1` em `estimates.ts`).
- Projeção: antes da 1ª urna vale a Previsão A; a fatia dos votos dos outros candidatos do 1º turno que vai ao Lula é calibrada para bater com as pesquisas. Incerteza calibrada numa simulação pessimista (seções urbanas apurando antes em todo lugar, viés comum ~2,5 p.p.): faixa de 90% cobre ~90% dos casos. Tentou-se estimar esse viés pelas zonas (regressão), mas ficou ruidoso e foi descartado.
- Tudo pensado primeiro para celular: cabeçalho só fica fixo no computador; na apuração há uma faixa fixa com placar, % apurado e projeção; mapa responde ao toque; estados agrupados por região.
- Teste de ponta a ponta da leitura ao vivo: `readLive(1)` em `live2.ts` lê os arquivos (completos) do 1º turno e a projeção bate exatamente com o resultado.

## Como descobrir o estado atual
- Rodar: `npm run dev` e abrir `/`, `/previsoes`, `/apuracao?env=demo`.
- Pesquisas lidas hoje e pendentes: rodar o app e ver o selo de fonte e o aviso "Aguardando divulgação" em `/`; ou consultar `data/polls2026.json` (cópia salva) e `data/manual-polls.json`.
- Ranking de institutos: tabela "Quem acertou mais em 2018 e 2022" em `/`, calculada a partir de `data/history.json`.
- Apuração: 2º turno em `GET /api/apuracao/r2` (oficial) e `?env=demo&p=40`; 1º turno em `GET /api/apuracao`, `?env=simulado`, `?env=demo&p=40`. Telas: `/apuracao`, `/apuracao?env=demo`, `/apuracao?turno=1`. Códigos TSE: 6257 (1º turno), 6258 (2º turno), 21270 (simulado).
- Verificações: `npx tsc --noEmit`, `npx eslint src`, `npm run build`.

## Pendente / próximos passos
- Depois de 25/10: conferir a projeção contra o resultado e decidir o que fazer com o painel.

Última atualização: 23/10/2026 (apuração do 2º turno com projeção). Pesquisas de 2º turno: a cópia da Wikipédia (`data/polls2026_r2.json`) já traz tudo até 23/10; `data/manual-polls-r2.json` só serve para o que a Wikipédia ainda não registrou e, para não contar em dobro, o `end` de cada entrada manual tem de ser igual ao da Wikipédia (corrigida a Datafolha de 6-8/10, que estava com fim em 07/10). Rotina diária de pesquisas ativa, presa à sessão do Claude que a criou (21h47 de Brasília, até 25/10).

Registro de 22/10: pesquisas de 2º turno de 05 a 22/10 lançadas à mão em `data/manual-polls-r2.json`, a partir de textos de imprensa; últimas: Datafolha (campo 20-22/10) e PoderData/Aya (19-21/10, n=4.000 só numa fonte), divulgadas em 22/10; Meio/Ideia (15-19/10, divulgada em 21/10); DataTrends (15-17/10, só votos válidos, vindo do agregador do Poder360, sem n nem dia de divulgação); Quaest/Globo pós-debate de 21/10; Palver 10-13/10 sem dia de divulgação confirmado; conferir com a Wikipédia quando ela atualizar. Próximas esperadas: últimas rodadas até sábado 24/10 (Quaest, AtlasIntel, Nexus, Gerp, Ipespe etc.). Rotina diária ativa, presa à sessão do Claude que a criou (21h47 de Brasília, até 25/10).
