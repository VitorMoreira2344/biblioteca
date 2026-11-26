import { Banco } from "../banco/Banco";
import { Validador } from "../util/Validador";
import { ErroNegocio } from "../util/ErroNegocio";
import { Seguranca } from "../seguranca/Seguranca";
import { Sessao } from "../seguranca/Sessao";
import { Configuracao } from "../config/Configuracao";

// login e crud de quem trabalha na biblioteca
export class ServicoAcesso {
  // conta as senhas erradas de cada login e um hash falso pra quando o login nem existe
  private static falhas = new Map<string, { quantidade: number; bloqueadoAte: number }>();
  private static hashFalso: string | null = null;

  // ja tem algum admin cadastrado
  static async existeAdministrador(): Promise<boolean> {
    const linhas = await Banco.consultar<{ total: number }>("SELECT COUNT(*) AS total FROM usuario_sistema WHERE perfil = 'administrador'");
    return Number(linhas[0].total) > 0;
  }

  // confere nome login e perfil
  private static validarBasico(dados: any) {
    const login = Validador.texto(dados?.login, "Login", 50)!.toLowerCase();
    if (!/^[a-z0-9._-]{3,50}$/.test(login)) {
      throw new ErroNegocio("Login deve ter de 3 a 50 caracteres: letras, números, ponto, hífen ou sublinhado.");
    }
    const perfil = dados?.perfil === "administrador" ? "administrador" : "bibliotecario";
    return { nome: Validador.texto(dados?.nome, "Nome", 100)!, login, perfil: perfil as PerfilAcesso };
  }

  // cria o primeiro admin e so funciona se ainda nao tiver nenhum
  static async criarPrimeiroAdministrador(dados: any): Promise<void> {
    if (await ServicoAcesso.existeAdministrador()) {
      throw new ErroNegocio("Já existe um administrador cadastrado.");
    }
    const basico = ServicoAcesso.validarBasico({ ...dados, perfil: "administrador" });
    const senhaHash = await Seguranca.gerarHashSenha(Validador.senha(dados?.senha));
    await Banco.executar("INSERT INTO usuario_sistema (nome, login, senha_hash, perfil) VALUES (?, ?, ?, 'administrador')", [
      basico.nome,
      basico.login,
      senhaHash,
    ]);
  }

  // faz o login
  static async entrar(dados: any): Promise<{ nome: string; perfil: PerfilAcesso }> {
    const login = String(dados?.login ?? "").trim().toLowerCase();
    const senha = String(dados?.senha ?? "");
    const erroGenerico = new ErroNegocio("Login ou senha inválidos.");

    // se o login ta bloqueado por errar demais ja barra aqui
    const falha = ServicoAcesso.falhas.get(login);
    if (falha && falha.bloqueadoAte > Date.now()) {
      const minutos = Math.ceil((falha.bloqueadoAte - Date.now()) / 60000);
      throw new ErroNegocio(`Muitas tentativas erradas. Tente novamente em ${minutos} minuto(s).`);
    }

    // busca o usuario ativo com esse login
    const linhas = await Banco.consultar<any>("SELECT id, nome, login, senha_hash, perfil FROM usuario_sistema WHERE login = ? AND ativo = 1", [login]);
    const usuario = linhas[0];

    // confere a senha mesmo se o login nao existir pra demorar igual e ninguem descobrir quais logins existem
    if (!ServicoAcesso.hashFalso) ServicoAcesso.hashFalso = await Seguranca.gerarHashSenha("senha-falsa-123");
    const confere = await Seguranca.conferirSenha(senha, usuario ? usuario.senha_hash : ServicoAcesso.hashFalso);

    // errou entao conta mais uma e bloqueia se chegou no limite
    if (!usuario || !confere) {
      const novo = { quantidade: (falha?.quantidade ?? 0) + 1, bloqueadoAte: 0 };
      if (novo.quantidade >= Configuracao.MAX_TENTATIVAS_LOGIN) {
        novo.bloqueadoAte = Date.now() + Configuracao.BLOQUEIO_LOGIN_MINUTOS * 60000;
        novo.quantidade = 0;
      }
      ServicoAcesso.falhas.set(login, novo);
      throw erroGenerico;
    }

    // acertou entao zera os erros e guarda quem entrou
    ServicoAcesso.falhas.delete(login);
    Sessao.iniciar({ id: usuario.id, nome: usuario.nome, login: usuario.login, perfil: usuario.perfil });
    return { nome: usuario.nome, perfil: usuario.perfil };
  }

