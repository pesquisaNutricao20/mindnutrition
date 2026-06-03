# Serena Nutre — Design System

Documentação do design system completo do aplicativo. Todos os componentes devem seguir este guia para manter a coesão visual.

---

## 1. Tokens de Design (CSS Variables)

```css
:root {
  --ink:           #3B3A3A;   /* Texto principal */
  --paper:         #F6F9F7;   /* Fundo principal */
  --accent:        #6BAF9E;   /* Verde-teal primário */
  --accent-pink:   #C9A3B5;   /* Rosa-mauve secundário */
  --accent-light:  #D6EDE6;   /* Verde claro (badges, fundos) */
  --accent-pink-light: #F0E4EB; /* Rosa claro */
  --line:          rgba(59, 58, 58, 0.12); /* Bordas e divisores */
}
```

---

## 2. Tipografia

| Token | Fonte | Uso |
|---|---|---|
| `.display-title` | Anton (Display) | Títulos de página grandes |
| `.font-title` | Anton | Títulos responsivos |
| `.logo-title` | Anton | Logotipo |
| `.serif-body` | Libre Baskerville (italic) | Citações, descrições poéticas |
| `.label-sm` | Outfit (600, uppercase) | Labels, categorias, badges de texto |
| `font-sans` | Inter | Corpo do texto |

### Escala de tamanhos típicos
- `text-[10px]` — microtext, trends, timestamps
- `text-xs` / `text-sm` — labels secundários
- `text-base` / `text-lg` — corpo de texto padrão
- `text-xl` / `text-2xl` — subtítulos
- `text-3xl` / `text-4xl` — títulos de seção
- `text-5xl` / `display-title` — títulos de página

---

## 3. Paleta de Cores

```
Accent (Verde-Teal):   #6BAF9E  → hover: bg-accent/90 → light: bg-accent/10
Accent Pink (Mauve):   #C9A3B5  → hover: bg-accent-pink/90
Ink (Cinza-escuro):    #3B3A3A
Paper (Off-white):     #F6F9F7
Line:                  rgba(59,58,58, 0.12)
```

### Variações funcionais
- **Sucesso / Positivo**: `bg-accent`, `text-accent`
- **Emocional / Secundário**: `bg-accent-pink`, `text-accent-pink`
- **Destruição / Perigo**: `text-red-500`, `border-red-500/10`
- **Desabilitado**: `bg-ink/30`, `opacity-40`

---

## 4. Espaçamento e Bordas

### Border-radius
| Uso | Classe |
|---|---|
| Botão pequeno (pill) | `rounded-full` |
| Card pequeno | `rounded-2xl` |
| Card médio | `rounded-3xl` |
| Card grande | `rounded-[2rem]` |
| Card premium | `rounded-[2.5rem]` |
| Input | `rounded-2xl` / `rounded-full` |

### Espaçamento padrão entre seções
- `space-y-4` — itens de lista internos
- `space-y-6` — grupos de elementos
- `space-y-8` — seções dentro de um card
- `space-y-10` / `space-y-12` — seções de página

---

## 5. Componentes

### Button — Primário
```tsx
<button className="w-full py-5 bg-accent text-paper rounded-full font-bold uppercase tracking-widest text-sm shadow-lg hover:bg-accent/90 transition-colors">
  Ação Principal
</button>
```

### Button — Secundário (Outline)
```tsx
<button className="w-full py-5 border-2 border-line rounded-full font-bold text-lg hover:bg-ink/5 transition-colors">
  Ação Secundária
</button>
```

### Button — Ghost / Link
```tsx
<button className="text-xs font-bold text-accent hover:underline">
  Ver tudo
</button>
```

### Button — Voltar
```tsx
<button className="w-12 h-12 rounded-full border border-line flex items-center justify-center hover:bg-line transition-colors">
  <ArrowLeft size={20} />
</button>
```

### Button — FAB (Floating Action / Nav primário)
```tsx
<button className="w-16 h-16 rounded-full bg-accent text-paper flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-transform border-4 border-paper">
  <PlusCircle size={28} />
</button>
```

---

### Card — Padrão
```tsx
<div className="bg-white border border-line p-8 rounded-[2.5rem] shadow-sm">
  {/* conteúdo */}
</div>
```

### Card — Accent (Gradiente Animado)
```tsx
<div className="animated-gradient text-paper p-10 rounded-[2.5rem] shadow-lg">
  {/* conteúdo */}
</div>
```

### Card — Accent Light (Background suave)
```tsx
<div className="bg-accent/10 border border-accent/20 p-6 rounded-[2.5rem]">
  {/* conteúdo */}
</div>
```

---

### Input — Underline
```tsx
<input className="w-full py-3 bg-transparent border-b-2 border-line focus:border-accent focus:outline-none transition-colors text-xl font-medium" />
```

