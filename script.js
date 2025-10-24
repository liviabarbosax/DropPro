// --- Dados Persistentes (Lidos apenas uma vez) ---
let fornecedores = JSON.parse(localStorage.getItem('fornecedores')) || ['Fornecedor Exemplo'];
let produtos = JSON.parse(localStorage.getItem('produtos')) || []; // Contém { ..., variations: [...], pricingConfig: { shopee: 15.00, ... } }
let carrinho = JSON.parse(localStorage.getItem('carrinho')) || [];
let cotacoes = JSON.parse(localStorage.getItem('cotacoes')) || [];
let kits = JSON.parse(localStorage.getItem('kits')) || [];
let cupons = JSON.parse(localStorage.getItem('cupons')) || [];

// --- Variáveis de Estado (Memória Temporária) ---
let kitProdutosTemporario = []; // Para montar/editar kits
let produtoEditId = null; // ID do produto sendo editado
let produtoVariationsTemporario = []; // Para montar/editar variações
let cotacaoAtual = null; // Para gerar cotação no carrinho
let modalAtual = null; // Para modais genéricos (confirmação/detalhes)
let modalPrecificacaoAberto = false; // Flag para o modal de precificação

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

    // Event listener para fechar modal de precificação clicando no overlay
    document.body.addEventListener('click', (event) => {
        if (event.target.classList.contains('modal-precificacao-overlay') && modalPrecificacaoAberto) {
            fecharModalPrecificacao();
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
        case 'produtos':
            // ===== INÍCIO DA CORREÇÃO 1.1 (Bug Edição) =====
            // A limpeza agora é tratada pelo clique (index.html) ou por 'irParaCadastroProduto()'
            // limparFormularioProduto(); // REMOVIDO
            // ===== FIM DA CORREÇÃO 1.1 =====
            break;
        case 'catalogo': carregarFiltrosCatalogo(); aplicarFiltros(); break;
        case 'cotacoes': renderizarCotacoes(); break;
        // Lojas removida
        case 'kits': inicializarPaginaKits(); break;
        case 'financeiro': calcularEstatisticasFinanceiras(); break;
        case 'marketing': inicializarPaginaMarketing(); break;
    }
    fecharCarrinho();
    fecharModalPrecificacao(); // Garante que feche ao navegar
}

// ===== INÍCIO DA CORREÇÃO 1.2 (Bug Edição) =====
function irParaCadastroProduto() { 
    limparFormularioProduto(); // Garante que o formulário esteja limpo
    showPage('produtos'); 
}
// ===== FIM DA CORREÇÃO 1.2 =====

// --- Dashboard ---
// ... (código do Dashboard permanece o mesmo) ...
function calcularDashboard() {
    const hoje = new Date();
    const inicioDoMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);

    const cotacoesConvertidasMes = cotacoes.filter(c => c.status === 'Convertida' && new Date(c.dataGeracao) >= inicioDoMes);
    const vendasMes = cotacoesConvertidasMes.reduce((acc, c) => acc + (parseFloat(c.totalGeral.replace(/[^0-9,-]+/g,"").replace(",",".")) || 0), 0);

    let lucroMes = 0;
    cotacoesConvertidasMes.forEach(cotacao => {
        cotacao.itens.forEach(item => {
            // Assume que 'custo' no item da cotação já é o custo total (produto+picking ou kit)
            const custoItem = item.custo || 0; // Se não houver custo registrado, assume 0
            lucroMes += (item.precoVenda - custoItem) * item.quantidade;
        });
        lucroMes += (parseFloat(cotacao.frete.replace(/[^0-9,-]+/g,"").replace(",",".")) || 0);
        lucroMes -= (parseFloat(cotacao.descontos.replace(/[^0-9,-]+/g,"").replace(",",".")) || 0);
    });

    const cotacoesPendentes = cotacoes.filter(c => c.status === 'Pendente').length;
    const totalProdutos = produtos.length; // Apenas produtos base, sem contar kits ou variações como itens separados aqui.

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
        listaContainer.innerHTML = '<p class="text-gray-400 text-center p-4">🎉 Nenhuma cotação pendente!</p>';
        return;
    }
    cotacoesPendentes.slice(0, 5).forEach(cotacao => {
        listaContainer.innerHTML += `<div class="bg-gray-800 rounded-lg p-4 flex justify-between items-center"><div><h4 class="text-white font-bold">${cotacao.id}</h4><p class="text-gray-300 text-sm">${cotacao.cliente || 'N/I'} - ${cotacao.local || 'N/I'}</p><p class="text-gray-400 text-xs">${formatarData(new Date(cotacao.dataGeracao))}</p></div><div class="text-right"><p class="text-white font-bold text-lg">${cotacao.totalGeral}</p><button onclick="alterarStatusCotacao('${cotacao.id}', 'Convertida')" class="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm mt-1">✅ Converter</button></div></div>`;
    });
}

// --- Fornecedores ---
// ... (código dos Fornecedores permanece o mesmo) ...
function carregarFornecedoresSelect(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;
    const valorAtual = select.value;
    select.innerHTML = `<option value="">Selecione...</option>`;
    fornecedores.forEach(f => {
        const option = document.createElement('option');
        option.value = f;
        option.textContent = f;
        select.appendChild(option);
    });
    select.value = valorAtual;
}
function atualizarDropdownFornecedores() {
    ['fornecedores-select', 'produto-fornecedor', 'filtro-fornecedor'].forEach(id => carregarFornecedoresSelect(id));
}
function adicionarFornecedor() {
    const input = document.getElementById('novo-fornecedor');
    const novo = input.value.trim();
    if (!novo) { mostrarNotificacao('Digite o nome do fornecedor!', 'error'); return; }
    if (fornecedores.includes(novo)) { mostrarNotificacao('Fornecedor já cadastrado!', 'error'); return; }
    fornecedores.push(novo);
    salvarDados('fornecedores', fornecedores);
    atualizarDropdownFornecedores();
    input.value = '';
    mostrarNotificacao('Fornecedor adicionado com sucesso!', 'success');
}
function removerFornecedor() {
    const select = document.getElementById('fornecedores-select');
    const selecionado = select.value;
    if (!selecionado) { mostrarNotificacao('Selecione um fornecedor para remover!', 'error'); return; }
    if (produtos.some(p => p.fornecedor === selecionado)) {
        mostrarNotificacao('Não é possível remover: existem produtos associados a este fornecedor!', 'error');
        return;
    }
    fornecedores = fornecedores.filter(f => f !== selecionado);
    salvarDados('fornecedores', fornecedores);
    atualizarDropdownFornecedores();
    mostrarNotificacao('Fornecedor removido com sucesso!', 'success');
}


// --- Produtos ---

// NOVO: Funções para Variações (UI básica)
function adicionarVariacao() {
    const typeInput = document.getElementById('variation-type');
    const valueInput = document.getElementById('variation-value');
    const skuInput = document.getElementById('variation-sku');
    const type = typeInput.value.trim();
    const value = valueInput.value.trim();
    const sku = skuInput.value.trim();

    if (!value || !sku) {
        mostrarNotificacao('Preencha o Valor e o SKU da Variação!', 'error');
        return;
    }
    // Adiciona à lista temporária (a ser salva junto com o produto)
    produtoVariationsTemporario.push({ type: type || 'Única', value, sku }); // Usa 'Única' se tipo não for preenchido
    renderizarVariacoes();

    // Limpa os campos de input de variação
    typeInput.value = '';
    valueInput.value = '';
    skuInput.value = '';
}

function renderizarVariacoes() {
    const listElement = document.getElementById('variations-list');
    listElement.innerHTML = ''; // Limpa a lista atual
    if (produtoVariationsTemporario.length === 0) {
        listElement.innerHTML = '<p class="text-gray-400 text-xs text-center variation-placeholder">Nenhuma variação adicionada.</p>';
        return;
    }
    produtoVariationsTemporario.forEach((variation, index) => {
        const item = document.createElement('div');
        item.className = 'variation-item';
        item.innerHTML = `
            <span>${variation.type}</span>
            <span>${variation.value}</span>
            <span>${variation.sku}</span>
            <button type="button" class="remove-variation-btn" onclick="removerVariacao(${index})">✕</button>
        `;
        listElement.appendChild(item);
    });
}

function removerVariacao(index) {
    produtoVariationsTemporario.splice(index, 1); // Remove do array pelo índice
    renderizarVariacoes(); // Re-renderiza a lista
}

