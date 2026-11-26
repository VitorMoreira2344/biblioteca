import * as nodemailer from "nodemailer";
import { Configuracao } from "../config/Configuracao";
import { Datas } from "../util/Datas";

export interface ResultadoEmail {
  enviado: boolean; // foi mesmo para o servidor SMTP
  simulado: boolean; // SMTP não configurado: só escrevemos no console
  erro?: string;
}

// Envia os avisos por e-mail (vencimento do prazo e livro reservado de volta).
export class ServicoEmail {
  private static transportador: nodemailer.Transporter | null = null;

  // O SMTP está configurado no .env?
  static configurado(): boolean {
    return Configuracao.variavel("SMTP_HOST") !== "";
  }

  // Cria (uma vez só) o objeto que conversa com o servidor SMTP.
  private static obterTransportador(): nodemailer.Transporter {
    if (!ServicoEmail.transportador) {
      const porta = Number(Configuracao.variavel("SMTP_PORT") || 587);
      ServicoEmail.transportador = nodemailer.createTransport({
        host: Configuracao.variavel("SMTP_HOST"),
        port: porta,
        secure: porta === 465,
        auth: { user: Configuracao.variavel("SMTP_USER"), pass: Configuracao.variavel("SMTP_PASSWORD") },
      });
    }
    return ServicoEmail.transportador;
  }

  // Envia um e-mail de texto. Nunca lança erro: devolve o resultado.
  static async enviar(para: string, assunto: string, texto: string): Promise<ResultadoEmail> {
    if (!ServicoEmail.configurado()) {
      console.log(`[E-MAIL SIMULADO] Para: ${para}\nAssunto: ${assunto}\n${texto}\n`);
      return { enviado: false, simulado: true };
    }
    try {
      await ServicoEmail.obterTransportador().sendMail({
        from: Configuracao.variavel("EMAIL_REMETENTE") || Configuracao.variavel("SMTP_USER"),
        to: para,
        subject: assunto,
        text: texto,
      });
      return { enviado: true, simulado: false };
    } catch (erro) {
      console.error("Falha ao enviar e-mail:", (erro as Error).message);
      return { enviado: false, simulado: false, erro: (erro as Error).message };
    }
  }

  // Texto do aviso de prazo de devolução.
  static avisoVencimento(nome: string, titulo: string, dataPrevista: string, atrasado: boolean): { assunto: string; texto: string } {
    const data = Datas.paraBR(dataPrevista);
    if (atrasado) {
      return {
        assunto: `Devolução em atraso: ${titulo}`,
        texto: `Olá, ${nome}!\n\nO prazo para devolver o livro "${titulo}" terminou em ${data}.\nPor favor, devolva-o à biblioteca assim que puder, pois outras pessoas também querem ler.\n\nObrigado!\nBiblioteca Comunitária`,
      };
    }
    return {
      assunto: `Lembrete: devolução de "${titulo}" em ${data}`,
      texto: `Olá, ${nome}!\n\nO prazo para devolver o livro "${titulo}" vence em ${data}.\nNão esqueça de devolvê-lo à biblioteca.\n\nObrigado!\nBiblioteca Comunitária`,
    };
  }

  // Texto do aviso "o livro que você reservou voltou".
  static avisoReserva(nome: string, titulo: string, dataLimite: string): { assunto: string; texto: string } {
    return {
      assunto: `O livro "${titulo}" está disponível para você`,
      texto: `Olá, ${nome}!\n\nO livro "${titulo}", que você reservou, voltou para a biblioteca.\nVenha buscá-lo até ${Datas.paraBR(dataLimite)}. Depois dessa data a reserva expira e o livro fica livre para outras pessoas.\n\nBiblioteca Comunitária`,
    };
  }
}
