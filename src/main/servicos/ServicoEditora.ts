import { Banco } from "../banco/Banco";
import { Validador } from "../util/Validador";
import { ErroNegocio } from "../util/ErroNegocio";

// CRUD de EDITORAS.
export class ServicoEditora {
  // READ: lista todas as editoras em ordem alfabética.
  static async listar(): Promise<Editora[]> {
    return Banco.consultar<Editora>("SELECT id, nome, cidade FROM editora ORDER BY nome");
  }

  // Valida os campos que vieram da tela.
  private static validar(dados: any): { nome: string; cidade: string | null } {
    return {
      nome: Validador.texto(dados?.nome, "Nome", 120)!,
      cidade: Validador.texto(dados?.cidade, "Cidade", 80, false),
    };
  }

  // Impede duas editoras com o mesmo nome.
  private static async garantirNomeUnico(nome: string, idIgnorado: number): Promise<void> {
    const repetidas = await Banco.consultar("SELECT id FROM editora WHERE nome = ? AND id <> ?", [nome, idIgnorado]);
    if (repetidas.length) throw new ErroNegocio("Já existe uma editora com esse nome.");
  }

  // CREATE: cadastra uma editora.
  static async criar(dados: any): Promise<{ id: number }> {
    const editora = ServicoEditora.validar(dados);
    await ServicoEditora.garantirNomeUnico(editora.nome, 0);
    const resultado = await Banco.executar("INSERT INTO editora (nome, cidade) VALUES (?, ?)", [
      editora.nome,
      editora.cidade,
    ]);
    return { id: resultado.insertId };
  }

  // UPDATE: altera uma editora.
  static async atualizar(dados: any): Promise<void> {
    const id = Validador.inteiro(dados?.id, "Editora");
    const editora = ServicoEditora.validar(dados);
    await ServicoEditora.garantirNomeUnico(editora.nome, id);
    await Banco.executar("UPDATE editora SET nome = ?, cidade = ? WHERE id = ?", [editora.nome, editora.cidade, id]);
  }

  // DELETE: exclui uma editora, se nenhum livro usar ela.
  static async excluir(idBruto: unknown): Promise<void> {
    const id = Validador.inteiro(idBruto, "Editora");
    const usos = await Banco.consultar<{ total: number }>("SELECT COUNT(*) AS total FROM livro WHERE editora_id = ?", [id]);
    if (Number(usos[0].total) > 0) {
      throw new ErroNegocio("Esta editora está ligada a livros e não pode ser excluída.");
    }
    await Banco.executar("DELETE FROM editora WHERE id = ?", [id]);
  }
}
