// Package chem reúne os dados dos 118 elementos e os cálculos de
// estrutura eletrônica do Moltech: posição na tabela, configuração
// eletrônica, camadas, diagrama de orbitais e íons.
//
// Os valores medidos (massa, pontos de fusão, eletronegatividade…)
// vêm do arquivo data/elements.json. Tudo que é DERIVADO do número
// atômico é calculado aqui, em Go, e não fica gravado no arquivo.
package chem

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"math"
	"sync"
)

//go:embed data/elements.json
var elementsJSON []byte

// Element descreve um elemento químico: os campos do primeiro bloco
// são lidos do JSON; os do segundo são calculados em Load.
type Element struct {
	Z                  int      `json:"z"`
	Simbolo            string   `json:"simbolo"`
	Nome               string   `json:"nome"`
	NomeEn             string   `json:"nome_en"`
	Massa              float64  `json:"massa"`
	Categoria          string   `json:"categoria"`
	Estado             string   `json:"estado"`
	EstadoPrevisto     bool     `json:"estado_previsto"`
	Eletronegatividade *float64 `json:"eletronegatividade"`
	RaioPm             *float64 `json:"raio_pm"`
	IonizacaoEv        *float64 `json:"ionizacao_ev"`
	AfinidadeEv        *float64 `json:"afinidade_ev"`
	Oxidacao           []int    `json:"oxidacao"`
	FusaoK             *float64 `json:"fusao_k"`
	EbulicaoK          *float64 `json:"ebulicao_k"`
	Densidade          *float64 `json:"densidade"`
	Ano                int      `json:"ano"` // 0 = conhecido desde a Antiguidade
	Ions               []Ion    `json:"ions"`

	Grupo       int         `json:"grupo"` // 0 = bloco f (sem grupo)
	Periodo     int         `json:"periodo"`
	Bloco       string      `json:"bloco"`
	Metal       string      `json:"metal"`  // "metal", "semimetal" ou "nao-metal"
	Linha       int         `json:"linha"`  // linha no desenho da tabela (1–7, 9 e 10)
	Coluna      int         `json:"coluna"` // coluna no desenho da tabela (1–18)
	Config      string      `json:"config"`
	ConfigAbrev string      `json:"config_abrev"`
	Excecao     bool        `json:"excecao"`  // foge da regra de Madelung
	Camadas     []int       `json:"camadas"`  // elétrons em K, L, M…
	Valencia    int         `json:"valencia"` // 0 = variável (blocos d e f)
	Diagrama    []Subcamada `json:"diagrama"`
	Neutrons    int         `json:"neutrons"`     // do isótopo de número de massa ≈ massa atômica
	NumeroMassa int         `json:"numero_massa"` // massa atômica arredondada
}

var (
	once     sync.Once
	elements []Element
	bySymbol map[string]*Element
	loadErr  error
)

// Elements devolve os 118 elementos, em ordem de número atômico,
// já com os campos calculados preenchidos.
func Elements() ([]Element, error) {
	once.Do(func() { elements, loadErr = load(elementsJSON) })
	return elements, loadErr
}

// BySymbol procura um elemento pelo símbolo ("Fe", "Na"…).
func BySymbol(simbolo string) (*Element, bool) {
	if _, err := Elements(); err != nil {
		return nil, false
	}
	e, ok := bySymbol[simbolo]
	return e, ok
}

func load(raw []byte) ([]Element, error) {
	var list []Element
	if err := json.Unmarshal(raw, &list); err != nil {
		return nil, fmt.Errorf("chem: lendo elements.json: %w", err)
	}
	if len(list) != 118 {
		return nil, fmt.Errorf("chem: esperava 118 elementos, encontrei %d", len(list))
	}
	bySymbol = make(map[string]*Element, len(list))
	for i := range list {
		e := &list[i]
		if e.Z != i+1 {
			return nil, fmt.Errorf("chem: elemento fora de ordem na posição %d (z=%d)", i+1, e.Z)
		}
		derive(e)
		bySymbol[e.Simbolo] = e
	}
	return list, nil
}

// derive preenche tudo que depende só do número atômico.
func derive(e *Element) {
	pos := PositionOf(e.Z)
	e.Grupo, e.Periodo, e.Bloco, e.Linha, e.Coluna = pos.Grupo, pos.Periodo, pos.Bloco, pos.Linha, pos.Coluna

	e.Metal = metalType(e.Categoria)

	cfg := NeutralConfig(e.Z)
	e.Config = cfg.String()
	e.ConfigAbrev = cfg.Abbrev(false)
	e.Excecao = len(excecoes[e.Z]) > 0
	e.Camadas = cfg.Shells()
	e.Diagrama = cfg.Diagram()
	e.Valencia = valence(e.Bloco, e.Camadas)

	e.NumeroMassa = int(math.Round(e.Massa))
	e.Neutrons = e.NumeroMassa - e.Z

	for i := range e.Ions {
		ion := &e.Ions[i]
		ic := IonConfig(e.Z, ion.Carga)
		ion.Eletrons = e.Z - ion.Carga
		ion.Config = ic.Abbrev(true)
		ion.Camadas = ic.Shells()
		ion.Diagrama = ic.Diagram()
		ion.NomeEn = ionNameEn(e, *ion)
		ion.Tipo = ionType(ion.Carga)
		ion.HTML = FormulaHTML(e.Simbolo, ion.Carga)
	}
}

// valence devolve os elétrons de valência dos blocos s e p (a camada
// mais externa). Nos blocos d e f o conceito varia conforme o
// composto, então devolve 0 e a interface mostra "variável".
func valence(bloco string, camadas []int) int {
	if bloco != "s" && bloco != "p" {
		return 0
	}
	return camadas[len(camadas)-1]
}

// metalType resume a categoria em três classes.
func metalType(categoria string) string {
	switch categoria {
	case "semimetal":
		return "semimetal"
	case "nao-metal", "halogenio", "gas-nobre":
		return "nao-metal"
	}
	return "metal"
}
