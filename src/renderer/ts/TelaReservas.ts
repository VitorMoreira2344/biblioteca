// Tela de reservas: fila de espera por livros emprestados.
class TelaReservas extends TelaBase {
  private reservas: Reserva[] = [];

  constructor(raiz: HTMLElement, private ehAdmin: boolean) {
    super(raiz);
  }

  // Ao abrir, mostra a lista.
  async abrir(): Promise<void> {
    await this.mostrarLista();
  }

  // Texto da situação da reserva.
  private situacao(r: Reserva): string {
    if (r.status === "aguardando") return `Na fila (posição ${r.posicao_fila}): livro ainda está emprestado`;
    if (r.status === "disponivel") return `LIVRO DISPONÍVEL: retirar até ${Util.dataBR(r.data_limite)}`;
    if (r.status === "atendida") return "Atendida (virou empréstimo)";
    if (r.status === "expirada") return "Expirada (não buscou a tempo)";
    return "Cancelada";
  }

  // Busca as reservas e desenha a tabela.
  private async mostrarLista(): Promise<void> {
    this.reservas = await Servidor.chamar<Reserva[]>("reserva:listar");
    const linhas = this.reservas
      .map((r) => {
        const botoes =
          (r.status === "disponivel" ? `<button data-acao="emprestar" data-id="${r.id}">Emprestar</button> ` : "") +
          `<button data-acao="editar" data-id="${r.id}">Editar</button> ` +
          (this.ehAdmin ? `<button data-acao="excluir" data-id="${r.id}">Excluir</button>` : "");
        return `<tr class="${r.status === "disponivel" ? "destaque" : ""}"><td>${Util.escapar(r.titulo)}</td><td>${Util.escapar(r.usuario_nome)}</td>
          <td>${Util.dataBR(r.data_reserva)}</td><td>${Util.escapar(this.situacao(r))}</td>
          <td>${Util.escapar(r.observacao ?? "")}</td><td class="acoes">${botoes}</td></tr>`;
      })
      .join("");

    this.raiz.innerHTML = `
      <h2>Reservas</h2>
      <div class="aviso">Quando o livro volta, o 1º da fila é avisado por e-mail e tem 1 dia para buscar. Se não buscar, a reserva expira e passa para o próximo (ou o livro fica livre para todos).</div>
      <div class="barra"><button class="principal" data-acao="novo">Nova reserva</button></div>
      ${this.reservas.length ? `<table><thead><tr><th>Livro</th><th>Leitor</th><th>Reservado em</th><th>Situação</th><th>Observação</th><th>Ações</th></tr></thead><tbody>${linhas}</tbody></table>` : `<div class="vazio">Nenhuma reserva cadastrada.</div>`}`;
  }

  // Formulário de NOVA reserva (só livros que não estão na estante).
  private async mostrarFormularioNovo(): Promise<void> {
    const [livros, usuarios] = await Promise.all([Servidor.chamar<Livro[]>("livro:listar"), Servidor.chamar<Usuario[]>("usuario:listar")]);
    const indisponiveis = livros.filter((l) => l.status !== "disponivel").map((l) => ({ valor: l.id, texto: `${l.titulo} (${l.status === "emprestado" ? "emprestado" : "reservado"})` }));
    const leitores = usuarios.map((u) => ({ valor: u.id, texto: `${u.nome} (${u.cpf_mascarado})` }));

    this.raiz.innerHTML = `
      <h2>Nova reserva</h2>
      <form id="formNovaReserva" class="form-estreito">
        <div class="campo"><label for="livro_id">Livro (emprestado ou já reservado)</label>
          <select id="livro_id" name="livro_id" required>${Util.opcoes(indisponiveis, null, "Escolha o livro...")}</select>
          <div class="ajuda">Se o livro está na estante, faça o empréstimo direto.</div></div>
        <div class="campo"><label for="usuario_id">Leitor</label>
          <select id="usuario_id" name="usuario_id" required>${Util.opcoes(leitores, null, "Escolha o leitor...")}</select></div>
        <div class="campo"><label for="observacao">Observação</label><input id="observacao" name="observacao" maxlength="255"></div>
        <div class="botoes"><button class="principal" type="submit">Reservar</button><button type="button" data-acao="cancelar">Cancelar</button></div>
      </form>`;
  }

  // Formulário de edição: observação e opção de cancelar.
  private mostrarFormularioEdicao(r: Reserva): void {
    const ativa = r.status === "aguardando" || r.status === "disponivel";
    this.raiz.innerHTML = `
      <h2>Editar reserva</h2>
      <form id="formEditarReserva" class="form-estreito">
        <input type="hidden" name="id" value="${r.id}">
        <div class="campo"><label>Livro</label><div>${Util.escapar(r.titulo)}</div></div>
        <div class="campo"><label>Leitor</label><div>${Util.escapar(r.usuario_nome)}</div></div>
        <div class="campo"><label>Situação</label><div>${Util.escapar(this.situacao(r))}</div></div>
        <div class="campo"><label for="observacao">Observação</label><input id="observacao" name="observacao" value="${Util.escapar(r.observacao ?? "")}" maxlength="255"></div>
        ${ativa ? `<div class="campo"><label><input type="checkbox" name="cancelar" id="cancelar"> Cancelar esta reserva</label></div>` : ""}
        <div class="botoes"><button class="principal" type="submit">Salvar</button><button type="button" data-acao="voltar">Voltar</button></div>
      </form>`;
  }

  // Cliques da tela.
  protected async aoClicar(acao: string, id: number | null): Promise<void> {
    if (acao === "novo") await this.mostrarFormularioNovo();
    else if (acao === "cancelar" || acao === "voltar") await this.mostrarLista();
    else if (acao === "editar") {
      const reserva = this.reservas.find((r) => r.id === id);
      if (reserva) this.mostrarFormularioEdicao(reserva);
    } else if (acao === "emprestar") {
      if (await Util.confirmar("O leitor veio buscar o livro? Isso registra o empréstimo.")) {
        const r = await Servidor.chamar<{ aviso: string | null }>("reserva:emprestar", { id });
        this.sucesso(r.aviso ? `Empréstimo registrado. ${r.aviso}` : "Empréstimo registrado.");
        await this.mostrarLista();
        await Aplicacao.atual.atualizarAviso();
      }
    } else if (acao === "excluir") {
      if (await Util.confirmar("Excluir esta reserva? Essa ação não pode ser desfeita.")) {
        await Servidor.chamar("reserva:excluir", { id });
        this.sucesso("Reserva excluída.");
        await this.mostrarLista();
      }
    }
  }

  // Salvar (nova ou edição).
  protected async aoEnviar(idDoForm: string, form: HTMLFormElement): Promise<void> {
    const dados = Util.dadosDoFormulario(form);
    if (idDoForm === "formNovaReserva") await Servidor.chamar("reserva:criar", dados);
    else await Servidor.chamar("reserva:atualizar", dados);
    this.sucesso("Reserva salva.");
    await this.mostrarLista();
  }
}
