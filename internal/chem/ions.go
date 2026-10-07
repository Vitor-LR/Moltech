package chem

import (
	"fmt"
	"sort"
	"strconv"
	"strings"
)

// Ion é um íon monoatômico comum de um elemento. Carga e Nome vêm do
// JSON; o restante é calculado.
type Ion struct {
	Carga    int         `json:"carga"`
	Nome     string      `json:"nome"`
	NomeEn   string      `json:"nome_en"`
	Tipo     string      `json:"tipo"`     // "cation" ou "anion"
	HTML     string      `json:"html"`     // fórmula com a carga: Fe<sup>3+</sup>
	Eletrons int         `json:"eletrons"` // elétrons do íon
	Config   string      `json:"config"`   // configuração abreviada do íon
	Camadas  []int       `json:"camadas"`
	Diagrama []Subcamada `json:"diagrama"` // subcamadas do íon, em ordem de preenchimento
}

func ionType(carga int) string {
	if carga > 0 {
		return "cation"
	}
	return "anion"
}

// IonConfig calcula a configuração de um íon monoatômico.
//
// Cátion: os elétrons saem primeiro das subcamadas de valência (fora
// do caroço de gás nobre) de maior n e, no empate, de maior l — por
// isso o Fe perde os 4s antes dos 3d, e o Fe3+ é [Ar] 3d5.
// Ânion: os elétrons entram na próxima subcamada livre pela ordem de
// Madelung — o Cl- completa o 3p e fica igual ao [Ar].
func IonConfig(z, carga int) Config {
	cfg := NeutralConfig(z)
	if carga > 0 {
		nucleo, _ := cfg.core(false)
		for i := 0; i < carga && cfg.Total() > 0; i++ {
			cfg[cfg.outermost(nucleo)].e--
			cfg = cfg.compact()
		}
		return cfg
	}
	full := make(Config, len(madelung))
	copy(full, madelung)
	for _, s := range cfg {
		full.add(s.label(), s.e)
	}
	for i := 0; i < -carga; i++ {
		for j := range full {
			if full[j].e < full[j].cap() {
				full[j].e++
				break
			}
		}
	}
	return full.compact()
}

// outermost acha a subcamada de onde sai o próximo elétron.
func (c Config) outermost(nucleo Config) int {
	best := -1
	pick := func(valenceOnly bool) {
		for i, s := range c {
			if valenceOnly && c.inCore(nucleo, s) {
				continue
			}
			if best < 0 || s.n > c[best].n || (s.n == c[best].n && s.l > c[best].l) {
				best = i
			}
		}
	}
	pick(true)
	if best < 0 { // valência esgotada: segue para o caroço
		pick(false)
	}
	return best
}

// FormulaHTML escreve uma fórmula com índices e carga para HTML:
// ("SO4", -2) → SO<sub>4</sub><sup>2−</sup>.
func FormulaHTML(formula string, carga int) string {
	var b strings.Builder
	for i := 0; i < len(formula); i++ {
		ch := formula[i]
		if ch >= '0' && ch <= '9' {
			j := i
			for j < len(formula) && formula[j] >= '0' && formula[j] <= '9' {
				j++
			}
			b.WriteString("<sub>" + formula[i:j] + "</sub>")
			i = j - 1
			continue
		}
		b.WriteByte(ch)
	}
	if carga != 0 {
		b.WriteString("<sup>" + ChargeText(carga) + "</sup>")
	}
	return b.String()
}

// ChargeText escreve a carga no padrão da química: "2+", "−", "3−".
func ChargeText(carga int) string {
	sinal, n := "+", carga
	if carga < 0 {
		sinal, n = "\u2212", -carga
	}
	if n == 1 {
		return sinal
	}
	return strconv.Itoa(n) + sinal
}

// IonCatalogo é uma linha da tabela de íons da página.
type IonCatalogo struct {
	Formula string  `json:"formula"`
	HTML    string  `json:"html"`
	Nome    string  `json:"nome"`
	Carga   int     `json:"carga"`
	Tipo    string  `json:"tipo"`   // "cation" ou "anion"
	Classe  string  `json:"classe"` // "mono" ou "poli"
	Massa   float64 `json:"massa"`  // g/mol
	NomeEn  string  `json:"nome_en"`
}

