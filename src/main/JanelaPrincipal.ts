import { BrowserWindow, Menu, shell } from "electron";
import * as path from "path";
import { Configuracao } from "./config/Configuracao";

// cria e cuida da janela do programa
export class JanelaPrincipal {
  private janela: BrowserWindow;
  // so essas duas paginas podem abrir
  private static readonly PAGINAS_PERMITIDAS = ["login.html", "app.html"];

  // monta a janela com as protecoes ligadas
  constructor(private pastaDoProjeto: string) {
    // tira o menu de cima
    Menu.setApplicationMenu(null);

    this.janela = new BrowserWindow({
      width: 1200,
      height: 760,
      minWidth: 900,
      minHeight: 600,
      title: "Biblioteca Comunitária",
      backgroundColor: "#ffffff",
      // iconezinho do livro que aparece na janela e na barra de tarefas
      icon: path.join(pastaDoProjeto, "assets", "icone.png"),
      // tela isolada sem node e em sandbox pra ficar seguro
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        devTools: Configuracao.modoDev,
      },
    });

    // liga as protecoes abre o login e o devtools se for modo dev
    this.protegerNavegacao();
    this.carregarPagina("login.html");
    if (Configuracao.modoDev) this.janela.webContents.openDevTools();
  }

  // bloqueia navegar pra qualquer lugar que nao seja nossas paginas
  private protegerNavegacao(): void {
    this.janela.webContents.on("will-navigate", (evento, url) => {
      const permitida = JanelaPrincipal.PAGINAS_PERMITIDAS.some((pagina) => url.startsWith("file://") && url.endsWith(pagina));
      if (!permitida) evento.preventDefault();
    });
    // link https abre no navegador e nenhuma janela nova abre dentro do app
    this.janela.webContents.setWindowOpenHandler(({ url }) => {
      if (url.startsWith("https://")) shell.openExternal(url);
      return { action: "deny" };
    });
  }

  // abre uma pagina da pasta renderer
  carregarPagina(nome: string): void {
    this.janela.loadFile(path.join(this.pastaDoProjeto, "src", "renderer", nome));
  }
}
