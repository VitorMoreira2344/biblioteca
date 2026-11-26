import * as fs from "fs";
import * as path from "path";
import * as mysql from "mysql2/promise";
import { Configuracao } from "../config/Configuracao";

// o que da pra fazer no banco seja normal ou dentro de transacao
export interface Executor {
  consultar<T = any>(sql: string, parametros?: any[]): Promise<T[]>;
  executar(sql: string, parametros?: any[]): Promise<mysql.ResultSetHeader>;
}

// usa uma conexao so pra tudo da transacao
class ConexaoTransacao implements Executor {
  constructor(private conexao: mysql.PoolConnection) {}

  async consultar<T = any>(sql: string, parametros: any[] = []): Promise<T[]> {
    const [linhas] = await this.conexao.query(sql, parametros);
    return linhas as T[];
  }

  async executar(sql: string, parametros: any[] = []): Promise<mysql.ResultSetHeader> {
    const [resultado] = await this.conexao.query(sql, parametros);
    return resultado as mysql.ResultSetHeader;
  }
}

// conexao com o mysql
export class Banco {
  private static pool: mysql.Pool | null = null;

  // cria o pool de conexoes e testa com um select 1
  static async conectar(): Promise<void> {
    const dados = Configuracao.banco;
    if (!dados.host || !dados.user || !dados.database) {
      throw new Error("Configure DB_HOST, DB_USER, DB_PASSWORD e DB_NAME no arquivo .env");
    }
    Banco.pool = mysql.createPool({
      ...dados,
      charset: "utf8mb4",
      dateStrings: true,
      decimalNumbers: true,
      connectionLimit: 5,
      multipleStatements: false,
    });
    await Banco.pool.query("SELECT 1");
  }

  // devolve o pool ou reclama se nao conectou
  private static obterPool(): mysql.Pool {
    if (!Banco.pool) throw new Error("Banco de dados não conectado.");
    return Banco.pool;
  }

  // le o arquivo sql tira os comentarios e roda comando por comando
  static async criarTabelas(pastaDoProjeto: string): Promise<void> {
    const arquivo = path.join(pastaDoProjeto, "sql", "criar_tabelas.sql");
    const comandos = fs
      .readFileSync(arquivo, "utf8")
      .split("\n")
      .filter((linha) => !linha.trim().startsWith("--"))
      .join("\n")
      .split(";")
      .map((c) => c.trim())
      .filter((c) => c.length > 0);
    for (const comando of comandos) {
      await Banco.obterPool().query(comando);
    }
  }

  // select que devolve as linhas
  static async consultar<T = any>(sql: string, parametros: any[] = []): Promise<T[]> {
    const [linhas] = await Banco.obterPool().query(sql, parametros);
    return linhas as T[];
  }

  // insert update ou delete
  static async executar(sql: string, parametros: any[] = []): Promise<mysql.ResultSetHeader> {
    const [resultado] = await Banco.obterPool().query(sql, parametros);
    return resultado as mysql.ResultSetHeader;
  }

  // roda varias coisas juntas e se uma falhar desfaz tudo
  static async transacao<T>(funcao: (executor: Executor) => Promise<T>): Promise<T> {
    const conexao = await Banco.obterPool().getConnection();
    try {
      await conexao.beginTransaction();
      const resultado = await funcao(new ConexaoTransacao(conexao));
      await conexao.commit();
      return resultado;
    } catch (erro) {
      await conexao.rollback();
      throw erro;
    } finally {
      conexao.release();
    }
  }

  // fecha o pool
  static async fechar(): Promise<void> {
    if (Banco.pool) await Banco.pool.end();
    Banco.pool = null;
  }
}