function handleSalvarProduto(e) {
    e.preventDefault();
    const fileInput = document.getElementById('produto-imagem');
    const file = fileInput.files[0];

    // Pega dados básicos do formulário
    const produtoData = {
        sku: document.getElementById('produto-sku').value.trim(), // SKU Principal
        nome: document.getElementById('produto-nome').value.trim(),
        categoria: document.getElementById('produto-categoria').value.trim(),
        fornecedor: document.getElementById('produto-fornecedor').value,
        custo: parseFloat(document.getElementById('produto-custo').value) || 0, // Custo Base
        picking: parseFloat(document.getElementById('produto-picking').value) || 0,
        peso: parseFloat(document.getElementById('produto-peso').value) || 0, // Peso Base
        comprimento: parseInt(document.getElementById('produto-comprimento').value) || 0,
        largura: parseInt(document.getElementById('produto-largura').value) || 0,
        altura: parseInt(document.getElementById('produto-altura').value) || 0,
        // Adiciona as variações salvas temporariamente
        variations: [...produtoVariationsTemporario]
        // pricingConfig será mantido se já existir (na parte de edição)
    };

    // Validação
    if (!produtoData.sku || !produtoData.nome || !produtoData.categoria || !produtoData.fornecedor || produtoData.custo < 0 || produtoData.peso <= 0) {
        mostrarNotificacao('Preencha os campos obrigatórios (*) com valores válidos!', 'error');
        return;
    }
    // Validação de SKU único (considerando principal e variações)
    const allSkusInForm = [produtoData.sku, ...produtoData.variations.map(v => v.sku)].filter(Boolean); // Filtra SKUs vazios
    if (new Set(allSkusInForm).size !== allSkusInForm.length) {
         mostrarNotificacao('Erro: SKUs duplicados dentro do mesmo produto (principal ou variações).', 'error');
         return;
    }
    // Verifica duplicação com outros produtos (exceto o próprio produto sendo editado)
    const outrosProdutos = produtos.filter(p => p.id !== produtoEditId);
    const skusExistentes = outrosProdutos.flatMap(p => [p.sku, ...(p.variations || []).map(v => v.sku)]);
    const skuDuplicado = allSkusInForm.find(sku => skusExistentes.includes(sku));
    if (skuDuplicado) {
        mostrarNotificacao(`Erro: O SKU "${skuDuplicado}" já está em uso por outro produto ou variação.`, 'error');
        return;
    }


    const salvar = (imageUrl) => {
        produtoData.imagem = imageUrl;
        if (produtoEditId) {
            const index = produtos.findIndex(p => p.id === produtoEditId);
            if (index !== -1) {
                if (!imageUrl && produtos[index].imagem) {
                    produtoData.imagem = produtos[index].imagem;
                }
                // Mantém datas originais e config de precificação, atualiza data de modificação
                produtos[index] = {
                    ...produtos[index], // Mantém ID, dataCadastro, pricingConfig
                    ...produtoData, // Sobrescreve com novos dados do formulário
                    dataAtualizacao: new Date().toISOString()
                };
                mostrarNotificacao('Produto atualizado com sucesso!', 'success');
            }
        } else {
            produtoData.id = Date.now();
            produtoData.dataCadastro = new Date().toISOString();
            produtoData.pricingConfig = {}; // Inicializa config de precificação para novos produtos
            produtos.push(produtoData);
            mostrarNotificacao('Produto salvo com sucesso!', 'success');
        }
        salvarDados('produtos', produtos);
        limparFormularioProduto(); // Limpa DEPOIS de salvar
        
        // Limpa os filtros do catálogo antes de ir para a página
        // Isso garante que o produto novo/editado apareça
        document.getElementById('filtro-busca').value = '';
        document.getElementById('filtro-categoria').value = '';
        document.getElementById('filtro-fornecedor').value = '';

        showPage('catalogo');
    };

    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => salvar(e.target.result);
        reader.readAsDataURL(file);
    } else {
        salvar(produtoEditId ? (produtos.find(p => p.id === produtoEditId)?.imagem || null) : null);
    }
}

function editarProduto(id) {
    const produto = produtos.find(p => p.id === id);
    if (!produto) return;

    // 1. Navega para a página. Se o usuário veio de outro link, o formulário será limpo (pela Correção 1.3)
    // Se ele já estava na página, ela apenas continua visível.
    showPage('produtos'); 

    // 2. Limpa o formulário ANTES de preencher
    limparFormularioProduto(); 
    
    // 3. Agora que a página está visível e limpa, preenchemos os dados
    produtoEditId = id;
    document.getElementById('produto-id-edit').value = id;
    document.getElementById('produto-sku').value = produto.sku;
    document.getElementById('produto-nome').value = produto.nome;
    document.getElementById('produto-categoria').value = produto.categoria;
    document.getElementById('produto-fornecedor').value = produto.fornecedor;
    document.getElementById('produto-custo').value = produto.custo.toFixed(2);
    document.getElementById('produto-picking').value = produto.picking.toFixed(2);
    document.getElementById('produto-peso').value = produto.peso.toFixed(2);
    document.getElementById('produto-comprimento').value = produto.comprimento;
    document.getElementById('produto-largura').value = produto.largura;
    document.getElementById('produto-altura').value = produto.altura;

    // Carrega as variações existentes
    produtoVariationsTemporario = [...(produto.variations || [])];
    renderizarVariacoes();

    const imgPreview = document.getElementById('produto-imagem-preview');
    if (produto.imagem) {
        imgPreview.src = produto.imagem;
        imgPreview.classList.remove('hidden');
    } else {
        imgPreview.classList.add('hidden');
    }
    document.getElementById('produto-imagem').value = '';

    document.getElementById('produto-form-titulo').innerHTML = `<span class="mr-2">✏️</span> Editando Produto`;
}


function limparFormularioProduto() {
    produtoEditId = null;
    document.getElementById('produto-form').reset();
    document.getElementById('produto-id-edit').value = '';

    Object.assign(document.getElementById('produto-custo'), {value: '0.00'});
    Object.assign(document.getElementById('produto-picking'), {value: '2.00'});
    // Object.assign(document.getElementById('produto-preco-venda'), {value: '0.00'}); // REMOVIDO
    Object.assign(document.getElementById('produto-peso'), {value: '0.00'});
    Object.assign(document.getElementById('produto-comprimento'), {value: '0'});
    Object.assign(document.getElementById('produto-largura'), {value: '0'});
    Object.assign(document.getElementById('produto-altura'), {value: '0'});

    // Limpa variações
    produtoVariationsTemporario = [];
    renderizarVariacoes();

    const imgPreview = document.getElementById('produto-imagem-preview');
    imgPreview.classList.add('hidden');
    imgPreview.src = '#';
    document.getElementById('produto-form-titulo').innerHTML = `<span class="mr-2">📦</span> Cadastrar Novo Produto`;
    document.querySelectorAll('#produto-form .border-red-500').forEach(el => el.classList.remove('border-red-500'));
}
// previewImagemProduto e excluirProduto/confirmarExclusaoProduto permanecem iguais
function previewImagemProduto(event) {
    const reader = new FileReader();
    const imgPreview = document.getElementById('produto-imagem-preview');
    reader.onload = function(){
        imgPreview.src = reader.result;
        imgPreview.classList.remove('hidden');
    };
    if (event.target.files[0]) {
        reader.readAsDataURL(event.target.files[0]);
    } else {
        imgPreview.classList.add('hidden');
        imgPreview.src = '#';
    }
}
function excluirProduto(id) {
    abrirModalConfirmacao(`Tem certeza que deseja excluir este produto e todas as suas variações? Kits que o utilizam também podem ser afetados.`, () => confirmarExclusaoProduto(id));
}
function confirmarExclusaoProduto(id) {
    produtos = produtos.filter(p => p.id !== id);
    salvarDados('produtos', produtos);

    let kitsAfetados = false;
    kits.forEach(kit => {
        const tamanhoOriginal = kit.produtos.length;
        // Remove o produto base ou qualquer uma de suas variações (precisa checar pelo id base)
        kit.produtos = kit.produtos.filter(p => p.id !== id); // Assumindo que produtos em kits guardam o ID original
        if(kit.produtos.length < tamanhoOriginal) {
            kitsAfetados = true;
            kit.custoTotal = kit.produtos.reduce((a, p) => a + p.custo + p.picking, 0);
        }
    });
    if(kitsAfetados) salvarDados('kits', kits);

    if(document.getElementById('catalogo-page')?.offsetParent !== null) aplicarFiltros();
    // REMOVIDO: if(document.getElementById('lojas-page')?.offsetParent !== null) renderizarProdutosLojas();
    if(document.getElementById('kits-page')?.offsetParent !== null) renderizarListaKits();

    mostrarNotificacao('Produto excluído com sucesso!', 'success');
    fecharModal();
}


// --- Catálogo ---
function carregarFiltrosCatalogo() {
    carregarFornecedoresSelect('filtro-fornecedor');
    // Considerar adicionar categorias de Kits se necessário
    const categoriasProdutos = [...new Set(produtos.map(p => p.categoria))];
    const categoriasKits = [...new Set(kits.map(k => k.categoria || "Kit"))]; // Define "Kit" como categoria padrão
    const categorias = [...new Set([...categoriasProdutos, ...categoriasKits])].sort();

    const filtroCategoria = document.getElementById('filtro-categoria');
    const valorAtual = filtroCategoria.value;
    filtroCategoria.innerHTML = '<option value="">Todas categorias</option>';
    categorias.forEach(c => {
        const option = document.createElement('option');
        option.value = c;
        option.textContent = c;
        filtroCategoria.appendChild(option);
    });
    filtroCategoria.value = valorAtual;
}

