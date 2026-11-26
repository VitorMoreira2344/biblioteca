import { Banco, Executor } from "../banco/Banco";
import { Validador } from "../util/Validador";
import { ErroNegocio, ErroApi } from "../util/ErroNegocio";
import { ApiLivros } from "../apis/ApiLivros";

// crud dos livros e a busca pelo isbn
export class ServicoLivro {
  // select que traz o livro com editora autores quem ta com ele e as reservas
  private static readonly SQL_BASE = `
    SELECT l.id, l.titulo, l.isbn, l.editora_id, e.nome AS editora, l.ano_publicacao, l.paginas,
           l.capa_url, l.observacao,
           COALESCE((SELECT GROUP_CONCAT(a.nome ORDER BY a.nome SEPARATOR ', ')
                       FROM livro_autor la JOIN autor a ON a.id = la.autor_id
                      WHERE la.livro_id = l.id), '') AS autores,
           (SELECT u.nome FROM emprestimo em JOIN usuario u ON u.id = em.usuario_id
             WHERE em.livro_id = l.id AND em.data_devolucao IS NULL LIMIT 1) AS emprestado_para,
           (SELECT em.data_prevista FROM emprestimo em
             WHERE em.livro_id = l.id AND em.data_devolucao IS NULL LIMIT 1) AS devolucao_prevista,
           (SELECT COUNT(*) FROM reserva r
             WHERE r.livro_id = l.id AND r.status IN ('aguardando','disponivel')) AS reservas_ativas,
           (SELECT COUNT(*) FROM reserva r
             WHERE r.livro_id = l.id AND r.status = 'disponivel') AS aguardando_retirada
      FROM livro l
      LEFT JOIN editora e ON e.id = l.editora_id`;

  // descobre se o livro ta disponivel emprestado ou reservado
  private static montar(linha: any): Livro {
    const { aguardando_retirada, ...resto } = linha;
    let status: StatusLivro = "disponivel";
    if (linha.emprestado_para) status = "emprestado";
    else if (Number(aguardando_retirada) > 0) status = "reservado";
    return { ...resto, reservas_ativas: Number(linha.reservas_ativas), status };
  }

  // lista todos os livros por titulo
  static async listar(): Promise<Livro[]> {
    const linhas = await Banco.consultar(`${ServicoLivro.SQL_BASE} ORDER BY l.titulo`);
    return linhas.map(ServicoLivro.montar);
  }

  // pega um livro pelo id
  static async obter(idBruto: unknown): Promise<Livro> {
    const id = Validador.inteiro(idBruto, "Livro");
    const linhas = await Banco.consultar(`${ServicoLivro.SQL_BASE} WHERE l.id = ?`, [id]);
    if (!linhas.length) throw new ErroNegocio("Livro não encontrado.");
    return ServicoLivro.montar(linhas[0]);
  }

