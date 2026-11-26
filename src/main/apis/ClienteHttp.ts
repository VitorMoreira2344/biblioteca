// esse aqui nao e api de fora e so o jeito que a gente usa pra chamar todas elas
import { ErroApi } from "../util/ErroNegocio";

// classe que faz os pedidos pras apis de fora
export class ClienteHttp {
  // busca uma url e devolve o json
  static async obterJson<T = any>(url: string, cabecalhos: Record<string, string> = {}): Promise<T> {
    let resposta: Response;
    // tenta acessar a url e desiste se passar de 8 segundos
    try {
      resposta = await fetch(url, {
        headers: { Accept: "application/json", ...cabecalhos },
        signal: AbortSignal.timeout(8000),
      });
    } catch {
      // sem internet ou demorou demais
      throw new ErroApi("Não foi possível acessar o serviço externo (sem internet ou demorou demais).");
    }
    // 404 vira um erro especial pra quem chamou saber que nao achou nada
    if (resposta.status === 404) throw new ErroApi("404");
    if (!resposta.ok) throw new ErroApi(`O serviço externo respondeu com erro ${resposta.status}.`);
    return (await resposta.json()) as T;
  }
}
