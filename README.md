# biblioteca comunitaria

## logins

admin (criado no primeiro acesso)

- login: definido no cadastro
- senha: definida no primeiro acesso

bibliotecario (o admin cria esse na tela de usuarios do sistema)

- login: definido pelo admin
- senha: definida pelo admin

## isbn pra testar

- 9788535914849 - 1984
- 9788532530783 - harry potter e a pedra filosofal
- 9788595084759 - o senhor dos aneis: a sociedade do anel
- 9788582850350 - dom casmurro
- 9788525432186 - sapiens

é só colar o isbn no cadastro de livro que o sistema puxa o resto sozinho

## seguranca e por que a gente fez assim

| o que a gente fez | por que |
|---|---|
| senha vira hash com scrypt e um sal aleatorio e nunca fica salva de verdade | se o banco vazar ninguem consegue ler as senhas |
| cpf fica cifrado com aes-256-gcm no banco e aparece escondido nas listas tipo `***456789-**` | cpf e dado pessoal e a lgpd pede cuidado com isso |
| tem um hash do cpf (hmac) so pra saber se o cpf ja existe | assim da pra barrar cpf repetido sem precisar abrir o cpf de ninguem |
| tem dois perfis admin e bibliotecario e so o admin apaga coisa e mexe nos usuarios | o voluntario que ajuda na biblioteca nao consegue apagar o historico de emprestimos |
| a permissao e checada no processo principal e nao so escondendo botao | a tela pode ser mexida entao o sistema nao confia nela |
| depois de 5 senhas erradas o login trava por 5 minutos e a mensagem de erro e sempre a mesma | fica dificil ficar chutando senha e ninguem descobre quais logins existem |
| todo sql usa parametro com ? | ninguem consegue fazer sql injection |
| tudo que vem da tela e validado de novo no servidor tipo cpf com digito isbn cep email datas e tamanho | a gente nunca confia no que vem da tela |
| tudo que aparece na tela passa por escape de html ate o que vem das apis | ninguem consegue enfiar codigo na tela (xss) |
| electron com contextisolation e nodeintegration desligado e sandbox e o preload so libera uma funcao e tem csp nas paginas e a navegacao e bloqueada | se algo malicioso entrar na tela nao chega no computador |
| as senhas do banco e do email ficam no arquivo env que nao vai pro github | nada de senha escrita no codigo |
| erro tecnico fica so no console e a tela mostra uma mensagem simples | nao vaza detalhe do banco pra quem ta usando |
| capa de livro so aceita link https | evita link javascript e arquivo do computador |
| nao da pra apagar livro ou leitor que tem historico e nem o ultimo admin | ninguem perde o registro de quem pegou o que e o sistema nunca fica sem admin |
