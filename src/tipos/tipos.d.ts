// resposta que toda rota devolve pra tela
interface RespostaIpc<T = any> {
  ok: boolean;
  dados?: T;
  erro?: string;
}

// os dois perfis de quem usa o sistema
type PerfilAcesso = "administrador" | "bibliotecario";

// usuario do sistema
interface UsuarioSistema {
  id: number;
  nome: string;
  login: string;
  perfil: PerfilAcesso;
  ativo: number;
  senha?: string;
}

// autor
interface Autor {
  id: number;
  nome: string;
  nacionalidade: string | null;
}

// editora
interface Editora {
  id: number;
  nome: string;
  cidade: string | null;
}

// situacao de um livro
type StatusLivro = "disponivel" | "emprestado" | "reservado";

// livro com os dados prontos pra mostrar
interface Livro {
  id: number;
  titulo: string;
  isbn: string | null;
  editora_id: number | null;
  editora: string | null;
  autores: string;
  ano_publicacao: number | null;
  paginas: number | null;
  capa_url: string | null;
  observacao: string | null;
  status: StatusLivro;
  emprestado_para: string | null;
  devolucao_prevista: string | null;
  reservas_ativas: number;
}

// o que as apis devolvem quando busca o isbn
interface DadosLivroIsbn {
  titulo: string;
  autores: string[];
  editora: string | null;
  ano_publicacao: number | null;
  paginas: number | null;
  capa_url: string | null;
  fonte: string;
}

// leitor e o cpf completo so vem quando vai editar
interface Usuario {
  id: number;
  nome: string;
  cpf?: string;
  cpf_mascarado?: string;
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

// resposta da busca de cep com o aviso de distancia
interface ResultadoCep {
  status: "ok" | "inexistente" | "indisponivel";
  endereco?: { logradouro: string; bairro: string; cidade: string; uf: string };
  distanciaKm?: number | null;
  mesmoBairro?: boolean;
  dentroDaRegiao?: boolean | null;
  aviso?: string;
}

// emprestimo com os dados do leitor pra cobrar
interface Emprestimo {
  id: number;
  livro_id: number;
  usuario_id: number;
  titulo: string;
  usuario_nome: string;
  telefone: string | null;
  email: string;
  endereco: string;
  data_retirada: string;
  data_prevista: string;
  data_devolucao: string | null;
  observacao: string | null;
  atrasado: boolean;
  dias_atraso: number;
}

// situacoes de uma reserva
type StatusReserva = "aguardando" | "disponivel" | "atendida" | "expirada" | "cancelada";

// reserva com a posicao na fila
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

// numeros e listas da tela inicial
interface ResumoPainel {
  total_livros: number;
  livros_emprestados: number;
  total_usuarios: number;
  atrasados: Emprestimo[];
  vencendo: Emprestimo[];
  reservas_para_retirar: Reserva[];
  email_configurado: boolean;
}

// quantos avisos foram mandados numa rodada
interface ResultadoNotificacao {
  reservas_avisadas: number;
  vencimentos_avisados: number;
  reservas_expiradas: number;
  simulados: number;
  falhas: number;
}
