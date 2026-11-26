// tela de editoras usando o crud pronto
class TelaEditoras extends TelaCrud {
  protected titulo = "Editoras";
  protected nomeSingular = "editora";
  protected canal = "editora";
  // campos do formulario
  protected campos: CampoCrud[] = [
    { nome: "nome", rotulo: "Nome", obrigatorio: true, maximo: 120 },
    { nome: "cidade", rotulo: "Cidade", maximo: 80 },
  ];
  // colunas da tabela
  protected colunas: ColunaCrud[] = [
    { titulo: "Nome", valor: (e) => e.nome },
    { titulo: "Cidade", valor: (e) => e.cidade ?? "" },
  ];
}
