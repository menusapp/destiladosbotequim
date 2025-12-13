# Menu's - Guia de Build

## Pré-requisitos

- Node.js 18+ 
- npm ou yarn
- Windows: Visual Studio Build Tools (para compilar better-sqlite3)
- Mac: Xcode Command Line Tools
- Linux: build-essential, python3

## Scripts de Build

### Desenvolvimento
```bash
# Iniciar em modo desenvolvimento (web)
npm run dev

# Iniciar Electron em modo desenvolvimento
npm run electron:dev
```

### Produção
```bash
# Build apenas do frontend (web)
npm run build

# Build do executável Windows
npm run electron:build:win

# Build do executável Mac
npm run electron:build:mac

# Build do executável Linux
npm run electron:build:linux

# Build para todas as plataformas
npm run electron:build:all
```

## Estrutura de Pastas (Executável)

Após instalação, o sistema cria automaticamente:

```
[Pasta do Usuário]/MenusData/
├── database/
│   └── menus-local.db          # Banco SQLite principal
├── images/
│   ├── products/               # Imagens de produtos
│   ├── logos/                  # Logos de restaurantes
│   └── banners/                # Banners
├── backups/
│   ├── daily/                  # Backups automáticos diários
│   └── manual/                 # Backups manuais
├── exports/                    # Relatórios exportados
└── config/
    └── settings.json           # Configurações locais
```

## Configurações de Build

### Windows (NSIS Installer)
- Instalador com opção de escolher diretório
- Atalho na área de trabalho e menu iniciar
- Suporte a x64 e x86

### Mac (DMG)
- Imagem de disco arrastável
- Suporte a Intel e Apple Silicon

### Linux
- AppImage (portátil, não requer instalação)
- DEB (Debian/Ubuntu)
- RPM (Fedora/RHEL)

## Variáveis de Ambiente

O executável funciona 100% offline, mas para funcionalidades cloud:

```env
# Opcional - para sync e delivery externo
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sua-chave-anon
```

## Solução de Problemas

### Erro ao compilar better-sqlite3
```bash
# Windows
npm install --global windows-build-tools

# Mac
xcode-select --install

# Linux
sudo apt-get install build-essential python3
```

### Erro de permissão no Mac
```bash
chmod +x "Menu's - Sistema de Pedidos.app/Contents/MacOS/Menu's - Sistema de Pedidos"
```

### Erro de sandbox no Linux
```bash
chmod +x Menu\'s-*.AppImage
./Menu\'s-*.AppImage --no-sandbox
```

## Backup e Restauração

### Backup Manual
No app: Menu → Configurações → Backup → Criar Backup

### Restaurar Backup
No app: Menu → Configurações → Backup → Restaurar → Selecionar arquivo

### Backup Automático
- Diário: Mantém últimos 7 dias
- Semanal: Mantém últimas 4 semanas
- Mensal: Mantém últimos 12 meses

## Suporte

Para dúvidas ou problemas:
- Email: suporte@menus.com.br
- WhatsApp: (XX) XXXXX-XXXX
