import { ErroNegocio } from "./ErroNegocio";
import { Datas } from "./Datas";

// Validação de entradas. Toda informação que vem da tela passa por aqui
// ANTES de ir ao banco (nunca confiamos no que o renderer manda).
export class Validador {
  // Deixa só os números de um texto: "123.456-78" -> "12345678".
  static somenteDigitos(texto: unknown): string {
    return String(texto ?? "").replace(/\D/g, "");
  }

  // Valida um texto: tira espaços das pontas, confere obrigatório e tamanho máximo.
  // Devolve null quando o campo é opcional e está vazio.
  static texto(valor: unknown, nomeCampo: string, maximo: number, obrigatorio = true): string | null {
    const texto = String(valor ?? "").trim();
    if (!texto) {
      if (obrigatorio) throw new ErroNegocio(`O campo "${nomeCampo}" é obrigatório.`);
      return null;
    }
    if (texto.length > maximo) {
      throw new ErroNegocio(`O campo "${nomeCampo}" aceita no máximo ${maximo} caracteres.`);
    }
    return texto;
  }

  // Valida um número inteiro positivo (usado para ids).
  static inteiro(valor: unknown, nomeCampo: string): number {
    const numero = Number(valor);
    if (!Number.isInteger(numero) || numero <= 0) {
      throw new ErroNegocio(`Valor inválido para "${nomeCampo}".`);
    }
    return numero;
  }

  // Número inteiro opcional dentro de um intervalo (ex.: ano de publicação).
  static inteiroOpcional(valor: unknown, nomeCampo: string, minimo: number, maximo: number): number | null {
    if (valor === null || valor === undefined || String(valor).trim() === "") return null;
    const numero = Number(valor);
    if (!Number.isInteger(numero) || numero < minimo || numero > maximo) {
      throw new ErroNegocio(`"${nomeCampo}" deve estar entre ${minimo} e ${maximo}.`);
    }
    return numero;
  }

  // Valida uma data "aaaa-mm-dd".
  static data(valor: unknown, nomeCampo: string): string {
    if (!Datas.ehValida(valor)) throw new ErroNegocio(`Data inválida em "${nomeCampo}".`);
    return valor;
  }

  // Confere o formato do e-mail (simples, mas suficiente para evitar erros de digitação).
  static email(valor: unknown): string {
    const email = String(valor ?? "").trim().toLowerCase();
    if (email.length > 150 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      throw new ErroNegocio("E-mail inválido.");
    }
    return email;
  }

  // Telefone com DDD (10 ou 11 dígitos). Opcional.
  static telefone(valor: unknown): string | null {
    const digitos = Validador.somenteDigitos(valor);
    if (!digitos) return null;
    if (digitos.length < 10 || digitos.length > 11) {
      throw new ErroNegocio("Telefone inválido. Informe o DDD + número.");
    }
    return digitos;
  }

  // CEP: exatamente 8 dígitos.
  static cep(valor: unknown): string {
    const cep = Validador.somenteDigitos(valor);
    if (cep.length !== 8) throw new ErroNegocio("CEP inválido. Informe 8 dígitos.");
    return cep;
  }

  // CPF: confere os 11 dígitos e os dois dígitos verificadores.
  static cpf(valor: unknown): string {
    const cpf = Validador.somenteDigitos(valor);
    if (!Validador.cpfValido(cpf)) throw new ErroNegocio("CPF inválido.");
    return cpf;
  }

  // Faz a conta oficial do CPF (módulo 11).
  static cpfValido(cpf: string): boolean {
    if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
    const calcular = (quantidade: number): number => {
      let soma = 0;
      for (let i = 0; i < quantidade; i++) soma += Number(cpf[i]) * (quantidade + 1 - i);
      const resto = (soma * 10) % 11;
      return resto === 10 ? 0 : resto;
    };
    return calcular(9) === Number(cpf[9]) && calcular(10) === Number(cpf[10]);
  }

  // Tira hífens e espaços do ISBN: "978-85-333-0227-3" -> "9788533302273".
  static normalizarIsbn(valor: unknown): string {
    return String(valor ?? "").replace(/[\s-]/g, "").toUpperCase();
  }

  // ISBN válido = ISBN-10 ou ISBN-13 com dígito verificador correto.
  static isbnValido(isbn: string): boolean {
    if (/^\d{13}$/.test(isbn)) {
      let soma = 0;
      for (let i = 0; i < 12; i++) soma += Number(isbn[i]) * (i % 2 === 0 ? 1 : 3);
      return (10 - (soma % 10)) % 10 === Number(isbn[12]);
    }
    if (/^\d{9}[\dX]$/.test(isbn)) {
      let soma = 0;
      for (let i = 0; i < 9; i++) soma += Number(isbn[i]) * (10 - i);
      const ultimo = isbn[9] === "X" ? 10 : Number(isbn[9]);
      return (soma + ultimo) % 11 === 0;
    }
    return false;
  }

  // Valida o ISBN vindo da tela (opcional: devolve null se vazio).
  static isbn(valor: unknown, obrigatorio = false): string | null {
    const isbn = Validador.normalizarIsbn(valor);
    if (!isbn) {
      if (obrigatorio) throw new ErroNegocio("Informe o ISBN.");
      return null;
    }
    if (!Validador.isbnValido(isbn)) throw new ErroNegocio("ISBN inválido (confira os dígitos).");
    return isbn;
  }

  // Regra de senha: mínimo 8 caracteres, com pelo menos uma letra e um número.
  static senha(valor: unknown): string {
    const senha = String(valor ?? "");
    if (senha.length < 8 || senha.length > 100 || !/[A-Za-z]/.test(senha) || !/\d/.test(senha)) {
      throw new ErroNegocio("A senha precisa ter no mínimo 8 caracteres, com letras e números.");
    }
    return senha;
  }

  // Tira acentos e deixa minúsculo, para comparar textos ("São Paulo" == "sao paulo").
  static normalizarTexto(texto: string): string {
    return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  }
}
