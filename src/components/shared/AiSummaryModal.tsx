import React, { useEffect, useState } from 'react';
import { Leaf, RefreshCw, Sparkles, X } from 'lucide-react';
import mascotAi from '../../assets/mascote_ai3.png';
import { Button } from '../ui/Button';
import { Overlay } from '../ui/Overlay';

const SUMMARY_BULLET = /^(?:[-*•▪–]|\d+[.)])\s+/;
const SUMMARY_SUGGESTION = /^sugest[ãa]o\s*:\s*/i;
const SUMMARY_MARK = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*|_[^_\n]+_|`[^`\n]+`)/;

type SummaryBlock =
  | { kind: 'paragraph'; text: string }
  | { kind: 'heading'; text: string }
  | { kind: 'bullets'; items: string[] }
  | { kind: 'suggestion'; text: string };

function splitSummaryBlocks(text: string): SummaryBlock[] {
  const blocks: SummaryBlock[] = [];
  let paragraph: string[] = [];
  let bullets: string[] = [];

  const flushBullets = () => {
    if (bullets.length) blocks.push({ kind: 'bullets', items: bullets });
    bullets = [];
  };
  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ kind: 'paragraph', text: paragraph.join(' ') });
    paragraph = [];
  };
  const flushAll = () => {
    flushBullets();
    flushParagraph();
  };

  text.split(/\r?\n/).forEach((rawLine) => {
    const line = rawLine.replace(/[ \t]+/g, ' ').trim();
    if (!line) {
      flushAll();
      return;
    }
    const cleanLine = line.replace(SUMMARY_BULLET, '');
    if (SUMMARY_SUGGESTION.test(cleanLine)) {
      flushAll();
      const body = cleanLine.replace(SUMMARY_SUGGESTION, '').trim();
      blocks.push({ kind: 'suggestion', text: body.charAt(0).toUpperCase() + body.slice(1) });
      return;
    }
    if (/^#{1,6}\s+/.test(line)) {
      flushAll();
      blocks.push({ kind: 'heading', text: line.replace(/^#{1,6}\s+/, '') });
      return;
    }
    const boldHeading = line.match(/^\*\*([^*]{2,60})\*\*:?$/);
    if (boldHeading) {
      flushAll();
      blocks.push({ kind: 'heading', text: boldHeading[1] });
      return;
    }
    if (SUMMARY_BULLET.test(line)) {
      flushParagraph();
      bullets.push(cleanLine);
      return;
    }
    flushBullets();
    paragraph.push(line);
  });
  flushAll();
  return blocks;
}

const SummaryRichText = ({ text }: { text: string }) => {
  const parts = text.split(SUMMARY_MARK);
  return (
    <>
      {parts.map((part, index) => {
        if (/^\*\*[^*]+\*\*$/.test(part)) {
          return <strong key={index} className="font-bold text-accent">{part.slice(2, -2)}</strong>;
        }
        if (/^[*_][^*_]+[*_]$/.test(part)) {
          return <em key={index} className="italic text-ink/75">{part.slice(1, -1)}</em>;
        }
        if (/^`[^`]+`$/.test(part)) {
          return (
            <code key={index} className="rounded-lg bg-accent/10 px-1.5 py-0.5 font-mono text-[0.85em] font-semibold text-accent">
              {part.slice(1, -1)}
            </code>
          );
        }
        return <React.Fragment key={index}>{part}</React.Fragment>;
      })}
    </>
  );
};

type AiSummaryModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onRegenerate: () => void;
  summary: string;
  signals: { score: number; coverage: number; components: { label: string; value: number }[] };
};

