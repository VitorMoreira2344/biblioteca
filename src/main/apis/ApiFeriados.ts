// peguei da brasilapi que e um projeto aberto feito pela comunidade de graca e sem chave
import { ClienteHttp } from "./ClienteHttp";
import { Datas } from "../util/Datas";

// formato do feriado que a brasilapi devolve
interface Feriado {
  date: string;
  name: string;
}

// busca feriados na brasilapi pro prazo nao cair em feriado
export class ApiFeriados {
  // guarda os feriados de cada ano pra nao ficar pedindo de novo
  private static cache = new Map<number, Feriado[]>();

  // devolve os feriados do ano e se a api cair devolve lista vazia
  static async doAno(ano: number): Promise<Feriado[]> {
    const guardado = ApiFeriados.cache.get(ano);
    if (guardado) return guardado;
    try {
      const lista = await ClienteHttp.obterJson<Feriado[]>(`https://brasilapi.com.br/api/feriados/v1/${ano}`);
      ApiFeriados.cache.set(ano, lista);
      return lista;
    } catch {
      return [];
    }
  }

  // se a data cair em feriado empurra pro proximo dia livre e conta o motivo
  static async proximoDiaLivre(dataIso: string): Promise<{ data: string; ajustada: boolean; motivo: string | null }> {
    let data = dataIso;
    const motivos: string[] = [];
    // tenta no maximo 7 dias pra frente
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
