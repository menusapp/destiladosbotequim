

# Corrigir duplicados — Julio's Lanches (manter em ambas categorias)

## Problema
Os 11 produtos na categoria "MAIS VENDIDOS" são cópias sem descrição dos produtos originais que estão em suas categorias corretas.

## Solução
Em vez de deletar, **atualizar** os 11 produtos da MAIS VENDIDOS copiando a descrição e image_url dos originais. Assim os produtos ficam nas duas categorias — a original e a MAIS VENDIDOS.

## Ação
Executar UPDATE nos 11 produtos da categoria MAIS VENDIDOS (`e74c541d-36b4-4a1a-808c-791e1155cd9d`), preenchendo `description` e `image_url` com os valores dos produtos originais correspondentes.

| Produto (MAIS VENDIDOS) | ID a atualizar | Copia de |
|---|---|---|
| BRUTOS | d11c2fd9 | 8807fd6b |
| CACHORRO-QUENTE ESPECIAL | 4bde2cd3 | cb00961a |
| COMBO BRUTO DA COSTELA | 60566026 | 65e6f145 |
| COMBO NATALINO | 93557455 | 7d8f1e10 |
| COMBO NATALINO CASAL | 7144fc0f | 693f85a4 |
| COSTELA BACON | 684ab917 | d1de1403 |
| COSTELA DUPLO | a814055a | fffc4912 |
| COSTELA SALADA | fa846f11 | 84ed23ed |
| PORÇÃO FAMÍLIA | 6aef8bd3 | 15f60552 / 11320456 |
| PORÇÃO PICANHA COMPLETA | c40aae3d | db83f59d |
| SENHOR COSTELA | 20102c2f | 7cefb4cf |

## Detalhes técnicos
- Usar ferramenta de inserção/update do banco (não migration, pois é alteração de dados)
- 11 comandos UPDATE copiando `description` e `image_url` dos originais
- Nenhuma alteração de código necessária

