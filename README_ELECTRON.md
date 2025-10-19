# Menu's - Versão Desktop (Electron)

## 📦 Aplicativo 100% Offline para Restaurantes

Este é o **Menu's Desktop**, uma versão completamente offline do sistema de pedidos que funciona 100% localmente no computador do restaurante, sem precisar de internet.

## ✨ Funcionalidades

✅ **100% Offline** - Funciona sem internet  
✅ **Banco de dados local** - SQLite armazenado no computador  
✅ **Todas as funcionalidades** - Cardápio, pedidos, caixa, estoque, relatórios  
✅ **Multi-plataforma** - Windows, Mac e Linux  
✅ **Instaladores nativos** - .exe (Windows), .dmg (Mac), .AppImage (Linux)  

## 🚀 Como usar no desenvolvimento

### 1. Instalar dependências
```bash
npm install
```

### 2. Executar em modo desenvolvimento
```bash
npm run electron:dev
```

Isso vai:
- Iniciar o Vite dev server na porta 8080
- Abrir o Electron apontando para o servidor local
- Permitir hot-reload durante desenvolvimento

### 3. Construir o aplicativo final

Para gerar os instaladores para distribuição:

#### Windows (.exe)
```bash
npm run electron:build:win
```

#### Mac (.dmg)
```bash
npm run electron:build:mac
```

#### Linux (.AppImage e .deb)
```bash
npm run electron:build:linux
```

#### Todas as plataformas
```bash
npm run electron:build
```

Os instaladores serão gerados na pasta `dist-electron/`.

## 📝 Scripts do package.json

Adicione estes scripts ao seu `package.json`:

```json
{
  "main": "electron/main.js",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "electron:dev": "concurrently \"npm run dev\" \"wait-on http://localhost:8080 && electron .\"",
    "electron:build": "npm run build && electron-builder",
    "electron:build:win": "npm run build && electron-builder --win",
    "electron:build:mac": "npm run build && electron-builder --mac",
    "electron:build:linux": "npm run build && electron-builder --linux"
  }
}
```

## 🗄️ Banco de Dados Local

O aplicativo usa **SQLite** para armazenar todos os dados localmente:

- **Localização**: `%APPDATA%/menu-s-sistema-de-pedidos/menus-local.db` (Windows)
- **Localização**: `~/Library/Application Support/menu-s-sistema-de-pedidos/menus-local.db` (Mac)
- **Localização**: `~/.config/menu-s-sistema-de-pedidos/menus-local.db` (Linux)

### Estrutura do Banco

O banco contém todas as tabelas necessárias:
- `restaurants` - Dados do restaurante
- `categories` - Categorias do cardápio
- `products` - Produtos/pratos
- `tables` - Mesas
- `orders` - Pedidos
- `order_items` - Itens dos pedidos
- `bills` - Contas/comandas
- `cash_register_sessions` - Sessões do caixa
- `cash_movements` - Movimentações financeiras
- `stock_items` - Itens de estoque
- `stock_categories` - Categorias de estoque
- `product_extras` - Adicionais dos produtos
- `users` - Usuários do sistema

### Login Padrão

Ao instalar pela primeira vez, o sistema cria:
- **Usuário**: `admin@local.com`
- **Senha**: `admin123`
- **Restaurante**: "Meu Restaurante" (slug: `meu-restaurante`)

## 🔧 Configuração Técnica

### Electron
- **Versão**: Latest
- **Processo Principal**: `electron/main.js`
- **Preload Script**: `electron/preload.js`
- **Context Isolation**: Ativado (segurança)

### Banco de Dados
- **SQLite**: via `better-sqlite3`
- **Módulo**: `electron/database.js`
- **API**: IPC handlers exposta via `window.electronDB`

### Build
- **electron-builder**: Gera instaladores nativos
- **Configuração**: `electron-builder.json`

## 📦 Distribuição

Os instaladores gerados podem ser distribuídos para os restaurantes:

### Windows
- **Arquivo**: `Menu's Sistema de Pedidos Setup X.X.X.exe`
- **Tipo**: Instalador NSIS
- **Opções**: Escolher diretório, atalho desktop

### Mac
- **Arquivo**: `Menu's Sistema de Pedidos-X.X.X.dmg`
- **Instalação**: Arrastar para pasta Applications

### Linux
- **Arquivos**: 
  - `Menu's Sistema de Pedidos-X.X.X.AppImage` (executável direto)
  - `menu-s-sistema-de-pedidos_X.X.X_amd64.deb` (Ubuntu/Debian)

## 🔒 Segurança

- ✅ Context Isolation habilitado
- ✅ NodeIntegration desabilitado
- ✅ Senhas com hash SHA-256
- ✅ IPC handlers seguros
- ✅ Dados armazenados localmente (não expostos à internet)

## 🆘 Suporte

Para problemas ou dúvidas:
1. Verifique os logs do Electron (Console DevTools)
2. Verifique a localização do banco de dados
3. Teste primeiro em modo desenvolvimento (`npm run electron:dev`)

## 🎯 Próximos Passos

1. **Customizar o ícone**: Substitua `public/favicon.ico` por um ícone de 256x256
2. **Testar em todas as plataformas**: Windows, Mac, Linux
3. **Criar documentação para usuários finais**
4. **Configurar auto-update** (opcional, para versões futuras)

---

**Desenvolvido com ❤️ para restaurantes que querem autonomia total!**
