# AçaíFood × Contrato Asaas BaaS — Análise de conformidade (02/10/2026)

**Documento analisado:** "Contrato de Prestação de Serviços de Banking as a Service (BaaS)" entre **Eletromecânica Baia Ltda** (Tomadora, CNPJ 42.035.623/0001-40) e **Asaas Gestão Financeira Instituição de Pagamento S.A.**, 14 páginas + Anexo I (Segurança da Informação), assinatura via Clicksign.
**Comparado com:** o código atual do app (auditoria `12_AUDITORIA_POS_R11_2026-10-02.md`).
**Aviso:** é uma leitura técnica de quem conhece o código, **não um parecer jurídico**. Os pontos marcados ⚖️ devem ser confirmados por escrito com o Asaas (Eliana) e, se possível, com um advogado.

## Resumo

O app cumpre bem a **transparência sobre o papel do Asaas** (cláusula 3): o selo aparece no cadastro, no login, nas telas de parceiro, no Pix, no comprovante e no rodapé, e os termos de uso dizem que os serviços financeiros são do Asaas.

Os riscos estão em quatro frentes:
1. **Dados de cadastro (KYC) falsos enviados ao Asaas:** data de nascimento, renda e tipo de empresa fixos no código. Pela cláusula 13.5, isso é infração de **nível 3**.
2. **Modelo do dinheiro:** o Pix cai na conta da Tomadora e depois é repassado. Isso pode conflitar com as cláusulas 2.1, 4.2 e 6, e com os próprios termos do app ⚖️.
3. **"Taxa de Homologação Asaas"** cobrada dos parceiros: a cláusula 6.1 proíbe cobrar do cliente final por serviço financeiro ⚖️.
4. **Anexo I (segurança):** brechas abertas, chave de API que já ficou exposta, falta de MFA, de logs de auditoria e de registro de aceite.

Multas previstas: nível 1 de R$ 20 mil a R$ 100 mil, nível 2 de R$ 50 mil a R$ 200 mil, **nível 3 de R$ 100 mil a R$ 500 mil** por infração, além de rescisão. A cláusula 13.6 permite ao Asaas dar até 30 dias para regularizar sem multa, o que favorece agir antes e comunicar.

---

## Conformidade por cláusula

