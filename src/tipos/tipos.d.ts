// ============================================================
// Tipos compartilhados entre o processo principal (main) e a tela (renderer).
// Como este arquivo não tem import/export, tudo aqui é GLOBAL.
// ============================================================

// Todo canal IPC responde neste formato: ou deu certo (ok) ou veio uma mensagem de erro.
interface RespostaIpc<T = any> {
  ok: boolean;
  dados?: T;
  erro?: string;
}

type PerfilAcesso = "administrador" | "bibliotecario";

interface UsuarioSistema {
  id: number;
  nome: string;
  login: string;
  perfil: PerfilAcesso;
  ativo: number;
  senha?: string; // só vem do formulário, nunca é devolvido pelo banco
}

interface Autor {
  id: number;
  nome: string;
  nacionalidade: string | null;
}

interface Editora {
  id: number;
  nome: string;
  cidade: string | null;
}

type StatusLivro = "disponivel" | "emprestado" | "reservado";

interface Livro {
  id: number;
  titulo: string;
  isbn: string | null;
  editora_id: number | null;
  editora: string | null; // nome da editora (vem do JOIN)
  autores: string; // nomes separados por vírgula
  ano_publicacao: number | null;
  paginas: number | null;
  capa_url: string | null;
  observacao: string | null;
  status: StatusLivro;
  emprestado_para: string | null;
  devolucao_prevista: string | null;
  reservas_ativas: number;
}

// O que as APIs de ISBN devolvem para preencher o cadastro do livro.
interface DadosLivroIsbn {
  titulo: string;
  autores: string[];
  editora: string | null;
  ano_publicacao: number | null;
  paginas: number | null;
  capa_url: string | null;
  fonte: string; // "Open Library" ou "Google Books"
}

interface Usuario {
  id: number;
  nome: string;
  cpf?: string; // CPF completo: só vem ao abrir UM usuário para editar
  cpf_mascarado?: string; // ***.456.789-** (usado nas listas)
  email: string;
  telefone: string | null;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string | null;
  bairro: string | null;
  cidade: string;
  uf: string;
  distancia_km: number | null;
}

interface ResultadoCep {
  status: "ok" | "inexistente" | "indisponivel";
  endereco?: { logradouro: string; bairro: string; cidade: string; uf: string };
  distanciaKm?: number | null;
  mesmoBairro?: boolean;
  dentroDaRegiao?: boolean | null;
  aviso?: string;
}

interface Emprestimo {
  id: number;
  livro_id: number;
  usuario_id: number;
  titulo: string;
  usuario_nome: string;
  telefone: string | null;
  email: string;
  endereco: string; // endereço do leitor (para o dono ir cobrar/buscar)
  data_retirada: string;
  data_prevista: string;
  data_devolucao: string | null;
  observacao: string | null;
  atrasado: boolean;
  dias_atraso: number;
}

type StatusReserva = "aguardando" | "disponivel" | "atendida" | "expirada" | "cancelada";

interface Reserva {
  id: number;
  livro_id: number;
  usuario_id: number;
  titulo: string;
  usuario_nome: string;
  data_reserva: string;
  status: StatusReserva;
  data_limite: string | null;
  posicao_fila: number | null;
  observacao: string | null;
}

interface ResumoPainel {
  total_livros: number;
  livros_emprestados: number;
  total_usuarios: number;
  atrasados: Emprestimo[];
  vencendo: Emprestimo[];
  reservas_para_retirar: Reserva[];
  email_configurado: boolean;
}

interface ResultadoNotificacao {
  reservas_avisadas: number;
  vencimentos_avisados: number;
  reservas_expiradas: number;
  simulados: number;
  falhas: number;
}
