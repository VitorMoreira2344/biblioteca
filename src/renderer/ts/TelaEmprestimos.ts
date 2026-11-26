// tela dos emprestimos
class TelaEmprestimos extends TelaBase {
  private emprestimos: Emprestimo[] = [];
  // comeca mostrando so os que tao em andamento
  private filtro = "ativos";

  // guarda se e admin pra mostrar o botao excluir
  constructor(raiz: HTMLElement, private ehAdmin: boolean) {
    super(raiz);
  }

  // abre mostrando a lista
  async abrir(): Promise<void> {
    await this.mostrarLista();
  }

  // texto da situacao de cada emprestimo
  private situacao(e: Emprestimo): string {
    if (e.data_devolucao) return `Devolvido em ${Util.dataBR(e.data_devolucao)}`;
    if (e.atrasado) return `ATRASADO há ${e.dias_atraso} dia(s)`;
    return "Em dia";
  }

  // busca os emprestimos com o filtro e monta a tabela com os atrasados em preto
  private async mostrarLista(): Promise<void> {
    this.emprestimos = await Servidor.chamar<Emprestimo[]>("emprestimo:listar", { filtro: this.filtro });
    const opcoes = [
      { valor: "ativos", texto: "Em andamento" },
      { valor: "atrasados", texto: "Somente atrasados" },
      { valor: "devolvidos", texto: "Devolvidos" },
      { valor: "todos", texto: "Todos" },
    ];
    const linhas = this.emprestimos
      .map((e) => {
        const ativo = !e.data_devolucao;
        const botoes =
          (ativo ? `<button data-acao="devolver" data-id="${e.id}">Devolver</button> <button data-acao="editar" data-id="${e.id}">Renovar/Editar</button> ` : "") +
          (this.ehAdmin ? `<button data-acao="excluir" data-id="${e.id}">Excluir</button>` : "");
        return `<tr class="${e.atrasado ? "atrasado" : ""}"><td>${Util.escapar(e.titulo)}</td>
          <td>${Util.escapar(e.usuario_nome)}</td><td>${Util.escapar(Util.telefoneBR(e.telefone))}<br>${Util.escapar(e.endereco)}</td>
          <td>${Util.dataBR(e.data_retirada)}</td><td>${Util.dataBR(e.data_prevista)}</td><td>${Util.escapar(this.situacao(e))}</td>
          <td class="acoes">${botoes}</td></tr>`;
      })
      .join("");

    this.raiz.innerHTML = `
      <h2>Empréstimos</h2>
      <div class="barra">
        <button class="principal" data-acao="novo">Novo empréstimo</button>
        <select id="filtro">${Util.opcoes(opcoes, this.filtro)}</select>
      </div>
      ${this.emprestimos.length ? `<table><thead><tr><th>Livro</th><th>Leitor</th><th>Contato / endereço</th><th>Retirada</th><th>Prazo</th><th>Situação</th><th>Ações</th></tr></thead><tbody>${linhas}</tbody></table>` : `<div class="vazio">Nenhum empréstimo neste filtro.</div>`}`;
  }

  // trocou o filtro entao recarrega a lista
  protected aoDigitar(campo: HTMLInputElement): void {
    if (campo.id === "filtro") {
      this.filtro = campo.value;
      this.proteger(() => this.mostrarLista());
    }
  }