  // faz logout
  static sair(): void {
    Sessao.encerrar();
  }

  // lista os usuarios do sistema sem a senha
  static async listar(): Promise<UsuarioSistema[]> {
    return Banco.consultar<UsuarioSistema>("SELECT id, nome, login, perfil, ativo FROM usuario_sistema ORDER BY nome");
  }

  // nao deixa repetir login
  private static async garantirLoginUnico(login: string, idIgnorado: number): Promise<void> {
    const repetidos = await Banco.consultar("SELECT id FROM usuario_sistema WHERE login = ? AND id <> ?", [login, idIgnorado]);
    if (repetidos.length) throw new ErroNegocio("Este login já está em uso.");
  }

  // cria um usuario do sistema com a senha em hash
  static async criar(dados: any): Promise<{ id: number }> {
    const basico = ServicoAcesso.validarBasico(dados);
    await ServicoAcesso.garantirLoginUnico(basico.login, 0);
    const senhaHash = await Seguranca.gerarHashSenha(Validador.senha(dados?.senha));
    const ativo = dados?.ativo === "0" || dados?.ativo === 0 ? 0 : 1;
    const resultado = await Banco.executar(
      "INSERT INTO usuario_sistema (nome, login, senha_hash, perfil, ativo) VALUES (?, ?, ?, ?, ?)",
      [basico.nome, basico.login, senhaHash, basico.perfil, ativo],
    );
    return { id: resultado.insertId };
  }

  // garante que vai sobrar pelo menos um admin ativo
  private static async garantirOutroAdministrador(idIgnorado: number): Promise<void> {
    const outros = await Banco.consultar<{ total: number }>(
      "SELECT COUNT(*) AS total FROM usuario_sistema WHERE perfil = 'administrador' AND ativo = 1 AND id <> ?",
      [idIgnorado],
    );
    if (Number(outros[0].total) === 0) {
      throw new ErroNegocio("O sistema precisa ter pelo menos um administrador ativo.");
    }
  }

  // edita um usuario e a senha so muda se mandarem uma nova
  static async atualizar(dados: any): Promise<void> {
    const id = Validador.inteiro(dados?.id, "Usuário do sistema");
    const basico = ServicoAcesso.validarBasico(dados);
    const ativo = dados?.ativo === "0" || dados?.ativo === 0 ? 0 : 1;
    await ServicoAcesso.garantirLoginUnico(basico.login, id);

    // se essa edicao tira o ultimo admin barra
    const atual = await Banco.consultar<any>("SELECT perfil, ativo FROM usuario_sistema WHERE id = ?", [id]);
    if (!atual.length) throw new ErroNegocio("Usuário não encontrado.");
    const perdeAdmin = atual[0].perfil === "administrador" && atual[0].ativo === 1 && (basico.perfil !== "administrador" || ativo === 0);
    if (perdeAdmin) await ServicoAcesso.garantirOutroAdministrador(id);

    if (dados?.senha) {
      const senhaHash = await Seguranca.gerarHashSenha(Validador.senha(dados.senha));
      await Banco.executar("UPDATE usuario_sistema SET nome = ?, login = ?, perfil = ?, ativo = ?, senha_hash = ? WHERE id = ?", [basico.nome, basico.login, basico.perfil, ativo, senhaHash, id]);
    } else {
      await Banco.executar("UPDATE usuario_sistema SET nome = ?, login = ?, perfil = ?, ativo = ? WHERE id = ?", [basico.nome, basico.login, basico.perfil, ativo, id]);
    }
  }

  // apaga um usuario mas nao deixa apagar a si mesmo nem o ultimo admin
  static async excluir(idBruto: unknown): Promise<void> {
    const id = Validador.inteiro(idBruto, "Usuário do sistema");
    if (Sessao.obter()?.id === id) throw new ErroNegocio("Você não pode excluir o próprio usuário.");
    const atual = await Banco.consultar<any>("SELECT perfil, ativo FROM usuario_sistema WHERE id = ?", [id]);
    if (!atual.length) throw new ErroNegocio("Usuário não encontrado.");
    if (atual[0].perfil === "administrador" && atual[0].ativo === 1) await ServicoAcesso.garantirOutroAdministrador(id);
    await Banco.executar("DELETE FROM usuario_sistema WHERE id = ?", [id]);
  }
}
