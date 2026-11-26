import { Banco } from "../banco/Banco";
import { Datas } from "../util/Datas";
import { Configuracao } from "../config/Configuracao";
import { ServicoEmprestimo } from "./ServicoEmprestimo";
import { ServicoReserva } from "./ServicoReserva";
import { ServicoEmail } from "./ServicoEmail";

// Dados da tela inicial: números gerais e, principalmente, quem está ATRASADO.
export class ServicoPainel {
  // Monta o resumo do painel.
  static async resumo(): Promise<ResumoPainel> {
    const totais = await Banco.consultar<any>(
      `SELECT (SELECT COUNT(*) FROM livro) AS total_livros,
              (SELECT COUNT(DISTINCT livro_id) FROM emprestimo WHERE data_devolucao IS NULL) AS livros_emprestados,
              (SELECT COUNT(*) FROM usuario) AS total_usuarios`,
    );
    const ativos = await ServicoEmprestimo.listar("ativos");
    const limite = Datas.somarDias(Datas.hoje(), Configuracao.DIAS_AVISO_VENCIMENTO);
    const reservas = await ServicoReserva.listar();

    return {
      total_livros: Number(totais[0].total_livros),
      livros_emprestados: Number(totais[0].livros_emprestados),
      total_usuarios: Number(totais[0].total_usuarios),
      atrasados: ativos.filter((e) => e.atrasado),
      vencendo: ativos.filter((e) => !e.atrasado && e.data_prevista <= limite),
      reservas_para_retirar: reservas.filter((r) => r.status === "disponivel"),
      email_configurado: ServicoEmail.configurado(),
    };
  }
}