// Íons poliatômicos mais cobrados no ensino médio e no ciclo básico.
var poliatomicos = []struct {
	formula string
	carga   int
	nome    string
	nomeEn  string
}{
	{"NH4", 1, "Amônio", "Ammonium"}, {"H3O", 1, "Hidrônio", "Hydronium"}, {"Hg2", 2, "Mercúrio(I)", "Mercury(I)"},
	{"OH", -1, "Hidróxido", "Hydroxide"}, {"NO3", -1, "Nitrato", "Nitrate"}, {"NO2", -1, "Nitrito", "Nitrite"},
	{"CN", -1, "Cianeto", "Cyanide"}, {"SCN", -1, "Tiocianato", "Thiocyanate"}, {"HCO3", -1, "Bicarbonato", "Bicarbonate"},
	{"HSO4", -1, "Hidrogenossulfato", "Hydrogen sulfate"}, {"H2PO4", -1, "Di-hidrogenofosfato", "Dihydrogen phosphate"},
	{"CH3COO", -1, "Acetato", "Acetate"}, {"ClO", -1, "Hipoclorito", "Hypochlorite"}, {"ClO2", -1, "Clorito", "Chlorite"},
	{"ClO3", -1, "Clorato", "Chlorate"}, {"ClO4", -1, "Perclorato", "Perchlorate"}, {"MnO4", -1, "Permanganato", "Permanganate"},
	{"CO3", -2, "Carbonato", "Carbonate"}, {"SO4", -2, "Sulfato", "Sulfate"}, {"SO3", -2, "Sulfito", "Sulfite"},
	{"S2O3", -2, "Tiossulfato", "Thiosulfate"}, {"CrO4", -2, "Cromato", "Chromate"}, {"Cr2O7", -2, "Dicromato", "Dichromate"},
	{"C2O4", -2, "Oxalato", "Oxalate"}, {"O2", -2, "Peróxido", "Peroxide"}, {"HPO4", -2, "Hidrogenofosfato", "Hydrogen phosphate"},
	{"SiO3", -2, "Silicato", "Silicate"}, {"PO4", -3, "Fosfato", "Phosphate"}, {"BO3", -3, "Borato", "Borate"},
	{"AsO4", -3, "Arsenato", "Arsenate"},
}

// Catalog junta os íons monoatômicos dos elementos com os
// poliatômicos, ordenados: cátions antes de ânions, depois por
// módulo da carga e por nome.
func Catalog() ([]IonCatalogo, error) {
	els, err := Elements()
	if err != nil {
		return nil, err
	}
	var out []IonCatalogo
	for _, e := range els {
		for _, ion := range e.Ions {
			out = append(out, IonCatalogo{e.Simbolo, ion.HTML, ion.Nome, ion.Carga, ion.Tipo, "mono", e.Massa, ion.NomeEn})
		}
	}
	for _, p := range poliatomicos {
		massa, err := MolarMass(p.formula)
		if err != nil {
			return nil, fmt.Errorf("chem: íon %s: %w", p.formula, err)
		}
		out = append(out, IonCatalogo{p.formula, FormulaHTML(p.formula, p.carga), p.nome, p.carga, ionType(p.carga), "poli", massa, p.nomeEn})
	}
	abs := func(n int) int {
		if n < 0 {
			return -n
		}
		return n
	}
	sort.SliceStable(out, func(i, j int) bool {
		a, b := out[i], out[j]
		if a.Tipo != b.Tipo {
			return a.Tipo == "cation"
		}
		if abs(a.Carga) != abs(b.Carga) {
			return abs(a.Carga) < abs(b.Carga)
		}
		if a.Classe != b.Classe {
			return a.Classe == "mono"
		}
		return false // mantém a ordem de origem (número atômico / lista)
	})
	return out, nil
}

// nomes em inglês dos ânions monoatômicos (não seguem o nome do elemento)
var anionsEn = map[string]string{
	"H": "Hydride", "C": "Carbide", "N": "Nitride", "P": "Phosphide", "As": "Arsenide",
	"O": "Oxide", "S": "Sulfide", "Se": "Selenide", "Te": "Telluride",
	"F": "Fluoride", "Cl": "Chloride", "Br": "Bromide", "I": "Iodide", "At": "Astatide",
}

// ionNameEn monta o nome em inglês de um íon monoatômico. Nos cátions
// ele sai do nome do elemento ("Iron(III) ion"); o número romano, quando
// existe, é copiado do nome em português.
func ionNameEn(e *Element, ion Ion) string {
	if ion.Carga < 0 {
		return anionsEn[e.Simbolo]
	}
	if e.Simbolo == "H" {
		return "Hydrogen ion (proton)"
	}
	romano := ""
	if i := strings.Index(ion.Nome, "("); i >= 0 {
		romano = ion.Nome[i:]
	}
	return e.NomeEn + romano + " ion"
}
