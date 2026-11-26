// tela de autores usando o crud pronto
class TelaAutores extends TelaCrud {
  protected titulo = "Autores";
  protected nomeSingular = "autor";
  protected canal = "autor";
  // campos do formulario
  protected campos: CampoCrud[] = [
    { nome: "nome", rotulo: "Nome", obrigatorio: true, maximo: 120 },
    { nome: "nacionalidade", rotulo: "Nacionalidade", maximo: 60 },
  ];
  // colunas da tabela
  protected colunas: ColunaCrud[] = [
    { titulo: "Nome", valor: (a) => a.nome },
    { titulo: "Nacionalidade", valor: (a) => a.nacionalidade ?? "" },
  ];
}
