import { Loader2, RefreshCw, ScanLine, Utensils } from 'lucide-react';

export type MealAiAnalysis = {
  dish?: string;
  summary?: string;
  identified?: { name: string; confidence: string }[];
  unrecognized?: string[];
  colors?: string[];
  balance?: string;
  attentionPoints?: string[];
  confidence?: string;
};

export function MealAiAnalysisCard({
  analysis,
  loading,
  error,
  hasPhoto,
  onAnalyze,
  showAction = true,
}: {
  analysis: MealAiAnalysis | null;
  loading: boolean;
  error: string;
  hasPhoto: boolean;
  onAnalyze: () => void;
  showAction?: boolean;
}) {
  return (
    <div className="rounded-[2rem] border border-accent/25 bg-accent/5 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 text-accent"><ScanLine size={20} /></span>
          <div>
            <h3 className="text-sm font-bold">Olhar gentil sobre o prato</h3>
            <p className="mt-0.5 text-xs text-ink/55">A IA comenta apenas o que reconhece com segurança. Sem calorias e sem julgamento.</p>
          </div>
        </div>
        {showAction && (
          <button
            type="button"
            onClick={onAnalyze}
            disabled={loading || !hasPhoto}
            aria-busy={loading || undefined}
            className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border border-accent/30 bg-white px-3 py-2 text-xs font-bold text-accent transition hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            {loading ? 'Analisando' : error ? 'Tentar novamente' : analysis ? 'Reanalisar' : 'Analisar'}
          </button>
        )}
      </div>

      {loading && (
        <div className="mt-4 overflow-hidden rounded-2xl border border-accent/20 bg-white p-4">
          <div className="flex items-center gap-2 text-xs font-bold text-accent">
            <Loader2 size={14} className="animate-spin" />
            A IA está observando cores, porções e variedade do prato...
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-accent/15">
            <div className="ai-progress h-full w-1/3 rounded-full bg-accent" />
          </div>
        </div>
      )}

      {!loading && error && (
        <p role="alert" className="mt-3 rounded-2xl border border-danger/25 bg-danger/5 p-3 text-sm font-medium text-danger">
          {error} Use “Tentar novamente” para refazer a análise.
        </p>
      )}

      {!loading && !error && !analysis && (
        <p className="mt-3 rounded-2xl border border-dashed border-accent/25 bg-white/70 p-3 text-xs text-ink/55">
          {hasPhoto
            ? 'Toque em Analisar para a IA observar cores, variedade e o que consegue reconhecer com segurança.'
            : 'Adicione uma foto da refeição para receber a leitura visual.'}
        </p>
      )}

      {!loading && analysis && (
        <div className="mt-4 space-y-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-[10px] font-bold text-paper">
                <Utensils size={12} /> {analysis.dish || 'Prato identificado'}
              </span>
              {analysis.confidence && (
                <span className="rounded-full border border-accent/25 bg-white px-2.5 py-1 text-[10px] font-bold text-accent">
                  Confiança {analysis.confidence}
                </span>
              )}
            </div>
            {analysis.summary && <p className="mt-2 text-sm leading-relaxed text-ink/75">{analysis.summary}</p>}
          </div>

          {!!analysis.identified?.length && (
            <div>
              <span className="text-[10px] font-bold text-ink/45">Reconhecido com segurança</span>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {analysis.identified.map((item) => (
                  <span key={`${item.name}-${item.confidence}`} className="inline-flex items-center gap-1 rounded-full border border-line bg-white px-2.5 py-1 text-[11px] font-bold text-ink/70">
                    {item.name}
                    <span className="text-[9px] font-semibold text-ink/35">{item.confidence}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {!!analysis.unrecognized?.length && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
              <span className="text-[10px] font-bold text-amber-700">Não incluído na análise por incerteza</span>
              <ul className="mt-1.5 space-y-1">
                {analysis.unrecognized.map((item) => (
                  <li key={item} className="flex items-start gap-1.5 text-[11px] leading-relaxed text-amber-800/85">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-amber-500" />{item}
                  </li>
                ))}
              </ul>
              <p className="mt-1.5 text-[10px] leading-relaxed text-amber-700/70">
                Se você quiser, conte na descrição ou nas observações o que era esse item — assim o registro fica completo para você.
              </p>
            </div>
          )}

          {!!analysis.colors?.length && (
            <div>
              <span className="text-[10px] font-bold text-ink/45">Cores do prato</span>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {analysis.colors.map(color => (
                  <span key={color} className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-ink/70 border border-line">{color}</span>
                ))}
              </div>
            </div>
          )}

          {analysis.balance && (
            <p className="rounded-2xl bg-white p-3 text-xs leading-relaxed text-ink/70 border border-line">{analysis.balance}</p>
          )}

          {!!analysis.attentionPoints?.length && (
            <div>
              <span className="text-[10px] font-bold text-ink/45">Observações gentis</span>
              <ul className="mt-1.5 space-y-1.5">
                {analysis.attentionPoints.map(point => (
                  <li key={point} className="flex items-start gap-2 text-xs text-ink/65"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" />{point}</li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-[10px] leading-relaxed text-ink/45">Leitura visual acolhedora e sem números nutricionais. Alimentos em que a IA não teve segurança ficam fora da análise. Isso não substitui avaliação nutricional individual.</p>
        </div>
      )}
    </div>
  );
}