// ATUALIZADO: aplicarFiltros busca em Produtos e Kits
function aplicarFiltros() {
    const busca = document.getElementById('filtro-busca').value.toLowerCase();
    const categoria = document.getElementById('filtro-categoria').value;
    const fornecedor = document.getElementById('filtro-fornecedor').value; // Filtro de fornecedor se aplica mais a produtos

    // Filtra Produtos
    const produtosFiltrados = produtos.filter(p =>
        (!busca || p.nome.toLowerCase().includes(busca) || p.sku.toLowerCase().includes(busca) || (p.variations && p.variations.some(v => v.sku.toLowerCase().includes(busca)))) && // Busca no SKU principal e variações
        (!categoria || p.categoria === categoria) &&
        (!fornecedor || p.fornecedor === fornecedor)
    );

    // Filtra Kits (ignora fornecedor por enquanto)
    const kitsFiltrados = kits.filter(k =>
        (!busca || k.nome.toLowerCase().includes(busca) || `kit-${k.id}`.toLowerCase().includes(busca)) &&
        (!categoria || (k.categoria || "Kit") === categoria) // Usa "Kit" se não houver categoria definida
    );

    // Combina e renderiza
    const itensFiltrados = [...produtosFiltrados, ...kitsFiltrados];
    renderizarCatalogo(itensFiltrados);
}

function limparFiltros() {
    document.getElementById('filtro-busca').value = '';
    document.getElementById('filtro-categoria').value = '';
    document.getElementById('filtro-fornecedor').value = '';
    aplicarFiltros();
}

// ATUALIZADO: renderizarCatalogo exibe Produtos e Kits com novo formato
function renderizarCatalogo(itensParaMostrar) {
    const catalogoLista = document.getElementById('catalogo-lista');
    catalogoLista.innerHTML = ''; // Limpa a lista
    
    if (itensParaMostrar.length === 0) {
        catalogoLista.innerHTML = '<p class="text-gray-400 text-center col-span-full">Nenhum produto ou kit encontrado com esses filtros.</p>';
        return;
    }

    itensParaMostrar.sort((a, b) => a.nome.localeCompare(b.nome)); // Ordena alfabeticamente

    itensParaMostrar.forEach(item => {
        const isKit = !!item.produtos; // Verifica se é um kit (se tem a propriedade 'produtos')
        const id = item.id;
        const nome = item.nome;
        const imagem = item.imagem || 'https://via.placeholder.com/300';
        const sku = isKit ? `KIT-${item.id}` : item.sku;
        const categoria = item.categoria || (isKit ? 'Kit' : 'N/A');
        const fornecedor = isKit ? 'Múltiplos' : (item.fornecedor || 'N/A');
        const custoTotal = isKit ? item.custoTotal : (item.custo + item.picking);

        catalogoLista.innerHTML += `
            <div class="custom-card rounded-lg overflow-hidden flex flex-col">
                <img src="${imagem}" alt="${nome}" class="w-full h-48 object-cover" onerror="this.onerror=null; this.src='https://via.placeholder.com/300';">
                <div class="p-4 flex flex-col flex-grow">
                    <h4 class="font-bold text-white text-base mb-2 truncate">${isKit ? '🧩 ' : ''}${nome}</h4>
                    <div class="product-details mb-auto"> <p><span>SKU:</span> <strong>${sku}</strong></p>
                        <p><span>Categoria:</span> <strong>${categoria}</strong></p>
                        <p><span>Fornecedor:</span> <strong>${fornecedor}</strong></p>
                        <p><span>Custo Total:</span> <strong class="text-red-400">${formatarMoeda(custoTotal)}</strong></p>
                         ${isKit ? `<p><span>Itens no Kit:</span> <strong>${item.produtos.length}</strong></p>` : ''} 
                    </div>
                     <div class="product-actions mt-3"> 
                        ${isKit ?
                            `<button onclick="adicionarKitAoCarrinho(${id})" class="flex-1 bg-green-600 hover:bg-green-700 text-white">🛒</button>
                             <button onclick="editarKit(${id})" class="flex-1 custom-accent custom-accent-hover text-white">✏️</button>
                             <button onclick="excluirKit(${id})" class="flex-1 bg-red-600 hover:bg-red-700 text-white">🗑️</button>
                             <button disabled class="precificacao-btn opacity-50 cursor-not-allowed">💰</button>` // Botão desabilitado para Kits por enquanto
                            :
                            `<button onclick="adicionarAoCarrinho(${id})" class="flex-1 bg-green-600 hover:bg-green-700 text-white">🛒</button>
                             <button onclick="editarProduto(${id})" class="flex-1 custom-accent custom-accent-hover text-white">✏️</button>
                             <button onclick="excluirProduto(${id})" class="flex-1 bg-red-600 hover:bg-red-700 text-white">🗑️</button>
                             <button onclick="abrirModalPrecificacao(${id})" class="precificacao-btn">💰</button>`
                        }
                    </div>
                </div>
            </div>`;
    });
}


// --- Carrinho ---
// ... (código do Carrinho permanece o mesmo) ...
function abrirCarrinho() {
    document.getElementById('carrinho-painel').classList.add('show');
    document.getElementById('carrinho-overlay').classList.add('show');
}
function fecharCarrinho() {
    document.getElementById('carrinho-painel').classList.remove('show');
    document.getElementById('carrinho-overlay').classList.remove('show');
    document.getElementById('resumo-container').classList.add('hidden');
    document.getElementById('resumo-whatsapp').value = '';
    cotacaoAtual = null;
}
function renderizarCarrinho() {
    const listaItens = document.getElementById('carrinho-itens-lista');
    listaItens.innerHTML = '';
    if (carrinho.length === 0) {
        listaItens.innerHTML = '<p class="text-gray-400 text-center p-4 text-sm">Seu carrinho está vazio.</p>';
    } else {
        carrinho.forEach(item => {
            const subtotal = item.precoVenda * item.quantidade;
            // Adapta para pegar custo do produto ou kit
            const custoUnitario = item.isKit ? item.custo : (item.custo + item.picking);
            listaItens.innerHTML += `
                <div class="flex items-center gap-3 p-3 custom-card rounded-lg mb-3">
                    <img src="${item.imagem || (item.isKit ? 'https://via.placeholder.com/64/16213E/FFFFFF?text=KIT' : 'https://via.placeholder.com/64')}" alt="${item.nome}" class="w-12 h-12 object-cover rounded flex-shrink-0" onerror="this.src='https://via.placeholder.com/64';">
                    <div class="flex-1 min-w-0">
                        <p class="text-white font-semibold truncate text-sm">${item.nome}</p>
                        <p class="text-gray-400 text-xs">SKU: ${item.sku}</p>
                        <p class="text-gray-300 text-xs">Unit: ${formatarMoeda(item.precoVenda)}</p> /* Preço de venda do item/kit */
                        <p class="text-red-400 text-xs">Custo: ${formatarMoeda(custoUnitario)}</p> /* Custo do item/kit */
                    </div>
                    <div class="flex flex-col items-end">
                        <div class="flex items-center gap-1 mb-1">
                            <button onclick="mudarQuantidade(${item.id}, -1, ${item.isKit})" class="bg-gray-700 hover:bg-gray-600 w-6 h-6 rounded font-bold text-sm">-</button>
                            <span class="text-white w-6 text-center text-sm">${item.quantidade}</span>
                            <button onclick="mudarQuantidade(${item.id}, 1, ${item.isKit})" class="bg-gray-700 hover:bg-gray-600 w-6 h-6 rounded font-bold text-sm">+</button>
                        </div>
                        <p class="text-white font-bold text-sm">${formatarMoeda(subtotal)}</p>
                        <button onclick="removerDoCarrinho(${item.id}, ${item.isKit})" class="text-red-500 hover:text-red-400 text-xs mt-1">Remover</button>
                    </div>
                </div>`;
        });
    }
    document.getElementById('carrinho-contador').textContent = carrinho.reduce((acc, i) => acc + i.quantidade, 0);
    calcularTotais();
}
function mudarQuantidade(id, delta, isKit) {
    const idx = carrinho.findIndex(i => i.id === id && i.isKit === isKit);
    if (idx === -1) return;
    carrinho[idx].quantidade += delta;
    if (carrinho[idx].quantidade <= 0) {
        carrinho.splice(idx, 1);
    }
    salvarDados('carrinho', carrinho);
    renderizarCarrinho();
}
function removerDoCarrinho(id, isKit) {
    carrinho = carrinho.filter(i => !(i.id === id && i.isKit === isKit));
    salvarDados('carrinho', carrinho);
    renderizarCarrinho();
}
function limparCarrinho() {
    carrinho = [];
    salvarDados('carrinho', carrinho);
    renderizarCarrinho();
    document.getElementById('carrinho-descontos').value = '0';
    document.getElementById('carrinho-frete').value = '0';
    calcularTotais();
    mostrarNotificacao('Carrinho limpo!', 'success');
}
function calcularTotais() {
    const d = parseFloat(document.getElementById('carrinho-descontos').value) || 0;
    const f = parseFloat(document.getElementById('carrinho-frete').value) || 0;
    // O preço de venda usado no cálculo do subtotal deve ser definido (talvez venda direta padrão?)
    // Temporariamente, vamos usar o 'precoVenda' armazenado, que pode não ser o ideal para cotação.
    // O ideal seria pegar o preço calculado para WhatsApp/Direct no modal de precificação.
    const s = carrinho.reduce((a, i) => a + (i.precoVenda * i.quantidade), 0);
    const t = s - d + f;
    document.getElementById('total-subtotal').textContent = formatarMoeda(s);
    document.getElementById('total-descontos').textContent = `- ${formatarMoeda(d)}`;
    document.getElementById('total-frete').textContent = formatarMoeda(f);
    document.getElementById('total-geral').textContent = formatarMoeda(t);
}

