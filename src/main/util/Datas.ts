// ajudantes pra mexer com datas no formato ano-mes-dia
export class Datas {
  // data de hoje
  static hoje(): string {
    return Datas.formatar(new Date());
  }

  // transforma um date em texto ano-mes-dia
  static formatar(data: Date): string {
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, "0");
    const dia = String(data.getDate()).padStart(2, "0");
    return `${ano}-${mes}-${dia}`;
  }

  // soma ou tira dias de uma data
  static somarDias(iso: string, dias: number): string {
    const [ano, mes, dia] = iso.split("-").map(Number);
    return Datas.formatar(new Date(ano, mes - 1, dia + dias));
  }

  // confere se a data existe mesmo tipo nada de 31 de fevereiro
  static ehValida(iso: unknown): iso is string {
    if (typeof iso !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
    const [ano, mes, dia] = iso.split("-").map(Number);
    const data = new Date(ano, mes - 1, dia);
    return data.getFullYear() === ano && data.getMonth() === mes - 1 && data.getDate() === dia;
  }

  // quantos dias tem entre duas datas
  static diasEntre(inicio: string, fim: string): number {
    const [a1, m1, d1] = inicio.split("-").map(Number);
    const [a2, m2, d2] = fim.split("-").map(Number);
    const ms = Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1);
    return Math.round(ms / 86400000);
  }

  // mostra a data no jeito brasileiro dia/mes/ano
  static paraBR(iso: string | null): string {
    if (!iso) return "";
    const [ano, mes, dia] = iso.split("-");
    return `${dia}/${mes}/${ano}`;
  }
}
