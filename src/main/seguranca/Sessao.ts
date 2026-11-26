// Guarda QUEM está logado. Fica só na memória do processo principal, então
// a tela (renderer) não consegue "fingir" que é administrador.
export interface UsuarioLogado {
  id: number;
  nome: string;
  login: string;
  perfil: PerfilAcesso;
}

export class Sessao {
  private static atual: UsuarioLogado | null = null;

  // Registra o usuário que acabou de entrar.
  static iniciar(usuario: UsuarioLogado): void {
    Sessao.atual = usuario;
  }

  // Apaga a sessão (logout).
  static encerrar(): void {
    Sessao.atual = null;
  }

  // Devolve o usuário logado (ou null).
  static obter(): UsuarioLogado | null {
    return Sessao.atual;
  }

  // Tem alguém logado?
  static estaLogado(): boolean {
    return Sessao.atual !== null;
  }

  // O usuário logado é administrador?
  static ehAdmin(): boolean {
    return Sessao.atual?.perfil === "administrador";
  }
}
