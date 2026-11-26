-- quem trabalha na biblioteca e faz login no sistema
CREATE TABLE IF NOT EXISTS usuario_sistema (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  login VARCHAR(50) NOT NULL UNIQUE,
  senha_hash VARCHAR(300) NOT NULL,
  perfil ENUM('administrador','bibliotecario') NOT NULL DEFAULT 'bibliotecario',
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- editoras dos livros
CREATE TABLE IF NOT EXISTS editora (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(120) NOT NULL UNIQUE,
  cidade VARCHAR(80) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- autores dos livros
CREATE TABLE IF NOT EXISTS autor (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(120) NOT NULL UNIQUE,
  nacionalidade VARCHAR(60) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- cada linha e um exemplar de livro na estante
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

-- liga livro com autor porque um livro pode ter varios autores e um autor varios livros
CREATE TABLE IF NOT EXISTS livro_autor (
  livro_id INT NOT NULL,
  autor_id INT NOT NULL,
  PRIMARY KEY (livro_id, autor_id),
  CONSTRAINT fk_la_livro FOREIGN KEY (livro_id) REFERENCES livro(id) ON DELETE CASCADE,
  CONSTRAINT fk_la_autor FOREIGN KEY (autor_id) REFERENCES autor(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- os leitores com o cpf cifrado e o hash do cpf pra nao repetir
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

-- emprestimos e se data_devolucao ta vazia o livro ainda ta com o leitor
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

-- reservas e a fila de espera de cada livro
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
