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

A `003` é obrigatória para o painel de artigos e para o upload de fotos das refeições.

## IA (Groq)

- Texto (jornada dos Insights): `openai/gpt-oss-120b`.
- Visão (foto da refeição): `qwen/qwen3.8-27b`, o modelo multimodal disponível na Groq. O GPT-OSS 120B não aceita imagens na API.
- Configure apenas `GROQ_API_KEY` no servidor. Os modelos podem ser sobrescritos por `GROQ_TEXT_MODEL` e `GROQ_VISION_MODEL`.

## Painel administrativo

Acesse `http://localhost:3000/nutricionista` (ou `/nutricionista` no domínio de produção). O login usa apenas a senha administrativa.

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
