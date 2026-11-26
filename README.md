# Biblioteca Comunitária

Projeto Final de DAD (Desenvolvimento de Aplicações Desktop): sistema desktop em **Electron + TypeScript + MySQL**
para organizar o acervo, os leitores, os empréstimos e as reservas de uma biblioteca comunitária de bairro.

## O problema (pedido do cliente)

O dono emprestava os livros numa caderneta e já perdeu livros por não saber quem devolveu. O sistema resolve:

- cadastro de **livros, autores, editoras e leitores** (com CPF e endereço);
- **empréstimos** com data de retirada e prazo, com **destaque de quem está atrasado**;
- **reservas** de livros emprestados (fila), com aviso quando o livro volta e expiração depois de 1 dia;
- **busca automática pelo ISBN** (título, autor, editora, ano, páginas e capa);
- **busca de endereço pelo CEP** e verificação de que o leitor mora perto da biblioteca;
- **e-mail automático** quando o prazo está para vencer e quando o livro reservado volta.

## Como rodar

Pré-requisitos: Node.js 20 ou mais novo e acesso a um servidor MySQL.

```bash
npm install
```

Crie um arquivo `.env` na raiz do projeto e preencha (arquivos `.env*` **não vão para o GitHub**):

| Variável | Para quê |
|---|---|
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | conexão com o MySQL |
| `CHAVE_CRIPTOGRAFIA` | chave que cifra o CPF. Gere com `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `BIBLIOTECA_CEP`, `RAIO_REGIAO_KM` | onde fica a biblioteca e até quantos km o leitor é "da região" |
| `SMTP_*`, `EMAIL_REMETENTE` | envio real de e-mail. **Se ficar vazio, os e-mails são simulados** (aparecem no console) |

Depois:

```bash
npm start
```

As tabelas são criadas **sozinhas** na primeira execução (script em `sql/criar_tabelas.sql`).
No primeiro acesso o sistema pede para criar o usuário **administrador**; não existe senha padrão.

> Guarde a `CHAVE_CRIPTOGRAFIA`: sem ela os CPFs já cadastrados não podem ser lidos.

## Requisitos da avaliação e onde cada um está

| # | Requisito | Como foi atendido |
|---|---|---|
| 1 | Banco relacional, mínimo 6 tabelas relacionadas | **8 tabelas** com chaves estrangeiras (diagrama abaixo) |
| 2 | CRUD completo de todas as entidades | Autores, editoras, livros, leitores, empréstimos, reservas e usuários do sistema têm Create/Read/Update/Delete. A tabela `livro_autor` (N:N) é gerida pelo cadastro do livro |
| 3 | API em pelo menos 4 situações distintas | 4 APIs públicas, cada uma com função própria (tabela abaixo) |
| 4 | Segurança como parte do projeto | Seção "Decisões de segurança" |
| 5 | Código modularizado em classes (POO) | Toda a lógica está em classes (`Servico*`, `Api*`, `Banco`, `Seguranca`, `Validador`, `Tela*`...) |
| 6 | Electron com TypeScript | 100% da lógica em `.ts`; o `.js` só existe em `dist/` (gerado pelo `tsc`, ignorado pelo Git) |

### Banco de dados

```
usuario_sistema            (login de quem trabalha na biblioteca)

editora 1───N livro N───N autor          (livro_autor é a tabela de ligação)
                │
                ├──N emprestimo N───1 usuario (leitor)
                └──N reserva    N───1 usuario (leitor)
