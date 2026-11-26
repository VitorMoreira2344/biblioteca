// Tela dos leitores (usuários da biblioteca): CPF, contato e endereço com busca de CEP.
class TelaUsuarios extends TelaBase {
  private usuarios: Usuario[] = [];
  private ultimoCepConsultado = "";

  constructor(raiz: HTMLElement, private ehAdmin: boolean) {
    super(raiz);
  }

  // Ao abrir, mostra a lista.
  async abrir(): Promise<void> {
    await this.mostrarLista();
  }

  // Busca os leitores e desenha a tabela.
  private async mostrarLista(): Promise<void> {
    this.usuarios = await Servidor.chamar<Usuario[]>("usuario:listar");
    this.raiz.innerHTML = `
      <h2>Leitores</h2>
      <div class="barra">
        <button class="principal" data-acao="novo">Novo leitor</button>
        <input id="busca" placeholder="Buscar por nome ou bairro" autocomplete="off">
      </div>
      <div id="areaTabela"></div>`;
    this.desenharTabela("");
  }

  // Desenha a tabela aplicando o filtro de busca.
  private desenharTabela(filtro: string): void {
    const busca = Util.semAcento(filtro.trim());
    const lista = this.usuarios.filter((u) => !busca || Util.semAcento(`${u.nome} ${u.bairro ?? ""} ${u.cidade}`).includes(busca));
    const area = Util.porId("areaTabela");
    if (!lista.length) {
      area.innerHTML = `<div class="vazio">Nenhum leitor encontrado.</div>`;
      return;
    }
    const linhas = lista
      .map((u) => {
        const endereco = `${u.logradouro}, ${u.numero}${u.complemento ? " (" + u.complemento + ")" : ""} - ${u.bairro ?? ""}, ${u.cidade}/${u.uf}`;
        const distancia = u.distancia_km !== null && u.distancia_km !== undefined ? `${Number(u.distancia_km).toFixed(1)} km` : "-";
        const excluir = this.ehAdmin ? `<button data-acao="excluir" data-id="${u.id}">Excluir</button>` : "";
        return `<tr><td>${Util.escapar(u.nome)}</td><td>${Util.escapar(u.cpf_mascarado)}</td><td>${Util.escapar(u.email)}<br>${Util.escapar(Util.telefoneBR(u.telefone))}</td>
          <td>${Util.escapar(endereco)}</td><td>${distancia}</td>
          <td class="acoes"><button data-acao="editar" data-id="${u.id}">Editar</button> ${excluir}</td></tr>`;
      })
      .join("");
    area.innerHTML = `<table><thead><tr><th>Nome</th><th>CPF</th><th>Contato</th><th>Endereço</th><th>Distância</th><th>Ações</th></tr></thead><tbody>${linhas}</tbody></table>`;
  }

  // Digitando: filtra a busca, aplica máscaras e consulta o CEP quando completa 8 dígitos.
  protected aoDigitar(campo: HTMLInputElement): void {
    if (campo.id === "busca") this.desenharTabela(campo.value);
    else if (campo.id === "cpf") campo.value = Util.mascaraCpf(campo.value);
    else if (campo.id === "telefone") campo.value = Util.mascaraTelefone(campo.value);
    else if (campo.id === "cep") {
      campo.value = Util.mascaraCep(campo.value);
      const digitos = campo.value.replace(/\D/g, "");
      if (digitos.length === 8 && digitos !== this.ultimoCepConsultado) {
        this.ultimoCepConsultado = digitos;
        this.proteger(() => this.consultarCep());
      }
    }
  }

