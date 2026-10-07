/* ============================================================
   MOLTECH — página da tabela
   ------------------------------------------------------------
   Os dados dos elementos (inclusive configuração eletrônica,
   camadas, diagrama de orbitais e íons) chegam prontos do Go, no
   <script id="dados">. Aqui só se desenha e se interage:

   1. Visualizações: classificação (cores por grupo) e propriedade
      (escala de cor), com legenda e controle deslizante
   2. Prévia e filtros (busca + legenda + controle deslizante)
   3. Ligação com a ficha do elemento (ficha.js)
   ============================================================ */
(function () {
    'use strict';
    var M = window.Moltech, cfg = M.config, num = M.num;

    var dados = JSON.parse(document.getElementById('dados').textContent);
    var porSimbolo = {};
    dados.forEach(function (e) { porSimbolo[e.simbolo] = e; });

    var CATEGORIA = {
        'alcalino': 'Metal alcalino', 'alcalinoterroso': 'Metal alcalinoterroso', 'transicao': 'Metal de transição',
        'pos-transicao': 'Metal pós-transição', 'semimetal': 'Semimetal', 'nao-metal': 'Não metal', 'halogenio': 'Halogênio',
        'gas-nobre': 'Gás nobre', 'lantanideo': 'Lantanídeo', 'actinideo': 'Actinídeo'
    };
    var ESTADO = { solido: 'Sólido', liquido: 'Líquido', gasoso: 'Gasoso', desconhecido: 'Sem dados' };

    function configHTML(c) { return c ? c.replace(/(\d[spdf])(\d+)/g, '$1<sup>$2</sup>') : '—'; }
    function plural(n, um, varios) { return n + ' ' + (n === 1 ? um : varios); }

    var grade = document.getElementById('grade');
    var casas = Array.prototype.slice.call(grade.querySelectorAll('a.el'));

    /* ========================================================
       1. VISUALIZAÇÕES
       Classificação: `grupos` + `de(e)` (a que grupo o elemento pertence).
       Propriedade:   `valor(e)` (número ou null) + `texto(v)`.
       ======================================================== */
    var temperatura = 298.15;      // K — usada na visualização "Estado físico"

    function estadoEm(e, k) {
        if (e.fusao_k == null) return Math.abs(k - 298.15) < 4 ? e.estado : 'desconhecido';
        if (k < e.fusao_k) return 'solido';
        if (e.ebulicao_k == null) return Math.abs(k - 298.15) < 4 ? e.estado : 'desconhecido';
        return k < e.ebulicao_k ? 'liquido' : 'gasoso';
    }

    var VISAO = {
        categoria: { nome: 'Categoria', de: function (e) { return e.categoria; } },
        bloco: {
            nome: 'Bloco', de: function (e) { return e.bloco; },
            grupos: [['s', 'Bloco s', 25], ['p', 'Bloco p', 138], ['d', 'Bloco d', 252], ['f', 'Bloco f', 318]]
        },
        metal: {
            nome: 'Tipo de metal', de: function (e) { return e.metal; },
            grupos: [['metal', 'Metais', 252], ['semimetal', 'Semimetais', 168], ['nao-metal', 'Não metais', 62]]
        },
        estado: {
            nome: 'Estado físico', de: function (e) { return estadoEm(e, temperatura); }, faixa: 'temperatura',
            grupos: [['solido', 'Sólido', 62], ['liquido', 'Líquido', 240], ['gasoso', 'Gasoso', 318], ['desconhecido', 'Sem dados', null]]
        },
        fusao: { nome: 'Ponto de fusão', valor: function (e) { return e.fusao_k; }, mostra: M.tempValor, unidade: M.unidadeTemp, casas: 0 },
        ebulicao: { nome: 'Ponto de ebulição', valor: function (e) { return e.ebulicao_k; }, mostra: M.tempValor, unidade: M.unidadeTemp, casas: 0 },
        densidade: { nome: 'Densidade', valor: function (e) { return e.densidade; }, unidade: function () { return 'g/cm³'; }, casas: 2 },
        eletronegatividade: { nome: 'Eletronegatividade', valor: function (e) { return e.eletronegatividade; }, unidade: function () { return 'Pauling'; }, casas: 2 },
        ionizacao: { nome: '1ª energia de ionização', valor: function (e) { return e.ionizacao_ev; }, mostra: M.energiaValor, unidade: M.unidadeEnergia, casas: cfg.energia === 'eV' ? 2 : 0 },
        afinidade: { nome: 'Afinidade eletrônica', valor: function (e) { return e.afinidade_ev; }, mostra: M.energiaValor, unidade: M.unidadeEnergia, casas: cfg.energia === 'eV' ? 2 : 0 },
        raio: { nome: 'Raio atômico', valor: function (e) { return e.raio_pm; }, unidade: function () { return 'pm'; }, casas: 0 }
    };
    // a categoria usa os mesmos nomes e matizes da legenda renderizada pelo Go
    VISAO.categoria.grupos = Array.prototype.map.call(document.querySelectorAll('#legenda .chip-cat'), function (chip) {
        return [chip.dataset.chave, (chip.dataset.pt || chip.textContent).trim(), Number(getComputedStyle(chip).getPropertyValue('--h'))];
    });

    var visaoAtual = 'categoria';
    var grupoAtivo = null;         // item da legenda fixado com um clique
    var grupoApontado = null;      // item da legenda sob o cursor (destaque passageiro)
    var corte = null;              // valor mínimo do controle deslizante (propriedade)
    var limites = null;            // [mín, máx] da propriedade atual
    var buscados = null;           // símbolos que a busca encontrou (null = sem busca)

    // escala de cor: amarelo claro (menor) → vermelho escuro (maior)
    function calor(t) { return 'oklch(' + (0.955 - 0.52 * t).toFixed(3) + ' ' + (0.045 + 0.14 * Math.sin(Math.PI * (0.15 + 0.7 * t))).toFixed(3) + ' ' + (100 - 82 * t).toFixed(1) + ')'; }
    function textoValor(v, bruto) {
        var x = v.mostra ? v.mostra(bruto) : bruto;
        return num(x, Math.abs(x) < 0.1 && x !== 0 ? 4 : v.casas);
    }

    var legenda = document.getElementById('legenda');
    var faixa = document.getElementById('faixa');
    var faixaControle = document.getElementById('faixa-controle');
    var faixaValor = document.getElementById('faixa-valor');

    function pintar() {
        var v = VISAO[visaoAtual];
        grade.classList.toggle('sem-categoria', visaoAtual !== 'categoria');
        casas.forEach(function (casa) {
            var e = porSimbolo[casa.dataset.s], massa = casa.querySelector('.el-m');
            casa.classList.remove('calor', 'escuro', 'sem-dado');
            casa.style.removeProperty('--calor'); casa.style.removeProperty('--h');
            massa.textContent = num(e.massa, 3);
            if (v.valor) {
                var bruto = v.valor(e);
                if (bruto == null) { casa.classList.add('sem-dado'); massa.textContent = '—'; return; }
                var t = (bruto - limites[0]) / (limites[1] - limites[0] || 1);
                casa.classList.add('calor'); casa.classList.toggle('escuro', t > 0.6);
                casa.style.setProperty('--calor', calor(t));
                massa.textContent = textoValor(v, bruto);
            } else if (visaoAtual !== 'categoria') {
                var chave = v.de(e), g = v.grupos.filter(function (x) { return x[0] === chave; })[0];
                if (!g || g[2] == null) casa.classList.add('sem-dado'); else casa.style.setProperty('--h', g[2]);
            }
        });
    }

    // telas pequenas: botão "Destacar" (no lugar do cartão da legenda) e escala compacta
    var destaque = document.getElementById('destaque'), destaqueMenu = document.getElementById('destaque-menu');
    var escalaMovel = document.getElementById('escala-movel');
    function desenharDestaque() {
        var v = VISAO[visaoAtual];
        destaque.hidden = !v.grupos;
        escalaMovel.hidden = !v.valor;
        if (v.valor) {
            escalaMovel.innerHTML = '<span>' + textoValor(v, limites[0]) + '</span><i style="background:linear-gradient(90deg, ' +
                [0, 0.25, 0.5, 0.75, 1].map(calor).join(', ') + ')"></i><span>' + textoValor(v, limites[1]) + ' ' + v.unidade() + '</span>';
            return;
        }
        var ativo = v.grupos.filter(function (g) { return g[0] === grupoAtivo; })[0];
        document.getElementById('destaque-rotulo').textContent = M.th(ativo ? ativo[1] : 'Todos');
        destaqueMenu.innerHTML = M.th('<div><button type="button" data-grupo="" aria-pressed="' + !ativo + '">Todos</button>' +
            v.grupos.map(function (g) {
                return '<button type="button" data-grupo="' + g[0] + '" aria-pressed="' + (grupoAtivo === g[0]) + '"><span class="ponto" style="--h:' +
                    (g[2] == null ? 0 : g[2]) + (g[2] == null ? ';background:var(--linha-forte)' : '') + '"></span>' + g[1] + '</button>';
            }).join('') + '</div>');
    }

    function desenharLegenda() {
        var v = VISAO[visaoAtual];
        desenharDestaque();
        if (v.valor) {
            var pontos = [0, 0.25, 0.5, 0.75, 1].map(calor).join(', ');
            legenda.className = 'legenda';
            legenda.innerHTML = M.th('<div class="escala"><strong>' + v.nome + ' (' + v.unidade() + ')</strong>' +
                '<div class="escala-barra" style="background:linear-gradient(90deg, ' + pontos + ')"></div>' +
                '<div class="escala-pontas"><span>' + textoValor(v, limites[0]) + '</span><span>' + textoValor(v, limites[1]) + '</span></div>' +
                '<div class="escala-sem"><i></i>sem dados</div></div>');
            return;
        }
        legenda.className = 'legenda' + (v.grupos.length <= 4 ? ' poucos' : '');
        legenda.innerHTML = M.th(v.grupos.map(function (g, i) {
            return '<button type="button" class="chip-cat" data-chave="' + g[0] + '" aria-pressed="' + (grupoAtivo === g[0]) +
                '" style="--h:' + (g[2] == null ? 0 : g[2]) + ';animation-delay:' + i * 25 + 'ms">' +
                '<i' + (g[2] == null ? ' style="background:var(--linha-forte)"' : '') + '></i>' + g[1] + '</button>';
        }).join(''));
    }

    function prepararFaixa() {
        var v = VISAO[visaoAtual];
        faixa.hidden = !(v.valor || v.faixa);
        if (v.valor) { faixaControle.value = 0; corte = null; faixaValor.textContent = M.t('todos'); }
        else if (v.faixa) { faixaControle.value = Math.round(temperatura / 6273.15 * 1000); faixaValor.textContent = M.tempTexto(temperatura, 0); }
    }
    faixaControle.addEventListener('input', function () {
        var v = VISAO[visaoAtual], p = faixaControle.value / 1000;
        if (v.valor) {
            corte = p === 0 ? null : limites[0] + p * (limites[1] - limites[0]);
            faixaValor.textContent = corte == null ? M.t('todos') : '≥ ' + textoValor(v, corte) + ' ' + v.unidade();
            aplicarFiltros();
        } else {
            temperatura = p * 6273.15;
            faixaValor.textContent = M.tempTexto(temperatura, 0);
            pintar(); aplicarFiltros();
        }
    });

    function trocarVisao(nome) {
        visaoAtual = nome; grupoAtivo = null; grupoApontado = null; corte = null;
        var v = VISAO[nome];
        if (v.valor) {
            var valores = dados.map(v.valor).filter(function (x) { return x != null; });
            limites = [Math.min.apply(null, valores), Math.max.apply(null, valores)];
        }
        document.getElementById('visao-rotulo').textContent = M.t(v.nome);
        document.querySelectorAll('#visao-menu button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.visao === nome)); });
        prepararFaixa(); pintar(); desenharLegenda(); aplicarFiltros();
    }

    // menu "Visualizar por"
    var visaoBotao = document.getElementById('visao-botao'), visaoMenu = document.getElementById('visao-menu');
    var destaqueBotao = document.getElementById('destaque-botao');
    var MENUS = [[visaoBotao, visaoMenu], [destaqueBotao, destaqueMenu]];
    function abrirMenu(qual, aberto) {
        MENUS.forEach(function (m) {
            var mostra = m[1] === qual && aberto;
            m[1].hidden = !mostra; m[0].setAttribute('aria-expanded', String(mostra));
        });
    }
    function menu(aberto) { abrirMenu(visaoMenu, aberto); }
    MENUS.forEach(function (m) { m[0].addEventListener('click', function () { abrirMenu(m[1], m[1].hidden); }); });
    visaoMenu.addEventListener('click', function (ev) {
        var b = ev.target.closest('button[data-visao]');
        if (b) { trocarVisao(b.dataset.visao); menu(false); visaoBotao.focus(); }
    });
    destaqueMenu.addEventListener('click', function (ev) {
        var b = ev.target.closest('button[data-grupo]');
        if (!b) return;
        grupoAtivo = b.dataset.grupo || null;
        desenharLegenda(); aplicarFiltros();
        abrirMenu(null, false); destaqueBotao.focus();
    });
    document.addEventListener('click', function (ev) { if (!ev.target.closest('.visao')) abrirMenu(null, false); });
    document.addEventListener('keydown', function (ev) {
        if (ev.key !== 'Escape') return;
        MENUS.forEach(function (m) { if (!m[1].hidden) { abrirMenu(null, false); m[0].focus(); } });
    });
    document.querySelectorAll('[data-unidade="temp"]').forEach(function (s) { s.textContent = M.unidadeTemp(); });
    document.querySelectorAll('[data-unidade="energia"]').forEach(function (s) { s.textContent = M.unidadeEnergia(); });

    // legenda: passar o cursor destaca o grupo; clicar mantém o destaque
    legenda.addEventListener('click', function (ev) {
        var chip = ev.target.closest('.chip-cat');
        if (!chip) return;
        grupoAtivo = grupoAtivo === chip.dataset.chave ? null : chip.dataset.chave;
        legenda.querySelectorAll('.chip-cat').forEach(function (c) { c.setAttribute('aria-pressed', String(c.dataset.chave === grupoAtivo)); });
        desenharDestaque(); aplicarFiltros();
    });
    function apontar(ev) {
        var chip = ev.target.closest && ev.target.closest('.chip-cat');
        var chave = chip ? chip.dataset.chave : null;
        if (chave !== grupoApontado) { grupoApontado = chave; aplicarFiltros(); }
    }
    legenda.addEventListener('mouseover', apontar);
    legenda.addEventListener('focusin', apontar);
    legenda.addEventListener('mouseleave', function () { if (grupoApontado) { grupoApontado = null; aplicarFiltros(); } });
    legenda.addEventListener('focusout', function () { if (grupoApontado) { grupoApontado = null; aplicarFiltros(); } });

    // Redefinir: volta à visualização por categoria, sem destaque nem corte
    var botaoRedefinir = document.getElementById('visao-redefinir');
    botaoRedefinir.addEventListener('click', function () { trocarVisao('categoria'); visaoBotao.focus(); });

    /* ========================================================
       2. PRÉVIA E FILTROS
       ======================================================== */
    var resultado = document.getElementById('resultado-busca');

    function corresponde(e) {
        var v = VISAO[visaoAtual];
        if (buscados && buscados.indexOf(e.simbolo) === -1) return false;
        var grupo = grupoApontado || grupoAtivo;
        if (grupo && v.de && v.de(e) !== grupo) return false;
        if (corte != null && v.valor) { var x = v.valor(e); if (x == null || x < corte) return false; }
        return true;
    }
    function aplicarFiltros() {
        var ativo = !!(buscados || grupoAtivo || grupoApontado || corte != null), n = 0;
        // Redefinir aparece quando há algo para desfazer (o destaque passageiro não conta)
        botaoRedefinir.hidden = visaoAtual === 'categoria' && !grupoAtivo && corte == null;
        grade.classList.toggle('filtrando', ativo);
        casas.forEach(function (casa) {
            var ok = ativo && corresponde(porSimbolo[casa.dataset.s]);
            casa.classList.toggle('acende', ok);
            if (ok) n++;
        });
        resultado.textContent = ativo ? plural(n, M.t('elemento em destaque'), M.t('elementos em destaque')) : '';
    }
    document.addEventListener('moltech:busca', function (ev) {
        buscados = ev.detail.termo ? ev.detail.simbolos : null;
        aplicarFiltros();
    });

    var previa = document.getElementById('previa');
    function mostrarPrevia(e) {
        var v = VISAO[visaoAtual], extra;
        if (v.valor) {
            var bruto = v.valor(e);
            extra = v.nome + ' <code>' + (bruto == null ? 'sem dados' : textoValor(v, bruto) + ' ' + v.unidade()) + '</code>';
        } else if (visaoAtual === 'estado') extra = ESTADO[estadoEm(e, temperatura)] + (M.idioma() === 'en' ? ' at ' : ' a ') + M.tempTexto(temperatura, 0);
        else extra = 'Massa atômica <code>' + num(e.massa, 3) + ' u</code>';
        previa.innerHTML = M.th(
            '<div class="previa-casa" data-cat="' + e.categoria + '"><span>' + e.z + '</span><b>' + e.simbolo + '</b></div>' +
            '<div class="previa-info"><strong>' + M.nome(e) + '</strong><span>' + CATEGORIA[e.categoria] + '</span>' +
            '<span>' + extra + '</span><span><code>' + configHTML(e.config_abrev) + '</code></span></div>');
    }
    var ultimaPrevia = null;
    function aoApontar(ev) {
        var casa = ev.target.closest('a.el');
        if (casa && casa.dataset.s !== ultimaPrevia) { ultimaPrevia = casa.dataset.s; mostrarPrevia(porSimbolo[casa.dataset.s]); }
    }
    grade.addEventListener('mouseover', aoApontar);
    grade.addEventListener('focusin', aoApontar);

    // troca de idioma: redesenha o que é montado aqui (rótulo, legenda, valores, resumo)
    document.addEventListener('moltech:idioma', function () {
        var v = VISAO[visaoAtual];
        document.getElementById('visao-rotulo').textContent = M.t(v.nome);
        pintar(); desenharLegenda(); aplicarFiltros();
        if (v.valor && corte == null) faixaValor.textContent = M.t('todos');
        if (ultimaPrevia) mostrarPrevia(porSimbolo[ultimaPrevia]);
    });
    document.getElementById('visao-rotulo').textContent = M.t(VISAO.categoria.nome);
    desenharDestaque();
    if (M.idioma() === 'en') { pintar(); desenharLegenda(); }      // a página já abriu em inglês

    /* ========================================================
       3. LIGAÇÃO COM A FICHA (ficha.js)
       ======================================================== */
    grade.addEventListener('click', function (ev) {
        var casa = ev.target.closest('a.el');
        if (casa) { ev.preventDefault(); ev.stopPropagation(); document.dispatchEvent(new CustomEvent('moltech:abrir', { detail: casa.dataset.s })); }
    });
    // a casa do elemento aberto fica destacada enquanto a ficha está na tela
    document.addEventListener('moltech:ficha', function (ev) {
        casas.forEach(function (casa) { casa.classList.toggle('ativo', casa.dataset.s === ev.detail); });
    });
})();