  // capa so pode ser link https
  private static validarCapa(valor: unknown): string | null {
    const capa = Validador.texto(valor, "Capa", 500, false);
    if (capa && !/^https:\/\//i.test(capa)) throw new ErroNegocio("O endereço da capa deve começar com https://");
    return capa;
  }

  // quebra o texto dos autores em nomes e tira os repetidos
  private static separarAutores(texto: unknown): string[] {
    const nomes = String(texto ?? "")
      .split(/[,;\n]/)
      .map((n) => n.trim())
      .filter((n) => n.length > 0);
    const vistos = new Set<string>();
    const lista: string[] = [];
    for (const nome of nomes) {
      if (nome.length > 120) throw new ErroNegocio("Nome de autor muito longo (máximo 120 caracteres).");
      const chave = Validador.normalizarTexto(nome);
      if (!vistos.has(chave)) {
        vistos.add(chave);
        lista.push(nome);
      }
    }
    return lista;
  }

  // confere todos os campos do livro
  private static validar(dados: any) {
    return {
      titulo: Validador.texto(dados?.titulo, "Título", 200)!,
      isbn: Validador.isbn(dados?.isbn),
      editora: Validador.texto(dados?.editora, "Editora", 120, false),
      autores: ServicoLivro.separarAutores(dados?.autores),
      ano: Validador.inteiroOpcional(dados?.ano_publicacao, "Ano de publicação", 1000, new Date().getFullYear()),
      paginas: Validador.inteiroOpcional(dados?.paginas, "Páginas", 1, 20000),
      capa: ServicoLivro.validarCapa(dados?.capa_url),
      observacao: Validador.texto(dados?.observacao, "Observação", 255, false),
    };
  }

  // acha a editora pelo nome e se nao existir cria
  private static async acharOuCriarEditora(c: Executor, nome: string | null): Promise<number | null> {
    if (!nome) return null;
    const achadas = await c.consultar<{ id: number }>("SELECT id FROM editora WHERE nome = ?", [nome]);
    if (achadas.length) return achadas[0].id;
    const resultado = await c.executar("INSERT INTO editora (nome) VALUES (?)", [nome]);
    return resultado.insertId;
  }

  // apaga os autores do livro e grava de novo criando autor novo se precisar
  private static async gravarAutores(c: Executor, livroId: number, autores: string[]): Promise<void> {
    await c.executar("DELETE FROM livro_autor WHERE livro_id = ?", [livroId]);
    for (const nome of autores) {
      const achados = await c.consultar<{ id: number }>("SELECT id FROM autor WHERE nome = ?", [nome]);
      let autorId: number;
      if (achados.length) {
        autorId = achados[0].id;
      } else {
        autorId = (await c.executar("INSERT INTO autor (nome) VALUES (?)", [nome])).insertId;
      }
      await c.executar("INSERT IGNORE INTO livro_autor (livro_id, autor_id) VALUES (?, ?)", [livroId, autorId]);
    }
  }

  // cadastra um livro novo com editora e autores numa transacao
  static async criar(dados: any): Promise<{ id: number }> {
    const livro = ServicoLivro.validar(dados);
    return Banco.transacao(async (c) => {
      const editoraId = await ServicoLivro.acharOuCriarEditora(c, livro.editora);
      const resultado = await c.executar(
        `INSERT INTO livro (titulo, isbn, editora_id, ano_publicacao, paginas, capa_url, observacao)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [livro.titulo, livro.isbn, editoraId, livro.ano, livro.paginas, livro.capa, livro.observacao],
      );
      await ServicoLivro.gravarAutores(c, resultado.insertId, livro.autores);
      return { id: resultado.insertId };
    });
  }

  // edita o livro e regrava os autores
  static async atualizar(dados: any): Promise<void> {
    const id = Validador.inteiro(dados?.id, "Livro");
    const livro = ServicoLivro.validar(dados);
    await Banco.transacao(async (c) => {
      const editoraId = await ServicoLivro.acharOuCriarEditora(c, livro.editora);
      const resultado = await c.executar(
        `UPDATE livro SET titulo = ?, isbn = ?, editora_id = ?, ano_publicacao = ?, paginas = ?,
                capa_url = ?, observacao = ? WHERE id = ?`,
        [livro.titulo, livro.isbn, editoraId, livro.ano, livro.paginas, livro.capa, livro.observacao, id],
      );
      if (resultado.affectedRows === 0) throw new ErroNegocio("Livro não encontrado.");
      await ServicoLivro.gravarAutores(c, id, livro.autores);
    });
  }

  // apaga o livro so se ele nunca foi emprestado nem reservado
  static async excluir(idBruto: unknown): Promise<void> {
    const id = Validador.inteiro(idBruto, "Livro");
    const historico = await Banco.consultar<{ total: number }>(
      `SELECT (SELECT COUNT(*) FROM emprestimo WHERE livro_id = ?) +
              (SELECT COUNT(*) FROM reserva WHERE livro_id = ?) AS total`,
      [id, id],
    );
    if (Number(historico[0].total) > 0) {
      throw new ErroNegocio("Este livro tem empréstimos ou reservas registrados e não pode ser excluído.");
    }
    await Banco.executar("DELETE FROM livro WHERE id = ?", [id]);
  }

  // busca o isbn nas apis e conta quantas copias desse livro ja tem no acervo
  static async buscarPorIsbn(dados: any): Promise<DadosLivroIsbn & { copias_no_acervo: number }> {
    const isbn = Validador.isbn(dados?.isbn, true)!;
    let encontrado: DadosLivroIsbn | null;
    // se a api cair pede pra preencher na mao
    try {
      encontrado = await ApiLivros.buscarPorIsbn(isbn);
    } catch (erro) {
      if (erro instanceof ErroApi) throw new ErroNegocio(`${erro.message} Preencha os dados manualmente.`);
      throw erro;
    }
    if (!encontrado) throw new ErroNegocio("ISBN não encontrado nas bases consultadas. Preencha os dados manualmente.");

    const copias = await Banco.consultar<{ total: number }>("SELECT COUNT(*) AS total FROM livro WHERE isbn = ?", [isbn]);
    return { ...encontrado, copias_no_acervo: Number(copias[0].total) };
  }
}