| Cláusula | Exigência | Situação no app |
|---|---|---|
| **2.1** | A Tomadora não é instituição de pagamento nem intermedeia recursos em nome próprio | ⚠️ ⚖️ O Pix dos pedidos tem como favorecido a **Eletromecânica Baia** (a política de privacidade diz isso). O dinheiro da venda da batedeira entra na conta da Tomadora e depois é repassado (saque antigo e o repasse novo do R11). Os termos do app dizem "não realizando intermediação financeira em nome próprio", e o fluxo real faz o contrário |
| **3.1–3.3** | Marca Asaas clara em apps, cadastro, contratos, termos e comprovantes; nada que confunda | ✅ Selo em cadastro, login, telas, `PixModal`, comprovante e rodapé; termos com a cláusula de serviços financeiros. ⚠️ A política de privacidade abre com "**AçaíFood Tecnologia Ltda.**", empresa diferente da Tomadora, e chama o Asaas de "Asaas IP S.A." (razão social correta: Asaas Gestão Financeira Instituição de Pagamento S.A.). ⚠️ A "Taxa Única de **Homologação Asaas**" dá a entender que o Asaas cobra a ativação (ver 6.1) |
| **4.1–4.3** | Estrutura Asaas → Tomadora → Cliente final → Pagador; proibido revender ou usar como infra para terceiros | ✅ Parceiros (batedeira, fornecedor, motorista) como clientes finais com subconta; consumidor como pagador. ⚠️ O app é apresentado como "AppSolutions76, divisão da Eletromecânica Baia". Se a AppSolutions76 for (ou virar) outra empresa, ou se a mesma conta BaaS for usada em outros apps (MeLeVa, RoletaGelada), isso precisa de autorização ⚖️ |
| **5** | Exclusividade do Asaas para os mesmos serviços | ✅ Só Asaas no código (Mercado Pago e Pagar.me só aparecem em documentos antigos) |
| **6.1** | Não cobrar do cliente final remuneração por serviço financeiro; só por serviço não financeiro/uso da plataforma | ⚠️ ⚖️ A cobrança de ativação se chama "**Taxa Única de Homologação Asaas & Ativação de Parceiro**" (`api/asaas/activation`). Ligada à abertura da subconta, ela é cobrança por serviço financeiro. ✅ Comissão sobre vendas e taxa de frete são remuneração pela plataforma (permitidas). ⚖️ O repasse da tarifa Pix do Asaas aos parceiros (`asaas_fee_split_actors`) precisa respeitar 6.5.1 (nunca acima da tabela pública) e ser confirmado |
| **6.3** | A remuneração da Tomadora é a diferença, repassada automaticamente na liquidação; a clientes com conta pré-existente, só via subconta vinculada | ⚠️ ⚖️ O contrato descreve o modelo "cobrança do cliente final com a remuneração da Tomadora separada na liquidação". O app faz o inverso: cobra tudo na conta da Tomadora e repassa o restante depois. ✅ `link-wallet` só aceita wallet de subconta da própria conta raiz |
| **6.4** | Split só entre Contas Asaas (Tomadora ↔ clientes finais) e nunca 100% da cobrança | ✅ O split foi tirado do checkout no R11. ⚠️ O **saque antigo** manda Pix para **chave digitada** (fora das Contas Asaas), o que contraria o espírito de 6.4 |
| **7.1** | Encaminhar ao Asaas, sem atraso, reclamações sobre serviços financeiros | ❌ O suporte (`SupportChatModal`, `AdminSupportSection`) não separa nem encaminha reclamações financeiras ao Asaas |
| **8.2.1** | Comunicar imediatamente fraude, uso indevido ou incidente a prevencao@asaas.com.br | ⚠️ ⚖️ As auditorias acharam brechas que ficaram em produção (admin por metadata, estorno sem login, Pix de R$ 1, chave Asaas legível no banco). Se houver indício de exploração ou se a chave de API foi exposta, há dever de comunicar (Anexo I, 8.2: em até 24 h; omissão é nível 3) |
| **8.2.2** | Cumprir o check-list de conformidade no prazo | ❓ Não encontrei o check-list. Verificar prazos (9.2: resposta em 30 dias, até 180 dias para ajustes, **rescisão automática** se descumprir) |
| **8.2.3** | CPF/CNPJ válidos; responsabilidade pela veracidade dos dados enviados | ❌ **Crítico.** `api/asaas/subaccount` envia a todo cadastro com CPF `birthDate: '1990-01-01'` e `incomeValue: 3000`, e a todo CNPJ `companyType: 'MEI'`. São dados falsos de KYC (13.5 a, nível 3; 10.2). ⚠️ O próprio usuário pode alterar `cpf_cnpj` a qualquer momento (GRANT UPDATE), mesmo depois de a subconta existir |
| **8.2.4** | Consentimento expresso; procuração quando a Tomadora abre ou movimenta subconta; registro de aceite dos Termos e da Política do Asaas; menção aos Termos do Asaas nos contratos; consentimento para a chave Pix aleatória | ⚠️ Os termos mencionam o Asaas, mas **não linkam** os Termos de Uso e a Política do Asaas. ❌ O aceite fica só na tela (`termosAceitos`); **não há registro** (data, versão, IP). ❌ Não há autorização/mandato para abrir e movimentar a subconta em nome do parceiro, nem consentimento para criar chave Pix aleatória |
| **9 / Anexo I** | Segurança da informação | Ver tabela abaixo |
| **11** | Relatório mensal de qualidade: reclamações procedentes, prazo médio de resposta, SLA de disponibilidade | ❌ Não há métricas nem relatório |
| **12** | A Tomadora responde por estornos, chargebacks e reembolsos | ⚠️ Estornos e repasses com falhas (R1–R5 da auditoria 12) viram prejuízo da Tomadora |

## Anexo I — Segurança da informação

