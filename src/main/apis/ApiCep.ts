import { ClienteHttp } from "./ClienteHttp";

export interface EnderecoCep {
  logradouro: string;
  bairro: string;
  cidade: string;
  uf: string;
}

// API 2 - ENDEREÇO PELO CEP (ViaCEP).
// Finalidade: ao cadastrar o leitor, digitar o CEP preenche o endereço e
// confirma que o CEP existe de verdade.
export class ApiCep {
  // Devolve o endereço do CEP, ou null se o CEP não existe.
  // Lança ErroApi se o serviço estiver fora do ar.
  static async consultar(cep: string): Promise<EnderecoCep | null> {
    const json = await ClienteHttp.obterJson<any>(`https://viacep.com.br/ws/${cep}/json/`);
    if (json.erro) return null; // o ViaCEP responde {"erro": true} para CEP inexistente
    return {
      logradouro: String(json.logradouro ?? ""),
      bairro: String(json.bairro ?? ""),
      cidade: String(json.localidade ?? ""),
      uf: String(json.uf ?? ""),
    };
  }
}
