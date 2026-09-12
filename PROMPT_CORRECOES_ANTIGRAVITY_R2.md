# Prompt de Correções — Rodada 2 (AçaíFood / AppAçaíBelém)

> Contexto para o agente: você (Antigravity) já executou uma rodada anterior de correções de segurança neste projeto (`PROMPT_CORRECOES_ANTIGRAVITY.md`). Foi feita uma reauditoria do resultado e a maior parte dos itens foi confirmada como corrigida corretamente. Este prompt cobre **apenas os itens que ficaram pendentes**: 1 bug crítico introduzido na própria correção anterior, 3 itens parciais que precisam ser fechados, e 1 item não corrigido. Siga a ordem de prioridade abaixo. Não é necessário revisar novamente o que já foi confirmado como concluído.

---

## P0 — CRÍTICO: corrigir bug na migration `20260912010000_secure_order_creation.sql`

**Problema:** a função `validate_and_sanitize_order_fees()` lê `platform_settings` inteiro em uma variável `RECORD` (`SELECT * INTO v_settings FROM public.platform_settings LIMIT 1;`) e depois tenta acessar campos que **não existem** nessa tabela: `b2c_platform_fee_percent`, `b2c_delivery_fee_per_km`, `b2c_delivery_platform_fee_percent`, e os equivalentes para `b2b_*` e `ecopoint_*`.

As colunas reais de `platform_settings` (confirme no schema atual antes de aplicar) são `courier_payment_mode`, `courier_fixed_fee`, `transporter_payment_mode`, `transporter_fixed_fee`, `ecopoint_payment_mode`, `ecopoint_fixed_fee` — nada com o nome `*_platform_fee_percent` ou `*_delivery_fee_per_km`. Além disso, `applied_platform_fee_percent` e `applied_delivery_platform_fee_percent` são colunas da tabela `orders`, não de `platform_settings`.

Acessar um campo inexistente em um `RECORD` do PL/pgSQL gera erro em tempo de execução. Como esse trigger dispara em **todo INSERT ou UPDATE** na tabela `orders`, se essa migration for aplicada no banco como está, **toda criação e atualização de pedido no app vai quebrar**.

**Ação obrigatória — não aplicar a migration atual em produção.** Substitua o conteúdo do arquivo `supabase/migrations/20260912010000_secure_order_creation.sql` por uma versão que:

1. Primeiro confirme, olhando o schema real de `platform_settings` (migrations anteriores / `master_clean_schema.sql`), quais colunas de taxa realmente existem hoje. Se não existir nenhuma coluna de taxa percentual/por-km em `platform_settings` ainda, a função deve apenas preservar o valor que já está em `NEW` (não sobrescrever com um padrão arbitrário), a menos que o valor esteja nulo — nesse caso use fallback fixo (10% de plataforma, R$2/km) e deixe claro no código que é um valor default enquanto essas colunas não existirem.
2. Acesse os campos por `to_jsonb(v_settings) ->> 'nome_da_coluna'` (ou `to_jsonb(t)` sobre a linha), nunca por `v_settings.nome_da_coluna` direto, para não quebrar caso a coluna não exista — `->>` sobre uma chave ausente retorna `NULL` em vez de erro.
3. Trate a conversão de texto para numérico com `NULLIF(...,'')::numeric` (ou `CAST` com tratamento de exceção) antes do `COALESCE`, já que `->>` sempre retorna `TEXT`.
4. Mantenha a parte que já está correta: `IF NEW.products_subtotal < 0 THEN NEW.products_subtotal := 0; END IF;`.
5. Depois de reescrever, rode `EXPLAIN` ou um teste manual de `INSERT`/`UPDATE` em `orders` em ambiente de homologação antes de aplicar em produção, para confirmar que o trigger não lança mais exceção.

**Pendência conhecida (registrar, não é bloqueante):** mesmo corrigido, esse trigger só impede `products_subtotal` negativo — ele não recalcula o subtotal a partir do preço real dos produtos no catálogo (`order_items` / `products`). Um comprador ainda pode, em tese, gravar um pedido com `products_subtotal` artificialmente baixo direto pela API do Supabase, e como o checkout confia nesse campo do pedido, cobraria exatamente esse valor baixo. Se for possível nesta rodada, avalie criar uma função `create_order_secure` (RPC) que recebe os itens do pedido e calcula o subtotal a partir da tabela `products` no servidor, em vez de aceitar `products_subtotal` vindo do cliente. Se não for possível agora, registre como item pendente para uma próxima rodada — não deixe de aplicar a correção do item 1-5 acima por causa disso.

---

## P1 — Fechar os 3 itens parciais

### P1.1 — Ledger de saldo (`partner_ledger`) não está sendo alimentado

A tabela `partner_ledger` e as políticas de RLS foram criadas corretamente na migration `20260912020000_create_partner_ledger.sql`, mas **nenhum lugar do código grava nela**. Resultado: a tabela existe mas está desconectada do fluxo real de pagamento.

Ação: em `apps/mobile/src/app/api/asaas/transfer/route.ts` e em `supabase/functions/payout-sweep/index.ts` (os dois pontos onde um repasse é efetivamente feito a vendedor/motorista), inserir uma linha em `partner_ledger` sempre que uma transferência for confirmada com sucesso:
- `type = 'credit'` quando o repasse é feito ao parceiro (vendedor ou motorista).
- `amount` = valor transferido.
- `reason` = referência ao pedido (`order_id`) e ao papel (seller/driver).
- `balance_after` = saldo acumulado do parceiro após esse crédito (para calcular isso, pode ser necessário somar créditos e débitos anteriores do mesmo `partner_id`, ou manter um saldo corrente em outra tabela/coluna — usar a abordagem mais simples que não exija migração de schema adicional).

