# 🚀 Como Gerar os Instaladores do Menu's Desktop

Este guia explica o processo completo para gerar e disponibilizar os instaladores do Menu's para download no site.

## 📋 Pré-requisitos

Antes de começar, certifique-se de ter:
- Node.js instalado (versão 18 ou superior)
- Todas as dependências instaladas (`npm install`)
- Acesso ao backend do Lovable Cloud (para atualizar URLs)

## 🔧 Passo 1: Atualizar a Versão

Antes de gerar os instaladores, atualize a versão no `package.json`:

```json
{
  "name": "menus-sistema-pedidos",
  "version": "1.0.0",  // ← Atualize este número
  ...
}
```

**Exemplo de versionamento:**
- `1.0.0` → Versão inicial
- `1.0.1` → Pequenas correções
- `1.1.0` → Novas funcionalidades
- `2.0.0` → Mudanças significativas

## 🏗️ Passo 2: Gerar os Instaladores

### Para Windows (.exe)

```bash
npm run electron:build:win
```

**Resultado:**
- Arquivo gerado em: `dist-electron/Menu's Sistema de Pedidos Setup X.X.X.exe`
- Tamanho aproximado: 80-150 MB
- Compatível com: Windows 7, 8, 10, 11 (64-bit)

### Para macOS (.dmg)

```bash
npm run electron:build:mac
```

**Resultado:**
- Arquivo gerado em: `dist-electron/Menu's Sistema de Pedidos-X.X.X.dmg`
- Tamanho aproximado: 100-180 MB
- Compatível com: macOS 10.13 (High Sierra) ou superior

### Para Linux (.AppImage e .deb)

```bash
npm run electron:build:linux
```

**Resultado:**
- Arquivos gerados em:
  - `dist-electron/Menu's Sistema de Pedidos-X.X.X.AppImage` (executável universal)
  - `dist-electron/menu-s-sistema-de-pedidos_X.X.X_amd64.deb` (Ubuntu/Debian)
- Tamanho aproximado: 90-170 MB cada
- Compatível com: Ubuntu 18.04+, Debian 10+, Fedora 32+, outras distribuições

### Gerar para Todas as Plataformas

```bash
npm run electron:build
```

⚠️ **Nota:** Para gerar instaladores Mac, você precisa estar em um Mac. Para Windows, em Windows. Linux pode ser gerado de qualquer plataforma.

## 📤 Passo 3: Fazer Upload dos Instaladores

Você precisa hospedar os arquivos gerados em algum servidor acessível publicamente. Opções:

### Opção 1: Google Drive (Simples)
1. Faça upload dos arquivos para Google Drive
2. Clique com botão direito → "Obter link"
3. Altere permissões para "Qualquer pessoa com o link"
4. Use o link direto de download

### Opção 2: Dropbox
1. Faça upload para Dropbox
2. Gere link público de compartilhamento
3. Modifique o link trocando `?dl=0` por `?dl=1` para download direto

### Opção 3: GitHub Releases (Recomendado para desenvolvedores)
1. Crie uma nova release no GitHub
2. Anexe os arquivos .exe, .dmg, .AppImage, .deb
3. Use as URLs dos assets da release

### Opção 4: Servidor Próprio / Hospedagem Web
1. Faça upload via FTP/SFTP para seu servidor
2. Certifique-se que os arquivos são acessíveis via HTTPS
3. Use as URLs completas dos arquivos

**Exemplo de estrutura de URLs:**
```
https://seudominio.com/downloads/Menu's-Setup-1.0.0.exe
https://seudominio.com/downloads/Menu's-1.0.0.dmg
https://seudominio.com/downloads/Menu's-1.0.0.AppImage
https://seudominio.com/downloads/menu-s-1.0.0.deb
```

## 🗄️ Passo 4: Atualizar o Banco de Dados

Depois de fazer upload, você precisa atualizar a tabela `app_versions` no banco de dados.

### 4.1. Acessar o Backend
No Lovable, acesse o backend clicando no botão de backend no topo do editor.

### 4.2. Atualizar Versão Anterior
Primeiro, desative a versão anterior:

```sql
UPDATE app_versions 
SET is_current = false 
WHERE is_current = true;
```

### 4.3. Inserir Nova Versão
Agora insira a nova versão com as URLs dos instaladores:

```sql
INSERT INTO app_versions (
  version,
  is_current,
  release_notes,
  download_url_windows,
  download_url_mac,
  download_url_linux
) VALUES (
  '1.0.0',  -- ← Número da versão (deve ser igual ao package.json)
  true,     -- ← Marca como versão atual
  'Versão inicial do Menu''s Desktop com todas funcionalidades: cardápio, pedidos, caixa, estoque e relatórios.',  -- ← Descrição das mudanças
  'https://seudominio.com/downloads/Menu-s-Setup-1.0.0.exe',        -- ← URL Windows
  'https://seudominio.com/downloads/Menu-s-1.0.0.dmg',              -- ← URL Mac
  'https://seudominio.com/downloads/Menu-s-1.0.0.AppImage'          -- ← URL Linux
);
```

**Exemplo com Google Drive:**
```sql
INSERT INTO app_versions (
  version,
  is_current,
  release_notes,
  download_url_windows,
  download_url_mac,
  download_url_linux
) VALUES (
  '1.0.0',
  true,
  'Lançamento inicial: Sistema completo de gestão de restaurante offline',
  'https://drive.google.com/uc?export=download&id=1ABC...XYZ',
  'https://drive.google.com/uc?export=download&id=1DEF...123',
  'https://drive.google.com/uc?export=download&id=1GHI...456'
);
```

## ✅ Passo 5: Testar os Downloads

1. Acesse seu site (landing page)
2. Role até a seção "Versão Desktop 100% Offline"
3. Clique no botão de download da sua plataforma
4. Verifique se o download inicia corretamente
5. Teste a instalação do arquivo baixado

## 🔄 Atualizações Futuras

Quando você quiser lançar uma nova versão:

1. **Faça as alterações** no código
2. **Atualize a versão** no `package.json` (ex: 1.0.0 → 1.0.1)
3. **Gere novos instaladores** com `npm run electron:build`
4. **Faça upload** dos novos arquivos
5. **Atualize o banco** com a nova versão (repita Passo 4)

Os usuários que já têm o app instalado verão automaticamente um aviso de atualização disponível ao abrir o aplicativo!

## 📊 Checklist Completo

Use este checklist para garantir que tudo foi feito corretamente:

- [ ] Versão atualizada no `package.json`
- [ ] Comando `npm run electron:build` executado com sucesso
- [ ] Instaladores gerados em `dist-electron/`
- [ ] Arquivos testados localmente (instalação funciona)
- [ ] Upload feito para servidor/hospedagem
- [ ] URLs dos arquivos acessíveis e funcionando
- [ ] Banco de dados atualizado com nova versão
- [ ] `is_current = true` apenas na versão mais recente
- [ ] Download testado pelo site funcionando
- [ ] Instalação testada a partir do download do site
- [ ] Atualização automática testada (se houver versão anterior)

## ⚠️ Troubleshooting

### Erro ao gerar instalador Mac no Windows/Linux
**Solução:** Você precisa estar em um Mac para gerar .dmg. Alternativamente, use serviços de CI/CD como GitHub Actions.

### Instalador muito grande (> 200 MB)
**Solução:** Normal. O Electron embute o Chromium e Node.js. Para reduzir tamanho, considere:
- Remover dependências não utilizadas
- Usar `asar` packing (já habilitado por padrão)

### Download não inicia no site
**Solução:** Verifique:
1. URL está correta no banco de dados
2. Arquivo está acessível publicamente (teste a URL no navegador)
3. CORS configurado corretamente (se necessário)
4. HTTPS configurado (alguns navegadores bloqueiam downloads de HTTP)

### Windows SmartScreen bloqueia instalação
**Solução:** Normal para aplicativos não assinados. Usuários podem clicar em "Mais informações" → "Executar mesmo assim". Para evitar, você pode:
- Assinar o código com certificado Windows Code Signing (~$200/ano)
- Acumular reputação ao longo do tempo (Windows aprende que o app é seguro)

### Mac "não pode ser aberto porque é de desenvolvedor não identificado"
**Solução:** Usuários podem:
1. Clicar com botão direito no app → Abrir
2. Ou ir em Preferências → Segurança → Permitir

Para evitar, você pode:
- Assinar com Apple Developer Certificate ($99/ano)
- Notarizar o app com Apple

## 📚 Recursos Adicionais

- [Documentação Electron Builder](https://www.electron.build/)
- [Guia de Distribuição Electron](https://www.electronjs.org/docs/latest/tutorial/distribution)
- [Como assinar aplicativos Windows](https://www.electron.build/code-signing#windows)
- [Como assinar aplicativos Mac](https://www.electron.build/code-signing#macos)

---

**Pronto!** Seu Menu's Desktop agora está disponível para download no site! 🎉
