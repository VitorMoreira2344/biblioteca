// tela dos usuarios do sistema e so o admin ve
class TelaUsuariosSistema extends TelaCrud {
  protected titulo = "Usuários do sistema";
  protected nomeSingular = "usuário do sistema";
  protected canal = "usuarioSistema";
  // campos do formulario
  protected campos: CampoCrud[] = [
    { nome: "nome", rotulo: "Nome", obrigatorio: true, maximo: 100 },
    { nome: "login", rotulo: "Login", obrigatorio: true, maximo: 50 },
    {
      nome: "senha",
      rotulo: "Senha",
      tipo: "password",
      obrigatorio: true,
      ajuda: "Mínimo 8 caracteres, com letras e números. Ao editar, deixe em branco para manter a atual.",
    },
    {
      nome: "perfil",
      rotulo: "Perfil",
      tipo: "select",
      opcoes: [
        { valor: "bibliotecario", texto: "Bibliotecário (não exclui registros)" },
        { valor: "administrador", texto: "Administrador (acesso total)" },
      ],
    },
    {
      nome: "ativo",
      rotulo: "Situação",
      tipo: "select",
      opcoes: [
        { valor: "1", texto: "Ativo" },
        { valor: "0", texto: "Inativo (não consegue entrar)" },
      ],
    },
  ];
  // colunas da tabela
  protected colunas: ColunaCrud[] = [
    { titulo: "Nome", valor: (u) => u.nome },
    { titulo: "Login", valor: (u) => u.login },
    { titulo: "Perfil", valor: (u) => (u.perfil === "administrador" ? "Administrador" : "Bibliotecário") },
    { titulo: "Situação", valor: (u) => (u.ativo ? "Ativo" : "Inativo") },
  ];
}
