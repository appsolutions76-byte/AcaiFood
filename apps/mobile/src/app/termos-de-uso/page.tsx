"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, FileText, Wallet, Bike, RotateCcw, Banknote, ShieldCheck, KeyRound } from "lucide-react";
import { AsaasPartnerBadge } from "@/components/AsaasPartnerBadge";

// Texto vigente: docs/legal/TERMOS_DE_USO_ACAI_FOOD.md, MANDATO_SUBCONTA_ASAAS.md e
// CONSENTIMENTO_PIX_ALEATORIO.md (versão em lib/legalVersions.ts).
const VERSION_LABEL = "24 de outubro de 2026";

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold text-white flex items-center gap-2">{icon} {title}</h2>
      {children}
    </section>
  );
}

export default function TermosDeUsoPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans p-4 sm:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <Link href="/" className="flex items-center gap-2 text-purple-400 hover:text-purple-300 font-bold text-sm transition">
            <ArrowLeft size={16} /> Voltar para o AçaíFood
          </Link>
          <Link href="/politica-de-privacidade" className="text-xs text-purple-300 underline">Política de Privacidade</Link>
        </div>

        <div className="bg-purple-900/40 border border-purple-800/60 p-6 sm:p-8 rounded-3xl space-y-3">
          <h1 className="text-2xl sm:text-4xl font-extrabold text-white">Termos de Uso, Mandato e Consentimento Pix</h1>
          <p className="text-sm text-purple-200">
            Versão de {VERSION_LABEL} | Eletromecânica Baia Ltda (CNPJ 42.035.623/0001-40), titular da plataforma AçaíFood
          </p>
        </div>

        <div className="space-y-6 text-sm text-zinc-300 leading-relaxed bg-zinc-900/60 p-6 sm:p-8 rounded-3xl border border-zinc-800">
          <Section icon={<FileText className="text-purple-400" size={18} />} title="1. O que é o AçaíFood">
            <p>O AçaíFood é uma plataforma de tecnologia (marketplace) que conecta clientes, lojas/batedeiras de açaí, fornecedores de frutos, motoboys e caminhoneiros autônomos e pontos de coleta de resíduos.</p>
            <p>A Eletromecânica Baia Ltda desenvolve e opera a plataforma. Ela <strong>não é</strong> restaurante, batedeira, transportadora, banco nem instituição de pagamento, e <strong>não guarda dinheiro de clientes ou parceiros</strong>.</p>
          </Section>

          <hr className="border-zinc-800" />

          <Section icon={<ShieldCheck className="text-purple-400" size={18} />} title="2. Serviços financeiros (Asaas)">
            <p>Os serviços financeiros e de pagamentos (contas de pagamento, cobranças Pix, transferências, estornos e saques) são prestados pelo <strong>ASAAS GESTÃO FINANCEIRA INSTITUIÇÃO DE PAGAMENTO S.A.</strong> (CNPJ 19.540.550/0001-21), instituição de pagamento autorizada pelo Banco Central do Brasil. A Eletromecânica Baia atua como integradora tecnológica e distribuidora da experiência do produto. O relacionamento financeiro e a responsabilidade regulatória por esses serviços são do Asaas.</p>
            <p>Cada parceiro recebe por uma <strong>conta de pagamento Asaas em seu próprio nome</strong> (subconta), aberta pela plataforma com a sua autorização (Mandato, item 8).</p>
          </Section>

          <hr className="border-zinc-800" />

          <Section icon={<Wallet className="text-purple-400" size={18} />} title="3. Como funciona o pagamento de um pedido">
            <ol className="list-decimal pl-5 space-y-2">
              <li><strong>O cliente paga a loja.</strong> Nos pedidos de loja (B2C) e de fornecedor (B2B), o cliente paga por Pix diretamente ao vendedor: a cobrança é emitida na conta Asaas dele, e no banco o recebedor aparece com o nome do vendedor.</li>
              <li><strong>Comissão da plataforma.</strong> No mesmo Pix, o Asaas separa automaticamente (split) a comissão do AçaíFood: um percentual sobre a venda e um percentual sobre o frete, definidos por cidade e mostrados aos parceiros. O restante (venda + frete) fica na conta do vendedor.</li>
              <li><strong>Tarifa Pix do Asaas.</strong> É descontada pelo Asaas no recebimento. A plataforma pode dividi-la entre vendedor, entregador e plataforma, conforme a configuração da cidade, sempre pelo valor de custo.</li>
              <li><strong>Frete e entrega.</strong> O vendedor inclui a entrega na venda e pode pagar de 0% a 100% do frete no lugar do cliente. Com o pedido pronto, o vendedor chama uma corrida pelo app, e qualquer entregador autônomo cadastrado e com conta Asaas aprovada pode aceitar. Cada corrida é um serviço do entregador ao vendedor, intermediado pela plataforma.</li>
              <li><strong>PIN e pagamento da corrida.</strong> A entrega só termina quando o entregador digita o PIN de 4 dígitos do destinatário. Logo depois, o app transfere automaticamente o valor da corrida da conta do vendedor para a conta do entregador.</li>
              <li><strong>Valores reservados.</strong> Enquanto um pedido pago não é entregue, o valor recebido fica reservado na conta do vendedor (para eventual estorno). As corridas ainda não pagas também ficam reservadas. O vendedor só saca o saldo livre.</li>
              <li><strong>Pedido mínimo.</strong> O app não aceita pedidos em que o valor do vendedor não cubra a corrida e as taxas.</li>
              <li><strong>Coleta de resíduos.</strong> Na coleta, a loja paga o frete à plataforma, que paga o transportador depois do PIN no destino.</li>
            </ol>
          </Section>

          <hr className="border-zinc-800" />

          <Section icon={<RotateCcw className="text-purple-400" size={18} />} title="4. Cancelamento e estorno">
            <ul className="list-disc pl-5 space-y-1">
              <li>Pix não pago em 60 minutos: a cobrança e o pedido são cancelados.</li>
              <li>Cliente: pode cancelar até a loja iniciar o preparo. Loja: até o pedido estar pronto, antes da retirada. Em rota ou entregue: só o suporte.</li>
              <li>O estorno é feito pelo Asaas para a conta de origem do Pix. No estorno total, a comissão da plataforma é devolvida junto. Pix pago depois do cancelamento é estornado automaticamente.</li>
              <li>Corrida interrompida (entregador retirou, mas não conseguiu entregar): o suporte analisa e decide o valor devido ao entregador.</li>
            </ul>
          </Section>

          <hr className="border-zinc-800" />

          <Section icon={<Banknote className="text-purple-400" size={18} />} title="5. Saques">
            <ul className="list-disc pl-5 space-y-1">
              <li>Cada parceiro saca da própria conta Asaas para uma chave Pix do <strong>mesmo CPF/CNPJ</strong> cadastrado. No momento, só chave CPF ou CNPJ do próprio titular.</li>
              <li>Há valor mínimo de saque e um saque em andamento por vez. A tarifa Pix do Asaas é descontada do valor enviado.</li>
              <li>O saque é aprovado pelo administrador (ou automaticamente, se ativado) e só é dado como pago quando o Asaas confirma.</li>
            </ul>
          </Section>

          <hr className="border-zinc-800" />

          <Section icon={<Bike className="text-purple-400" size={18} />} title="6. Responsabilidades">
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Lojas, batedeiras e fornecedores:</strong> qualidade, higiene e normas sanitárias dos produtos; documentos fiscais da venda e do frete; dados verdadeiros no cadastro.</li>
              <li><strong>Entregadores e caminhoneiros:</strong> autônomos, sem vínculo empregatício com o AçaíFood ou com as lojas; responsáveis pelo veículo, pela CNH e pelas leis de trânsito.</li>
              <li><strong>Clientes:</strong> informar o PIN de entrega somente depois de receber o pedido.</li>
              <li><strong>AçaíFood:</strong> manter a plataforma, calcular valores, cobrar a comissão e emitir os documentos fiscais da sua comissão.</li>
            </ul>
            <p>Suporte pelo app. Reclamações sobre serviços financeiros são encaminhadas ao Asaas. Dados pessoais: ver a <Link href="/politica-de-privacidade" className="underline text-purple-300">Política de Privacidade</Link>. Quando estes termos mudam, o app pede novo aceite. Foro e legislação: leis brasileiras, Marco Civil da Internet e Código de Defesa do Consumidor.</p>
          </Section>

          <hr className="border-zinc-800" />

          <Section icon={<KeyRound className="text-purple-400" size={18} />} title="7. Consentimento para chave Pix aleatória (parceiros)">
            <p>O parceiro autoriza a criação de uma chave Pix aleatória (EVP) na sua conta Asaas, usada para receber os Pix dos clientes nos pedidos em que ele é o vendedor e as transferências automáticas da plataforma (por exemplo, o pagamento das corridas). A chave pode ser excluída a pedido, pelo suporte do AçaíFood ou do Asaas.</p>
          </Section>

          <hr className="border-zinc-800" />

          <Section icon={<ShieldCheck className="text-purple-400" size={18} />} title="8. Mandato de abertura e movimentação da subconta Asaas (parceiros)">
            <p>O parceiro (Outorgante) nomeia a <strong>Eletromecânica Baia Ltda (CNPJ 42.035.623/0001-40)</strong> sua procuradora perante o Asaas, <strong>exclusivamente para as operações do AçaíFood</strong>, com poderes para:</p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>abrir a subconta em nome do Outorgante e enviar os dados e documentos cadastrais (KYC);</li>
              <li>configurar a subconta para receber (chave Pix aleatória e notificações automáticas);</li>
              <li>emitir cobranças Pix em nome do Outorgante (loja, fornecedor ou ponto de coleta) para os pedidos do app, com split automático da comissão da plataforma;</li>
              <li>depois do PIN de entrega, transferir automaticamente da subconta do Outorgante (loja ou fornecedor) para a subconta do entregador que concluiu a entrega o valor da corrida calculado pelo app;</li>
              <li>manter reservados no saldo do Outorgante os valores de pedidos pagos não entregues e de corridas a pagar;</li>
              <li>estornar ao cliente cobranças de pedidos cancelados, conforme estes Termos;</li>
              <li>consultar saldos, extratos e movimentações ligados à plataforma;</li>
              <li>executar os saques solicitados pelo Outorgante (ou automáticos, se ativados) somente para chave Pix ou conta do mesmo CPF/CNPJ.</li>
            </ol>
            <p>A Eletromecânica Baia não pode transferir valores do Outorgante para terceiros fora dessas hipóteses, nem se apropriar de valores. A subconta é do Outorgante. O mandato termina com o encerramento do cadastro e da subconta.</p>
          </Section>
        </div>

        <div className="text-center text-xs text-zinc-300 pb-8 space-y-3 font-medium">
          <p>© 2026 AçaíFood • AppSolutions76 • Eletromecânica Baia Ltda.</p>
          <AsaasPartnerBadge variant="footer" />
        </div>
      </div>
    </div>
  );
}
