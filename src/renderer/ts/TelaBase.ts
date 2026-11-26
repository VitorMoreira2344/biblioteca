// Classe-mãe de todas as telas. Ela "escuta" cliques, envios de formulário e digitação
// em UMA só área (raiz) e repassa para os métodos da tela. Assim não precisamos de
// onclick="" dentro do HTML (que a política de segurança CSP bloqueia).
//   - Qualquer elemento com data-acao="nome" dispara aoClicar("nome", id, elemento)
//   - Todo <form> dispara aoEnviar(idDoForm, form)
abstract class TelaBase {
  constructor(protected raiz: HTMLElement) {
    raiz.addEventListener("click", (evento) => {
      const alvo = (evento.target as HTMLElement).closest<HTMLElement>("[data-acao]");
      if (alvo && raiz.contains(alvo)) {
        const id = alvo.dataset.id ? Number(alvo.dataset.id) : null;
        this.proteger(() => this.aoClicar(alvo.dataset.acao!, id, alvo));
      }
    });
    raiz.addEventListener("submit", (evento) => {
      evento.preventDefault(); // não deixa a página recarregar
      const form = evento.target as HTMLFormElement;
      this.proteger(() => this.aoEnviar(form.id, form));
    });
    raiz.addEventListener("input", (evento) => this.aoDigitar(evento.target as HTMLInputElement));
    raiz.addEventListener("change", (evento) => this.aoDigitar(evento.target as HTMLInputElement));
  }

  // Desenha a tela (cada tela implementa o seu).
  abstract abrir(): Promise<void>;

  // Chamado quando clicam em algo com data-acao.
  protected async aoClicar(acao: string, id: number | null, elemento: HTMLElement): Promise<void> {}

  // Chamado quando um formulário é enviado.
  protected async aoEnviar(idDoForm: string, form: HTMLFormElement): Promise<void> {}

  // Chamado quando o usuário digita ou muda um campo.
  protected aoDigitar(campo: HTMLInputElement): void {}

  // Executa uma ação e, se der erro, mostra a mensagem em vez de quebrar a tela.
  protected async proteger(acao: () => Promise<void> | void): Promise<void> {
    try {
      await acao();
    } catch (erro) {
      Util.mensagem((erro as Error).message, true);
    }
  }

  // Mostra mensagem de sucesso.
  protected sucesso(texto: string): void {
    Util.mensagem(texto);
  }
}
