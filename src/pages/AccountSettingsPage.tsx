import { useRef, useState } from 'react';
import { Camera } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { FormField } from '../components/ui/FormField';
import { PageContainer } from '../components/ui/PageContainer';
import { PageHeader } from '../components/ui/PageHeader';
import { ProfileAvatar } from '../components/ui/ProfileAvatar';
import { DEFAULT_PROFILE_PHOTO, readValidatedImages } from '../constants';
import type { Page, UserProfile } from '../types';

export function AccountSettingsPage({
  userProfile,
  onSaveProfile,
  onNavigate
}: {
  userProfile: UserProfile;
  onSaveProfile: (profile: UserProfile) => void | Promise<void>;
  onNavigate: (page: Page) => void;
}) {
  const [name, setName] = useState(userProfile.name || '');
  const [email, setEmail] = useState(userProfile.email || '');
  const [gender, setGender] = useState(userProfile.gender || 'Mulher');
  const [age, setAge] = useState(userProfile.age || 25);
  const [height, setHeight] = useState(userProfile.height || 165);
  const [photo, setPhoto] = useState(userProfile.photo || DEFAULT_PROFILE_PHOTO);
  const [objectives, setObjectives] = useState(userProfile.objectives || []);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingPhoto, setLoadingPhoto] = useState(false);
  const savingRef = useRef(false);
  const loadingPhotoRef = useRef(false);
  const isDirty = name !== (userProfile.name || '')
    || email !== (userProfile.email || '')
    || gender !== (userProfile.gender || 'Mulher')
    || age !== (userProfile.age || 25)
    || height !== (userProfile.height || 165)
    || photo !== (userProfile.photo || DEFAULT_PROFILE_PHOTO)
    || objectives.join('|') !== (userProfile.objectives || []).join('|');

  const handlePhoto = async (files: FileList | null) => {
    if (loadingPhotoRef.current) return;
    loadingPhotoRef.current = true;
    setLoadingPhoto(true);
    setError('');
    try {
      const result = await readValidatedImages(files, 0);
      if (result.error) { setError(result.error); return; }
      if (result.images[0]) setPhoto(result.images[0]);
    } finally {
      loadingPhotoRef.current = false;
      setLoadingPhoto(false);
    }
  };

  const handleSave = async () => {
    if (savingRef.current || !isDirty) return;
    if (!name.trim() || name.trim().length > 80) {
      setError('Informe um nome entre 1 e 80 caracteres.');
      return;
    }
    if (age < 10 || age > 120 || height < 80 || height > 250) {
      setError('Revise idade e altura: os valores estão fora de uma faixa plausível.');
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setError('');
    try {
      await onSaveProfile({
        ...userProfile,
        name: name.trim(),
        email: email.trim(),
        gender,
        age,
        height,
        photo,
        objectives,
      });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Não foi possível salvar o perfil. Tente novamente.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <PageContainer variant="narrow" hasTopbar={false} className="space-y-6">
      <PageHeader
        title="Editar perfil"
        subtitle="Revise seus dados pessoais e o que deseja acompanhar na jornada."
        back={{ label: 'Voltar ao perfil', onClick: () => { if (!saving) onNavigate('profile'); } }}
      />

      <form
        className="space-y-5 rounded-[2rem] border border-line bg-white p-6 shadow-sm sm:p-8"
        aria-busy={saving || undefined}
        onSubmit={(event) => { event.preventDefault(); void handleSave(); }}
      >
        {error && <p role="alert" className="rounded-2xl border border-danger/20 bg-danger/5 p-4 text-sm font-semibold text-danger">{error}</p>}
        <fieldset disabled={saving || loadingPhoto} className="space-y-5">
          <div className="flex items-center gap-4">
            <ProfileAvatar photo={photo} size="lg" />
            <div className="space-y-2">
              <label
                htmlFor="profile-photo"
                className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full bg-accent/10 px-4 py-2 text-sm font-bold text-accent hover:bg-accent/20"
              >
                <Camera size={16} aria-hidden="true" /> {loadingPhoto ? 'Lendo foto...' : 'Alterar foto'}
              </label>
              <input
                id="profile-photo"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(event) => { void handlePhoto(event.target.files); }}
              />
              <p className="text-xs text-ink/60">JPEG, PNG ou WebP.</p>
            </div>
          </div>
        <FormField label="Nome de exibição" htmlFor="profile-name" required>
          <input
            id="profile-name"
            type="text"
            value={name}
            maxLength={80}
            required
            onChange={(event) => setName(event.target.value)}
            className="min-h-12 w-full rounded-2xl border border-line bg-paper/40 px-4 py-3 text-base font-semibold text-ink outline-none transition focus:border-accent"
          />
        </FormField>

        <FormField
          label="E-mail do perfil"
          htmlFor="profile-email"
          hint="Usado nos dados do perfil. Esta tela não altera o e-mail de acesso ao Supabase Auth."
        >
          <input
            id="profile-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="min-h-12 w-full rounded-2xl border border-line bg-paper/40 px-4 py-3 text-base font-semibold text-ink outline-none transition focus:border-accent"
          />
        </FormField>
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField label="Gênero / sexo" htmlFor="profile-gender">
            <select
              id="profile-gender"
              value={gender}
              onChange={(event) => setGender(event.target.value)}
              className="min-h-12 w-full rounded-2xl border border-line bg-paper/40 px-4 py-3 text-sm font-semibold text-ink outline-none transition focus:border-accent"
            >
              <option value="Mulher">Mulher</option>
              <option value="Homem">Homem</option>
              <option value="Não Binário(a)">Não Binário(a)</option>
              <option value="Outro">Outro</option>
              <option value="Prefiro não informar">Prefiro não informar</option>
            </select>
          </FormField>

          <FormField label="Idade" htmlFor="profile-age" hint="Entre 10 e 120 anos.">
            <input
              id="profile-age"
              type="number"
              min="10"
              max="120"
              inputMode="numeric"
              value={age}
              onChange={(event) => setAge(parseInt(event.target.value, 10) || 0)}
              className="min-h-12 w-full rounded-2xl border border-line bg-paper/40 px-4 py-3 text-sm font-semibold text-ink outline-none transition focus:border-accent"
            />
          </FormField>
        </div>

        <FormField label="Altura" htmlFor="profile-height" hint="Em centímetros, entre 80 e 250.">
          <input
            id="profile-height"
            type="number"
            min="80"
            max="250"
            inputMode="decimal"
            value={height}
            onChange={(event) => setHeight(parseFloat(event.target.value) || 0)}
            className="min-h-12 w-full rounded-2xl border border-line bg-paper/40 px-4 py-3 text-sm font-semibold text-ink outline-none transition focus:border-accent"
          />
        </FormField>
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold text-ink">Metas da jornada</legend>
          <p className="text-xs text-ink/60">Selecione uma ou mais opções.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {['Emagrecimento consciente', 'Melhorar a relação com a comida', 'Ganho de peso', 'Hipertrofia', 'Cuidar da minha saúde'].map((objective) => {
              const selected = objectives.includes(objective);
              return (
                <button
                  type="button"
                  key={objective}
                  aria-pressed={selected}
                  onClick={() => setObjectives(selected ? objectives.filter(item => item !== objective) : [...objectives, objective])}
                  className={`min-h-11 rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${selected ? 'border-accent bg-accent/10 text-accent' : 'border-line bg-white text-ink/70 hover:border-accent'}`}
                >
                  {objective}
                </button>
              );
            })}
          </div>
        </fieldset>
        </fieldset>

        <Button type="submit" fullWidth loading={saving} disabled={!isDirty || loadingPhoto}>
          Salvar alterações
        </Button>
        <p className="text-center text-xs leading-relaxed text-ink/55">As alterações são salvas neste aparelho e enviadas para sincronização quando a conexão permitir.</p>
      </form>
    </PageContainer>
  );
}