function adicionarAoCarrinho(id) {
    const p = produtos.find(x => x.id === id);
    if (!p) return;

    // Busca o preço de "WhatsApp" (venda direta) que foi salvo no modal de precificação
    const precoSalvo = p.pricingConfig && p.pricingConfig.whatsapp 
        ? parseFloat(document.getElementById(`preco-final-whatsapp-${id}`)?.value) // Tenta pegar o valor calculado se o modal estiver aberto (não é o caso aqui)
        : null;

    // Se não achou config de whatsapp, usa um fallback
    const precoVendaCarrinho = (p.pricingConfig && p.pricingConfig.whatsapp)
        ? calcularPrecoFinal(p.custo + p.picking, p.pricingConfig.whatsapp, lojasConfig.whatsapp)
        : (p.precoVenda || (p.custo + p.picking + 10)); // Fallback: Custo + Picking + R$10

    const i = carrinho.find(item => item.id === id && !item.isKit);
    if (i) {
        i.quantidade++;
    } else {
        carrinho.push({ ...p, quantidade: 1, isKit: false, precoVenda: precoVendaCarrinho }); // Usa o preço definido
    }
    salvarDados('carrinho', carrinho);
    mostrarNotificacao(`${p.nome} adicionado ao carrinho!`, 'success');
    renderizarCarrinho();
    abrirCarrinho();
}

// Função auxiliar para calcular o preço final com base no lucro (usada pelo adicionarAoCarrinho)
function calcularPrecoFinal(custoTotalItem, lucroDesejado, cfg) {
    const subtotalParaCalculo = custoTotalItem + lucroDesejado + cfg.taxaFixa;
    const precoFinalCalculado = (cfg.comissao < 1) ? subtotalParaCalculo / (1 - cfg.comissao) : subtotalParaCalculo;
    return precoFinalCalculado;
}


// --- Cotações ---
// ... (código das Cotações permanece o mesmo) ...
function gerarResumoWhatsapp() {
    if (carrinho.length === 0) { mostrarNotificacao('Carrinho vazio!', 'error'); return; }
    const n = document.getElementById('cliente-nome').value.trim() || "Cliente";
    const w = formatarTelefone(document.getElementById('cliente-whatsapp').value);
    const c = document.getElementById('cliente-cidade').value.trim() || "N/I";
    const e = document.getElementById('cliente-estado').value.trim().toUpperCase() || "SP";
    const l = `${c}/${e}`;
    const v = parseInt(document.getElementById('cliente-validade').value);
    const dA = new Date();
    const dV = new Date(dA);
    dV.setDate(dA.getDate() + v);
    const nextId = (cotacoes.length > 0 ? Math.max(...cotacoes.map(c => c.idNumero)) : 0) + 1;
    const idF = `ORC-${String(nextId).padStart(4, '0')}`;
    calcularTotais();
    const sT = document.getElementById('total-subtotal').textContent;
    const dT = document.getElementById('total-descontos').textContent;
    const fT = document.getElementById('total-frete').textContent;
    const tT = document.getElementById('total-geral').textContent;
    let txt = `*ORÇAMENTO #${idF}* - ${formatarData(dA).split(',')[0]}\n_(Válido até ${formatarData(dV).split(',')[0]})_\n\n*Cliente:* ${n}\n*Contato:* ${w}\n*Local:* ${l}\n\n*Itens:*\n`;
    carrinho.forEach(i => { txt += ` • ${i.nome} (${i.sku}) - ${i.quantidade}x ${formatarMoeda(i.precoVenda)} = ${formatarMoeda(i.precoVenda*i.quantidade)}\n`; });
    txt += `\n*Totais:*\n • Produtos: ${sT}\n • Descontos: ${dT.replace('-','')}\n • Frete: ${fT}\n* • TOTAL: ${tT}*\n\n_Obs: Sujeito à disponibilidade._`;
    document.getElementById('resumo-whatsapp').value = txt;
    document.getElementById('resumo-container').classList.remove('hidden');
    // Armazena a cotação com os dados e itens atuais do carrinho
    cotacaoAtual = {
        id: idF, idNumero: nextId, dataGeracao: dA.toISOString(), dataValidade: dV.toISOString(),
        cliente: n, whatsapp: w, local: l,
        itens: carrinho.map(item => ({ // Salva informações essenciais dos itens
            id: item.id,
            sku: item.sku,
            nome: item.nome,
            quantidade: item.quantidade,
            precoVenda: item.precoVenda, // Preço usado na cotação
            custo: item.isKit ? item.custo : (item.custo + item.picking), // Custo total do item
            isKit: item.isKit
        })),
        subtotal: sT, descontos: dT, frete: fT, totalGeral: tT, status: 'Pendente'
    };
    mostrarNotificacao('Resumo para WhatsApp gerado!', 'success');
}
function copiarResumo() {
    const r = document.getElementById('resumo-whatsapp');
    r.select();
    if (navigator.clipboard) {
        navigator.clipboard.writeText(r.value).then(() => mostrarNotificacao('Resumo copiado!', 'success')).catch(() => mostrarNotificacao('Erro ao copiar.', 'error'));
    } else {
        try {
            document.execCommand('copy');
            mostrarNotificacao('Resumo copiado!', 'success');
        } catch (err) {
            mostrarNotificacao('Erro ao copiar.', 'error');
        }
    }
}
function salvarCotacao() {
    if (!cotacaoAtual) { mostrarNotificacao('Gere o resumo antes de salvar!', 'error'); return; }
    cotacoes.push(cotacaoAtual);
    salvarDados('cotacoes', cotacoes);
    mostrarNotificacao(`Cotação ${cotacaoAtual.id} salva com sucesso!`, 'success');
    limparCarrinho();
    document.getElementById('cliente-nome').value = '';
    document.getElementById('cliente-whatsapp').value = '';
    document.getElementById('cliente-cidade').value = '';
    document.getElementById('cliente-estado').value = '';
    document.getElementById('resumo-container').classList.add('hidden');
    document.getElementById('resumo-whatsapp').value = '';
    cotacaoAtual = null;
    fecharCarrinho();
    if (!document.getElementById('cotacoes-page')?.classList.contains('hidden')) renderizarCotacoes();
}
function renderizarCotacoes() {
    const cS = cotacoes;
    const t = cS.length;
    const p = cS.filter(c => c.status === 'Pendente').length;
    const cv = t - p;
    const tx = (t === 0) ? 0 : (cv / t) * 100;

    document.getElementById('stat-total').textContent = t;
    document.getElementById('stat-pendente').textContent = p;
    document.getElementById('stat-convertida').textContent = cv;
    document.getElementById('stat-taxa').textContent = `${tx.toFixed(0)}%`;

    const f = document.getElementById('filtro-status-cotacao').value;
    const lC = document.getElementById('lista-cotacoes');
    lC.innerHTML = '';
    const cF = (f === 'Todos') ? cS : cS.filter(c => c.status === f);

    if (cF.length === 0) {
        lC.innerHTML = '<p class="text-gray-400 text-center p-6 text-sm">📋 Nenhuma cotação encontrada para este status.</p>';
        return;
    }
    cF.slice().reverse().forEach(c => {
        const sC = c.status === 'Pendente' ? 'bg-yellow-500' : 'bg-green-500';
        lC.innerHTML += `
            <div class="custom-card rounded-lg p-4 hover:shadow-md transition-shadow duration-150">
                <div class="flex justify-between items-start mb-2">
                    <div class="mr-4">
                        <h4 class="text-base font-bold text-white mb-0.5">${c.id}</h4>
                        <p class="text-gray-300 text-xs">Cli: ${c.cliente || 'N/I'}</p>
                        <p class="text-gray-400 text-xs">Data: ${formatarData(new Date(c.dataGeracao))}</p>
                    </div>
                    <div class="text-right flex-shrink-0">
                        <span class="${sC} text-white px-2 py-0.5 rounded-full text-xs font-medium">${c.status}</span>
                        <p class="text-lg font-bold text-white mt-1">${c.totalGeral}</p>
                    </div>
                </div>
                <div class="flex flex-wrap gap-1.5 mt-2">
                    <button onclick="verDetalhesCotacao('${c.id}')" class="bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded text-xs">👁️</button>
                    ${c.status === 'Pendente' ? `<button onclick="alterarStatusCotacao('${c.id}', 'Convertida')" class="bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded text-xs">✅</button>` : ''}
                    ${c.status === 'Convertida' ? `<button onclick="alterarStatusCotacao('${c.id}', 'Pendente')" class="bg-yellow-600 hover:bg-yellow-700 text-white px-2 py-1 rounded text-xs">⏳</button>` : ''}
                    <button onclick="abrirModalConfirmacao('Tem certeza que deseja excluir a cotação ${c.id}?', () => confirmarExclusaoCotacao('${c.id}'))" class="bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded text-xs">🗑️</button>
                </div>
            </div>`;
    });
}
function alterarStatusCotacao(id, nS) {
    const idx = cotacoes.findIndex(c => c.id === id);
    if (idx === -1) return;
    cotacoes[idx].status = nS;
    salvarDados('cotacoes', cotacoes);
    renderizarCotacoes();
    if (!document.getElementById('dashboard-page')?.classList.contains('hidden')) calcularDashboard();
    mostrarNotificacao(`Status da cotação ${id} alterado para ${nS}!`, 'success');
}
function confirmarExclusaoCotacao(id) {
    cotacoes = cotacoes.filter(c => c.id !== id);
    salvarDados('cotacoes', cotacoes);
    renderizarCotacoes();
    if (!document.getElementById('dashboard-page')?.classList.contains('hidden')) calcularDashboard();
    mostrarNotificacao(`Cotação ${id} excluída!`, 'success');
    fecharModal();
}
function verDetalhesCotacao(id) {
    const c = cotacoes.find(x => x.id === id);
    if (!c) return;
    const dG = formatarData(new Date(c.dataGeracao));
    const dV = formatarData(new Date(c.dataValidade)).split(',')[0];
    let txt = `ORÇAMENTO #${c.id} – ${dG} (Válido até ${dV})\n\n`;
    txt += `Cliente: ${c.cliente || 'N/I'} – WhatsApp: ${c.whatsapp || 'N/I'}\nLocal: ${c.local || 'N/I'}\n\nItens:\n`;
    (c.itens || []).forEach(i => { // Adiciona verificação para c.itens
        txt += ` • ${i.nome} (${i.sku}) - ${i.quantidade}x ${formatarMoeda(i.precoVenda)} = ${formatarMoeda(i.precoVenda * i.quantidade)}\n`;
    });
    txt += `\nTotais:\n • Produtos: ${c.subtotal}\n • Descontos: ${c.descontos.replace('-','')}\n • Frete: ${c.frete}\n • TOTAL: ${c.totalGeral}\n\nStatus: ${c.status}`;
    abrirModalDetalhes("Detalhes Cotação " + c.id, txt);
}


