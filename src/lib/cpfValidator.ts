/**
 * Valida se um CPF é válido usando o algoritmo oficial
 * @param cpf - CPF com ou sem formatação
 * @returns true se o CPF for válido, false caso contrário
 */
export function validateCPF(cpf: string): boolean {
  // Remove caracteres não numéricos
  const cleanCPF = cpf.replace(/\D/g, "");

  // Verifica se tem 11 dígitos
  if (cleanCPF.length !== 11) {
    return false;
  }

  // Verifica se todos os dígitos são iguais (caso inválido comum)
  if (/^(\d)\1{10}$/.test(cleanCPF)) {
    return false;
  }

  // Validação do primeiro dígito verificador
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleanCPF.charAt(i)) * (10 - i);
  }
  let digit = 11 - (sum % 11);
  if (digit >= 10) digit = 0;
  if (digit !== parseInt(cleanCPF.charAt(9))) {
    return false;
  }

  // Validação do segundo dígito verificador
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleanCPF.charAt(i)) * (11 - i);
  }
  digit = 11 - (sum % 11);
  if (digit >= 10) digit = 0;
  if (digit !== parseInt(cleanCPF.charAt(10))) {
    return false;
  }

  return true;
}

/**
 * Valida se um número de telefone brasileiro é válido
 * @param phone - Telefone com ou sem formatação
 * @returns true se o telefone for válido, false caso contrário
 */
export function validatePhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, "");

  // Aceita 10 (fixo) ou 11 (celular) dígitos
  if (digits.length < 10 || digits.length > 11) {
    return false;
  }

  // DDD válido: 11-99
  const ddd = parseInt(digits.slice(0, 2), 10);
  if (ddd < 11 || ddd > 99) {
    return false;
  }

  // Se 11 dígitos, o terceiro dígito (primeiro do número) deve ser 9
  if (digits.length === 11 && digits.charAt(2) !== "9") {
    return false;
  }

  return true;
}

/**
 * Formata um CPF para o padrão XXX.XXX.XXX-XX
 * @param cpf - CPF sem formatação
 * @returns CPF formatado
 */
export function formatCPF(cpf: string): string {
  const cleanCPF = cpf.replace(/\D/g, "");
  if (cleanCPF.length !== 11) return cpf;
  return cleanCPF.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}
