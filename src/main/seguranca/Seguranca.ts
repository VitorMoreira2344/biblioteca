import * as crypto from "crypto";
import { promisify } from "util";
import { Configuracao } from "../config/Configuracao";
import { ErroNegocio } from "../util/ErroNegocio";

const scrypt = promisify(crypto.scrypt) as (senha: string, sal: Buffer, tamanho: number) => Promise<Buffer>;

// Tudo que é criptografia fica nesta classe:
//  1) Senhas -> NUNCA guardadas em texto: só o "hash" (scrypt + sal aleatório).
//  2) CPF    -> guardado CIFRADO (AES-256-GCM), pois é dado pessoal (LGPD).
export class Seguranca {
  // ---------------- SENHAS ----------------

  // Transforma a senha em um hash irreversível. Formato guardado: "scrypt:sal:hash".
  static async gerarHashSenha(senha: string): Promise<string> {
    const sal = crypto.randomBytes(16); // sal aleatório: senhas iguais geram hashes diferentes
    const hash = await scrypt(senha, sal, 64);
    return `scrypt:${sal.toString("hex")}:${hash.toString("hex")}`;
  }

  // Confere se a senha digitada bate com o hash guardado.
  static async conferirSenha(senha: string, armazenado: string): Promise<boolean> {
    const partes = armazenado.split(":");
    if (partes.length !== 3 || partes[0] !== "scrypt") return false;
    const sal = Buffer.from(partes[1], "hex");
    const esperado = Buffer.from(partes[2], "hex");
    const calculado = await scrypt(senha, sal, esperado.length);
    // timingSafeEqual compara sem "vazar" informação pelo tempo de resposta
    return crypto.timingSafeEqual(calculado, esperado);
  }

  // ---------------- DADOS SENSÍVEIS (CPF) ----------------

  // Lê a chave do .env (64 caracteres hexadecimais = 32 bytes).
  private static chave(): Buffer {
    const hex = Configuracao.variavel("CHAVE_CRIPTOGRAFIA");
    if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
      throw new ErroNegocio(
        "CHAVE_CRIPTOGRAFIA ausente ou inválida no arquivo .env (veja o README para gerar uma).",
      );
    }
    return Buffer.from(hex, "hex");
  }

  // Cifra um texto. Resultado (base64) = iv + tag de autenticação + texto cifrado.
  static cifrar(texto: string): string {
    const iv = crypto.randomBytes(12);
    const cifra = crypto.createCipheriv("aes-256-gcm", Seguranca.chave(), iv);
    const cifrado = Buffer.concat([cifra.update(texto, "utf8"), cifra.final()]);
    return Buffer.concat([iv, cifra.getAuthTag(), cifrado]).toString("base64");
  }

  // Desfaz a cifragem. Se o dado foi alterado no banco, o GCM detecta e dá erro.
  static decifrar(base64: string): string {
    const bytes = Buffer.from(base64, "base64");
    const iv = bytes.subarray(0, 12);
    const tag = bytes.subarray(12, 28);
    const cifrado = bytes.subarray(28);
    const decifra = crypto.createDecipheriv("aes-256-gcm", Seguranca.chave(), iv);
    decifra.setAuthTag(tag);
    return Buffer.concat([decifra.update(cifrado), decifra.final()]).toString("utf8");
  }

  // "Impressão digital" do CPF (HMAC). Serve para procurar/impedir CPF repetido
  // sem precisar decifrar todos os registros.
  static hashCpf(cpf: string): string {
    return crypto.createHmac("sha256", Seguranca.chave()).update(cpf).digest("hex");
  }

  // Esconde parte do CPF para mostrar nas listas: 12345678909 -> ***.456.789-**
  static mascararCpf(cpf: string): string {
    return `***.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-**`;
  }
}
