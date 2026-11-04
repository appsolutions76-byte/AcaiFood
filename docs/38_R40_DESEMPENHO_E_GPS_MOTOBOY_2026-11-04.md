# R40 — Desempenho na abertura e GPS automático do motoboy (2026-11-04)

Correções aplicadas pelo Claude sobre o commit `feat(motoboy): redirecionamento automatico para GPS...`.
Sem mudança de banco (nenhuma migration).

## 1. Lentidão (todos os perfis)

| Antes | Agora |
|---|---|
| GPS do motoboy gravava a posição a cada leitura do celular | Grava no máximo a cada 20 s com deslocamento ≥ 15 m (ou na hora se andou ≥ 150 m) — `updateUserLocation` |
| Cada gravação de posição fazia **todos** os apps abertos recarregarem todos os usuários, lojas e produtos | Evento do Realtime que só muda latitude/longitude atualiza o ponto localmente, sem recarga |
| Eventos de users/storefronts/products recarregavam tudo a cada evento | Recargas agrupadas: no máximo 1 a cada 3 s (`scheduleUsersRefetch`) |
| Tela do motoboy consultava pedidos a cada 3,5 s, mesmo com o app em segundo plano | A cada 6 s e só com o app na tela (ao voltar, recarrega na hora) |
| Tela do motoboy buscava usuários duas vezes na abertura | Uma vez (via `startRealtime`) |
| Janelas pesadas (mapa, Pix, chat, manual, recibo, avaliação, edição de nome) entravam no carregamento inicial | Carregadas sob demanda com `next/dynamic` (home, painel do motoboy e layout dos parceiros) |

## 2. GPS automático do motoboy

- Ao aceitar: recarrega a corrida (o radar só traz o bairro) e abre o mapa até a **loja/batedeira** usando as coordenadas cadastradas; sem coordenadas, o endereço escrito (rua, bairro, cidade). Se faltar no aparelho, busca só o cadastro daquela loja.
- Ao validar o PIN de retirada: abre o mapa até o **cliente** (coordenadas da entrega; sem elas, o endereço da entrega).
- Removido o destino genérico "Ponto do açaí, Belém".
- Como o celular pode bloquear a abertura automática, aparece sempre um **botão grande "Abrir GPS"** fixo na parte de baixo da tela, que funciona com um toque. Se o endereço não for encontrado, o aviso orienta usar o Chat & Voz.

## Arquivos

- `apps/mobile/src/store/useAppStore.ts`
- `apps/mobile/src/app/parceiros/motoboy/page.tsx`
- `apps/mobile/src/app/page.tsx`
- `apps/mobile/src/components/PartnerDashboardLayout.tsx`

## Teste sugerido

1. `npm run build` sem erros.
2. Motoboy online por 2 min: no painel de outro usuário, o app não deve ficar recarregando.
3. Aceitar corrida no celular: abre o Maps até a batedeira, ou aparece o botão "Abrir GPS até a batedeira".
4. Digitar PIN de retirada: abre o Maps até o cliente, ou aparece o botão "Abrir GPS até o cliente".

## Pendências (próxima rodada)

- Não salvar no navegador a lista completa de usuários/produtos (só o necessário).
- Motoboy não precisar baixar os produtos de todas as lojas.
- Carregamento sob demanda também nos painéis da batedeira, fornecedor e admin.
