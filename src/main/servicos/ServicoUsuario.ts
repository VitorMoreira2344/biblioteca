import { Banco } from "../banco/Banco";
import { Validador } from "../util/Validador";
import { ErroNegocio, ErroApi } from "../util/ErroNegocio";
import { Seguranca } from "../seguranca/Seguranca";
import { Configuracao } from "../config/Configuracao";
import { ApiCep, EnderecoCep } from "../apis/ApiCep";
import { ApiGeolocalizacao } from "../apis/ApiGeolocalizacao";

// crud dos leitores com cpf cifrado e cep
export class ServicoUsuario {
  // colunas que a gente le do leitor
  private static readonly COLUNAS =
    "id, nome, cpf_cifrado, email, telefone, cep, logradouro, numero, complemento, bairro, cidade, uf, distancia_km";

  // decifra o cpf e mostra mascarado e completo so quando pede
  private static montar(linha: any, incluirCpf: boolean): Usuario {
    const { cpf_cifrado, ...resto } = linha;
    let cpf = "";
    try {
      cpf = Seguranca.decifrar(cpf_cifrado);
    } catch {
      // se a chave mudou nao da pra ler o cpf entao fica ilegivel
    }
    const usuario: Usuario = { ...resto, cpf_mascarado: cpf ? Seguranca.mascararCpf(cpf) : "(ilegível)" };
    if (incluirCpf) usuario.cpf = cpf;
    return usuario;
  }

  // junta o endereco num texto so
  static formatarEndereco(u: { logradouro: string; numero: string; complemento?: string | null; bairro?: string | null; cidade: string; uf: string }): string {
    const rua = `${u.logradouro}, ${u.numero}${u.complemento ? " (" + u.complemento + ")" : ""}`;
    return `${rua}${u.bairro ? " - " + u.bairro : ""}, ${u.cidade}/${u.uf}`;
  }

  // lista os leitores com cpf escondido
  static async listar(): Promise<Usuario[]> {
    const linhas = await Banco.consultar(`SELECT ${ServicoUsuario.COLUNAS} FROM usuario ORDER BY nome`);
    return linhas.map((l) => ServicoUsuario.montar(l, false));
  }

  // pega um leitor com o cpf completo pra editar
  static async obter(idBruto: unknown): Promise<Usuario> {
    const id = Validador.inteiro(idBruto, "Usuário");
    const linhas = await Banco.consultar(`SELECT ${ServicoUsuario.COLUNAS} FROM usuario WHERE id = ?`, [id]);
    if (!linhas.length) throw new ErroNegocio("Usuário não encontrado.");
    return ServicoUsuario.montar(linhas[0], true);
  }

  // confere todos os campos do leitor
  private static validar(dados: any) {
    const uf = Validador.texto(dados?.uf, "UF", 2)!.toUpperCase();
    if (!/^[A-Z]{2}$/.test(uf)) throw new ErroNegocio("UF inválida.");
    return {
      nome: Validador.texto(dados?.nome, "Nome", 100)!,
      cpf: Validador.cpf(dados?.cpf),
      email: Validador.email(dados?.email),
      telefone: Validador.telefone(dados?.telefone),
      cep: Validador.cep(dados?.cep),
      logradouro: Validador.texto(dados?.logradouro, "Rua", 150)!,
      numero: Validador.texto(dados?.numero, "Número", 20)!,
      complemento: Validador.texto(dados?.complemento, "Complemento", 80, false),
      bairro: Validador.texto(dados?.bairro, "Bairro", 80, false),
      cidade: Validador.texto(dados?.cidade, "Cidade", 80)!,
      uf,
    };
  }

  // ve se o leitor mora perto da biblioteca
  private static async avaliarRegiao(end: EnderecoCep): Promise<Omit<ResultadoCep, "status" | "endereco">> {
    const biblioteca = await ApiGeolocalizacao.localDaBiblioteca();
    if (!biblioteca) {
      return { distanciaKm: null, mesmoBairro: false, dentroDaRegiao: null, aviso: "Região não verificada (configure BIBLIOTECA_CEP no .env)." };
    }

    // primeiro olha se e o mesmo bairro e cidade
    const igual = (a: string, b: string) => a !== "" && Validador.normalizarTexto(a) === Validador.normalizarTexto(b);
    const mesmoBairro = igual(end.cidade, biblioteca.endereco.cidade) && igual(end.bairro, biblioteca.endereco.bairro);

    // depois tenta medir a distancia pelo mapa
    let distanciaKm: number | null = null;
    try {
      const casa = await ApiGeolocalizacao.coordenadas(end.logradouro, end.bairro, end.cidade, end.uf);
      if (casa && biblioteca.coordenadas) {
        distanciaKm = Math.round(ApiGeolocalizacao.distanciaKm(casa, biblioteca.coordenadas) * 100) / 100;
      }
    } catch {
      distanciaKm = null;
    }

    // monta o aviso de dentro ou fora da regiao
    const raio = Configuracao.raioRegiaoKm;
    let dentroDaRegiao: boolean | null = null;
    let aviso: string;
    if (mesmoBairro) {
      dentroDaRegiao = true;
      aviso = "Mora no mesmo bairro da biblioteca.";
    } else if (distanciaKm !== null) {
      dentroDaRegiao = distanciaKm <= raio;
      aviso = dentroDaRegiao
        ? `Mora a ${distanciaKm.toFixed(1)} km da biblioteca (dentro da região).`
        : `ATENÇÃO: mora a ${distanciaKm.toFixed(1)} km da biblioteca (fora da região de ${raio} km).`;
    } else {
      aviso = "Não foi possível medir a distância até a biblioteca.";
    }
    return { distanciaKm, mesmoBairro, dentroDaRegiao, aviso };
  }

