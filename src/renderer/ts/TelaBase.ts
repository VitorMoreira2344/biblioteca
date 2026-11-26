// base de todas as telas
abstract class TelaBase {
  // escuta os cliques envios e digitacao da tela e manda pros metodos certos
  constructor(protected raiz: HTMLElement) {
    // clique em qualquer coisa com data-acao
    raiz.addEventListener("click", (evento) => {
      const alvo = (evento.target as HTMLElement).closest<HTMLElement>("[data-acao]");
      if (alvo && raiz.contains(alvo)) {
        const id = alvo.dataset.id ? Number(alvo.dataset.id) : null;
        this.proteger(() => this.aoClicar(alvo.dataset.acao!, id, alvo));
      }
    });
    // envio de formulario sem recarregar a pagina
    raiz.addEventListener("submit", (evento) => {
      evento.preventDefault();
      const form = evento.target as HTMLFormElement;
      this.proteger(() => this.aoEnviar(form.id, form));
    });
    // digitou ou mudou algum campo
    raiz.addEventListener("input", (evento) => this.aoDigitar(evento.target as HTMLInputElement));
    raiz.addEventListener("change", (evento) => this.aoDigitar(evento.target as HTMLInputElement));
  }

  // cada tela desenha a si mesma aqui
  abstract abrir(): Promise<void>;

  // cada tela faz o que quiser com esses eventos
  protected async aoClicar(acao: string, id: number | null, elemento: HTMLElement): Promise<void> {}

  protected async aoEnviar(idDoForm: string, form: HTMLFormElement): Promise<void> {}

  protected aoDigitar(campo: HTMLInputElement): void {}

  // roda a acao e se der erro mostra a mensagem em vez de quebrar
  protected async proteger(acao: () => Promise<void> | void): Promise<void> {
    try {
      await acao();
    } catch (erro) {
      Util.mensagem((erro as Error).message, true);
    }
  }

  // mostra mensagem de sucesso
  protected sucesso(texto: string): void {
    Util.mensagem(texto);
  }
}
