import { ErroApi } from "../util/ErroNegocio";

// Faz as chamadas HTTP para as APIs externas, com tempo limite.
export class ClienteHttp {
  // Busca uma URL e devolve o JSON. Se a internet falhar ou demorar, lança ErroApi.
  static async obterJson<T = any>(url: string, cabecalhos: Record<string, string> = {}): Promise<T> {
    let resposta: Response;
    try {
      resposta = await fetch(url, {
        headers: { Accept: "application/json", ...cabecalhos },
        signal: AbortSignal.timeout(8000), // desiste após 8 segundos
      });
    } catch {
      throw new ErroApi("Não foi possível acessar o serviço externo (sem internet ou demorou demais).");
    }
    if (resposta.status === 404) throw new ErroApi("404");
    if (!resposta.ok) throw new ErroApi(`O serviço externo respondeu com erro ${resposta.status}.`);
    return (await resposta.json()) as T;
  }
}
