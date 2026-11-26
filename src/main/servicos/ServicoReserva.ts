import { Banco, Executor } from "../banco/Banco";
import { Validador } from "../util/Validador";
import { ErroNegocio } from "../util/ErroNegocio";
import { Datas } from "../util/Datas";
import { Configuracao } from "../config/Configuracao";
import { ServicoEmprestimo } from "./ServicoEmprestimo";
import { ServicoNotificacao } from "./ServicoNotificacao";

// crud das reservas e a fila de espera
export class ServicoReserva {
  // lista as reservas com as disponiveis primeiro e calcula a posicao na fila
  static async listar(): Promise<Reserva[]> {
    const linhas = await Banco.consultar<any>(
      `SELECT r.id, r.livro_id, r.usuario_id, l.titulo, u.nome AS usuario_nome, r.data_reserva,
              r.status, r.data_limite, r.observacao
         FROM reserva r
         JOIN livro l ON l.id = r.livro_id
         JOIN usuario u ON u.id = r.usuario_id
        ORDER BY FIELD(r.status, 'disponivel', 'aguardando', 'atendida', 'expirada', 'cancelada'),
                 r.data_reserva, r.id`,
    );
    // numera quem ta aguardando por livro tipo 1 2 3 na fila
    const contagem = new Map<number, number>();
    return linhas.map((l) => {
      let posicao: number | null = null;
      if (l.status === "aguardando") {
        posicao = (contagem.get(l.livro_id) ?? 0) + 1;
        contagem.set(l.livro_id, posicao);
      }
      return { ...l, posicao_fila: posicao };
    });
  }

  // pega uma reserva pelo id
  static async obter(idBruto: unknown): Promise<Reserva> {
    const id = Validador.inteiro(idBruto, "Reserva");
    const todas = await ServicoReserva.listar();
    const reserva = todas.find((r) => r.id === id);
    if (!reserva) throw new ErroNegocio("Reserva não encontrada.");
    return reserva;
  }

  // cria uma reserva nova
  static async criar(dados: any): Promise<{ id: number }> {
    const livroId = Validador.inteiro(dados?.livro_id, "Livro");
    const usuarioId = Validador.inteiro(dados?.usuario_id, "Usuário");
    const observacao = Validador.texto(dados?.observacao, "Observação", 255, false);
    await ServicoReserva.expirarVencidas();

    // faz tudo numa transacao e trava o livro pra ninguem mexer junto
    return Banco.transacao(async (c) => {
      const livros = await c.consultar("SELECT id FROM livro WHERE id = ? FOR UPDATE", [livroId]);
      if (!livros.length) throw new ErroNegocio("Livro não encontrado.");
      const usuarios = await c.consultar("SELECT id FROM usuario WHERE id = ?", [usuarioId]);
      if (!usuarios.length) throw new ErroNegocio("Usuário não encontrado.");

      const emprestimos = await c.consultar<any>("SELECT usuario_id FROM emprestimo WHERE livro_id = ? AND data_devolucao IS NULL", [livroId]);
      const reservasAtivas = await c.consultar<any>(
        "SELECT usuario_id FROM reserva WHERE livro_id = ? AND status IN ('aguardando','disponivel')",
        [livroId],
      );

      // so da pra reservar livro que ta fora da estante
      if (!emprestimos.length && !reservasAtivas.length) {
        throw new ErroNegocio("Este livro está disponível na estante: faça o empréstimo direto, sem reserva.");
      }
      // quem ta com o livro nao pode reservar ele
      if (emprestimos.some((e) => e.usuario_id === usuarioId)) {
        throw new ErroNegocio("Este leitor está com o livro agora, não pode reservá-lo.");
      }
      // nao deixa a mesma pessoa reservar duas vezes
      if (reservasAtivas.some((r) => r.usuario_id === usuarioId)) {
        throw new ErroNegocio("Este leitor já tem uma reserva ativa para este livro.");
      }

      const resultado = await c.executar(
        "INSERT INTO reserva (livro_id, usuario_id, data_reserva, observacao) VALUES (?, ?, ?, ?)",
        [livroId, usuarioId, Datas.hoje(), observacao],
      );
      return { id: resultado.insertId };
    });
  }

