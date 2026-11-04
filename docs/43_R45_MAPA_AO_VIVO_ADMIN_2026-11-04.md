# R45 — Mapa ao vivo no Admin (2026-11-04)

Nova aba **🗺️ Mapa ao vivo** (somente leitura).

## O que mostra
- Batedeiras (aberta/fechada), fornecedores, motoboys e caminhões (online / em corrida / pausado).
- **Clientes não aparecem** (endereço residencial é dado pessoal — LGPD). Bloqueados também não.
- Contadores: lojas abertas, motoboys online, em corrida, fornecedores e caminhões online.
- Filtros por tipo, cidade e "só online / abertos agora"; botão Centralizar.
- Toque no marcador: nome, tipo, status, bairro/cidade e há quanto tempo a posição foi atualizada.
- Atualiza sozinho a cada 30 s (só com a aba visível). Lista quem está sem localização cadastrada.

## Técnico
- `GET /api/admin/live-map` (só admin, service role). "Em corrida" = entregador com pedido IN_TRANSIT/DELIVERING/DELIVERED.
- Mapa Leaflet + OpenStreetMap (o mesmo já usado no app), carregado só ao abrir a aba.
- `/api/user/location` passa a gravar `users.location_updated_at`.

## Banco (migration aditiva)
- `supabase/migrations/20261104010000_r45_users_location_updated_at.sql`: `ALTER TABLE users ADD COLUMN IF NOT EXISTS location_updated_at timestamptz`.
- Rollback: `supabase/rollback/20261104010000_r45_users_location_updated_at_rollback.sql`.
- O código funciona **antes** da migration (sem a hora da posição) e passa a mostrar a hora depois que ela for aplicada.

## Arquivos
- apps/mobile/src/app/admin/page.tsx
- apps/mobile/src/app/api/admin/live-map/route.ts (novo)
- apps/mobile/src/components/admin/AdminLiveMapSection.tsx (novo)
- apps/mobile/src/app/api/user/location/route.ts
- supabase/migrations/… e supabase/rollback/… (novos)