| Item | Exigência | Situação |
|---|---|---|
| 3 | IAM: menor privilégio, MFA, revisão de acessos | ❌ Admin do app sem MFA. ⚖️ Ativar MFA nas contas Asaas, Supabase, Vercel e GitHub. ⚠️ A auditoria 12 mostra funções do banco com privilégio demais (R3, A7) |
| 4.1 a–d | Chaves de API guardadas com segurança, só em produção, acesso mínimo | ⚠️ A chave Asaas já esteve legível para qualquer usuário logado (corrigido em 24/09); `asaasConfig.ts` ainda lê a coluna do banco como alternativa. ⚖️ O agente de IA (Antigravity) e a máquina de desenvolvimento têm acesso ao `.env.local`: conferir se há chave de produção ali (5.3 proíbe credencial de produção fora de produção) |
| **4.1 e** | **Obrigatório:** ao menos um mecanismo extra — validação de saque via webhook, IPs autorizados ou autorização de saque via token/SMS | ❓ ⚙️ Não há no código o webhook de validação de saque. Conferir no painel Asaas se IP autorizado ou token estão ativos |
| 4.2 | Chave comprometida → revogar na hora e comunicar o Asaas | ⚖️ Se a chave antiga não foi revogada depois da exposição, fazer agora e comunicar |
| 5 | Ambientes segregados (dev/teste/homologação/produção) | ⚠️ O sandbox é decidido pelo prefixo da chave. Não há projeto Supabase de teste confirmado; os previews da Vercel podem estar usando produção ⚙️ |
| 6 | Dados protegidos em trânsito e em repouso; segregação | ⚠️ PIN de entrega legível por terceiros (A9); telefone e endereço no radar; webhook grava o **corpo inteiro** (CPF, nome, valor) em `console.log` |
| 7 | Logs de acesso, operações, falhas e mudanças críticas, protegidos e guardados | ⚠️ Há `order_status_history`, `incident_logs` e `pin_attempt_log`, mas não há log das ações de admin (aprovar saque, conciliar, baixa forçada, mudar taxas) nem proteção contra alteração |
| 8 | Gestão de incidentes; comunicar em até 24 h | ❌ Sem processo formal. Há um plano de rotação de chaves na pasta (bom ponto de partida) |
| 9 | Gestão de vulnerabilidades com registro e prazos | ⚠️ As auditorias 03–12 servem de evidência; falta registro com responsáveis e prazos |
| 12 | Backup, DR, RTO/RPO testados | ❓ ⚙️ Confirmar PITR no Supabase e documentar |
| 13 | Desenvolvimento seguro: revisão de código, versionamento, ambientes | ⚠️ Há git e CI com `tsc`; não há revisão de segurança antes do deploy nem testes |

---

## Códigos usados no prompt R12

| Código | Item |
|---|---|
| K1 | KYC com dados fixos (8.2.3) |
| K2 | CPF/CNPJ editável depois da subconta (8.2.3) |
| K3 | Sem registro de aceite, mandato e consentimento da chave Pix (8.2.4) |
| K4 | "Taxa de Homologação Asaas" (6.1/3.3) |
| K5 | Entidade errada na política de privacidade (3.3) |
| K6 | Reclamações financeiras não encaminhadas ao Asaas (7.1) |
| K7 | Sem indicadores mensais de atendimento (11) |
| K8 | Dados pessoais nos logs do webhook (Anexo I, 6/7) |

## Perguntas para enviar ao Asaas (por escrito)

1. **Modelo do dinheiro (decisivo para a Fase 3):** num marketplace com loja e entregador, podemos (a) receber o Pix na conta raiz e, após a confirmação da entrega, transferir por `walletId` para as subcontas dos parceiros? Ou devemos (b) emitir a cobrança na **subconta do vendedor** com split para a Tomadora (nossa comissão) e para o entregador? Existe **conta/recurso de custódia (Escrow)** para segurar o valor até a entrega? Qual opção atende o contrato?
2. **Taxa de ativação de parceiro:** podemos cobrar uma taxa de ativação **da plataforma** (serviço não financeiro), com outro nome e sem citar o Asaas? Ou devemos parar de cobrar?
3. **Tarifa Pix:** podemos repassar a tarifa Pix aos parceiros pelo valor de custo?
4. **AppSolutions76 / outros apps:** podemos usar a mesma conta BaaS para outros apps da Eletromecânica Baia?
5. **Check-list de segurança:** qual é o prazo e o estado do nosso check-list (cláusula 9.2)?
6. **Comunicação de incidentes:** enviar a prevencao@asaas.com.br um resumo das falhas corrigidas e de qualquer indício de exploração (ver `docs/09` e `docs/12`), com as medidas tomadas.

## O que fazer já (sem código)

1. **Não ligar** o repasse novo (Fase 3) até a resposta do Asaas à pergunta 1.
2. **Parar de criar subcontas** pelo app até o KYC deixar de enviar dados fixos. Para as subcontas já criadas com data de nascimento, renda ou tipo de empresa falsos: levantar a lista e combinar com o Asaas como corrigir.
3. Ativar no painel Asaas **IP autorizado** (IPs da Vercel/servidor) ou **token para saques** (Anexo I, 4.1 e).
4. Ativar **MFA** nas contas Asaas, Supabase, Vercel e GitHub.
5. Se a chave de API antiga não foi revogada depois da exposição de setembro, **revogar agora** e comunicar o Asaas.
6. Confirmar backup/PITR no Supabase.
