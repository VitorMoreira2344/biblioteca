// Conversa com o processo principal (onde ficam o banco e as regras).
class Servidor {
  // Chama um canal. Se o servidor responder com erro, lança uma exceção com a mensagem.
  static async chamar<T = any>(canal: string, dados?: unknown): Promise<T> {
    const resposta = await window.api.chamar<T>(canal, dados);
    if (!resposta.ok) throw new Error(resposta.erro || "Erro desconhecido.");
    return resposta.dados as T;
  }
}
