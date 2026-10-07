/* ============================================================
   MOLTECH — base (carregado em todas as páginas)
   1. Preferências (localStorage) e formatação de números/unidades
   2. Busca do cabeçalho      3. Ajuda      4. Filtro da página de íons
   ============================================================ */
window.Moltech = (function () {
    'use strict';

    var CHAVE = 'moltech-config';
    var PADRAO = {
        temp: 'C', energia: 'kJ', aba: 'estrutura', velocidade: 1, girar: true,
        cartao: { numero: true, nome: true, massa: true, simbolo: 100, cantos: 12, borda: 1, cor: 100 }
    };

    function copiar(o) { return JSON.parse(JSON.stringify(o)); }
    function ler() {
        var cfg = copiar(PADRAO);
        try {
            var salvo = JSON.parse(localStorage.getItem(CHAVE) || '{}');
            Object.keys(PADRAO).forEach(function (k) {
                if (k === 'cartao') Object.keys(PADRAO.cartao).forEach(function (c) {
                    if (salvo.cartao && salvo.cartao[c] != null) cfg.cartao[c] = salvo.cartao[c];
                });
                else if (salvo[k] != null) cfg[k] = salvo[k];
            });
        } catch (e) { }
        return cfg;
    }
    var config = ler();

    function salvar() {
        try { localStorage.setItem(CHAVE, JSON.stringify(config)); } catch (e) { }
    }
    // mesma lógica do script do <head>, para a mudança valer na hora
    function aplicarCartao() {
        var c = config.cartao, r = document.documentElement;
        r.style.setProperty('--cz-raio', c.cantos + '%');
        r.style.setProperty('--cz-borda', c.borda + 'px');
        r.style.setProperty('--cz-croma', c.cor / 100);
        r.style.setProperty('--cz-simbolo', c.simbolo / 100);
        ['numero', 'nome', 'massa'].forEach(function (k) {
            var attr = 'sem' + k.charAt(0).toUpperCase() + k.slice(1);
            if (c[k]) delete r.dataset[attr]; else r.dataset[attr] = '';
        });
    }
    function redefinir() {
        var novo = copiar(PADRAO);
        Object.keys(novo).forEach(function (k) { config[k] = novo[k]; });
        salvar(); aplicarCartao();
    }

    var reduz = window.matchMedia('(prefers-reduced-motion: reduce)').matches;


    /* ========================================================
       IDIOMA — português (padrão) ⇄ inglês
       Texto fixo das páginas: sai do Go nos dois idiomas e o CSS
       mostra só um (html[lang]). Aqui ficam:
       • EN: o dicionário dos textos montados no JavaScript;
       • t(): traduz um texto exato;  th(): traduz os trechos
         conhecidos dentro de um HTML (sem tocar nas tags);
       • nome(): nome de elemento ou íon no idioma atual.
       ======================================================== */
    var idioma = 'pt';
    try { if (localStorage.getItem('moltech-idioma') === 'en') idioma = 'en'; } catch (e) { }

    var EN = {
        // categorias (singular e plural) e classificações
        'Metal alcalino': 'Alkali metal', 'Metal alcalinoterroso': 'Alkaline earth metal', 'Metal de transição': 'Transition metal',
        'Metal pós-transição': 'Post-transition metal', 'Semimetal': 'Metalloid', 'Não metal': 'Nonmetal', 'Halogênio': 'Halogen',
        'Gás nobre': 'Noble gas', 'Lantanídeo': 'Lanthanide', 'Actinídeo': 'Actinide',
        'Metais alcalinos': 'Alkali metals', 'Metais alcalinoterrosos': 'Alkaline earth metals', 'Metais de transição': 'Transition metals',
        'Outros metais': 'Other metals', 'Semimetais': 'Metalloids', 'Não metais': 'Nonmetals', 'Halogênios': 'Halogens',
        'Gases nobres': 'Noble gases', 'Lantanídeos': 'Lanthanides', 'Actinídeos': 'Actinides', 'Metais': 'Metals',
        'Bloco s': 's block', 'Bloco p': 'p block', 'Bloco d': 'd block', 'Bloco f': 'f block',
        'Sólido': 'Solid', 'Líquido': 'Liquid', 'Gasoso': 'Gas', 'Sem dados': 'No data', 'sem dados': 'no data',
        // visualizações da tabela
        'Categoria': 'Category', 'Bloco': 'Block', 'Tipo de metal': 'Metal type', 'Estado físico': 'Physical state',
        'Ponto de fusão': 'Melting point', 'Ponto de ebulição': 'Boiling point', 'Densidade': 'Density',
        'Eletronegatividade': 'Electronegativity', '1ª energia de ionização': '1st ionization energy',
        'Afinidade eletrônica': 'Electron affinity', 'Raio atômico': 'Atomic radius', 'Massa atômica': 'Atomic mass',
        'todos': 'all', 'elemento em destaque': 'element highlighted', 'elementos em destaque': 'elements highlighted',
        'Nenhum elemento encontrado.': 'No element found.',
        // ficha: palco
        'Modelo de Bohr · clique em uma camada': 'Bohr model · click a shell', 'Camada': 'Shell', 'Subcamada': 'Subshell',
        'elétrons': 'electrons', 'elétron': 'electron', 'máximo': 'max', ' em ': ' in ', 'orbitais': 'orbitals',
        'Todos': 'All', 'orbital vazio': 'empty orbital', 'Pausar animação': 'Pause animation', 'Retomar animação': 'Resume animation',
        // ficha: Estrutura
        'Partículas': 'Particles', 'prótons': 'protons', 'nêutrons': 'neutrons',
        'Elétrons por camada — clique para selecionar': 'Electrons per shell — click to select',
        'Selecionar a camada': 'Select shell', 'no modelo': 'on the model',
        'Elétrons de valência:': 'Valence electrons:', '(camada ': '(shell ', 'variável': 'variable',
        '. Nos blocos d e f, elétrons de camadas internas também participam das ligações.': '. In the d and f blocks, electrons from inner shells also take part in bonding.',
        // ficha: Orbitais
        'Configuração eletrônica': 'Electron configuration', 'Exceção à regra de Madelung.': 'Exception to the Madelung rule.',
        'A distribuição medida no estado fundamental é diferente da prevista pelo diagrama de Linus Pauling.': 'The distribution measured in the ground state differs from the one predicted by the Aufbau (Madelung) diagram.',
        'Diagrama de orbitais, em ordem de preenchimento': 'Orbital diagram, in filling order',
        'Ver a forma da subcamada': 'See the shape of subshell',
        'Clique em uma subcamada para ver a forma dos orbitais no modelo 3D. Cada caixa é um orbital, com até dois elétrons de spins opostos (↑↓); pela regra de Hund, cada orbital recebe um elétron antes de qualquer um receber o segundo.':
            'Click a subshell to see the shape of its orbitals in the 3D model. Each box is an orbital, holding up to two electrons with opposite spins (↑↓); by Hund\'s rule, every orbital gets one electron before any gets a second.',
        // ficha: Íons
        'Átomo e íons comuns — clique para ver no modelo': 'Atom and common ions — click to see on the model',
        'Neutro': 'Neutral', 'Cátion': 'Cation', 'Ânion': 'Anion', 'Configuração': 'Configuration', 'Formação': 'Formation',
        'perde ': 'loses ', 'ganha ': 'gains ', 'sem elétrons': 'no electrons', 'Estados de oxidação': 'Oxidation states', 'Sem dados.': 'No data.',
        'Os gases nobres têm a camada mais externa completa e, em condições normais, praticamente não formam íons.': 'Noble gases have a full outermost shell and, under normal conditions, hardly form ions at all.',
        'Este elemento não tem um íon monoatômico de uso comum cadastrado.': 'This element has no commonly used monatomic ion on record.',
        // ficha: Propriedades e topo
        'Estado a 25 °C': 'State at 25 °C', 'previsão teórica': 'theoretical prediction', 'escala de Pauling': 'Pauling scale',
        'Descoberta': 'Discovery', 'Antiguidade': 'Antiquity', 'Grupo': 'Group', 'Período': 'Period',
        // configurações
        'Salvo.': 'Saved.', 'Preferências redefinidas.': 'Preferences reset.'
    };
    var FRASES = Object.keys(EN).sort(function (a, b) { return b.length - a.length; });   // as mais longas primeiro

    function t(s) { return idioma === 'en' && EN[s] != null ? EN[s] : s; }
    function frase(texto) {
        for (var i = 0; i < FRASES.length; i++) {
            if (texto.indexOf(FRASES[i]) !== -1) texto = texto.split(FRASES[i]).join(EN[FRASES[i]]);
        }
        return texto;
    }
    function th(html) {
        if (idioma !== 'en') return html;
        return html.replace(/(<[^>]*>)|([^<]+)/g, function (tudo, tag, texto) {
            if (texto) return frase(texto);
            return tag.replace(/(title|aria-label)="([^"]*)"/g, function (m, atributo, valor) { return atributo + '="' + frase(valor) + '"'; });
        });
    }
    function nome(o) { return idioma === 'en' && o.nome_en ? o.nome_en : o.nome; }

    // aplica o idioma ao que já está na página (atributos, nomes vindos do Go, título)
    var tituloPt = document.title;
    function aplicarIdioma() {
        var r = document.documentElement, en = idioma === 'en';
        r.lang = en ? 'en' : 'pt-BR';
        ['aria-label', 'title', 'placeholder'].forEach(function (a) {
            document.querySelectorAll('[data-en-' + a + ']').forEach(function (el) {
                if (!el.hasAttribute('data-pt-' + a)) el.setAttribute('data-pt-' + a, el.getAttribute(a) || '');
                el.setAttribute(a, en ? el.getAttribute('data-en-' + a) : el.getAttribute('data-pt-' + a));
            });
        });
        document.querySelectorAll('[data-en]').forEach(function (el) {
            var no = el.lastChild && el.lastChild.nodeType === 3 ? el.lastChild : null;   // preserva ícones antes do texto
            if (el.dataset.pt == null) el.dataset.pt = no ? no.nodeValue : el.textContent;
            var texto = en ? el.dataset.en : el.dataset.pt;
            if (no) no.nodeValue = texto; else el.textContent = texto;
        });
        document.querySelectorAll('.ion-m').forEach(function (el) {                       // 58,44 ⇄ 58.44
            if (el.dataset.pt == null) el.dataset.pt = el.textContent;
            el.textContent = en ? el.dataset.pt.replace(',', '.') : el.dataset.pt;
        });
        document.title = en ? (r.dataset.tituloEn || tituloPt) : tituloPt;
    }
    function trocarIdioma() {
        var r = document.documentElement;
        r.classList.add('trocando');                       // o conteúdo some por um instante…
        setTimeout(function () {
            idioma = idioma === 'en' ? 'pt' : 'en';
            try { localStorage.setItem('moltech-idioma', idioma); } catch (e) { }
            aplicarIdioma();
            document.dispatchEvent(new CustomEvent('moltech:idioma', { detail: idioma }));
            r.classList.remove('trocando');                // …e volta já no outro idioma
        }, reduz ? 0 : 190);
    }

    function num(v, casas) {
        return Number(v).toLocaleString(idioma === 'en' ? 'en-US' : 'pt-BR', { maximumFractionDigits: casas == null ? 2 : casas });
    }
    function semAcento(s) { return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }

    // temperatura em kelvin → valor na unidade escolhida
    var UNIDADE_TEMP = { C: '°C', F: '°F', K: 'K' };
    function tempValor(k) {
        return config.temp === 'K' ? k : (config.temp === 'F' ? (k - 273.15) * 9 / 5 + 32 : k - 273.15);
    }
    function tempTexto(k, casas) { return num(tempValor(k), casas == null ? 1 : casas) + ' ' + UNIDADE_TEMP[config.temp]; }
    // energia em eV por átomo → kJ/mol ou eV
    function energiaValor(ev) { return config.energia === 'eV' ? ev : ev * 96.485; }
    function energiaTexto(ev) { return num(energiaValor(ev), config.energia === 'eV' ? 3 : 0) + ' ' + (config.energia === 'eV' ? 'eV' : 'kJ/mol'); }

    return {
        config: config, PADRAO: PADRAO, salvar: salvar, aplicarCartao: aplicarCartao, redefinir: redefinir,
        num: num, semAcento: semAcento,
        t: t, th: th, nome: nome, idioma: function () { return idioma; }, aplicarIdioma: aplicarIdioma, trocarIdioma: trocarIdioma,
        tempValor: tempValor, tempTexto: tempTexto, unidadeTemp: function () { return UNIDADE_TEMP[config.temp]; },
        energiaValor: energiaValor, energiaTexto: energiaTexto,
        unidadeEnergia: function () { return config.energia === 'eV' ? 'eV' : 'kJ/mol'; },
        reduzMovimento: reduz,
        // fecha um <dialog> com animação de saída (classe .fechando no CSS)
        fechar: function (dialogo) {
            if (!dialogo.open || dialogo.classList.contains('fechando')) return;
            if (reduz) { dialogo.close(); return; }
            dialogo.classList.add('fechando');
            // espera a animação de saída terminar (com um teto de tempo, caso o evento não venha)
            var feito = false;
            function fim() {
                if (feito) return; feito = true;
                dialogo.removeEventListener('animationend', aoTerminar);
                if (!dialogo.classList.contains('fechando')) return;   // foi reaberto no meio da saída
                if (dialogo.open) dialogo.close();
                dialogo.classList.remove('fechando');
            }
            function aoTerminar(ev) { if (ev.target === dialogo) fim(); }
            dialogo.addEventListener('animationend', aoTerminar);
            setTimeout(fim, 400);
        }
    };
})();

