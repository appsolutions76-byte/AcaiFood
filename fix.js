const fs = require('fs');
const files = [
  'apps/mobile/src/app/page.tsx',
  'apps/mobile/src/app/parceiros/batedeira/page.tsx',
  'apps/mobile/src/app/parceiros/fornecedor/page.tsx',
  'apps/mobile/src/app/parceiros/motoboy/page.tsx',
  'apps/mobile/src/app/parceiros/caminhao/page.tsx',
  'apps/mobile/src/app/admin/page.tsx'
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');

  // 1. Fix the Active/History split
  content = content.replace(/!== 'entregue' && o\.status !== 'cancelado'/g, "!== 'entregue' && o.status !== 'cancelado' && o.status !== 'arquivado'");
  content = content.replace(/=== 'entregue' \|\| o\.status === 'cancelado'/g, "=== 'entregue' || o.status === 'cancelado' || o.status === 'arquivado'");

  // 2. Fix the badge logic to include arquivado
  content = content.replace(/o\.status === 'entregue' &&/g, "(o.status === 'entregue' || o.status === 'arquivado') &&");
  
  fs.writeFileSync(file, content);
  console.log('Updated', file);
}
