// Controla a tela principal: menu lateral, qual tela está aberta e o contador de atrasados.
class Aplicacao {
  // Guarda a instância única (as telas usam para atualizar o aviso do menu).
  static atual: Aplicacao;

  private telaAberta: TelaBase | null = null;
  private perfil: PerfilAcesso = "bibliotecario";
  private itensMenu: { id: string; rotulo: string; soAdmin?: boolean }[] = [
    { id: "inicio", rotulo: "Início" },
    { id: "emprestimos", rotulo: "Empréstimos" },
    { id: "reservas", rotulo: "Reservas" },
    { id: "livros", rotulo: "Livros" },
    { id: "usuarios", rotulo: "Leitores" },
    { id: "autores", rotulo: "Autores" },
    { id: "editoras", rotulo: "Editoras" },
    { id: "usuariosSistema", rotulo: "Usuários do sistema", soAdmin: true },
  ];

  constructor() {
    Aplicacao.atual = this;
  }

  // Confere se há alguém logado e abre a tela inicial.
  async iniciar(): Promise<void> {
    const sessao = await Servidor.chamar<{ nome: string; perfil: PerfilAcesso } | null>("acesso:sessao");
    if (!sessao) {
      window.location.href = "login.html"; // sem login não entra
      return;
    }
    this.perfil = sessao.perfil;
    Util.porId("usuarioLogado").textContent = `${sessao.nome} (${sessao.perfil === "administrador" ? "administrador" : "bibliotecário"})`;
    this.desenharMenu();

    Util.porId("menu").addEventListener("click", (e) => {
      const botao = (e.target as HTMLElement).closest<HTMLElement>("[data-tela]");
      if (botao) this.abrirTela(botao.dataset.tela!);
    });
    Util.porId("btnSair").addEventListener("click", async () => {
      await Servidor.chamar("acesso:sair");
      window.location.href = "login.html";
    });

    await this.abrirTela("inicio");
  }

  // Desenha os botões do menu (esconde os que são só do administrador).
  private desenharMenu(): void {
    Util.porId("menu").innerHTML = this.itensMenu
      .filter((item) => !item.soAdmin || this.perfil === "administrador")
      .map((item) => `<button data-tela="${item.id}" id="menu_${item.id}">${Util.escapar(item.rotulo)}</button>`)
      .join("");
  }

  // Cria a tela pedida dentro da área de conteúdo.
  async abrirTela(id: string): Promise<void> {
    const area = Util.porId("conteudo");
    area.innerHTML = ""; // cada tela nasce em uma área nova (descarta os "ouvintes" da anterior)
    const raiz = document.createElement("div");
    area.appendChild(raiz);

    const ehAdmin = this.perfil === "administrador";
    const telas: Record<string, () => TelaBase> = {
      inicio: () => new TelaInicio(raiz),
      emprestimos: () => new TelaEmprestimos(raiz, ehAdmin),
      reservas: () => new TelaReservas(raiz, ehAdmin),
      livros: () => new TelaLivros(raiz, ehAdmin),
      usuarios: () => new TelaUsuarios(raiz, ehAdmin),
      autores: () => new TelaAutores(raiz, ehAdmin),
      editoras: () => new TelaEditoras(raiz, ehAdmin),
      usuariosSistema: () => new TelaUsuariosSistema(raiz, ehAdmin),
    };
    if (!telas[id]) return;

    document.querySelectorAll("#menu button").forEach((b) => b.classList.toggle("ativo", (b as HTMLElement).dataset.tela === id));
    this.telaAberta = telas[id]();
    try {
      await this.telaAberta.abrir();
    } catch (erro) {
      raiz.innerHTML = `<div class="alerta">${Util.escapar((erro as Error).message)}</div>`;
    }
    await this.atualizarAviso();
  }

  // Mostra no menu quantos empréstimos estão atrasados.
  async atualizarAviso(): Promise<void> {
    try {
      const resumo = await Servidor.chamar<ResumoPainel>("painel:resumo");
      const botao = document.getElementById("menu_emprestimos");
      if (botao) botao.textContent = resumo.atrasados.length ? `Empréstimos (${resumo.atrasados.length} ATRASADO${resumo.atrasados.length > 1 ? "S" : ""})` : "Empréstimos";
    } catch {
      // se falhar, só não atualiza o contador
    }
  }
}

new Aplicacao().iniciar().catch((erro) => Util.mensagem(erro.message, true));