  // Desenha o formulário de cadastro/edição.
  private async mostrarFormulario(id: number | null): Promise<void> {
    const u = id ? await Servidor.chamar<Usuario>("usuario:obter", { id }) : null;
    const v = (valor: unknown) => Util.escapar(valor ?? "");
    this.ultimoCepConsultado = u ? u.cep : "";

    this.raiz.innerHTML = `
      <h2>${u ? "Editar" : "Novo"} leitor</h2>
      <form id="formUsuario">
        ${u ? `<input type="hidden" name="id" value="${u.id}">` : ""}
        <div class="grade">
          <div class="campo largo"><label for="nome">Nome completo</label><input id="nome" name="nome" value="${v(u?.nome)}" maxlength="100" required></div>
          <div class="campo"><label for="cpf">CPF</label><input id="cpf" name="cpf" value="${v(u?.cpf ? Util.mascaraCpf(u.cpf) : "")}" maxlength="14" required></div>
          <div class="campo"><label for="telefone">Telefone com DDD</label><input id="telefone" name="telefone" value="${v(Util.telefoneBR(u?.telefone ?? ""))}" maxlength="15"></div>
          <div class="campo largo"><label for="email">E-mail (para os avisos)</label><input id="email" name="email" type="email" value="${v(u?.email)}" maxlength="150" required></div>
          <div class="campo"><label for="cep">CEP (preenche o endereço sozinho)</label>
            <input id="cep" name="cep" value="${v(u ? Util.mascaraCep(u.cep) : "")}" maxlength="9" required></div>
          <div class="campo"><label>&nbsp;</label><button type="button" data-acao="buscarCep">Buscar CEP</button></div>
          <div class="campo largo"><div id="infoCep" class="aviso" hidden></div></div>
          <div class="campo largo"><label for="logradouro">Rua</label><input id="logradouro" name="logradouro" value="${v(u?.logradouro)}" maxlength="150" required></div>
          <div class="campo"><label for="numero">Número</label><input id="numero" name="numero" value="${v(u?.numero)}" maxlength="20" required></div>
          <div class="campo"><label for="complemento">Complemento</label><input id="complemento" name="complemento" value="${v(u?.complemento)}" maxlength="80"></div>
          <div class="campo"><label for="bairro">Bairro</label><input id="bairro" name="bairro" value="${v(u?.bairro)}" maxlength="80"></div>
          <div class="campo"><label for="cidade">Cidade</label><input id="cidade" name="cidade" value="${v(u?.cidade)}" maxlength="80" required></div>
          <div class="campo"><label for="uf">UF</label><input id="uf" name="uf" value="${v(u?.uf)}" maxlength="2" required></div>
        </div>
        <div class="botoes"><button class="principal" type="submit">Salvar</button><button type="button" data-acao="cancelar">Cancelar</button></div>
      </form>`;
  }

  // Consulta o CEP (API ViaCEP) e diz se o leitor mora perto da biblioteca.
  private async consultarCep(): Promise<void> {
    const cep = Util.porId<HTMLInputElement>("cep").value;
    const info = Util.porId("infoCep");
    info.hidden = false;
    info.textContent = "Consultando CEP...";
    const r = await Servidor.chamar<ResultadoCep>("usuario:consultarCep", { cep });
    if (r.status === "ok" && r.endereco) {
      const preencher = (id: string, valor: string) => {
        if (valor) Util.porId<HTMLInputElement>(id).value = valor;
      };
      preencher("logradouro", r.endereco.logradouro);
      preencher("bairro", r.endereco.bairro);
      preencher("cidade", r.endereco.cidade);
      preencher("uf", r.endereco.uf);
      info.textContent = `CEP encontrado. ${r.aviso ?? ""}`;
      if (!r.endereco.logradouro) info.textContent += " Este CEP não tem rua: digite o nome da rua.";
    } else {
      info.textContent = r.aviso ?? "Não foi possível consultar o CEP.";
    }
  }

  // Cliques da tela.
  protected async aoClicar(acao: string, id: number | null): Promise<void> {
    if (acao === "novo") await this.mostrarFormulario(null);
    else if (acao === "editar") await this.mostrarFormulario(id);
    else if (acao === "cancelar") await this.mostrarLista();
    else if (acao === "buscarCep") await this.consultarCep();
    else if (acao === "excluir") {
      if (await Util.confirmar("Excluir este leitor? Essa ação não pode ser desfeita.")) {
        await Servidor.chamar("usuario:excluir", { id });
        this.sucesso("Leitor excluído.");
        await this.mostrarLista();
      }
    }
  }

  // Salvar o formulário (cadastro ou edição).
  protected async aoEnviar(_idDoForm: string, form: HTMLFormElement): Promise<void> {
    const dados = Util.dadosDoFormulario(form);
    if (dados.id) await Servidor.chamar("usuario:atualizar", dados);
    else await Servidor.chamar("usuario:criar", dados);
    this.sucesso("Leitor salvo.");
    await this.mostrarLista();
  }
}