### Input — Box
```tsx
<input className="w-full py-3.5 px-5 bg-white border border-line rounded-2xl focus:border-accent focus:outline-none text-base font-medium shadow-sm" />
```

---

### Badge — Label SM
```tsx
<span className="label-sm text-accent">CATEGORIA</span>
```

### Badge — Glass (sobre gradiente)
```tsx
<span className="glass-badge font-bold">Tag</span>
```

### Badge — Pill
```tsx
<span className="text-xs font-bold text-accent bg-accent/10 px-3 py-1 rounded-full">info</span>
```

---

### Toggle Switch
```tsx
<div className={`w-12 h-6 rounded-full p-1 relative cursor-pointer ${active ? 'bg-accent' : 'bg-line'}`}>
  <div className={`w-4 h-4 bg-paper rounded-full shadow-md transition-transform ${active ? 'translate-x-6' : ''}`} />
</div>
```

---

### List Item — Settings
```tsx
<button className="w-full p-6 px-8 flex items-center justify-between border-b border-line hover:bg-accent/5 transition-colors group">
  <div className="flex items-center gap-5">
    <div className="w-12 h-12 rounded-2xl bg-ink/5 flex items-center justify-center group-hover:bg-accent group-hover:text-paper transition-all">
      <Icon size={20} />
    </div>
    <span className="font-bold text-xl">Label</span>
  </div>
  <ChevronRight size={20} className="text-ink/20 group-hover:text-accent" />
</button>
```

---

## 6. Layout e Grid

### Shell do App
```
Desktop: Sidebar (72px, fixed, left) + Main (margin-left: 72px)
Mobile:  Bottom Nav (h-20, fixed, bottom) + Main (pb-28)
```

### PageWrapper
- `max-w-4xl mx-auto`
- `px-6 md:px-12 py-8 md:py-12`
- `pb-28` (espaço para nav mobile)

### Bottom Sheet (Modal)
```
Mobile:  left/right: 0, bottom: 0, rounded-t-3xl, max-h: 92vh
Desktop: max-width: 60%, centered, bottom
```

---

## 7. Animações

### Classes CSS
| Classe | Efeito |
|---|---|
| `.spin-slow` | Rotação lenta (10s) |
| `.animated-gradient` | Gradiente em movimento (10s) |
| `.animated-border` | Borda pulsante entre accent e accent-pink |
| `.snappy` | Transição suave `cubic-bezier(0.23, 1, 0.32, 1)` |

### Motion (Framer Motion)
```tsx
// Entrada de página
initial={{ opacity: 0, y: 15 }}
animate={{ opacity: 1, y: 0 }}
exit={{ opacity: 0, y: -15 }}
transition={{ duration: 0.3, ease: 'easeOut' }}

// Cards e itens
initial={{ opacity: 0, y: 10 }}
animate={{ opacity: 1, y: 0 }}
transition={{ type: 'spring', stiffness: 400, damping: 30 }}

// Hover scale (botões)
whileTap={{ scale: 0.95 }}
```

---

## 8. Ícones

- **Biblioteca principal**: `lucide-react`
- **Ícones especiais**:
  - `BsFlower1` (react-icons/bs) — Logo e loading spinner
  - `FaBrain` (react-icons/fa) — Landing page CTA
  - `FaGoogle` (react-icons/fa) — Login social
  - `GiOvermind` (react-icons/gi) — Biblioteca
  - `TbHealthRecognition` (react-icons/tb) — Saúde
  - `PiHeartbeat` (react-icons/pi) — Humor emocional

---

## 9. Feedbacks (Toast)

Usar o `useToast()` do `src/components/Toast.tsx`:

```tsx
const { toast } = useToast();

toast('Salvo com sucesso!', 'success');
toast('Algo deu errado.', 'error');
toast('Nutri guardou isso com carinho 💚', 'heart');
toast('Verifique os campos.', 'info');
```

### Tipos
| Tipo | Cor | Ícone |
|---|---|---|
| `success` | Verde (accent) | CheckCircle |
| `error` | Vermelho | AlertCircle |
| `info` | Cinza escuro | Info |
| `heart` | Rosa (accent-pink) | Heart |

---

## 10. Estrutura de Arquivos

```
src/
├── App.tsx                    # Root + roteamento
├── index.css                  # Design tokens + utilitários
├── main.tsx                   # Entry point
└── components/
    ├── Toast.tsx              # Sistema de notificações
    ├── AIChat.tsx             # Chat completo com IA
    ├── (futuro) Dashboard.tsx
    ├── (futuro) MealLog.tsx
    ├── (futuro) Profile.tsx
    └── (futuro) DiagnosisQuiz.tsx
```
