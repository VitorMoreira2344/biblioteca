import { Banco } from "../banco/Banco";
import { Datas } from "../util/Datas";
import { Configuracao } from "../config/Configuracao";
import { ServicoEmail, ResultadoEmail } from "./ServicoEmail";
import { ServicoReserva } from "./ServicoReserva";

// AVISOS AUTOMÁTICOS por e-mail:
//  - reserva disponível ("o livro voltou, venha buscar");
//  - empréstimo perto de vencer (ou já vencido).
// Roda ao abrir o programa, de tempos em tempos e depois de cada devolução.
export class ServicoNotificacao {
  private static fila: Promise<unknown> = Promise.resolve(); // garante uma execução por vez
  private static temporizador: NodeJS.Timeout | null = null;

  // Liga a verificação automática (agora e a cada 10 minutos).
  static agendar(): void {
    const rodar = () => ServicoNotificacao.processar().catch((e) => console.error("Falha nos avisos:", e));
    rodar();
    ServicoNotificacao.temporizador = setInterval(rodar, 10 * 60 * 1000);
  }

  // Desliga a verificação automática.
  static parar(): void {
    if (ServicoNotificacao.temporizador) clearInterval(ServicoNotificacao.temporizador);
  }

  // Executa a rotina completa, uma de cada vez (se já tiver uma rodando, espera ela acabar).
  static processar(): Promise<ResultadoNotificacao> {
    const execucao = ServicoNotificacao.fila.then(() => ServicoNotificacao.executar());
    ServicoNotificacao.fila = execucao.catch(() => undefined);
    return execucao;
  }

  // Marca o aviso como enviado (ou conta a falha, para tentar de novo depois).
  private static async registrar(resultado: ResultadoEmail, tabela: "reserva" | "emprestimo", id: number, resumo: ResultadoNotificacao): Promise<boolean> {
    if (!resultado.enviado && !resultado.simulado) {
      resumo.falhas++;
      return false;
    }
    await Banco.executar(`UPDATE ${tabela} SET aviso_enviado = 1 WHERE id = ?`, [id]); // "tabela" só aceita 2 valores fixos
    if (resultado.simulado) resumo.simulados++;
    return true;
  }

  // O trabalho em si.
  private static async executar(): Promise<ResultadoNotificacao> {
    const resumo: ResultadoNotificacao = { reservas_avisadas: 0, vencimentos_avisados: 0, reservas_expiradas: 0, simulados: 0, falhas: 0 };

    // 1) Reservas que ninguém buscou a tempo expiram (e o próximo da fila é chamado).
    resumo.reservas_expiradas = await ServicoReserva.expirarVencidas();

    // 2) Reservas disponíveis cujo leitor ainda não foi avisado.
    const reservas = await Banco.consultar<any>(
      `SELECT r.id, r.data_limite, l.titulo, u.nome, u.email
         FROM reserva r JOIN livro l ON l.id = r.livro_id JOIN usuario u ON u.id = r.usuario_id
        WHERE r.status = 'disponivel' AND r.aviso_enviado = 0`,
    );
    for (const r of reservas) {
      const mensagem = ServicoEmail.avisoReserva(r.nome, r.titulo, r.data_limite);
      const resultado = await ServicoEmail.enviar(r.email, mensagem.assunto, mensagem.texto);
      if (await ServicoNotificacao.registrar(resultado, "reserva", r.id, resumo)) resumo.reservas_avisadas++;
    }

    // 3) Empréstimos que vencem em breve (ou já venceram) e ainda não receberam aviso.
    const hoje = Datas.hoje();
    const limite = Datas.somarDias(hoje, Configuracao.DIAS_AVISO_VENCIMENTO);
    const emprestimos = await Banco.consultar<any>(
      `SELECT e.id, e.data_prevista, l.titulo, u.nome, u.email
         FROM emprestimo e JOIN livro l ON l.id = e.livro_id JOIN usuario u ON u.id = e.usuario_id
        WHERE e.data_devolucao IS NULL AND e.aviso_enviado = 0 AND e.data_prevista <= ?`,
      [limite],
    );
    for (const e of emprestimos) {
      const mensagem = ServicoEmail.avisoVencimento(e.nome, e.titulo, e.data_prevista, e.data_prevista < hoje);
      const resultado = await ServicoEmail.enviar(e.email, mensagem.assunto, mensagem.texto);
      if (await ServicoNotificacao.registrar(resultado, "emprestimo", e.id, resumo)) resumo.vencimentos_avisados++;
    }

    return resumo;
  }
}
