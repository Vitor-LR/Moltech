// Package web embute no binário os modelos HTML e os arquivos
// estáticos (CSS, JS, fontes, imagens). O executável fica
// autossuficiente: não precisa de nenhuma pasta ao lado.
package web

import "embed"

//go:embed templates static
var FS embed.FS
