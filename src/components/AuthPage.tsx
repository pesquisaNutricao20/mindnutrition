import { type FormEvent, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  HelpCircle,
  Lock,
  LogIn,
  Mail,
  MailCheck,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';
import { getFriendlySupabaseError, getSupabaseConfigMessage, supabase } from '../lib/supabase';
import googleLogo from '../assets/google_logo.svg';
import { ProfileAvatar } from './ui/ProfileAvatar';
import { FlyingMascotSprite } from './ui/FlyingMascotSprite';
import { DEFAULT_PROFILE_PHOTO, MAX_IMAGE_SIZE_MB, readValidatedImages } from '../constants';
import type { UserProfile, Page } from '../types';

export interface AuthPageProps {
  userProfile: UserProfile;
  onAuthenticated: (params: {
    user: { id: string; email?: string };
    isLogin: boolean;
    signupPhoto: string;
  }) => Promise<void> | void;
  onNavigate: (page: Page) => void;
  onShowToast: (message: string, type: 'info' | 'success' | 'error', duration?: number) => void;
}

const passwordChecks = [
  { test: (value: string) => value.length >= 8, label: '8 caracteres' },
  { test: (value: string) => /[A-Z]/.test(value), label: 'Maiuscula' },
  { test: (value: string) => /\d/.test(value), label: 'Numero' },
  { test: (value: string) => /[^A-Za-z\d]/.test(value), label: 'Simbolo' },
];

const getAuthRedirectUrl = () => {
  const configuredUrl =
    import.meta.env.VITE_PUBLIC_SITE_URL ||
    import.meta.env.VITE_APP_URL ||
    import.meta.env.VITE_SITE_URL ||
    '';
  const fallbackUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const url = configuredUrl || fallbackUrl;

  return url.replace(/\/+$/, '');
};

const getOAuthErrorMessage = (code: string | null, description: string | null) => {
  if (code === 'bad_oauth_state') {
    return 'O login com Google voltou para um endereço diferente ou expirou. Confira se a URL pública do app está liberada no Supabase e tente entrar novamente.';
  }

  return description || 'Não foi possível concluir o login com Google agora.';
};

export const AuthPage = ({
  userProfile,
  onAuthenticated,
  onNavigate,
  onShowToast,
}: AuthPageProps) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [signupPhoto, setSignupPhoto] = useState(userProfile.photo || DEFAULT_PROFILE_PHOTO);
  const [pendingConfirmation, setPendingConfirmation] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isResending, setIsResending] = useState(false);

  const strongPassword = passwordChecks.every((item) => item.test(password));
  const passwordScore = passwordChecks.filter((item) => item.test(password)).length;
  const passwordProgress = (passwordScore / passwordChecks.length) * 100;
  const supabaseSetupMessage = getSupabaseConfigMessage();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search || window.location.hash.replace(/^#/, ''));
    const errorCode = params.get('error_code');
    const errorDescription = params.get('error_description');
    if (!errorCode && !params.get('error')) return;

    setError(getOAuthErrorMessage(errorCode, errorDescription));
    window.history.replaceState({}, document.title, window.location.pathname);
  }, []);

  const handleSignupPhoto = async (files: FileList | null) => {
    const result = await readValidatedImages(files, 0);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.images[0]) {
      setSignupPhoto(result.images[0]);
      setError('');
    }
  };

  const handleAuth = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    const normalizedEmail = email.trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError('Por favor, insira um e-mail válido.');
      return;
    }
    if (!password) {
      setError('Informe sua senha.');
      return;
    }
    if (!isLogin && !strongPassword) {
      setError('Use 8+ caracteres com maiúscula, minúscula, número e símbolo.');
      return;
    }
    if (!supabase) {
      setError(getSupabaseConfigMessage());
      return;
    }

    setIsSubmitting(true);
    setError('');
    try {
      const result = isLogin
        ? await supabase.auth.signInWithPassword({ email: normalizedEmail, password })
        : await supabase.auth.signUp({ email: normalizedEmail, password });
      if (result.error) throw result.error;

      const user = result.data.user || result.data.session?.user;
      if (!user) {
        setPendingConfirmation(true);
        return;
      }

      await onAuthenticated({ user, isLogin, signupPhoto });
    } catch (err) {
      setError(getFriendlySupabaseError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendConfirmation = async () => {
    if (!supabase || resendCooldown > 0) return;
    setIsResending(true);
    try {
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim(),
      });
      if (resendError) throw resendError;
      onShowToast('E-mail de confirmação reenviado.', 'success');
      setResendCooldown(60);
      const interval = window.setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            window.clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err) {
      onShowToast(getFriendlySupabaseError(err), 'error');
    } finally {
      setIsResending(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!supabase || !email.trim()) {
      setError(!supabase ? getSupabaseConfigMessage() : 'Informe seu e-mail para recuperar a senha.');
      return;
    }
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim());
      if (resetError) throw resetError;
      onShowToast('Instruções de recuperação enviadas para o e-mail.', 'success');
    } catch (err) {
      setError(getFriendlySupabaseError(err));
    }
  };

  const handleGoogleLogin = async () => {
    if (!supabase) {
      setError(getSupabaseConfigMessage());
      return;
    }

    setIsSubmitting(true);
    setError('');
    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: getAuthRedirectUrl(),
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account',
          },
        },
      });
      if (oauthError) throw oauthError;
    } catch (err) {
      setError(getFriendlySupabaseError(err));
      setIsSubmitting(false);
    }
  };

  if (pendingConfirmation) {
    return (
      <div className="auth-page w-full min-h-screen px-4 py-6 md:px-10 md:py-10">
        <section className="auth-card mx-auto max-w-2xl bg-white border border-line rounded-[2rem] p-5 md:p-8 shadow-sm">
          <button type="button" onClick={() => { setPendingConfirmation(false); setError(''); }} className="icon-button">
            <ArrowLeft size={20} className="text-ink" />
          </button>
          <div className="mt-6 space-y-6 text-center">
            <div className="relative mx-auto h-28 w-28 md:h-32 md:w-32">
              <div className="absolute inset-x-4 bottom-3 h-10 bg-accent/15 rounded-full blur-2xl" />
              <motion.div
                className="absolute left-1/2 top-0 h-full -translate-x-1/2 drop-shadow-2xl"
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
              >
                <FlyingMascotSprite alt="Mascote Mind Nutrition" className="h-full object-contain" />
              </motion.div>
            </div>
            <div className="space-y-2">
              <span className="label-sm text-accent">Quase lá</span>
              <h2 className="display-title text-4xl md:text-5xl">Confirme seu e-mail.</h2>
              <p className="serif-body text-lg md:text-xl text-ink/60 max-w-md mx-auto">
                Enviamos um link de confirmação para:
              </p>
              <p className="font-bold text-ink break-all">{email}</p>
            </div>
            <div className="rounded-2xl bg-paper border border-line p-5 text-left space-y-3">
              <div className="flex items-start gap-3">
                <Mail size={20} className="text-accent mt-0.5 shrink-0" />
                <p className="text-sm text-ink/70">Abra sua caixa de entrada e clique no link enviado pelo Mind Nutrition.</p>
              </div>
              <div className="flex items-start gap-3">
                <MailCheck size={20} className="text-accent mt-0.5 shrink-0" />
                <p className="text-sm text-ink/70">Não encontrou? Confira o spam ou solicite um novo envio abaixo.</p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <button
                type="button"
                onClick={handleResendConfirmation}
                disabled={isResending || resendCooldown > 0}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-accent text-paper font-bold text-sm shadow-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <MailCheck size={16} />
                {isResending ? 'Enviando...' : resendCooldown > 0 ? `Reenviar em ${resendCooldown}s` : 'Reenviar e-mail'}
              </button>
              <button
                type="button"
                onClick={() => { setPendingConfirmation(false); setError(''); }}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl border border-line text-ink font-bold text-sm hover:bg-ink/5 transition-colors"
              >
                <LogIn size={16} />
                Voltar ao login
              </button>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="auth-page w-full min-h-screen px-4 py-6 md:px-10 md:py-10">
      <section className="auth-card relative mx-auto grid max-w-5xl overflow-hidden rounded-[2rem] border border-line bg-white shadow-sm md:grid-cols-[0.95fr_1.05fr]">
        <button type="button" onClick={() => onNavigate('landing')} className="icon-button absolute left-5 top-5 z-30 bg-white/85 backdrop-blur-md">
          <ArrowLeft size={20} className="text-ink" />
        </button>
        <aside className="relative hidden min-h-[42rem] flex-col justify-between overflow-hidden bg-accent/10 p-8 pt-24 md:flex">
          <div className="relative z-10">
            <div className="relative mb-8 h-52">
              <div className="absolute inset-x-8 bottom-6 h-16 rounded-full bg-accent/20 blur-2xl" />
              <motion.div
                className="mx-auto h-full drop-shadow-2xl"
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
              >
                <FlyingMascotSprite alt="Mascote Mind Nutrition" className="mx-auto h-full object-contain" />
              </motion.div>
            </div>
            <span className="label-sm text-accent">Mind Nutrition</span>
            <h2 className="display-title mt-3 text-5xl">Sua jornada com mais calma.</h2>
            <p className="mt-5 text-sm font-medium leading-relaxed text-ink/65">
              Registre refeições, acompanhe sinais do corpo e mantenha seus dados sincronizados quando o Supabase estiver disponível.
            </p>
          </div>
          <div className="relative z-10 rounded-3xl border border-line bg-white/70 p-4 text-sm font-medium text-ink/65">
            <ShieldCheck size={18} className="mb-2 text-accent" />
            Autenticação segura, feedback claro e fallback local para não interromper seu uso pessoal.
          </div>
        </aside>

        <div className="p-5 pt-20 md:p-8">
          <div className="md:mt-0">
            <div className="relative mx-auto mb-4 h-24 md:hidden">
              <div className="absolute inset-x-16 bottom-2 h-10 rounded-full bg-accent/15 blur-2xl" />
              <motion.div
                className="mx-auto h-full drop-shadow-2xl"
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
              >
                <FlyingMascotSprite alt="Mascote Mind Nutrition" className="mx-auto h-full object-contain" />
              </motion.div>
            </div>
            <h2 className="display-title text-4xl sm:text-5xl">
              {isLogin ? 'Entre na sua conta.' : 'Crie sua conta.'}
            </h2>
            <p className="serif-body mt-3 text-lg text-ink/60">
              {isLogin ? 'Que bom te ver de volta.' : 'Vamos começar sua jornada?'}
            </p>
          </div>

          <div className="mt-7 grid grid-cols-2 rounded-2xl border border-line bg-paper p-1">
            <button type="button" onClick={() => { setIsLogin(true); setError(''); }} className={`inline-flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition-colors ${isLogin ? 'bg-accent text-paper shadow-sm' : 'text-ink/55 hover:text-ink'}`}>
              <LogIn size={16} />
              Entrar
            </button>
            <button type="button" onClick={() => { setIsLogin(false); setError(''); }} className={`inline-flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition-colors ${!isLogin ? 'bg-accent text-paper shadow-sm' : 'text-ink/55 hover:text-ink'}`}>
              <UserPlus size={16} />
              Cadastrar
            </button>
          </div>

          {supabaseSetupMessage && (
            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium leading-relaxed text-amber-800">
              {supabaseSetupMessage}
            </div>
          )}

          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={isSubmitting || !supabase}
            className="mt-6 inline-flex w-full items-center justify-center gap-3 rounded-2xl border border-line bg-white px-4 py-4 text-base font-bold text-ink shadow-sm transition-colors hover:border-accent hover:bg-accent/5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <img src={googleLogo} alt="" className="h-5 w-5 shrink-0" />
            Continuar com Google
          </button>

          <div className="mt-6 flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.14em] text-ink/35">
            <span className="h-px flex-1 bg-line" />
            <span>E-mail e senha</span>
            <span className="h-px flex-1 bg-line" />
          </div>

          {!isLogin && (
            <div className="mt-5 flex items-center gap-4 rounded-3xl bg-paper border border-line p-4">
              <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl overflow-hidden border border-line bg-white shrink-0">
                <ProfileAvatar photo={signupPhoto} size="lg" className="border-0" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-sm">Foto de perfil</p>
                <p className="text-xs text-ink/50 mt-1">JPG, PNG ou WEBP até {MAX_IMAGE_SIZE_MB}MB.</p>
                <label className="inline-flex items-center gap-2 mt-3 px-4 py-2 rounded-2xl bg-accent/10 text-accent text-xs font-bold cursor-pointer hover:bg-accent/15">
                  <Camera size={14} /> Escolher foto
                  <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => handleSignupPhoto(e.target.files)} />
                </label>
              </div>
            </div>
          )}

          <form className="mt-7 space-y-6" onSubmit={handleAuth}>
            <div>
              <label className="label-sm mb-2 block text-accent" htmlFor="auth-email">E-mail</label>
              <div className="relative">
                <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink/35" />
                <input
                  id="auth-email"
                  type="email"
                  value={email}
                  onChange={(event) => { setEmail(event.target.value); setError(''); }}
                  placeholder="voce@email.com"
                  autoComplete="email"
                  className="w-full rounded-2xl border border-line bg-paper py-4 pl-12 pr-4 text-base font-medium transition-colors focus:border-accent focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <label className="label-sm block text-accent" htmlFor="auth-password">Senha</label>
                {isLogin && (
                  <button type="button" onClick={handlePasswordReset} className="text-xs font-bold text-accent hover:underline">
                    Esqueci minha senha
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink/35" />
                <input
                  id="auth-password"
                  type="password"
                  value={password}
                  onChange={(event) => { setPassword(event.target.value); setError(''); }}
                  placeholder="Sua senha aqui"
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                  className="w-full rounded-2xl border border-line bg-paper py-4 pl-12 pr-4 text-base font-medium transition-colors focus:border-accent focus:bg-white focus:outline-none"
                />
              </div>
              {!isLogin && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="mt-4 rounded-3xl border border-line bg-paper p-4"
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <span className="text-xs font-bold text-ink/55">Força da senha</span>
                    <motion.span
                      key={passwordScore}
                      initial={{ scale: 0.85, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className={`text-xs font-bold ${strongPassword ? 'text-accent' : 'text-ink/45'}`}
                    >
                      {strongPassword ? 'Forte' : `${passwordScore}/4`}
                    </motion.span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-ink/10">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-accent to-accent-pink"
                      initial={false}
                      animate={{ width: `${passwordProgress}%` }}
                      transition={{ type: 'spring', stiffness: 220, damping: 26 }}
                    />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {passwordChecks.map((item) => {
                    const ok = item.test(password);
                    return (
                      <motion.span
                        key={item.label}
                        layout
                        animate={{ scale: ok ? 1 : 0.98 }}
                        className={`inline-flex items-center justify-center gap-1.5 rounded-2xl px-3 py-2 text-center text-[10px] font-bold transition-colors ${ok ? 'bg-accent/10 text-accent' : 'bg-white text-ink/40'}`}
                      >
                        <CheckCircle2 size={12} className={ok ? 'opacity-100' : 'opacity-35'} />
                        {item.label}
                      </motion.span>
                    );
                  })}
                  </div>
                </motion.div>
              )}
            </div>

            {error && (
              <p className="rounded-2xl border border-red-100 bg-red-50 p-3 text-sm font-bold leading-relaxed text-red-600">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting || !email || !password}
              className={`inline-flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-base font-bold text-paper shadow-lg transition-colors ${email && password && !isSubmitting ? 'bg-accent hover:bg-accent/90' : 'bg-ink/30 cursor-not-allowed'}`}
            >
              {isLogin ? <LogIn size={18} /> : <UserPlus size={18} />}
              {isSubmitting ? 'Processando...' : isLogin ? 'Entrar no app' : 'Criar conta e continuar'}
            </button>
          </form>

          <div className="pt-6 text-center">
            <button
              type="button"
              onClick={() => onShowToast('Mind Nutrition é uma plataforma guiada por IA para uma relação mais saudável com a alimentação. Versão 1.0', 'info', 5000)}
              className="mx-auto inline-flex items-center justify-center gap-2 text-sm font-medium text-ink/50 transition-colors hover:text-accent"
            >
              <HelpCircle size={16} /> Sobre o Mind Nutrition
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
