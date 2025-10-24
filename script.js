// --- Dados Persistentes (Lidos apenas uma vez) ---
let fornecedores = JSON.parse(localStorage.getItem('fornecedores')) || ['Fornecedor Exemplo'];
let produtos = JSON.parse(localStorage.getItem('produtos')) || []; // Contém { ..., variations: [...], pricingConfig: { shopee: 15.00, ... } }
let carrinho = JSON.parse(localStorage.getItem('carrinho')) || [];
let cotacoes = JSON.parse(localStorage.getItem('cotacoes')) || [];
let kits = JSON.parse(localStorage.getItem('kits')) || [];
let cupons = JSON.parse(localStorage.getItem('cupons')) || [];
let metasFinanceiras = JSON.parse(localStorage.getItem('metasFinanceiras')) || { vendas: 0, lucro: 0 };
let campanhasMarketing = JSON.parse(localStorage.getItem('campanhasMarketing')) || [];


// --- Variáveis de Estado (Memória Temporária) ---
let kitProdutosTemporario = [];
let produtoEditId = null;
let produtoVariationsTemporario = [];
let cotacaoAtual = null;
let modalAtual = null; // Para modais genéricos (confirmação/detalhes/metas/fechamento/campanhas)
let modalPrecificacaoAberto = false;


// --- Configurações de Lojas (Constante) ---
const lojasConfig = {
    shopee: { nome: "Shopee", taxaFixa: 5.00, comissao: 0.20, logo: 'shopee-logo.svg' },
    ml_premium: { nome: "ML Premium", taxaFixa: 6.00, comissao: 0.165, logo: 'ml-logo.svg' },
    amazon: { nome: "Amazon", taxaFixa: 2.00, comissao: 0.14, logo: 'amazon-logo.svg' },
    tiktok: { nome: "TikTok Shop", taxaFixa: 2.00, comissao: 0.06, logo: 'tiktok-logo.svg' },
    facebook: { nome: "Facebook", taxaFixa: 0.00, comissao: 0.00, logo: 'facebook-logo.svg' },
    whatsapp: { nome: "WhatsApp", taxaFixa: 0.00, comissao: 0.00, logo: 'whatsapp-logo.svg' },
};

// --- Função Helper para Salvar ---
function salvarDados(chave, dados) {
    localStorage.setItem(chave, JSON.stringify(dados));
}

// --- Inicialização ---
document.addEventListener('DOMContentLoaded', () => {
    atualizarDropdownFornecedores();
    renderizarCarrinho();
    showPage('dashboard'); // Página inicial

    // --- Event Listeners Globais ---
    document.getElementById('carrinho-descontos').addEventListener('input', calcularTotais);
    document.getElementById('carrinho-frete').addEventListener('input', calcularTotais);
    document.getElementById('filtro-status-cotacao').addEventListener('change', renderizarCotacoes);
    document.getElementById('produto-form').addEventListener('submit', handleSalvarProduto);
    document.getElementById('novo-fornecedor').addEventListener('keypress', (e) => { if (e.key === 'Enter') adicionarFornecedor(); });
    document.getElementById('kit-form').addEventListener('submit', handleSalvarKit);
    document.getElementById('filtro-produtos-kit').addEventListener('input', filtrarProdutosParaKit);
    document.getElementById('cupom-form').addEventListener('submit', salvarCupom);
    document.getElementById('filtro-busca').addEventListener('input', aplicarFiltros); // Filtro catálogo geral
    document.getElementById('filtro-categoria').addEventListener('change', aplicarFiltros);
    document.getElementById('filtro-fornecedor').addEventListener('change', aplicarFiltros);
    document.getElementById('produto-imagem').addEventListener('change', previewImagemProduto);
    document.getElementById('filtro-kits').addEventListener('input', renderizarListaKits); // Filtro na página de Kits
    document.getElementById('filtro-cupons').addEventListener('input', renderizarListaCupons); // Filtro na página de Marketing

    // Fechamento de modais pelo overlay
    document.body.addEventListener('click', (event) => {
        const targetId = event.target.id;
        // Fecha modal de precificação se clicar no overlay específico
        if (targetId === 'modal-precificacao-overlay' && modalPrecificacaoAberto) {
            fecharModalPrecificacao();
        }
        // Fecha modal genérico (metas, detalhes, confirmação, campanhas, fechamento) se clicar no overlay
        if (event.target.classList.contains('modal-overlay') && modalAtual && targetId !== 'modal-precificacao-overlay') { // Evita fechar precificação
             fecharModal();
        }
    });
});


// --- Navegação e Exibição ---
function showPage(pageId) {
    document.querySelectorAll('.page-content').forEach(page => page.classList.add('hidden'));
    const pageElement = document.getElementById(pageId + '-page');
    if (pageElement) {
        pageElement.classList.remove('hidden');
    } else {
        console.error(`Página com ID ${pageId}-page não encontrada! Redirecionando para Dashboard.`);
        document.getElementById('dashboard-page')?.classList.remove('hidden');
        pageId = 'dashboard';
    }

    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('onclick')?.includes(`showPage('${pageId}')`)) {
            item.classList.add('active');
        }
    });

    const mainContent = document.querySelector('main');
    if (mainContent) mainContent.scrollTop = 0;

    switch (pageId) {
        case 'dashboard': calcularDashboard(); break;
        case 'produtos': break; // Limpeza tratada pelo clique/atalho
        case 'catalogo': carregarFiltrosCatalogo(); aplicarFiltros(); break;
        case 'cotacoes': renderizarCotacoes(); break;
        case 'kits': inicializarPaginaKits(); break;
        case 'financeiro': calcularEstatisticasFinanceiras(); break;
        case 'marketing': inicializarPaginaMarketing(); break;
    }
    fecharCarrinho();
    fecharModalPrecificacao(); // Garante que feche ao navegar
    // Não fecha modal genérico aqui, pois pode ser necessário mantê-lo (ex: metas aberto)
}

function irParaCadastroProduto() {
    limparFormularioProduto(); // Garante que o formulário esteja limpo
    showPage('produtos');
}

