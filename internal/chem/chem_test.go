package chem

import (
	_ "embed"
	"encoding/json"
	"math"
	"testing"
)

//go:embed testdata/configs_pubchem.json
var configsPubChem []byte

// A configuração calculada (Madelung + exceções) tem de bater com a
// de referência do PubChem para os 118 elementos.
func TestConfigContraReferencia(t *testing.T) {
	var ref map[string]string
	if err := json.Unmarshal(configsPubChem, &ref); err != nil {
		t.Fatal(err)
	}
	// Laurêncio: o PubChem ainda lista 6d1; o estado fundamental aceito
	// hoje (NIST) é 7p1, e é esse que o Moltech usa.
	ref["Lr"] = "1s2 2s2 2p6 3s2 3p6 3d10 4s2 4p6 4d10 4f14 5s2 5p6 5d10 5f14 6s2 6p6 7s2 7p1"

	els, err := Elements()
	if err != nil {
		t.Fatal(err)
	}
	for _, e := range els {
		if e.Config != ref[e.Simbolo] {
			t.Errorf("%s (z=%d):\n  calculado  %s\n  referência %s", e.Simbolo, e.Z, e.Config, ref[e.Simbolo])
		}
		if got := NeutralConfig(e.Z).Total(); got != e.Z {
			t.Errorf("%s: %d elétrons na configuração, esperava %d", e.Simbolo, got, e.Z)
		}
	}
}

func TestPosicao(t *testing.T) {
	casos := []struct {
		simbolo        string
		grupo, periodo int
		bloco          string
		linha, coluna  int
	}{
		{"H", 1, 1, "s", 1, 1}, {"He", 18, 1, "s", 1, 18},
		{"B", 13, 2, "p", 2, 13}, {"Na", 1, 3, "s", 3, 1}, {"Cl", 17, 3, "p", 3, 17},
		{"Fe", 8, 4, "d", 4, 8}, {"Zn", 12, 4, "d", 4, 12}, {"Kr", 18, 4, "p", 4, 18},
		{"La", 0, 6, "f", 9, 3}, {"Lu", 0, 6, "f", 9, 17}, {"Hf", 4, 6, "d", 6, 4},
		{"Au", 11, 6, "d", 6, 11}, {"Rn", 18, 6, "p", 6, 18},
		{"Ac", 0, 7, "f", 10, 3}, {"Lr", 0, 7, "f", 10, 17}, {"Rf", 4, 7, "d", 7, 4}, {"Og", 18, 7, "p", 7, 18},
	}
	for _, c := range casos {
		e, ok := BySymbol(c.simbolo)
		if !ok {
			t.Fatalf("%s não encontrado", c.simbolo)
		}
		if e.Grupo != c.grupo || e.Periodo != c.periodo || e.Bloco != c.bloco || e.Linha != c.linha || e.Coluna != c.coluna {
			t.Errorf("%s: grupo %d período %d bloco %s linha %d coluna %d; esperava %+v",
				c.simbolo, e.Grupo, e.Periodo, e.Bloco, e.Linha, e.Coluna, c)
		}
	}
	// nenhuma casa da tabela pode ter dois elementos
	visto := map[[2]int]string{}
	els, _ := Elements()
	for _, e := range els {
		k := [2]int{e.Linha, e.Coluna}
		if outro, dup := visto[k]; dup {
			t.Errorf("%s e %s na mesma casa %v", outro, e.Simbolo, k)
		}
		visto[k] = e.Simbolo
	}
}

func TestCamadasEAbreviada(t *testing.T) {
	casos := []struct {
		simbolo, abrev string
		camadas        []int
		valencia       int
	}{
		{"H", "1s1", []int{1}, 1},
		{"He", "1s2", []int{2}, 2},
		{"Ne", "[He] 2s2 2p6", []int{2, 8}, 8},
		{"Na", "[Ne] 3s1", []int{2, 8, 1}, 1},
		{"Cl", "[Ne] 3s2 3p5", []int{2, 8, 7}, 7},
		{"Fe", "[Ar] 3d6 4s2", []int{2, 8, 14, 2}, 0},
		{"Cu", "[Ar] 3d10 4s1", []int{2, 8, 18, 1}, 0},
		{"Pb", "[Xe] 4f14 5d10 6s2 6p2", []int{2, 8, 18, 32, 18, 4}, 4},
		{"U", "[Rn] 5f3 6d1 7s2", []int{2, 8, 18, 32, 21, 9, 2}, 0},
	}
	for _, c := range casos {
		e, _ := BySymbol(c.simbolo)
		if e.ConfigAbrev != c.abrev {
			t.Errorf("%s: abreviada %q, esperava %q", c.simbolo, e.ConfigAbrev, c.abrev)
		}
		if !igual(e.Camadas, c.camadas) {
			t.Errorf("%s: camadas %v, esperava %v", c.simbolo, e.Camadas, c.camadas)
		}
		if e.Valencia != c.valencia {
			t.Errorf("%s: valência %d, esperava %d", c.simbolo, e.Valencia, c.valencia)
		}
	}
}

