// jeito da tela falar com o processo principal
class Servidor {
  // chama uma rota e se deu erro joga o erro pra tela mostrar
  static async chamar<T = any>(canal: string, dados?: unknown): Promise<T> {
    const resposta = await window.api.chamar<T>(canal, dados);
    if (!resposta.ok) throw new Error(resposta.erro || "Erro desconhecido.");
    return resposta.dados as T;
  }
}
