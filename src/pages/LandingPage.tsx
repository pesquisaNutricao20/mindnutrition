import { ArrowRight } from 'lucide-react';
import { FaBrain } from 'react-icons/fa';
import iconApp from '../assets/logo/icon_app.png';
import { PageContainer } from '../components/ui/PageContainer';

export function LandingPage({ onStart, hasSession }: { onStart: () => void; hasSession: boolean }) {
  return (
    <PageContainer noPadding>
      <div className="landing-gradient fixed inset-0 z-50 h-[100dvh] w-screen overflow-hidden bg-paper">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-paper via-transparent to-paper pointer-events-none z-0" />
        <div className="relative z-10 mx-auto flex h-full w-full max-w-[2000px] flex-col">
          <div className="flex flex-1 flex-col justify-center px-5 py-6 pb-32 sm:px-8 md:px-16">
            <div className="max-w-4xl mx-auto w-full">
              <div className="mb-4 flex items-center gap-2.5">
                <img src={iconApp} alt="Ícone Mind Nutrition" className="h-10 w-10 object-contain" />
                <span className="logo-wordmark text-xl text-accent">Mind Nutrition</span>
              </div>
              <h1 className="display-title mb-6 text-accent text-[2.65rem] sm:text-[3.7rem] md:text-[4.6rem] leading-[0.92]">Sua jornada começa aqui.</h1>

              <div className="relative z-20 mb-6 max-w-xl rounded-[1.5rem] border border-line bg-white/70 p-4 shadow-sm backdrop-blur-md sm:p-5">
                <p className="serif-body mb-2 text-xl leading-tight text-ink sm:text-2xl">
                  Vá além do ruído das dietas.
                </p>
                <p className="text-ink/75 font-medium text-sm md:text-base leading-relaxed">
                  Descubra uma abordagem gentil para a sua alimentação. Experimente refletir sobre o que você está sentindo e avalie se precisa, de fato, comer.
                </p>
              </div>

              <div className="relative z-20 flex flex-wrap gap-3">
                <button
                  onClick={onStart}
                  className="group relative inline-flex items-center gap-3 rounded-2xl bg-accent px-6 py-3.5 text-sm font-bold uppercase tracking-widest text-paper shadow-lg transition-all hover:scale-105 active:scale-95"
                >
                  <FaBrain size={22} />
                  <span>{hasSession ? 'Continuar Jornada' : 'Começar Jornada'}</span>
                  <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>
          </div>
        </div>
        <div className="landing-waves" aria-hidden="true">
          <svg className="landing-wave landing-wave-back" viewBox="0 0 1440 320" preserveAspectRatio="none">
            <path fill="var(--accent-secondary)" d="M0,192L48,181.3C96,171,192,149,288,138.7C384,128,480,128,576,149.3C672,171,768,213,864,208C960,203,1056,149,1152,133.3C1248,117,1344,139,1392,149.3L1440,160L1440,320L0,320Z" />
          </svg>
          <svg className="landing-wave landing-wave-front" viewBox="0 0 1440 320" preserveAspectRatio="none">
            <path fill="var(--accent)" d="M0,224L48,208C96,192,192,160,288,154.7C384,149,480,171,576,192C672,213,768,235,864,229.3C960,224,1056,192,1152,181.3C1248,171,1344,181,1392,186.7L1440,192L1440,320L0,320Z" />
          </svg>
        </div>
      </div>
    </PageContainer>
  );
}
