// Funções de apoio usadas por todas as telas.
class Util {
  // Troca <, >, &, aspas por códigos seguros. TODO texto vindo do banco ou de APIs
  // passa por aqui antes de entrar no HTML (isso impede ataques XSS).
  static escapar(valor: unknown): string {
    const trocas: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return String(valor ?? "").replace(/[&<>"']/g, (c) => trocas[c]);
  }

  // "2026-11-26" -> "26/11/2026".
  static dataBR(iso: string | null | undefined): string {
    if (!iso) return "";
    const [ano, mes, dia] = iso.split("-");
    return `${dia}/${mes}/${ano}`;
  }

  // Procura um elemento da página pelo id (dá erro claro se não existir).
  static porId<T extends HTMLElement = HTMLElement>(id: string): T {
    const elemento = document.getElementById(id);
    if (!elemento) throw new Error(`Elemento #${id} não encontrado na página.`);
    return elemento as T;
  }

  // Mostra uma mensagem rápida no canto da tela (preta = erro).
  static mensagem(texto: string, erro = false): void {
    const caixa = Util.porId("mensagem");
    caixa.textContent = texto;
    caixa.className = `mensagem visivel${erro ? " erro" : ""}`;
    window.clearTimeout((Util as any).temporizador);
    (Util as any).temporizador = window.setTimeout(() => (caixa.className = "mensagem"), erro ? 7000 : 4000);
  }

  // Pergunta "Tem certeza?" e devolve true (Sim) ou false (Não).
  static confirmar(texto: string): Promise<boolean> {
    return new Promise((resolve) => {
      const fundo = document.createElement("div");
      fundo.className = "fundo-confirmacao";
      fundo.innerHTML = `<div class="caixa-confirmacao"><p>${Util.escapar(texto)}</p>
        <button class="principal" data-resposta="sim">Sim</button><button data-resposta="nao" id="btnNao">Não</button></div>`;
      fundo.addEventListener("click", (e) => {
        const resposta = (e.target as HTMLElement).dataset.resposta;
        if (resposta) {
          fundo.remove();
          resolve(resposta === "sim");
        }
      });
      document.body.appendChild(fundo);
      (document.getElementById("btnNao") as HTMLElement).focus(); // o foco começa no "Não", por segurança
    });
  }

  // Lê todos os campos de um formulário e devolve um objeto { nome: valor }.
  static dadosDoFormulario(form: HTMLFormElement): Record<string, any> {
    return Object.fromEntries(new FormData(form));
  }

  // Monta as <option> de um <select>.
  static opcoes(lista: { valor: string | number; texto: string }[], selecionado: unknown = null, vazio: string | null = null): string {
    const inicio = vazio !== null ? `<option value="">${Util.escapar(vazio)}</option>` : "";
    return (
      inicio +
      lista
        .map((o) => `<option value="${Util.escapar(o.valor)}"${String(o.valor) === String(selecionado) ? " selected" : ""}>${Util.escapar(o.texto)}</option>`)
        .join("")
    );
  }

  // Tira acentos e deixa minúsculo (para a busca ignorar maiúsculas e acentos).
  static semAcento(texto: string): string {
    return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  }

  // "19999998888" -> "(19) 99999-8888".
  static telefoneBR(digitos: string | null): string {
    const d = (digitos ?? "").replace(/\D/g, "");
    if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
    if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return d;
  }

  // Máscara de CPF enquanto digita: 123.456.789-09.
  static mascaraCpf(valor: string): string {
    const d = valor.replace(/\D/g, "").slice(0, 11);
    return d.replace(/^(\d{3})(\d)/, "$1.$2").replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d)/, ".$1-$2");
  }

  // Máscara de CEP enquanto digita: 13010-111.
  static mascaraCep(valor: string): string {
    const d = valor.replace(/\D/g, "").slice(0, 8);
    return d.replace(/^(\d{5})(\d)/, "$1-$2");
  }

  // Máscara de telefone enquanto digita.
  static mascaraTelefone(valor: string): string {
    return Util.telefoneBR(valor.replace(/\D/g, "").slice(0, 11)) || valor.replace(/\D/g, "");
  }
}
