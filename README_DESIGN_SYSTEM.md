# Menus - Sistema de Gestão de Restaurantes
## Design System & Customização

### 🎨 Cores do Sistema

O sistema utiliza as seguintes cores principais (definidas em `src/index.css`):

- **Primária (Laranja)**: `#fe9516` - Usada em botões, destaques e elementos ativos
- **Primária Hover**: `#e28312` - Estado hover dos elementos primários
- **Texto Principal**: `#111827` - Cor principal do texto
- **Texto Secundário**: `#6b7280` - Legendas, descrições, labels
- **Bordas**: `#e5e7eb` - Bordas de cards e inputs
- **Sucesso**: `#22c55e` - Mensagens e estados de sucesso
- **Alerta**: `#facc15` - Avisos e alertas
- **Erro**: `#ef4444` - Erros e estados destrutivos
- **Fundo**: Gradiente radial suave de branco para `#fff8ef`

### 🖼️ Como trocar o Logo

1. Substitua o arquivo em `/public/logo-menus.png` pela sua logo
2. Mantenha proporções quadradas (recomendado: 512x512px)
3. O logo aparecerá automaticamente na sidebar e header

### 🎨 Como alterar as cores

Edite o arquivo `src/index.css` na seção `:root`:

```css
:root {
  /* Mude a cor primária aqui */
  --primary: 25 99% 54%; /* formato HSL sem 'hsl()' */
  --primary-hover: 25 92% 48%;
  
  /* Para converter HEX para HSL use: https://www.w3schools.com/colors/colors_converter.asp */
}
```

**Exemplo**: Para mudar para azul `#0066ff`:
1. Converta para HSL: `220 100% 50%`
2. Substitua os valores:
```css
--primary: 220 100% 50%;
--primary-hover: 220 100% 45%; /* um pouco mais escuro */
```

### 🌙 Dark Mode (Opcional)

O Dark Mode já está preparado no arquivo `src/index.css` na seção `.dark`.

Para ativar globalmente, adicione a classe `dark` no elemento `<html>`:

```tsx
// Em src/main.tsx ou src/App.tsx
useEffect(() => {
  document.documentElement.classList.add('dark');
}, []);
```

Ou crie um botão toggle:

```tsx
const toggleDarkMode = () => {
  document.documentElement.classList.toggle('dark');
};

<Button onClick={toggleDarkMode}>
  {isDark ? "Modo Claro" : "Modo Escuro"}
</Button>
```

### 📐 Dimensões e Espaçamentos

- **Sidebar**: 240px (fixa)
- **Cards**: raio de borda 12px
- **Botões**: altura 40px, raio 10px
- **Padding de página**: 24px
- **Gap entre cards**: 24px (1.5rem)
- **Cards de métrica**: largura mínima 320px em desktop

### 🔤 Tipografia

O sistema usa a fonte sans-serif padrão do sistema com:

- **H1**: 32px, peso 700 (Dashboard)
- **H2**: 24px, peso 700 (Seções)
- **H3**: 18px, peso 600 (Cards)
- **Body**: 14px, peso 400-500
- **Caption**: 12px, peso 400

### 🎯 Componentes Reutilizáveis

Todos os componentes estão em `src/components/ui/`:

- **Button**: Botões primários e secundários
- **Card**: Cards com sombra padrão
- **Input**: Inputs com borda e foco em laranja
- **Badge**: Tags de status
- **Tabs**: Abas para navegação

### 📱 Responsividade

O sistema é responsivo seguindo breakpoints do Tailwind:

- **Mobile**: < 768px (1 coluna)
- **Tablet**: 768px - 1024px (2 colunas)
- **Desktop**: > 1024px (3-4 colunas)

### ⚡ Próximos Passos

Esta é a **Etapa 1** da reestruturação. Foram entregues:

- ✅ Design System completo atualizado
- ✅ Dashboard completamente redesenhado
- ✅ Sidebar moderna com logo
- ✅ Gradiente de fundo suave
- ✅ Cards de métricas com cores específicas

**Próximas telas a refazer (peça uma de cada vez)**:
- Etapa 2: Mesas + Cardápio (Produtos e Categorias)
- Etapa 3: Balcão + Pedidos + Cozinha
- Etapa 4: Contas + Estoque
- Etapa 5: Relatórios + DRE + Custos

### 🧪 Teste Manual

1. Dashboard mostra números reais do dia ✓
2. Cards têm cores distintas (verde, azul, laranja, roxo) ✓
3. Seções "Pedidos Recentes" e "Contas Abertas" exibem dados ✓
4. Sidebar tem logo e estrutura limpa ✓
5. Gradiente de fundo visível e suave ✓
