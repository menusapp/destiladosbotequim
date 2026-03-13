

## Plano: Reestruturar "Dados da Empresa" com layout profissional

### Problema atual

O `CompanyDataSettings.tsx` é uma pilha vertical de Cards sem organização — Banner, Logo, Cor, Taxa de Serviço, Campos de Cadastro, tudo empilhado. Parece amador, sem hierarquia visual.

### Solução

Reorganizar usando **Tabs internas** (como o `SettingsTab.tsx` já faz) para separar em seções lógicas, com layout em grid side-by-side onde couber na tela larga (2105px viewport).

### Estrutura proposta

**3 Tabs:**

1. **"Identidade Visual"** — Banner + Logo lado a lado (grid 2 colunas em desktop) + Cor principal inline
2. **"Operacional"** — Taxa de serviço + Tempo de preparo, layout compacto com grid 2 colunas
3. **"Cadastro de Clientes"** — Campos de cadastro (CPF, nome, telefone) com visual de lista organizada

### Detalhes de layout

- Header da página com título + descrição (sem `h2` solto, usar `tracking-[-0.025em]` conforme design system)
- Tabs horizontais no topo
- Dentro de cada tab: grid `lg:grid-cols-2` para agrupar cards lado a lado em desktop
- Banner e Logo como cards separados lado a lado em vez de empilhados
- Cor principal integrada no card de Logo (preview inline com o color picker)
- Taxa de serviço e Tempo de preparo em cards compactos lado a lado
- Cadastro com visual de lista com separadores e ícones já existentes
- Botão "Salvar" sticky no fundo de cada tab
- Remover duplicação de dados entre `CompanyDataSettings` e `SettingsTab` — o `SettingsTab.tsx` parece ser código legado não usado, manter apenas `CompanyDataSettings`

### Arquivo

| Arquivo | Mudança |
|---|---|
| `CompanyDataSettings.tsx` | Reescrever layout com Tabs internas, grid 2 colunas, visual profissional SaaS |

