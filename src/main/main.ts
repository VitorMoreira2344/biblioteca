import { app, dialog } from "electron";
import { Configuracao } from "./config/Configuracao";
import { Banco } from "./banco/Banco";
import { Rotas } from "./ipc/Rotas";
import { JanelaPrincipal } from "./JanelaPrincipal";
import { ServicoNotificacao } from "./servicos/ServicoNotificacao";

// controla o programa abrindo rodando e fechando
class Aplicacao {
  private janela: JanelaPrincipal | null = null;

  // espera o electron ficar pronto e liga os eventos de fechar
  iniciar(): void {
    app.whenReady().then(() => this.aoFicarPronto());
    app.on("window-all-closed", () => app.quit());
    app.on("before-quit", () => ServicoNotificacao.parar());
  }

  // le o env conecta no banco cria as tabelas liga as rotas e abre a janela
  private async aoFicarPronto(): Promise<void> {
    try {
      const pasta = app.getAppPath();
      Configuracao.carregar(pasta);
      await Banco.conectar();
      await Banco.criarTabelas(pasta);
      Rotas.registrarTodas();
      this.janela = new JanelaPrincipal(pasta);
      ServicoNotificacao.agendar();
    // se der ruim mostra o erro e fecha o app
    } catch (erro) {
      dialog.showErrorBox("Erro ao iniciar", `Não foi possível iniciar o sistema.\n\n${(erro as Error).message}`);
      app.quit();
    }
  }
}

// aqui o programa comeca de verdade
new Aplicacao().iniciar();