// --- Dashboard ---
function calcularDashboard() {
    const hoje = new Date();
    const inicioDoMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);

    const cotacoesConvertidasMes = cotacoes.filter(c => c.status === 'Convertida' && new Date(c.dataGeracao) >= inicioDoMes);
    const vendasMes = cotacoesConvertidasMes.reduce((acc, c) => acc + (parseFloat(c.totalGeral.replace(/[^0-9,-]+/g,"").replace(",",".")) || 0), 0);

    let lucroMes = 0;
    cotacoesConvertidasMes.forEach(cotacao => {
        (cotacao.itens || []).forEach(item => { // Adiciona verificação para cotacao.itens
            const custoItem = item.custo || 0;
            lucroMes += (item.precoVenda - custoItem) * item.quantidade;
        });
        lucroMes += (parseFloat(cotacao.frete.replace(/[^0-9,-]+/g,"").replace(",",".")) || 0);
        lucroMes -= (parseFloat(cotacao.descontos.replace(/[^0-9,-]+/g,"").replace(",",".")) || 0);
    });

    const cotacoesPendentes = cotacoes.filter(c => c.status === 'Pendente').length;
    const totalProdutos = produtos.length;

    document.getElementById('dash-vendas-mes').textContent = formatarMoeda(vendasMes);
    document.getElementById('dash-lucro-mes').textContent = formatarMoeda(lucroMes);
    document.getElementById('dash-cotacoes-pendentes').textContent = cotacoesPendentes;
    document.getElementById('dash-total-produtos').textContent = totalProdutos;
    renderizarCotacoesPendentesDashboard();
}
function renderizarCotacoesPendentesDashboard() {
    const cotacoesPendentes = cotacoes.filter(c => c.status === 'Pendente').sort((a, b) => new Date(b.dataGeracao) - new Date(a.dataGeracao));
    const listaContainer = document.getElementById('dash-lista-cotacoes');
    listaContainer.innerHTML = '';
    if (cotacoesPendentes.length === 0) {
        listaContainer.innerHTML = '<p class="text-gray-400 text-center p-4">🎉 Nenhuma cotação pendente!</p>'; return;
    }
    cotacoesPendentes.slice(0, 5).forEach(cotacao => {
        listaContainer.innerHTML += `<div class="bg-gray-800 rounded-lg p-4 flex justify-between items-center"><div><h4 class="text-white font-bold">${cotacao.id}</h4><p class="text-gray-300 text-sm">${cotacao.cliente || 'N/I'} - ${cotacao.local || 'N/I'}</p><p class="text-gray-400 text-xs">${formatarData(new Date(cotacao.dataGeracao))}</p></div><div class="text-right"><p class="text-white font-bold text-lg">${cotacao.totalGeral}</p><button onclick="alterarStatusCotacao('${cotacao.id}', 'Convertida')" class="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm mt-1">✅ Converter</button></div></div>`;
    });
}

// --- Fornecedores ---
function carregarFornecedoresSelect(selectId) {
    const select = document.getElementById(selectId); if (!select) return;
    const valorAtual = select.value; select.innerHTML = `<option value="">Selecione...</option>`;
    fornecedores.forEach(f => { const option = document.createElement('option'); option.value = f; option.textContent = f; select.appendChild(option); });
    select.value = valorAtual;
}
function atualizarDropdownFornecedores() { ['fornecedores-select', 'produto-fornecedor', 'filtro-fornecedor'].forEach(id => carregarFornecedoresSelect(id)); }
function adicionarFornecedor() {
    const input = document.getElementById('novo-fornecedor'); const novo = input.value.trim();
    if (!novo) { mostrarNotificacao('Digite o nome do fornecedor!', 'error'); return; }
    if (fornecedores.includes(novo)) { mostrarNotificacao('Fornecedor já cadastrado!', 'error'); return; }
    fornecedores.push(novo); salvarDados('fornecedores', fornecedores); atualizarDropdownFornecedores(); input.value = '';
    mostrarNotificacao('Fornecedor adicionado com sucesso!', 'success');
}
function removerFornecedor() {
    const select = document.getElementById('fornecedores-select'); const selecionado = select.value;
    if (!selecionado) { mostrarNotificacao('Selecione um fornecedor para remover!', 'error'); return; }
    if (produtos.some(p => p.fornecedor === selecionado)) { mostrarNotificacao('Não é possível remover: existem produtos associados a este fornecedor!', 'error'); return; }
    fornecedores = fornecedores.filter(f => f !== selecionado); salvarDados('fornecedores', fornecedores); atualizarDropdownFornecedores();
    mostrarNotificacao('Fornecedor removido com sucesso!', 'success');
}

