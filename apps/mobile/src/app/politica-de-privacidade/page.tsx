"use client";

import React from "react";
import Link from "next/link";
import { ShieldCheck, ArrowLeft, Lock, FileText, Smartphone, Users } from "lucide-react";

export default function PoliticaPrivacidadePage() {
  const currentDate = "7 de Agosto de 2026";

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans p-4 sm:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header Navigation */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <Link href="/" className="flex items-center gap-2 text-purple-400 hover:text-purple-300 font-bold text-sm transition">
            <ArrowLeft size={16} /> Voltar para o AçaíFood
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-xl">🥣</span>
            <span className="font-extrabold text-lg text-white">AçaíFood</span>
          </div>
        </div>

        {/* Title Banner */}
        <div className="bg-purple-900/40 border border-purple-800/60 p-6 sm:p-8 rounded-3xl space-y-3">
          <div className="inline-flex items-center gap-2 bg-purple-800/60 text-purple-200 px-3 py-1 rounded-full text-xs font-bold">
            <ShieldCheck size={14} /> Conformidade com LGPD e Google Play Store
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold text-white">Política de Privacidade</h1>
          <p className="text-sm text-purple-200">
            Última atualização: {currentDate} | AçaíFood Tecnologia Ltda.
          </p>
        </div>

        {/* Main Content */}
        <div className="space-y-6 text-sm text-zinc-300 leading-relaxed bg-zinc-900/60 p-6 sm:p-8 rounded-3xl border border-zinc-800">
          
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <FileText className="text-purple-400" size={18} /> 1. Introdução
            </h2>
            <p>
              A presente Política de Privacidade descreve como a plataforma <strong>AçaíFood</strong> (disponível via web e aplicativo móvel) coleta, utiliza, armazena e protege os dados pessoais dos seus usuários (Consumidores, Batedeiras, Fornecedores, Motoboys e Caminhoneiros), em estrita observância à Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018 - LGPD) e às diretrizes de segurança da Google Play Store.
            </p>
          </section>

          <hr className="border-zinc-800" />

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Users className="text-purple-400" size={18} /> 2. Dados Pessoais Coletados
            </h2>
            <p>Para viabilizar as operações da plataforma, coletamos as seguintes categorias de dados:</p>
            <ul className="list-disc pl-5 space-y-1 text-zinc-300">
              <li><strong>Dados de Cadastro:</strong> Nome completo, e-mail, senha criptografada, telefone/WhatsApp, CPF ou CNPJ.</li>
              <li><strong>Dados de Endereço e Geolocalização (GPS):</strong> Endereço completo de entrega e coordenadas GPS (latitude e longitude) enviadas com permissão para cálculo exato do frete e acompanhamento em tempo real no mapa.</li>
              <li><strong>Dados Financeiros e de Pagamento:</strong> Chave Pix e ID de carteira de pagamentos para processamento de cobranças e repasses automatizados (via instituição parceira Asaas IP S.A.).</li>
              <li><strong>Dados do Dispositivo:</strong> Endereço IP, dados de conexão, navegador e tipo de sistema operacional.</li>
            </ul>
          </section>

          <hr className="border-zinc-800" />

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Smartphone className="text-purple-400" size={18} /> 3. Finalidade do Uso dos Dados
            </h2>
            <p>Os dados coletados são utilizados estritamente para os seguintes propósitos:</p>
            <ol className="list-decimal pl-5 space-y-1 text-zinc-300">
              <li>Processar e gerenciar pedidos de açaí (B2C), insumos (B2B) e coleta de resíduos.</li>
              <li>Calcular a distância exata e o frete de entrega entre o estabelecimento e o consumidor.</li>
              <li>Transmitir a localização do entregador no mapa durante corridas ativas.</li>
              <li>Emitir cobranças Pix registradas e efetuar o split automático de receitas.</li>
              <li>Validar a entrega mediante PIN de segurança de 4 dígitos.</li>
              <li>Cumprir obrigações legais e regulatórias vigentes no Brasil.</li>
            </ol>
          </section>

          <hr className="border-zinc-800" />

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Lock className="text-purple-400" size={18} /> 4. Compartilhamento Seguro de Dados
            </h2>
            <p>
              O AçaíFood não vende e não comercializa dados pessoais. O compartilhamento de informações ocorre estritamente quando necessário para a execução do serviço:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-zinc-300">
              <li><strong>Com os Parceiros da Transação:</strong> Nome do cliente, telefone e endereço são exibidos para a loja e o entregador responsável pelo pedido.</li>
              <li><strong>Com Gateway de Pagamentos (Asaas):</strong> CPF/CNPJ, nome e dados da cobrança para liquidação bancária via Pix.</li>
              <li><strong>Autoridades Judiciais:</strong> Mediante ordem judicial ou obrigação legal.</li>
            </ul>
          </section>

          <hr className="border-zinc-800" />

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <ShieldCheck className="text-purple-400" size={18} /> 5. Direitos do Titular dos Dados (LGPD)
            </h2>
            <p>Nos termos do Artigo 18 da LGPD, os usuários têm o direito de:</p>
            <ul className="list-disc pl-5 space-y-1 text-zinc-300">
              <li>Confirmar a existência de tratamento e acessar seus dados pessoais.</li>
              <li>Corrigir dados incompletos, inexatos ou desatualizados.</li>
              <li>Solicitar a exclusão definitiva da sua conta e dados pessoais armazenados.</li>
              <li>Revogar o consentimento a qualquer momento.</li>
            </ul>
            <p className="mt-2 text-zinc-400">
              Para exercer seus direitos ou solicitar a exclusão de conta, entre em contato pelo e-mail: <strong className="text-purple-300">suporte@acaifood.com.br</strong>.
            </p>
          </section>

        </div>

        {/* Footer */}
        <div className="text-center text-xs text-zinc-500 pb-8">
          © 2026 AçaíFood Tecnologia Ltda. Todos os direitos reservados.
        </div>

      </div>
    </div>
  );
}
