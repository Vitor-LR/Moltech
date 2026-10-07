/* ============================================================
   MOLTECH — palco 3D (canvas 2D, sem bibliotecas)
   ------------------------------------------------------------
   Desenha duas cenas, ambas giráveis com o mouse ou o dedo:

   • Bohr     — núcleo (prótons e nêutrons) e as camadas eletrônicas
                como anéis, com os elétrons em órbita. Clicar num
                anel seleciona a camada. No modo "subcamadas", os
                elétrons de cada camada se agrupam em faixas s, p, d, f.
   • Orbitais — a forma dos orbitais de uma subcamada, em malha de
                linhas luminosas: amarelo perto do núcleo, ciano longe.

   O "3D" é feito à mão: cada ponto (x, y, z) é girado por dois
   ângulos (guinada e inclinação) e projetado com perspectiva.

   Uso:  var palco = Palco3D(canvas);
         palco.bohr({ camadas: [2, 8, 1], grupos: [[[0,2]], [[0,2],[1,6]], [[0,1]]], protons: 11, neutrons: 12 });
         palco.orbitais({ l: 2, ocupacao: [2, 1, 1, 1, 1], foco: null });
         palco.iniciar();  palco.parar();
   ============================================================ */
window.Palco3D = function (canvas) {
    'use strict';

    var ctx = canvas.getContext('2d');
    var L = 0, A = 0, dpr = 1;                       // largura, altura, densidade de pixels
    var VISTA = { guinada: 0.55, inclinacao: 1.06, zoom: 1 };
    var guinada = VISTA.guinada, inclinacao = VISTA.inclinacao, zoom = VISTA.zoom;
    var velG = 0, velI = 0;                          // inércia do arrasto
    var arrastando = false, ultimoX = 0, ultimoY = 0, inicioX = 0, inicioY = 0;
    var voltando = false;                            // animação de volta à vista inicial
    var pausado = false, ritmo = 1;                  // ritmo: 0 = parado, 1 = normal (muda aos poucos)
    var velocidade = 1, girar = true;
    var tempo = 0, anterior = 0, quadro = null;
    var cena = null, entrada = 1;                    // entrada: 0→1 ao trocar de cena
    var modoSub = false, misturaSub = 0;             // faixas de subcamadas (aparecem aos poucos)
    var selecionada = null, avisarSelecao = null;    // camada selecionada no modelo de Bohr
    var aneisTela = [];                              // anéis projetados no último quadro (teste de clique)

    var SUB = ['#E5484D', '#2563EB', '#E0A100', '#0E9F6E'];          // s, p, d, f
    var COR = {
        proton: ['#FF8A80', '#D92D20'], neutron: ['#E3E8EE', '#8793A1'], eletron: ['#7FB0FF', '#1552C8'], externo: ['#FFB38A', '#D9480F'],
        sub0: ['#FFA3A6', SUB[0]], sub1: ['#93B4FF', SUB[1]], sub2: ['#FFD766', '#B98500'], sub3: ['#7FE0B8', '#0B7F58']
    };

    /* ---------------- esferas pré-desenhadas ---------------- */
    function esfera(claro, escuro) {
        var c = document.createElement('canvas'); c.width = c.height = 64;
        var g = c.getContext('2d');
        var grad = g.createRadialGradient(22, 20, 3, 32, 32, 31);
        grad.addColorStop(0, '#FFFFFF'); grad.addColorStop(0.22, claro); grad.addColorStop(1, escuro);
        g.fillStyle = grad; g.beginPath(); g.arc(32, 32, 31, 0, Math.PI * 2); g.fill();
        return c;
    }
    var IMG = {};
    Object.keys(COR).forEach(function (k) { IMG[k] = esfera(COR[k][0], COR[k][1]); });

    /* ---------------- projeção 3D → tela ---------------- */
    var cg, sg, ci, si, escala;
    function prepararProjecao() {
        cg = Math.cos(guinada); sg = Math.sin(guinada); ci = Math.cos(inclinacao); si = Math.sin(inclinacao);
        escala = Math.min(L, A) * 0.42 / 100 * zoom * (0.86 + 0.14 * suave(entrada));
    }
    // devolve [xTela, yTela, profundidade, fatorDePerspectiva]; profundidade maior = mais perto
    function projetar(x, y, z) {
        var x1 = x * cg + z * sg, z1 = -x * sg + z * cg;
        var y2 = y * ci - z1 * si, z2 = y * si + z1 * ci;
        var p = 620 / (620 - z2);
        return [L / 2 + x1 * p * escala, A / 2 - y2 * p * escala, z2, p];
    }
    function suave(t) { return t < 0 ? 0 : (t > 1 ? 1 : 1 - Math.pow(1 - t, 3)); }
    function rgba(hex, a) {
        var n = parseInt(hex.slice(1), 16);
        return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
    }

    /* ====================================================
       CENA 1 — modelo de Bohr
       ==================================================== */
    function bohr(d) {
        var total = d.protons + d.neutrons;
        var raioNucleo = 5 + 2.1 * Math.cbrt(total);
        var n = d.camadas.length;
        var rMin = Math.max(n === 1 ? 46 : 30, raioNucleo + 13), rMax = 100;
        var passo = n > 1 ? (rMax - rMin) / (n - 1) : 0;

        // núcleo: esferas distribuídas em espiral dentro de uma bola
        var qtd = Math.min(total, 140), nucleons = [], acumulado = 0;
        var raioEsfera = total === 1 ? raioNucleo * 0.85 : raioNucleo * 0.74 / Math.cbrt(qtd) + 1.1;
        for (var i = 0; i < qtd; i++) {
            var k = (i * 53) % qtd;                   // embaralha a ordem para misturar as cores
            var rr = qtd === 1 ? 0 : (raioNucleo - raioEsfera) * Math.cbrt((k + 0.5) / qtd);
            var cosT = 1 - 2 * (k + 0.5) / qtd, senT = Math.sqrt(1 - cosT * cosT), fi = k * 2.399963;
            acumulado += d.protons / total;
            var proton = acumulado >= 1; if (proton) acumulado -= 1;
            nucleons.push({ x: rr * senT * Math.cos(fi), y: rr * cosT, z: rr * senT * Math.sin(fi), r: raioEsfera, img: proton ? 'proton' : 'neutron' });
        }
        if (qtd === 1) nucleons[0].img = d.protons ? 'proton' : 'neutron';

        var aneis = d.camadas.map(function (q, c) {
            // cada elétron sabe a que subcamada pertence (0 = s … 3 = f)
            var grupos = (d.grupos && d.grupos[c]) || [[0, q]], tipos = [];
            grupos.forEach(function (g) { for (var j = 0; j < g[1]; j++) tipos.push(g[0]); });
            return {
                r: rMin + passo * c, q: q, externo: c === n - 1, grupos: grupos, tipos: tipos,
                // camadas internas giram mais rápido; sentidos alternados
                w: (c % 2 ? -1 : 1) * 1.15 / (1 + c * 0.6), fase: c * 0.7,
                raioEletron: q > 18 ? 2.5 : (q > 8 ? 3 : 3.7)
            };
        });
        cena = { tipo: 'bohr', nucleons: nucleons, aneis: aneis };
        selecionada = null;
        entrada = 0;
    }

    // projeta um arco do anel (ângulos a0→a1) e separa a parte de trás da parte da frente
    function arco(r, a0, a1, passos) {
        var tras = [], frente = [], anterior = null, todos = [];
        for (var i = 0; i <= passos; i++) {
            var ang = a0 + (a1 - a0) * i / passos;
            var p = projetar(r * Math.cos(ang), 0, r * Math.sin(ang));
            var lista = p[2] < 0 ? tras : frente;
            // na troca de metade, o ponto entra nas duas listas: o traço não fica com fresta
            if (anterior && anterior !== lista) anterior.push(p, i);
            lista.push(p, i); anterior = lista; todos.push(p[0], p[1]);
        }
        return { tras: tras, frente: frente, todos: todos };
    }
    // traça os trechos contíguos (pontos intercalados com o índice)
    function tracar(pontos, cor, largura) {
        if (pontos.length < 4) return;
        ctx.beginPath();
        for (var i = 0; i < pontos.length; i += 2) {
            var p = pontos[i], colado = i > 0 && pontos[i + 1] === pontos[i - 1] + 1;
            if (colado) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]);
        }
        ctx.strokeStyle = cor; ctx.lineWidth = largura; ctx.lineCap = 'round'; ctx.stroke();
    }

    function desenharBohr() {
        var sprites = [], tras = [], frente = [], faixas = [], a, i, p;
        aneisTela = [];

        for (a = 0; a < cena.aneis.length; a++) {
            var anel = cena.aneis[a];
            var apagado = selecionada != null && selecionada !== a;
            var giro = anel.fase + tempo * anel.w, fatia = Math.PI * 2 / anel.q;

            // faixas de subcamadas: um arco largo e translúcido atrás de cada grupo de elétrons
            if (misturaSub > 0.01) {
                var vaga = 0;
                anel.grupos.forEach(function (g) {
                    var inteiro = g[1] === anel.q, folga = inteiro ? 0 : 0.5 - Math.min(0.28, 2.2 / anel.q);
                    var a0 = giro + (vaga - 0.5 + folga) * fatia, a1 = giro + (vaga + g[1] - 0.5 - folga) * fatia;
                    var f = arco(anel.r, a0, a1, Math.max(8, Math.ceil((a1 - a0) / (Math.PI * 2) * 96)));
                    faixas.push([f.todos, rgba(SUB[g[0]], (apagado ? 0.1 : 0.34) * misturaSub), (anel.raioEletron * 2 + 4.5) * escala, inteiro]);
                    vaga += g[1];
                });
            }

            var anelProjetado = arco(anel.r, 0, Math.PI * 2, 96);
            aneisTela.push(anelProjetado.todos);
            var cor = selecionada === a ? 'rgba(21,82,200,' : (anel.externo ? 'rgba(217,72,15,' : 'rgba(110,125,140,');
            var forca = apagado ? 0.35 : 1, largura = (selecionada === a ? 2.6 : (anel.externo ? 1.5 : 1)) * dpr;
            tras.push([anelProjetado.tras, cor + 0.45 * forca + ')', largura]);
            frente.push([anelProjetado.frente, cor + 0.9 * forca + ')', largura]);

            for (i = 0; i < anel.q; i++) {
                var t = giro + i * fatia;
                p = projetar(anel.r * Math.cos(t), 0, anel.r * Math.sin(t));
                var img = misturaSub > 0.5 ? 'sub' + anel.tipos[i] : (anel.externo ? 'externo' : 'eletron');
                sprites.push([p[2], p[0], p[1], anel.raioEletron * p[3] * escala, img, apagado ? 0.28 : 1]);
            }
        }
        for (i = 0; i < cena.nucleons.length; i++) {
            var nu = cena.nucleons[i];
            p = projetar(nu.x, nu.y, nu.z);
            sprites.push([p[2], p[0], p[1], nu.r * p[3] * escala, nu.img, 1]);
        }
        sprites.sort(function (x, y) { return x[0] - y[0]; });

        var alfa = suave(entrada);
        function linhas(lista) { lista.forEach(function (f) { tracar(f[0], f[1], f[2]); }); }
        // faixas: cada uma num traço só, por baixo de tudo (sem emendas mais escuras)
        faixas.forEach(function (f) {
            var pts = f[0];
            ctx.beginPath(); ctx.moveTo(pts[0], pts[1]);
            for (var q = 2; q < pts.length; q += 2) ctx.lineTo(pts[q], pts[q + 1]);
            if (f[3]) ctx.closePath();
            ctx.strokeStyle = f[1]; ctx.lineWidth = f[2]; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
        });
        linhas(tras);
        var passou = false;
        for (i = 0; i < sprites.length; i++) {
            var s = sprites[i];
            if (!passou && s[0] > 14) { passou = true; ctx.globalAlpha = alfa; linhas(frente); }
            ctx.globalAlpha = alfa * s[5];
            ctx.drawImage(IMG[s[4]], s[1] - s[3], s[2] - s[3], s[3] * 2, s[3] * 2);
        }
        ctx.globalAlpha = alfa;
        if (!passou) linhas(frente);
    }

    // qual anel está mais perto do ponto clicado? (null se nenhum estiver a menos de 12 px)
    function anelEm(x, y) {
        var melhor = null, menor = 12 * dpr;
        aneisTela.forEach(function (pts, a) {
            for (var i = 0; i < pts.length - 2; i += 2) {
                var ax = pts[i], ay = pts[i + 1], bx = pts[i + 2] - ax, by = pts[i + 3] - ay;
                var t = Math.max(0, Math.min(1, ((x - ax) * bx + (y - ay) * by) / (bx * bx + by * by || 1)));
                var d = Math.hypot(x - ax - t * bx, y - ay - t * by);
                if (d < menor) { menor = d; melhor = a; }
            }
        });
        return melhor;
    }
    function selecionar(a, avisar) {
        selecionada = (a == null || !cena || cena.tipo !== 'bohr' || a >= cena.aneis.length) ? null : a;
        if (avisar && avisarSelecao) avisarSelecao(selecionada);
    }

    /* ====================================================
       CENA 2 — orbitais em malha luminosa
       A superfície de cada orbital é r = |Y(θ, φ)|, a parte angular
       dos orbitais reais (harmônicos esféricos). Desenham-se as
       linhas de latitude e longitude dessa superfície.
       ==================================================== */
    var ANGULAR = [
        [function () { return 1; }],
        [function (x) { return x; }, function (x, y) { return y; }, function (x, y, z) { return z; }],
        [function (x, y) { return x * y; }, function (x, y, z) { return y * z; }, function (x, y, z) { return x * z; },
            function (x, y) { return x * x - y * y; }, function (x, y, z) { return 3 * z * z - 1; }],
        [function (x, y, z) { return z * (5 * z * z - 3); }, function (x, y, z) { return x * (5 * z * z - 1); },
            function (x, y, z) { return y * (5 * z * z - 1); }, function (x, y, z) { return z * (x * x - y * y); },
            function (x, y, z) { return x * y * z; }, function (x, y) { return x * (x * x - 3 * y * y); },
            function (x, y) { return y * (3 * x * x - y * y); }]
    ];
    var NT = 22, NP = 44, MALHAS = {};                 // divisões em θ e φ; malhas já calculadas
    var FAIXAS = ['#FFF3A8', '#FFE066', '#D8F26B', '#7BEBA0', '#39E0C8', '#22D3EE'];   // perto → longe do núcleo

    function malha(l, m) {
        var chave = l + ':' + m;
        if (MALHAS[chave]) return MALHAS[chave];
        var f = ANGULAR[l][m], n = (NT + 1) * (NP + 1), amp = new Float32Array(n), dir = new Float32Array(n * 3), maximo = 0, i, j, k = 0;
        for (i = 0; i <= NT; i++) for (j = 0; j <= NP; j++, k++) {
            var te = Math.PI * i / NT, fi = Math.PI * 2 * j / NP;
            var x = Math.sin(te) * Math.cos(fi), y = Math.sin(te) * Math.sin(fi), z = Math.cos(te);
            dir[k * 3] = x; dir[k * 3 + 1] = z; dir[k * 3 + 2] = y;       // eixo z do orbital = vertical da tela
            amp[k] = Math.abs(f(x, y, z)); maximo = Math.max(maximo, amp[k]);
        }
        for (k = 0; k < n; k++) amp[k] /= maximo;
        return (MALHAS[chave] = { dir: dir, amp: amp });
    }

    // riscos de fundo: partículas que giram devagar em torno do núcleo
    var riscos = [];
    for (var r0 = 0; r0 < 260; r0++) {
        var u = Math.random() * 2 - 1, fi0 = Math.random() * Math.PI * 2, s0 = Math.sqrt(1 - u * u), d0 = 115 + Math.random() * 190;
        riscos.push([s0 * Math.cos(fi0) * d0, u * d0, s0 * Math.sin(fi0) * d0, 0.25 + Math.random() * 0.9, 1.5 + Math.random() * 3.5]);
    }

    function orbitais(d) {
        var lista = ANGULAR[d.l].map(function (f, m) { return { malha: malha(d.l, m), ocupado: (d.ocupacao[m] || 0) > 0, m: m }; });
        cena = { tipo: 'orbitais', lista: lista, foco: d.foco };
        entrada = 0;
    }

    function desenharOrbitais() {
        var alfa = suave(entrada), i, j, k;
        ctx.globalCompositeOperation = 'lighter';

        // riscos de fundo
        ctx.lineWidth = dpr; ctx.lineCap = 'round';
        ctx.beginPath();
        for (i = 0; i < riscos.length; i++) {
            var rk = riscos[i], ang = tempo * 0.07 * rk[3], c = Math.cos(ang), s = Math.sin(ang);
            var x = rk[0] * c - rk[2] * s, z = rk[0] * s + rk[2] * c;
            var a = projetar(x, rk[1], z), b = projetar(x - z / 40 * rk[4], rk[1], z + x / 40 * rk[4]);
            ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
        }
        ctx.strokeStyle = 'rgba(70,150,255,' + 0.42 * alfa + ')'; ctx.stroke();

        var visiveis = cena.lista.filter(function (o) { return cena.foco == null || cena.foco === o.m; });
        var pulso = 100 * (1 + 0.02 * Math.sin(tempo * 1.4)) * (0.55 + 0.45 * alfa);
        var forca = (visiveis.length > 1 ? 0.34 : 0.6) * alfa;
        var baldes = [[], [], [], [], [], []], vazios = [];
        var n = (NT + 1) * (NP + 1), sx = new Float32Array(n), sy = new Float32Array(n);

        visiveis.forEach(function (o) {
            var dir = o.malha.dir, amp = o.malha.amp;
            for (k = 0; k < n; k++) {
                var rr = amp[k] * pulso, p = projetar(dir[k * 3] * rr, dir[k * 3 + 1] * rr, dir[k * 3 + 2] * rr);
                sx[k] = p[0]; sy[k] = p[1];
            }
            function trecho(k1, k2) {
                var alvo = o.ocupado ? baldes[Math.min(5, Math.floor((amp[k1] + amp[k2]) * 3))] : vazios;
                alvo.push(sx[k1], sy[k1], sx[k2], sy[k2]);
            }
            for (i = 0; i <= NT; i++) for (j = 0; j < NP; j++) { k = i * (NP + 1) + j; if (i > 0 && i < NT) trecho(k, k + 1); if (i < NT && j % 2 === 0) trecho(k, k + NP + 1); }
        });
        function riscar(lista, cor) {
            if (!lista.length) return;
            ctx.beginPath();
            for (var q = 0; q < lista.length; q += 4) { ctx.moveTo(lista[q], lista[q + 1]); ctx.lineTo(lista[q + 2], lista[q + 3]); }
            ctx.strokeStyle = cor; ctx.stroke();
        }
        ctx.lineWidth = 0.9 * dpr;
        riscar(vazios, 'rgba(120,140,175,' + 0.22 * alfa + ')');
        baldes.forEach(function (b, q) { riscar(b, rgba(FAIXAS[q], forca)); });

        // núcleo: um ponto de luz
        var centro = projetar(0, 0, 0), raio = 30 * dpr * zoom;
        var brilho = ctx.createRadialGradient(centro[0], centro[1], 0, centro[0], centro[1], raio);
        brilho.addColorStop(0, 'rgba(255,255,235,' + alfa + ')'); brilho.addColorStop(0.25, 'rgba(255,214,90,' + 0.75 * alfa + ')'); brilho.addColorStop(1, 'rgba(255,170,40,0)');
        ctx.fillStyle = brilho; ctx.beginPath(); ctx.arc(centro[0], centro[1], raio, 0, Math.PI * 2); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
    }

    /* ---------------- laço de animação ---------------- */
    function quadroNovo(agora) {
        var dt = Math.min(0.05, (agora - anterior) / 1000 || 0);
        anterior = agora;
        // pausar e retomar não são instantâneos: o ritmo desacelera e acelera aos poucos
        ritmo += ((pausado ? 0 : 1) - ritmo) * Math.min(1, dt * 3.2);
        if (Math.abs((pausado ? 0 : 1) - ritmo) < 0.002) ritmo = pausado ? 0 : 1;
        tempo += dt * velocidade * ritmo;
        misturaSub += ((modoSub ? 1 : 0) - misturaSub) * Math.min(1, dt * 7);
        if (entrada < 1) entrada = Math.min(1, entrada + dt * 2.6);

        if (voltando) {                                   // volta suave à vista inicial
            guinada += (VISTA.guinada - guinada) * 0.12; inclinacao += (VISTA.inclinacao - inclinacao) * 0.12; zoom += (VISTA.zoom - zoom) * 0.12;
            if (Math.abs(VISTA.guinada - guinada) + Math.abs(VISTA.inclinacao - inclinacao) < 0.004) voltando = false;
        } else if (!arrastando) {
            guinada += velG; inclinacao = limitar(inclinacao + velI);
            velG *= 0.94; velI *= 0.9;
            if (girar && Math.abs(velG) < 0.002) guinada += dt * 0.16 * ritmo;
        }

        prepararProjecao();
        ctx.clearRect(0, 0, L, A);
        if (cena) {
            ctx.globalAlpha = suave(entrada);
            if (cena.tipo === 'bohr') desenharBohr(); else desenharOrbitais();
            ctx.globalAlpha = 1;
        }
        quadro = requestAnimationFrame(quadroNovo);
    }
    function limitar(v) { return Math.max(-1.5, Math.min(1.5, v)); }

    function ajustarTamanho() {
        var r = canvas.getBoundingClientRect();
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        L = canvas.width = Math.max(1, Math.round(r.width * dpr));
        A = canvas.height = Math.max(1, Math.round(r.height * dpr));
    }
    if ('ResizeObserver' in window) new ResizeObserver(ajustarTamanho).observe(canvas);
    else window.addEventListener('resize', ajustarTamanho);

    /* ---------------- interação: arrastar, clicar, roda, duplo clique ----------------
       O modelo acompanha o cursor: arrastar para a direita traz para a direita
       o lado que está de frente; arrastar para baixo traz esse lado para baixo. */
    canvas.addEventListener('pointerdown', function (ev) {
        arrastando = true; voltando = false; velG = velI = 0;
        ultimoX = inicioX = ev.clientX; ultimoY = inicioY = ev.clientY;
        canvas.classList.add('arrastando');
        try { canvas.setPointerCapture(ev.pointerId); } catch (e) { }
    });
    canvas.addEventListener('pointermove', function (ev) {
        if (!arrastando) return;
        var dx = ev.clientX - ultimoX, dy = ev.clientY - ultimoY;
        ultimoX = ev.clientX; ultimoY = ev.clientY;
        velG = dx * 0.009; velI = dy * 0.009;
        guinada += velG; inclinacao = limitar(inclinacao + velI);
    });
    canvas.addEventListener('pointerup', function (ev) {
        var parado = Math.hypot(ev.clientX - inicioX, ev.clientY - inicioY) < 5;
        arrastando = false; canvas.classList.remove('arrastando');
        if (parado && cena && cena.tipo === 'bohr') {      // foi um clique, não um arrasto: seleciona a camada
            var r = canvas.getBoundingClientRect(), a = anelEm((ev.clientX - r.left) * dpr, (ev.clientY - r.top) * dpr);
            selecionar(a === selecionada ? null : a, true);
        }
    });
    canvas.addEventListener('pointercancel', function () { arrastando = false; canvas.classList.remove('arrastando'); });
    canvas.addEventListener('wheel', function (ev) {
        ev.preventDefault();
        zoom = Math.max(0.55, Math.min(2.6, zoom * Math.exp(-ev.deltaY * 0.0012)));
    }, { passive: false });
    canvas.addEventListener('dblclick', function () { voltando = true; velG = velI = 0; });

    return {
        bohr: bohr,
        orbitais: orbitais,
        iniciar: function () { ajustarTamanho(); if (quadro == null) { anterior = performance.now(); quadro = requestAnimationFrame(quadroNovo); } },
        parar: function () { if (quadro != null) { cancelAnimationFrame(quadro); quadro = null; } },
        pausar: function (sim, jaParado) { pausado = sim; if (jaParado) ritmo = sim ? 0 : 1; },
        vistaInicial: function () { voltando = true; velG = velI = 0; },
        configurar: function (o) { velocidade = o.velocidade; girar = o.girar; },
        subcamadas: function (sim) { modoSub = sim; },
        selecionarCamada: function (a) { selecionar(a, false); },
        aoSelecionarCamada: function (f) { avisarSelecao = f; },
        estado: function () { return { guinada: guinada, inclinacao: inclinacao, ritmo: ritmo }; }
    };
};
window.Palco3D.NOMES = [['s'], ['px', 'py', 'pz'], ['dxy', 'dyz', 'dxz', 'dx²−y²', 'dz²'],
    ['fz³', 'fxz²', 'fyz²', 'fz(x²−y²)', 'fxyz', 'fx(x²−3y²)', 'fy(3x²−y²)']];
