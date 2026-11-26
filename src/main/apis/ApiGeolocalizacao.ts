// peguei do nominatim que e a busca de endereco do openstreetmap de graca e sem chave
// mas eles pedem no maximo 1 chamada por segundo e um user-agent dizendo quem ta usando
import { ClienteHttp } from "./ClienteHttp";
import { Configuracao } from "../config/Configuracao";
import { ApiCep, EnderecoCep } from "./ApiCep";

// latitude e longitude
export interface Coordenadas {
  lat: number;
  lon: number;
}

// usa o nominatim pra achar onde fica um endereco no mapa
export class ApiGeolocalizacao {
  // guarda o que ja buscou e a hora da ultima chamada
  private static cache = new Map<string, Coordenadas | null>();
  private static ultimaChamada = 0;
  private static biblioteca: { endereco: EnderecoCep; coordenadas: Coordenadas | null } | null | undefined;

  // tenta achar pela rua e se nao der tenta pelo bairro
  static async coordenadas(logradouro: string, bairro: string, cidade: string, uf: string): Promise<Coordenadas | null> {
    const tentativas = [
      [logradouro, cidade, uf],
      [bairro, cidade, uf],
    ].filter((partes) => partes[0]);

    for (const partes of tentativas) {
      const consulta = [...partes, "Brasil"].join(", ");
      if (ApiGeolocalizacao.cache.has(consulta)) {
        const guardado = ApiGeolocalizacao.cache.get(consulta)!;
        if (guardado) return guardado;
        continue;
      }
      const achado = await ApiGeolocalizacao.buscar(consulta);
      ApiGeolocalizacao.cache.set(consulta, achado);
      if (achado) return achado;
    }
    return null;
  }

  // espera 1 segundo entre chamadas porque o nominatim pede isso
  private static async buscar(consulta: string): Promise<Coordenadas | null> {
    const espera = 1100 - (Date.now() - ApiGeolocalizacao.ultimaChamada);
    if (espera > 0) await new Promise((r) => setTimeout(r, espera));
    ApiGeolocalizacao.ultimaChamada = Date.now();

    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(consulta)}`;
    const lista = await ClienteHttp.obterJson<any[]>(url, {
      "User-Agent": "BibliotecaComunitaria/1.0 (projeto academico DAD)",
    });
    if (!lista.length) return null;
    return { lat: Number(lista[0].lat), lon: Number(lista[0].lon) };
  }

  // acha onde fica a biblioteca usando o cep do env e guarda pra nao buscar de novo
  static async localDaBiblioteca(): Promise<{ endereco: EnderecoCep; coordenadas: Coordenadas | null } | null> {
    if (ApiGeolocalizacao.biblioteca !== undefined) return ApiGeolocalizacao.biblioteca;
    const cep = Configuracao.cepBiblioteca;
    if (!cep) return (ApiGeolocalizacao.biblioteca = null);
    try {
      const endereco = await ApiCep.consultar(cep);
      if (!endereco) return (ApiGeolocalizacao.biblioteca = null);
      const coordenadas = await ApiGeolocalizacao.coordenadas(
        endereco.logradouro,
        endereco.bairro,
        endereco.cidade,
        endereco.uf,
      );
      return (ApiGeolocalizacao.biblioteca = { endereco, coordenadas });
    } catch {
      return null;
    }
  }

  // calcula a distancia em km entre dois pontos com a formula de haversine
  static distanciaKm(a: Coordenadas, b: Coordenadas): number {
    const raioTerra = 6371;
    const paraRadianos = (graus: number) => (graus * Math.PI) / 180;
    const dLat = paraRadianos(b.lat - a.lat);
    const dLon = paraRadianos(b.lon - a.lon);
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(paraRadianos(a.lat)) * Math.cos(paraRadianos(b.lat)) * Math.sin(dLon / 2) ** 2;
    return 2 * raioTerra * Math.asin(Math.sqrt(h));
  }
}