export const AiSummaryModal = ({ isOpen, onClose, onRegenerate, summary, signals }: AiSummaryModalProps) => {
  const blocks = splitSummaryBlocks(summary);
  const [expanded, setExpanded] = useState(false);
  const firstBulletsIndex = blocks.findIndex(block => block.kind === 'bullets');
  const labelsComeFromModel = blocks.some(block => block.kind === 'heading');
  useEffect(() => {
    if (!isOpen) setExpanded(false);
  }, [isOpen]);
  const tiles = [
    { label: 'Consciência', value: `${signals.score}%` },
    { label: 'Cobertura dos sinais', value: `${signals.coverage}%` },
  ];
  return (
    <Overlay
      open={isOpen}
      onClose={onClose}
      title="Resumo do Mascote Nutre"
      description="Uma leitura educativa dos seus registros recentes."
      size="lg"
      closeLabel="Fechar resumo"
      panelClassName={expanded ? 'modal-panel-expanded' : ''}
      headerClassName="animated-gradient relative shrink-0 overflow-hidden px-5 pb-5 pt-1 text-paper sm:px-7 sm:pb-6 sm:pt-2"
      header={
        <>
          <button
            type="button"
            onClick={() => setExpanded(value => !value)}
            aria-expanded={expanded}
            aria-label={expanded ? 'Reduzir o painel do resumo' : 'Ampliar o painel do resumo'}
            className="modal-grip modal-grip-light min-h-11"
          />
          <Sparkles size={96} className="pointer-events-none absolute -right-5 -top-6 text-paper/20" />
          <div className="relative flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3.5">
              <img src={mascotAi} alt="Mascote Nutre do Mind Nutrition" className="h-14 w-14 shrink-0 rounded-2xl bg-paper/15 object-contain p-1 drop-shadow-md" />
              <div className="min-w-0">
                <span className="label-sm text-paper">Mascote Nutre</span>
                <h3 className="font-display mt-1 text-xl leading-[1.08] sm:text-2xl">Sua leitura conectada</h3>
              </div>
            </div>
            <button type="button" onClick={onClose} aria-label="Fechar resumo" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-paper/15 text-paper transition hover:bg-paper/25">
              <X size={18} />
            </button>
          </div>
        </>
      }
      bodyClassName="space-y-5"
      footer={
        <div className="space-y-4">
          <p className="text-xs leading-relaxed text-ink/55">
            Este resumo é educativo, usa apenas dados resumidos e não substitui acompanhamento profissional.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button fullWidth variant="secondary" onClick={onClose}>Fechar</Button>
            <Button fullWidth onClick={onRegenerate}><RefreshCw size={15} /> Gerar novamente</Button>
          </div>
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        {tiles.map(tile => (
          <div key={tile.label} className="rounded-2xl border border-line bg-paper/60 px-4 py-3">
            <p className="text-xs font-bold text-ink/55">{tile.label}</p>
            <p className="font-display mt-0.5 text-2xl text-accent">{tile.value}</p>
          </div>
        ))}
      </div>

      {blocks.map((block, index) => {
        if (block.kind === 'heading') {
          return (
            <p key={`${index}-heading`} className="label-sm text-accent">
              <SummaryRichText text={block.text} />
            </p>
          );
        }
        if (block.kind === 'paragraph') {
          const isOpening = index === 0;
          return (
            <p
              key={`${index}-paragraph`}
              className={isOpening ? 'serif-body text-lg leading-relaxed text-ink/85' : 'text-[15px] leading-relaxed text-ink/75'}
            >
              <SummaryRichText text={block.text} />
            </p>
          );
        }
        if (block.kind === 'suggestion') {
          return (
            <div key={`${index}-suggestion`} className="flex gap-3 rounded-2xl border border-accent/25 bg-accent/5 p-4">
              <Leaf size={19} className="mt-0.5 shrink-0 text-accent" />
              <p className="text-sm leading-relaxed text-ink/80">
                <span className="font-bold text-accent">Sugestão · </span>
                <SummaryRichText text={block.text} />
              </p>
            </div>
          );
        }
        return (
          <div key={`${index}-bullets`} className="space-y-3">
            {index === firstBulletsIndex && !labelsComeFromModel && (
              <span className="label-sm text-accent">O que seus registros mostram</span>
            )}
            {block.items.map((item, itemIndex) => (
              <div key={`${index}-${itemIndex}`} className="flex gap-3 rounded-2xl border border-line bg-white p-4">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/10 text-xs font-bold text-accent">
                  {itemIndex + 1}
                </span>
                <p className="text-sm leading-relaxed text-ink/75">
                  <SummaryRichText text={item} />
                </p>
              </div>
            ))}
          </div>
        );
      })}

      {signals.components.length > 0 && (
        <div className="rounded-2xl border border-line bg-paper/60 p-4">
          <span className="label-sm text-accent">Como chegamos aí</span>
          <div className="mt-3 space-y-3">
            {signals.components.map(component => (
              <div key={component.label}>
                <div className="flex items-center justify-between gap-3 text-xs font-bold"><span>{component.label}</span><span className="text-accent">{component.value}%</span></div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-accent transition-all duration-700" style={{ width: `${Math.max(0, Math.min(100, component.value))}%` }} /></div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Overlay>
  );
};
