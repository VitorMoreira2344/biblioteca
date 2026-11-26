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
