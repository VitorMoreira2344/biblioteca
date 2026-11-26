import { app, dialog } from "electron";
import { Configuracao } from "./config/Configuracao";
import { Banco } from "./banco/Banco";
import { Rotas } from "./ipc/Rotas";
import { JanelaPrincipal } from "./JanelaPrincipal";
import { ServicoNotificacao } from "./servicos/ServicoNotificacao";

// Classe que controla o ciclo de vida do programa (abrir, rodar, fechar).
class Aplicacao {
  private janela: JanelaPrincipal | null = null;

  // Ponto de entrada: espera o Electron ficar pronto e inicia tudo.
  iniciar(): void {
    app.whenReady().then(() => this.aoFicarPronto());
    app.on("window-all-closed", () => app.quit());
    app.on("before-quit", () => ServicoNotificacao.parar());
  }

  // Lê o .env, conecta no banco, cria as tabelas, liga as rotas e abre a janela.
  private async aoFicarPronto(): Promise<void> {
    try {
      const pasta = app.getAppPath();
      Configuracao.carregar(pasta);
      await Banco.conectar();
      await Banco.criarTabelas(pasta);
      Rotas.registrarTodas();
      this.janela = new JanelaPrincipal(pasta);
      ServicoNotificacao.agendar();
    } catch (erro) {
      dialog.showErrorBox("Erro ao iniciar", `Não foi possível iniciar o sistema.\n\n${(erro as Error).message}`);
      app.quit();
    }
  }
}

new Aplicacao().iniciar();
