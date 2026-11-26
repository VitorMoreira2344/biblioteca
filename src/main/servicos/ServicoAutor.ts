import { Banco } from "../banco/Banco";
import { Validador } from "../util/Validador";
import { ErroNegocio } from "../util/ErroNegocio";

// crud dos autores
export class ServicoAutor {
  // lista todos os autores em ordem de nome
  static async listar(): Promise<Autor[]> {
    return Banco.consultar<Autor>("SELECT id, nome, nacionalidade FROM autor ORDER BY nome");
  }

  // confere o nome e a nacionalidade que vieram da tela
  private static validar(dados: any): { nome: string; nacionalidade: string | null } {
    return {
      nome: Validador.texto(dados?.nome, "Nome", 120)!,
      nacionalidade: Validador.texto(dados?.nacionalidade, "Nacionalidade", 60, false),
    };
  }

  // nao deixa ter dois autores com o mesmo nome
  private static async garantirNomeUnico(nome: string, idIgnorado: number): Promise<void> {
    const repetidos = await Banco.consultar("SELECT id FROM autor WHERE nome = ? AND id <> ?", [nome, idIgnorado]);
    if (repetidos.length) throw new ErroNegocio("Já existe um autor com esse nome.");
  }

  // cria um autor novo
  static async criar(dados: any): Promise<{ id: number }> {
    const autor = ServicoAutor.validar(dados);
    await ServicoAutor.garantirNomeUnico(autor.nome, 0);
    const resultado = await Banco.executar("INSERT INTO autor (nome, nacionalidade) VALUES (?, ?)", [
      autor.nome,
      autor.nacionalidade,
    ]);
    return { id: resultado.insertId };
  }

  // edita um autor que ja existe
  static async atualizar(dados: any): Promise<void> {
    const id = Validador.inteiro(dados?.id, "Autor");
    const autor = ServicoAutor.validar(dados);
    await ServicoAutor.garantirNomeUnico(autor.nome, id);
    await Banco.executar("UPDATE autor SET nome = ?, nacionalidade = ? WHERE id = ?", [
      autor.nome,
      autor.nacionalidade,
      id,
    ]);
  }

  // apaga o autor mas so se ele nao ta em nenhum livro
  static async excluir(idBruto: unknown): Promise<void> {
    const id = Validador.inteiro(idBruto, "Autor");
    const usos = await Banco.consultar<{ total: number }>("SELECT COUNT(*) AS total FROM livro_autor WHERE autor_id = ?", [id]);
    if (Number(usos[0].total) > 0) {
      throw new ErroNegocio("Este autor está ligado a livros e não pode ser excluído.");
    }
    await Banco.executar("DELETE FROM autor WHERE id = ?", [id]);
  }
}