// --- Kits ---
// ... (código dos Kits atualizado para remover Venda Direta e melhorar busca) ...
function inicializarPaginaKits() {
    carregarProdutosParaKitSelect();
    renderizarListaKits();
    document.getElementById('filtro-kits').addEventListener('input', renderizarListaKits);
}
// ATUALIZADO: Busca por Nome ou SKU
function carregarProdutosParaKitSelect(filtro = '') {
    const sel = document.getElementById('kit-produtos-select');
    const vAt = sel.value;
    sel.innerHTML = '<option value="">Selecione...</option>';
    const filtroLower = filtro.toLowerCase();
    const pF = produtos.filter(p => p.nome.toLowerCase().includes(filtroLower) || p.sku.toLowerCase().includes(filtroLower));
    pF.forEach(p => {
        const o = document.createElement('option');
        o.value = p.id;
        o.textContent = `${p.nome} (${p.sku})`;
        sel.appendChild(o);
    });
    sel.value = vAt;
}
function filtrarProdutosParaKit() {
    const f = document.getElementById('filtro-produtos-kit').value; // Não precisa toLowerCase aqui, carregarProdutos faz
    carregarProdutosParaKitSelect(f);
}
// Adicionar e Remover Produto do Kit (permanecem iguais)
function adicionarProdutoAoKit() {
    const sel = document.getElementById('kit-produtos-select');
    const pId = parseInt(sel.value);
    if (!pId) { mostrarNotificacao('Selecione um produto para adicionar!', 'error'); return; }
    const p = produtos.find(x => x.id === pId);
    if (!p) { mostrarNotificacao('Produto não encontrado!', 'error'); return; }
    if (kitProdutosTemporario.find(x => x.id === pId)) { mostrarNotificacao('Este produto já foi adicionado ao kit!', 'error'); return; }
    kitProdutosTemporario.push(p);
    renderizarProdutosDoKit();
    sel.value = '';
    mostrarNotificacao('Produto adicionado ao kit!', 'success');
    document.getElementById('filtro-produtos-kit').value = '';
    carregarProdutosParaKitSelect();
}
function renderizarProdutosDoKit() {
    const cont = document.getElementById('kit-produtos-lista');
    cont.innerHTML = '';
    let cT = 0;
    if (kitProdutosTemporario.length === 0) {
        cont.innerHTML = '<p class="text-gray-400 text-center text-xs">Nenhum produto adicionado.</p>';
    } else {
        kitProdutosTemporario.forEach(p => {
            cT += p.custo + p.picking;
            cont.innerHTML += `<div class="flex justify-between items-center p-1 bg-gray-700 rounded border border-gray-600 text-xs"><span class="truncate pr-2">${p.nome} (${p.sku})</span><button type="button" onclick="removerProdutoDoKit(${p.id})" class="text-red-400 hover:text-red-300 ml-1 p-0.5 text-xs">✕</button></div>`;
        });
    }
    document.getElementById('kit-custo-total').textContent = formatarMoeda(cT);
}
function removerProdutoDoKit(pId) {
    kitProdutosTemporario = kitProdutosTemporario.filter(p => p.id !== pId);
    renderizarProdutosDoKit();
    mostrarNotificacao('Produto removido do kit!', 'success');
}
// ATUALIZADO: handleSalvarKit não usa mais precoVenda
function handleSalvarKit(e) {
    e.preventDefault();
    const kId = document.getElementById('kit-id').value;
    const nK = document.getElementById('kit-nome').value.trim();
    // REMOVIDO: const pVK = parseFloat(document.getElementById('kit-preco-venda').value);

    if (!nK || kitProdutosTemporario.length === 0) {
        mostrarNotificacao('Preencha o nome e adicione pelo menos um produto ao kit!', 'error');
        return;
    }

    const cTK = kitProdutosTemporario.reduce((a, p) => a + p.custo + p.picking, 0);
    // REMOVIDO: precoVenda do objeto do Kit
    const nKi = { id: kId ? parseInt(kId) : Date.now(), nome: nK, produtos: [...kitProdutosTemporario], custoTotal: cTK, categoria: "Kit" }; // Adiciona categoria padrão

    if (kId) {
        const i = kits.findIndex(k => k.id === parseInt(kId));
        if (i !== -1) kits[i] = nKi;
    } else {
        kits.push(nKi);
    }

    salvarDados('kits', kits);
    limparFormularioKit();
    renderizarListaKits();
    mostrarNotificacao(kId ? 'Kit atualizado com sucesso!' : 'Kit salvo com sucesso!', 'success');
    // Atualiza catálogo se visível
     if(document.getElementById('catalogo-page')?.offsetParent !== null) aplicarFiltros();
}
// ATUALIZADO: limparFormularioKit não reseta precoVenda
function limparFormularioKit() {
    document.getElementById('kit-form').reset();
    document.getElementById('kit-id').value = '';
    // REMOVIDO: document.getElementById('kit-preco-venda').value = '0.00';
    document.getElementById('kit-form-titulo').innerHTML = '🧩 Novo Kit';
    kitProdutosTemporario = [];
    renderizarProdutosDoKit();
    document.getElementById('filtro-produtos-kit').value = '';
    carregarProdutosParaKitSelect();
}
// ATUALIZADO: renderizarListaKits não mostra precoVenda ou lucro direto
function renderizarListaKits() {
    const f = document.getElementById('filtro-kits').value.toLowerCase();
    const cont = document.getElementById('kits-lista-container');
    cont.innerHTML = '';
    const kF = kits.filter(k => k.nome.toLowerCase().includes(f));
    if (kF.length === 0) {
        cont.innerHTML = '<p class="text-gray-400 text-center py-10">Nenhum kit encontrado.</p>';
        return;
    }
    kF.forEach(k => {
        cont.innerHTML += `
            <div class="custom-card rounded-lg p-3">
                <div class="flex justify-between items-start mb-1.5">
                    <div class="flex-1 mr-3">
                        <h4 class="text-sm font-bold text-white mb-0.5 truncate">🧩 ${k.nome}</h4>
                        <p class="text-gray-400 text-xs">${k.produtos.length} produto(s)</p>
                    </div>
                    /* Removido Preço e Lucro Direto */
                </div>
                <div class="mb-2 p-1.5 bg-gray-800 rounded text-xs">
                     <p>Custo Total do Kit: ${formatarMoeda(k.custoTotal)}</p>
                </div>
                <div class="flex gap-1.5">
                    <button onclick="mostrarDetalhesKit(${k.id})" class="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded text-xs">👁️</button>
                    /* Adicionar Kit ao Carrinho pode precisar de um preço padrão ou abrir modal */
                    <button onclick="adicionarKitAoCarrinho(${k.id})" class="flex-1 bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded text-xs">🛒</button>
                    <button onclick="editarKit(${k.id})" class="flex-1 custom-accent custom-accent-hover text-white px-2 py-1 rounded text-xs">✏️</button>
                    <button onclick="excluirKit(${k.id})" class="flex-1 bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded text-xs">🗑️</button>
                     /* Botão de precificar Kit (desabilitado por enquanto) */
                     /* <button disabled class="flex-1 bg-gray-500 text-gray-300 px-2 py-1 rounded text-xs cursor-not-allowed">💰</button> */
                </div>
            </div>`;
    });
}
// ATUALIZADO: mostrarDetalhesKit não mostra Preço Direto
function mostrarDetalhesKit(id) {
    const k = kits.find(x => x.id === id);
    if (!k) return;
    let dH = `<p class="mb-3 text-sm"><strong>Custo Total do Kit:</strong> ${formatarMoeda(k.custoTotal)}</p>
              <strong class="block mb-1 text-sm">Produtos no Kit:</strong>
              <ul class="list-disc list-inside space-y-1 text-xs max-h-48 overflow-y-auto bg-gray-800 p-2 rounded">`;
    k.produtos.forEach(p => { dH += `<li>${p.nome} (${p.sku}) - Custo Unit: ${formatarMoeda(p.custo + p.picking)}</li>`; });
    dH += `</ul>`;
    abrirModalDetalhes(`Detalhes do Kit: ${k.nome}`, dH, true);
}
// ATUALIZADO: editarKit não preenche precoVenda
function editarKit(id) {
    const k = kits.find(x => x.id === id);
    if (!k) return;
    
    // 1. Navega para a página
    showPage('kits');
    
    // 2. Preenche os dados
    document.getElementById('kit-id').value = k.id;
    document.getElementById('kit-nome').value = k.nome;
    // REMOVIDO: document.getElementById('kit-preco-venda').value = k.precoVenda.toFixed(2);
    document.getElementById('kit-form-titulo').innerHTML = '✏️ Editando Kit';
    kitProdutosTemporario = [...k.produtos];
    renderizarProdutosDoKit();
}
// confirmarExclusaoKit permanece o mesmo
function excluirKit(id) {
    abrirModalConfirmacao(`Tem certeza que deseja excluir este kit?`, () => confirmarExclusaoKit(id));
}
function confirmarExclusaoKit(id) {
    kits = kits.filter(k => k.id !== id);
    salvarDados('kits', kits);
    renderizarListaKits(); // Atualiza lista na página Kits
    if(document.getElementById('catalogo-page')?.offsetParent !== null) aplicarFiltros(); // Atualiza catálogo
    fecharModal();
    mostrarNotificacao('Kit excluído com sucesso!', 'success');
}
// ATUALIZADO: adicionarKitAoCarrinho usa um preço temporário ou padrão
function adicionarKitAoCarrinho(id) {
    const k = kits.find(x => x.id === id);
    if (!k) { mostrarNotificacao('Kit não encontrado!', 'error'); return; }

    // Define um preço padrão para o carrinho (ex: Custo + R$20)
    // O ideal seria ter um campo no kit para "Preço Sugerido" ou buscar do modal
    const precoVendaCarrinho = k.custoTotal + 20.00;

    const i = carrinho.find(item => item.id === id && item.isKit);
    if (i) {
        i.quantidade++;
    } else {
        carrinho.push({
            id: k.id, sku: `KIT-${k.id}`, nome: `🧩 ${k.nome}`,
            categoria: 'Kit', fornecedor: 'Kit',
            custo: k.custoTotal, picking: 0, // Custo já inclui picking
            precoVenda: precoVendaCarrinho, // Usa o preço definido acima
            peso: k.produtos.reduce((a, p) => a + p.peso, 0),
            comprimento: 0, largura: 0, altura: 0,
            imagem: null,
            quantidade: 1, isKit: true
        });
    }
    salvarDados('carrinho', carrinho);
    mostrarNotificacao(`Kit ${k.nome} adicionado ao carrinho!`, 'success');
    renderizarCarrinho();
    abrirCarrinho();
}