  // busca o cep no viacep e ja diz se a pessoa e da regiao
  static async consultarCep(dados: any): Promise<ResultadoCep> {
    const cep = Validador.cep(dados?.cep);
    let endereco: EnderecoCep | null;
    try {
      endereco = await ApiCep.consultar(cep);
    } catch (erro) {
      if (erro instanceof ErroApi) {
        return { status: "indisponivel", aviso: "Não foi possível consultar o CEP agora. Preencha o endereço manualmente." };
      }
      throw erro;
    }
    if (!endereco) return { status: "inexistente", aviso: "CEP não encontrado. Confira o número digitado." };
    const regiao = await ServicoUsuario.avaliarRegiao(endereco);
    return { status: "ok", endereco, ...regiao };
  }

  // confere se o cep existe e calcula a distancia e se a api cair mantem o valor de antes
  private static async calcularDistancia(v: { cep: string; logradouro: string; bairro: string | null; cidade: string; uf: string }, atual: number | null): Promise<number | null> {
    let existe: EnderecoCep | null;
    try {
      existe = await ApiCep.consultar(v.cep);
    } catch {
      return atual;
    }
    if (!existe) throw new ErroNegocio("CEP inexistente. Confira o número digitado.");
    const regiao = await ServicoUsuario.avaliarRegiao({ logradouro: v.logradouro, bairro: v.bairro ?? "", cidade: v.cidade, uf: v.uf });
    return regiao.distanciaKm ?? null;
  }

  // nao deixa repetir cpf usando o hash
  private static async garantirCpfUnico(cpfHash: string, idIgnorado: number): Promise<void> {
    const repetidos = await Banco.consultar("SELECT id FROM usuario WHERE cpf_hash = ? AND id <> ?", [cpfHash, idIgnorado]);
    if (repetidos.length) throw new ErroNegocio("Já existe um usuário cadastrado com este CPF.");
  }

  // cadastra um leitor com cpf cifrado
  static async criar(dados: any): Promise<{ id: number }> {
    const v = ServicoUsuario.validar(dados);
    const cpfHash = Seguranca.hashCpf(v.cpf);
    await ServicoUsuario.garantirCpfUnico(cpfHash, 0);
    const distancia = await ServicoUsuario.calcularDistancia(v, null);

    const resultado = await Banco.executar(
      `INSERT INTO usuario (nome, cpf_cifrado, cpf_hash, email, telefone, cep, logradouro, numero,
                            complemento, bairro, cidade, uf, distancia_km)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [v.nome, Seguranca.cifrar(v.cpf), cpfHash, v.email, v.telefone, v.cep, v.logradouro, v.numero, v.complemento, v.bairro, v.cidade, v.uf, distancia],
    );
    return { id: resultado.insertId };
  }

  // edita o leitor e so recalcula a distancia se o endereco mudou
  static async atualizar(dados: any): Promise<void> {
    const id = Validador.inteiro(dados?.id, "Usuário");
    const v = ServicoUsuario.validar(dados);
    const cpfHash = Seguranca.hashCpf(v.cpf);
    await ServicoUsuario.garantirCpfUnico(cpfHash, id);

    const atuais = await Banco.consultar("SELECT cep, logradouro, bairro, cidade, uf, distancia_km FROM usuario WHERE id = ?", [id]);
    if (!atuais.length) throw new ErroNegocio("Usuário não encontrado.");
    const a = atuais[0];
    const enderecoMudou = a.cep !== v.cep || a.logradouro !== v.logradouro || (a.bairro ?? null) !== v.bairro || a.cidade !== v.cidade || a.uf !== v.uf;
    const distancia = enderecoMudou ? await ServicoUsuario.calcularDistancia(v, null) : a.distancia_km;

    await Banco.executar(
      `UPDATE usuario SET nome = ?, cpf_cifrado = ?, cpf_hash = ?, email = ?, telefone = ?, cep = ?,
              logradouro = ?, numero = ?, complemento = ?, bairro = ?, cidade = ?, uf = ?, distancia_km = ?
        WHERE id = ?`,
      [v.nome, Seguranca.cifrar(v.cpf), cpfHash, v.email, v.telefone, v.cep, v.logradouro, v.numero, v.complemento, v.bairro, v.cidade, v.uf, distancia, id],
    );
  }

  // apaga o leitor so se ele nao tem historico
  static async excluir(idBruto: unknown): Promise<void> {
    const id = Validador.inteiro(idBruto, "Usuário");
    const historico = await Banco.consultar<{ total: number }>(
      `SELECT (SELECT COUNT(*) FROM emprestimo WHERE usuario_id = ?) +
              (SELECT COUNT(*) FROM reserva WHERE usuario_id = ?) AS total`,
      [id, id],
    );
    if (Number(historico[0].total) > 0) {
      throw new ErroNegocio("Este usuário tem empréstimos ou reservas no histórico e não pode ser excluído.");
    }
    await Banco.executar("DELETE FROM usuario WHERE id = ?", [id]);
  }
}
