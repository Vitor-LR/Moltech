package chem

import (
	"fmt"
	"math"
	"unicode"
)

// ParseFormula lê uma fórmula química ("H2SO4", "Ca(OH)2", "CH3COO")
// e devolve quantos átomos de cada elemento ela tem.
func ParseFormula(formula string) (map[string]int, error) {
	p := &parser{src: []rune(formula)}
	counts, err := p.group()
	if err != nil {
		return nil, err
	}
	if p.pos < len(p.src) {
		return nil, fmt.Errorf("fórmula %q: caractere inesperado %q na posição %d", formula, p.src[p.pos], p.pos+1)
	}
	if len(counts) == 0 {
		return nil, fmt.Errorf("fórmula vazia")
	}
	return counts, nil
}

// MolarMass calcula a massa molar (g/mol) de uma fórmula, somando as
// massas atômicas dos elementos.
func MolarMass(formula string) (float64, error) {
	counts, err := ParseFormula(formula)
	if err != nil {
		return 0, err
	}
	total := 0.0
	for simbolo, n := range counts {
		e, ok := BySymbol(simbolo)
		if !ok {
			return 0, fmt.Errorf("fórmula %q: elemento desconhecido %q", formula, simbolo)
		}
		total += e.Massa * float64(n)
	}
	return math.Round(total*1000) / 1000, nil
}

type parser struct {
	src []rune
	pos int
}

// group lê uma sequência de átomos e parênteses até o fim ou até ")".
func (p *parser) group() (map[string]int, error) {
	counts := map[string]int{}
	for p.pos < len(p.src) {
		ch := p.src[p.pos]
		switch {
		case ch == '(':
			p.pos++
			inner, err := p.group()
			if err != nil {
				return nil, err
			}
			if p.pos >= len(p.src) || p.src[p.pos] != ')' {
				return nil, fmt.Errorf("parêntese aberto sem fechar")
			}
			p.pos++
			mult := p.number()
			for s, n := range inner {
				counts[s] += n * mult
			}
		case ch == ')':
			return counts, nil
		case unicode.IsUpper(ch):
			simbolo := string(ch)
			p.pos++
			for p.pos < len(p.src) && unicode.IsLower(p.src[p.pos]) {
				simbolo += string(p.src[p.pos])
				p.pos++
			}
			counts[simbolo] += p.number()
		default:
			return counts, nil
		}
	}
	return counts, nil
}

// number lê o índice depois de um símbolo ou parêntese (1 se não houver).
func (p *parser) number() int {
	n := 0
	for p.pos < len(p.src) && unicode.IsDigit(p.src[p.pos]) {
		n = n*10 + int(p.src[p.pos]-'0')
		p.pos++
	}
	if n == 0 {
		return 1
	}
	return n
}
