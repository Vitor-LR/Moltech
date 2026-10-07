# Moltech

Tabela periódica interativa com os 118 elementos. Ao selecionar um elemento, o
Moltech mostra a estrutura do átomo (modelo de Bohr animado), a distribuição dos
elétrons nos orbitais, os íons que ele forma e suas propriedades.

Projeto acadêmico escrito em **Go**, só com a biblioteca padrão. A estrutura
eletrônica não fica gravada em arquivo: é **calculada a partir do número
atômico**.

## Como rodar

Precisa do Go 1.22 ou mais novo.

```bash
go run .                 # http://localhost:8080
go run . -addr :3000     # outra porta
go test ./...            # testes
go run . -export docs    # gera o site estático em docs/
```

Com `make`: `make rodar`, `make testar`, `make exportar`, `make compilar`.

O executável é autossuficiente: HTML, CSS, JavaScript, fontes e dados são
embutidos no binário com `embed`.

## O que o site tem

Três páginas, acessadas pelo menu do cabeçalho:

- **Tabela** — os 118 elementos. O seletor *Visualizar por* muda o critério de
  cor: por **classificação** (categoria, bloco, tipo de metal, estado físico) ou
  por **propriedade** (ponto de fusão, ebulição, densidade, eletronegatividade,
  ionização, afinidade eletrônica, raio), com escala de cor e controle
  deslizante. Legenda clicável e busca por nome, símbolo ou número.
- **Íons** — 100 cátions e ânions, monoatômicos e poliatômicos, com massa molar.
- **Configurações** — aba inicial da ficha, velocidade e giro do modelo,
  unidades (°C/°F/K, kJ/mol/eV) e personalização dos cartões dos elementos com
  prévia em tempo real. Tudo salvo no navegador.

Ao clicar em um elemento abre a **ficha** (na Tabela ou na página de Íons, sem
sair da página), com um **modelo 3D que gira ao arrastar** e quatro abas.
Clicar em uma camada do modelo a seleciona e mostra quantos elétrons ela tem;
o botão de subcamadas agrupa os elétrons em faixas s, p, d e f.

- *Estrutura* — prótons, nêutrons, elétrons e elétrons por camada.
- *Orbitais* — configuração eletrônica, diagrama de orbitais e a forma de cada
  orbital (s, p, d, f) em 3D.
- *Íons* — íons comuns; ao clicar em um, o modelo mostra o íon.
- *Propriedades* — massa, densidade, pontos de fusão e ebulição e outras.

O botão **?** do cabeçalho explica cada parte da página; a ficha tem o seu.
O botão **PT / EN** troca todo o site entre português (padrão) e inglês.
Cada elemento tem endereço próprio (`/#Fe`). Teclado: `/` abre a busca,
`←` `→` trocam de elemento, `Esc` fecha. O site respeita
`prefers-reduced-motion`.

## Como os cálculos funcionam

Tudo fica no pacote `internal/chem`.

| Arquivo | O que faz |
|---|---|
| `position.go` | Grupo, período e bloco a partir do número atômico. |
| `config.go` | Configuração eletrônica pela regra de Madelung, com as 20 exceções conhecidas (Cr, Cu, Pd, Au…), camadas e diagrama de orbitais. |
| `ions.go` | Configuração dos íons: nos cátions, os elétrons saem da subcamada de valência de maior *n* (por isso Fe³⁺ = [Ar] 3d⁵); nos ânions, entram na próxima subcamada livre. |
| `formula.go` | Leitor de fórmulas químicas (`Ca(OH)2`, `CH3COO`) e cálculo de massa molar. |

Os testes comparam a configuração calculada dos **118 elementos** com uma tabela
de referência (`testdata/configs_pubchem.json`) e conferem posições, camadas,
íons, regra de Hund e massas molares.

## API

| Rota | Resposta |
|---|---|
| `GET /api/elements` | Os 118 elementos, com os campos calculados. |
| `GET /api/elements/{símbolo}` | Um elemento. Ex.: `/api/elements/Fe` |
| `GET /api/ions` | Catálogo de íons. |
| `GET /api/molar-mass?f=H2SO4` | Massa molar e contagem de átomos de uma fórmula. |

## Estrutura

```
moltech/
├── main.go                  ponto de entrada: servidor ou exportação
├── SOBRE.txt                texto de apresentação do projeto
├── internal/
│   ├── chem/                dados e cálculos de química (+ testes)
│   │   └── data/elements.json
│   └── site/                páginas, rotas HTTP, API e exportação (+ testes)
└── web/
    ├── templates/           base.html (moldura) + tabela, ions e config
    └── static/
        ├── css/style.css
        ├── js/base.js       preferências, idioma, busca e ajuda (todas as páginas)
        ├── js/tabela.js     visualizações, legenda e filtros da tabela
        ├── js/ficha.js      ficha do elemento (Tabela e Íons)
        ├── js/atomo3d.js    motor 3D em canvas, sem bibliotecas
        ├── js/config.js     página de configurações
        └── fonts/, img/
```

## Publicar no GitHub Pages

```bash
go run . -export docs
git add docs && git commit -m "site estático" && git push
```

Depois, no repositório: *Settings → Pages → Deploy from a branch → main /docs*.
A versão estática tem tudo o que a interface usa; só a rota
`/api/molar-mass`, que depende do servidor, não existe nela.

## Dados e créditos

- **PubChem** (National Library of Medicine, EUA) — massa atômica, propriedades
  físicas, estados de oxidação e ano de descoberta. Dados de domínio público.
- **NIST Atomic Spectra Database** — estado fundamental dos elementos que fogem
  da regra de Madelung. No laurêncio, o Moltech usa 7p¹ (NIST), e não 6d¹.
- **IUPAC** — desenho da tabela com 18 grupos.
- Fontes **Atkinson Hyperlegible Next** e **Mono** (Braille Institute), licença
  SIL OFL 1.1.

Limitações conhecidas: o raio atômico é o de van der Waals; o número de
nêutrons usa a massa atômica arredondada, que nem sempre é o isótopo mais
abundante (no cobre dá 35, e o isótopo mais comum tem 34); nos elementos
superpesados, parte dos valores é previsão teórica.

A organização da interface (menu em pílula, busca recolhida, ficha com modelo
3D, visualização por propriedade e personalização dos cartões) foi inspirada no
[Zperiod](https://zperiod.app), de Philip Zhao, cujo código de referência é
distribuído sob licença MIT. O Moltech não reutiliza esse código: foi reescrito
em Go, com desenho, textos e motor 3D próprios.

## Autor

Vitor Lombard Rocha — [github.com/Vitor-LR](https://github.com/Vitor-LR)