// --- Produtos ---
function adicionarVariacao() {
    const typeInput = document.getElementById('variation-type'); const valueInput = document.getElementById('variation-value'); const skuInput = document.getElementById('variation-sku');
    const type = typeInput.value.trim(); const value = valueInput.value.trim(); const sku = skuInput.value.trim();
    if (!value || !sku) { mostrarNotificacao('Preencha o Valor e o SKU da Variação!', 'error'); return; }
    produtoVariationsTemporario.push({ type: type || 'Única', value, sku }); renderizarVariacoes();
    typeInput.value = ''; valueInput.value = ''; skuInput.value = '';
}
function renderizarVariacoes() {
    const listElement = document.getElementById('variations-list'); listElement.innerHTML = '';
    if (produtoVariationsTemporario.length === 0) { listElement.innerHTML = '<p class="text-gray-400 text-xs text-center variation-placeholder">Nenhuma variação adicionada.</p>'; return; }
    produtoVariationsTemporario.forEach((variation, index) => {
        const item = document.createElement('div'); item.className = 'variation-item';
        item.innerHTML = `<span>${variation.type}</span><span>${variation.value}</span><span>${variation.sku}</span><button type="button" class="remove-variation-btn" onclick="removerVariacao(${index})">✕</button>`;
        listElement.appendChild(item);
    });
}
function removerVariacao(index) { produtoVariationsTemporario.splice(index, 1); renderizarVariacoes(); }
function handleSalvarProduto(e) {
    e.preventDefault(); const fileInput = document.getElementById('produto-imagem'); const file = fileInput.files[0];
    const produtoData = { sku: document.getElementById('produto-sku').value.trim(), nome: document.getElementById('produto-nome').value.trim(), categoria: document.getElementById('produto-categoria').value.trim(), fornecedor: document.getElementById('produto-fornecedor').value, custo: parseFloat(document.getElementById('produto-custo').value) || 0, picking: parseFloat(document.getElementById('produto-picking').value) || 0, peso: parseFloat(document.getElementById('produto-peso').value) || 0, comprimento: parseInt(document.getElementById('produto-comprimento').value) || 0, largura: parseInt(document.getElementById('produto-largura').value) || 0, altura: parseInt(document.getElementById('produto-altura').value) || 0, variations: [...produtoVariationsTemporario] };
    if (!produtoData.sku || !produtoData.nome || !produtoData.categoria || !produtoData.fornecedor || produtoData.custo < 0 || produtoData.peso <= 0) { mostrarNotificacao('Preencha os campos obrigatórios (*) com valores válidos!', 'error'); return; }
    const allSkusInForm = [produtoData.sku, ...produtoData.variations.map(v => v.sku)].filter(Boolean); if (new Set(allSkusInForm).size !== allSkusInForm.length) { mostrarNotificacao('Erro: SKUs duplicados dentro do mesmo produto.', 'error'); return; }
    const outrosProdutos = produtos.filter(p => p.id !== produtoEditId); const skusExistentes = outrosProdutos.flatMap(p => [p.sku, ...(p.variations || []).map(v => v.sku)]); const skuDuplicado = allSkusInForm.find(sku => skusExistentes.includes(sku)); if (skuDuplicado) { mostrarNotificacao(`Erro: O SKU "${skuDuplicado}" já está em uso.`, 'error'); return; }
    const salvar = (imageUrl) => {
        produtoData.imagem = imageUrl;
        if (produtoEditId) {
            const index = produtos.findIndex(p => p.id === produtoEditId);
            if (index !== -1) { if (!imageUrl && produtos[index].imagem) { produtoData.imagem = produtos[index].imagem; } produtos[index] = { ...produtos[index], ...produtoData, dataAtualizacao: new Date().toISOString() }; mostrarNotificacao('Produto atualizado!', 'success'); }
        } else { produtoData.id = Date.now(); produtoData.dataCadastro = new Date().toISOString(); produtoData.pricingConfig = {}; produtos.push(produtoData); mostrarNotificacao('Produto salvo!', 'success'); }
        salvarDados('produtos', produtos); limparFormularioProduto();
        document.getElementById('filtro-busca').value = ''; document.getElementById('filtro-categoria').value = ''; document.getElementById('filtro-fornecedor').value = ''; showPage('catalogo');
    };
    if (file) { const reader = new FileReader(); reader.onload = (e) => salvar(e.target.result); reader.readAsDataURL(file); } else { salvar(produtoEditId ? (produtos.find(p => p.id === produtoEditId)?.imagem || null) : null); }
}
function editarProduto(id) {
    const produto = produtos.find(p => p.id === id); if (!produto) return; showPage('produtos'); limparFormularioProduto();
    produtoEditId = id; document.getElementById('produto-id-edit').value = id; document.getElementById('produto-sku').value = produto.sku; document.getElementById('produto-nome').value = produto.nome; document.getElementById('produto-categoria').value = produto.categoria; document.getElementById('produto-fornecedor').value = produto.fornecedor; document.getElementById('produto-custo').value = produto.custo.toFixed(2); document.getElementById('produto-picking').value = produto.picking.toFixed(2); document.getElementById('produto-peso').value = produto.peso.toFixed(2); document.getElementById('produto-comprimento').value = produto.comprimento; document.getElementById('produto-largura').value = produto.largura; document.getElementById('produto-altura').value = produto.altura;
    produtoVariationsTemporario = [...(produto.variations || [])]; renderizarVariacoes(); const imgPreview = document.getElementById('produto-imagem-preview'); if (produto.imagem) { imgPreview.src = produto.imagem; imgPreview.classList.remove('hidden'); } else { imgPreview.classList.add('hidden'); } document.getElementById('produto-imagem').value = ''; document.getElementById('produto-form-titulo').innerHTML = `<span class="mr-2">✏️</span> Editando Produto`;
}
function limparFormularioProduto() {
    produtoEditId = null; document.getElementById('produto-form').reset(); document.getElementById('produto-id-edit').value = ''; Object.assign(document.getElementById('produto-custo'), {value: '0.00'}); Object.assign(document.getElementById('produto-picking'), {value: '2.00'}); Object.assign(document.getElementById('produto-peso'), {value: '0.00'}); Object.assign(document.getElementById('produto-comprimento'), {value: '0'}); Object.assign(document.getElementById('produto-largura'), {value: '0'}); Object.assign(document.getElementById('produto-altura'), {value: '0'});
    produtoVariationsTemporario = []; renderizarVariacoes(); const imgPreview = document.getElementById('produto-imagem-preview'); imgPreview.classList.add('hidden'); imgPreview.src = '#'; document.getElementById('produto-form-titulo').innerHTML = `<span class="mr-2">📦</span> Cadastrar Novo Produto`; document.querySelectorAll('#produto-form .border-red-500').forEach(el => el.classList.remove('border-red-500'));
}
function previewImagemProduto(event) { const reader = new FileReader(); const imgPreview = document.getElementById('produto-imagem-preview'); reader.onload = function(){ imgPreview.src = reader.result; imgPreview.classList.remove('hidden'); }; if (event.target.files[0]) { reader.readAsDataURL(event.target.files[0]); } else { imgPreview.classList.add('hidden'); imgPreview.src = '#'; } }
function excluirProduto(id) { abrirModalConfirmacao(`Tem certeza que deseja excluir este produto e todas as suas variações? Kits que o utilizam também podem ser afetados.`, () => confirmarExclusaoProduto(id)); }
function confirmarExclusaoProduto(id) {
    produtos = produtos.filter(p => p.id !== id); salvarDados('produtos', produtos); let kitsAfetados = false;
    kits.forEach(kit => { const t = kit.produtos.length; kit.produtos = kit.produtos.filter(p => p.id !== id); if(kit.produtos.length < t) { kitsAfetados = true; kit.custoTotal = kit.produtos.reduce((a, p) => a + p.custo + p.picking, 0); } });
    if(kitsAfetados) salvarDados('kits', kits); if(document.getElementById('catalogo-page')?.offsetParent !== null) aplicarFiltros(); if(document.getElementById('kits-page')?.offsetParent !== null) renderizarListaKits();
    mostrarNotificacao('Produto excluído!', 'success'); fecharModal();
}

// --- Catálogo ---
function carregarFiltrosCatalogo() { /* ... */ }
function aplicarFiltros() { /* ... */ }
function limparFiltros() { /* ... */ }
function renderizarCatalogo(itensParaMostrar) { /* ... */ }

// --- Carrinho ---
function abrirCarrinho() { /* ... */ }
function fecharCarrinho() { /* ... */ }
function renderizarCarrinho() { /* ... */ }
function mudarQuantidade(id, delta, isKit) { /* ... */ }
function removerDoCarrinho(id, isKit) { /* ... */ }
function limparCarrinho() { /* ... */ }
function calcularTotais() { /* ... */ }
function adicionarAoCarrinho(id) { /* ... */ }
function calcularPrecoFinal(custoTotalItem, lucroDesejado, cfg) { /* ... */ }

// --- Cotações ---
function gerarResumoWhatsapp() { /* ... */ }
function copiarResumo() { /* ... */ }
function salvarCotacao() { /* ... */ }
function renderizarCotacoes() { /* ... */ }
function alterarStatusCotacao(id, nS) { /* ... */ }
function confirmarExclusaoCotacao(id) { /* ... */ }
function verDetalhesCotacao(id) { /* ... */ }