  // edita a observacao e pode cancelar a reserva
  static async atualizar(dados: any): Promise<void> {
    const id = Validador.inteiro(dados?.id, "Reserva");
    const observacao = Validador.texto(dados?.observacao, "Observação", 255, false);
    const cancelar = dados?.cancelar === true || dados?.cancelar === "on";

    await Banco.transacao(async (c) => {
      const linhas = await c.consultar<any>("SELECT livro_id, status FROM reserva WHERE id = ? FOR UPDATE", [id]);
      if (!linhas.length) throw new ErroNegocio("Reserva não encontrada.");
      const { livro_id, status } = linhas[0];

      await c.executar("UPDATE reserva SET observacao = ? WHERE id = ?", [observacao, id]);
      // cancelar so se a reserva ta ativa e se ela tava disponivel passa pro proximo da fila
      if (cancelar) {
        if (status !== "aguardando" && status !== "disponivel") {
          throw new ErroNegocio("Só é possível cancelar reservas ativas.");
        }
        await c.executar("UPDATE reserva SET status = 'cancelada' WHERE id = ?", [id]);
        if (status === "disponivel") await ServicoReserva.promoverProximo(livro_id, c);
      }
    });
    await ServicoNotificacao.processar();
  }

  // apaga a reserva e se ela tava disponivel passa pro proximo da fila
  static async excluir(idBruto: unknown): Promise<void> {
    const id = Validador.inteiro(idBruto, "Reserva");
    await Banco.transacao(async (c) => {
      const linhas = await c.consultar<any>("SELECT livro_id, status FROM reserva WHERE id = ?", [id]);
      if (!linhas.length) throw new ErroNegocio("Reserva não encontrada.");
      await c.executar("DELETE FROM reserva WHERE id = ?", [id]);
      if (linhas[0].status === "disponivel") await ServicoReserva.promoverProximo(linhas[0].livro_id, c);
    });
    await ServicoNotificacao.processar();
  }

  // transforma uma reserva disponivel em emprestimo
  static async emprestar(dados: any): Promise<{ id: number; aviso: string | null }> {
    const id = Validador.inteiro(dados?.id, "Reserva");
    const reserva = await ServicoReserva.obter(id);
    if (reserva.status !== "disponivel") {
      throw new ErroNegocio("Só é possível emprestar uma reserva que já está disponível para retirada.");
    }
    return ServicoEmprestimo.criar({ livro_id: reserva.livro_id, usuario_id: reserva.usuario_id, data_prevista: dados?.data_prevista });
  }

  // quando o livro volta o primeiro da fila ganha 1 dia pra buscar
  static async promoverProximo(livroId: number, c: Executor = Banco): Promise<{ reserva_id: number; usuario_nome: string } | null> {
    // se o livro ainda ta emprestado nao faz nada
    const emprestados = await c.consultar("SELECT id FROM emprestimo WHERE livro_id = ? AND data_devolucao IS NULL", [livroId]);
    if (emprestados.length) return null;

    const fila = await c.consultar<any>(
      `SELECT r.id, u.nome FROM reserva r JOIN usuario u ON u.id = r.usuario_id
        WHERE r.livro_id = ? AND r.status = 'aguardando' ORDER BY r.data_reserva, r.id LIMIT 1`,
      [livroId],
    );
    if (!fila.length) return null;

    const limite = Datas.somarDias(Datas.hoje(), Configuracao.DIAS_RETIRADA_RESERVA);
    await c.executar("UPDATE reserva SET status = 'disponivel', data_limite = ?, aviso_enviado = 0 WHERE id = ?", [limite, fila[0].id]);
    return { reserva_id: fila[0].id, usuario_nome: fila[0].nome };
  }

  // reserva que passou do dia de buscar expira e passa pro proximo
  static async expirarVencidas(): Promise<number> {
    const vencidas = await Banco.consultar<any>(
      "SELECT id, livro_id FROM reserva WHERE status = 'disponivel' AND data_limite < ?",
      [Datas.hoje()],
    );
    for (const reserva of vencidas) {
      await Banco.transacao(async (c) => {
        await c.executar("UPDATE reserva SET status = 'expirada' WHERE id = ? AND status = 'disponivel'", [reserva.id]);
        await ServicoReserva.promoverProximo(reserva.livro_id, c);
      });
    }
    return vencidas.length;
  }
}