Como `payout-sweep` (Edge Function/Deno) não pode importar arquivos `lib/` do Next.js diretamente, replique a lógica de inserção como já foi feito para o cálculo de payout (`payoutCalc.ts` tem uma cópia Deno-compatible inline no payout-sweep) — mantenha esse padrão.

### P1.2 — Regra de cota de fundador ainda duplicada em 3 lugares

`apps/mobile/src/lib/founderQuota.ts` foi criado com a função `getFounderQuotaStatus()`, mas só é usado pelo `GET` de `apps/mobile/src/app/api/asaas/activation/route.ts`. Os outros dois lugares continuam com lógica própria duplicada:
- `POST` do mesmo arquivo `apps/mobile/src/app/api/asaas/activation/route.ts` — ainda tem lógica inline própria de cota de fundador.
- `apps/mobile/src/app/api/asaas/subaccount/route.ts` — tem uma **terceira cópia independente**, com um valor padrão diferente (`freeQuota = 8`) das outras duas (que usam 50). Essa divergência de valores é o tipo exato de inconsistência que centralizar a lógica deveria eliminar.

Ação: substitua a lógica inline nos dois lugares acima por chamadas a `getFounderQuotaStatus()` de `lib/founderQuota.ts`, garantindo que o valor padrão de cota usado seja o mesmo nos três pontos (confirme com o padrão já adotado no `GET`, que usa 50, e corrija o `subaccount/route.ts` para não usar mais 8).

### P1.3 — Logs sensíveis ainda expostos no payout-sweep

Os logs com o corpo completo da transferência (incluindo chave Pix) já foram removidos de `apps/mobile/src/app/api/asaas/transfer/route.ts` e `apps/mobile/src/app/api/asaas/checkout/route.ts` na rodada anterior, mas `supabase/functions/payout-sweep/index.ts` ainda faz `console.log` do `transferBody` inteiro tanto no bloco de repasse ao vendedor quanto ao motorista.

Ação: remova ou mascare esses logs. Se for necessário manter algum log para depuração, logue apenas campos não sensíveis (ex.: `order_id`, `role`, `value`, código de resposta da Asaas) e nunca a chave Pix ou outros dados bancários completos.

(Nota à parte, menor prioridade: `apps/mobile/src/store/useAppStore.ts` ainda tem por volta de 79 chamadas a `console.*` — não é sensível como os casos acima, mas vale uma limpeza geral de logs em uma rodada futura de qualidade de código.)

---

## P2 — Corrigir o item não resolvido: `package-lock.json`

O lockfile raiz foi reescrito (mudou tamanho e data), mas ainda contém uma entrada `apps/admin` marcada como `"extraneous": true` pelo próprio npm, e a lista de `workspaces` do lockfile ainda inclui `packages/*`, que não existe no `package.json` da raiz (que declara apenas `["apps/*"]`). Isso indica que não houve uma reinstalação limpa.

Ação: na raiz do monorepo, rodar:
```
rm -rf node_modules package-lock.json
npm install
```
e confirmar depois que `package-lock.json` não contém mais nenhuma entrada `extraneous` nem referências a `packages/*`. Não editar o `package-lock.json` manualmente — deixar o `npm install` regenerá-lo do zero a partir do `package.json` real.

---

## P3 — Teste manual obrigatório antes de considerar essa rodada concluída

A migration `20260912000000_fix_users_privilege_escalation.sql` (já aplicada/confirmada como correta na reauditoria) revogou `UPDATE` genérico na tabela `users` e liberou apenas uma lista específica de colunas. Isso é o comportamento correto de segurança, mas o Postgres rejeita a operação inteira se a tela de "editar perfil" do app enviar, no mesmo UPDATE, qualquer campo fora dessa lista (mesmo que o valor não tenha mudado) — por exemplo, se o código mandar o objeto do usuário quase inteiro de uma vez em vez de só os campos alterados.

Ação: depois de aplicar as correções acima, testar manualmente o fluxo de "editar perfil" para cada papel de usuário (cliente, loja/vendedor, fornecedor, motorista) e confirmar que nenhuma tela está enviando campos como `role`, `status`, `asaas_wallet_id`, `is_admin` ou `split_enabled` junto com a atualização de perfil. Se algum fluxo quebrar, ajustar o código do front-end para enviar só os campos realmente editáveis (name, phone, telefone, address, endereco, cidade, bairro, latitude, longitude, vehicle_type, is_online, pix_key, cpf_cnpj), e não a lista completa de colunas do usuário.

---

## Ordem recomendada de execução

1. **P0** (bug crítico) — obrigatório antes de aplicar qualquer migration nova em produção.
2. **P2** (lockfile) — rápido e sem dependências, pode ser feito em paralelo.
3. **P1.1, P1.2, P1.3** (itens parciais) — fecham de vez o que ficou pela metade.
4. **P3** (teste manual) — só depois que as migrations (incluindo a corrigida do P0) forem aplicadas em homologação.

## Fora do escopo deste prompt (ações que não são de código)

Estas continuam pendentes e não podem ser executadas por um agente de código — ficam para o responsável pelo projeto:
- Rotacionar chaves: Asaas de produção, Supabase Service Role, `INTERNAL_API_SECRET`, `ASAAS_WEBHOOK_TOKEN`.
- Atualizar as variáveis de ambiente correspondentes na Vercel/Supabase.
- Checar o histórico do Git em busca de arquivos `.env` commitados por engano.
- Confirmar que o agendamento (cron) do `payout-sweep` está ativo e rodando no intervalo esperado.
- Considerar um pentest antes de qualquer divulgação pública mais ampla do app.
