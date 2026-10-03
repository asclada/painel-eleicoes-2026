import { HALF_LIFE_DAYS, TOP_RELIABLE, WINDOW_DAYS } from "@/lib/model";

export function Method({ turno = 1 }: { turno?: 1 | 2 }) {
  return (
    <details className="card p-5 text-sm leading-relaxed text-muted">
      <summary className="text-base font-semibold text-fg">Como calculamos</summary>
      <div className="mt-4 space-y-4">
        <div>
          <h3 className="font-medium text-fg">1. Votos válidos</h3>
          <p>
            Cada pesquisa é convertida para votos válidos: o percentual de cada candidato é dividido pela soma de todos os candidatos, tirando brancos, nulos e
            indecisos. É assim que o TSE conta o resultado.
          </p>
        </div>
        <div>
          <h3 className="font-medium text-fg">2. Média A: todas as pesquisas</h3>
          <p>
            Entram as pesquisas nacionais dos últimos {WINDOW_DAYS} dias. Cada uma recebe um peso: cai à metade a cada {HALF_LIFE_DAYS} dias (as recentes valem mais);
            margem de erro menor pesa mais (limitado a 0,5× a 2×); e institutos que publicam muitas pesquisas não dominam (o peso de cada uma é dividido pela raiz
            de quantas o instituto tem na janela).
          </p>
        </div>
        <div>
          <h3 className="font-medium text-fg">3. Média B: institutos mais certeiros</h3>
          <p>
            Para cada instituto, pegamos a última pesquisa antes do 1º turno de 2018 e de 2022 e medimos o erro contra o resultado oficial (em votos válidos, nos 4
            mais votados, com os 2 primeiros valendo o dobro). A nota junta as duas eleições (2022 pesa 2, 2018 pesa 1) e é puxada para a média geral para quem
            só tem uma eleição. A média B usa só os {TOP_RELIABLE} melhores entre os institutos com pesquisa recente, ponderados por 1/nota².
          </p>
        </div>
        <div>
          <h3 className="font-medium text-fg">4. Previsão</h3>
          <p>
            Parte da média A ou B e soma uma fração do viés histórico (quanto as pesquisas subestimaram cada lado em 2018 e 2022; o padrão é 20%, e dá para mudar para 0% ou 50% na página de Previsões). A incerteza
            combina o erro típico dessas duas eleições com a discordância entre os institutos hoje. Com isso rodamos 20 mil simulações, em que os dois líderes
            variam em sentido contrário (correlação −0,25), para estimar as chances de liderar, de vencer no 1º turno e de ir ao 2º turno.
          </p>
        </div>
        {turno === 2 && (
          <div>
            <h3 className="font-medium text-fg">2º turno</h3>
            <p>
              Mesma receita, só com Lula × Flávio: as pesquisas de 2º turno já são em votos válidos entre os dois. A média B usa o erro nas últimas
              pesquisas dos 2º turnos de 2018 e 2022 contra o resultado oficial (Bolsonaro 55,1% × Haddad 44,9%; Lula 50,9% × Bolsonaro 49,1%). A previsão soma
              uma fração do viés médio do candidato do PT nessas duas disputas e usa uma curva normal em torno do resultado: a chance de vencer é a parte
              da curva acima de 50%. Com só duas disputas e viés de sinais diferentes, o ajuste é pequeno e incerto.
            </p>
          </div>
        )}
        <p className="text-xs text-faint">
          Limites: são só duas eleições de referência, vários institutos de 2026 não têm histórico, e a pesquisa é uma foto, não uma previsão. Os intervalos são
          largos de propósito: foi esse o tamanho do erro real nas últimas eleições.
        </p>
      </div>
    </details>
  );
}
