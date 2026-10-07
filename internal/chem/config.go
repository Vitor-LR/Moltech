package chem

import (
	"fmt"
	"sort"
	"strings"
)

const letras = "spdf"

// sub é uma subcamada (n, l) com seus elétrons.
type sub struct{ n, l, e int }

func (s sub) cap() int      { return 2 * (2*s.l + 1) }
func (s sub) label() string { return fmt.Sprintf("%d%c", s.n, letras[s.l]) }

// Config é uma configuração eletrônica, guardada na ordem de
// preenchimento (regra de Madelung).
type Config []sub

// Ordem de preenchimento pela regra de Madelung (diagrama de Linus
// Pauling): n+l crescente e, no empate, n menor primeiro.
var madelung = []sub{
	{1, 0, 0}, {2, 0, 0}, {2, 1, 0}, {3, 0, 0}, {3, 1, 0}, {4, 0, 0}, {3, 2, 0}, {4, 1, 0},
	{5, 0, 0}, {4, 2, 0}, {5, 1, 0}, {6, 0, 0}, {4, 3, 0}, {5, 2, 0}, {6, 1, 0}, {7, 0, 0},
	{5, 3, 0}, {6, 2, 0}, {7, 1, 0},
}

// troca descreve uma exceção à regra de Madelung: `n` elétrons que,
// no estado fundamental real, estão em `para` em vez de `de`.
type troca struct {
	de, para string
	n        int
}

// Exceções conhecidas (estado fundamental medido — NIST Atomic
// Spectra Database). Ex.: o cromo é 3d5 4s1, e não 3d4 4s2.
var excecoes = map[int][]troca{
	24:  {{"4s", "3d", 1}}, // Cr
	29:  {{"4s", "3d", 1}}, // Cu
	41:  {{"5s", "4d", 1}}, // Nb
	42:  {{"5s", "4d", 1}}, // Mo
	44:  {{"5s", "4d", 1}}, // Ru
	45:  {{"5s", "4d", 1}}, // Rh
	46:  {{"5s", "4d", 2}}, // Pd
	47:  {{"5s", "4d", 1}}, // Ag
	57:  {{"4f", "5d", 1}}, // La
	58:  {{"4f", "5d", 1}}, // Ce
	64:  {{"4f", "5d", 1}}, // Gd
	78:  {{"6s", "5d", 1}}, // Pt
	79:  {{"6s", "5d", 1}}, // Au
	89:  {{"5f", "6d", 1}}, // Ac
	90:  {{"5f", "6d", 2}}, // Th
	91:  {{"5f", "6d", 1}}, // Pa
	92:  {{"5f", "6d", 1}}, // U
	93:  {{"5f", "6d", 1}}, // Np
	96:  {{"5f", "6d", 1}}, // Cm
	103: {{"6d", "7p", 1}}, // Lr
}

// NeutralConfig devolve a configuração do átomo neutro de número
// atômico z: preenche pela regra de Madelung e aplica as exceções.
func NeutralConfig(z int) Config {
	cfg := fill(z)
	for _, t := range excecoes[z] {
		cfg.add(t.de, -t.n)
		cfg.add(t.para, t.n)
	}
	return cfg.compact()
}

// fill distribui n elétrons seguindo estritamente a regra de Madelung.
func fill(n int) Config {
	cfg := make(Config, len(madelung))
	copy(cfg, madelung)
	for i := range cfg {
		if n <= 0 {
			break
		}
		cfg[i].e = min(n, cfg[i].cap())
		n -= cfg[i].e
	}
	return cfg
}

func (c Config) add(label string, n int) {
	for i := range c {
		if c[i].label() == label {
			c[i].e += n
			return
		}
	}
}

func (c Config) compact() Config {
	out := c[:0:0]
	for _, s := range c {
		if s.e > 0 {
			out = append(out, s)
		}
	}
	return out
}

