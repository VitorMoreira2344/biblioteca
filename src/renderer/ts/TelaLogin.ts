// tela de login
class TelaLogin extends TelaBase {
  // se ja tem admin mostra o login e se nao tem pede pra criar o primeiro
  async abrir(): Promise<void> {
    const existeAdmin = await Servidor.chamar<boolean>("acesso:existeAdmin");
    if (existeAdmin) this.mostrarLogin();
    else this.mostrarPrimeiroAcesso();
  }

  // formulario de login normal
  private mostrarLogin(): void {
    this.raiz.innerHTML = `
      <form id="formLogin">
        <div class="campo"><label for="login">Login</label><input id="login" name="login" maxlength="50" required autofocus></div>
        <div class="campo"><label for="senha">Senha</label><input id="senha" name="senha" type="password" maxlength="100" required></div>
        <button class="principal" type="submit">Entrar</button>
      </form>`;
  }

  // formulario do primeiro acesso pra criar o admin
  private mostrarPrimeiroAcesso(): void {
    this.raiz.innerHTML = `
      <div class="aviso">Primeiro acesso: crie o usuário administrador do sistema.</div>
      <form id="formPrimeiroAdmin">
        <div class="campo"><label for="nome">Seu nome</label><input id="nome" name="nome" maxlength="100" required autofocus></div>
        <div class="campo"><label for="login">Login</label><input id="login" name="login" maxlength="50" required></div>
        <div class="campo"><label for="senha">Senha</label><input id="senha" name="senha" type="password" maxlength="100" required>
          <div class="ajuda">Mínimo 8 caracteres, com letras e números.</div></div>
        <div class="campo"><label for="confirmar">Repita a senha</label><input id="confirmar" name="confirmar" type="password" maxlength="100" required></div>
        <button class="principal" type="submit">Criar administrador</button>
      </form>`;
  }

  // cria o admin se for o caso e ja faz o login e vai pro app
  protected async aoEnviar(idDoForm: string, form: HTMLFormElement): Promise<void> {
    const dados = Util.dadosDoFormulario(form);
    if (idDoForm === "formPrimeiroAdmin") {
      if (dados.senha !== dados.confirmar) throw new Error("As senhas não são iguais.");
      await Servidor.chamar("acesso:criarPrimeiroAdmin", dados);
    }
    await Servidor.chamar("acesso:entrar", { login: dados.login, senha: dados.senha });
    window.location.href = "app.html";
  }
}

// abre a tela de login quando a pagina carrega
new TelaLogin(Util.porId("areaLogin")).abrir().catch((erro) => Util.mensagem(erro.message, true));
