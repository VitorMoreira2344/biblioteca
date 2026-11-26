// CRUD de editoras (usa tudo da TelaCrud; só descreve os campos).
class TelaEditoras extends TelaCrud {
  protected titulo = "Editoras";
  protected nomeSingular = "editora";
  protected canal = "editora";
  protected campos: CampoCrud[] = [
    { nome: "nome", rotulo: "Nome", obrigatorio: true, maximo: 120 },
    { nome: "cidade", rotulo: "Cidade", maximo: 80 },
  ];
  protected colunas: ColunaCrud[] = [
    { titulo: "Nome", valor: (e) => e.nome },
    { titulo: "Cidade", valor: (e) => e.cidade ?? "" },
  ];
}
