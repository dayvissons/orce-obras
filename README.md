# 🏗️ Controle de Obra

App web para controle financeiro de obras. Next.js 14 + Supabase + Prisma + Vercel.

---

## 🚀 PASSO A PASSO DE DEPLOY

### 1. Criar projeto no Supabase

1. Acesse https://supabase.com e crie uma conta
2. Clique em **New Project**
3. Dê um nome (ex: `obra-control`) e crie uma senha forte
4. Aguarde o projeto inicializar (~2 min)
5. Vá em **Settings → Database**
6. Copie:
   - **Connection string (Transaction mode)** → vai ser o `DATABASE_URL`
   - **Connection string (Session mode)** → vai ser o `DIRECT_URL`
   - Substitua `[YOUR-PASSWORD]` pela senha que você criou

---

### 2. Criar credenciais Google OAuth

1. Acesse https://console.cloud.google.com
2. Crie um projeto (ou use existente)
3. Vá em **APIs & Services → Credentials**
4. Clique **Create Credentials → OAuth 2.0 Client ID**
5. Tipo: **Web Application**
6. Em **Authorized redirect URIs** adicione:
   - `https://SEU-DOMINIO.vercel.app/api/auth/callback/google`
   - `http://localhost:3000/api/auth/callback/google` (para dev)
7. Copie o **Client ID** e **Client Secret**

---

### 3. Subir no GitHub

```bash
git init
git add .
git commit -m "feat: controle de obra"
git remote add origin https://github.com/SEU-USUARIO/obra-control.git
git push -u origin main
```

---

### 4. Deploy na Vercel

1. Acesse https://vercel.com e faça login com GitHub
2. Clique **New Project → Import** o repositório
3. Antes de fazer deploy, configure as variáveis de ambiente:

| Variável | Valor |
|---|---|
| `DATABASE_URL` | Connection string do Supabase (transaction mode) |
| `DIRECT_URL` | Connection string do Supabase (session mode) |
| `NEXTAUTH_URL` | `https://SEU-PROJETO.vercel.app` |
| `NEXTAUTH_SECRET` | Rode `openssl rand -base64 32` e cole o resultado |
| `GOOGLE_CLIENT_ID` | Do Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | Do Google Cloud Console |

4. Clique **Deploy**

---

### 5. Criar as tabelas no banco

Após o deploy, rode localmente:

```bash
npm install
npx prisma db push
```

Ou via Vercel CLI:
```bash
npx vercel env pull .env.local
npx prisma db push
```

---

### 6. Convidar outra pessoa

1. Peça para a pessoa acessar o app e fazer login com o Google dela
2. No app, entre na obra → botão **+ Convidar** → informe o e-mail Google dela
3. Pronto, ela terá acesso completo para editar

---

## 🗂️ Estrutura

```
src/
  app/
    page.tsx              # Lista de obras
    login/page.tsx        # Tela de login
    obras/[obraId]/       # Página da obra (serviços, materiais, resumo)
    api/
      auth/               # NextAuth
      obras/              # CRUD obras
        [obraId]/
          servicos/       # CRUD serviços + pagamentos
          materiais/      # CRUD materiais + formas de pagamento
          convidar/       # Adicionar membro à obra
  lib/
    prisma.ts             # Cliente Prisma
    auth.ts               # Config NextAuth
prisma/
  schema.prisma           # Schema do banco
```

## 📱 Funcionalidades

- Login com Google
- Múltiplas obras por usuário
- Serviços com pagamentos parciais (data + observação)
- Materiais com formas de pagamento (PIX, cartão, etc.)
- Resumo financeiro com progresso
- Compartilhamento em tabela texto para WhatsApp
- Convite de outros usuários por e-mail
- Dados compartilhados em tempo real (mesma base de dados)
