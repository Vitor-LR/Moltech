package site

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func novo(t *testing.T) *Site {
	t.Helper()
	s, err := New()
	if err != nil {
		t.Fatal(err)
	}
	return s
}

func TestPagina(t *testing.T) {
	srv := httptest.NewServer(novo(t).Handler())
	defer srv.Close()

	res, err := http.Get(srv.URL + "/")
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		t.Fatalf("GET /: status %d", res.StatusCode)
	}
	s := novo(t)
	html := string(s.paginas["index.html"])
	if n := strings.Count(html, `<a class="el"`); n != 118 {
		t.Errorf("a tabela tem %d casas de elemento, esperava 118", n)
	}
	contem := map[string][]string{
		"index.html":         {`href="#Fe"`, `id="dados"`, "Oganessônio", `id="palco"`, `<span class="en" lang="en">Table</span>`, `data-en="Iron"`, `id="idioma"`},
		"ions.html":          {"SO<sub>4</sub><sup>2−</sup>", `href="#Cl/ions/-1"`, `id="palco"`, `data-en="Chloride"`, `data-en="Iron(III) ion"`},
		"configuracoes.html": {`data-config="temp"`, `data-cartao="cantos"`, `<span class="en" lang="en">Settings</span>`},
	}
	for arquivo, trechos := range contem {
		pagina := string(s.paginas[arquivo])
		for _, trecho := range trechos {
			if !strings.Contains(pagina, trecho) {
				t.Errorf("%s deveria conter %q", arquivo, trecho)
			}
		}
		if !strings.Contains(pagina, `static/css/style.css?v=`) || !strings.Contains(pagina, `static/js/base.js?v=`) {
			t.Errorf("%s deveria usar endereços versionados (?v=) para CSS e JS", arquivo)
		}
		if !strings.Contains(pagina, `id="abrir-ajuda"`) || !strings.Contains(pagina, `id="busca"`) {
			t.Errorf("%s sem o cabeçalho completo (busca e ajuda)", arquivo)
		}
	}
}

func TestAPI(t *testing.T) {
	srv := httptest.NewServer(novo(t).Handler())
	defer srv.Close()

	casos := []struct {
		caminho string
		status  int
	}{
		{"/", 200}, {"/ions.html", 200}, {"/configuracoes.html", 200},
		{"/api/elements", 200}, {"/api/elements/Fe", 200}, {"/api/elements/Xx", 404},
		{"/api/ions", 200}, {"/api/molar-mass?f=H2O", 200}, {"/api/molar-mass?f=", 400},
		{"/static/css/style.css", 200}, {"/nao-existe", 404},
	}
	for _, c := range casos {
		res, err := http.Get(srv.URL + c.caminho)
		if err != nil {
			t.Fatal(err)
		}
		res.Body.Close()
		if res.StatusCode != c.status {
			t.Errorf("GET %s: status %d, esperava %d", c.caminho, res.StatusCode, c.status)
		}
	}

	res, err := http.Get(srv.URL + "/api/elements/Fe")
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	var fe struct {
		Nome        string `json:"nome"`
		ConfigAbrev string `json:"config_abrev"`
		Camadas     []int  `json:"camadas"`
	}
	if err := json.NewDecoder(res.Body).Decode(&fe); err != nil {
		t.Fatal(err)
	}
	if fe.Nome != "Ferro" || fe.ConfigAbrev != "[Ar] 3d6 4s2" || len(fe.Camadas) != 4 {
		t.Errorf("ferro veio errado da API: %+v", fe)
	}
}

func TestExport(t *testing.T) {
	dir := t.TempDir()
	if err := novo(t).Export(dir); err != nil {
		t.Fatal(err)
	}
	for _, arq := range []string{"index.html", "ions.html", "configuracoes.html", "api/elements.json", "api/ions.json",
		"static/css/style.css", "static/js/base.js", "static/js/tabela.js", "static/js/ficha.js", "static/js/atomo3d.js", "static/js/config.js",
		"static/fonts/atkinson-next.woff2", "static/img/favicon.svg"} {
		if info, err := os.Stat(filepath.Join(dir, filepath.FromSlash(arq))); err != nil || info.Size() == 0 {
			t.Errorf("exportação sem o arquivo %s", arq)
		}
	}
}
