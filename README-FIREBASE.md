# Trilheiros de Rondonópolis — Gestão de Passeios

Sistema em **GitHub + Firebase** para cadastro pós-pagamento e gestão dos passeios.

## O que está pronto

- link exclusivo de cadastro por passeio (`/cadastro/CODIGO`);
- nome, CPF, e-mail, quantidade de vagas e dados de todos os participantes;
- bloqueio atômico quando as vagas chegam a zero;
- prevenção de CPF duplicado no mesmo passeio;
- política de cancelamento com aceite registrado;
- área “Minha viagem” e solicitação de cancelamento;
- painel administrativo protegido por senha;
- criação/edição de novos passeios;
- controle de receita, reembolso, despesas e resultado;
- sincronização via banco Firestore na nuvem;
- exportação CSV;
- relatório PDF do passeio com nome, data e participantes;
- lembrete automático por e-mail 1 dia antes.

## Arquitetura

- **Firebase Hosting**: site e painel.
- **Cloud Firestore**: banco central.
- **Cloud Functions**: API, controle de vagas, autenticação e lembretes.
- **Resend**: e-mails automáticos.
- **GitHub**: código e histórico.

O Firestore está bloqueado para acesso direto do navegador. Os dados passam somente pelas Cloud Functions.

## Importante sobre o plano

Cloud Functions exige que o projeto Firebase esteja no plano **Blaze** para implantação. Em uso pequeno, o consumo pode ficar dentro das cotas sem custo relevante, mas o faturamento precisa estar habilitado no projeto.

## Primeira implantação

1. Crie um projeto no Firebase Console.
2. Ative o Firestore.
3. No terminal do projeto:

```bash
firebase login
firebase use --add
cd functions && npm install && cd ..
firebase functions:secrets:set RESEND_API_KEY
```

4. Crie `functions/.env`:

```env
EMAIL_FROM=Trilheiros de Rondonópolis <passeios@seudominio.com.br>
```

5. Publique:

```bash
firebase deploy --only firestore,functions,hosting
```

Depois abra `https://SEU_PROJECT_ID.web.app/admin` e crie a senha principal.

## GitHub Actions

O workflow `.github/workflows/firebase-deploy.yml` permite publicação automática. Ele usa os secrets:

- `FIREBASE_PROJECT_ID`
- `FIREBASE_SERVICE_ACCOUNT`
- `RESEND_API_KEY`
- `EMAIL_FROM`