(function () {
    'use strict';
    var M = window.Moltech;

    /* ========================================================
       2. BUSCA DO CABEÇALHO
       Lista até 6 resultados. Na página da tabela, também avisa o
       tabela.js (evento moltech:busca) para apagar o que não bate.
       ======================================================== */
    var indice = JSON.parse(document.getElementById('indice').textContent);
    var caixa = document.getElementById('busca-caixa');
    var campo = document.getElementById('busca');
    var lista = document.getElementById('busca-resultados');
    var marcado = -1, achados = [];

    function procurar(termo) {
        if (!termo) return [];
        var numero = /^\d+$/.test(termo);
        var r = indice.filter(function (e) {
            if (numero) return String(e.z) === termo;
            return M.semAcento(e.s) === termo || M.semAcento(e.n).indexOf(termo) !== -1 || M.semAcento(e.e).indexOf(termo) !== -1;
        });
        // símbolo exato primeiro: "s" traz o enxofre antes do sódio
        r.sort(function (a, b) { return (M.semAcento(b.s) === termo) - (M.semAcento(a.s) === termo); });
        return r;
    }
    function abrirElemento(simbolo) {
        campo.value = ''; atualizar(); campo.blur();
        // se a página tem a ficha (Tabela e Íons), abre aqui mesmo; senão, vai para a tabela
        if (document.getElementById('ficha')) document.dispatchEvent(new CustomEvent('moltech:abrir', { detail: simbolo }));
        else location.href = 'index.html#' + simbolo;
    }
    function desenhar() {
        if (!campo.value.trim()) { lista.hidden = true; return; }
        lista.hidden = false;
        lista.innerHTML = achados.length
            ? achados.slice(0, 6).map(function (e, i) {
                return '<li><a href="index.html#' + e.s + '" data-s="' + e.s + '"' + (i === marcado ? ' class="marcado"' : '') +
                    '><b>' + e.s + '</b>' + (M.idioma() === 'en' ? e.e : e.n) + '<small>' + e.z + '</small></a></li>';
            }).join('')
            : '<li class="vazio">' + M.t('Nenhum elemento encontrado.') + '</li>';
    }
    function atualizar() {
        var termo = M.semAcento(campo.value.trim());
        achados = procurar(termo);
        marcado = achados.length ? 0 : -1;
        caixa.classList.toggle('aberta', !!termo);
        desenhar();
        document.dispatchEvent(new CustomEvent('moltech:busca', { detail: { termo: termo, simbolos: achados.map(function (e) { return e.s; }) } }));
    }
    campo.addEventListener('input', atualizar);
    campo.addEventListener('keydown', function (ev) {
        var n = Math.min(achados.length, 6);
        if (ev.key === 'ArrowDown' && n) { ev.preventDefault(); marcado = (marcado + 1) % n; desenhar(); }
        else if (ev.key === 'ArrowUp' && n) { ev.preventDefault(); marcado = (marcado - 1 + n) % n; desenhar(); }
        else if (ev.key === 'Enter' && marcado >= 0) { ev.preventDefault(); abrirElemento(achados[marcado].s); }
        else if (ev.key === 'Escape') { campo.value = ''; atualizar(); campo.blur(); }
    });
    lista.addEventListener('click', function (ev) {
        var a = ev.target.closest('a[data-s]');
        if (a) { ev.preventDefault(); abrirElemento(a.dataset.s); }
    });
    document.addEventListener('click', function (ev) { if (!caixa.contains(ev.target)) lista.hidden = true; });
    campo.addEventListener('focus', desenhar);
    // toque ou clique na lupa: abre e mantém aberta (em tela de toque não existe "passar o cursor")
    caixa.addEventListener('click', function () { if (document.activeElement !== campo) campo.focus(); });
    // atalho: "/" abre a busca
    document.addEventListener('keydown', function (ev) {
        if (ev.key === '/' && !document.querySelector('dialog[open]') && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) {
            ev.preventDefault(); campo.focus();
        }
    });

    /* ========================================================
       3. AJUDA — botão "?" do cabeçalho
       ======================================================== */
    var ajuda = document.getElementById('ajuda');
    document.getElementById('abrir-ajuda').addEventListener('click', function () { ajuda.showModal(); });
    ajuda.addEventListener('click', function (ev) { if (ev.target === ajuda) M.fechar(ajuda); });
    ajuda.addEventListener('cancel', function (ev) { ev.preventDefault(); M.fechar(ajuda); });
    ajuda.querySelector('form').addEventListener('submit', function (ev) { ev.preventDefault(); M.fechar(ajuda); });

    /* ========================================================
       4. PÁGINA DE ÍONS — filtro
       ======================================================== */
    var filtros = Array.prototype.slice.call(document.querySelectorAll('.filtro'));
    var ions = Array.prototype.slice.call(document.querySelectorAll('.ion'));
    filtros.forEach(function (filtro) {
        filtro.addEventListener('click', function () {
            var classe = filtro.dataset.classe;
            filtros.forEach(function (f) { f.setAttribute('aria-pressed', String(f === filtro)); });
            ions.forEach(function (ion) { ion.hidden = classe !== 'todos' && ion.dataset.classe !== classe; });
        });
    });

    /* ========================================================
       5. IDIOMA — botão PT / EN do cabeçalho
       ======================================================== */
    M.aplicarIdioma();
    document.getElementById('idioma').addEventListener('click', M.trocarIdioma);
    document.addEventListener('moltech:idioma', desenhar);

    // o logo usa animação SMIL; com "movimento reduzido" ele fica parado
    var logo = document.querySelector('.orbital');
    if (M.reduzMovimento && logo && logo.pauseAnimations) logo.pauseAnimations();
})();
