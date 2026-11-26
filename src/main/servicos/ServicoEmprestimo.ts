import { Banco } from "../banco/Banco";
import { Validador } from "../util/Validador";
import { ErroNegocio } from "../util/ErroNegocio";
import { Datas } from "../util/Datas";
import { Configuracao } from "../config/Configuracao";
import { ApiFeriados } from "../apis/ApiFeriados";
import { ServicoUsuario } from "./ServicoUsuario";
import { ServicoReserva } from "./ServicoReserva";
import { ServicoNotificacao } from "./ServicoNotificacao";

export type FiltroEmprestimo = "todos" | "ativos" | "atrasados" | "devolvidos";

// EMPRÉSTIMOS: cadastrar, listar, renovar prazo, devolver e excluir.
export class ServicoEmprestimo {
  // Consulta base: empréstimo + título do livro + dados do leitor.
  private static readonly SQL_BASE = `
    SELECT e.id, e.livro_id, e.usuario_id, l.titulo, u.nome AS usuario_nome, u.telefone, u.email,
           u.logradouro, u.numero, u.complemento, u.bairro, u.cidade, u.uf,
           e.data_retirada, e.data_prevista, e.data_devolucao, e.observacao
      FROM emprestimo e
      JOIN livro l ON l.id = e.livro_id
      JOIN usuario u ON u.id = e.usuario_id`;

  // Transforma a linha do banco em Emprestimo e calcula se está ATRASADO.
  private static montar(linha: any): Emprestimo {
    const hoje = Datas.hoje();
    const atrasado = !linha.data_devolucao && linha.data_prevista < hoje;
    return {
      id: linha.id,
      livro_id: linha.livro_id,
      usuario_id: linha.usuario_id,
      titulo: linha.titulo,
      usuario_nome: linha.usuario_nome,
      telefone: linha.telefone,
      email: linha.email,
      endereco: ServicoUsuario.formatarEndereco(linha),
      data_retirada: linha.data_retirada,
      data_prevista: linha.data_prevista,
      data_devolucao: linha.data_devolucao,
      observacao: linha.observacao,
      atrasado,
      dias_atraso: atrasado ? Datas.diasEntre(linha.data_prevista, hoje) : 0,
    };
  }

  // READ: lista empréstimos. Os ativos vêm primeiro, o mais atrasado no topo.
  static async listar(filtroBruto: unknown = "todos"): Promise<Emprestimo[]> {
    const filtro = String(filtroBruto) as FiltroEmprestimo;
    let where = "";
    const parametros: any[] = [];
    if (filtro === "ativos") where = "WHERE e.data_devolucao IS NULL";
    else if (filtro === "devolvidos") where = "WHERE e.data_devolucao IS NOT NULL";
    else if (filtro === "atrasados") {
      where = "WHERE e.data_devolucao IS NULL AND e.data_prevista < ?";
      parametros.push(Datas.hoje());
    }
    const linhas = await Banco.consultar(
      `${ServicoEmprestimo.SQL_BASE} ${where}
        ORDER BY (e.data_devolucao IS NULL) DESC,
                 CASE WHEN e.data_devolucao IS NULL THEN e.data_prevista END ASC,
                 e.data_devolucao DESC, e.id DESC`,
      parametros,
    );
    return linhas.map(ServicoEmprestimo.montar);
  }

  // READ: um empréstimo pelo id.
  static async obter(idBruto: unknown): Promise<Emprestimo> {
    const id = Validador.inteiro(idBruto, "Empréstimo");
    const linhas = await Banco.consultar(`${ServicoEmprestimo.SQL_BASE} WHERE e.id = ?`, [id]);
    if (!linhas.length) throw new ErroNegocio("Empréstimo não encontrado.");
    return ServicoEmprestimo.montar(linhas[0]);
  }

  // Sugere o prazo de devolução (hoje + prazo padrão), pulando feriados (API de feriados).
  static async sugerirPrazo(): Promise<{ data: string; ajustada: boolean; motivo: string | null }> {
    const base = Datas.somarDias(Datas.hoje(), Configuracao.PRAZO_PADRAO_DIAS);
    return ApiFeriados.proximoDiaLivre(base);
  }

