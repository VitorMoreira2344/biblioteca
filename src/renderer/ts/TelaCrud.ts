// Descreve um campo do formulário.
interface CampoCrud {
  nome: string; // nome da coluna/propriedade
  rotulo: string; // texto mostrado ao usuário
  tipo?: "text" | "email" | "password" | "select";
  obrigatorio?: boolean;
  maximo?: number;
  opcoes?: { valor: string; texto: string }[]; // para tipo "select"
  ajuda?: string;
}

// Descreve uma coluna da tabela de listagem.
interface ColunaCrud {
  titulo: string;
  valor: (linha: any) => string; // devolve texto puro (a tela escapa)
}

// Tela de CRUD genérica (lista + formulário). Autores, Editoras e Usuários do sistema
// só precisam informar os campos e colunas; todo o resto é herdado daqui.
abstract class TelaCrud extends TelaBase {
  protected abstract titulo: string; // "Autores"
  protected abstract nomeSingular: string; // "autor"
  protected abstract canal: string; // prefixo dos canais: "autor" -> "autor:listar", "autor:criar"...
  protected abstract campos: CampoCrud[];
  protected abstract colunas: ColunaCrud[];
  protected registros: any[] = [];

  constructor(raiz: HTMLElement, protected ehAdmin: boolean) {
    super(raiz);
  }

  // Ao abrir a tela, mostra a lista.
  async abrir(): Promise<void> {
    await this.mostrarLista();
  }

  // Busca os registros e desenha a tabela.
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

  // Desenha o formulário (vazio para cadastrar, preenchido para editar).
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
          const conteudo = tipo === "password" ? "" : Util.escapar(valor); // nunca preenche senha
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

  // Cliques nos botões da lista e do formulário.
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

  // Salvar: se o formulário tem "id" é edição (UPDATE), senão é cadastro (CREATE).
  protected async aoEnviar(_idDoForm: string, form: HTMLFormElement): Promise<void> {
    const dados = Util.dadosDoFormulario(form);
    if (dados.id) await Servidor.chamar(`${this.canal}:atualizar`, dados);
    else await Servidor.chamar(`${this.canal}:criar`, dados);
    this.sucesso("Salvo com sucesso.");
    await this.mostrarLista();
  }
}
