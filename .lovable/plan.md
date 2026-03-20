
# Melhorias ERP — Status de Implementação

| # | Prompt | Status | Notas |
|---|--------|--------|-------|
| 7 | package.json metadata | ✅ Concluído | name, version, description atualizados |
| 3 | Strip console.logs (terser) | ✅ Concluído | terser instalado, vite.config.ts configurado |
| 4 | CORS restrito edge functions | ✅ Concluído | 11 funções atualizadas com ALLOWED_ORIGIN |
| 2 | Reduzir `any` TypeScript | ⚠️ Parcial | Maioria dos `as any` são necessários (Supabase types não expõe tabelas custom) |
| 1 | Hash bcrypt de senhas | ✅ Concluído | pgcrypto habilitado, RPCs com compatibilidade dual (bcrypt + plaintext auto-upgrade), edge functions hash-password e verify-password criadas, CEODashboard usa hash na criação |
| 5 | Refatorar componentes grandes | ⏳ Pendente | 4795 linhas em 4 arquivos — requer implementação gradual para evitar regressão |
| 6 | Unificar ProtectedRoute | ❌ Pulado | Quebraria login de todos os restaurantes (dependem de localStorage) |