// --- Kits ---
function inicializarPaginaKits() { /* ... */ }
function carregarProdutosParaKitSelect(filtro = '') { /* ... */ }
function filtrarProdutosParaKit() { /* ... */ }
function adicionarProdutoAoKit() { /* ... */ }
function renderizarProdutosDoKit() { /* ... */ }
function removerProdutoDoKit(pId) { /* ... */ }
function handleSalvarKit(e) { /* ... */ }
function limparFormularioKit() { /* ... */ }
function renderizarListaKits() { /* ... */ }
function mostrarDetalhesKit(id) { /* ... */ }
function editarKit(id) { /* ... */ }
function excluirKit(id) { /* ... */ }
function confirmarExclusaoKit(id) { /* ... */ }
function adicionarKitAoCarrinho(id) { /* ... */ }

// --- Marketing/Cupons ---
function inicializarPaginaMarketing() {
    renderizarListaCupons();
    atualizarEstatisticasCupons();
    renderizarListaCampanhas(); // Adiciona a renderização das campanhas na página principal
    document.getElementById('filtro-cupons').addEventListener('input', renderizarListaCupons);
}
function salvarCupom(e) { /* ... */ }
function limparFormularioCupom() { /* ... */ }
function renderizarListaCupons() { /* ... */ }
function registrarUsoCupom(id) { /* ... */ }
function atualizarEstatisticasCupons() { /* ... */ }
function editarCupom(id) { /* ... */ }
function excluirCupom(id) { /* ... */ }
function confirmarExclusaoCupom(id) { /* ... */ }


// --- Financeiro ---
function calcularEstatisticasFinanceiras() {
    const cC = cotacoes.filter(c => c.status === 'Convertida');
    const h = new Date(); const iD = new Date(h.getFullYear(), h.getMonth(), h.getDate()); const iM = new Date(h.getFullYear(), h.getMonth(), 1);
    const vH = cC.filter(c => new Date(c.dataGeracao) >= iD).reduce((a, c) => a + (parseFloat(c.totalGeral.replace(/[^0-9,-]+/g,"").replace(",",".")) || 0), 0);
    const cotacoesMes = cC.filter(c => new Date(c.dataGeracao) >= iM);
    const vM = cotacoesMes.reduce((a, c) => a + (parseFloat(c.totalGeral.replace(/[^0-9,-]+/g,"").replace(",",".")) || 0), 0);
    let lM = 0; cotacoesMes.forEach(ct => { (ct.itens || []).forEach(it => { const cI = it.custo || 0; lM += (it.precoVenda - cI) * it.quantidade; }); lM += (parseFloat(ct.frete.replace(/[^0-9,-]+/g,"").replace(",",".")) || 0); lM -= (parseFloat(ct.descontos.replace(/[^0-9,-]+/g,"").replace(",",".")) || 0); });
    document.getElementById('financeiro-vendas-hoje').textContent = formatarMoeda(vH);
    const metaVendasStr = metasFinanceiras.vendas > 0 ? ` / ${formatarMoeda(metasFinanceiras.vendas)}` : ''; const progressoVendas = metasFinanceiras.vendas > 0 ? (vM / metasFinanceiras.vendas * 100) : 0; document.getElementById('financeiro-vendas-mes').textContent = formatarMoeda(vM); document.getElementById('financeiro-vendas-mes-meta').textContent = metaVendasStr; document.getElementById('financeiro-vendas-mes-progresso').textContent = metasFinanceiras.vendas > 0 ? `(${progressoVendas.toFixed(0)}%)` : '';
    const metaLucroStr = metasFinanceiras.lucro > 0 ? ` / ${formatarMoeda(metasFinanceiras.lucro)}` : ''; const progressoLucro = metasFinanceiras.lucro > 0 ? (lM / metasFinanceiras.lucro * 100) : 0; document.getElementById('financeiro-lucro-mes').textContent = formatarMoeda(lM); document.getElementById('financeiro-lucro-mes-meta').textContent = metaLucroStr; document.getElementById('financeiro-lucro-mes-progresso').textContent = metasFinanceiras.lucro > 0 ? `(${progressoLucro.toFixed(0)}%)` : '';
}

function calcularVendasLucroPeriodo(dataInicio, dataFim) {
    const cotacoesConvertidasPeriodo = cotacoes.filter(c => c.status === 'Convertida' && new Date(c.dataGeracao) >= dataInicio && new Date(c.dataGeracao) < dataFim);
    const vendas = cotacoesConvertidasPeriodo.reduce((acc, c) => acc + (parseFloat(c.totalGeral.replace(/[^0-9,-]+/g,"").replace(",",".")) || 0), 0);
    let lucro = 0; cotacoesConvertidasPeriodo.forEach(cotacao => { (cotacao.itens || []).forEach(item => { const custoItem = item.custo || 0; lucro += (item.precoVenda - custoItem) * item.quantidade; }); lucro += (parseFloat(cotacao.frete.replace(/[^0-9,-]+/g,"").replace(",",".")) || 0); lucro -= (parseFloat(cotacao.descontos.replace(/[^0-9,-]+/g,"").replace(",",".")) || 0); });
    return { vendas, lucro };
}

