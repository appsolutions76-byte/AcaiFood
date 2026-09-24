/**
 * Utilitários para validação de documentos e chaves Pix.
 */

export function validateCpfCnpjDigits(val?: string | null): boolean {
  if (!val) return false;
  const str = String(val).replace(/\D/g, '');
  
  if (str.length === 11) {
    if (/^(\d)\1{10}$/.test(str)) return false;
    let sum = 0;
    let rev: number;
    for (let i = 1; i <= 9; i++) sum += parseInt(str.substring(i - 1, i)) * (11 - i);
    rev = (sum * 10) % 11;
    if (rev === 10 || rev === 11) rev = 0;
    if (rev !== parseInt(str.substring(9, 10))) return false;
    sum = 0;
    for (let i = 1; i <= 10; i++) sum += parseInt(str.substring(i - 1, i)) * (12 - i);
    rev = (sum * 10) % 11;
    if (rev === 10 || rev === 11) rev = 0;
    if (rev !== parseInt(str.substring(10, 11))) return false;
    return true;
  }
  
  if (str.length === 14) {
    if (/^(\d)\1{13}$/.test(str)) return false;
    let size = str.length - 2;
    let numbers = str.substring(0, size);
    const digits = str.substring(size);
    let sum = 0;
    let pos = size - 7;
    for (let i = size; i >= 1; i--) {
      sum += parseInt(numbers.charAt(size - i)) * pos--;
      if (pos < 2) pos = 9;
    }
    let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    if (result !== parseInt(digits.charAt(0))) return false;
    size = size + 1;
    numbers = str.substring(0, size);
    sum = 0;
    pos = size - 7;
    for (let i = size; i >= 1; i--) {
      sum += parseInt(numbers.charAt(size - i)) * pos--;
      if (pos < 2) pos = 9;
    }
    result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    if (result !== parseInt(digits.charAt(1))) return false;
    return true;
  }

  return false;
}
