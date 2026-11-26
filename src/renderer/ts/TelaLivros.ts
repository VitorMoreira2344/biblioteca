// tela dos livros
class TelaLivros extends TelaBase {
  private livros: Livro[] = [];

  // enter no campo isbn busca o livro em vez de salvar o formulario
  constructor(raiz: HTMLElement, private ehAdmin: boolean) {
    super(raiz);
    raiz.addEventListener("keydown", (evento) => {
      if (evento.key === "Enter" && (evento.target as HTMLElement).id === "isbn") {
        evento.preventDefault();
        this.proteger(() => this.buscarIsbn());
      }
    });
  }

  // abre mostrando a lista
  async abrir(): Promise<void> {
    await this.mostrarLista();
  }

  // texto da situacao do livro
  private situacao(livro: Livro): string {
    if (livro.status === "emprestado") {
      const reservas = livro.reservas_ativas ? ` (${livro.reservas_ativas} na fila de reserva)` : "";
      return `EMPRESTADO para ${livro.emprestado_para}, devolução ${Util.dataBR(livro.devolucao_prevista)}${reservas}`;
    }
    if (livro.status === "reservado") return "RESERVADO: aguardando o leitor buscar";
    return "Disponível";
  }

  // busca os livros e desenha a barra de busca
  private async mostrarLista(): Promise<void> {
    this.livros = await Servidor.chamar<Livro[]>("livro:listar");
    this.raiz.innerHTML = `
      <h2>Livros</h2>
      <div class="barra">
        <button class="principal" data-acao="novo">Novo livro</button>
        <input id="busca" placeholder="Buscar por título, autor ou ISBN" autocomplete="off">
      </div>
      <div id="areaTabela"></div>`;
    this.desenharTabela("");
  }

  // monta a tabela filtrando por titulo autor ou isbn
  private desenharTabela(filtro: string): void {
    const busca = Util.semAcento(filtro.trim());
    const lista = this.livros.filter((l) => !busca || Util.semAcento(`${l.titulo} ${l.autores} ${l.isbn ?? ""}`).includes(busca));
    const area = Util.porId("areaTabela");
    if (!lista.length) {
      area.innerHTML = `<div class="vazio">Nenhum livro encontrado.</div>`;
      return;
    }
    const linhas = lista
      .map((l) => {
        const capa = l.capa_url ? `<img class="capa" src="${Util.escapar(l.capa_url)}" alt="">` : "";
        const excluir = this.ehAdmin ? `<button data-acao="excluir" data-id="${l.id}">Excluir</button>` : "";
        return `<tr><td>${capa}</td><td>${Util.escapar(l.titulo)}</td><td>${Util.escapar(l.autores)}</td><td>${Util.escapar(l.editora ?? "")}</td>
          <td>${Util.escapar(l.isbn ?? "")}</td><td>${Util.escapar(this.situacao(l))}</td>
          <td class="acoes"><button data-acao="editar" data-id="${l.id}">Editar</button> ${excluir}</td></tr>`;
      })
      .join("");
    area.innerHTML = `<table><thead><tr><th>Capa</th><th>Título</th><th>Autores</th><th>Editora</th><th>ISBN</th><th>Situação</th><th>Ações</th></tr></thead><tbody>${linhas}</tbody></table>`;
  }

  // busca enquanto digita e atualiza a previa da capa
  protected aoDigitar(campo: HTMLInputElement): void {
    if (campo.id === "busca") this.desenharTabela(campo.value);
    if (campo.id === "capa_url") this.atualizarPreviaCapa();
  }

  // mostra a capa se o link for https e esconde se nao for
  private atualizarPreviaCapa(): void {
    const campo = Util.porId<HTMLInputElement>("capa_url");
    const previa = Util.porId<HTMLImageElement>("previaCapa");
    const url = campo.value.trim();
    if (/^https:\/\//i.test(url)) {
      previa.src = url;
      previa.hidden = false;
    } else {
      previa.removeAttribute("src");
      previa.hidden = true;
    }
  }

