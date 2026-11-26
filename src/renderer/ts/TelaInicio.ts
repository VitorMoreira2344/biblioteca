// tela inicial com o resumo da biblioteca
class TelaInicio extends TelaBase {
  // busca o resumo e desenha tudo
  async abrir(): Promise<void> {
    const r = await Servidor.chamar<ResumoPainel>("painel:resumo");

    // faixa preta se tem atraso
    const alerta = r.atrasados.length
      ? `<div class="alerta">ATENÇÃO: ${r.atrasados.length} empréstimo(s) em atraso. Veja abaixo quem precisa devolver.</div>`
      : `<div class="aviso">Nenhum empréstimo em atraso. Tudo em dia!</div>`;

    // tabela de quem ta atrasado com telefone e endereco pra cobrar
    const tabelaAtrasados = r.atrasados.length
      ? `<table><thead><tr><th>Leitor</th><th>Telefone</th><th>Endereço</th><th>Livro</th><th>Prazo era</th><th>Atraso</th><th>Ação</th></tr></thead><tbody>
          ${r.atrasados
            .map(
              (e) => `<tr class="atrasado"><td>${Util.escapar(e.usuario_nome)}</td><td>${Util.escapar(Util.telefoneBR(e.telefone))}<br>${Util.escapar(e.email)}</td>
                <td>${Util.escapar(e.endereco)}</td><td>${Util.escapar(e.titulo)}</td><td>${Util.dataBR(e.data_prevista)}</td>
                <td>${e.dias_atraso} dia(s)</td><td><button data-acao="devolver" data-id="${e.id}">Registrar devolução</button></td></tr>`,
            )
            .join("")}</tbody></table>`
      : "";

    // tabela do que vence nos proximos dias
    const tabelaVencendo = r.vencendo.length
      ? `<h3>Vencem nos próximos dias</h3><table><thead><tr><th>Leitor</th><th>Telefone</th><th>Livro</th><th>Prazo</th></tr></thead><tbody>
          ${r.vencendo.map((e) => `<tr><td>${Util.escapar(e.usuario_nome)}</td><td>${Util.escapar(Util.telefoneBR(e.telefone))}</td><td>${Util.escapar(e.titulo)}</td><td>${Util.dataBR(e.data_prevista)}</td></tr>`).join("")}</tbody></table>`
      : "";

    // tabela das reservas esperando alguem buscar
    const tabelaReservas = r.reservas_para_retirar.length
      ? `<h3>Reservas esperando retirada</h3><table><thead><tr><th>Livro</th><th>Leitor</th><th>Retirar até</th></tr></thead><tbody>
          ${r.reservas_para_retirar.map((x) => `<tr><td>${Util.escapar(x.titulo)}</td><td>${Util.escapar(x.usuario_nome)}</td><td>${Util.dataBR(x.data_limite)}</td></tr>`).join("")}</tbody></table>`
      : "";

    // junta tudo na tela
    this.raiz.innerHTML = `
      <h2>Início</h2>
      ${alerta}
      <div class="cartoes">
        <div class="cartao"><strong>${r.total_livros}</strong>livros no acervo</div>
        <div class="cartao"><strong>${r.livros_emprestados}</strong>livros emprestados</div>
        <div class="cartao"><strong>${r.total_usuarios}</strong>leitores cadastrados</div>
      </div>
      ${r.atrasados.length ? "<h3>Atrasados: cobrar devolução</h3>" : ""}
      ${tabelaAtrasados}
      ${tabelaVencendo}
      ${tabelaReservas}
      <div class="barra"><button data-acao="avisos">Verificar e enviar avisos por e-mail agora</button></div>
      ${r.email_configurado ? "" : `<div class="aviso">E-mail não configurado (arquivo .env): os avisos são apenas SIMULADOS no console.</div>`}`;
  }

  // botao de devolver e botao de mandar os avisos agora
  protected async aoClicar(acao: string, id: number | null): Promise<void> {
    if (acao === "devolver") {
      if (await Util.confirmar("Registrar a devolução deste livro?")) {
        await Servidor.chamar("emprestimo:devolver", { id });
        this.sucesso("Devolução registrada.");
        await Aplicacao.atual.atualizarAviso();
        await this.abrir();
      }
    } else if (acao === "avisos") {
      // roda os avisos e mostra quantos foram
      const r = await Servidor.chamar<ResultadoNotificacao>("notificacao:processar");
      const partes = [`${r.vencimentos_avisados} aviso(s) de prazo`, `${r.reservas_avisadas} aviso(s) de reserva`, `${r.reservas_expiradas} reserva(s) expirada(s)`];
      const extra = r.simulados ? " (e-mails simulados)" : "";
      Util.mensagem(`Verificação concluída: ${partes.join(", ")}${extra}.${r.falhas ? ` ${r.falhas} falha(s) ao enviar.` : ""}`, r.falhas > 0);
      await this.abrir();
    }
  }
}
