# Pratique + Pilates (painel)

Site do estúdio + painel admin pra agenda, alumas e conteúdo.

- **Site público:** `index.html` → [pratique-pilates.vercel.app](https://pratique-pilates.vercel.app/) (repo `pratique-pilates`)
- **Painel:** `admin.html` → [adm-pratique-pilates.vercel.app](https://adm-pratique-pilates.vercel.app/)

## Stack

- HTML / CSS / JS
- API na Vercel (`/api`)
- Postgres (Neon)

## Rodar

```bash
cp .env.example .env
# SESSION_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD, ALEX_EMAIL, ALEX_PASSWORD, DATABASE_URL
npm install
npm run dev
```

Na Vercel, as mesmas variáveis vão no projeto. Senha de exemplo do `.env.example` não passa no login de propósito.
