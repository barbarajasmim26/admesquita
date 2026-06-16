## 1. Contrato — espaçamento idêntico ao PDF original

Em `src/lib/contract-pdf.ts`:
- Aumentar `line-height` para **1.5** em todos os blocos de texto.
- Aumentar margem entre parágrafos (`Parágrafo primeiro/segundo/terceiro`) — espaço em branco antes de cada um.
- Espaço extra antes/depois dos títulos centralizados (`OBJETO E DESTINAÇÃO`, `PRAZO DA LOCAÇÃO...`).
- Manter `font-size`, fonte (Times), negritos e textos exatamente como já estão.
- Margens da página um pouco maiores para combinar com o original.

## 2. Card do inquilino abre o perfil

Hoje o card em `src/routes/inquilinos.tsx` chama `TenantDialog` ao clicar. Vou:
- Tornar o **card inteiro clicável** indo para `/inquilinos/$id` (perfil completo já existe).
- Mover o botão "Editar" para um ícone discreto no canto, sem competir com o clique no card.
- No perfil (`inquilinos.$id.tsx`), garantir que apareçam:
  - grade de meses pagos/em atraso (já existe via `MonthlyPaymentGrid`) — confirmar visibilidade no topo.
  - botão **"Marcar como ex-inquilino"** (abre `EndTenancyDialog` já existente).
  - botão **"Enviar recibo via WhatsApp"** — gera link `https://wa.me/<telefone>?text=<mensagem+linha+do+recibo>`.
  - botão **"Cobrar via WhatsApp"** — mensagem pronta com valor, mês, chave PIX.

## 3. Bot interno de cobranças e avisos (sem API paga)

Nova aba **"Assistente"** (`src/routes/assistente.tsx`) + sino de notificações no header.

### Como funciona
- Server function `getBotSuggestions` varre `tenants`/`payments`/`contracts` e retorna uma lista de sugestões:
  - **Cobrança**: inquilino com mês atual em aberto ou em atraso. Mensagem pronta: *"Olá {nome}, tudo bem? Passando para lembrar do aluguel de {mês} no valor de R$ {valor}. Pix: {chave}. Qualquer dúvida estou à disposição."*
  - **Lembrete pré-vencimento**: 3 dias antes do dia de vencimento.
  - **Recibo do mês**: quando o pagamento é marcado como pago, sugere gerar+enviar recibo.
  - **Contrato vencendo**: 60/30 dias antes do fim.
  - **Reajuste anual**: aniversário do contrato.
- Cada sugestão tem botões: **"Enviar no WhatsApp"** (abre `wa.me`), **"Editar mensagem"**, **"Marcar como feito"**, **"Dispensar"**.
- Toda ação requer confirmação sua — nada sai sozinho.

### Notificações
- Badge com contagem no header (sino).
- Painel lateral lista as sugestões ativas, ordenadas por urgência (atraso > vencimento próximo > rotina).
- Persistência: tabela `bot_actions` (id, tenant_id, type, status: pending/done/dismissed, payload jsonb, created_at).

## 4. Banco de dados

Migração nova:
- `bot_actions` (tenant_id, type, status, message, due_at, payload jsonb) + RLS + GRANTs.

## 5. Detalhes técnicos

- Tudo client-side React + server fns (sem custos extras de API).
- WhatsApp via `wa.me/<telefone>?text=<encodeURIComponent(msg)>` — abre WhatsApp Web/App com mensagem pronta. Você só revisa e aperta enviar.
- Templates de mensagens centralizados em `src/lib/bot-templates.ts` para você poder editar texto facilmente depois.

## 6. Entrega

Ao final, todas as mudanças ficam aplicadas no preview e você consegue testar. Não envio "código solto" — o sistema fica pronto rodando aqui mesmo (preview e publicação por um clique).

## Arquivos afetados
- `src/lib/contract-pdf.ts` — espaçamento
- `src/routes/inquilinos.tsx` — card clicável
- `src/routes/inquilinos.$id.tsx` — botões ex-inquilino, WhatsApp recibo/cobrança
- `src/routes/assistente.tsx` (novo) — painel do bot
- `src/components/BotNotifications.tsx` (novo) — sino
- `src/components/AppLayout.tsx` — adicionar item de menu + sino
- `src/lib/bot-templates.ts` (novo) — textos
- `src/lib/api/crm.functions.ts` — `getBotSuggestions`, `updateBotAction`
- `supabase/migrations/*` — tabela `bot_actions`
