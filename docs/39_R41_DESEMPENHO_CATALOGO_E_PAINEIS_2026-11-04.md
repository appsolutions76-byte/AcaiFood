# R41 — Desempenho: catálogo, armazenamento e painéis (2026-11-04)

Continuação da R40 (`docs/38`). Sem mudança de banco (nenhuma migration).

## O que mudou

| Antes | Agora |
|---|---|
| Tela do cliente, batedeira e fornecedor recarregavam **todas as lojas, usuários e produtos (com fotos)** a cada 4 s, mesmo com o app em segundo plano | A cada 15 s e só com o app na tela; as mudanças chegam na hora pelo Realtime (agrupadas em até 3 s, R40) |
| Na abertura dessas telas, lojas e usuários eram buscados em dobro | Uma vez (via `startRealtime`) |
| Ao voltar para o app (foco), recarga forçada de tudo | Recarga só se a última tiver mais de 10–12 s |
| Motoboy e caminhão baixavam cardápio, fotos e produtos de todas as lojas | Modo leve `startRealtime({ lite: true })`: só nome, endereço, GPS e status; o que já estava na memória é mantido |
| Motoboy/caminhão: radar a cada 3,5 s sempre (caminhão) | A cada 6 s e só com o app na tela |
| Fotos embutidas (`data:`) de todas as lojas eram gravadas no armazenamento do navegador a cada atualização | Fotos dos outros usuários não vão para o navegador (voltam do servidor ao abrir); o perfil do próprio usuário é guardado completo |
| Painéis batedeira, fornecedor, caminhão, admin e apresentação carregavam todas as janelas/abas pesadas de início | Carregadas sob demanda (`next/dynamic`): mapa, Pix, chat, manual, foto, impressora térmica, indicações, avaliações, pedido parado, abas do admin, vídeo da apresentação |

## Arquivos

- `apps/mobile/src/store/useAppStore.ts`
- `apps/mobile/src/app/page.tsx`
- `apps/mobile/src/app/parceiros/{motoboy,caminhao,batedeira,fornecedor}/page.tsx`
- `apps/mobile/src/app/admin/page.tsx`
- `apps/mobile/src/app/apresentacao/page.tsx`

## Teste sugerido

1. `npm run build` sem erros.
2. Cliente: abrir o app, ver lojas e cardápio com fotos; batedeira muda preço ou fecha a loja → cliente vê em até ~15 s (na hora se o Realtime estiver ativo).
3. Batedeira/fornecedor: pedidos novos tocam e aparecem; impressora térmica abre e imprime; Pix de ativação abre.
4. Motoboy/caminhão: radar, aceitar corrida, GPS e PIN funcionando; nomes e bairros das lojas aparecem.
5. Admin: todas as abas abrem (suporte, saques, conciliação, simulador, avaliações, ocorrências).

## Pendência estrutural (próxima etapa, se necessário)

As fotos de lojas e produtos ainda ficam embutidas no banco (texto `data:` dentro de `storefronts.logo_url`).
Mover para o Storage do Supabase (só o link no banco) reduziria muito o tamanho de cada consulta do catálogo.