  // CREATE: registra a retirada de um livro. Aplica as regras:
  //  - livro não pode estar emprestado;
  //  - se está reservado para outra pessoa, não pode ser emprestado;
  //  - se está reservado para este mesmo leitor, a reserva vira "atendida".
  static async criar(dados: any): Promise<{ id: number; aviso: string | null }> {
    const livroId = Validador.inteiro(dados?.livro_id, "Livro");
    const usuarioId = Validador.inteiro(dados?.usuario_id, "Usuário");
    const observacao = Validador.texto(dados?.observacao, "Observação", 255, false);
    const hoje = Datas.hoje();

    const prazoInformado = dados?.data_prevista ? Validador.data(dados.data_prevista, "Prazo de devolução") : (await ServicoEmprestimo.sugerirPrazo()).data;
    if (prazoInformado < hoje) throw new ErroNegocio("O prazo de devolução não pode ser anterior a hoje.");
    const prazo = await ApiFeriados.proximoDiaLivre(prazoInformado);

    await ServicoReserva.expirarVencidas(); // garante que reservas vencidas não bloqueiem o livro

    const id = await Banco.transacao(async (c) => {
      const livros = await c.consultar("SELECT id FROM livro WHERE id = ? FOR UPDATE", [livroId]);
      if (!livros.length) throw new ErroNegocio("Livro não encontrado.");
      const usuarios = await c.consultar("SELECT id FROM usuario WHERE id = ?", [usuarioId]);
      if (!usuarios.length) throw new ErroNegocio("Usuário não encontrado.");

      const ativos = await c.consultar("SELECT id FROM emprestimo WHERE livro_id = ? AND data_devolucao IS NULL", [livroId]);
      if (ativos.length) throw new ErroNegocio("Este livro já está emprestado.");

      const reservas = await c.consultar<any>(
        `SELECT r.id, r.usuario_id, r.data_limite, u.nome
           FROM reserva r JOIN usuario u ON u.id = r.usuario_id
          WHERE r.livro_id = ? AND r.status = 'disponivel'`,
        [livroId],
      );
      if (reservas.length) {
        const reserva = reservas[0];
        if (reserva.usuario_id !== usuarioId) {
          throw new ErroNegocio(`Este livro está reservado para ${reserva.nome} até ${Datas.paraBR(reserva.data_limite)}.`);
        }
        await c.executar("UPDATE reserva SET status = 'atendida' WHERE id = ?", [reserva.id]);
      }

      const resultado = await c.executar(
        "INSERT INTO emprestimo (livro_id, usuario_id, data_retirada, data_prevista, observacao) VALUES (?, ?, ?, ?, ?)",
        [livroId, usuarioId, hoje, prazo.data, observacao],
      );
      return resultado.insertId;
    });

    return { id, aviso: prazo.ajustada ? `Prazo ajustado para ${Datas.paraBR(prazo.data)}: ${prazo.motivo}.` : null };
  }

  // UPDATE: renova o prazo ou altera a observação de um empréstimo que ainda está ativo.
  static async atualizar(dados: any): Promise<{ aviso: string | null }> {
    const id = Validador.inteiro(dados?.id, "Empréstimo");
    const observacao = Validador.texto(dados?.observacao, "Observação", 255, false);
    const prazoInformado = Validador.data(dados?.data_prevista, "Prazo de devolução");

    const atual = await ServicoEmprestimo.obter(id);
    if (atual.data_devolucao) throw new ErroNegocio("Este empréstimo já foi devolvido e não pode ser alterado.");
    if (prazoInformado < atual.data_retirada) throw new ErroNegocio("O prazo não pode ser anterior à data de retirada.");

    const prazo = await ApiFeriados.proximoDiaLivre(prazoInformado);
    // Se o prazo mudou, o aviso de vencimento precisa ser enviado de novo (aviso_enviado = 0).
    await Banco.executar(
      `UPDATE emprestimo
          SET data_prevista = ?, observacao = ?,
              aviso_enviado = CASE WHEN data_prevista <> ? THEN 0 ELSE aviso_enviado END
        WHERE id = ?`,
      [prazo.data, observacao, prazo.data, id],
    );
    return { aviso: prazo.ajustada ? `Prazo ajustado para ${Datas.paraBR(prazo.data)}: ${prazo.motivo}.` : null };
  }

  // Registra a devolução. Se alguém reservou o livro, a reserva passa a "disponivel"
  // e o aviso por e-mail é enviado.
  static async devolver(idBruto: unknown): Promise<{ reserva_para: string | null; notificacao: ResultadoNotificacao }> {
    const id = Validador.inteiro(idBruto, "Empréstimo");
    const reservaPara = await Banco.transacao(async (c) => {
      const linhas = await c.consultar<any>("SELECT id, livro_id, data_devolucao FROM emprestimo WHERE id = ? FOR UPDATE", [id]);
      if (!linhas.length) throw new ErroNegocio("Empréstimo não encontrado.");
      if (linhas[0].data_devolucao) throw new ErroNegocio("Este livro já foi devolvido.");
      await c.executar("UPDATE emprestimo SET data_devolucao = ? WHERE id = ?", [Datas.hoje(), id]);
      const promovida = await ServicoReserva.promoverProximo(linhas[0].livro_id, c);
      return promovida ? promovida.usuario_nome : null;
    });
    const notificacao = await ServicoNotificacao.processar(); // envia o e-mail para quem reservou
    return { reserva_para: reservaPara, notificacao };
  }

  // DELETE: apaga o registro de um empréstimo (só administrador). Se estava ativo, o livro volta ao acervo.
  static async excluir(idBruto: unknown): Promise<void> {
    const id = Validador.inteiro(idBruto, "Empréstimo");
    await Banco.transacao(async (c) => {
      const linhas = await c.consultar<any>("SELECT livro_id, data_devolucao FROM emprestimo WHERE id = ?", [id]);
      if (!linhas.length) throw new ErroNegocio("Empréstimo não encontrado.");
      await c.executar("DELETE FROM emprestimo WHERE id = ?", [id]);
      if (!linhas[0].data_devolucao) await ServicoReserva.promoverProximo(linhas[0].livro_id, c);
    });
    await ServicoNotificacao.processar();
  }
}
