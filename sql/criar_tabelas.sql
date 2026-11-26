-- ============================================================
-- Biblioteca Comunitária - criação das tabelas (MySQL)
-- Este script é executado AUTOMATICAMENTE quando o app inicia
-- (CREATE TABLE IF NOT EXISTS não apaga nada que já existe).
-- ============================================================

-- Quem usa o SISTEMA (login). Não confundir com "usuario", que é o leitor.
CREATE TABLE IF NOT EXISTS usuario_sistema (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  login VARCHAR(50) NOT NULL UNIQUE,
  senha_hash VARCHAR(300) NOT NULL,
  perfil ENUM('administrador','bibliotecario') NOT NULL DEFAULT 'bibliotecario',
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS editora (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(120) NOT NULL UNIQUE,
  cidade VARCHAR(80) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS autor (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(120) NOT NULL UNIQUE,
  nacionalidade VARCHAR(60) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Cada linha de "livro" é UM exemplar físico (doações repetidas viram linhas novas).
CREATE TABLE IF NOT EXISTS livro (
  id INT AUTO_INCREMENT PRIMARY KEY,
  titulo VARCHAR(200) NOT NULL,
  isbn VARCHAR(13) NULL,
  editora_id INT NULL,
  ano_publicacao SMALLINT NULL,
  paginas INT NULL,
  capa_url VARCHAR(500) NULL,
  observacao VARCHAR(255) NULL,
  CONSTRAINT fk_livro_editora FOREIGN KEY (editora_id) REFERENCES editora(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Relação N:N: um livro pode ter vários autores e um autor vários livros.
CREATE TABLE IF NOT EXISTS livro_autor (
  livro_id INT NOT NULL,
  autor_id INT NOT NULL,
  PRIMARY KEY (livro_id, autor_id),
  CONSTRAINT fk_la_livro FOREIGN KEY (livro_id) REFERENCES livro(id) ON DELETE CASCADE,
  CONSTRAINT fk_la_autor FOREIGN KEY (autor_id) REFERENCES autor(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- O leitor da biblioteca. O CPF fica CIFRADO em cpf_cifrado. O cpf_hash serve só para impedir CPF repetido.
CREATE TABLE IF NOT EXISTS usuario (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  cpf_cifrado VARCHAR(255) NOT NULL,
  cpf_hash CHAR(64) NOT NULL UNIQUE,
  email VARCHAR(150) NOT NULL,
  telefone VARCHAR(20) NULL,
  cep CHAR(8) NOT NULL,
  logradouro VARCHAR(150) NOT NULL,
  numero VARCHAR(20) NOT NULL,
  complemento VARCHAR(80) NULL,
  bairro VARCHAR(80) NULL,
  cidade VARCHAR(80) NOT NULL,
  uf CHAR(2) NOT NULL,
  distancia_km DECIMAL(7,2) NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- data_devolucao NULL = ainda está com o leitor.
CREATE TABLE IF NOT EXISTS emprestimo (
  id INT AUTO_INCREMENT PRIMARY KEY,
  livro_id INT NOT NULL,
  usuario_id INT NOT NULL,
  data_retirada DATE NOT NULL,
  data_prevista DATE NOT NULL,
  data_devolucao DATE NULL,
  aviso_enviado TINYINT(1) NOT NULL DEFAULT 0,
  observacao VARCHAR(255) NULL,
  CONSTRAINT fk_emp_livro FOREIGN KEY (livro_id) REFERENCES livro(id) ON DELETE RESTRICT,
  CONSTRAINT fk_emp_usuario FOREIGN KEY (usuario_id) REFERENCES usuario(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- status: aguardando (livro ainda na rua) -> disponivel (voltou, tem data_limite para buscar)
--         -> atendida (virou empréstimo) | expirada (não buscou a tempo) | cancelada
CREATE TABLE IF NOT EXISTS reserva (
  id INT AUTO_INCREMENT PRIMARY KEY,
  livro_id INT NOT NULL,
  usuario_id INT NOT NULL,
  data_reserva DATE NOT NULL,
  status ENUM('aguardando','disponivel','atendida','expirada','cancelada') NOT NULL DEFAULT 'aguardando',
  data_limite DATE NULL,
  aviso_enviado TINYINT(1) NOT NULL DEFAULT 0,
  observacao VARCHAR(255) NULL,
  CONSTRAINT fk_res_livro FOREIGN KEY (livro_id) REFERENCES livro(id) ON DELETE RESTRICT,
  CONSTRAINT fk_res_usuario FOREIGN KEY (usuario_id) REFERENCES usuario(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
