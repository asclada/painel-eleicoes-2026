@AGENTS.md

# Eleição 2026 · Simulação

## Objetivo
Painel pessoal (Lucas e o pai) para acompanhar a eleição presidencial de 2026: pesquisas em votos válidos, previsões e apuração ao vivo do 1º turno (04/10/2026, resultados a partir das 17h de Brasília), comparando a contagem real com o que pesquisas e previsões apontavam. Inspirado no EleiçãoBR (eleicaobr.netlify.app), de forma simplificada. Candidatos acompanhados: Lula, Flávio Bolsonaro, Caiado, Cury, Renan Santos, Zema (+ "Demais").

## Stack e arquitetura
- Next.js 16 (App Router, TypeScript, Tailwind v4), hospedagem na Vercel (https://painel-eleicoes-2026.vercel.app, região `gru1` em `vercel.json`; repo privado asclada/painel-eleicoes-2026, push na `master` publica). Sem banco de dados.
- `src/lib/polls.ts`: lê a seção "Primeiro turno > 2026" da Wikipédia (API `action=parse`, ~5 min de cache em memória), com fallback em `data/polls2026.json`, mais `data/manual-polls.json` para pesquisas ainda não registradas lá. Também lista as pesquisas "aguardando divulgação".
- `src/lib/model.ts`: votos válidos, média ponderada (recência, margem de erro, amortecimento por instituto), histórico de acerto 2018/2022, institutos "certeiros", previsão com 20 mil simulações.
- `src/lib/tse.ts` + `src/app/api/apuracao/route.ts`: leitura do JSON público do TSE (o navegador não consegue por CORS). Modos `?env=demo` e `?env=simulado` para testar.
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
- 2º turno (Lula × Flávio apenas, decisão do Lucas) em Pesquisas e Previsões via botão `?turno=2`: média A (todas), média B (certeiros em 2018/2022), previsão com curva normal (`forecast2` em `model.ts`, `getEstimates2`). A apuração ao vivo continua só de 1º turno (o 2º turno terá outro código no TSE, só confirmável em 25/10).
- Correção do viés: padrão 20% em ambos os turnos. No backtest com 2018+2022 (um de fora), corrigir mais (50-100%) reduz o erro, mas o efeito sobre as chances é pequeno (~1 p.p.). Lucas preferiu não mudar o método.
- Fotos oficiais dos candidatos em `public/candidatos/` (baixadas do TSE).
- Não enviar o e-mail do Lucas em requisições externas (o User-Agent da Wikipédia não leva contato).

## Como descobrir o estado atual
- Rodar: `npm run dev` e abrir `/`, `/previsoes`, `/apuracao?env=demo`.
- Pesquisas lidas hoje e pendentes: rodar o app e ver o selo de fonte e o aviso "Aguardando divulgação" em `/`; ou consultar `data/polls2026.json` (cópia salva) e `data/manual-polls.json`.
- Ranking de institutos: tabela "Quem acertou mais em 2018 e 2022" em `/`, calculada a partir de `data/history.json`.
- Apuração: `GET /api/apuracao` (oficial), `?env=simulado`, `?env=demo&p=40`. Códigos TSE: eleição 6257 (oficial), 21270 (simulado).
- Verificações: `npx tsc --noEmit`, `npx eslint src`, `npm run build`.

## Pendente / próximos passos
- Fase 2: projeção do que falta contar (exige resultado de 2022 por município/UF), pesquisas de 2º turno e previsão do 2º turno (25/10/2026).

Última atualização: 03/10/2026.
