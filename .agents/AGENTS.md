# Workspace Rules for AçaíFood

- **Official Production Link:** Always use `https://www.acaifood.app.br/` (and `https://acai-food-mobile.vercel.app/`) when referencing or displaying the deployed production web app to the user.
- **Project Architecture:** Monorepo using Next.js (App Router), React 19, Tailwind CSS v4, Zustand (state management), Lucide Icons, and Supabase (PostgreSQL, Auth, Realtime, Storage).
- **Code Quality Standards:**
  - TypeScript strict typing (avoid `any` where possible).
  - Modern Next.js server/client components separation with explicit `'use client'` where hooks or browser APIs are used.
  - Responsive, mobile-first design prioritizing smooth UI/UX on mobile devices and desktop views.
  - Safe Supabase queries with proper error handling and optimistic UI updates where applicable.
- **Idioma de Comunicação:** Responder sempre em Português do Brasil (PT-BR).
