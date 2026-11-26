import * as fs from "fs";
import * as path from "path";
import * as mysql from "mysql2/promise";
import { Configuracao } from "../config/Configuracao";

// Qualquer coisa que consiga rodar SQL: o próprio Banco ou uma transação.
// Os serviços recebem um "Executor", assim funcionam dentro ou fora de transação.
export interface Executor {
  consultar<T = any>(sql: string, parametros?: any[]): Promise<T[]>;
  executar(sql: string, parametros?: any[]): Promise<mysql.ResultSetHeader>;
}

// Executor que vale para UMA conexão específica (usado dentro das transações).
class ConexaoTransacao implements Executor {
  constructor(private conexao: mysql.PoolConnection) {}

  // SELECT: devolve as linhas encontradas.
  async consultar<T = any>(sql: string, parametros: any[] = []): Promise<T[]> {
    const [linhas] = await this.conexao.query(sql, parametros);
    return linhas as T[];
  }

  // INSERT / UPDATE / DELETE: devolve insertId, affectedRows etc.
  async executar(sql: string, parametros: any[] = []): Promise<mysql.ResultSetHeader> {
    const [resultado] = await this.conexao.query(sql, parametros);
    return resultado as mysql.ResultSetHeader;
  }
}

// Cuida da conexão com o MySQL. Usamos um "pool" (várias conexões reaproveitadas).
// IMPORTANTE: todo valor vindo do usuário entra no SQL pelos "?" (parâmetros),
// nunca concatenado no texto -> isso impede SQL Injection.
export class Banco {
  private static pool: mysql.Pool | null = null;

  // Abre o pool e testa se o banco responde.
  static async conectar(): Promise<void> {
    const dados = Configuracao.banco;
    if (!dados.host || !dados.user || !dados.database) {
      throw new Error("Configure DB_HOST, DB_USER, DB_PASSWORD e DB_NAME no arquivo .env");
    }
    Banco.pool = mysql.createPool({
      ...dados,
      charset: "utf8mb4",
      dateStrings: true, // datas vêm como texto "aaaa-mm-dd" (sem problema de fuso)
      decimalNumbers: true, // DECIMAL vem como número
      connectionLimit: 5,
      multipleStatements: false, // um comando por vez (mais seguro)
    });
    await Banco.pool.query("SELECT 1");
  }

  // Devolve o pool já aberto (erro se esqueceram de chamar conectar()).
  private static obterPool(): mysql.Pool {
    if (!Banco.pool) throw new Error("Banco de dados não conectado.");
    return Banco.pool;
  }

  // Cria as tabelas rodando o arquivo sql/criar_tabelas.sql.
  static async criarTabelas(pastaDoProjeto: string): Promise<void> {
    const arquivo = path.join(pastaDoProjeto, "sql", "criar_tabelas.sql");
    const comandos = fs
      .readFileSync(arquivo, "utf8")
      .split("\n")
      .filter((linha) => !linha.trim().startsWith("--")) // ignora as linhas de comentário
      .join("\n")
      .split(";")
      .map((c) => c.trim())
      .filter((c) => c.length > 0);
    for (const comando of comandos) {
      await Banco.obterPool().query(comando);
    }
  }

  // SELECT: devolve as linhas.
  static async consultar<T = any>(sql: string, parametros: any[] = []): Promise<T[]> {
    const [linhas] = await Banco.obterPool().query(sql, parametros);
    return linhas as T[];
  }

  // INSERT / UPDATE / DELETE.
  static async executar(sql: string, parametros: any[] = []): Promise<mysql.ResultSetHeader> {
    const [resultado] = await Banco.obterPool().query(sql, parametros);
    return resultado as mysql.ResultSetHeader;
  }

  // Roda vários comandos "de uma vez só": ou todos funcionam, ou nenhum é gravado.
  static async transacao<T>(funcao: (executor: Executor) => Promise<T>): Promise<T> {
    const conexao = await Banco.obterPool().getConnection();
    try {
      await conexao.beginTransaction();
      const resultado = await funcao(new ConexaoTransacao(conexao));
      await conexao.commit();
      return resultado;
    } catch (erro) {
      await conexao.rollback(); // desfaz tudo se algo deu errado
      throw erro;
    } finally {
      conexao.release();
    }
  }

  // Fecha todas as conexões (ao sair do programa).
  static async fechar(): Promise<void> {
    if (Banco.pool) await Banco.pool.end();
    Banco.pool = null;
  }
}
