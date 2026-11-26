// Testes automáticos das regras de negócio (rodam contra um MySQL de verdade).
// As APIs externas (Open Library, ViaCEP, BrasilAPI, Nominatim) são SIMULADAS aqui.
// Como rodar:  defina DB_* e CHAVE_CRIPTOGRAFIA no .env e use  npm test
import * as path from "path";
import { Configuracao } from "../src/main/config/Configuracao";
import { Banco } from "../src/main/banco/Banco";
import { Datas } from "../src/main/util/Datas";
import { Validador } from "../src/main/util/Validador";
import { Seguranca } from "../src/main/seguranca/Seguranca";
import { Sessao } from "../src/main/seguranca/Sessao";
import { ServicoAcesso } from "../src/main/servicos/ServicoAcesso";
import { ServicoAutor } from "../src/main/servicos/ServicoAutor";
import { ServicoEditora } from "../src/main/servicos/ServicoEditora";
import { ServicoLivro } from "../src/main/servicos/ServicoLivro";
import { ServicoUsuario } from "../src/main/servicos/ServicoUsuario";
import { ServicoEmprestimo } from "../src/main/servicos/ServicoEmprestimo";
import { ServicoReserva } from "../src/main/servicos/ServicoReserva";
import { ServicoNotificacao } from "../src/main/servicos/ServicoNotificacao";
import { ServicoPainel } from "../src/main/servicos/ServicoPainel";

let total = 0;
let falhas = 0;

// Confere uma condição e imprime OK / FALHOU.
function verificar(descricao: string, condicao: boolean): void {
  total++;
  if (condicao) console.log(`  ok   ${descricao}`);
  else {
    falhas++;
    console.log(`  FALHOU  ${descricao}`);
  }
}

// Confere que a função lança um erro cuja mensagem contém o trecho.
async function esperarErro(descricao: string, funcao: () => Promise<unknown>, trecho: string): Promise<void> {
  try {
    await funcao();
    verificar(`${descricao} (deveria dar erro)`, false);
  } catch (erro) {
    const mensagem = (erro as Error).message;
    verificar(`${descricao} -> "${mensagem}"`, mensagem.includes(trecho));
  }
}

// ---------------- Simulação das APIs externas ----------------
const chamadas: string[] = [];
function simularApis(): void {
  const json = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { "content-type": "application/json" } });
  (globalThis as any).fetch = async (entrada: any): Promise<Response> => {
    const url = String(entrada);
    chamadas.push(new URL(url).hostname);

    if (url.includes("openlibrary.org")) {
      if (url.includes("9788532511010")) {
        return json({
          "ISBN:9788532511010": {
            title: "Harry Potter e a Pedra Filosofal",
            authors: [{ name: "J. K. Rowling" }],
            publishers: [{ name: "Rocco" }],
            publish_date: "June 26, 2000",
            number_of_pages: 264,
            cover: { large: "https://covers.openlibrary.org/b/id/1-L.jpg" },
          },
        });
      }
      return json({});
    }
    if (url.includes("googleapis.com/books")) {
      if (url.includes("9780306406157")) {
        return json({ items: [{ volumeInfo: { title: "Livro do Google", authors: ["Autor G"], publisher: "Editora G", publishedDate: "1999-05", pageCount: 100, imageLinks: { thumbnail: "http://books.google.com/x.jpg" } } }] });
      }
      return json({ totalItems: 0 });
    }
    if (url.includes("viacep.com.br")) {
      if (url.includes("13010000")) return json({ logradouro: "Rua Central", bairro: "Centro", localidade: "Campinas", uf: "SP" });
      if (url.includes("13010111")) return json({ logradouro: "Rua Perto", bairro: "Bairro Vizinho", localidade: "Campinas", uf: "SP" });
      if (url.includes("01001000")) return json({ logradouro: "Praça da Sé", bairro: "Sé", localidade: "São Paulo", uf: "SP" });
      return json({ erro: "true" });
    }
    if (url.includes("brasilapi.com.br/api/feriados")) {
      const ano = url.match(/v1\/(\d{4})/)![1];
      return json([{ date: `${ano}-12-25`, name: "Natal", type: "national" }, { date: `${ano}-12-26`, name: "Feriado Teste", type: "national" }]);
    }
    if (url.includes("nominatim.openstreetmap.org")) {
      const consulta = decodeURIComponent(url.split("q=")[1]);
      if (consulta.includes("Rua Central")) return json([{ lat: "-22.9000", lon: "-47.0600" }]);
      if (consulta.includes("Rua Perto")) return json([{ lat: "-22.9100", lon: "-47.0650" }]);
      if (consulta.includes("Praça da Sé")) return json([{ lat: "-23.5500", lon: "-46.6333" }]);
      return json([]);
    }
    return json({}, 404);
  };
}

