import * as dotenv from "dotenv";
import * as path from "path";

// Lê as configurações do arquivo .env e guarda as regras fixas do sistema.
// Nenhuma senha fica escrita no código.
export class Configuracao {
  // ---- Regras de negócio da biblioteca (mude aqui se o dono quiser outros prazos) ----
  static readonly PRAZO_PADRAO_DIAS = 14; // prazo padrão de um empréstimo
  static readonly DIAS_AVISO_VENCIMENTO = 2; // avisa por e-mail quando faltam até 2 dias
  static readonly DIAS_RETIRADA_RESERVA = 1; // quem reservou tem 1 dia para buscar o livro
  static readonly MAX_TENTATIVAS_LOGIN = 5; // erros de senha antes de bloquear
  static readonly BLOQUEIO_LOGIN_MINUTOS = 5; // tempo de bloqueio após errar demais

  // Carrega o arquivo .env que está na pasta do projeto.
  static carregar(pastaDoProjeto: string): void {
    dotenv.config({ path: path.join(pastaDoProjeto, ".env"), quiet: true });
  }

  // Lê uma variável do .env (devolve "" se não existir).
  static variavel(nome: string): string {
    return (process.env[nome] ?? "").trim();
  }

  // Dados de conexão com o MySQL.
  static get banco() {
    return {
      host: Configuracao.variavel("DB_HOST"),
      port: Number(Configuracao.variavel("DB_PORT") || 3306),
      user: Configuracao.variavel("DB_USER"),
      password: Configuracao.variavel("DB_PASSWORD"),
      database: Configuracao.variavel("DB_NAME"),
    };
  }

  // CEP da biblioteca (só dígitos). Pode estar vazio.
  static get cepBiblioteca(): string {
    return Configuracao.variavel("BIBLIOTECA_CEP").replace(/\D/g, "");
  }

  // Distância máxima (km) para considerar que o leitor é "da região".
  static get raioRegiaoKm(): number {
    const valor = Number(Configuracao.variavel("RAIO_REGIAO_KM"));
    return valor > 0 ? valor : 5;
  }

  // Se 1, abre as ferramentas de desenvolvedor.
  static get modoDev(): boolean {
    return Configuracao.variavel("MODO_DEV") === "1";
  }
}
