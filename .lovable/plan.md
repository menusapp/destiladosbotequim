

# Consolidar configurações na aba "Geral"

## Resumo
Mover as seções Horário, Regiões, Pagamentos, Impressoras e Backup para dentro da aba "Geral" como sub-abas. Simultaneamente, fundir as sub-abas internas "Operacional", "Cadastro de Clientes" e "Cardápio" em uma única sub-aba "Operacional".

## Mudanças

### 1. `AppSidebar.tsx` — Remover itens do submenu de Configurações

Remover do `configSubItems`:
- `config-horario`
- `config-regioes`
- `config-pagamentos`
- `config-impressoras`
- `config-backup`

Ficam apenas: **Geral**, **Totem** e **WhatsApp**.

### 2. `CompanyDataSettings.tsx` — Adicionar sub-abas e fundir conteúdo

**Novas sub-abas** (via TabsTrigger):
- Identidade Visual (mantém)
- Operacional (funde: Operacional + Cadastro de Clientes + Cardápio)
- Horário de Funcionamento (importa `BusinessHoursSettings`)
- Regiões de Entrega (importa `DeliveryZonesSettings`)
- Formas de Pagamento (importa `PaymentMethodsSettings` + `OnlinePaymentsSettings`)
- Impressoras (importa `PrintersSettings`)
- Backup e Restauração (importa `BackupSettings`)

**Remover** as TabsTrigger "Cadastro de Clientes" e "Cardápio". O conteúdo delas (campos de cadastro + botão pedir conta) vai para dentro da TabsContent "operational", empilhado após os cards de Taxa de Serviço e Tempo de Preparo.

### 3. `RestaurantAdmin.tsx` — Limpar cases desnecessários

Remover os `case` de `config-horario`, `config-regioes`, `config-pagamentos`, `config-impressoras`, `config-backup` do `renderContent` e do `lazyLoaders` — tudo agora é renderizado dentro de `CompanyDataSettings`.

## Arquivos impactados

| Arquivo | Mudança |
|---|---|
| `AppSidebar.tsx` | Remover 5 sub-itens de config |
| `CompanyDataSettings.tsx` | Importar 5 componentes de settings como sub-abas; fundir 3 sub-abas em 1 |
| `RestaurantAdmin.tsx` | Remover cases/imports das 5 seções movidas |

## O que NÃO muda
- Totem e WhatsApp continuam como itens separados no submenu
- Nenhum componente de settings é deletado, apenas re-hospedado
- PDV, fiscal, iFood, triggers de caixa

