# Mesquita Imóveis — Rodando localmente (Windows / Mac / Linux)

Sistema completo de gestão de aluguéis (inquilinos, contratos, recibos PDF, financeiro, CRM, bot de assistência).

Stack: **TanStack Start v1 + React 19 + Vite 7 + Tailwind v4 + Supabase (Lovable Cloud)**.

---

## 1. Pré-requisitos

- **Node.js 20+** — https://nodejs.org
- **Bun** (recomendado) — https://bun.sh  
  Windows PowerShell: `powershell -c "irm bun.sh/install.ps1 | iex"`  
  (alternativa: usar `npm` no lugar de `bun` em todos os comandos)
- **Git** (opcional)

## 2. Configurar variáveis de ambiente

Copie `.env.example` para `.env`:

```bash
cp .env.example .env
```

O `.env.example` já vem preenchido com as chaves **públicas** do projeto Lovable Cloud (são chaves anon/publishable — seguras para ficar no front). Nada mais precisa ser configurado para o app funcionar.

> **Sobre `SUPABASE_SERVICE_ROLE_KEY`**: não é necessária para rodar o app. Ela só é usada para operações administrativas (importar dados em massa, criar usuários direto pela Auth Admin API). No Lovable Cloud essa chave fica oculta. Se você precisar dela, terá que criar **seu próprio projeto Supabase** (passo 5 abaixo).

## 3. Instalar dependências e rodar

```bash
bun install
bun run dev
```

Abra: http://localhost:3000

## 4. Criar primeiro usuário

1. Acesse http://localhost:3000/auth
2. Use **e-mail e senha** para criar uma conta (o login com Google só funciona no domínio Lovable).
3. Pronto — você tem acesso ao painel.

Todos os dados (inquilinos, contratos, pagamentos) já cadastrados no Lovable Cloud aparecem automaticamente, pois você está conectado ao mesmo backend.

## 5. (Opcional) Migrar para seu próprio Supabase

Se quiser independência total do Lovable:

1. Crie um projeto em https://supabase.com
2. Instale a CLI: `npm i -g supabase`
3. Faça login: `supabase login`
4. Vincule: `supabase link --project-ref SEU_REF`
5. Aplique as migrations: `supabase db push`
6. Atualize `.env` com a URL, anon key e service_role key do **seu** projeto.
7. Habilite o provider **Email** em Authentication → Providers.

## 6. Scripts úteis

| Comando | Ação |
|---|---|
| `bun run dev` | Servidor de desenvolvimento (http://localhost:3000) |
| `bun run build` | Build de produção |
| `bun run start` | Roda o build de produção |
| `bun run lint` | ESLint |

## 7. Estrutura

```
src/
  routes/              # Páginas (file-based routing TanStack)
  components/          # Componentes React + shadcn/ui
  lib/
    api/               # Server functions (createServerFn)
    contract-pdf.ts    # Geração de contratos PDF
    receipt-pdf.ts     # Geração de recibos PDF
    contract-templates.ts  # Modelos por condomínio
    bot-templates.ts   # Mensagens WhatsApp
  integrations/supabase/  # Cliente Supabase (auto-gerado)
supabase/migrations/   # Schema SQL versionado
```

## 8. Problemas comuns

- **"Failed to fetch" / 401**: confira se o `.env` foi criado e reinicie `bun run dev`.
- **Login Google não funciona local**: esperado — use email/senha.
- **Porta 3000 ocupada**: `PORT=3001 bun run dev`.
- **Erro de migration ao usar seu Supabase**: rode `supabase db reset` em projeto novo e tente `db push` de novo.

---

Qualquer dúvida, abra o painel Lovable e peça ajuda no chat do projeto.