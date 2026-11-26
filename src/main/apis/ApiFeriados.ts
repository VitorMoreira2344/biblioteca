import { ClienteHttp } from "./ClienteHttp";
import { Datas } from "../util/Datas";

interface Feriado {
  date: string;
  name: string;
}

// API 3 - FERIADOS NACIONAIS (BrasilAPI).
// Finalidade: o prazo de devolução não pode cair em feriado (a biblioteca
// não abre). Se cair, o sistema empurra para o próximo dia livre.
export class ApiFeriados {
  private static cache = new Map<number, Feriado[]>(); // evita consultar o mesmo ano várias vezes

  // Lista os feriados de um ano (devolve [] se a API falhar).
  static async doAno(ano: number): Promise<Feriado[]> {
    const guardado = ApiFeriados.cache.get(ano);
    if (guardado) return guardado;
    try {
      const lista = await ClienteHttp.obterJson<Feriado[]>(`https://brasilapi.com.br/api/feriados/v1/${ano}`);
      ApiFeriados.cache.set(ano, lista);
      return lista;
    } catch {
      return []; // sem internet: seguimos sem ajustar (não trava o empréstimo)
    }
  }

  // Recebe uma data e devolve a primeira data que NÃO é feriado.
  static async proximoDiaLivre(dataIso: string): Promise<{ data: string; ajustada: boolean; motivo: string | null }> {
    let data = dataIso;
    const motivos: string[] = [];
    for (let tentativa = 0; tentativa < 7; tentativa++) {
      const feriados = await ApiFeriados.doAno(Number(data.slice(0, 4)));
      const feriado = feriados.find((f) => f.date === data);
      if (!feriado) break;
      motivos.push(`${Datas.paraBR(data)} é feriado (${feriado.name})`);
      data = Datas.somarDias(data, 1);
    }
    return { data, ajustada: data !== dataIso, motivo: motivos.length ? motivos.join("; ") : null };
  }
}
