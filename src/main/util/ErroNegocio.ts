// erro de regra do sistema tipo cpf repetido ou livro ja emprestado e a mensagem pode ir pra tela
export class ErroNegocio extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ErroNegocio";
  }
}

// erro quando alguma api de fora falha ou nao responde
export class ErroApi extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ErroApi";
  }
}
