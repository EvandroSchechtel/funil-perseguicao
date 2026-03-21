# Funil Perseguição — Instruções para o Claude Code

## Regra #1 — Sempre rodar os testes antes de fazer commit

```bash
npm test
```

Se qualquer teste falhar, **não commitar** até corrigir.

---

## Funções Críticas — NUNCA modificar sem rodar os testes

As funções abaixo são o coração do sistema. Um bug aqui significa que **leads não chegam ao Manychat**. Qualquer alteração deve ser feita com extremo cuidado e os testes devem passar 100%.

### `src/lib/manychat/client.ts`

#### `processLeadInManychat` — orquestração principal
**O que faz:** encontra ou cria o subscriber no Manychat e envia o flow.

**Invariantes que NUNCA podem quebrar:**

| # | Invariante | Por que é crítica |
|---|-----------|-------------------|
| 1 | `has_opt_in_whatsapp: true` deve estar em **todas** as chamadas `createSubscriber` | Sem isso, Manychat retorna "Validation error" em flows WhatsApp |
| 2 | O upsert de opt-in (`createSubscriber`) deve rodar **antes** do `sendFlow` | Sem opt-in confirmado, o `sendFlow` falha com "Validation error" |
| 3 | `sendFlow` deve ser chamado com o `subscriber_id` correto | ID errado → lead perdido |
| 4 | Quando o subscriber não é encontrado, retornar `sem_optin: true` (não throw) | Throw faz o BullMQ retentar infinitamente; sem_optin encerra as tentativas |
| 5 | `sendFlow` **não deve ser chamado** quando subscriber não é encontrado | Chamada sem ID válido causaria erro 400 |
| 6 | Falha no `sendFlow` (não sem_optin) deve retornar `ok: false` sem `sem_optin` | Worker precisa do ok=false para fazer throw e ativar retry do BullMQ |
| 7 | Telefone sempre normalizado para E.164 (`+55...`) | Formato errado → subscriber não encontrado |

#### Fluxo de execução (não alterar a ordem):
```
0. knownSubscriberId? → opt-in upsert (fire&forget) → sendFlow → return
1. findByCustomField (whatsapp_field_id + phone E.164)
2. findBySystemField (whatsapp_phone, tenta +55... e 55...)
3. createSubscriber (has_opt_in_whatsapp: true) → se alreadyExists → retry 1+2
4. sem subscriber → return { ok: false, sem_optin: true }
5. [found] opt-in upsert (createSubscriber has_opt_in_whatsapp: true, best-effort)
6. setWhatsappIdField (best-effort, para lookups futuros)
7. sendFlow → return { ok, subscriber_id, error }
```

#### `createManychatSubscriber`
- **Sempre** incluir `has_opt_in_whatsapp: true` no body
- Sem esse campo, o subscriber é criado no Manychat **sem opt-in WhatsApp** e não pode receber flows

#### `sendFlowToSubscriber`
- Não alterar a lógica de mapeamento de erros HTTP
- HTTP 404 → `{ ok: false, error: "Subscriber ou Flow não encontrado." }`
- HTTP 4xx → retorna `data.message` do Manychat (ex: "Validation error")

---

### `src/lib/queue/workers.ts` — `startWebhookWorker`

O worker processa jobs do BullMQ. A lógica de status do lead é:
- `processando` → durante processamento
- `sucesso` → flow executado com sucesso
- `falha` → erro retryável (worker faz `throw` para BullMQ retentar)
- `sem_optin` → subscriber não encontrado, **sem retry** (não throw)

**Não alterar a lógica de branch:**
```typescript
if (result.ok)        → status = "sucesso", não throw
if (result.sem_optin) → status = "sem_optin", não throw
else                  → status = "falha", throw new Error(result.error) // BullMQ retry
```

---

### `src/lib/queue/queues.ts` — `addWebhookJob`

- `jobId: data.leadId` garante deduplicação por lead (um job por lead)
- `forceNew: true` remove o job existente antes de re-enfileirar (usado no reprocessamento)
- `attempts: 3` + backoff exponencial (`5s → 25s → 125s`)
- **Não reduzir as tentativas ou remover o backoff**

---

## Stack técnica

- **Next.js 15** App Router + TypeScript
- **Prisma 7** + Supabase PostgreSQL
- **BullMQ 5** + Redis (worker é processo separado: `npm run worker`)
- **Manychat API v2** (`https://api.manychat.com`)

## Comandos úteis

```bash
npm test              # Rodar testes (obrigatório antes de commit em arquivos críticos)
npm run dev           # Dev server
npm run worker        # Worker BullMQ (processo separado)
npx tsc --noEmit      # Type check
```

## Arquivos de teste

```
src/__tests__/manychat/client.test.ts   # 21 testes cobrindo todas as invariantes acima
```
