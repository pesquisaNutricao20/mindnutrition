# Mind Nutrition

PWA de alimentação consciente em React + Vite, com Supabase para autenticação/dados, IA na Groq e painel administrativo protegido por hash.

## Rodar localmente

```bash
npm install
npm run dev        # app + /api em http://localhost:3000
npm run build
npm start          # produção (Express) em http://localhost:3001
```

Copie `.env.example` para `.env.local` e preencha os valores. Segredos **nunca** devem usar o prefixo `VITE_`, pois esse prefixo expõe a variável no navegador.

## Supabase

Rode as migrations no SQL Editor do Supabase, nesta ordem:

1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/002_meals_update_policy.sql`
3. `supabase/migrations/003_articles_storage.sql` — cria a tabela `articles`, colunas de auditoria e o bucket privado `meal-photos` com políticas por usuário.
4. `supabase/migrations/004_care_messages_appointments.sql` — cria a conversa (`messages`), a agenda (`appointments`), os dias bloqueados (`appointment_blocks`), a coluna `content_html` dos artigos e atualiza a limpeza de dados da conta.

A `003` é obrigatória para o painel de artigos e para o upload de fotos das refeições. A `004` é obrigatória para a conversa, a agenda de consultas e o editor rico de artigos.

## IA (Groq)

- Texto (jornada dos Insights): `openai/gpt-oss-120b`.
- Visão (foto da refeição): `qwen/qwen3.8-27b`, o modelo multimodal disponível na Groq. O GPT-OSS 120B não aceita imagens na API.
- Configure apenas `GROQ_API_KEY` no servidor. Os modelos podem ser sobrescritos por `GROQ_TEXT_MODEL` e `GROQ_VISION_MODEL`.
- Fallback de texto: com `NVIDIA_API_KEY` configurada, falhas da Groq (429, 5xx, timeout, chave ausente) passam automaticamente para `minimaxai/minimax-m3.1-flash` na NVIDIA. O modelo é somente texto — fotos continuam exclusivamente na Groq. Opcional: `NVIDIA_TEXT_MODEL`.

### Nutrição comportamental nas respostas da IA

Os prompts de texto e de visão seguem uma mesma diretriz: acolher sem julgar, não citar calorias, macronutrientes ou metas, não classificar alimentos como bons ou ruins e não usar linguagem de culpa, restrição ou cobrança.

Na análise da foto, a IA só inclui alimentos que reconhece com segurança. O que fica incerto é omitido da análise e informado em `naoIdentificados` ("Não incluído na análise por incerteza"), com convite para a pessoa completar o registro se quiser.

## Conversa e agenda

- **Paciente** (`/` → Mensagens ou cartão "Seu acompanhamento"): conversa privada com a nutricionista e marcação de consulta em um calendário que já desconsidera dias bloqueados, domingos e horários ocupados.
- **Nutricionista** (`/nutricionista` → Mensagens e Agenda): lê e responde cada conversa, aceita ou recusa solicitações, vê o calendário do mês e pode bloquear dias.
- Toda solicitação nasce como `pending` e só vira `confirmed` com o aceite. Há no máximo uma consulta ativa por pessoa e um horário ativo por slot.
- As mensagens são atualizadas por polling curto (a conversa aberta atualiza a cada ~9s), sem depender de realtime do Supabase.

## Painel administrativo

Acesse `http://localhost:3000/nutricionista` (ou `/nutricionista` no domínio de produção). O login usa apenas a senha administrativa.

Abas disponíveis: **Visão geral**, **Agenda**, **Mensagens**, **Usuários** e **Artigos**. Em Usuários, os ícones de cada linha abrem os insights do paciente ou iniciam uma conversa. Os insights reúnem fome física/emocional, satisfação, períodos do dia, humor, diário, sono, medidas e consultas — sempre com leitura acolhedora.

Os artigos usam o editor Tiptap (títulos, negrito, listas, citações, links e imagens). O HTML é saneado no servidor antes de ser salvo; a biblioteca renderiza o conteúdo rico e mantém os parágrafos em texto puro para compatibilidade.

### Gerar o hash da senha

```bash
npm run admin:hash -- "sua-senha-forte"
```

O comando imprime uma linha no formato:

```env
ADMIN_KEY_HASH=scrypt$32768$8$1$<salt>$<key>
```

Adicione essa linha ao `.env.local` (ou às variáveis de ambiente do servidor), reinicie a aplicação e entre com a senha usada na geração.

- O hash usa scrypt (`N=32768`, `r=8`, `p=1`) e salt aleatório. Cada execução gera um hash diferente, mas todos validam a mesma senha.
- Para trocar a senha, gere um novo hash e reinicie o servidor.
- `ADMIN_KEY` em texto puro ainda funciona como alternativa legada, mas `ADMIN_KEY_HASH` é o modo recomendado.
- Opcionais: `ADMIN_SESSION_SECRET` (segredo do cookie) e `ADMIN_SESSION_TTL_HOURS` (padrão 8, máximo 72).
- A sessão é um cookie `HttpOnly`, `SameSite=Strict` e assinado com HMAC. O login tem limite de tentativas por IP e valida a origem da requisição.

Sem `ADMIN_KEY_HASH` (ou `ADMIN_KEY`), o login retorna uma mensagem pedindo a configuração no servidor.

## Deploy na Vercel

O `vercel.json` já configura o fallback de SPA (para abrir `/nutricionista` direto) e os headers de segurança/cache. Todas as rotas `/api/*` são atendidas por uma única Serverless Function (`api/index.js`, com os handlers em `api/_routes/`), porque o plano Hobby limita o deployment a 12 funções. Cadastre as variáveis em **Settings → Environment Variables** (Production e Preview) e faça um novo deploy:

| Variável | Uso |
|---|---|
| `ADMIN_KEY_HASH` | Login do painel (hash gerado com `npm run admin:hash`) |
| `ADMIN_SESSION_SECRET` | Opcional; segredo do cookie de sessão |
| `ADMIN_SESSION_TTL_HOURS` | Opcional; validade da sessão (padrão 8, máximo 72) |
| `GROQ_API_KEY` | IA de texto e de imagem |
| `NVIDIA_API_KEY` | Opcional; fallback de texto (MiniMax M3.1) quando a Groq falha |
| `SUPABASE_URL` | URL do projeto Supabase (servidor) |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave service role (somente servidor) |
| `VITE_PUBLICSUPABASE_URL` | URL pública usada no build do cliente |
| `VITE_PUBLICSUPABASE_ANON_KEY` | Chave anon pública usada no build do cliente |

As variáveis `VITE_*` são embutidas no build: altere-as antes de gerar o deploy. Nunca use prefixo `VITE_` em segredos.

Depois do deploy, `GET /api/health` retorna apenas booleanos indicando se IA, admin e Supabase administrativo estão configurados — útil para conferir as variáveis sem expor valores.
