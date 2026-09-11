# Assistente Instagram — ativação oficial

## O que já está implementado

- webhook oficial para comentários e mensagens;
- validação `X-Hub-Signature-256` com o segredo do aplicativo;
- idempotência para não responder duas vezes ao mesmo evento;
- consulta em tempo real à coleção `trips` do Trilheiros Gestão;
- identificação do passeio pelo texto, publicação ou contexto da conversa;
- respostas humanizadas para preço, vagas, data, saída, destino, nível, idade, inclusos e reserva;
- encaminhamento humano para pagamento, comprovante, cancelamento, reembolso, reclamação e emergência;
- limite por pessoa para evitar spam;
- modo “Sugerir respostas”, modo automático e “Jonatas assume”;
- histórico operacional e simulador no painel;
- resposta privada comentário → Direct opcional e desligada por padrão.

## URLs do aplicativo

- Webhook: `https://trilheiros-reservas.web.app/instagram/webhook`
- Painel: `https://trilheiros-reservas.web.app/admin?tab=instagram`
- Política de privacidade: `https://trilheiros-reservas.web.app/instagram-privacy.html`
- Exclusão de dados: `https://trilheiros-reservas.web.app/instagram-data-deletion.html`

## Segredos necessários no Firebase

Criar no projeto `trilheiros-reservas` antes do primeiro deploy das Functions:

- `META_INSTAGRAM_VERIFY_TOKEN`: frase longa aleatória usada na validação do webhook;
- `META_INSTAGRAM_ACCESS_TOKEN`: token de longa duração da conta profissional;
- `META_APP_SECRET`: segredo do aplicativo Meta;
- `INSTAGRAM_BUSINESS_ACCOUNT_ID`: ID da conta profissional `@trilheiros.roomt`.

Com Firebase CLI autenticado:

```bash
firebase functions:secrets:set META_INSTAGRAM_VERIFY_TOKEN --project trilheiros-reservas
firebase functions:secrets:set META_INSTAGRAM_ACCESS_TOKEN --project trilheiros-reservas
firebase functions:secrets:set META_APP_SECRET --project trilheiros-reservas
firebase functions:secrets:set INSTAGRAM_BUSINESS_ACCOUNT_ID --project trilheiros-reservas
```

Depois, execute manualmente o workflow GitHub Actions `Publicar Assistente Instagram`.

## Configuração na Meta

1. A conta deve ser profissional e pertencer ao negócio dos Trilheiros.
2. Criar/configurar um aplicativo Meta para Instagram.
3. Adicionar o produto Instagram e a conta `@trilheiros.roomt`.
4. Solicitar os recursos/permissões oficiais para gerenciar comentários e mensagens da conta profissional.
5. Cadastrar o webhook acima e usar exatamente o mesmo Verify Token salvo no Firebase.
6. Assinar os campos `comments`, `live_comments` quando aplicável e `messages`.
7. Usar as páginas públicas de privacidade e exclusão de dados nas configurações do aplicativo.
8. Manter o aplicativo em teste enquanto somente administradores/testadores interagem.
9. Concluir o nível de acesso/revisão exigido pela Meta antes de atender pessoas que não sejam testadoras.

Os nomes das permissões dependem do fluxo escolhido no painel da Meta. No fluxo Instagram Login atual, conferir `instagram_business_manage_comments` e `instagram_business_manage_messages`. Não usar senha do Instagram, extensão, Selenium ou automação de navegador.

## Liberação segura

1. Abrir o painel “Assistente Instagram”.
2. Manter `Atendente ligado` desligado e usar o simulador.
3. Ativar `Sugerir respostas` com comentários e Direct habilitados.
4. Fazer testes com contas autorizadas.
5. Conferir preço, vagas, data e passagem para atendimento humano.
6. Só então mudar para `Responder automaticamente`.
7. Manter comentário → Direct desligado na primeira semana; ativar somente após validar a resposta pública.