// Total devolve o número de elétrons da configuração.
func (c Config) Total() int {
	t := 0
	for _, s := range c {
		t += s.e
	}
	return t
}

// sorted devolve as subcamadas na ordem da notação usual (por n, depois l).
func (c Config) sorted() Config {
	out := append(Config(nil), c...)
	sort.Slice(out, func(i, j int) bool {
		if out[i].n != out[j].n {
			return out[i].n < out[j].n
		}
		return out[i].l < out[j].l
	})
	return out
}

// String escreve a configuração completa: "1s2 2s2 2p6 3s1".
func (c Config) String() string {
	parts := make([]string, 0, len(c))
	for _, s := range c.sorted() {
		parts = append(parts, fmt.Sprintf("%s%d", s.label(), s.e))
	}
	return strings.Join(parts, " ")
}

var gasesNobres = []struct {
	z       int
	simbolo string
}{{86, "Rn"}, {54, "Xe"}, {36, "Kr"}, {18, "Ar"}, {10, "Ne"}, {2, "He"}}

// core devolve o maior gás nobre cujo caroço está inteiro dentro de c.
// Com allowSelf, a própria configuração pode ser o caroço (caso dos
// íons: o Na+ é exatamente "[Ne]").
func (c Config) core(allowSelf bool) (Config, string) {
	total := c.Total()
	for _, g := range gasesNobres {
		if g.z > total || (g.z == total && !allowSelf) {
			continue
		}
		nucleo := fill(g.z).compact()
		if c.contains(nucleo) {
			return nucleo, g.simbolo
		}
	}
	return nil, ""
}

func (c Config) contains(inner Config) bool {
	for _, in := range inner {
		ok := false
		for _, s := range c {
			if s.n == in.n && s.l == in.l && s.e == in.e {
				ok = true
				break
			}
		}
		if !ok {
			return false
		}
	}
	return true
}

func (c Config) inCore(nucleo Config, s sub) bool {
	for _, k := range nucleo {
		if k.n == s.n && k.l == s.l {
			return true
		}
	}
	return false
}

// Abbrev escreve a configuração com o caroço de gás nobre:
// "[Ar] 3d6 4s2". Sem caroço possível (H, He), devolve a completa.
func (c Config) Abbrev(allowSelf bool) string {
	nucleo, simbolo := c.core(allowSelf)
	if nucleo == nil {
		return c.String()
	}
	parts := []string{"[" + simbolo + "]"}
	for _, s := range c.sorted() {
		if !c.inCore(nucleo, s) {
			parts = append(parts, fmt.Sprintf("%s%d", s.label(), s.e))
		}
	}
	return strings.Join(parts, " ")
}

// Shells soma os elétrons por camada: índice 0 = K, 1 = L, 2 = M…
func (c Config) Shells() []int {
	maxN := 0
	for _, s := range c {
		maxN = max(maxN, s.n)
	}
	shells := make([]int, maxN)
	for _, s := range c {
		shells[s.n-1] += s.e
	}
	return shells
}

// Subcamada é uma linha do diagrama de orbitais.
type Subcamada struct {
	Rotulo     string `json:"rotulo"`     // "3d"
	Eletrons   int    `json:"eletrons"`   // 6
	Capacidade int    `json:"capacidade"` // 10
	Orbitais   []int  `json:"orbitais"`   // elétrons em cada orbital: 0, 1 ou 2
}

// Diagram monta o diagrama de orbitais na ordem de energia, aplicando
// a regra de Hund: cada orbital da subcamada recebe um elétron antes
// de qualquer um receber o segundo.
func (c Config) Diagram() []Subcamada {
	out := make([]Subcamada, 0, len(c))
	for _, s := range c {
		orbitais := make([]int, 2*s.l+1)
		for i := 0; i < s.e; i++ {
			orbitais[i%len(orbitais)]++
		}
		out = append(out, Subcamada{s.label(), s.e, s.cap(), orbitais})
	}
	return out
}
