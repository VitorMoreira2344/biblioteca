import * as dotenv from "dotenv";
import * as path from "path";

// le o arquivo env e guarda as regras fixas da biblioteca
export class Configuracao {
  // regras do negocio tipo prazo de emprestimo e bloqueio de login
  static readonly PRAZO_PADRAO_DIAS = 14;
  static readonly DIAS_AVISO_VENCIMENTO = 2;
  static readonly DIAS_RETIRADA_RESERVA = 1;
  static readonly MAX_TENTATIVAS_LOGIN = 5;
  static readonly BLOQUEIO_LOGIN_MINUTOS = 5;

  // carrega o env da pasta do projeto
  static carregar(pastaDoProjeto: string): void {
    dotenv.config({ path: path.join(pastaDoProjeto, ".env"), quiet: true });
  }

  // le uma variavel do env e devolve vazio se nao tiver
  static variavel(nome: string): string {
    return (process.env[nome] ?? "").trim();
  }

  // dados pra conectar no mysql
  static get banco() {
    return {
      host: Configuracao.variavel("DB_HOST"),
      port: Number(Configuracao.variavel("DB_PORT") || 3306),
      user: Configuracao.variavel("DB_USER"),
      password: Configuracao.variavel("DB_PASSWORD"),
      database: Configuracao.variavel("DB_NAME"),
    };
  }

  // cep da biblioteca so com numeros
  static get cepBiblioteca(): string {
    return Configuracao.variavel("BIBLIOTECA_CEP").replace(/\D/g, "");
  }

  // distancia maxima em km pra ser da regiao e o padrao e 5
  static get raioRegiaoKm(): number {
    const valor = Number(Configuracao.variavel("RAIO_REGIAO_KM"));
    return valor > 0 ? valor : 5;
  }

  // se for 1 abre o devtools
  static get modoDev(): boolean {
    return Configuracao.variavel("MODO_DEV") === "1";
  }
}
