// Package site monta as páginas do Moltech e as serve por HTTP — ou
// as exporta como site estático.
package site

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"html/template"
	"io/fs"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"moltech/internal/chem"
	"moltech/web"
)

// Site guarda tudo pronto em memória: como os dados não mudam
// enquanto o programa roda, cada página é renderizada uma única vez.
type Site struct {
	paginas   map[string][]byte // nome do arquivo → HTML
	elemsJSON []byte
	ionsJSON  []byte
}

// As páginas do site. O mesmo nome de arquivo vale no servidor e na
// exportação estática, então os links funcionam igual nos dois.
var paginas = []struct{ Arquivo, Modelo, Chave, Titulo, TituloEn string }{
	{"index.html", "tabela.html", "tabela", "Moltech — Tabela periódica interativa", "Moltech — Interactive periodic table"},
	{"ions.html", "ions.html", "ions", "Íons comuns — Moltech", "Common ions — Moltech"},
	{"configuracoes.html", "config.html", "config", "Configurações — Moltech", "Settings — Moltech"},
}

type categoria struct {
	Chave, Nome, NomeEn string
}

type indice struct {
	S string `json:"s"`
	N string `json:"n"`
	E string `json:"e"`
	Z int    `json:"z"`
}

type dados struct {
	Pagina     string // chave da página atual (marca o item ativo do menu)
	Titulo     string
	TituloEn   string
	Elementos  []chem.Element
	Categorias []categoria
	Cations    []chem.IonCatalogo
	Anions     []chem.IonCatalogo
	Grupos     []int
	Periodos   []int
	Indice     []indice // índice enxuto para a busca do cabeçalho
}

var categorias = []categoria{
	{"alcalino", "Metais alcalinos", "Alkali metals"},
	{"alcalinoterroso", "Metais alcalinoterrosos", "Alkaline earth metals"},
	{"transicao", "Metais de transição", "Transition metals"},
	{"pos-transicao", "Outros metais", "Other metals"},
	{"semimetal", "Semimetais", "Metalloids"},
	{"nao-metal", "Não metais", "Nonmetals"},
	{"halogenio", "Halogênios", "Halogens"},
	{"gas-nobre", "Gases nobres", "Noble gases"},
	{"lantanideo", "Lantanídeos", "Lanthanides"},
	{"actinideo", "Actinídeos", "Actinides"},
}

// versaoEstaticos devolve uma impressão digital curta de tudo que há em
// static/. Ela vai no endereço de cada arquivo ("style.css?v=3f9a1c2e"):
// quando qualquer arquivo muda, o endereço muda junto e o navegador é
// obrigado a baixar a versão nova, em vez de reaproveitar a antiga do cache.
func versaoEstaticos() (string, error) {
	h := sha256.New()
	err := fs.WalkDir(web.FS, "static", func(path string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return err
		}
		data, err := web.FS.ReadFile(path)
		if err != nil {
			return err
		}
		h.Write([]byte(path))
		h.Write(data)
		return nil
	})
	return hex.EncodeToString(h.Sum(nil))[:8], err
}

var funcs = template.FuncMap{
	// fórmulas de íons já vêm escapadas do pacote chem (só <sub>/<sup>)
	"html":  func(s string) template.HTML { return template.HTML(s) },
	"mais1": func(n int) int { return n + 1 },
	// atraso da animação de entrada de cada casa: uma onda em diagonal
	"atraso": func(e chem.Element) int { return (e.Coluna + e.Linha) * 14 },
	// número no padrão brasileiro, com até `casas` decimais
	// ---- tradução (português ⇄ inglês) ----
	// O site nasce em português. Cada texto fixo sai duas vezes, e o CSS
	// mostra só o do idioma atual (html[lang]): a troca é instantânea e
	// não depende de recarregar a página.
	"tr": func(pt, en string) template.HTML {
		return template.HTML(`<span class="pt">` + pt + `</span><span class="en" lang="en">` + en + `</span>`)
	},
	// atributos: o português vai no atributo; o inglês, em data-en-…, que o base.js aplica
	"rot":  func(pt, en string) template.HTMLAttr { return atributo("aria-label", pt, en) },
	"tit":  func(pt, en string) template.HTMLAttr { return atributo("title", pt, en) },
	"dica": func(pt, en string) template.HTMLAttr { return atributo("placeholder", pt, en) },
	"num": func(v float64, casas int) string {
		s := strconv.FormatFloat(v, 'f', casas, 64)
		if strings.Contains(s, ".") {
			s = strings.TrimRight(strings.TrimRight(s, "0"), ".")
		}
		return strings.Replace(s, ".", ",", 1)
	},
}

func atributo(nome, pt, en string) template.HTMLAttr {
	return template.HTMLAttr(nome + `="` + template.HTMLEscapeString(pt) + `" data-en-` + nome + `="` + template.HTMLEscapeString(en) + `"`)
}

