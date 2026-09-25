# Pratique + Pilates — painel admin

Painel do estúdio: agenda, alunas e conteúdo. O site público fica no repo [pratique-pilates](https://github.com/kauanbg-dev/pratique-pilates).

- **Site:** [pratique-pilates.vercel.app](https://pratique-pilates.vercel.app/)
- **Painel:** [adm-pratique-pilates.vercel.app](https://adm-pratique-pilates.vercel.app/)

## Stack

- HTML, CSS e JavaScript
- API serverless na Vercel (`/api`)
- PostgreSQL (Neon)

## Como rodar

```bash
cp .env.example .env
# SESSION_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD, ALEX_EMAIL, ALEX_PASSWORD, DATABASE_URL
npm install
npm run dev
```

As mesmas variáveis vão no painel da Vercel. Os valores de exemplo do `.env.example` não autenticam de propósito.