func TestIons(t *testing.T) {
	casos := []struct {
		simbolo string
		carga   int
		config  string
	}{
		{"H", 1, ""}, {"H", -1, "[He]"},
		{"Na", 1, "[Ne]"}, {"Mg", 2, "[Ne]"}, {"Al", 3, "[Ne]"},
		{"Cl", -1, "[Ar]"}, {"O", -2, "[Ne]"}, {"N", -3, "[Ne]"},
		{"Fe", 2, "[Ar] 3d6"}, {"Fe", 3, "[Ar] 3d5"},
		{"Cu", 1, "[Ar] 3d10"}, {"Cu", 2, "[Ar] 3d9"}, {"Cr", 3, "[Ar] 3d3"}, {"Zn", 2, "[Ar] 3d10"},
		{"Ag", 1, "[Kr] 4d10"}, {"Sn", 2, "[Kr] 4d10 5s2"}, {"Sn", 4, "[Kr] 4d10"},
		{"Pb", 2, "[Xe] 4f14 5d10 6s2"}, {"Pb", 4, "[Xe] 4f14 5d10"},
		{"Ce", 3, "[Xe] 4f1"}, {"Eu", 3, "[Xe] 4f6"}, {"Gd", 3, "[Xe] 4f7"},
	}
	for _, c := range casos {
		e, _ := BySymbol(c.simbolo)
		cfg := IonConfig(e.Z, c.carga)
		if got := cfg.Abbrev(true); got != c.config {
			t.Errorf("%s%+d: %q, esperava %q", c.simbolo, c.carga, got, c.config)
		}
		if cfg.Total() != e.Z-c.carga {
			t.Errorf("%s%+d: %d elétrons, esperava %d", c.simbolo, c.carga, cfg.Total(), e.Z-c.carga)
		}
	}
}

func TestDiagramaHund(t *testing.T) {
	// nitrogênio: 2p3 → um elétron em cada orbital p
	d := NeutralConfig(7).Diagram()
	if p := d[len(d)-1]; p.Rotulo != "2p" || !igual(p.Orbitais, []int{1, 1, 1}) {
		t.Errorf("N 2p: %+v", p)
	}
	// oxigênio: 2p4 → o primeiro orbital emparelha
	d = NeutralConfig(8).Diagram()
	if p := d[len(d)-1]; !igual(p.Orbitais, []int{2, 1, 1}) {
		t.Errorf("O 2p: %+v", p)
	}
	// ferro: 3d6
	for _, s := range NeutralConfig(26).Diagram() {
		if s.Rotulo == "3d" && !igual(s.Orbitais, []int{2, 1, 1, 1, 1}) {
			t.Errorf("Fe 3d: %+v", s)
		}
	}
}

func TestMassaMolar(t *testing.T) {
	casos := map[string]float64{
		"H2O": 18.015, "CO2": 44.009, "NaCl": 58.44, "H2SO4": 98.07,
		"Ca(OH)2": 74.09, "CH3COO": 59.04, "Al2(SO4)3": 342.15, "C6H12O6": 180.156,
	}
	for formula, quer := range casos {
		got, err := MolarMass(formula)
		if err != nil {
			t.Errorf("%s: %v", formula, err)
			continue
		}
		if math.Abs(got-quer) > 0.03 {
			t.Errorf("%s: %.3f g/mol, esperava ≈ %.3f", formula, got, quer)
		}
	}
	for _, ruim := range []string{"", "Xx2", "H2(O", "h2o", "H2O)"} {
		if _, err := MolarMass(ruim); err == nil {
			t.Errorf("%q deveria dar erro", ruim)
		}
	}
}

func TestCatalogoEFormula(t *testing.T) {
	if got := FormulaHTML("SO4", -2); got != "SO<sub>4</sub><sup>2\u2212</sup>" {
		t.Errorf("FormulaHTML: %s", got)
	}
	if got := FormulaHTML("Na", 1); got != "Na<sup>+</sup>" {
		t.Errorf("FormulaHTML: %s", got)
	}
	cat, err := Catalog()
	if err != nil {
		t.Fatal(err)
	}
	if len(cat) < 90 {
		t.Errorf("catálogo com só %d íons", len(cat))
	}
	for i := 1; i < len(cat); i++ {
		if cat[i-1].Tipo == "anion" && cat[i].Tipo == "cation" {
			t.Fatal("cátions deveriam vir antes dos ânions")
		}
	}
}

func igual(a, b []int) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}
