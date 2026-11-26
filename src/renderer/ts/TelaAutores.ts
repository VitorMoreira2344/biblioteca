// CRUD de autores (usa tudo da TelaCrud; só descreve os campos).
class TelaAutores extends TelaCrud {
  protected titulo = "Autores";
  protected nomeSingular = "autor";
  protected canal = "autor";
  protected campos: CampoCrud[] = [
    { nome: "nome", rotulo: "Nome", obrigatorio: true, maximo: 120 },
    { nome: "nacionalidade", rotulo: "Nacionalidade", maximo: 60 },
  ];
  protected colunas: ColunaCrud[] = [
    { titulo: "Nome", valor: (a) => a.nome },
    { titulo: "Nacionalidade", valor: (a) => a.nacionalidade ?? "" },
  ];
}
