import React from 'react';

const ASAAS_SEAL_ID = '55be4694-40a6-46bd-8342-0a8f310e627b';

const SEAL_URLS = {
  'positivo': `https://baas.asaas.com/selos/Servicos_financeiros_Asaas-Reduzida-Positivo.svg?id=${ASAAS_SEAL_ID}`,
  'negativo-preto': `https://baas.asaas.com/selos/Servicos_financeiros_Asaas-Reduzida-Negativo-Preto.svg?id=${ASAAS_SEAL_ID}`,
  'negativo-branco': `https://baas.asaas.com/selos/Servicos_financeiros_Asaas-Reduzida-Negativo-Branco.svg?id=${ASAAS_SEAL_ID}`
};

export interface SeloAsaasProps {
  variant?: 'positivo' | 'negativo-preto' | 'negativo-branco';
  className?: string;
  width?: number;
  height?: number;
}

export function SeloAsaas({
  variant = 'positivo',
  className = '',
  width = 160,
  height = 48
}: SeloAsaasProps) {
  const src = SEAL_URLS[variant] || SEAL_URLS['positivo'];

  return (
    <img
      src={src}
      alt="Serviços financeiros ASAAS"
      width={width}
      height={height}
      style={{ display: 'inline-block' }}
      className={`object-contain max-h-12 ${className}`}
    />
  );
}

export default SeloAsaas;
