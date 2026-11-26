// Erro "esperado": uma regra do sistema foi violada (ex.: CPF inválido).
// A mensagem pode ser mostrada ao usuário. Qualquer outro erro vira
// "erro interno" (para não vazar detalhes técnicos).
export class ErroNegocio extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ErroNegocio";
  }
}

// Erro de rede ao falar com uma API externa (fora do ar, timeout...).
export class ErroApi extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ErroApi";
  }
}