function gerarRelatorio(tipo) {
    const hoje = new Date(); const anoAtual = hoje.getFullYear(); const mesAtual = hoje.getMonth();
    const inicioMesAtual = new Date(anoAtual, mesAtual, 1); const fimMesAtual = new Date(anoAtual, mesAtual + 1, 1);
    const inicioMesAnterior = new Date(anoAtual, mesAtual - 1, 1); const fimMesAnterior = new Date(anoAtual, mesAtual, 1);
    const dadosAtuais = calcularVendasLucroPeriodo(inicioMesAtual, fimMesAtual); const dadosAnteriores = calcularVendasLucroPeriodo(inicioMesAnterior, fimMesAnterior);
    const nomeMesAtual = inicioMesAtual.toLocaleString('pt-BR', { month: 'long' }); const nomeMesAnterior = inicioMesAnterior.toLocaleString('pt-BR', { month: 'long' });
    let tituloRelatorio = ""; let conteudoHtml = "";
    const calcularVariacao = (atual, anterior) => { if (anterior === 0) { return atual > 0 ? '<span class="text-green-400">(+∞%)</span>' : '(0%)'; } const variacao = ((atual - anterior) / Math.abs(anterior)) * 100; const cor = variacao >= 0 ? 'text-green-400' : 'text-red-400'; const sinal = variacao >= 0 ? '+' : ''; return `<span class="${cor}">(${sinal}${variacao.toFixed(1).replace('.', ',')}%)</span>`; };

    if (tipo === 'vendas' || tipo === 'lucros') {
        const totalVendas = dadosAtuais.vendas; const totalLucro = dadosAtuais.lucro; const margemLucroMedia = totalVendas > 0 ? (totalLucro / totalVendas * 100) : 0;
        tituloRelatorio = `📊 Relatório de ${tipo === 'vendas' ? 'Vendas' : 'Lucros'} - ${nomeMesAtual}/${anoAtual}`;
        conteudoHtml = `<p...><strong>Período:</strong> ${nomeMesAtual} de ${anoAtual}</p><hr...><p...><strong>Total de Vendas Convertidas:</strong> ${formatarMoeda(totalVendas)}</p><p...><strong>Total de Lucro Estimado:</strong> <span class="${totalLucro >= 0 ? 'text-green-400' : 'text-red-400'}">${formatarMoeda(totalLucro)}</span></p><p...><strong>Margem de Lucro Média:</strong> ${margemLucroMedia.toFixed(1).replace('.', ',')}%</p><hr...><p...>Relatório baseado em cotações convertidas.</p>`;
    } else if (tipo === 'crescimento') {
        tituloRelatorio = `📈 Relatório de Crescimento - ${nomeMesAtual}/${anoAtual}`;
        const variacaoVendas = calcularVariacao(dadosAtuais.vendas, dadosAnteriores.vendas); const variacaoLucro = calcularVariacao(dadosAtuais.lucro, dadosAnteriores.lucro);
        conteudoHtml = `<p...><strong>Comparativo:</strong> ${nomeMesAtual}/${anoAtual} vs. ${nomeMesAnterior}/${inicioMesAnterior.getFullYear()}</p><hr...><strong...>Vendas Convertidas:</strong><ul...><li..>${nomeMesAtual}: ${formatarMoeda(dadosAtuais.vendas)}</li><li..>${nomeMesAnterior}: ${formatarMoeda(dadosAnteriores.vendas)}</li><li..>Variação: ${variacaoVendas}</li></ul><strong...>Lucro Estimado:</strong><ul...><li..>${nomeMesAtual}: ${formatarMoeda(dadosAtuais.lucro)}</li><li..>${nomeMesAnterior}: ${formatarMoeda(dadosAnteriores.lucro)}</li><li..>Variação: ${variacaoLucro}</li></ul><hr...><p...>Cálculos baseados em cotações convertidas.</p>`;
    } else { mostrarNotificacao(`Tipo de relatório '${tipo}' desconhecido.`, 'error'); return; }
    abrirModalDetalhes(tituloRelatorio, conteudoHtml, true);
}

function definirMetas() {
    fecharModal(); fecharModalPrecificacao();
    const m = document.createElement('div'); m.id = 'modal-metas'; m.className = 'fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[1060] p-4 modal-overlay';
    m.innerHTML = `<div class="custom-card rounded-lg p-6 max-w-sm w-full mx-auto"><div class="flex justify-between items-center mb-4"><h3 class="text-lg font-bold text-white">🎯 Definir Metas Mensais</h3><button type="button" onclick="fecharModal()" class="text-gray-400 hover:text-white text-2xl">&times;</button></div><form id="metas-form" class="space-y-4"><div><label for="meta-vendas"...>Meta de Vendas (R$)</label><input type="number" id="meta-vendas" step="100" min="0" value="${metasFinanceiras.vendas.toFixed(2)}" class="form-input"></div><div><label for="meta-lucro"...>Meta de Lucro (R$)</label><input type="number" id="meta-lucro" step="50" min="0" value="${metasFinanceiras.lucro.toFixed(2)}" class="form-input"></div><div class="flex gap-3 pt-3"><button type="button" onclick="salvarMetas()" class="flex-1 custom-accent custom-accent-hover ...">💾 Salvar Metas</button><button type="button" onclick="fecharModal()" class="flex-1 bg-gray-600 hover:bg-gray-700 ...">Cancelar</button></div></form></div>`;
    document.body.appendChild(m); modalAtual = m;
}

function salvarMetas() {
    const metaVendasInput = document.getElementById('meta-vendas'); const metaLucroInput = document.getElementById('meta-lucro');
    const novaMetaVendas = parseFloat(metaVendasInput.value) || 0; const novaMetaLucro = parseFloat(metaLucroInput.value) || 0;
    if (novaMetaVendas < 0 || novaMetaLucro < 0) { mostrarNotificacao('Metas não podem ser negativas.', 'error'); return; }
    metasFinanceiras.vendas = novaMetaVendas; metasFinanceiras.lucro = novaMetaLucro;
    salvarDados('metasFinanceiras', metasFinanceiras); mostrarNotificacao('Metas salvas!', 'success'); fecharModal();
    if (document.getElementById('financeiro-page')?.offsetParent !== null) { calcularEstatisticasFinanceiras(); }
}

function iniciarFechamentoMensal() {
    const hoje = new Date(); const anoAtual = hoje.getFullYear(); const mesAtual = hoje.getMonth();
    const inicioMesAnterior = new Date(anoAtual, mesAtual - 1, 1); const fimMesAnterior = new Date(anoAtual, mesAtual, 1);
    const nomeMesAnterior = inicioMesAnterior.toLocaleString('pt-BR', { month: 'long' }); const anoMesAnterior = inicioMesAnterior.getFullYear();
    const dadosMesAnterior = calcularVendasLucroPeriodo(inicioMesAnterior, fimMesAnterior);
    const cotacoesMesAnterior = cotacoes.filter(c => new Date(c.dataGeracao) >= inicioMesAnterior && new Date(c.dataGeracao) < fimMesAnterior);
    const totalCotacoesMes = cotacoesMesAnterior.length; const convertidasMes = cotacoesMesAnterior.filter(c => c.status === 'Convertida').length; const taxaConversaoMes = totalCotacoesMes > 0 ? (convertidasMes / totalCotacoesMes * 100) : 0;
    const titulo = `🗓️ Fechamento Mensal - ${nomeMesAnterior}/${anoMesAnterior}`;
    const conteudoHtml = `<p...><strong>Período:</strong> ${nomeMesAnterior} de ${anoMesAnterior}</p><hr...><strong...>Resumo Financeiro:</strong><ul...><li..>Vendas Totais: ${formatarMoeda(dadosMesAnterior.vendas)}</li><li..>Lucro Líquido: <span class="${dadosMesAnterior.lucro >= 0 ? 'text-green-400' : 'text-red-400'}">${formatarMoeda(dadosMesAnterior.lucro)}</span></li></ul><strong...>Desempenho Cotações:</strong><ul...><li..>Total Geradas: ${totalCotacoesMes}</li><li..>Convertidas: ${convertidasMes}</li><li..>Taxa Conversão: ${taxaConversaoMes.toFixed(1).replace('.', ',')}%</li></ul><hr...><p...>Resumo automático do mês anterior.</p>`;
    abrirModalDetalhes(titulo, conteudoHtml, true);
}


