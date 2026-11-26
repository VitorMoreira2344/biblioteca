// como e um campo do formulario
interface CampoCrud {
  nome: string;
  rotulo: string;
  tipo?: "text" | "email" | "password" | "select";
  obrigatorio?: boolean;
  maximo?: number;
  opcoes?: { valor: string; texto: string }[];
  ajuda?: string;
}

// como e uma coluna da tabela
interface ColunaCrud {
  titulo: string;
  valor: (linha: any) => string;
}

// tela pronta de listar criar editar e excluir que as telas simples usam
abstract class TelaCrud extends TelaBase {
  // cada tela filha preenche essas coisas
  protected abstract titulo: string;
  protected abstract nomeSingular: string;
  protected abstract canal: string;
  protected abstract campos: CampoCrud[];
  protected abstract colunas: ColunaCrud[];
  protected registros: any[] = [];

  constructor(raiz: HTMLElement, protected ehAdmin: boolean) {
    super(raiz);
  }

  // abre mostrando a lista
  async abrir(): Promise<void> {
    await this.mostrarLista();
  }

  // busca os registros e monta a tabela e o botao excluir so aparece pro admin
  protected async mostrarLista(): Promise<void> {
    this.registros = await Servidor.chamar<any[]>(`${this.canal}:listar`);
    const cabecalho = this.colunas.map((c) => `<th>${Util.escapar(c.titulo)}</th>`).join("");
    const linhas = this.registros
      .map((linha) => {
        const celulas = this.colunas.map((c) => `<td>${Util.escapar(c.valor(linha))}</td>`).join("");
        const excluir = this.ehAdmin ? `<button data-acao="excluir" data-id="${linha.id}">Excluir</button>` : "";
        return `<tr>${celulas}<td class="acoes"><button data-acao="editar" data-id="${linha.id}">Editar</button> ${excluir}</td></tr>`;
      })
      .join("");

    this.raiz.innerHTML = `
      <h2>${Util.escapar(this.titulo)}</h2>
      <div class="barra"><button class="principal" data-acao="novo">Novo ${Util.escapar(this.nomeSingular)}</button></div>
      ${this.registros.length ? `<table><thead><tr>${cabecalho}<th>Ações</th></tr></thead><tbody>${linhas}</tbody></table>` : `<div class="vazio">Nenhum registro cadastrado.</div>`}`;
  }

  // monta o formulario vazio pra novo ou preenchido pra editar
  protected mostrarFormulario(registro: any | null): void {
    const campos = this.campos
      .map((c) => {
        const valor = registro ? registro[c.nome] ?? "" : "";
        const id = `campo_${c.nome}`;
        const obrigatorio = c.obrigatorio && !(c.tipo === "password" && registro) ? "required" : "";
        let entrada: string;
        if (c.tipo === "select") {
          entrada = `<select id="${id}" name="${c.nome}">${Util.opcoes(c.opcoes ?? [], valor)}</select>`;
        } else {
          const tipo = c.tipo ?? "text";
          // senha nunca vem preenchida
          const conteudo = tipo === "password" ? "" : Util.escapar(valor);
          entrada = `<input id="${id}" name="${c.nome}" type="${tipo}" value="${conteudo}" maxlength="${c.maximo ?? 100}" ${obrigatorio}>`;
        }
        const ajuda = c.ajuda ? `<div class="ajuda">${Util.escapar(c.ajuda)}</div>` : "";
        return `<div class="campo"><label for="${id}">${Util.escapar(c.rotulo)}</label>${entrada}${ajuda}</div>`;
      })
      .join("");

    this.raiz.innerHTML = `
      <h2>${registro ? "Editar" : "Novo"} ${Util.escapar(this.nomeSingular)}</h2>
      <form id="formCrud" class="form-estreito">
        ${registro ? `<input type="hidden" name="id" value="${registro.id}">` : ""}
        ${campos}
        <div class="botoes"><button class="principal" type="submit">Salvar</button><button type="button" data-acao="cancelar">Cancelar</button></div>
      </form>`;
  }

  // trata os botoes novo cancelar editar e excluir
  protected async aoClicar(acao: string, id: number | null): Promise<void> {
    if (acao === "novo") this.mostrarFormulario(null);
    else if (acao === "cancelar") await this.mostrarLista();
    else if (acao === "editar") this.mostrarFormulario(this.registros.find((r) => r.id === id) ?? null);
    else if (acao === "excluir") {
      if (await Util.confirmar(`Excluir este ${this.nomeSingular}? Essa ação não pode ser desfeita.`)) {
        await Servidor.chamar(`${this.canal}:excluir`, { id });
        this.sucesso(`${this.nomeSingular} excluído.`);
        await this.mostrarLista();
      }
    }
  }

  // salva e decide se e criar ou atualizar pelo id
  protected async aoEnviar(_idDoForm: string, form: HTMLFormElement): Promise<void> {
    const dados = Util.dadosDoFormulario(form);
    if (dados.id) await Servidor.chamar(`${this.canal}:atualizar`, dados);
    else await Servidor.chamar(`${this.canal}:criar`, dados);
    this.sucesso("Salvo com sucesso.");
    await this.mostrarLista();
  }
}
