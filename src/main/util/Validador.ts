import { ErroNegocio } from "./ErroNegocio";
import { Datas } from "./Datas";

// confere tudo que chega da tela antes de usar porque a tela pode mentir
export class Validador {
  // tira tudo que nao e numero
  static somenteDigitos(texto: unknown): string {
    return String(texto ?? "").replace(/\D/g, "");
  }

  // texto com limite de tamanho e se e obrigatorio ou nao
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

  // numero inteiro maior que zero tipo um id
  static inteiro(valor: unknown, nomeCampo: string): number {
    const numero = Number(valor);
    if (!Number.isInteger(numero) || numero <= 0) {
      throw new ErroNegocio(`Valor inválido para "${nomeCampo}".`);
    }
    return numero;
  }

  // numero que pode ficar vazio mas se vier tem que estar entre o minimo e o maximo
  static inteiroOpcional(valor: unknown, nomeCampo: string, minimo: number, maximo: number): number | null {
    if (valor === null || valor === undefined || String(valor).trim() === "") return null;
    const numero = Number(valor);
    if (!Number.isInteger(numero) || numero < minimo || numero > maximo) {
      throw new ErroNegocio(`"${nomeCampo}" deve estar entre ${minimo} e ${maximo}.`);
    }
    return numero;
  }

  // data valida no formato ano-mes-dia
  static data(valor: unknown, nomeCampo: string): string {
    if (!Datas.ehValida(valor)) throw new ErroNegocio(`Data inválida em "${nomeCampo}".`);
    return valor;
  }

  // email com cara de email e tudo minusculo
  static email(valor: unknown): string {
    const email = String(valor ?? "").trim().toLowerCase();
    if (email.length > 150 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      throw new ErroNegocio("E-mail inválido.");
    }
    return email;
  }

  // telefone com ddd e 10 ou 11 numeros e pode ficar vazio
  static telefone(valor: unknown): string | null {
    const digitos = Validador.somenteDigitos(valor);
    if (!digitos) return null;
    if (digitos.length < 10 || digitos.length > 11) {
      throw new ErroNegocio("Telefone inválido. Informe o DDD + número.");
    }
    return digitos;
  }

  // cep com 8 numeros
  static cep(valor: unknown): string {
    const cep = Validador.somenteDigitos(valor);
    if (cep.length !== 8) throw new ErroNegocio("CEP inválido. Informe 8 dígitos.");
    return cep;
  }

  // cpf que passa na conta dos digitos
  static cpf(valor: unknown): string {
    const cpf = Validador.somenteDigitos(valor);
    if (!Validador.cpfValido(cpf)) throw new ErroNegocio("CPF inválido.");
    return cpf;
  }

  // faz a conta dos dois digitos verificadores do cpf e barra cpf tipo 111
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

  // tira espaco e traco do isbn
  static normalizarIsbn(valor: unknown): string {
    return String(valor ?? "").replace(/[\s-]/g, "").toUpperCase();
  }

  // confere o digito final do isbn de 13 ou de 10
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

  // isbn valido ou vazio se nao for obrigatorio
  static isbn(valor: unknown, obrigatorio = false): string | null {
    const isbn = Validador.normalizarIsbn(valor);
    if (!isbn) {
      if (obrigatorio) throw new ErroNegocio("Informe o ISBN.");
      return null;
    }
    if (!Validador.isbnValido(isbn)) throw new ErroNegocio("ISBN inválido (confira os dígitos).");
    return isbn;
  }

  // senha com 8 ou mais caracteres com letra e numero
  static senha(valor: unknown): string {
    const senha = String(valor ?? "");
    if (senha.length < 8 || senha.length > 100 || !/[A-Za-z]/.test(senha) || !/\d/.test(senha)) {
      throw new ErroNegocio("A senha precisa ter no mínimo 8 caracteres, com letras e números.");
    }
    return senha;
  }

  // tira acento e deixa minusculo pra comparar nomes
  static normalizarTexto(texto: string): string {
    return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  }
}
