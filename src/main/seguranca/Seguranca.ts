import * as crypto from "crypto";
import { promisify } from "util";
import { Configuracao } from "../config/Configuracao";
import { ErroNegocio } from "../util/ErroNegocio";

// versao do scrypt que da pra usar com await
const scrypt = promisify(crypto.scrypt) as (senha: string, sal: Buffer, tamanho: number) => Promise<Buffer>;

// coisas de seguranca tipo senha e cpf cifrado
export class Seguranca {

  // transforma a senha num hash com sal aleatorio pra nunca salvar a senha de verdade
  static async gerarHashSenha(senha: string): Promise<string> {
    const sal = crypto.randomBytes(16);
    const hash = await scrypt(senha, sal, 64);
    return `scrypt:${sal.toString("hex")}:${hash.toString("hex")}`;
  }

  // ve se a senha digitada bate com o hash salvo
  static async conferirSenha(senha: string, armazenado: string): Promise<boolean> {
    const partes = armazenado.split(":");
    if (partes.length !== 3 || partes[0] !== "scrypt") return false;
    const sal = Buffer.from(partes[1], "hex");
    const esperado = Buffer.from(partes[2], "hex");
    const calculado = await scrypt(senha, sal, esperado.length);
    // compara num tempo fixo pra ninguem descobrir nada pelo tempo
    return crypto.timingSafeEqual(calculado, esperado);
  }

  // pega a chave de criptografia do env e reclama se ela ta errada
  private static chave(): Buffer {
    const hex = Configuracao.variavel("CHAVE_CRIPTOGRAFIA");
    if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
      throw new ErroNegocio(
        "CHAVE_CRIPTOGRAFIA ausente ou inválida no arquivo .env (veja o README para gerar uma).",
      );
    }
    return Buffer.from(hex, "hex");
  }

  // cifra um texto tipo o cpf com aes-256-gcm
  static cifrar(texto: string): string {
    const iv = crypto.randomBytes(12);
    const cifra = crypto.createCipheriv("aes-256-gcm", Seguranca.chave(), iv);
    const cifrado = Buffer.concat([cifra.update(texto, "utf8"), cifra.final()]);
    return Buffer.concat([iv, cifra.getAuthTag(), cifrado]).toString("base64");
  }

  // desfaz a cifra e devolve o texto original
  static decifrar(base64: string): string {
    const bytes = Buffer.from(base64, "base64");
    const iv = bytes.subarray(0, 12);
    const tag = bytes.subarray(12, 28);
    const cifrado = bytes.subarray(28);
    const decifra = crypto.createDecipheriv("aes-256-gcm", Seguranca.chave(), iv);
    decifra.setAuthTag(tag);
    return Buffer.concat([decifra.update(cifrado), decifra.final()]).toString("utf8");
  }

  // impressao digital do cpf pra achar cpf repetido sem precisar decifrar
  static hashCpf(cpf: string): string {
    return crypto.createHmac("sha256", Seguranca.chave()).update(cpf).digest("hex");
  }

  // esconde o comeco e o fim do cpf nas listas
  static mascararCpf(cpf: string): string {
    return `***.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-**`;
  }
}