// --- Marketing/Cupons ---
// ... (código dos Cupons permanece o mesmo) ...
function inicializarPaginaMarketing() {
    renderizarListaCupons();
    atualizarEstatisticasCupons();
    document.getElementById('filtro-cupons').addEventListener('input', renderizarListaCupons);
}
function salvarCupom(e) {
    e.preventDefault();
    const cId = document.getElementById('cupom-id').value;
    const cod = document.getElementById('cupom-codigo').value.trim().toUpperCase();
    const tip = document.getElementById('cupom-tipo').value;
    const val = parseFloat(document.getElementById('cupom-valor').value);
    const lim = parseInt(document.getElementById('cupom-usos').value) || 0;
    const act = document.getElementById('cupom-ativo').checked;
    if (!cod || !tip || !val || val <= 0) { mostrarNotificacao('Verifique os campos obrigatórios (Código, Tipo, Valor > 0)!', 'error'); return; }
    const cEx = cupons.find(c => c.codigo === cod && c.id !== (cId ? parseInt(cId) : null));
    if (cEx) { mostrarNotificacao('Este código de cupom já está em uso!', 'error'); return; }
    let uA = 0;
    if (cId) {
        const cA = cupons.find(c => c.id === parseInt(cId));
        uA = cA ? cA.usosAtuais : 0;
    }
    const cup = { id: cId ? parseInt(cId) : Date.now(), codigo: cod, tipo: tip, valor: val, limitUsos: lim, usosAtuais: uA, ativo: act, dataCriacao: cId ? cupons.find(c => c.id === parseInt(cId))?.dataCriacao : new Date().toISOString() };
    if (cId) {
        const i = cupons.findIndex(c => c.id === parseInt(cId));
        if (i !== -1) cupons[i] = cup;
    } else {
        cupons.push(cup);
    }
    salvarDados('cupons', cupons);
    limparFormularioCupom();
    renderizarListaCupons();
    atualizarEstatisticasCupons();
    mostrarNotificacao(cId ? 'Cupom atualizado com sucesso!' : 'Cupom criado com sucesso!', 'success');
}
function limparFormularioCupom() {
    document.getElementById('cupom-form').reset();
    document.getElementById('cupom-id').value = '';
    document.getElementById('cupom-ativo').checked = true;
    document.getElementById('cupom-usos').value = '0';
    document.getElementById('cupom-form-titulo').innerHTML = '🎫 Novo Cupom';
}
function renderizarListaCupons() {
    const f = document.getElementById('filtro-cupons').value.toLowerCase();
    const cont = document.getElementById('lista-cupons');
    cont.innerHTML = '';
    const cF = cupons.filter(c => c.codigo.toLowerCase().includes(f));
    if (cF.length === 0) {
        cont.innerHTML = '<p class="text-gray-400 text-center py-10 text-sm">🎫 Nenhum cupom encontrado.</p>';
        return;
    }
    cF.forEach(c => {
        const sC = c.ativo ? 'bg-green-500' : 'bg-gray-500';
        const sT = c.ativo ? 'Ativo' : 'Inativo';
        const vF = c.tipo === 'fixo' ? formatarMoeda(c.valor) : `${c.valor.toFixed(2)}%`;
        const uE = c.limitUsos > 0 && c.usosAtuais >= c.limitUsos;
        const lT = c.limitUsos === 0 ? `(${c.usosAtuais})` : `(${c.usosAtuais}/${c.limitUsos})`;
        const uC = uE ? 'text-red-400' : 'text-white';
        cont.innerHTML += `
            <div class="custom-card rounded-lg p-3 flex justify-between items-center text-sm">
                <div class="flex-1">
                    <div class="flex items-center gap-2 mb-1">
                        <h4 class="font-bold text-white">${c.codigo}</h4>
                        <span class="${sC} text-white px-2 py-0.5 rounded-full text-xs">${sT}</span>
                    </div>
                    <p class="text-gray-300">Desconto: <span class="font-semibold">${vF}</span></p>
                    <p class="text-gray-300">Usos: <span class="${uC} font-semibold">${lT}</span> ${c.limitUsos === 0 ? 'Ilimitados' : ''}</p>
                </div>
                <div class="flex flex-col sm:flex-row gap-1 ml-2">
                    <button onclick="registrarUsoCupom(${c.id})" class="bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded text-xs ${uE || !c.ativo ? 'opacity-50 cursor-not-allowed' : ''}" ${uE || !c.ativo ? 'disabled' : ''}>+1 Uso</button>
                    <button onclick="editarCupom(${c.id})" class="custom-accent custom-accent-hover text-white px-2 py-1 rounded text-xs">✏️</button>
                    <button onclick="excluirCupom(${c.id})" class="bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded text-xs">🗑️</button>
                </div>
            </div>`;
    });
}
function registrarUsoCupom(id) {
    const i = cupons.findIndex(c => c.id === id);
    if (i === -1 || !cupons[i].ativo) return;
    if (cupons[i].limitUsos > 0 && cupons[i].usosAtuais >= cupons[i].limitUsos) {
        mostrarNotificacao(`Limite de usos para o cupom ${cupons[i].codigo} já foi atingido!`, 'error');
        return;
    }
    cupons[i].usosAtuais++;
    salvarDados('cupons', cupons);
    renderizarListaCupons();
    atualizarEstatisticasCupons();
    mostrarNotificacao(`Uso registrado para ${cupons[i].codigo}`, 'success');
}
function atualizarEstatisticasCupons() {
    const tC = cupons.length;
    const cF = cupons.filter(c => c.tipo === 'fixo').length;
    const cP = tC - cF;
    const tU = cupons.reduce((a, c) => a + c.usosAtuais, 0);
    document.getElementById('stat-cupom-total').textContent = tC;
    document.getElementById('stat-cupom-fixo').textContent = cF;
    document.getElementById('stat-cupom-percentual').textContent = cP;
    document.getElementById('stat-cupom-usos').textContent = tU;
}
function editarCupom(id) {
    const c = cupons.find(x => x.id === id);
    if (!c) return;
    document.getElementById('cupom-id').value = c.id;
    document.getElementById('cupom-codigo').value = c.codigo;
    document.getElementById('cupom-tipo').value = c.tipo;
    document.getElementById('cupom-valor').value = c.valor;
    document.getElementById('cupom-usos').value = c.limitUsos;
    document.getElementById('cupom-ativo').checked = c.ativo;
    document.getElementById('cupom-form-titulo').innerHTML = '✏️ Editando Cupom';
    showPage('marketing');
}
function excluirCupom(id) {
    abrirModalConfirmacao(`Tem certeza que deseja excluir este cupom?`, () => confirmarExclusaoCupom(id));
}
function confirmarExclusaoCupom(id) {
    cupons = cupons.filter(c => c.id !== id);
    salvarDados('cupons', cupons);
    renderizarListaCupons();
    atualizarEstatisticasCupons();
    fecharModal();
    mostrarNotificacao('Cupom excluído com sucesso!', 'success');
}