// --- Campanhas ---
function verCampanhas() {
     fecharModal(); fecharModalPrecificacao();
     const m = document.createElement('div'); m.id = 'modal-campanhas'; m.className = 'fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[1060] p-4 modal-overlay';
     m.innerHTML = `<div class="custom-card rounded-lg p-6 max-w-2xl w-full mx-auto flex flex-col max-h-[80vh]"><div class="flex justify-between items-center mb-4 flex-shrink-0"><h3 class="text-lg font-bold text-white">📢 Campanhas de Marketing</h3><button type="button" onclick="fecharModal()" class="text-gray-400 hover:text-white text-2xl">&times;</button></div><div id="lista-campanhas-modal" class="space-y-3 overflow-y-auto mb-4 flex-grow pr-2">${renderizarListaCampanhas(true)}</div><form id="campanha-form-modal" class="space-y-3 border-t border-gray-600 pt-4 flex-shrink-0"><h4 class="text-md font-semibold text-white">Nova Campanha</h4><input type="hidden" id="campanha-id-edit"><div><label for="campanha-nome"...>Nome*</label><input type="text" id="campanha-nome" required class="form-input text-sm"></div><div><label for="campanha-descricao"...>Descrição</label><textarea id="campanha-descricao" rows="2" class="form-input text-sm"></textarea></div><div class="grid grid-cols-2 gap-3"><div><label for="campanha-inicio"...>Início</label><input type="date" id="campanha-inicio" class="form-input text-sm"></div><div><label for="campanha-fim"...>Fim</label><input type="date" id="campanha-fim" class="form-input text-sm"></div></div><div class="flex gap-3 pt-2"><button type="button" onclick="salvarCampanha()" class="flex-1 custom-accent ...">💾 Salvar</button><button type="button" onclick="limparFormularioCampanha()" class="flex-1 bg-gray-600 ...">Limpar</button></div></form></div>`;
     document.body.appendChild(m); modalAtual = m;
}

function renderizarListaCampanhas(isModal = false) {
    const containerId = isModal ? 'lista-campanhas-modal' : 'campanhas-container';
    const container = document.getElementById(containerId); let htmlOutput = '';
    if (!container && isModal) return '<p class="text-gray-400 text-center py-5 text-sm">Erro ao carregar lista.</p>';
    if (!container && !isModal) { return; } // Não faz nada se o container da página não existir
    if (campanhasMarketing.length === 0) { htmlOutput = '<p class="text-gray-400 text-center py-5 text-sm">Nenhuma campanha cadastrada.</p>'; }
    else {
        const campanhasOrdenadas = [...campanhasMarketing].sort((a, b) => (new Date(b.dataCriacao || 0)) - (new Date(a.dataCriacao || 0)));
        campanhasOrdenadas.forEach(campanha => {
            const dataInicio = campanha.dataInicio ? formatarData(new Date(campanha.dataInicio + 'T00:00:00')).split(',')[0] : 'N/D'; // Adiciona T00:00:00 para evitar problemas de fuso
            const dataFim = campanha.dataFim ? formatarData(new Date(campanha.dataFim + 'T00:00:00')).split(',')[0] : 'N/D';
            htmlOutput += `<div class="custom-card rounded-lg p-3 text-sm"><div class="flex justify-between items-start mb-1"><h5 class="font-semibold text-white truncate pr-2">${campanha.nome}</h5><div class="flex gap-1 flex-shrink-0"><button onclick="editarCampanha(${campanha.id})" class="text-blue-400 hover:text-blue-300 text-xs">✏️</button><button onclick="excluirCampanha(${campanha.id})" class="text-red-400 hover:text-red-300 text-xs">🗑️</button></div></div><p class="text-gray-300 text-xs mb-1">${campanha.descricao || 'Sem descrição.'}</p><p class="text-gray-400 text-xs">Período: ${dataInicio} a ${dataFim}</p></div>`;
        });
    }
    if (isModal) { return htmlOutput; } else { if(container) container.innerHTML = htmlOutput; }
}

function salvarCampanha() {
    const idInput = document.getElementById('campanha-id-edit'); const nomeInput = document.getElementById('campanha-nome'); const descricaoInput = document.getElementById('campanha-descricao'); const inicioInput = document.getElementById('campanha-inicio'); const fimInput = document.getElementById('campanha-fim');
    const id = idInput.value ? parseInt(idInput.value) : null; const nome = nomeInput.value.trim(); const descricao = descricaoInput.value.trim(); const dataInicio = inicioInput.value || null; const dataFim = fimInput.value || null;
    if (!nome) { mostrarNotificacao('O nome da campanha é obrigatório!', 'error'); return; }
    const campanhaData = { id: id || Date.now(), nome, descricao, dataInicio, dataFim, dataCriacao: id ? campanhasMarketing.find(c => c.id === id)?.dataCriacao : new Date().toISOString() };
    if (id) {
        const index = campanhasMarketing.findIndex(c => c.id === id);
        if (index !== -1) { campanhasMarketing[index] = { ...campanhasMarketing[index], ...campanhaData }; mostrarNotificacao('Campanha atualizada!', 'success'); } else { mostrarNotificacao('Erro ao editar campanha.', 'error'); return; }
    } else { campanhasMarketing.push(campanhaData); mostrarNotificacao('Campanha salva!', 'success'); }
    salvarDados('campanhasMarketing', campanhasMarketing); limparFormularioCampanha();
    const listaModal = document.getElementById('lista-campanhas-modal'); if (listaModal) { listaModal.innerHTML = renderizarListaCampanhas(true); }
    renderizarListaCampanhas(false);
}

function limparFormularioCampanha() { const form = document.getElementById('campanha-form-modal'); if(form) { form.reset(); document.getElementById('campanha-id-edit').value = ''; } }

function editarCampanha(id) {
    const campanha = campanhasMarketing.find(c => c.id === id); if (!campanha) return;
    if (!modalAtual || modalAtual.id !== 'modal-campanhas') { verCampanhas(); setTimeout(() => preencherFormularioCampanha(campanha), 50); } else { preencherFormularioCampanha(campanha); }
}

function preencherFormularioCampanha(campanha) {
     const idInput = document.getElementById('campanha-id-edit'); const nomeInput = document.getElementById('campanha-nome'); const descricaoInput = document.getElementById('campanha-descricao'); const inicioInput = document.getElementById('campanha-inicio'); const fimInput = document.getElementById('campanha-fim');
     if (idInput && nomeInput && descricaoInput && inicioInput && fimInput) { idInput.value = campanha.id; nomeInput.value = campanha.nome; descricaoInput.value = campanha.descricao || ''; inicioInput.value = campanha.dataInicio || ''; fimInput.value = campanha.dataFim || ''; nomeInput.focus(); } else { console.error("Campos do form de campanha não encontrados."); }
}

