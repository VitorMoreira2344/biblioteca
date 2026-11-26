import { ClienteHttp } from "./ClienteHttp";
import { Configuracao } from "../config/Configuracao";
import { ApiCep, EnderecoCep } from "./ApiCep";

export interface Coordenadas {
  lat: number;
  lon: number;
}

// API 4 - LOCALIZAÇÃO (Nominatim / OpenStreetMap).
// Finalidade: descobrir a que distância da biblioteca o leitor mora, para o
// dono saber se a pessoa é mesmo "da região" e se compensa ir buscar o livro.
export class ApiGeolocalizacao {
  private static cache = new Map<string, Coordenadas | null>();
  private static ultimaChamada = 0;
  private static biblioteca: { endereco: EnderecoCep; coordenadas: Coordenadas | null } | null | undefined; // undefined = ainda não calculou

  // Transforma um endereço em latitude/longitude. Devolve null se não achar.
  static async coordenadas(logradouro: string, bairro: string, cidade: string, uf: string): Promise<Coordenadas | null> {
    // Tenta primeiro com a rua; se não achar, tenta só bairro + cidade (aproximado).
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

  // Faz a chamada ao Nominatim (a política deles pede 1 consulta por segundo e um User-Agent).
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

  // Endereço e coordenadas da própria biblioteca (calculados uma vez a partir do BIBLIOTECA_CEP).
  // Devolve null se o CEP não estiver configurado ou não existir.
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
      return null; // não guarda a falha: tenta de novo na próxima vez
    }
  }

  // Distância em km entre dois pontos (fórmula de Haversine).
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
