package chem

// Position é o lugar de um elemento na tabela periódica.
type Position struct {
	Grupo, Periodo int
	Bloco          string
	Linha, Coluna  int
}

// último número atômico de cada período (os gases nobres)
var fimPeriodo = []int{2, 10, 18, 36, 54, 86, 118}

// PositionOf calcula grupo, período e bloco a partir do número atômico.
//
// Lantanídeos (57–71) e actinídeos (89–103) são desenhados em duas
// linhas à parte, com 15 elementos cada, como na tabela da IUPAC:
// não têm grupo (Grupo = 0) e ocupam as linhas 9 e 10 do desenho.
func PositionOf(z int) Position {
	periodo, inicio := 1, 1
	for i, fim := range fimPeriodo {
		if z <= fim {
			periodo = i + 1
			break
		}
		inicio = fim + 1
	}
	i := z - inicio // posição dentro do período, começando em 0

	p := Position{Periodo: periodo, Linha: periodo}
	switch {
	case periodo == 1:
		p.Grupo = 1
		if z == 2 {
			p.Grupo = 18
		}
	case periodo <= 3: // 8 elementos: grupos 1–2 e 13–18
		p.Grupo = i + 1
		if i >= 2 {
			p.Grupo = i + 11
		}
	case periodo <= 5: // 18 elementos: grupos 1–18
		p.Grupo = i + 1
	default: // 32 elementos: 2 + 15 do bloco f + 15
		switch {
		case i < 2:
			p.Grupo = i + 1
		case i <= 16:
			p.Grupo = 0
			p.Linha = periodo + 3 // 6 → 9, 7 → 10
			p.Coluna = i + 1      // 3…17
		default:
			p.Grupo = i - 13
		}
	}
	if p.Grupo != 0 {
		p.Coluna = p.Grupo
	}

	switch {
	case p.Grupo == 0:
		p.Bloco = "f"
	case p.Grupo <= 2 || z == 2:
		p.Bloco = "s"
	case p.Grupo <= 12:
		p.Bloco = "d"
	default:
		p.Bloco = "p"
	}
	return p
}
