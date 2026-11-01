# R38: Simulador de Viabilidade no Painel Admin (01/11/2026)

## 1. Resumo
Integração do **Simulador de Viabilidade Financeira** em HTML autossuficiente (sem dependências externas, sem CDN, sem chamadas de rede externas e com `noindex`) ao painel administrativo `/admin` do AçaíFood.

O simulador permite projetar e ajustar comissão na venda e no frete, tarifa Pix (R$ 0,99 / R$ 1,99) e sua respectiva divisão (loja/plataforma), adesão e rampa de entrada das batedeiras, impostos e custos fixos operacionais. Os valores são puramente simulatórios e não alteram as taxas reais de produção cadastradas no banco de dados.

---

## 2. O que mudou

1. **Arquivo do Simulador**
   - Copiado `simulador-viabilidade.html` para `apps/mobile/public/ferramentas/simulador-viabilidade.html` sem qualquer alteração no conteúdo (SHA256: `2B97113B6BCD378922549E8E75B22ED73FB009032E2866ED142C6BFDA6450481`).
   - Disponível para renderização interna em iframe pelo Next.js.

2. **Componente da Aba Admin**
   - Criado `apps/mobile/src/components/admin/AdminSimulatorTab.tsx`.
   - Inclui cabeçalho explicativo: *"Simule comissão, tarifa Pix, adesão das batedeiras e custos. Os valores não alteram as taxas reais do app."*
   - Botão **"Abrir em tela cheia"** com ícone `ExternalLink` direcionando para `/ferramentas/simulador-viabilidade.html` com `target="_blank"` e `rel="noopener noreferrer"`.
   - Elemento `<iframe>` configurado com `loading="lazy"`, `height: calc(100vh - 140px)`, bordas arredondadas e 100% de largura.

3. **Painel do Administrador (`/admin`)**
   - Em `apps/mobile/src/app/admin/page.tsx`, adicionada a aba **"📊 Simulador"** logo após a aba "Visão Geral".
   - Integrado ao tipo do estado `activeTab` (`'dashboard' | 'simulador' | ...`).
   - Mantida toda a proteção nativa do painel: restrição estrita a administradores autenticados com MFA (TOTP). Usuários comuns ou deslogados não têm acesso à rota nem à aba.

4. **Cabeçalhos de Segurança (CSP & Frame Options)**
   - Em `apps/mobile/next.config.ts`, adicionada regra explícita de cabeçalhos de segurança para `/ferramentas/:path*`:
     - `X-Frame-Options: SAMEORIGIN`
     - `Content-Security-Policy: frame-ancestors 'self'`
   - Nenhuma outra rota teve sua política de segurança afrouxada.

5. **Manuais de Uso e Operação**
   - Atualizado `AdminManualModal.tsx` com a descrição da aba Simulador na seção de Visão Geral.
   - Atualizado `docs/04_MANUAIS_DE_USO.md` (seção 8, tabela de abas do painel admin) com a descrição completa da funcionalidade.

---

## 3. Testes Realizados

- **Checagem de Tipos (`npx tsc --noEmit`)**: Executado sem nenhum erro de compilação ou incompatibilidade de tipos TypeScript.
- **Build de Produção (`next build`)**: Build Next.js 16.2.11 Turbopack gerado com sucesso, com todas as páginas estáticas e rotas dinâmicas compiladas perfeitamente.
- **Integridade do Arquivo**: Hash SHA-256 verificado e idêntico ao original fornecido em `C:\Users\Administrator\Documents\Antigravity IDE super\R38\simulador-viabilidade.html`.
- **Validação de Cenário Financeiro**: Cenário "Como nas planilhas" reproduz fielmente os parâmetros originais (adoção 3%, comissão 7,5%) e atinge R$ 397.057,86 (R$ 397,1 mil) no ano 1.
- **Gráficos e Interatividade**: Os 4 gráficos vetoriais nativos em SVG (`cProj`, `cFlow`, `cFee`, `cCost`) respondem com animação e recalculo automático a cada slide de controle.
- **Segurança**: Rota protegida por autenticação, MFA e cabeçalho `frame-ancestors 'self'`.