```

Tabelas: `usuario_sistema`, `editora`, `autor`, `livro`, `livro_autor`, `usuario`, `emprestimo`, `reserva`.

### As 4 APIs

| API | Onde é usada | Finalidade real |
|---|---|---|
| **Open Library** (com **Google Books** de reserva) | Cadastro de livro | Digitou o ISBN, o sistema preenche título, autores, editora, ano, páginas e capa |
| **ViaCEP** | Cadastro de leitor | Digitou o CEP, preenche o endereço e confirma que o CEP existe |
| **Nominatim (OpenStreetMap)** | Cadastro de leitor | Calcula a distância até a biblioteca e avisa se o leitor mora fora da região |
| **BrasilAPI (feriados)** | Empréstimo e renovação | O prazo de devolução não pode cair em feriado: é empurrado para o próximo dia livre |

Se uma API estiver fora do ar, o sistema **não trava**: mostra uma mensagem e deixa preencher à mão.

## Regras de negócio

- Cada registro de livro é **um exemplar**. Livro emprestado não pode ser emprestado de novo.
- Empréstimo vence em 14 dias (ajustável na tela). Empréstimo vencido aparece como **ATRASADO** (fundo preto) na tela inicial, na lista de empréstimos e no contador do menu, com telefone e endereço do leitor para cobrar.
- **Reserva**: só de livro que está fora da estante. Entra numa **fila**. Quando o livro é devolvido, o 1º da fila fica com a reserva "disponível", recebe e-mail e tem **1 dia** para buscar. Se não buscar, a reserva **expira**: passa para o próximo da fila ou, se não há fila, o livro fica livre para qualquer um. Livro reservado não pode ser emprestado a outra pessoa.
- **E-mails automáticos** (ao abrir o programa, a cada 10 minutos e depois de cada devolução): reserva disponível e prazo vencendo em até 2 dias (ou já vencido). Cada aviso é enviado uma única vez.
- Não se exclui livro ou leitor que tenha histórico de empréstimo/reserva (para não perder o registro).
- As regras (prazos, dias de aviso) ficam em `src/main/config/Configuracao.ts`.

## Decisões de segurança (e por quê)

| Decisão | Motivo |
|---|---|
| **Senhas com hash scrypt + sal aleatório**; nunca em texto | Se o banco vazar, as senhas não podem ser lidas |
| **CPF cifrado (AES-256-GCM)** no banco e mascarado nas listas (`***.456.789-**`); uma impressão digital (HMAC) impede CPF repetido | CPF é dado pessoal (LGPD). Só aparece completo ao editar o leitor |
| **Login e perfis**: *administrador* e *bibliotecário*. Só o administrador exclui registros e gerencia usuários | O voluntário que ajuda na biblioteca não consegue apagar o histórico de empréstimos |
| **Permissão checada no processo principal** (`ipc/Rotas.ts`), não só escondendo botões | A tela pode ser manipulada; o servidor não confia nela |
| **Bloqueio após 5 senhas erradas** (5 min) e mensagem de erro sempre igual | Dificulta adivinhar senha e descobrir logins |
| **SQL parametrizado** (`?`) em todas as consultas | Impede SQL Injection |
| **Validação de toda entrada** no servidor (`Validador`): CPF com dígito verificador, ISBN, CEP, e-mail, datas, tamanhos | Nunca confiamos no que vem da tela |
| **Escape de HTML** em tudo que é exibido (inclusive títulos que vêm das APIs) | Impede XSS |
| **Electron endurecido**: `contextIsolation`, `nodeIntegration: false`, `sandbox`, preload expõe só 1 função, CSP nas páginas, navegação bloqueada | Se algo malicioso entrar na tela, não alcança o computador |
| **Segredos no `.env`** (fora do Git) | Nada de senha escrita no código |
| **Erros técnicos não vão para a tela** (ficam no console) | Não vazar detalhes do banco |
| Capa de livro só aceita `https://` | Evita `javascript:` e arquivos locais |

## Estrutura

```
sql/criar_tabelas.sql          tabelas
src/tipos/                     tipos TypeScript compartilhados
src/main/                      PROCESSO PRINCIPAL (Node)
  main.ts, JanelaPrincipal.ts, preload.ts
  banco/Banco.ts               conexão MySQL e transações
  config/Configuracao.ts       .env e regras fixas
  seguranca/                   Seguranca.ts (hash, cifra) e Sessao.ts
  util/                        Validador, Datas, ErroNegocio
  apis/                        ApiLivros, ApiCep, ApiGeolocalizacao, ApiFeriados
  servicos/                    uma classe por assunto (livro, emprestimo, reserva, e-mail...)
  ipc/Rotas.ts                 liga a tela aos serviços, com checagem de permissão
src/renderer/                  TELA
  login.html, app.html, estilo.css
  ts/                          uma classe por tela (TelaLivros, TelaEmprestimos...)
tests/testes.ts                testes automáticos das regras
```

## Testes

`npm test` roda 93 verificações das regras de negócio contra um MySQL real (as 4 APIs são simuladas).
Ele **apaga e recria as tabelas**, por isso só roda em banco com "teste" no nome (ex.: `biblioteca_teste`).
Aponte o `.env` para esse banco antes de rodar.