// Dados base de um leitor válido.
function leitor(nome: string, cpf: string, cep = "13010111", extra: any = {}) {
  return { nome, cpf, email: `${nome.split(" ")[0].toLowerCase()}@teste.com`, telefone: "19999998888", cep, logradouro: "Rua Perto", numero: "10", bairro: "Bairro Vizinho", cidade: "Campinas", uf: "SP", ...extra };
}

async function principal(): Promise<void> {
  const raiz = path.join(__dirname, "..", "..", "..");
  Configuracao.carregar(raiz);
  // TRAVA DE SEGURANÇA: este teste APAGA e recria as tabelas. Só roda em banco com "teste" no nome.
  if (!/teste|test/i.test(Configuracao.banco.database)) {
    console.error(`\nTeste cancelado: o banco "${Configuracao.banco.database}" não parece ser de teste (este teste apaga as tabelas).\nCrie um banco com "teste" no nome (ex.: biblioteca_teste) e aponte o .env para ele.\n`);
    process.exit(1);
  }
  process.env.BIBLIOTECA_CEP = "13010000";
  process.env.RAIO_REGIAO_KM = "5";
  delete process.env.SMTP_HOST; // força o modo "e-mail simulado"
  simularApis();

  console.log("\n== Validações ==");
  verificar("CPF válido aceito", Validador.cpfValido("52998224725"));
  verificar("CPF inválido recusado", !Validador.cpfValido("52998224726"));
  verificar("CPF repetido (111...) recusado", !Validador.cpfValido("11111111111"));
  verificar("ISBN-13 válido", Validador.isbnValido("9788532511010"));
  verificar("ISBN-10 válido", Validador.isbnValido("0306406152"));
  verificar("ISBN com dígito errado recusado", !Validador.isbnValido("9788532511011"));
  verificar("Senha fraca recusada", (() => { try { Validador.senha("abc"); return false; } catch { return true; } })());
  verificar("Data 31/02 inválida", !Datas.ehValida("2026-02-31"));
  verificar("Somar dias passa de mês", Datas.somarDias("2026-01-30", 3) === "2026-02-02");
  verificar("Dias entre datas", Datas.diasEntre("2026-01-01", "2026-01-11") === 10);

  console.log("\n== Segurança ==");
  const hash = await Seguranca.gerarHashSenha("Senha1234");
  verificar("Hash não contém a senha", !hash.includes("Senha1234"));
  verificar("Senha certa confere", await Seguranca.conferirSenha("Senha1234", hash));
  verificar("Senha errada não confere", !(await Seguranca.conferirSenha("Senha12345", hash)));
  verificar("Dois hashes da mesma senha são diferentes (sal)", hash !== (await Seguranca.gerarHashSenha("Senha1234")));
  const cifrado = Seguranca.cifrar("52998224725");
  verificar("CPF cifrado não aparece em texto", !cifrado.includes("52998224725"));
  verificar("CPF decifra corretamente", Seguranca.decifrar(cifrado) === "52998224725");
  const adulterado = Buffer.from(cifrado, "base64");
  adulterado[adulterado.length - 1] ^= 1;
  verificar("Dado cifrado adulterado é detectado", (() => { try { Seguranca.decifrar(adulterado.toString("base64")); return false; } catch { return true; } })());
  verificar("CPF mascarado", Seguranca.mascararCpf("52998224725") === "***.982.247-**");

  console.log("\n== Banco e acesso ==");
  await Banco.conectar();
  await Banco.executar("DROP TABLE IF EXISTS reserva, emprestimo, livro_autor, usuario, livro, autor, editora, usuario_sistema");
  await Banco.criarTabelas(raiz);
  const tabelas = await Banco.consultar("SHOW TABLES");
  verificar(`Banco com ${tabelas.length} tabelas (mínimo 6)`, tabelas.length >= 6);
  await Banco.criarTabelas(raiz);
  verificar("Rodar criarTabelas duas vezes não dá erro", true);

  verificar("Sem administrador no começo", !(await ServicoAcesso.existeAdministrador()));
  await esperarErro("Primeiro admin com senha fraca", () => ServicoAcesso.criarPrimeiroAdministrador({ nome: "Dono", login: "dono", senha: "123" }), "senha");
  await ServicoAcesso.criarPrimeiroAdministrador({ nome: "Dono da Biblioteca", login: "Dono", senha: "Livros2026" });
  verificar("Administrador criado", await ServicoAcesso.existeAdministrador());
  await esperarErro("Segundo 'primeiro admin' é bloqueado", () => ServicoAcesso.criarPrimeiroAdministrador({ nome: "X", login: "outro", senha: "Livros2026" }), "Já existe");
  const gravado = await Banco.consultar<any>("SELECT senha_hash FROM usuario_sistema WHERE login = 'dono'");
  verificar("Senha gravada como hash (não em texto)", gravado[0].senha_hash.startsWith("scrypt:") && !gravado[0].senha_hash.includes("Livros2026"));

  await esperarErro("Login com senha errada", () => ServicoAcesso.entrar({ login: "dono", senha: "errada123" }), "Login ou senha inválidos");
  await esperarErro("Login inexistente dá a MESMA mensagem", () => ServicoAcesso.entrar({ login: "fantasma", senha: "errada123" }), "Login ou senha inválidos");
  const entrada = await ServicoAcesso.entrar({ login: "dono", senha: "Livros2026" });
  verificar("Login correto cria sessão de administrador", entrada.perfil === "administrador" && Sessao.ehAdmin());
  ServicoAcesso.sair();
  verificar("Logout limpa a sessão", !Sessao.estaLogado());
  for (let i = 0; i < 5; i++) await ServicoAcesso.entrar({ login: "brute", senha: "x" }).catch(() => undefined);
  await esperarErro("Bloqueio após 5 tentativas erradas", () => ServicoAcesso.entrar({ login: "brute", senha: "x" }), "Muitas tentativas");

  await ServicoAcesso.entrar({ login: "dono", senha: "Livros2026" });
  const biblio = await ServicoAcesso.criar({ nome: "Voluntária", login: "maria", senha: "Maria12345", perfil: "bibliotecario" });
  await ServicoAcesso.atualizar({ id: biblio.id, nome: "Maria Voluntária", login: "maria", perfil: "bibliotecario", ativo: 1 });
  verificar("Atualizar usuário do sistema", (await ServicoAcesso.listar()).some((u) => u.nome === "Maria Voluntária"));
  const dono = (await ServicoAcesso.listar()).find((u) => u.login === "dono")!;
  await esperarErro("Não pode excluir a si mesmo", () => ServicoAcesso.excluir(dono.id), "próprio usuário");
  await esperarErro("Não pode rebaixar o último admin", () => ServicoAcesso.atualizar({ id: dono.id, nome: "Dono", login: "dono", perfil: "bibliotecario", ativo: 1 }), "pelo menos um administrador");
  await ServicoAcesso.excluir(biblio.id);
  verificar("Excluir usuário do sistema", (await ServicoAcesso.listar()).length === 1);

  console.log("\n== Autores e editoras (CRUD) ==");
  const a = await ServicoAutor.criar({ nome: "Machado de Assis", nacionalidade: "Brasileira" });
  await esperarErro("Autor repetido", () => ServicoAutor.criar({ nome: "Machado de Assis" }), "Já existe");
  await ServicoAutor.atualizar({ id: a.id, nome: "Machado de Assis", nacionalidade: "Brasil" });
  verificar("Autor atualizado", (await ServicoAutor.listar())[0].nacionalidade === "Brasil");
  const e = await ServicoEditora.criar({ nome: "Editora Teste", cidade: "Campinas" });
  await ServicoEditora.atualizar({ id: e.id, nome: "Editora Teste", cidade: "São Paulo" });
  verificar("Editora atualizada", (await ServicoEditora.listar())[0].cidade === "São Paulo");
  await ServicoEditora.excluir(e.id);
  await ServicoAutor.excluir(a.id);
  verificar("Autor e editora excluídos", (await ServicoAutor.listar()).length === 0 && (await ServicoEditora.listar()).length === 0);

  console.log("\n== Livros + API de ISBN ==");
  const dados = await ServicoLivro.buscarPorIsbn({ isbn: "978-85-325-1101-0" });
  verificar("Open Library preenche título/autor/editora/ano", dados.titulo.startsWith("Harry Potter") && dados.autores[0] === "J. K. Rowling" && dados.editora === "Rocco" && dados.ano_publicacao === 2000);
  verificar("Fonte informada", dados.fonte === "Open Library");
  const google = await ServicoLivro.buscarPorIsbn({ isbn: "9780306406157" });
  verificar("Se Open Library não acha, Google Books responde (capa em https)", google.fonte === "Google Books" && google.capa_url!.startsWith("https://"));
  await esperarErro("ISBN inexistente", () => ServicoLivro.buscarPorIsbn({ isbn: "0306406152" }), "não encontrado");
  await esperarErro("ISBN inválido", () => ServicoLivro.buscarPorIsbn({ isbn: "1234567890123" }), "inválido");

  const hp = await ServicoLivro.criar({ titulo: dados.titulo, isbn: "9788532511010", editora: "Rocco", autores: "J. K. Rowling", ano_publicacao: 2000, paginas: 264, capa_url: dados.capa_url });
  const hp2 = await ServicoLivro.criar({ titulo: "Dom Casmurro", autores: "Machado de Assis, Outro Autor", editora: "Rocco" });
  verificar("Livro cria editora e autores automaticamente", (await ServicoEditora.listar()).length === 1 && (await ServicoAutor.listar()).length === 3);
  const lido = await ServicoLivro.obter(hp2.id);
  verificar("Livro com 2 autores (relação N:N)", lido.autores === "Machado de Assis, Outro Autor" && lido.status === "disponivel");
  await ServicoLivro.atualizar({ id: hp2.id, titulo: "Dom Casmurro (ed. 2)", autores: "Machado de Assis", editora: "Rocco" });
  verificar("Livro atualizado (autor removido da ligação)", (await ServicoLivro.obter(hp2.id)).autores === "Machado de Assis");
  await esperarErro("Capa só aceita https", () => ServicoLivro.criar({ titulo: "X", capa_url: "javascript:alert(1)" }), "https");
  const idMachado = (await ServicoAutor.listar()).find((x) => x.nome === "Machado de Assis")!.id;
  const idRocco = (await ServicoEditora.listar())[0].id;
  await esperarErro("Autor não pode ser excluído se tem livro", () => ServicoAutor.excluir(idMachado), "ligado a livros");
  await esperarErro("Editora não pode ser excluída se tem livro", () => ServicoEditora.excluir(idRocco), "ligada a livros");

  console.log("\n== Leitores + API de CEP/distância ==");
  const cep = await ServicoUsuario.consultarCep({ cep: "13010-111" });
  verificar("ViaCEP preenche endereço", cep.status === "ok" && cep.endereco!.logradouro === "Rua Perto");
  verificar("Distância calculada (Nominatim) e dentro da região", cep.distanciaKm! > 0 && cep.distanciaKm! < 5 && cep.dentroDaRegiao === true);
  const longe = await ServicoUsuario.consultarCep({ cep: "01001000" });
  verificar("Leitor de outra cidade fica fora da região", longe.dentroDaRegiao === false && longe.distanciaKm! > 50 && longe.aviso!.startsWith("ATENÇÃO"));
  verificar("CEP inexistente detectado", (await ServicoUsuario.consultarCep({ cep: "99999999" })).status === "inexistente");

  const maria = await ServicoUsuario.criar(leitor("Maria Silva", "52998224725"));
  const joao = await ServicoUsuario.criar(leitor("Joao Souza", "11144477735"));
  const ana = await ServicoUsuario.criar(leitor("Ana Lima", "39053344705"));
  const bruno = await ServicoUsuario.criar(leitor("Bruno Reis", "86288366757"));
  const bruta = await Banco.consultar<any>("SELECT cpf_cifrado, cpf_hash, distancia_km FROM usuario WHERE id = ?", [maria.id]);
  verificar("CPF NÃO fica em texto no banco", !bruta[0].cpf_cifrado.includes("52998224725") && !bruta[0].cpf_hash.includes("52998224725"));
  verificar("Distância gravada no cadastro", Number(bruta[0].distancia_km) > 0);
  const lista = await ServicoUsuario.listar();
  verificar("Lista mostra CPF mascarado", lista.find((u) => u.id === maria.id)!.cpf_mascarado === "***.982.247-**" && !("cpf" in lista[0]));
  verificar("Obter para edição traz CPF completo", (await ServicoUsuario.obter(maria.id)).cpf === "52998224725");
  await esperarErro("CPF repetido", () => ServicoUsuario.criar(leitor("Outra Pessoa", "529.982.247-25")), "com este CPF");
  await esperarErro("CPF inválido", () => ServicoUsuario.criar(leitor("Fulano", "11111111111")), "CPF inválido");
  await esperarErro("CEP inexistente no cadastro", () => ServicoUsuario.criar(leitor("Fulano", "12345678909", "99999999")), "CEP inexistente");
  await esperarErro("E-mail inválido", () => ServicoUsuario.criar(leitor("Fulano", "12345678909", "13010111", { email: "sem-arroba" })), "E-mail");
  await ServicoUsuario.atualizar({ ...leitor("Maria Silva Souza", "52998224725"), id: maria.id });
  verificar("Leitor atualizado", (await ServicoUsuario.obter(maria.id)).nome === "Maria Silva Souza");

  console.log("\n== Empréstimos + API de feriados ==");
  await esperarErro("Empréstimo com prazo no passado", () => ServicoEmprestimo.criar({ livro_id: hp.id, usuario_id: maria.id, data_prevista: "2020-01-01" }), "anterior a hoje");
  const sugestao = await ServicoEmprestimo.sugerirPrazo();
  verificar("Prazo sugerido = hoje + 14 (ou ajustado por feriado)", sugestao.data >= Datas.somarDias(Datas.hoje(), 14));
  const ano = Number(Datas.hoje().slice(0, 4));
  const natal = `${ano + 1}-12-25`;
  const emp = await ServicoEmprestimo.criar({ livro_id: hp.id, usuario_id: maria.id, data_prevista: natal });
  const gravadoEmp = await ServicoEmprestimo.obter(emp.id);
  verificar("Prazo em feriado (25/12 e 26/12) vai para 27/12", gravadoEmp.data_prevista === `${ano + 1}-12-27` && emp.aviso!.includes("Natal"));
  await esperarErro("Livro já emprestado não empresta de novo", () => ServicoEmprestimo.criar({ livro_id: hp.id, usuario_id: joao.id }), "já está emprestado");
  verificar("Livro aparece como emprestado", (await ServicoLivro.obter(hp.id)).status === "emprestado");
  await esperarErro("Não exclui livro com histórico", () => ServicoLivro.excluir(hp.id), "empréstimos");
  await esperarErro("Não exclui leitor com histórico", () => ServicoUsuario.excluir(maria.id), "histórico");

  console.log("\n== Atrasados ==");
  await Banco.executar("UPDATE emprestimo SET data_prevista = ? WHERE id = ?", [Datas.somarDias(Datas.hoje(), -5), emp.id]);
  const atrasados = await ServicoEmprestimo.listar("atrasados");
  verificar("Empréstimo vencido aparece como ATRASADO (5 dias)", atrasados.length === 1 && atrasados[0].atrasado && atrasados[0].dias_atraso === 5);
  verificar("Atrasado traz telefone e endereço para cobrar", atrasados[0].telefone === "19999998888" && atrasados[0].endereco.includes("Rua Perto"));
  const painel = await ServicoPainel.resumo();
  verificar("Painel destaca o atrasado", painel.atrasados.length === 1 && painel.livros_emprestados === 1 && painel.total_livros === 2);
  const proc = await ServicoNotificacao.processar();
  verificar("E-mail de vencimento/atraso enviado (simulado) uma vez", proc.vencimentos_avisados === 1 && proc.simulados >= 1);
  verificar("Não reenvia o mesmo aviso", (await ServicoNotificacao.processar()).vencimentos_avisados === 0);
  await ServicoEmprestimo.atualizar({ id: emp.id, data_prevista: Datas.somarDias(Datas.hoje(), 7), observacao: "Renovado" });
  const renovado = await ServicoEmprestimo.obter(emp.id);
  verificar("Renovar prazo tira o atraso", !renovado.atrasado && renovado.observacao === "Renovado");
  await Banco.executar("UPDATE emprestimo SET data_prevista = ? WHERE id = ?", [Datas.somarDias(Datas.hoje(), 1), emp.id]);
  await Banco.executar("UPDATE emprestimo SET aviso_enviado = 0 WHERE id = ?", [emp.id]);
  verificar("Aviso 'vence amanhã' também é enviado", (await ServicoNotificacao.processar()).vencimentos_avisados === 1);

  console.log("\n== Reservas (fila, devolução, expiração) ==");
  await esperarErro("Não reserva livro disponível", () => ServicoReserva.criar({ livro_id: hp2.id, usuario_id: joao.id }), "disponível");
  await esperarErro("Quem está com o livro não reserva", () => ServicoReserva.criar({ livro_id: hp.id, usuario_id: maria.id }), "está com o livro");
  const r1 = await ServicoReserva.criar({ livro_id: hp.id, usuario_id: joao.id });
  const r2 = await ServicoReserva.criar({ livro_id: hp.id, usuario_id: ana.id });
  await esperarErro("Reserva repetida do mesmo leitor", () => ServicoReserva.criar({ livro_id: hp.id, usuario_id: joao.id }), "já tem uma reserva");
  let reservas = await ServicoReserva.listar();
  verificar("Fila: João 1º, Ana 2ª", reservas.find((r) => r.id === r1.id)!.posicao_fila === 1 && reservas.find((r) => r.id === r2.id)!.posicao_fila === 2);

  const devolucao = await ServicoEmprestimo.devolver(emp.id);
  verificar("Devolver avisa o 1º da fila", devolucao.reserva_para === "Joao Souza" && devolucao.notificacao.reservas_avisadas === 1);
  reservas = await ServicoReserva.listar();
  const resJoao = reservas.find((r) => r.id === r1.id)!;
  verificar("Reserva do João virou 'disponivel' com 1 dia de prazo", resJoao.status === "disponivel" && resJoao.data_limite === Datas.somarDias(Datas.hoje(), 1));
  verificar("Livro aparece como 'reservado'", (await ServicoLivro.obter(hp.id)).status === "reservado");
  await esperarErro("Devolver duas vezes", () => ServicoEmprestimo.devolver(emp.id), "já foi devolvido");
  await esperarErro("Outro leitor não pega livro reservado", () => ServicoEmprestimo.criar({ livro_id: hp.id, usuario_id: bruno.id }), "reservado para Joao Souza");

  await Banco.executar("UPDATE reserva SET data_limite = ? WHERE id = ?", [Datas.somarDias(Datas.hoje(), -1), r1.id]);
  const exp = await ServicoNotificacao.processar();
  reservas = await ServicoReserva.listar();
  verificar("Reserva não buscada EXPIRA e a próxima da fila é chamada", exp.reservas_expiradas === 1 && reservas.find((r) => r.id === r1.id)!.status === "expirada" && reservas.find((r) => r.id === r2.id)!.status === "disponivel" && exp.reservas_avisadas === 1);

  const novoEmp = await ServicoReserva.emprestar({ id: r2.id });
  reservas = await ServicoReserva.listar();
  verificar("Reserva buscada vira empréstimo e fica 'atendida'", reservas.find((r) => r.id === r2.id)!.status === "atendida" && (await ServicoEmprestimo.obter(novoEmp.id)).usuario_nome === "Ana Lima");
  await ServicoEmprestimo.devolver(novoEmp.id);
  verificar("Sem fila, livro volta a ficar livre para qualquer um", (await ServicoLivro.obter(hp.id)).status === "disponivel");

  const empBruno = await ServicoEmprestimo.criar({ livro_id: hp.id, usuario_id: bruno.id });
  const r3 = await ServicoReserva.criar({ livro_id: hp.id, usuario_id: maria.id, observacao: "quer muito" });
  await ServicoReserva.atualizar({ id: r3.id, observacao: "mudou de ideia", cancelar: true });
  verificar("Cancelar reserva (update)", (await ServicoReserva.obter(r3.id)).status === "cancelada");
  const r4 = await ServicoReserva.criar({ livro_id: hp.id, usuario_id: joao.id });
  await ServicoReserva.excluir(r4.id);
  verificar("Excluir reserva (delete)", (await ServicoReserva.listar()).every((r) => r.id !== r4.id));
  await ServicoEmprestimo.excluir(empBruno.id);
  verificar("Excluir empréstimo ativo devolve o livro ao acervo", (await ServicoLivro.obter(hp.id)).status === "disponivel");

  console.log("\n== Exclusões finais (delete) ==");
  await Banco.executar("DELETE FROM reserva");
  await Banco.executar("DELETE FROM emprestimo");
  await ServicoUsuario.excluir(bruno.id);
  await ServicoLivro.excluir(hp2.id);
  verificar("Excluir leitor e livro sem histórico", (await ServicoUsuario.listar()).length === 3 && (await ServicoLivro.listar()).length === 1);

  console.log("\n== Uso das APIs ==");
  const usadas = new Set(chamadas);
  verificar(`4 APIs externas usadas: ${[...usadas].join(", ")}`, ["openlibrary.org", "viacep.com.br", "brasilapi.com.br", "nominatim.openstreetmap.org"].every((h) => usadas.has(h)));

  await Banco.fechar();
  console.log(`\n${total - falhas}/${total} verificações passaram.${falhas ? "  *** HÁ FALHAS ***" : ""}\n`);
  process.exit(falhas ? 1 : 0);
}

principal().catch((erro) => {
  console.error("Erro inesperado nos testes:", erro);
  process.exit(1);
});
