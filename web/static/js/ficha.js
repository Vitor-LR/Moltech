/* ============================================================
   MOLTECH — ficha do elemento (páginas Tabela e Íons)
   ------------------------------------------------------------
   Abre a ficha sobre a página atual, sem navegar: abas Estrutura,
   Orbitais, Íons e Propriedades, mais o palco 3D (atomo3d.js).

   Os dados (configuração, camadas, diagrama, íons…) chegam prontos
   do Go, no <script id="dados">.

   Conversa com o resto do site por eventos:
     moltech:abrir  (detail = "Fe")        → alguém pediu para abrir
     moltech:ficha  (detail = "Fe" | null) → a ficha abriu / fechou
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
    var ESTADO = { solido: 'Sólido', liquido: 'Líquido', gasoso: 'Gasoso' };
    var CAMADA = ['K', 'L', 'M', 'N', 'O', 'P', 'Q'];
    var CAPACIDADE = [2, 8, 18, 32, 32, 18, 8];   // máximo de elétrons observado em cada camada

    function configHTML(c) { return c ? c.replace(/(\d[spdf])(\d+)/g, '$1<sup>$2</sup>') : '—'; }
    function oxidacaoTexto(c) { return c === 0 ? '0' : (c > 0 ? '+' : '\u2212') + Math.abs(c); }
    function plural(n, um, varios) { return n + ' ' + (n === 1 ? um : varios); }

    var ficha = document.getElementById('ficha');
    var abas = Array.prototype.slice.call(ficha.querySelectorAll('.aba'));
    var palcoCaixa = ficha.querySelector('.ficha-palco');
    var rotuloPalco = document.getElementById('palco-rotulo');
    var legendaSub = document.getElementById('palco-legenda');
    var seletorOrbital = document.getElementById('palco-orbitais');
    var palco = window.Palco3D(document.getElementById('palco'));
    var tituloDaPagina = document.title;

    var atual = null, abaAtual = cfg.aba, abaPedida = null, cargaPedida = null;
    var pausado = M.reduzMovimento, verSubcamadas = false;
    var ionAtivo = null;        // null = átomo neutro; senão, índice em atual.ions
    var subAtiva = 0;           // subcamada mostrada nos orbitais (índice em atual.diagrama)
    var focoOrbital = null;     // null = todos os orbitais juntos; senão, o índice de um
    var camadasNoPalco = [];    // elétrons por camada do que está desenhado (átomo ou íon)

    palco.configurar({ velocidade: cfg.velocidade, girar: cfg.girar && !M.reduzMovimento });
    palco.pausar(pausado, true);

    // diagrama (lista de subcamadas) → para cada camada, os grupos [tipo, elétrons]
    function gruposPorCamada(diagrama, total) {
        var grupos = [];
        for (var c = 0; c < total; c++) grupos.push([]);
        diagrama.forEach(function (s) {
            var n = Number(s.rotulo.charAt(0)) - 1;
            if (grupos[n]) grupos[n].push(['spdf'.indexOf(s.rotulo.charAt(1)), s.eletrons]);
        });
        grupos.forEach(function (g) { g.sort(function (a, b) { return a[0] - b[0]; }); });
        return grupos;
    }

    function rotuloCamada(i) {
        if (i == null) return null;
        return 'Camada <b>' + CAMADA[i] + '</b> · ' + plural(camadasNoPalco[i], 'elétron', 'elétrons') + ' · máximo ' + CAPACIDADE[i];
    }
    var rotuloBase = '';
    function camadaSelecionada(i) {
        rotuloPalco.innerHTML = M.th(rotuloCamada(i) || rotuloBase);
        ficha.querySelectorAll('.camada-linha').forEach(function (linha) {
            linha.setAttribute('aria-pressed', String(Number(linha.dataset.camada) === i));
        });
    }
    palco.aoSelecionarCamada(camadaSelecionada);

    // ---- o que o palco mostra depende da aba ----
    function atualizarPalco() {
        var e = atual, emOrbitais = abaAtual === 'orbitais';
        palcoCaixa.classList.toggle('escuro', emOrbitais);
        seletorOrbital.hidden = !emOrbitais;
        document.getElementById('subcamadas').hidden = emOrbitais;
        legendaSub.hidden = emOrbitais || !verSubcamadas;

        if (emOrbitais) {
            var s = e.diagrama[subAtiva], l = 'spdf'.indexOf(s.rotulo.slice(-1)), nomes = window.Palco3D.NOMES[l];
            if (focoOrbital != null && focoOrbital >= nomes.length) focoOrbital = null;
            palco.orbitais({ l: l, ocupacao: s.orbitais, foco: focoOrbital });
            rotuloBase = 'Subcamada <b>' + s.rotulo + '</b> · ' + plural(s.eletrons, 'elétron', 'elétrons') + ' em ' + plural(nomes.length, 'orbital', 'orbitais');
            seletorOrbital.innerHTML = M.th((nomes.length > 1 ? '<button type="button" data-orbital="todos" aria-pressed="' + (focoOrbital == null) + '">Todos</button>' : '') +
                nomes.map(function (nome, m) {
                    return '<button type="button" data-orbital="' + m + '" aria-pressed="' + (focoOrbital === m || nomes.length === 1) + '"' +
                        (s.orbitais[m] ? '' : ' class="vazio" title="orbital vazio"') + '>' + nome + '</button>';
                }).join(''));
            rotuloPalco.innerHTML = M.th(rotuloBase);
            return;
        }
        var ion = abaAtual === 'ions' && ionAtivo != null ? e.ions[ionAtivo] : null;
        var camadas = ion ? ion.camadas : e.camadas, diagrama = ion ? ion.diagrama : e.diagrama;
        camadasNoPalco = camadas;
        palco.bohr({ camadas: camadas, grupos: gruposPorCamada(diagrama, camadas.length), protons: e.z, neutrons: e.neutrons });
        rotuloBase = ion ? ion.html + ' · ' + plural(ion.eletrons, 'elétron', 'elétrons') : 'Modelo de Bohr · clique em uma camada';
        camadaSelecionada(null);
    }

    function painelEstrutura(e) {
        var externa = e.camadas.length - 1;
        var linhas = e.camadas.map(function (q, i) {
            return '<button type="button" class="camada-linha' + (i === externa ? ' valencia' : '') + '" data-camada="' + i + '" aria-pressed="false" title="Selecionar a camada ' + CAMADA[i] + ' no modelo"><em>' + CAMADA[i] + '</em>' +
                '<span class="camada-barra"><i style="width:' + Math.min(100, q / CAPACIDADE[i] * 100).toFixed(1) + '%;animation-delay:' + i * 60 + 'ms"></i></span>' +
                '<span>' + q + ' / ' + CAPACIDADE[i] + '</span></button>';
        }).join('');
        var valencia = e.valencia
            ? 'Elétrons de valência: <b>' + e.valencia + '</b> (camada ' + CAMADA[externa] + ').'
            : 'Elétrons de valência: <b>variável</b>. Nos blocos d e f, elétrons de camadas internas também participam das ligações.';
        return '<div class="bloco"><h3>Partículas</h3><div class="particulas">' +
            '<div class="particula"><b>' + e.z + '</b><span><i style="background:#D92D20"></i>prótons</span></div>' +
            '<div class="particula"><b>' + e.neutrons + '</b><span><i style="background:#8793A1"></i>nêutrons</span></div>' +
            '<div class="particula"><b>' + e.z + '</b><span><i style="background:#1552C8"></i>elétrons</span></div>' +
            '</div></div>' +
            '<div class="bloco"><h3>Elétrons por camada — clique para selecionar</h3><div class="camadas">' + linhas + '</div>' +
            '<p class="destaque">' + valencia + '</p></div>';
    }

    function painelOrbitais(e) {
        var setas = ['', '\u2191', '\u2191\u2193'];
        var diagrama = e.diagrama.map(function (s, i) {
            var caixas = s.orbitais.map(function (q) { return '<span class="orbital-caixa' + (q === 2 ? ' cheio' : '') + '">' + setas[q] + '</span>'; }).join('');
            return '<button type="button" class="subcamada" data-sub="' + i + '" aria-pressed="' + (i === subAtiva) + '" title="Ver a forma da subcamada ' + s.rotulo + '">' +
                '<span class="subcamada-caixas">' + caixas + '</span>' +
                '<span class="subcamada-rotulo"><b>' + s.rotulo + '</b> ' + s.eletrons + '/' + s.capacidade + '</span></button>';
        }).join('');
        return '<div class="bloco"><h3>Configuração eletrônica</h3>' +
            '<p class="config">' + configHTML(e.config_abrev) + '</p>' +
            (e.config !== e.config_abrev ? '<p class="config-completa">' + configHTML(e.config) + '</p>' : '') +
            (e.excecao ? '<p class="aviso"><strong>Exceção à regra de Madelung.</strong> A distribuição medida no estado fundamental é diferente da prevista pelo diagrama de Linus Pauling.</p>' : '') +
            '</div><div class="bloco"><h3>Diagrama de orbitais, em ordem de preenchimento</h3>' +
            '<div class="diagrama">' + diagrama + '</div>' +
            '<p class="destaque">Clique em uma subcamada para ver a forma dos orbitais no modelo 3D. Cada caixa é um orbital, com até dois elétrons de spins opostos (↑↓); pela regra de Hund, cada orbital recebe um elétron antes de qualquer um receber o segundo.</p></div>';
    }

    function painelIons(e) {
        function cartao(indice, formula, etiqueta, classe, nome, linhas) {
            var ativo = indice === 'neutro' ? ionAtivo == null : ionAtivo === indice;
            return '<button type="button" class="ion-cartao" data-ion="' + indice + '" aria-pressed="' + ativo + '">' +
                '<span class="linha1"><span class="formula">' + formula + '</span><span class="etiqueta ' + classe + '">' + etiqueta + '</span></span>' +
                '<span class="nome">' + nome + '</span><dl>' + linhas + '</dl></button>';
        }
        var html = '<div class="bloco"><h3>Átomo e íons comuns — clique para ver no modelo</h3><div class="ions-elemento">';
        html += cartao('neutro', e.simbolo, 'Neutro', 'neutro', M.idioma() === 'en' ? M.nome(e) + ' atom' : 'Átomo de ' + e.nome.toLowerCase(),
            '<dt>Partículas</dt><dd>' + e.z + ' p⁺ · ' + e.z + ' e⁻</dd><dt>Configuração</dt><dd>' + configHTML(e.config_abrev) + '</dd>');
        e.ions.forEach(function (ion, i) {
            var n = Math.abs(ion.carga), cation = ion.tipo === 'cation';
            html += cartao(i, ion.html, cation ? 'Cátion' : 'Ânion', ion.tipo, M.nome(ion),
                '<dt>Formação</dt><dd>' + (cation ? 'perde ' : 'ganha ') + plural(n, 'elétron', 'elétrons') + '</dd>' +
                '<dt>Partículas</dt><dd>' + e.z + ' p⁺ · ' + ion.eletrons + ' e⁻</dd>' +
                '<dt>Configuração</dt><dd>' + (ion.config ? configHTML(ion.config) : 'sem elétrons') + '</dd>');
        });
        html += '</div>';
        if (!e.ions.length) html += '<p class="destaque">' + (e.categoria === 'gas-nobre'
            ? 'Os gases nobres têm a camada mais externa completa e, em condições normais, praticamente não formam íons.'
            : 'Este elemento não tem um íon monoatômico de uso comum cadastrado.') + '</p>';
        html += '</div><div class="bloco"><h3>Estados de oxidação</h3>';
        html += e.oxidacao.length
            ? '<div class="oxidacao">' + e.oxidacao.map(function (c) { return '<span>' + oxidacaoTexto(c) + '</span>'; }).join('') + '</div>'
            : '<p class="destaque">Sem dados.</p>';
        return html + '</div>';
    }

    function painelPropriedades(e) {
        function item(rotulo, valor, detalhe) {
            return '<div class="propriedade"><dt>' + rotulo + '</dt><dd>' + (valor == null ? '—' : valor) +
                (valor != null && detalhe ? '<small>' + detalhe + '</small>' : '') + '</dd></div>';
        }
        var densidade = e.densidade == null ? null
            : (e.estado === 'gasoso' ? num(e.densidade * 1000, 4) + ' g/L' : num(e.densidade, 3) + ' g/cm³');
        return '<dl class="propriedades">' +
            item('Massa atômica', num(e.massa, 4) + ' u') +
            item('Estado a 25 °C', ESTADO[e.estado], e.estado_previsto ? 'previsão teórica' : '') +
            item('Densidade', densidade) +
            item('Eletronegatividade', e.eletronegatividade == null ? null : num(e.eletronegatividade, 2), 'escala de Pauling') +
            item('Ponto de fusão', e.fusao_k == null ? null : M.tempTexto(e.fusao_k), e.fusao_k == null ? '' : num(e.fusao_k, 2) + ' K') +
            item('Ponto de ebulição', e.ebulicao_k == null ? null : M.tempTexto(e.ebulicao_k), e.ebulicao_k == null ? '' : num(e.ebulicao_k, 2) + ' K') +
            item('1ª energia de ionização', e.ionizacao_ev == null ? null : M.energiaTexto(e.ionizacao_ev)) +
            item('Afinidade eletrônica', e.afinidade_ev == null ? null : M.energiaTexto(e.afinidade_ev)) +
            item('Raio atômico', e.raio_pm == null ? null : num(e.raio_pm, 0) + ' pm', 'van der Waals') +
            item('Descoberta', e.ano ? String(e.ano) : 'Antiguidade') +
            '</dl>';
    }

    var PAINEL = { estrutura: painelEstrutura, orbitais: painelOrbitais, ions: painelIons, propriedades: painelPropriedades };

    function selecionarAba(nome, focar) {
        abaAtual = PAINEL[nome] ? nome : 'estrutura';
        abas.forEach(function (aba) {
            var ativa = aba.id === 'aba-' + abaAtual;
            aba.setAttribute('aria-selected', String(ativa));
            aba.tabIndex = ativa ? 0 : -1;
            document.getElementById(aba.getAttribute('aria-controls')).hidden = !ativa;
            if (ativa && focar) aba.focus();
        });
        ficha.querySelector('.paineis').scrollTop = 0;
        atualizarPalco();
    }

    function botaoVizinho(id, e, antes) {
        var b = document.getElementById(id);
        b.disabled = !e;
        b.querySelector('span').textContent = e ? (antes ? e.z + ' ' + e.simbolo : e.simbolo + ' ' + e.z) : '';
    }

    function preencher(e) {
        atual = e; ionAtivo = null; subAtiva = e.diagrama.length - 1; focoOrbital = null;
        ficha.dataset.cat = e.categoria;
        document.getElementById('ficha-a').textContent = e.numero_massa;
        document.getElementById('ficha-z').textContent = e.z;
        document.getElementById('ficha-simbolo').textContent = e.simbolo;
        document.getElementById('ficha-nome').textContent = M.nome(e);
        document.getElementById('ficha-sub').textContent = M.th([
            CATEGORIA[e.categoria], e.grupo ? 'Grupo ' + e.grupo : null, 'Período ' + e.periodo, 'Bloco ' + e.bloco
        ].filter(Boolean).join(' · '));
        Object.keys(PAINEL).forEach(function (nome) { document.getElementById('p-' + nome).innerHTML = M.th(PAINEL[nome](e)); });
        botaoVizinho('anterior', dados[e.z - 2], true);
        botaoVizinho('proximo', dados[e.z], false);
        document.title = M.nome(e) + ' (' + e.simbolo + ') — Moltech';
        document.dispatchEvent(new CustomEvent('moltech:ficha', { detail: e.simbolo }));
    }

    function abrir(simbolo) {
        var e = porSimbolo[simbolo];
        if (!e) return;
        ficha.classList.remove('fechando');
        preencher(e);
        if (cargaPedida != null) {          // veio de um íon específico: ele já chega selecionado
            e.ions.forEach(function (ion, i) { if (ion.carga === cargaPedida) ionAtivo = i; });
            document.getElementById('p-ions').innerHTML = M.th(painelIons(e));
        }
        selecionarAba(abaPedida || abaAtual);
        abaPedida = null; cargaPedida = null;
        if (!ficha.open) { ficha.showModal(); ficha.focus(); }   // foco na ficha: ← → trocam de elemento
        palco.iniciar();
    }
    // fecha com a animação de saída; o modelo 3D para de redesenhar já, para a saída correr lisa
    function fechar() { if (ficha.open) { palco.parar(); M.fechar(ficha); } }

    /* O endereço acompanha a ficha (#Fe ou #Fe/ions), para o link poder ser
       copiado e o "voltar" do navegador fechar a ficha. O histórico fica em
       try/catch: se a página estiver embutida num lugar que não deixa mexer
       no endereço, a ficha abre do mesmo jeito. */
    function endereco(modo, url) { try { history[modo](null, '', url); } catch (e) { } }
    function doEndereco() {
        try { var p = decodeURIComponent(location.hash.slice(1)).split('/'); return { simbolo: p[0], aba: p[1], carga: p[2] }; }
        catch (e) { return { simbolo: '' }; }
    }
    function navegar(simbolo, aba, carga) {
        if (!porSimbolo[simbolo]) return;
        if (aba) abaPedida = aba;
        if (carga) cargaPedida = Number(carga);
        if (doEndereco().simbolo !== simbolo) endereco('pushState', '#' + simbolo);
        abrir(simbolo);
    }
    function vizinho(delta) {
        var e = atual && dados[atual.z - 1 + delta];
        if (!e) return;
        endereco('replaceState', '#' + e.simbolo);
        preencher(e); selecionarAba(abaAtual);
    }
    function sincronizar() {
        var alvo = doEndereco();
        if (porSimbolo[alvo.simbolo]) { if (alvo.aba) abaPedida = alvo.aba; if (alvo.carga) cargaPedida = Number(alvo.carga); abrir(alvo.simbolo); }
        else if (ficha.open) fechar();
    }
    window.addEventListener('hashchange', sincronizar);
    window.addEventListener('popstate', sincronizar);
    document.addEventListener('moltech:abrir', function (ev) { navegar(ev.detail); });

    // qualquer link "#Símbolo" ou "#Símbolo/aba" da página abre a ficha aqui mesmo
    document.addEventListener('click', function (ev) {
        var link = ev.target.closest('a[href^="#"]');
        if (!link) return;
        var p = link.getAttribute('href').slice(1).split('/');
        if (!porSimbolo[p[0]]) return;
        ev.preventDefault();
        navegar(p[0], p[1], p[2]);
    });

    // ---- controles do palco ----
    var botaoPausa = document.getElementById('pausa');
    function desenharPausa() {
        botaoPausa.innerHTML = pausado
            ? '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7 4.5v11l8.5-5.5Z"/></svg>'
            : '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6 4.5h2.4v11H6zM11.6 4.5H14v11h-2.4z"/></svg>';
        botaoPausa.setAttribute('aria-pressed', String(pausado));
        botaoPausa.setAttribute('aria-label', M.t(pausado ? 'Retomar animação' : 'Pausar animação'));
    }
    desenharPausa();
    botaoPausa.addEventListener('click', function () { pausado = !pausado; palco.pausar(pausado); desenharPausa(); });
    document.getElementById('vista').addEventListener('click', palco.vistaInicial);

    var botaoSub = document.getElementById('subcamadas');
    botaoSub.addEventListener('click', function () {
        verSubcamadas = !verSubcamadas;
        botaoSub.setAttribute('aria-pressed', String(verSubcamadas));
        palco.subcamadas(verSubcamadas);
        legendaSub.hidden = !verSubcamadas;
    });

    seletorOrbital.addEventListener('click', function (ev) {
        var b = ev.target.closest('button[data-orbital]');
        if (!b) return;
        focoOrbital = b.dataset.orbital === 'todos' ? null : Number(b.dataset.orbital);
        atualizarPalco();
    });

    var ajudaFicha = document.getElementById('ficha-ajuda'), botaoAjuda = document.getElementById('ficha-ajuda-botao');
    function ajuda(aberta) { ajudaFicha.hidden = !aberta; botaoAjuda.setAttribute('aria-expanded', String(aberta)); }
    botaoAjuda.addEventListener('click', function () { ajuda(ajudaFicha.hidden); });

    document.getElementById('anterior').addEventListener('click', function () { vizinho(-1); });
    document.getElementById('proximo').addEventListener('click', function () { vizinho(1); });
    document.getElementById('fechar').addEventListener('click', fechar);

    ficha.addEventListener('click', function (ev) {
        if (ev.target === ficha) { fechar(); return; }      // clique no fundo escurecido
        if (!ajudaFicha.hidden && !ev.target.closest('#ficha-ajuda, #ficha-ajuda-botao')) ajuda(false);
        var sub = ev.target.closest('.subcamada');
        if (sub) {
            subAtiva = Number(sub.dataset.sub); focoOrbital = null;
            ficha.querySelectorAll('.subcamada').forEach(function (b) { b.setAttribute('aria-pressed', String(b === sub)); });
            atualizarPalco();
        }
        var ion = ev.target.closest('.ion-cartao');
        if (ion) {
            ionAtivo = ion.dataset.ion === 'neutro' ? null : Number(ion.dataset.ion);
            ficha.querySelectorAll('.ion-cartao').forEach(function (b) { b.setAttribute('aria-pressed', String(b === ion)); });
            atualizarPalco();
        }
        var linha = ev.target.closest('.camada-linha');
        if (linha) {
            var i = linha.getAttribute('aria-pressed') === 'true' ? null : Number(linha.dataset.camada);
            palco.selecionarCamada(i); camadaSelecionada(i);
        }
    });
    ficha.addEventListener('cancel', function (ev) { ev.preventDefault(); fechar(); });   // Esc: fecha com animação
    ficha.addEventListener('close', function () {
        palco.parar(); ajuda(false);
        document.title = M.idioma() === 'en' ? (document.documentElement.dataset.tituloEn || tituloDaPagina) : tituloDaPagina;
        document.dispatchEvent(new CustomEvent('moltech:ficha', { detail: null }));
        if (porSimbolo[doEndereco().simbolo]) endereco('replaceState', location.pathname + location.search);
    });

    abas.forEach(function (aba, i) {
        aba.addEventListener('click', function () { selecionarAba(aba.id.replace('aba-', '')); });
        aba.addEventListener('keydown', function (ev) {
            var passo = ev.key === 'ArrowRight' ? 1 : (ev.key === 'ArrowLeft' ? -1 : 0);
            if (!passo) return;
            ev.preventDefault(); ev.stopPropagation();
            selecionarAba(abas[(i + passo + abas.length) % abas.length].id.replace('aba-', ''), true);
        });
    });
    // setas ← → fora das abas: elemento anterior / próximo
    ficha.addEventListener('keydown', function (ev) {
        if (ev.key === 'ArrowLeft') vizinho(-1);
        else if (ev.key === 'ArrowRight') vizinho(1);
    });

    // troca de idioma com a ficha aberta: redesenha tudo no idioma novo
    document.addEventListener('moltech:idioma', function () {
        desenharPausa();
        if (ficha.open && atual) { preencher(atual); selecionarAba(abaAtual); }
    });

    sincronizar();   // abre a ficha se a página já chegou com #Símbolo
})();
