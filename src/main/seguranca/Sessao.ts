// dados de quem ta logado agora
export interface UsuarioLogado {
  id: number;
  nome: string;
  login: string;
  perfil: PerfilAcesso;
}

// guarda na memoria quem fez login
export class Sessao {
  private static atual: UsuarioLogado | null = null;

  // salva o usuario quando o login da certo
  static iniciar(usuario: UsuarioLogado): void {
    Sessao.atual = usuario;
  }

  // limpa tudo quando a pessoa sai
  static encerrar(): void {
    Sessao.atual = null;
  }

  // devolve quem ta logado ou null
  static obter(): UsuarioLogado | null {
    return Sessao.atual;
  }

  // tem alguem logado
  static estaLogado(): boolean {
    return Sessao.atual !== null;
  }

  // o usuario logado e administrador
  static ehAdmin(): boolean {
    return Sessao.atual?.perfil === "administrador";
  }
}
