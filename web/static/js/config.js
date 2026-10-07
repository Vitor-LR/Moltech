/* ============================================================
   MOLTECH — página Configurações
   Cada controle lê e grava direto em Moltech.config (base.js).
   data-config="chave"  → preferência geral
   data-cartao="chave"  → personalização dos cartões dos elementos
   ============================================================ */
(function () {
    'use strict';
    var M = window.Moltech, cfg = M.config;
    var salvo = document.getElementById('salvo'), relogio;

    function gravar() {
        M.salvar(); M.aplicarCartao();
        salvo.textContent = M.t('Salvo.');
        clearTimeout(relogio);
        relogio = setTimeout(function () { salvo.textContent = ''; }, 1600);
    }

    // mostra o estado atual em todos os controles
    function refletir() {
        document.querySelectorAll('.pilula[data-config]').forEach(function (grupo) {
            grupo.querySelectorAll('button').forEach(function (b) {
                b.setAttribute('aria-pressed', String(b.dataset.valor === String(cfg[grupo.dataset.config])));
            });
        });
        document.querySelectorAll('input[data-config], input[data-cartao]').forEach(function (campo) {
            var alvo = campo.dataset.config ? cfg : cfg.cartao;
            var chave = campo.dataset.config || campo.dataset.cartao;
            if (campo.type === 'checkbox') campo.checked = !!alvo[chave];
            else {
                campo.value = alvo[chave];
                var saida = campo.parentNode.querySelector('output');
                if (saida) saida.textContent = chave === 'velocidade'
                    ? M.num(alvo[chave], 1) + '×' : alvo[chave] + (campo.dataset.sufixo || '');
            }
        });
    }

    document.querySelectorAll('.pilula[data-config]').forEach(function (grupo) {
        grupo.addEventListener('click', function (ev) {
            var b = ev.target.closest('button[data-valor]');
            if (!b) return;
            cfg[grupo.dataset.config] = b.dataset.valor;
            gravar(); refletir();
        });
    });
    document.querySelectorAll('input[data-config], input[data-cartao]').forEach(function (campo) {
        campo.addEventListener('input', function () {
            var alvo = campo.dataset.config ? cfg : cfg.cartao;
            var chave = campo.dataset.config || campo.dataset.cartao;
            alvo[chave] = campo.type === 'checkbox' ? campo.checked : Number(campo.value);
            gravar(); refletir();
        });
    });

    // modelos prontos de cartão
    var MODELOS = {
        padrao: M.PADRAO.cartao,
        minimo: { numero: false, nome: false, massa: false, simbolo: 125, cantos: 50, borda: 0, cor: 130 },
        detalhado: { numero: true, nome: true, massa: true, simbolo: 90, cantos: 6, borda: 1.5, cor: 170 }
    };
    document.getElementById('modelos').addEventListener('click', function (ev) {
        var b = ev.target.closest('button[data-modelo]');
        if (!b) return;
        Object.assign(cfg.cartao, MODELOS[b.dataset.modelo]);
        gravar(); refletir();
    });

    // elemento mostrado na prévia
    var previa = document.getElementById('previa-cartao');
    var seletor = document.getElementById('previa-elemento');
    var botoesPrevia = Array.prototype.slice.call(seletor.querySelectorAll('button'));
    // valor de cada botão: símbolo|Z|nome|name|massa|categoria
    function desenharPrevia() {
        var en = M.idioma() === 'en';
        botoesPrevia.forEach(function (b) { var q = b.dataset.valor.split('|'); b.title = en ? q[3] : q[2]; });
        var p = seletor.querySelector('[aria-pressed="true"]').dataset.valor.split('|');
        previa.dataset.cat = p[5];
        previa.querySelector('.el-s').textContent = p[0];
        previa.querySelector('.el-z').textContent = p[1];
        previa.querySelector('.el-n').textContent = en ? p[3] : p[2];
        previa.querySelector('.el-m').textContent = M.num(Number(p[4]), 3);
    }
    // troca de elemento: o cartão sai (encolhe e some), o conteúdo muda e ele volta
    var trocaPrevia;
    seletor.addEventListener('click', function (ev) {
        var b = ev.target.closest('button[data-valor]');
        if (!b || b.getAttribute('aria-pressed') === 'true') return;
        botoesPrevia.forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        if (M.reduzMovimento) { desenharPrevia(); return; }
        previa.classList.add('saindo');
        clearTimeout(trocaPrevia);
        trocaPrevia = setTimeout(function () { desenharPrevia(); previa.classList.remove('saindo'); }, 190);
    });
    document.addEventListener('moltech:idioma', function () { desenharPrevia(); refletir(); salvo.textContent = ''; });
    desenharPrevia();

    document.getElementById('redefinir').addEventListener('click', function () {
        M.redefinir(); refletir();
        salvo.textContent = M.t('Preferências redefinidas.');
    });

    refletir();
})();
