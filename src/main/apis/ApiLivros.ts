import { ClienteHttp } from "./ClienteHttp";
import { ErroApi } from "../util/ErroNegocio";

// API 1 e 1b - DADOS DO LIVRO PELO ISBN.
// Finalidade: ao cadastrar um livro, o dono digita só o ISBN e o sistema
// preenche título, autores, editora, ano, páginas e capa.
// Fonte principal: Open Library. Se ela não achar, tenta o Google Books.
export class ApiLivros {
  // Procura o livro. Devolve null se nenhuma fonte conhecer o ISBN.
  // Lança ErroApi se as duas fontes estiverem fora do ar.
  static async buscarPorIsbn(isbn: string): Promise<DadosLivroIsbn | null> {
    let falhas = 0;

    try {
      const livro = await ApiLivros.buscarNaOpenLibrary(isbn);
      if (livro) return livro;
    } catch {
      falhas++;
    }

    try {
      const livro = await ApiLivros.buscarNoGoogleBooks(isbn);
      if (livro) return livro;
    } catch {
      falhas++;
    }

    if (falhas === 2) throw new ErroApi("Os serviços de busca de livros estão indisponíveis agora.");
    return null;
  }

  // Consulta a Open Library (gratuita, sem chave).
  private static async buscarNaOpenLibrary(isbn: string): Promise<DadosLivroIsbn | null> {
    const url = `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`;
    const json = await ClienteHttp.obterJson<Record<string, any>>(url);
    const dados = json[`ISBN:${isbn}`];
    if (!dados || !dados.title) return null;

    return {
      titulo: String(dados.title),
      autores: (dados.authors ?? []).map((a: any) => String(a.name)),
      editora: dados.publishers?.[0]?.name ?? null,
      ano_publicacao: ApiLivros.extrairAno(dados.publish_date),
      paginas: Number.isInteger(dados.number_of_pages) ? dados.number_of_pages : null,
      capa_url: dados.cover?.large ?? dados.cover?.medium ?? dados.cover?.small ?? null,
      fonte: "Open Library",
    };
  }

  // Consulta o Google Books (gratuito para poucas consultas, sem chave).
  private static async buscarNoGoogleBooks(isbn: string): Promise<DadosLivroIsbn | null> {
    const url = `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&maxResults=1`;
    const json = await ClienteHttp.obterJson<any>(url);
    const info = json.items?.[0]?.volumeInfo;
    if (!info || !info.title) return null;

    const capa: string | undefined = info.imageLinks?.thumbnail ?? info.imageLinks?.smallThumbnail;
    return {
      titulo: String(info.title),
      autores: (info.authors ?? []).map((a: any) => String(a)),
      editora: info.publisher ?? null,
      ano_publicacao: ApiLivros.extrairAno(info.publishedDate),
      paginas: Number.isInteger(info.pageCount) && info.pageCount > 0 ? info.pageCount : null,
      capa_url: capa ? capa.replace("http://", "https://") : null,
      fonte: "Google Books",
    };
  }

  // Tira o ano de textos como "June 26, 1997", "1997-06" ou "1997".
  static extrairAno(texto: unknown): number | null {
    const achou = String(texto ?? "").match(/\b(1[5-9]\d{2}|20\d{2})\b/);
    return achou ? Number(achou[1]) : null;
  }
}
