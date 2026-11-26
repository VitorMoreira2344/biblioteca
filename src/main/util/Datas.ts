// Funções de data. Trabalhamos sempre com texto "aaaa-mm-dd" (formato do
// campo DATE do MySQL), assim não existe problema de fuso horário.
export class Datas {
  // Devolve a data de hoje, ex.: "2026-11-26".
  static hoje(): string {
    return Datas.formatar(new Date());
  }

  // Converte um objeto Date para "aaaa-mm-dd" (usando o horário local).
  static formatar(data: Date): string {
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, "0");
    const dia = String(data.getDate()).padStart(2, "0");
    return `${ano}-${mes}-${dia}`;
  }

  // Soma (ou subtrai, se negativo) dias a uma data "aaaa-mm-dd".
  static somarDias(iso: string, dias: number): string {
    const [ano, mes, dia] = iso.split("-").map(Number);
    return Datas.formatar(new Date(ano, mes - 1, dia + dias));
  }

  // Confere se o texto é uma data real (rejeita "2026-02-31", por exemplo).
  static ehValida(iso: unknown): iso is string {
    if (typeof iso !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
    const [ano, mes, dia] = iso.split("-").map(Number);
    const data = new Date(ano, mes - 1, dia);
    return data.getFullYear() === ano && data.getMonth() === mes - 1 && data.getDate() === dia;
  }

  // Quantos dias existem entre duas datas (fim - inicio).
  static diasEntre(inicio: string, fim: string): number {
    const [a1, m1, d1] = inicio.split("-").map(Number);
    const [a2, m2, d2] = fim.split("-").map(Number);
    const ms = Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1);
    return Math.round(ms / 86400000);
  }

  // "2026-11-26" -> "26/11/2026" (formato brasileiro para mostrar na tela e nos e-mails).
  static paraBR(iso: string | null): string {
    if (!iso) return "";
    const [ano, mes, dia] = iso.split("-");
    return `${dia}/${mes}/${ano}`;
  }
}