// New carrega os dados, calcula o que é derivado e renderiza as páginas.
func New() (*Site, error) {
	els, err := chem.Elements()
	if err != nil {
		return nil, err
	}
	ions, err := chem.Catalog()
	if err != nil {
		return nil, err
	}

	d := dados{Elementos: els, Categorias: categorias}
	for _, ion := range ions {
		if ion.Tipo == "cation" {
			d.Cations = append(d.Cations, ion)
		} else {
			d.Anions = append(d.Anions, ion)
		}
	}
	for g := 1; g <= 18; g++ {
		d.Grupos = append(d.Grupos, g)
	}
	for p := 1; p <= 7; p++ {
		d.Periodos = append(d.Periodos, p)
	}
	for _, e := range els {
		d.Indice = append(d.Indice, indice{e.Simbolo, e.Nome, e.NomeEn, e.Z})
	}

	versao, err := versaoEstaticos()
	if err != nil {
		return nil, err
	}
	// "est" monta o endereço versionado de um arquivo estático
	funcs["est"] = func(caminho string) string { return "static/" + caminho + "?v=" + versao }

	s := &Site{paginas: map[string][]byte{}}
	for _, p := range paginas {
		// cada página = base.html (moldura) + o modelo da própria página
		tmpl, err := template.New("").Funcs(funcs).ParseFS(web.FS, "templates/base.html", "templates/"+p.Modelo)
		if err != nil {
			return nil, fmt.Errorf("site: lendo o modelo %s: %w", p.Modelo, err)
		}
		d.Pagina, d.Titulo, d.TituloEn = p.Chave, p.Titulo, p.TituloEn
		var buf bytes.Buffer
		if err := tmpl.ExecuteTemplate(&buf, "base", d); err != nil {
			return nil, fmt.Errorf("site: renderizando %s: %w", p.Arquivo, err)
		}
		s.paginas[p.Arquivo] = buf.Bytes()
	}

	if s.elemsJSON, err = json.Marshal(els); err != nil {
		return nil, err
	}
	if s.ionsJSON, err = json.Marshal(ions); err != nil {
		return nil, err
	}
	return s, nil
}

// Handler devolve as rotas do site:
//
//	GET /                        tabela periódica
//	GET /ions.html               íons comuns
//	GET /configuracoes.html      configurações
//	GET /static/...              CSS, JS, fontes e imagens
//	GET /api/elements            os 118 elementos (JSON)
//	GET /api/elements/{simbolo}  um elemento (JSON)
//	GET /api/ions                catálogo de íons (JSON)
//	GET /api/molar-mass?f=H2SO4  massa molar de uma fórmula (JSON)
func (s *Site) Handler() http.Handler {
	mux := http.NewServeMux()

	pagina := func(arquivo string) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			w.Header().Set("Cache-Control", "no-cache") // a página em si nunca fica presa no cache
			w.Write(s.paginas[arquivo])
		}
	}
	mux.HandleFunc("GET /{$}", pagina("index.html"))
	for arquivo := range s.paginas {
		mux.HandleFunc("GET /"+arquivo, pagina(arquivo))
	}
	// endereços curtos: /ions e /configuracoes
	mux.Handle("GET /ions", http.RedirectHandler("/ions.html", http.StatusMovedPermanently))
	mux.Handle("GET /configuracoes", http.RedirectHandler("/configuracoes.html", http.StatusMovedPermanently))

	estaticos := http.FileServerFS(web.FS)
	mux.HandleFunc("GET /static/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Has("v") {
			// endereço versionado: o conteúdo nunca muda, pode ficar no cache
			w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		} else {
			w.Header().Set("Cache-Control", "no-cache")
		}
		estaticos.ServeHTTP(w, r)
	})

	mux.HandleFunc("GET /api/elements", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, s.elemsJSON)
	})
	mux.HandleFunc("GET /api/elements/{simbolo}", func(w http.ResponseWriter, r *http.Request) {
		e, ok := chem.BySymbol(r.PathValue("simbolo"))
		if !ok {
			writeError(w, http.StatusNotFound, "elemento não encontrado")
			return
		}
		writeValue(w, http.StatusOK, e)
	})
	mux.HandleFunc("GET /api/ions", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, s.ionsJSON)
	})
	mux.HandleFunc("GET /api/molar-mass", func(w http.ResponseWriter, r *http.Request) {
		formula := r.URL.Query().Get("f")
		massa, err := chem.MolarMass(formula)
		if err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		atomos, _ := chem.ParseFormula(formula)
		writeValue(w, http.StatusOK, map[string]any{"formula": formula, "massa_molar": massa, "atomos": atomos})
	})

	return logRequests(mux)
}

func writeJSON(w http.ResponseWriter, status int, body []byte) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	w.Write(body)
}

func writeValue(w http.ResponseWriter, status int, v any) {
	body, err := json.Marshal(v)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "erro interno")
		return
	}
	writeJSON(w, status, body)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	body, _ := json.Marshal(map[string]string{"erro": msg})
	writeJSON(w, status, body)
}

func logRequests(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		inicio := time.Now()
		next.ServeHTTP(w, r)
		log.Printf("%s %s (%s)", r.Method, r.URL.Path, time.Since(inicio).Round(time.Microsecond))
	})
}

// Export grava o site como arquivos estáticos em dir: as páginas, a
// pasta static/ e os JSON da API. O resultado abre direto no
// navegador e pode ser publicado no GitHub Pages.
func (s *Site) Export(dir string) error {
	for arquivo, html := range s.paginas {
		if err := writeFile(filepath.Join(dir, arquivo), html); err != nil {
			return err
		}
	}
	if err := writeFile(filepath.Join(dir, "api", "elements.json"), s.elemsJSON); err != nil {
		return err
	}
	if err := writeFile(filepath.Join(dir, "api", "ions.json"), s.ionsJSON); err != nil {
		return err
	}
	return fs.WalkDir(web.FS, "static", func(path string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return err
		}
		data, err := web.FS.ReadFile(path)
		if err != nil {
			return err
		}
		return writeFile(filepath.Join(dir, filepath.FromSlash(path)), data)
	})
}

func writeFile(path string, data []byte) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	return os.WriteFile(path, data, 0o644)
}
