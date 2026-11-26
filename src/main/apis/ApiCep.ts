// peguei do viacep que e a api de cep mais usada no brasil de graca e sem chave
import { ClienteHttp } from "./ClienteHttp";

// o endereco que a gente pega do cep
export interface EnderecoCep {
  logradouro: string;
  bairro: string;
  cidade: string;
  uf: string;
}

// conversa com o viacep
export class ApiCep {
  // busca o endereco do cep e devolve null se o cep nao existe
  static async consultar(cep: string): Promise<EnderecoCep | null> {
    const json = await ClienteHttp.obterJson<any>(`https://viacep.com.br/ws/${cep}/json/`);
    if (json.erro) return null;
    // pega so os campos que interessam
    return {
      logradouro: String(json.logradouro ?? ""),
      bairro: String(json.bairro ?? ""),
      cidade: String(json.localidade ?? ""),
      uf: String(json.uf ?? ""),
    };
  }
}
