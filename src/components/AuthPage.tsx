import { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Camera, HelpCircle, Mail, MailCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import mascoteFlying from '../assets/mascote_flying.png';
import { ProfileAvatar } from './ui/ProfileAvatar';
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

  const handleAuth = async () => {
    const normalizedEmail = email.trim();
    const strongPassword = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError('Por favor, insira um e-mail válido.');
      return;
    }
    if (!strongPassword.test(password)) {
      setError('Use 8+ caracteres com maiúscula, minúscula, número e símbolo.');
      return;
    }
    if (!supabase) {
      setError('Supabase não está configurado. Verifique as variáveis .env.local.');
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
    } catch (err: any) {
      setError(err?.message || 'Não foi possível autenticar agora.');
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
      const interval = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err: any) {
      onShowToast(err?.message || 'Não foi possível reenviar o e-mail.', 'error');
    } finally {
      setIsResending(false);
    }
  };

  if (pendingConfirmation) {
    return (
      <div className="w-full min-h-screen px-5 md:px-12 pt-8 md:pt-12 pb-36 md:pb-16 max-w-4xl mx-auto">
        <section className="bg-paper border border-line rounded-[2rem] p-5 md:p-8 shadow-sm max-w-2xl mx-auto">
          <button onClick={() => { setPendingConfirmation(false); setError(''); }} className="w-12 h-12 rounded-full border border-line flex items-center justify-center hover:bg-ink/5 transition-colors">
            <ArrowLeft size={20} className="text-ink" />
          </button>
          <div className="mt-6 space-y-6 text-center">
            <div className="relative mx-auto w-32 h-32">
              <div className="absolute inset-x-4 bottom-3 h-10 bg-accent/15 rounded-full blur-2xl" />
              <motion.img
                src={mascoteFlying}
                alt="Mascote Mind Nutrition"
                className="absolute left-1/2 top-0 -translate-x-1/2 h-full object-contain drop-shadow-2xl"
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
              />
            </div>
            <div className="space-y-2">
              <span className="label-sm text-accent">Quase lá</span>
              <h2 className="display-title text-4xl md:text-5xl">Confirme seu e-mail.</h2>
              <p className="serif-body text-xl text-ink/60 max-w-md mx-auto">
                Enviamos um link de confirmação para:
              </p>
              <p className="font-bold text-ink break-all">{email}</p>
            </div>
            <div className="rounded-2xl bg-white border border-line p-5 text-left space-y-3">
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
                onClick={handleResendConfirmation}
                disabled={isResending || resendCooldown > 0}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-accent text-paper font-bold text-sm shadow-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isResending ? 'Enviando...' : resendCooldown > 0 ? `Reenviar em ${resendCooldown}s` : 'Reenviar e-mail'}
              </button>
              <button
                onClick={() => { setPendingConfirmation(false); setError(''); }}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full border border-line text-ink font-bold text-sm hover:bg-ink/5 transition-colors"
              >
                Voltar ao login
              </button>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen px-5 md:px-12 pt-8 md:pt-12 pb-36 md:pb-16 max-w-4xl mx-auto">
      <section className="bg-paper border border-line rounded-[2rem] p-5 md:p-8 shadow-sm max-w-2xl mx-auto">
        <button onClick={() => onNavigate('landing')} className="w-12 h-12 rounded-full border border-line flex items-center justify-center hover:bg-ink/5 transition-colors">
          <ArrowLeft size={20} className="text-ink" />
        </button>
        <div className="space-y-2 mt-4">
          <h2 className="display-title text-5xl">{isLogin ? 'Entre com a sua conta.' : 'Comece sem pressa.'}</h2>
          <div className="relative h-40 my-4">
            <div className="absolute inset-x-6 bottom-3 h-12 bg-accent/15 rounded-full blur-2xl" />
            <motion.img
              src={mascoteFlying}
              alt="Mascote Mind Nutrition"
              className="absolute left-1/2 top-0 -translate-x-1/2 h-full object-contain drop-shadow-2xl"
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
            />
          </div>
          <p className="serif-body text-xl text-ink/60">{isLogin ? 'Que bom te ver de volta.' : 'Vamos começar sua jornada?'}</p>
        </div>

        <div className="flex bg-white border border-line rounded-2xl p-1 mt-8">
          <button onClick={() => { setIsLogin(true); setError(''); }} className={`flex-1 py-3 rounded-xl text-sm font-bold transition-colors ${isLogin ? 'bg-accent text-paper shadow-sm' : 'text-ink/50 hover:text-ink'}`}>Entrar</button>
          <button onClick={() => { setIsLogin(false); setError(''); }} className={`flex-1 py-3 rounded-xl text-sm font-bold transition-colors ${!isLogin ? 'bg-accent text-paper shadow-sm' : 'text-ink/50 hover:text-ink'}`}>Cadastrar</button>
        </div>

        {!isLogin && (
          <div className="mt-6 flex items-center gap-4 rounded-3xl bg-white border border-line p-4">
            <div className="w-20 h-20 rounded-2xl overflow-hidden border border-line bg-paper">
              <ProfileAvatar photo={signupPhoto} size="lg" className="border-0" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-sm">Foto de perfil</p>
              <p className="text-xs text-ink/50 mt-1">JPG, PNG ou WEBP até {MAX_IMAGE_SIZE_MB}MB.</p>
              <label className="inline-flex items-center gap-2 mt-3 px-4 py-2 rounded-full bg-accent/10 text-accent text-xs font-bold cursor-pointer hover:bg-accent/15">
                <Camera size={14} /> Escolher foto
                <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => handleSignupPhoto(e.target.files)} />
              </label>
            </div>
          </div>
        )}

        <div className="space-y-8 mt-8">
          <div className="space-y-6">
            <div>
              <p className="label-sm mb-2 text-accent">E-mail</p>
              <input type="email" value={email} onChange={e => { setEmail(e.target.value); setError(''); }}
                placeholder="voce@email.com"
                className="w-full py-4 px-4 bg-white border border-line rounded-2xl focus:border-accent focus:outline-none transition-colors text-base font-medium" />
            </div>
            <div>
              <div className="flex justify-between items-center mb-2">
                <p className="label-sm text-accent">Senha</p>
                {isLogin && <button onClick={async () => {
                  if (!supabase || !email.trim()) {
                    setError('Informe seu e-mail para recuperar a senha.');
                    return;
                  }
                  await supabase.auth.resetPasswordForEmail(email.trim());
                  onShowToast('Instruções de recuperação enviadas para o e-mail!', 'success');
                }} className="text-xs font-bold text-accent hover:underline">
                  Esqueci minha senha
                </button>}
              </div>
              <input type="password" value={password} onChange={e => { setPassword(e.target.value); setError(''); }}
                placeholder="Sua senha aqui"
                className="w-full py-4 px-4 bg-white border border-line rounded-2xl focus:border-accent focus:outline-none transition-colors text-base font-medium" />
              {!isLogin && (
                <div className="grid grid-cols-2 gap-2 mt-3">
                  {[
                    { ok: password.length >= 8, label: '8 caracteres' },
                    { ok: /[A-Z]/.test(password), label: 'Maiúscula' },
                    { ok: /\d/.test(password), label: 'Número' },
                    { ok: /[^A-Za-z\d]/.test(password), label: 'Símbolo' },
                  ].map(item => (
                    <span key={item.label} className={`text-[10px] font-bold rounded-full px-3 py-1.5 ${item.ok ? 'bg-accent/10 text-accent' : 'bg-ink/5 text-ink/40'}`}>
                      {item.label}
                    </span>
                  ))}
                </div>
              )}
            </div>
            {error && <p className="text-red-500 text-sm font-bold bg-red-50 border border-red-100 rounded-2xl p-3">{error}</p>}
          </div>

          <div className="space-y-4 pt-4">
            <button onClick={handleAuth} disabled={isSubmitting || !email || !password}
              className={`w-full py-5 text-paper font-bold text-lg rounded-2xl shadow-lg transition-colors ${email && password && !isSubmitting ? 'bg-accent hover:bg-accent/90' : 'bg-ink/30 cursor-not-allowed'}`}>
              {isSubmitting ? 'Processando...' : isLogin ? 'Entrar no app' : 'Criar conta e continuar'}
            </button>
          </div>

          <div className="pt-6 text-center">
            <button onClick={() => onShowToast('Mind Nutrition é uma plataforma guiada por IA para uma relação mais saudável com a alimentação. Versão 1.0', 'info', 5000)}
              className="text-sm font-medium text-ink/50 hover:text-accent transition-colors flex items-center justify-center gap-2 mx-auto">
              <HelpCircle size={16} /> Sobre o Mind Nutrition
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
