import { ipcMain } from "electron";
import { Sessao } from "../seguranca/Sessao";
import { ErroNegocio } from "../util/ErroNegocio";
import { ServicoAcesso } from "../servicos/ServicoAcesso";
import { ServicoAutor } from "../servicos/ServicoAutor";
import { ServicoEditora } from "../servicos/ServicoEditora";
import { ServicoLivro } from "../servicos/ServicoLivro";
import { ServicoUsuario } from "../servicos/ServicoUsuario";
import { ServicoEmprestimo } from "../servicos/ServicoEmprestimo";
import { ServicoReserva } from "../servicos/ServicoReserva";
import { ServicoPainel } from "../servicos/ServicoPainel";
import { ServicoNotificacao } from "../servicos/ServicoNotificacao";

// Quem pode chamar cada rota:
//  "publico" = qualquer um (tela de login)
//  "logado"  = bibliotecário ou administrador
//  "admin"   = só administrador
type Permissao = "publico" | "logado" | "admin";

// Liga os "canais" que a tela chama aos serviços do sistema.
// A verificação de permissão é feita AQUI (no processo principal), nunca só na tela.
export class Rotas {
  // Registra um canal, já com checagem de permissão e tratamento de erro.
  private static registrar(canal: string, permissao: Permissao, funcao: (dados: any) => Promise<any> | any): void {
    ipcMain.handle(canal, async (_evento, dados): Promise<RespostaIpc> => {
      try {
        if (permissao !== "publico" && !Sessao.estaLogado()) {
          throw new ErroNegocio("Sessão expirada. Entre novamente.");
        }
        if (permissao === "admin" && !Sessao.ehAdmin()) {
          throw new ErroNegocio("Apenas o administrador pode fazer isso.");
        }
        const resultado = await funcao(dados);
        return { ok: true, dados: resultado };
      } catch (erro) {
        return { ok: false, erro: Rotas.traduzirErro(erro) };
      }
    });
  }

  // Converte um erro em mensagem segura para a tela (detalhes técnicos ficam só no console).
  private static traduzirErro(erro: any): string {
    if (erro instanceof ErroNegocio) return erro.message;
    console.error("Erro interno:", erro);
    if (erro?.code === "ER_ROW_IS_REFERENCED_2") return "Este registro está sendo usado em outro cadastro e não pode ser excluído.";
    if (erro?.code === "ER_DUP_ENTRY") return "Já existe um registro com esses dados.";
    return "Ocorreu um erro inesperado. Tente novamente.";
  }

  // Cadastra todos os canais do sistema.
  static registrarTodas(): void {
    const r = Rotas.registrar;

    // ----- Acesso (login) -----
    r("acesso:existeAdmin", "publico", () => ServicoAcesso.existeAdministrador());
    r("acesso:criarPrimeiroAdmin", "publico", (d) => ServicoAcesso.criarPrimeiroAdministrador(d));
    r("acesso:entrar", "publico", (d) => ServicoAcesso.entrar(d));
    r("acesso:sair", "publico", () => ServicoAcesso.sair());
    r("acesso:sessao", "publico", () => Sessao.obter());

    // ----- Usuários do sistema (só administrador) -----
    r("usuarioSistema:listar", "admin", () => ServicoAcesso.listar());
    r("usuarioSistema:criar", "admin", (d) => ServicoAcesso.criar(d));
    r("usuarioSistema:atualizar", "admin", (d) => ServicoAcesso.atualizar(d));
    r("usuarioSistema:excluir", "admin", (d) => ServicoAcesso.excluir(d?.id));

    // ----- Autores -----
    r("autor:listar", "logado", () => ServicoAutor.listar());
    r("autor:criar", "logado", (d) => ServicoAutor.criar(d));
    r("autor:atualizar", "logado", (d) => ServicoAutor.atualizar(d));
    r("autor:excluir", "admin", (d) => ServicoAutor.excluir(d?.id));

    // ----- Editoras -----
    r("editora:listar", "logado", () => ServicoEditora.listar());
    r("editora:criar", "logado", (d) => ServicoEditora.criar(d));
    r("editora:atualizar", "logado", (d) => ServicoEditora.atualizar(d));
    r("editora:excluir", "admin", (d) => ServicoEditora.excluir(d?.id));

    // ----- Livros -----
    r("livro:listar", "logado", () => ServicoLivro.listar());
    r("livro:obter", "logado", (d) => ServicoLivro.obter(d?.id));
    r("livro:criar", "logado", (d) => ServicoLivro.criar(d));
    r("livro:atualizar", "logado", (d) => ServicoLivro.atualizar(d));
    r("livro:excluir", "admin", (d) => ServicoLivro.excluir(d?.id));
    r("livro:buscarIsbn", "logado", (d) => ServicoLivro.buscarPorIsbn(d));

    // ----- Usuários da biblioteca (leitores) -----
    r("usuario:listar", "logado", () => ServicoUsuario.listar());
    r("usuario:obter", "logado", (d) => ServicoUsuario.obter(d?.id));
    r("usuario:criar", "logado", (d) => ServicoUsuario.criar(d));
    r("usuario:atualizar", "logado", (d) => ServicoUsuario.atualizar(d));
    r("usuario:excluir", "admin", (d) => ServicoUsuario.excluir(d?.id));
    r("usuario:consultarCep", "logado", (d) => ServicoUsuario.consultarCep(d));

    // ----- Empréstimos -----
    r("emprestimo:listar", "logado", (d) => ServicoEmprestimo.listar(d?.filtro));
    r("emprestimo:obter", "logado", (d) => ServicoEmprestimo.obter(d?.id));
    r("emprestimo:criar", "logado", (d) => ServicoEmprestimo.criar(d));
    r("emprestimo:atualizar", "logado", (d) => ServicoEmprestimo.atualizar(d));
    r("emprestimo:devolver", "logado", (d) => ServicoEmprestimo.devolver(d?.id));
    r("emprestimo:excluir", "admin", (d) => ServicoEmprestimo.excluir(d?.id));
    r("emprestimo:sugerirPrazo", "logado", () => ServicoEmprestimo.sugerirPrazo());

    // ----- Reservas -----
    r("reserva:listar", "logado", () => ServicoReserva.listar());
    r("reserva:obter", "logado", (d) => ServicoReserva.obter(d?.id));
    r("reserva:criar", "logado", (d) => ServicoReserva.criar(d));
    r("reserva:atualizar", "logado", (d) => ServicoReserva.atualizar(d));
    r("reserva:excluir", "admin", (d) => ServicoReserva.excluir(d?.id));
    r("reserva:emprestar", "logado", (d) => ServicoReserva.emprestar(d));

    // ----- Painel e avisos -----
    r("painel:resumo", "logado", () => ServicoPainel.resumo());
    r("notificacao:processar", "logado", () => ServicoNotificacao.processar());
  }
}