function excluirCampanha(id) { abrirModalConfirmacao(`Tem certeza que deseja excluir esta campanha?`, () => confirmarExclusaoCampanha(id)); }

function confirmarExclusaoCampanha(id) {
    campanhasMarketing = campanhasMarketing.filter(c => c.id !== id); salvarDados('campanhasMarketing', campanhasMarketing);
    mostrarNotificacao('Campanha excluída!', 'success'); fecharModal(); // Fecha confirmação
    const listaModal = document.getElementById('lista-campanhas-modal'); if (listaModal && modalAtual && modalAtual.id === 'modal-campanhas') { listaModal.innerHTML = renderizarListaCampanhas(true); }
    renderizarListaCampanhas(false);
}

// --- Auxiliares ---
function formatarMoeda(valor) { return (valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function formatarData(data) { if(!data || !(data instanceof Date)) return '-'; return data.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
function formatarTelefone(tel) { if (!tel) return "N/I"; return tel.replace(/\D/g,''); }

// --- Modais ---
function abrirModalConfirmacao(msg, callback) {
    fecharModal(); fecharModalPrecificacao();
    const m = document.createElement('div'); m.id = 'modal-confirmacao'; m.className = 'fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[1070] p-4 modal-overlay'; // Aumenta z-index
    m.innerHTML = `<div class="custom-card rounded-lg p-6 max-w-xs w-full mx-auto"><h3 class="text-base font-bold text-white mb-3">Confirmação</h3><p class="text-gray-300 mb-5 text-sm">${msg}</p><div class="flex gap-2"><button id="modal-confirmar-btn" class="flex-1 bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded font-medium text-xs">Confirmar</button><button type="button" onclick="fecharModal()" class="flex-1 bg-gray-600 hover:bg-gray-700 text-white px-3 py-1.5 rounded font-medium text-xs">Cancelar</button></div></div>`;
    document.body.appendChild(m); document.getElementById('modal-confirmar-btn').onclick = () => { callback(); }; modalAtual = m; // Atribui callback ao botão
}
function abrirModalDetalhes(titulo, conteudo, html = false) {
    fecharModal(); fecharModalPrecificacao();
    const m = document.createElement('div'); m.id = 'modal-detalhes'; m.className = 'fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[1060] p-4 modal-overlay';
    const cCont = document.createElement('div'); cCont.className = "w-full max-h-[70vh] overflow-y-auto p-3 bg-gray-800 border border-gray-600 rounded text-gray-200 text-xs";
    if (html) { cCont.innerHTML = conteudo; } else { cCont.textContent = conteudo; cCont.style.whiteSpace = 'pre-wrap'; }
    m.innerHTML = `<div class="custom-card rounded-lg p-5 max-w-md w-full mx-auto flex flex-col"><div class="flex justify-between items-center mb-3"><h3 class="text-base font-bold text-white">${titulo}</h3><button type="button" onclick="fecharModal()" class="text-gray-400 hover:text-white text-2xl">&times;</button></div>${cCont.outerHTML}<div class="flex gap-3 mt-3"><button type="button" onclick="fecharModal()" class="flex-1 custom-accent custom-accent-hover text-white px-3 py-1.5 rounded font-medium text-xs">Fechar</button></div></div>`;
    document.body.appendChild(m); modalAtual = m;
}
function fecharModal() { if (modalAtual) { modalAtual.remove(); modalAtual = null; } }


// --- Funções do Modal de Precificação ---
function abrirModalPrecificacao(produtoId) {
    fecharModal(); fecharModalPrecificacao(); const produto = produtos.find(p => p.id === produtoId); const item = produto; if (!item) { mostrarNotificacao('Item não encontrado.', 'error'); return; } const isKit = !produto; const custoTotalItem = isKit ? item.custoTotal : (item.custo + item.picking); const idBase = item.id; const savedPricing = item.pricingConfig || {}; const overlay = document.createElement('div'); overlay.id = 'modal-precificacao-overlay'; overlay.className = 'modal-precificacao-overlay'; let modalHTML = `<div class="modal-precificacao" id="modal-precificacao-${idBase}"><div class="modal-precificacao-header"><h3 class="modal-precificacao-title" title="Precificação: ${item.nome}">Precificação: ${isKit ? '🧩 ' : ''}${item.nome}</h3><button type="button" class="modal-precificacao-close-btn" onclick="fecharModalPrecificacao()">&times;</button></div><div class="modal-precificacao-content"><div class="modal-product-header"><img src="${isKit ? '...' : (item.imagem || 'https://via.placeholder.com/80')}" alt="${item.nome}" class="modal-product-image" onerror="this.src='https://via.placeholder.com/80';"><div class="modal-product-info"><p><span>SKU:</span> <strong>${isKit ? `KIT-${item.id}` : item.sku}</strong></p><p><span>Custo Total:</span> <strong class="text-red-400">${formatarMoeda(custoTotalItem)}</strong></p>${isKit ? `<p><span>Itens no Kit:</span> <strong>${item.produtos.length}</strong></p>` : ''}</div></div><h4 class="text-center text-sm font-semibold text-gray-400 mb-4 uppercase tracking-wider">Precificação por Marketplace</h4>`;
    Object.keys(lojasConfig).forEach(key => { const loja = lojasConfig[key]; const idLoja = `${key}-${idBase}`; const lucroSalvo = (savedPricing[key] !== undefined) ? savedPricing[key].toFixed(2) : "10.00"; modalHTML += `<div class="modal-store-card"><div class="store-card-header"><div class="store-info"><img src="assets/logos/${loja.logo}" alt="${loja.nome}" class="store-logo" onerror="this.onerror=null; this.src='https://via.placeholder.com/24/0F172A/94a3b8?text=${loja.nome[0]}';"><span class="store-name">${loja.nome}</span></div><span class="store-config">${(loja.comissao * 100).toFixed(1)}% + ${formatarMoeda(loja.taxaFixa)}</span></div><div class="store-pricing-body"><div class="store-pricing-row"><label for="lucro-desejado-${idLoja}" class="store-pricing-label">Lucro Desejado (R$):</label><input type="number" step="0.01" value="${lucroSalvo}" id="lucro-desejado-${idLoja}" class="store-input" oninput="calcularPrecoLojaModal('${key}', ${idBase}, 'lucro_loja', ${isKit})"></div><div class="store-pricing-row ideal-price-row"><span class="store-pricing-label">Preço Ideal Sugerido:</span><span class="store-pricing-value" id="preco-ideal-${idLoja}">R$ 0,00</span></div><div class="store-pricing-row"><span class="store-pricing-label">↳ Comissão (${(loja.comissao * 100).toFixed(1)}%):</span><span class="store-pricing-value store-pricing-detail" id="comissao-valor-${idLoja}">R$ 0,00</span></div><div class="store-pricing-row"><span class="store-pricing-label">↳ Taxa Fixa:</span><span class="store-pricing-value store-pricing-detail" id="taxa-fixa-valor-${idLoja}">R$ 0,00</span></div><div class="store-pricing-row final-price-row"><label for="preco-final-${idLoja}" class="store-pricing-label">Preço Final (R$):</label><input type="number" step="0.01" value="0.00" id="preco-final-${idLoja}" class="store-input bg-gray-600" readonly></div><div class="store-pricing-row final-result-row"><span class="store-pricing-label">↳ Lucro Real (Margem):</span><span class="store-pricing-value"><span id="lucro-real-${idLoja}">R$ 0,00</span> (<span id="margem-real-${idLoja}">0,0%</span>)</span></div></div></div>`; });
    modalHTML += `</div><div class="modal-precificacao-footer" style="display: flex; justify-content: flex-end; gap: 0.75rem;"><button type="button" class="modal-close-button" onclick="fecharModalPrecificacao()">Cancelar</button><button type="button" class="modal-close-button" onclick="salvarPrecificacaoModal(${idBase}, ${isKit})" style="background-color: var(--modal-accent); border-color: var(--modal-accent);" onmouseover="this.style.backgroundColor='#6B46C1'" onmouseout="this.style.backgroundColor='var(--modal-accent)'">💾 Salvar e Fechar</button></div></div>`;
    overlay.innerHTML = modalHTML; document.body.appendChild(overlay); setTimeout(() => overlay.classList.add('show'), 10); modalPrecificacaoAberto = true; Object.keys(lojasConfig).forEach(key => { calcularPrecoLojaModal(key, idBase, 'init', isKit); });
}
function fecharModalPrecificacao() { const overlay = document.getElementById('modal-precificacao-overlay'); if (overlay) { overlay.classList.remove('show'); setTimeout(() => { if (overlay) overlay.remove(); modalPrecificacaoAberto = false; }, 300); } else { modalPrecificacaoAberto = false; } }
function salvarPrecificacaoModal(itemId, isKit) { const item = isKit ? kits.find(k => k.id === itemId) : produtos.find(p => p.id === itemId); if (!item) { mostrarNotificacao('Erro: Item não encontrado.', 'error'); return; } if (isKit) { mostrarNotificacao('Precificação de kit não implementada.', 'info'); fecharModalPrecificacao(); return; } if (!item.pricingConfig) { item.pricingConfig = {}; } let alteracoesFeitas = false; Object.keys(lojasConfig).forEach(key => { const idLoja = `${key}-${itemId}`; const lucroDesejadoInput = document.getElementById(`lucro-desejado-${idLoja}`); if (lucroDesejadoInput) { const lucroDesejado = parseFloat(lucroDesejadoInput.value); if (!isNaN(lucroDesejado)) { item.pricingConfig[key] = lucroDesejado; alteracoesFeitas = true; } } }); if (alteracoesFeitas) { const produtoIndex = produtos.findIndex(p => p.id === itemId); if (produtoIndex !== -1) { produtos[produtoIndex] = item; salvarDados('produtos', produtos); mostrarNotificacao('Precificação salva!', 'success'); } else { mostrarNotificacao('Erro ao salvar produto.', 'error'); } } fecharModalPrecificacao(); }
function calcularPrecoLojaModal(lojaKey, itemId, trigger, isKit) { const item = isKit ? kits.find(k => k.id === itemId) : produtos.find(p => p.id === itemId); if (!item) return; const cfg = lojasConfig[lojaKey]; const idLoja = `${lojaKey}-${itemId}`; const lucroDesejadoInput = document.getElementById(`lucro-desejado-${idLoja}`); const precoFinalInput = document.getElementById(`preco-final-${idLoja}`); const precoIdealSpan = document.getElementById(`preco-ideal-${idLoja}`); const comissaoValorSpan = document.getElementById(`comissao-valor-${idLoja}`); const taxaFixaValorSpan = document.getElementById(`taxa-fixa-valor-${idLoja}`); const lucroRealSpan = document.getElementById(`lucro-real-${idLoja}`); const margemRealSpan = document.getElementById(`margem-real-${idLoja}`); if (!lucroDesejadoInput || !precoFinalInput || !precoIdealSpan || !comissaoValorSpan || !taxaFixaValorSpan || !lucroRealSpan || !margemRealSpan) { console.error(`Erro: Elementos do modal não encontrados (${lojaKey}, ${itemId})`); return; } const custoTotalItem = isKit ? item.custoTotal : (item.custo + item.picking); const lucroDesejado = parseFloat(lucroDesejadoInput.value) || 0; const subtotalParaCalculo = custoTotalItem + lucroDesejado + cfg.taxaFixa; const precoFinalCalculado = (cfg.comissao < 1) ? subtotalParaCalculo / (1 - cfg.comissao) : subtotalParaCalculo; const comissaoValor = precoFinalCalculado * cfg.comissao; const taxaFixaValor = cfg.taxaFixa; const receitaLiquida = precoFinalCalculado - comissaoValor - cfg.taxaFixa; const lucroReal = receitaLiquida - custoTotalItem; const margemReal = (precoFinalCalculado > 0) ? (lucroReal / precoFinalCalculado * 100) : 0; precoIdealSpan.textContent = formatarMoeda(precoFinalCalculado); comissaoValorSpan.textContent = formatarMoeda(comissaoValor); taxaFixaValorSpan.textContent = formatarMoeda(taxaFixaValor); precoFinalInput.value = precoFinalCalculado.toFixed(2); const lucroRealFormatado = formatarMoeda(lucroReal); const margemRealFormatada = `${margemReal.toFixed(1).replace('.', ',')}%`; lucroRealSpan.textContent = lucroRealFormatado; margemRealSpan.textContent = margemRealFormatada; const parentSpan = lucroRealSpan.parentElement; parentSpan.classList.remove('profit-positive', 'profit-negative'); if (lucroReal > 0) { parentSpan.classList.add('profit-positive'); } else if (lucroReal < 0) { parentSpan.classList.add('profit-negative'); } }

// --- Sistema de Notificações ---
function mostrarNotificacao(msg, tipo = 'success') { const el = document.getElementById('notification'); const txt = document.getElementById('notification-text'); if (!el || !txt) return; txt.textContent = msg; el.className = 'notification px-4 py-2 rounded-md shadow-lg text-sm font-medium'; if (tipo === 'success') el.classList.add('bg-green-600', 'text-white'); else if (tipo === 'error') el.classList.add('bg-red-600', 'text-white'); else if (tipo === 'info') el.classList.add('bg-blue-600', 'text-white'); else el.classList.add('bg-gray-700', 'text-white'); el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 3000); }