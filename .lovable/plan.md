

## Corrigir caminhos do override.crt no onboarding QZ Tray

Atualizar a tela **Configurar Impressão Automática (QZ Tray)** em `src/components/admin/settings/QzTrustSetup.tsx` para mostrar os caminhos corretos de instalação e melhorar o passo a passo. Nenhuma lógica de assinatura, conexão ou impressão será alterada — apenas textos, caminhos e blocos de aviso da UI.

### Mudanças

1. **Corrigir caminhos** (objeto `PATHS`) — remover o `/auth/`:
   - Windows: `C:\Program Files\QZ Tray\override.crt`
   - macOS: `/Applications/QZ Tray.app/Contents/Resources/override.crt`
   - Linux: `/opt/qz-tray/override.crt`

2. **Atualizar a `CardDescription`** removendo a menção a "pasta de autenticação" (que sugeria `/auth/`).

3. **Passo 2 — Adicionar aviso de substituição**: novo `Alert` informando "Se já existir um `override.crt` antigo nessa pasta, substitua pelo novo."

4. **Passo 2 — Manter alerta de permissão Windows** (já existe), apenas refinar o texto para mais clareza.

5. **Passo 3 — Reforçar instrução de reinício**: deixar explícito "Feche **totalmente** o QZ Tray (clique direito no ícone → Exit) e abra novamente após copiar o certificado."

6. **Novo bloco final — "Se ainda aparecer Invalid Certificate"**: card/Alert colapsável de ajuda rápida com a checklist:
   - Feche o QZ Tray
   - Verifique se há `override.crt` antigo e substitua
   - Confirme o caminho correto
   - Abra o QZ Tray novamente
   - Teste a impressão outra vez

### O que NÃO muda

- `handleDownloadCert`, `handleTest`, `ensureQzConnected`, lógica de assinatura backend (`qz-sign`, `qz-cert`), `qzSigning.ts`, `qzConnectionManager.ts`, `printOrderWithQz.ts`, secrets `QZ_PRIVATE_KEY` / `QZ_CERTIFICATE` e o arquivo estático `public/qz-tray/override.crt` permanecem intactos.