// --- Financeiro ---
// ... (código Financeiro - calcularEstatisticasFinanceiras - permanece o mesmo) ...
function calcularEstatisticasFinanceiras() {
    const cC = cotacoes.filter(c => c.status === 'Convertida');
    const h = new Date();
    const iD = new Date(h.getFullYear(), h.getMonth(), h.getDate());
    const iM = new Date(h.getFullYear(), h.getMonth(), 1);
    const vH = cC.filter(c => new Date(c.dataGeracao) >= iD).reduce((a, c) => a + (parseFloat(c.totalGeral.replace(/[^0-9,-]+/g,"").replace(",",".")) || 0), 0);
    const vM = cC.filter(c => new Date(c.dataGeracao) >= iM).reduce((a, c) => a + (parseFloat(c.totalGeral.replace(/[^0-9,-]+/g,"").replace(",",".")) || 0), 0);
    let lT = 0;
    cC.forEach(ct => {
        (ct.itens || []).forEach(it => { // Adiciona verificação para ct.itens
            const cI = it.custo || 0; // Usa o custo salvo na cotação
            lT += (it.precoVenda - cI) * it.quantidade;
        });
        lT += (parseFloat(ct.frete.replace(/[^0-9,-]+/g,"").replace(",",".")) || 0);
        lT -= (parseFloat(ct.descontos.replace(/[^0-9,-]+/g,"").replace(",",".")) || 0);
    });
    document.getElementById('financeiro-vendas-hoje').textContent = formatarMoeda(vH);
    document.getElementById('financeiro-vendas-mes').textContent = formatarMoeda(vM);
    document.getElementById('financeiro-lucro-total').textContent = formatarMoeda(lT);
}
// Placeholder Funções Financeiro/Marketing
function gerarRelatorio(tipo) { mostrarNotificacao(`Função: Gerar Relatório de ${tipo} (Ainda não implementado)`, 'info'); }
function definirMetas() { mostrarNotificacao(`Função: Definir Metas (Ainda não implementado)`, 'info'); }
function iniciarFechamentoMensal() { mostrarNotificacao(`Função: Iniciar Fechamento Mensal (Ainda não implementado)`, 'info'); }
function verCampanhas() { mostrarNotificacao(`Função: Ver Campanhas (Ainda não implementado)`, 'info'); }