  // formulario de livro novo ou de editar com a lista de editoras pra sugerir
  private async mostrarFormulario(id: number | null): Promise<void> {
    const livro = id ? await Servidor.chamar<Livro>("livro:obter", { id }) : null;
    const editoras = await Servidor.chamar<Editora[]>("editora:listar");
    const v = (valor: unknown) => Util.escapar(valor ?? "");

    this.raiz.innerHTML = `
      <h2>${livro ? "Editar" : "Novo"} livro</h2>
      <form id="formLivro">
        ${livro ? `<input type="hidden" name="id" value="${livro.id}">` : ""}
        <div class="grade">
          <div class="campo largo">
            <label for="isbn">ISBN (opcional: o sistema busca título, autor, editora e capa)</label>
            <div class="linha-isbn">
              <input id="isbn" name="isbn" value="${v(livro?.isbn)}" maxlength="17" placeholder="Ex.: 978-85-325-1101-0">
              <button type="button" data-acao="buscarIsbn">Buscar dados pelo ISBN</button>
            </div>
            <div id="infoIsbn" class="ajuda"></div>
          </div>
          <div class="campo largo"><label for="titulo">Título</label><input id="titulo" name="titulo" value="${v(livro?.titulo)}" maxlength="200" required></div>
          <div class="campo largo"><label for="autores">Autores</label><input id="autores" name="autores" value="${v(livro?.autores)}" maxlength="400">
            <div class="ajuda">Separe vários autores por vírgula. Autores novos são cadastrados automaticamente.</div></div>
          <div class="campo"><label for="editora">Editora</label><input id="editora" name="editora" value="${v(livro?.editora)}" maxlength="120" list="listaEditoras">
            <datalist id="listaEditoras">${editoras.map((e) => `<option value="${Util.escapar(e.nome)}">`).join("")}</datalist></div>
          <div class="campo"><label for="ano_publicacao">Ano de publicação</label><input id="ano_publicacao" name="ano_publicacao" type="number" value="${v(livro?.ano_publicacao)}" min="1000" max="2100"></div>
          <div class="campo"><label for="paginas">Páginas</label><input id="paginas" name="paginas" type="number" value="${v(livro?.paginas)}" min="1" max="20000"></div>
          <div class="campo"><label for="observacao">Observação</label><input id="observacao" name="observacao" value="${v(livro?.observacao)}" maxlength="255"></div>
          <div class="campo largo"><label for="capa_url">Endereço da capa (https://...)</label><input id="capa_url" name="capa_url" value="${v(livro?.capa_url)}" maxlength="500">
            <img id="previaCapa" class="previa-capa" alt="" hidden></div>
        </div>
        <div class="botoes"><button class="principal" type="submit">Salvar</button><button type="button" data-acao="cancelar">Cancelar</button></div>
      </form>`;
    this.atualizarPreviaCapa();
  }

  // busca o isbn e preenche os campos que vieram
  private async buscarIsbn(): Promise<void> {
    const isbn = Util.porId<HTMLInputElement>("isbn").value;
    const info = Util.porId("infoIsbn");
    info.textContent = "Buscando...";
    try {
      const d = await Servidor.chamar<DadosLivroIsbn & { copias_no_acervo: number }>("livro:buscarIsbn", { isbn });
      const preencher = (id: string, valor: unknown) => {
        if (valor !== null && valor !== undefined && valor !== "") Util.porId<HTMLInputElement>(id).value = String(valor);
      };
      preencher("titulo", d.titulo);
      preencher("autores", d.autores.join(", "));
      preencher("editora", d.editora);
      preencher("ano_publicacao", d.ano_publicacao);
      preencher("paginas", d.paginas);
      preencher("capa_url", d.capa_url);
      this.atualizarPreviaCapa();
      // avisa se ja tem outro exemplar com esse isbn
      const copias = d.copias_no_acervo ? ` Atenção: já existe(m) ${d.copias_no_acervo} exemplar(es) deste ISBN no acervo.` : "";
      info.textContent = `Dados encontrados em ${d.fonte}. Confira e salve.${copias}`;
    } catch (erro) {
      info.textContent = (erro as Error).message;
    }
  }

  // trata os botoes novo editar cancelar buscar isbn e excluir
  protected async aoClicar(acao: string, id: number | null): Promise<void> {
    if (acao === "novo") await this.mostrarFormulario(null);
    else if (acao === "editar") await this.mostrarFormulario(id);
    else if (acao === "cancelar") await this.mostrarLista();
    else if (acao === "buscarIsbn") await this.buscarIsbn();
    else if (acao === "excluir") {
      if (await Util.confirmar("Excluir este livro? Essa ação não pode ser desfeita.")) {
        await Servidor.chamar("livro:excluir", { id });
        this.sucesso("Livro excluído.");
        await this.mostrarLista();
      }
    }
  }

  // salva o livro novo ou a edicao
  protected async aoEnviar(_idDoForm: string, form: HTMLFormElement): Promise<void> {
    const dados = Util.dadosDoFormulario(form);
    if (dados.id) await Servidor.chamar("livro:atualizar", dados);
    else await Servidor.chamar("livro:criar", dados);
    this.sucesso("Livro salvo.");
    await this.mostrarLista();
  }
}
