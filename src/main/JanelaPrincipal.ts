import { BrowserWindow, Menu, shell } from "electron";
import * as path from "path";
import { Configuracao } from "./config/Configuracao";

// Cria e controla a janela do programa.
export class JanelaPrincipal {
  private janela: BrowserWindow;
  // Só estas páginas podem ser abertas dentro da janela.
  private static readonly PAGINAS_PERMITIDAS = ["login.html", "app.html"];

  constructor(private pastaDoProjeto: string) {
    Menu.setApplicationMenu(null); // sem menu padrão do Electron

    this.janela = new BrowserWindow({
      width: 1200,
      height: 760,
      minWidth: 900,
      minHeight: 600,
      title: "Biblioteca Comunitária",
      backgroundColor: "#ffffff",
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
        contextIsolation: true, // a tela roda isolada do preload
        nodeIntegration: false, // a tela NÃO tem acesso ao Node.js
        sandbox: true,
        devTools: Configuracao.modoDev,
      },
    });

    this.protegerNavegacao();
    this.carregarPagina("login.html");
    if (Configuracao.modoDev) this.janela.webContents.openDevTools();
  }

  // Impede que a janela abra sites externos ou outras páginas por engano/ataque.
  private protegerNavegacao(): void {
    this.janela.webContents.on("will-navigate", (evento, url) => {
      const permitida = JanelaPrincipal.PAGINAS_PERMITIDAS.some((pagina) => url.startsWith("file://") && url.endsWith(pagina));
      if (!permitida) evento.preventDefault();
    });
    // Links que abririam nova janela: abre no navegador do sistema (só https) e bloqueia o resto.
    this.janela.webContents.setWindowOpenHandler(({ url }) => {
      if (url.startsWith("https://")) shell.openExternal(url);
      return { action: "deny" };
    });
  }

  // Carrega uma página da pasta src/renderer.
  carregarPagina(nome: string): void {
    this.janela.loadFile(path.join(this.pastaDoProjeto, "src", "renderer", nome));
  }
}