  // formulario de emprestimo novo com livros disponiveis leitores e prazo sugerido
  private async mostrarFormularioNovo(): Promise<void> {
    const [livros, usuarios, prazo] = await Promise.all([
      Servidor.chamar<Livro[]>("livro:listar"),
      Servidor.chamar<Usuario[]>("usuario:listar"),
      Servidor.chamar<{ data: string; ajustada: boolean; motivo: string | null }>("emprestimo:sugerirPrazo"),
    ]);
    const disponiveis = livros.filter((l) => l.status === "disponivel").map((l) => ({ valor: l.id, texto: `${l.titulo}${l.autores ? " - " + l.autores : ""}` }));
    const leitores = usuarios.map((u) => ({ valor: u.id, texto: `${u.nome} (${u.cpf_mascarado})` }));
    const aviso = prazo.ajustada ? `Prazo ajustado automaticamente: ${prazo.motivo}.` : "Prazo padrão de 14 dias.";

    this.raiz.innerHTML = `
      <h2>Novo empréstimo</h2>
      <form id="formNovoEmprestimo" class="form-estreito">
        <div class="campo"><label for="livro_id">Livro (somente disponíveis)</label>
          <select id="livro_id" name="livro_id" required>${Util.opcoes(disponiveis, null, "Escolha o livro...")}</select>
          <div class="ajuda">Livros reservados só saem pela tela de Reservas (botão "Emprestar").</div></div>
        <div class="campo"><label for="usuario_id">Leitor</label>
          <select id="usuario_id" name="usuario_id" required>${Util.opcoes(leitores, null, "Escolha o leitor...")}</select></div>
        <div class="campo"><label for="data_prevista">Prazo de devolução</label>
          <input id="data_prevista" name="data_prevista" type="date" value="${prazo.data}" required>
          <div class="ajuda">${Util.escapar(aviso)}</div></div>
        <div class="campo"><label for="observacao">Observação</label><input id="observacao" name="observacao" maxlength="255"></div>
        <div class="botoes"><button class="principal" type="submit">Registrar empréstimo</button><button type="button" data-acao="cancelar">Cancelar</button></div>
      </form>`;
  }

  // formulario pra renovar o prazo ou mudar a observacao
  private mostrarFormularioEdicao(e: Emprestimo): void {
    this.raiz.innerHTML = `
      <h2>Renovar / editar empréstimo</h2>
      <form id="formEditarEmprestimo" class="form-estreito">
        <input type="hidden" name="id" value="${e.id}">
        <div class="campo"><label>Livro</label><div>${Util.escapar(e.titulo)}</div></div>
        <div class="campo"><label>Leitor</label><div>${Util.escapar(e.usuario_nome)}</div></div>
        <div class="campo"><label>Retirado em</label><div>${Util.dataBR(e.data_retirada)}</div></div>
        <div class="campo"><label for="data_prevista">Novo prazo de devolução</label>
          <input id="data_prevista" name="data_prevista" type="date" value="${Util.escapar(e.data_prevista)}" required></div>
        <div class="campo"><label for="observacao">Observação</label><input id="observacao" name="observacao" value="${Util.escapar(e.observacao ?? "")}" maxlength="255"></div>
        <div class="botoes"><button class="principal" type="submit">Salvar</button><button type="button" data-acao="cancelar">Cancelar</button></div>
      </form>`;
  }

  // trata os botoes novo cancelar editar devolver e excluir
  protected async aoClicar(acao: string, id: number | null): Promise<void> {
    if (acao === "novo") await this.mostrarFormularioNovo();
    else if (acao === "cancelar") await this.mostrarLista();
    else if (acao === "editar") {
      const emprestimo = this.emprestimos.find((e) => e.id === id);
      if (emprestimo) this.mostrarFormularioEdicao(emprestimo);
    } else if (acao === "devolver") {
      if (await Util.confirmar("Registrar a devolução deste livro?")) {
        const r = await Servidor.chamar<{ reserva_para: string | null }>("emprestimo:devolver", { id });
        this.sucesso(r.reserva_para ? `Devolvido. ${r.reserva_para} foi avisado(a) de que o livro reservado chegou.` : "Devolução registrada.");
        await this.depoisDeAlterar();
      }
    } else if (acao === "excluir") {
      if (await Util.confirmar("Excluir este registro de empréstimo? Essa ação não pode ser desfeita.")) {
        await Servidor.chamar("emprestimo:excluir", { id });
        this.sucesso("Empréstimo excluído.");
        await this.depoisDeAlterar();
      }
    }
  }

  // salva o emprestimo novo ou a edicao e mostra se o prazo mudou por feriado
  protected async aoEnviar(idDoForm: string, form: HTMLFormElement): Promise<void> {
    const dados = Util.dadosDoFormulario(form);
    const canal = idDoForm === "formNovoEmprestimo" ? "emprestimo:criar" : "emprestimo:atualizar";
    const r = await Servidor.chamar<{ aviso: string | null }>(canal, dados);
    this.sucesso(r.aviso ? `Salvo. ${r.aviso}` : "Empréstimo salvo.");
    await this.depoisDeAlterar();
  }

  // recarrega a lista e o contador de atrasados do menu
  private async depoisDeAlterar(): Promise<void> {
    await this.mostrarLista();
    await Aplicacao.atual.atualizarAviso();
  }
}