// --- Auxiliares ---
// ... (código Auxiliares permanece o mesmo) ...
function formatarMoeda(valor) {
    return (valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function formatarData(data) {
    if(!data || !(data instanceof Date)) return '-';
    return data.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function formatarTelefone(tel) {
    if (!tel) return "N/I";
    return tel.replace(/\D/g,'');
}

// --- Modais ---
// ... (código Modais genéricos permanece o mesmo) ...
function abrirModalConfirmacao(msg, callback) {
    fecharModal();
    fecharModalPrecificacao();
    const m = document.createElement('div');
    m.id = 'modal-confirmacao';
    m.className = 'fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[1060] p-4';
    m.innerHTML = `
        <div class="custom-card rounded-lg p-6 max-w-xs w-full mx-auto">
            <h3 class="text-base font-bold text-white mb-3">Confirmação</h3>
            <p class="text-gray-300 mb-5 text-sm">${msg}</p>
            <div class="flex gap-2">
                <button id="modal-confirmar-btn" class="flex-1 bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded font-medium text-xs">Confirmar</button>
                <button type="button" onclick="fecharModal()" class="flex-1 bg-gray-600 hover:bg-gray-700 text-white px-3 py-1.5 rounded font-medium text-xs">Cancelar</button>
            </div>
        </div>`;
    document.body.appendChild(m);
    document.getElementById('modal-confirmar-btn').onclick = callback;
    modalAtual = m;
}
function abrirModalDetalhes(titulo, conteudo, html = false) {
    fecharModal();
    fecharModalPrecificacao();
    const m = document.createElement('div');
    m.id = 'modal-detalhes';
    m.className = 'fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[1060] p-4';
    const cCont = document.createElement('div');
    cCont.className = "w-full max-h-[60vh] overflow-y-auto p-3 bg-gray-800 border border-gray-600 rounded text-gray-200 text-xs whitespace-pre-wrap";
    if (html) cCont.innerHTML = conteudo;
    else cCont.textContent = conteudo;
    m.innerHTML = `
        <div class="custom-card rounded-lg p-5 max-w-md w-full mx-auto flex flex-col">
            <div class="flex justify-between items-center mb-3">
                <h3 class="text-base font-bold text-white">${titulo}</h3>
                <button type="button" onclick="fecharModal()" class="text-gray-400 hover:text-white text-2xl">&times;</button>
            </div>
            ${cCont.outerHTML}
            <div class="flex gap-3 mt-3">
                <button type="button" onclick="fecharModal()" class="flex-1 custom-accent custom-accent-hover text-white px-3 py-1.5 rounded font-medium text-xs">Fechar</button>
            </div>
        </div>`;
    document.body.appendChild(m);
    modalAtual = m;
}
function fecharModal() {
    if (modalAtual) {
        modalAtual.remove();
        modalAtual = null;
    }
}


// --- Funções do Modal de Precificação ---

function abrirModalPrecificacao(produtoId) {
    fecharModal();
    fecharModalPrecificacao();

    const produto = produtos.find(p => p.id === produtoId);
    const item = produto; // Usaremos 'item' genericamente

    if (!item) {
        mostrarNotificacao('Item não encontrado para precificação.', 'error');
        return;
    }
    const isKit = !produto; // Define se é kit (sempre false por enquanto)
    const custoTotalItem = isKit ? item.custoTotal : (item.custo + item.picking);
    const idBase = item.id;

    // ===== INÍCIO DA CORREÇÃO 2.1 (Salvar Precificação) =====
    const savedPricing = item.pricingConfig || {}; // Garante que é um objeto
    // ===== FIM DA CORREÇÃO 2.1 =====

    const overlay = document.createElement('div');
    overlay.id = 'modal-precificacao-overlay';
    overlay.className = 'modal-precificacao-overlay';

    let modalHTML = `
        <div class="modal-precificacao" id="modal-precificacao-${idBase}">
            <div class="modal-precificacao-header">
                <h3 class="modal-precificacao-title" title="Precificação: ${item.nome}">Precificação: ${isKit ? '🧩 ' : ''}${item.nome}</h3>
                <button type="button" class="modal-precificacao-close-btn" onclick="fecharModalPrecificacao()">&times;</button>
            </div>
            <div class="modal-precificacao-content">
                <div class="modal-product-header">
                    <img src="${isKit ? 'https://via.placeholder.com/80/16213E/FFFFFF?text=KIT' : (item.imagem || 'https://via.placeholder.com/80')}" alt="${item.nome}" class="modal-product-image" onerror="this.src='https://via.placeholder.com/80';">
                    <div class="modal-product-info">
                        <p><span>SKU:</span> <strong>${isKit ? `KIT-${item.id}` : item.sku}</strong></p>
                        <p><span>Custo Total:</span> <strong class="text-red-400">${formatarMoeda(custoTotalItem)}</strong></p>
                         ${isKit ? `<p><span>Itens no Kit:</span> <strong>${item.produtos.length}</strong></p>` : ''}
                    </div>
                </div>

                <h4 class="text-center text-sm font-semibold text-gray-400 mb-4 uppercase tracking-wider">Precificação por Marketplace</h4>
    `;

    Object.keys(lojasConfig).forEach(key => {
        const loja = lojasConfig[key];
        const idLoja = `${key}-${idBase}`;

        // ===== INÍCIO DA CORREÇÃO 2.2 (Salvar Precificação) =====
        // Busca o lucro salvo; se não existir, usa 10.00 como padrão
        const lucroSalvo = (savedPricing[key] !== undefined) ? savedPricing[key].toFixed(2) : "10.00";
        // ===== FIM DA CORREÇÃO 2.2 =====

        modalHTML += `
            <div class="modal-store-card">
                <div class="store-card-header">
                    <div class="store-info">
                        <img src="assets/logos/${loja.logo}" alt="${loja.nome}" class="store-logo" onerror="this.onerror=null; this.src='https://via.placeholder.com/24/0F172A/94a3b8?text=${loja.nome[0]}';">
                        <span class="store-name">${loja.nome}</span>
                    </div>
                    <span class="store-config">${(loja.comissao * 100).toFixed(1)}% + ${formatarMoeda(loja.taxaFixa)}</span>
                </div>
                <div class="store-pricing-body">
                    <div class="store-pricing-row">
                        <label for="lucro-desejado-${idLoja}" class="store-pricing-label">Lucro Desejado (R$):</label>
                        <input type="number" step="0.01" value="${lucroSalvo}" id="lucro-desejado-${idLoja}" class="store-input" oninput="calcularPrecoLojaModal('${key}', ${idBase}, 'lucro_loja', ${isKit})">
                        </div>
                     <div class="store-pricing-row ideal-price-row">
                        <span class="store-pricing-label">Preço Ideal Sugerido:</span>
                        <span class="store-pricing-value" id="preco-ideal-${idLoja}">R$ 0,00</span>
                    </div>
                    <div class="store-pricing-row">
                        <span class="store-pricing-label">↳ Comissão (${(loja.comissao * 100).toFixed(1)}%):</span>
                        <span class="store-pricing-value store-pricing-detail" id="comissao-valor-${idLoja}">R$ 0,00</span>
                    </div>
                    <div class="store-pricing-row">
                        <span class="store-pricing-label">↳ Taxa Fixa:</span>
                        <span class="store-pricing-value store-pricing-detail" id="taxa-fixa-valor-${idLoja}">R$ 0,00</span>
                    </div>
                    
                    <div class="store-pricing-row final-price-row">
                         <label for="preco-final-${idLoja}" class="store-pricing-label">Preço Final (R$):</label>
                        <input type="number" step="0.01" value="0.00" id="preco-final-${idLoja}" class="store-input bg-gray-600" readonly>
                    </div>
                    <div class="store-pricing-row final-result-row">
                        <span class="store-pricing-label">↳ Lucro Real (Margem):</span>
                        <span class="store-pricing-value">
                            <span id="lucro-real-${idLoja}">R$ 0,00</span> (<span id="margem-real-${idLoja}">0,0%</span>)
                        </span>
                    </div>
                </div>
            </div>`;
    });

    modalHTML += `
            </div>
            <div class="modal-precificacao-footer" style="display: flex; justify-content: flex-end; gap: 0.75rem;">
                <button type="button" class="modal-close-button" onclick="fecharModalPrecificacao()">Cancelar</button>
                <button type="button" class="modal-close-button" onclick="salvarPrecificacaoModal(${idBase}, ${isKit})" style="background-color: var(--modal-accent); border-color: var(--modal-accent);" onmouseover="this.style.backgroundColor='#6B46C1'" onmouseout="this.style.backgroundColor='var(--modal-accent)'">💾 Salvar e Fechar</button>
            </div>
            </div>
    `;

    overlay.innerHTML = modalHTML;
    document.body.appendChild(overlay);

    setTimeout(() => overlay.classList.add('show'), 10);
    modalPrecificacaoAberto = true;

    Object.keys(lojasConfig).forEach(key => {
        calcularPrecoLojaModal(key, idBase, 'init', isKit); // Passa isKit
    });
}

function fecharModalPrecificacao() {
    const overlay = document.getElementById('modal-precificacao-overlay');
    if (overlay) {
        overlay.classList.remove('show');
        setTimeout(() => {
             if (overlay) overlay.remove();
             modalPrecificacaoAberto = false;
         }, 300);
    } else {
        modalPrecificacaoAberto = false;
    }
}

// ===== INÍCIO DA CORREÇÃO 2.5 (Salvar Precificação) =====
// Nova função para salvar os dados do modal
function salvarPrecificacaoModal(itemId, isKit) {
    const item = isKit ? kits.find(k => k.id === itemId) : produtos.find(p => p.id === itemId);
    if (!item) {
        mostrarNotificacao('Erro: Item não encontrado para salvar.', 'error');
        return;
    }

    if (isKit) {
        // Salvamento de precificação de kit não é suportado ainda
        mostrarNotificacao('Salvamento de precificação de kit ainda não implementado.', 'info');
        fecharModalPrecificacao();
        return;
    }

    if (!item.pricingConfig) {
        item.pricingConfig = {}; // Inicializa o objeto se não existir
    }

    let alteracoesFeitas = false;

    Object.keys(lojasConfig).forEach(key => {
        const idLoja = `${key}-${itemId}`;
        const lucroDesejadoInput = document.getElementById(`lucro-desejado-${idLoja}`);
        
        if (lucroDesejadoInput) {
            const lucroDesejado = parseFloat(lucroDesejadoInput.value);
            if (!isNaN(lucroDesejado)) {
                item.pricingConfig[key] = lucroDesejado;
                alteracoesFeitas = true;
            }
        }
    });

    if (alteracoesFeitas) {
        // Encontra o índice do produto para salvar a array inteira
        const produtoIndex = produtos.findIndex(p => p.id === itemId);
        if (produtoIndex !== -1) {
            produtos[produtoIndex] = item; // Atualiza o item no array
            salvarDados('produtos', produtos); // Salva a array 'produtos' inteira
            mostrarNotificacao('Configurações de precificação salvas!', 'success');
        } else {
            mostrarNotificacao('Erro ao encontrar produto para salvar.', 'error');
        }
    } else {
        // Nenhuma notificação se nada mudou
    }

    fecharModalPrecificacao(); // Fecha o modal após salvar
}
// ===== FIM DA CORREÇÃO 2.5 =====


function calcularPrecoLojaModal(lojaKey, itemId, trigger, isKit) {
    // O cálculo agora sempre flui do "Lucro Desejado"
    
    const item = isKit ? kits.find(k => k.id === itemId) : produtos.find(p => p.id === itemId);
    if (!item) return;

    const cfg = lojasConfig[lojaKey];
    const idLoja = `${lojaKey}-${itemId}`;

    // 1. Encontrar elementos
    const lucroDesejadoInput = document.getElementById(`lucro-desejado-${idLoja}`);
    const precoFinalInput = document.getElementById(`preco-final-${idLoja}`);
    const precoIdealSpan = document.getElementById(`preco-ideal-${idLoja}`);
    const comissaoValorSpan = document.getElementById(`comissao-valor-${idLoja}`);
    const taxaFixaValorSpan = document.getElementById(`taxa-fixa-valor-${idLoja}`);
    const lucroRealSpan = document.getElementById(`lucro-real-${idLoja}`); 
    const margemRealSpan = document.getElementById(`margem-real-${idLoja}`); 

    if (!lucroDesejadoInput || !precoFinalInput || !precoIdealSpan || !comissaoValorSpan || !taxaFixaValorSpan || !lucroRealSpan || !margemRealSpan) {
        console.error(`Erro: Elementos não encontrados no modal para loja ${lojaKey}, item ${itemId}`);
        return;
    }

    // 2. Obter Valores
    const custoTotalItem = isKit ? item.custoTotal : (item.custo + item.picking);
    const lucroDesejado = parseFloat(lucroDesejadoInput.value) || 0;

    // 3. Calcular Preço Ideal (que será o Preço Final)
    const subtotalParaCalculo = custoTotalItem + lucroDesejado + cfg.taxaFixa;
    const precoFinalCalculado = (cfg.comissao < 1) ? subtotalParaCalculo / (1 - cfg.comissao) : subtotalParaCalculo;

    // 4. Calcular Taxas sobre o Preço Final
    const comissaoValor = precoFinalCalculado * cfg.comissao;
    const taxaFixaValor = cfg.taxaFixa;

    // 5. Calcular Lucro/Margem Reais com base no Preço Final Calculado
    // (Isto é uma verificação, o lucro real deve ser muito próximo do 'lucroDesejado')
    const receitaLiquida = precoFinalCalculado - comissaoValor - cfg.taxaFixa;
    const lucroReal = receitaLiquida - custoTotalItem; 
    const margemReal = (precoFinalCalculado > 0) ? (lucroReal / precoFinalCalculado * 100) : 0;

    // 6. Atualizar Spans e Inputs
    precoIdealSpan.textContent = formatarMoeda(precoFinalCalculado); // Preço Ideal é o Preço Final
    comissaoValorSpan.textContent = formatarMoeda(comissaoValor);
    taxaFixaValorSpan.textContent = formatarMoeda(taxaFixaValor);
    
    // Atualiza o input 'Preço Final' que agora é readonly
    precoFinalInput.value = precoFinalCalculado.toFixed(2);

    // 7. Atualizar Spans de Lucro/Margem Reais
    const lucroRealFormatado = formatarMoeda(lucroReal);
    const margemRealFormatada = `${margemReal.toFixed(1).replace('.', ',')}%`;

    lucroRealSpan.textContent = lucroRealFormatado;
    margemRealSpan.textContent = margemRealFormatada;

    // 8. Aplicar classes de cor
    const parentSpan = lucroRealSpan.parentElement; // Pega o <span> pai
    parentSpan.classList.remove('profit-positive', 'profit-negative');
    if (lucroReal > 0) {
        parentSpan.classList.add('profit-positive');
    } else if (lucroReal < 0) {
        parentSpan.classList.add('profit-negative');
    }
}


// --- Sistema de Notificações ---
// ... (código das Notificações permanece o mesmo) ...
function mostrarNotificacao(msg, tipo = 'success') {
    const el = document.getElementById('notification');
    const txt = document.getElementById('notification-text');
    if (!el || !txt) return;

    txt.textContent = msg;
    el.className = 'notification px-4 py-2 rounded-md shadow-lg text-sm font-medium';

    if (tipo === 'success') el.classList.add('bg-green-600', 'text-white');
    else if (tipo === 'error') el.classList.add('bg-red-600', 'text-white');
    else if (tipo === 'info') el.classList.add('bg-blue-600', 'text-white'); // Adicionado tipo info
    else el.classList.add('bg-gray-700', 'text-white'); // Padrão genérico

    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 3000);
}