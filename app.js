'use strict';

  /* Flag de debug — ligue para ver logs no console (window.__ANGATUBA_DEBUG = true) */
  const DEBUG = (typeof window !== 'undefined' && window.__ANGATUBA_DEBUG === true);

  /* ══════════════════════════════════════════════════════════════
     CATEGORIAS
  ══════════════════════════════════════════════════════════════ */
  /* ══════════════════════════════════════════════════════════════
     CAT_DEF — FONTE ÚNICA DE CATEGORIAS
     Cada item gera: (1) chip de filtro em CATEGORIAS  (se filtro:true)
                     (2) opção no combobox de cadastro em RAMOS (se cadastro:true)
     Para criar categoria nova: adicione UM item aqui. Nada mais a sincronizar.
     Campos: id · chipLabel(filtro) · ramoLabel(cadastro) · emoji · icon · cor · bg · grupo · busca[]
  ══════════════════════════════════════════════════════════════ */
  const CAT_DEF = [
    // ── Alimentação e Bebidas ──
    { id:'pizzaria', chipLabel:'Pizzarias', ramoLabel:'Pizzaria', emoji:'🍕', icon:'ti-pizza', cor:'#f59e0b', bg:'rgba(245,158,11,0.12)',
      cadastro:true, filtro:true, busca:['pizza','pizzaria','pizzaiolo'] },
    { id:'lanches', chipLabel:'Lanches', ramoLabel:'Lanches / Hamburgueria', emoji:'🍔', icon:'ti-burger', cor:'#00d084', bg:'rgba(0,208,132,0.12)',
      cadastro:true, filtro:true, busca:['lanche','hamburger','hamburguer','lanchonete','pastelaria','hot dog','hotdog','sanduiche'] },
    { id:'restaurante', chipLabel:'Restaurante', ramoLabel:'Restaurante / Lanchonete', emoji:'🍽️', icon:'ti-tools-kitchen-2', cor:'#fb923c', bg:'rgba(251,146,60,0.12)',
      cadastro:true, filtro:true, busca:['restaurante','lanchonete','refeicao','refeição','almoço','almoco','jantar','comida','self service','buffet','prato feito'] },
    { id:'marmita', chipLabel:'Marmitaria', ramoLabel:'Marmitaria / Comida Caseira', emoji:'🍱', icon:'ti-bowl', cor:'#facc15', bg:'rgba(250,204,21,0.12)',
      cadastro:true, filtro:true, busca:['marmita','marmitaria','comida caseira','genova','quentinha','rancho','almoço','almoco','quentinha','porção'] },
    { id:'doceria', chipLabel:'Doceria', ramoLabel:'Doceria / Confeitaria', emoji:'🎂', icon:'ti-cake', cor:'#f9a8d4', bg:'rgba(249,168,212,0.12)',
      cadastro:true, filtro:true, busca:['doceria','confeitaria','doce','bolo','brigadeiro','cake','torta','sobremesa','doces finos','bem casado'] },
    { id:'sorveteria', chipLabel:'Sorveteria', ramoLabel:'Sorveteria / Açaí', emoji:'🍦', icon:'ti-ice-cream', cor:'#67e8f9', bg:'rgba(103,232,249,0.12)',
      cadastro:true, filtro:true, busca:['sorvete','sorveteria','acai','açaí','gelato','milkshake','shake'] },
    { id:'padaria', chipLabel:'Padaria', ramoLabel:'Padaria / Pão de Queijo', emoji:'🥐', icon:'ti-bread', cor:'#d4a373', bg:'rgba(212,163,115,0.12)',
      cadastro:true, filtro:true, busca:['padaria','panificadora','pao','pão','panificio','padeiro','cafe da manha','café da manhã'] },
    { id:'cafeteria', chipLabel:'Cafeteria', ramoLabel:'Cafeteria / Café', emoji:'☕', icon:'ti-coffee', cor:'#a16207', bg:'rgba(161,98,7,0.16)',
      cadastro:true, filtro:true, busca:['cafe','café','cafeteria','cappuccino','espresso','coffee','lancheria'] },
    { id:'japonesa', chipLabel:'Culinária Japonesa', ramoLabel:'Culinária Japonesa / Sushi', emoji:'🍣', icon:'ti-bowl-chopsticks', cor:'#ef4444', bg:'rgba(239,68,68,0.12)',
      cadastro:true, filtro:true, busca:['japones','japonesa','sushi','temaki','hashi','oriental','yakisoba','lamen','ramen'] },
    { id:'italiana', chipLabel:'Culinária Italiana', ramoLabel:'Culinária Italiana / Massas', emoji:'🍝', icon:'ti-bowl-spoon', cor:'#84cc16', bg:'rgba(132,204,22,0.12)',
      cadastro:true, filtro:true, busca:['italiana','massas','massa','macarrao','macarrão','lasanha','nhoque','ravioli','espaguete','pasta'] },
    { id:'saudavel', chipLabel:'Alimentação Saudável', ramoLabel:'Alimentação Saudável / Vegano', emoji:'🥗', icon:'ti-salad', cor:'#4ade80', bg:'rgba(74,222,128,0.12)',
      cadastro:true, filtro:true, busca:['saudavel','saudável','vegano','vegetariano','fit','detox','salada','organico','orgânico','natural'] },
    { id:'adega', chipLabel:'Adegas', ramoLabel:'Adega / Bebidas', emoji:'🍺', icon:'ti-bottle', cor:'#a78bfa', bg:'rgba(167,139,250,0.12)',
      cadastro:true, filtro:true, busca:['adega','bebida','bar','distribuidora','cerveja','drinks','bebidas'] },
    { id:'carnes', chipLabel:'Carnes/Grill', ramoLabel:'Steakhouse / Casa de Carnes', emoji:'🥩', icon:'ti-meat', cor:'#ef4444', bg:'rgba(239,68,68,0.12)',
      cadastro:true, filtro:true, busca:['churrascaria','steakhouse','carnes','churrasco','açougue','acougue','grill'] },
    // ── Saúde, Beleza e Bem-Estar ──
    { id:'farmacia', chipLabel:'Farmácias', ramoLabel:'Farmácia / Drogaria', emoji:'💊', icon:'ti-pill', cor:'#38bdf8', bg:'rgba(56,189,248,0.12)',
      cadastro:true, filtro:true, busca:['farmacia','farmácia','drogaria','remedio','medicamento','plantao','droga','drogal'] },
    { id:'clinica', chipLabel:'Clínicas', ramoLabel:'Clínica Médica / Odontológica', emoji:'🩺', icon:'ti-stethoscope', cor:'#34d399', bg:'rgba(52,211,153,0.12)',
      cadastro:true, filtro:true, busca:['clinica','clínica','medica','médica','odonto','dentista','consulta','saude','médico','medico'] },
    { id:'laboratorio', chipLabel:'Laboratórios', ramoLabel:'Laboratório de Análises', emoji:'🧪', icon:'ti-flask', cor:'#a3e635', bg:'rgba(163,230,53,0.12)',
      cadastro:true, filtro:true, busca:['laboratorio','laboratório','exame','analise','análise','coleta'] },
    { id:'otica', chipLabel:'Óticas', ramoLabel:'Ótica', emoji:'👓', icon:'ti-eyeglass', cor:'#67e8f9', bg:'rgba(103,232,249,0.12)',
      cadastro:true, filtro:true, busca:['otica','ótica','oculista','oculos','óculos','lente','visao'] },
    { id:'barbearia', chipLabel:'Barbearias', ramoLabel:'Barbearia', emoji:'💈', icon:'ti-scissors', cor:'#fbbf24', bg:'rgba(251,191,36,0.12)',
      cadastro:true, filtro:true, busca:['barbearia','barber','barbeiro','corte','barba','cabelo masculino','cabelo','navalha','degrade','degradê','pezinho','platinado masculino'] },
    { id:'salao', chipLabel:'Salões', ramoLabel:'Salão de Beleza / Estética', emoji:'💅', icon:'ti-flower', cor:'#f9a8d4', bg:'rgba(249,168,212,0.12)',
      cadastro:true, filtro:true, busca:['salao','salão','beleza','estetica','estética','cabeleireiro','cabelereiro','manicure','sobrancelha','depilacao','depilação','spa','progressiva','escova','mechas','luzes','hidratacao','hidratação','cabelo feminino','unha','alongamento','cilios','cílios','design de sobrancelha','penteado','coloracao','coloração','botox capilar'] },
    { id:'academia', chipLabel:'Academias', ramoLabel:'Academia / Pilates / Yoga', emoji:'💪', icon:'ti-barbell', cor:'#fb923c', bg:'rgba(251,146,60,0.12)',
      cadastro:true, filtro:true, busca:['academia','pilates','yoga','ginasio','ginásio','musculacao','musculação','crossfit','funcional','fitness'] },
    { id:'tattoo', chipLabel:'Tatuagem', ramoLabel:'Estúdio de Tatuagem / Piercing', emoji:'🩸', icon:'ti-brush', cor:'#c084fc', bg:'rgba(192,132,252,0.12)',
      cadastro:true, filtro:true, busca:['tattoo','tatuagem','piercing','estudio','estúdio','body art'] },
    // ── Automotivo ──
    { id:'posto', chipLabel:'Postos', ramoLabel:'Posto de Combustível', emoji:'⛽', icon:'ti-gas-station', cor:'#facc15', bg:'rgba(250,204,21,0.12)',
      cadastro:true, filtro:true, busca:['posto','gasolina','diesel','combustivel','combustível','etanol','alvim'] },
    { id:'gas', chipLabel:'Gás/Água', ramoLabel:'Gás / Água', emoji:'🛢️', icon:'ti-flame', cor:'#fb923c', bg:'rgba(251,146,60,0.12)',
      cadastro:true, filtro:true, busca:['gas','gás','agua','água','botijao','botijão','liquigas','ultragaz','glp'] },
    { id:'autopecas', chipLabel:'Autopeças', ramoLabel:'Autopeças / Motopeças', emoji:'⚙️', icon:'ti-settings', cor:'#78716c', bg:'rgba(120,113,108,0.12)',
      cadastro:true, filtro:true, busca:['autopecas','autopeças','motopecas','motopeças','peças','pecas','acessorio auto'] },
    { id:'mecanica', chipLabel:'Mecânicas', ramoLabel:'Oficina Mecânica / Auto Elétrica', emoji:'🔧', icon:'ti-tool', cor:'#94a3b8', bg:'rgba(148,163,184,0.12)',
      cadastro:true, filtro:true, busca:['mecanica','mecânica','oficina','eletrica','elétrica','motor','freio','suspensao','retifica','funilaria','auto center'] },
    { id:'funilaria', chipLabel:'Funilaria', ramoLabel:'Funilaria e Pintura', emoji:'🎨', icon:'ti-car-crash', cor:'#f87171', bg:'rgba(248,113,113,0.12)',
      cadastro:true, filtro:true, busca:['funilaria','funileiro','pintura','lanternagem','lataria'] },
    { id:'borracharia', chipLabel:'Borracharia', ramoLabel:'Borracharia', emoji:'🛞', icon:'ti-circle', cor:'#a8a29e', bg:'rgba(168,162,158,0.12)',
      cadastro:true, filtro:true, busca:['borracharia','pneu','pneus','borracha','remendo'] },
    { id:'lava-rapido', chipLabel:'Lava-Rápido', ramoLabel:'Lava-Rápido', emoji:'🧼', icon:'ti-droplet', cor:'#38bdf8', bg:'rgba(56,189,248,0.12)',
      cadastro:true, filtro:true, busca:['lava','lavagem','lavajato','autolavagem','limpeza veicular','car wash'] },
    { id:'bicicletaria', chipLabel:'Bicicletaria', ramoLabel:'Bicicletaria', emoji:'🚲', icon:'ti-bike', cor:'#4ade80', bg:'rgba(74,222,128,0.12)',
      cadastro:true, filtro:true, busca:['bicicletaria','bicicleta','ciclo','bike','bikes'] },
    // ── Casa e Construção ──
    { id:'construcao', chipLabel:'Construção', ramoLabel:'Material de Construção', emoji:'🧱', icon:'ti-helmet', cor:'#f59e0b', bg:'rgba(245,158,11,0.12)',
      cadastro:true, filtro:true, busca:['construção','construcao','material','cimento','ferragem','tijolo','telhado','obra'] },
    { id:'moveis', chipLabel:'Móveis', ramoLabel:'Móveis e Eletrodomésticos', emoji:'🛋️', icon:'ti-armchair', cor:'#a78bfa', bg:'rgba(167,139,250,0.12)',
      cadastro:true, filtro:true, busca:['moveis','móveis','eletrodomestico','eletrodoméstico','armario','sofa','cama','geladeira'] },
    { id:'variedades', chipLabel:'Variedades', ramoLabel:'Loja de Variedades / Utilidades', emoji:'🛍️', icon:'ti-shopping-bag', cor:'#94a3b8', bg:'rgba(148,163,184,0.12)',
      cadastro:true, filtro:true, busca:['variedades','utilidades','bazar','utilidade','descartavel','plastico'] },
    { id:'vidracaria', chipLabel:'Vidraçaria', ramoLabel:'Vidraçaria / Esquadrias', emoji:'🪟', icon:'ti-window', cor:'#67e8f9', bg:'rgba(103,232,249,0.12)',
      cadastro:true, filtro:true, busca:['vidraçaria','vidracaria','vidro','esquadria','janela','porta','espelho'] },
    { id:'madeireira', chipLabel:'Madeireira', ramoLabel:'Madeireira', emoji:'🪵', icon:'ti-tree', cor:'#86efac', bg:'rgba(134,239,172,0.12)',
      cadastro:true, filtro:true, busca:['madeira','madeireira','tabua','tábua','mdf','compensado'] },
    { id:'tintas', chipLabel:'Tintas', ramoLabel:'Loja de Tintas', emoji:'🎨', icon:'ti-bucket', cor:'#f472b6', bg:'rgba(244,114,182,0.12)',
      cadastro:true, filtro:true, busca:['tinta','tintas','pintura','verniz','tinteiro','imobiliaria tintas'] },
    { id:'serralheria', chipLabel:'Serralheria', ramoLabel:'Serralheria', emoji:'👨‍🏭', icon:'ti-building-factory-2', cor:'#94a3b8', bg:'rgba(148,163,184,0.12)',
      cadastro:true, filtro:true, busca:['serralheria','serralheiro','grade','portao','portão','ferro','estrutura metalica'] },
    { id:'refrigeracao', chipLabel:'Refrigeração', ramoLabel:'Refrigeração e Ar-Condicionado', emoji:'❄️', icon:'ti-snowflake', cor:'#7dd3fc', bg:'rgba(125,211,252,0.12)',
      cadastro:true, filtro:true, busca:['refrigeração','refrigeracao','ar-condicionado','ar condicionado','freezer','climatizador'] },
    { id:'consertos', chipLabel:'Consertos', ramoLabel:'Conserto de Eletrodomésticos', emoji:'🛠️', icon:'ti-tool', cor:'#fbbf24', bg:'rgba(251,191,36,0.12)',
      cadastro:true, filtro:true, busca:['conserto','eletrodomestico','eletrodoméstico','reparo','assistencia','assistência','manutencao'] },
    // ── Comércio e Variedades ──
    { id:'mercado', chipLabel:'Mercados', ramoLabel:'Mercado / Supermercado', emoji:'🛒', icon:'ti-building-store', cor:'#2dd4bf', bg:'rgba(45,212,191,0.12)',
      cadastro:true, filtro:true, busca:['mercado','supermercado','minimercado','mercearia','hortifruti','acougue'] },
    { id:'roupas', chipLabel:'Roupas', ramoLabel:'Loja de Roupas / Vestuário', emoji:'👗', icon:'ti-shirt', cor:'#f472b6', bg:'rgba(244,114,182,0.12)',
      cadastro:true, filtro:true, busca:['roupa','roupas','vestuario','vestuário','moda','confeccao','confecção','boutique','moda feminina','moda masculina'] },
    { id:'calcados', chipLabel:'Calçados', ramoLabel:'Loja de Calçados', emoji:'👟', icon:'ti-shoe', cor:'#a78bfa', bg:'rgba(167,139,250,0.12)',
      cadastro:true, filtro:true, busca:['calcado','calçado','sapato','tenis','tênis','sandalia','bota','sapataria','calcados'] },
    { id:'joalheria', chipLabel:'Joalherias', ramoLabel:'Joalheria e Relojoaria', emoji:'💍', icon:'ti-diamond', cor:'#facc15', bg:'rgba(250,204,21,0.12)',
      cadastro:true, filtro:true, busca:['joalheria','joalheiro','joias','relogio','relógio','relojoaria','ouro','prata','alianca'] },
    { id:'festas', chipLabel:'Festas', ramoLabel:'Artigos para Festas e Embalagens', emoji:'🧸', icon:'ti-cake', cor:'#fb7185', bg:'rgba(251,113,133,0.12)',
      cadastro:true, filtro:true, busca:['festa','festas','balao','balão','embalagem','decoracao','decoração','aniversario','brinquedo'] },
    { id:'armarinho', chipLabel:'Armarinho', ramoLabel:'Armarinho / Aviamentos / Artesanato', emoji:'🧵', icon:'ti-needle-thread', cor:'#d946ef', bg:'rgba(217,70,239,0.12)',
      cadastro:true, filtro:true, busca:['armarinho','aviamento','artesanato','la','lã','fios','linhas','tecido','costura','croche'] },
    { id:'floricultura', chipLabel:'Flores', ramoLabel:'Floricultura e Paisagismo', emoji:'💐', icon:'ti-plant-2', cor:'#4ade80', bg:'rgba(74,222,128,0.12)',
      cadastro:true, filtro:true, busca:['flor','flores','floricultura','paisagismo','plantas','buque','buquê','jardim','orquidea'] },
    // ── Pet e Agropecuária ──
    { id:'pet', chipLabel:'Pet Shop', ramoLabel:'Pet Shop / Veterinário', emoji:'🐾', icon:'ti-paw', cor:'#f472b6', bg:'rgba(244,114,182,0.12)',
      cadastro:true, filtro:true, busca:['pet','petshop','veterinario','veterinário','animal','racao','ração','banho','tosa','caes','gatos'] },
    { id:'agropecuaria', chipLabel:'Agropecuária', ramoLabel:'Agropecuária / Casa de Rações', emoji:'🌾', icon:'ti-tractor', cor:'#86efac', bg:'rgba(134,239,172,0.12)',
      cadastro:true, filtro:true, busca:['agropecuaria','agropecuária','racoes','rações','agro','rural','casa rural','semente'] },
    { id:'insumos', chipLabel:'Insumos Agric.', ramoLabel:'Insumos Agrícolas e Ferramentas', emoji:'🚜', icon:'ti-leaf', cor:'#4ade80', bg:'rgba(74,222,128,0.12)',
      cadastro:true, filtro:true, busca:['insumo','agricola','agrícola','ferramenta','adubo','fertilizante','defensivo','trator','irrigacao'] },
    // ── Tecnologia e Serviços ──
    { id:'papelaria', chipLabel:'Papelaria', ramoLabel:'Papelaria e Bazar', emoji:'📚', icon:'ti-book', cor:'#60a5fa', bg:'rgba(96,165,250,0.12)',
      cadastro:true, filtro:true, busca:['papelaria','bazar','livraria','caderno','caneta','escolar','material escolar'] },
    { id:'informatica', chipLabel:'Informática', ramoLabel:'Informática e Assistência Técnica', emoji:'💻', icon:'ti-device-laptop', cor:'#60a5fa', bg:'rgba(96,165,250,0.12)',
      cadastro:true, filtro:true, busca:['informatica','informática','computador','notebook','assistencia','suporte','hardware','software','ti','impressora'] },
    { id:'celular', chipLabel:'Celulares', ramoLabel:'Loja de Celular e Acessórios', emoji:'📱', icon:'ti-device-mobile', cor:'#34d399', bg:'rgba(52,211,153,0.12)',
      cadastro:true, filtro:true, busca:['celular','smartphone','acessorio','acessório','capinha','carregador','mobile'] },
    { id:'grafica', chipLabel:'Gráfica', ramoLabel:'Gráfica / Comunicação Visual', emoji:'🖨️', icon:'ti-printer', cor:'#a78bfa', bg:'rgba(167,139,250,0.12)',
      cadastro:true, filtro:true, busca:['grafica','gráfica','comunicação visual','banner','adesivo','impressao','impressão','plotagem','serigrafia'] },
    { id:'imobiliaria', chipLabel:'Imobiliária', ramoLabel:'Imobiliária', emoji:'🏢', icon:'ti-home', cor:'#38bdf8', bg:'rgba(56,189,248,0.12)',
      cadastro:true, filtro:true, busca:['imobiliaria','imobiliária','aluguel','venda','imoveis','imóveis','corretor','corretora'] },
    { id:'advocacia', chipLabel:'Advocacia', ramoLabel:'Escritório de Advocacia', emoji:'⚖️', icon:'ti-scale', cor:'#f59e0b', bg:'rgba(245,158,11,0.12)',
      cadastro:true, filtro:true, busca:['advocacia','advogado','juridico','jurídico','direito','escritorio juridico'] },
    { id:'contabilidade', chipLabel:'Contabilidade', ramoLabel:'Escritório de Contabilidade', emoji:'📊', icon:'ti-calculator', cor:'#34d399', bg:'rgba(52,211,153,0.12)',
      cadastro:true, filtro:true, busca:['contabilidade','contador','contabil','contábil','fiscal','tributario','imposto','irpf'] },
    { id:'fotografia', chipLabel:'Fotografia', ramoLabel:'Estúdio de Fotografia / Filmagem', emoji:'📸', icon:'ti-camera', cor:'#f472b6', bg:'rgba(244,114,182,0.12)',
      cadastro:true, filtro:true, busca:['fotografia','filmagem','estudio','estúdio','fotografo','fotógrafo','video','vídeo','foto','drone'] },
    { id:'viagens', chipLabel:'Viagens', ramoLabel:'Agência de Viagens e Turismo', emoji:'✈️', icon:'ti-plane', cor:'#38bdf8', bg:'rgba(56,189,248,0.12)',
      cadastro:true, filtro:true, busca:['viagem','viagens','turismo','agencia','agência','passagem','hotel','pacote','turista'] },
    // ── Educação e Finanças ──
    { id:'bancario', chipLabel:'Bancos/Lotérica', ramoLabel:'Agência Bancária / Lotérica', emoji:'🏦', icon:'ti-building-bank', cor:'#facc15', bg:'rgba(250,204,21,0.12)',
      cadastro:true, filtro:true, busca:['banco','bancaria','bancária','loterica','lotérica','loteria','financeiro','atm','caixa economica'] },
    { id:'seguros', chipLabel:'Seguros', ramoLabel:'Escritório de Seguros', emoji:'🛡️', icon:'ti-shield', cor:'#60a5fa', bg:'rgba(96,165,250,0.12)',
      cadastro:true, filtro:true, busca:['seguro','seguros','corretora','apolice','apólice','plano de saude','previdencia'] },
    { id:'idiomas', chipLabel:'Cursos/Idiomas', ramoLabel:'Escola de Idiomas / Cursos', emoji:'🗣️', icon:'ti-certificate', cor:'#a3e635', bg:'rgba(163,230,53,0.12)',
      cadastro:true, filtro:true, busca:['idioma','idiomas','ingles','inglês','curso','escola','ensino','educacao','educação','capacitacao'] },
    { id:'autoescola', chipLabel:'Autoescola', ramoLabel:'Autoescola (CFC)', emoji:'🚗', icon:'ti-car', cor:'#fb923c', bg:'rgba(251,146,60,0.12)',
      cadastro:true, filtro:true, busca:['autoescola','cfc','habilitacao','habilitação','cnh','motorista','primeira habilitacao'] },
    // ── Serviços e Reformas (mão de obra — normalmente por agendamento) ──
    { id:'pedreiro', chipLabel:'Pedreiro/Reformas', ramoLabel:'Pedreiro / Reformas', emoji:'👷', icon:'ti-tools', cor:'#f59e0b', bg:'rgba(245,158,11,0.12)',
      cadastro:true, filtro:true, busca:['pedreiro','reforma','reformas','obra','obras','alvenaria','construcao civil','construção civil','assentamento','reboco','contrapiso','muro','laje','mao de obra','mão de obra','empreiteiro'] },
    { id:'eletricista', chipLabel:'Eletricista', ramoLabel:'Eletricista', emoji:'⚡', icon:'ti-bolt', cor:'#facc15', bg:'rgba(250,204,21,0.12)',
      cadastro:true, filtro:true, busca:['eletricista','eletrica','elétrica','instalacao eletrica','instalação elétrica','fiacao','fiação','disjuntor','tomada','padrao de entrada','padrão de entrada','curto','quadro de luz'] },
    { id:'encanador', chipLabel:'Encanador', ramoLabel:'Encanador / Hidráulica', emoji:'🔧', icon:'ti-droplet', cor:'#38bdf8', bg:'rgba(56,189,248,0.12)',
      cadastro:true, filtro:true, busca:['encanador','hidraulica','hidráulica','vazamento','cano','encanamento','desentupimento','desentupidor','caixa dagua','caixa d\'agua','torneira','esgoto','bombeiro hidraulico'] },
    { id:'pintor', chipLabel:'Pintor', ramoLabel:'Pintor / Pintura Residencial', emoji:'🖌️', icon:'ti-brush', cor:'#f472b6', bg:'rgba(244,114,182,0.12)',
      cadastro:true, filtro:true, busca:['pintor','pintura','pintar','textura','massa corrida','grafiato','pintura residencial','pintura predial','parede','verniz'] },
    { id:'marceneiro', chipLabel:'Marcenaria', ramoLabel:'Marceneiro / Móveis Planejados', emoji:'🪚', icon:'ti-ruler-2', cor:'#d4a373', bg:'rgba(212,163,115,0.12)',
      cadastro:true, filtro:true, busca:['marceneiro','marcenaria','moveis planejados','móveis planejados','planejados','sob medida','armario planejado','armário planejado','cozinha planejada','madeira'] },
    { id:'jardinagem', chipLabel:'Jardinagem', ramoLabel:'Jardinagem / Corte de Grama', emoji:'🌳', icon:'ti-plant', cor:'#4ade80', bg:'rgba(74,222,128,0.12)',
      cadastro:true, filtro:true, busca:['jardinagem','jardineiro','corte de grama','grama','poda','roçada','rocada','jardim','paisagismo','capina','manutencao de jardim'] },
    { id:'diarista', chipLabel:'Diarista/Faxina', ramoLabel:'Diarista / Faxina', emoji:'🧹', icon:'ti-spray', cor:'#67e8f9', bg:'rgba(103,232,249,0.12)',
      cadastro:true, filtro:true, busca:['diarista','faxina','faxineira','limpeza','limpeza residencial','passadeira','servicos domesticos','serviços domésticos','limpeza pos obra','limpeza pós obra'] },
    { id:'fretes', chipLabel:'Fretes/Mudanças', ramoLabel:'Fretes / Carretos / Mudanças', emoji:'🚚', icon:'ti-truck', cor:'#fb923c', bg:'rgba(251,146,60,0.12)',
      cadastro:true, filtro:true, busca:['frete','fretes','carreto','carretos','mudanca','mudança','mudancas','caminhao','caminhão','carga'] },
    // ── Transporte de passageiros (1 categoria guarda-chuva) ──
    { id:'transporte', chipLabel:'Táxi/Transporte', ramoLabel:'Táxi / Transporte de Passageiros', emoji:'🚕', icon:'ti-car', cor:'#facc15', bg:'rgba(250,204,21,0.12)',
      cadastro:true, filtro:true, busca:['taxi','táxi','taxista','mototaxi','mototáxi','moto taxi','moto táxi','van escolar','transporte escolar','perua escolar','transporte de pacientes','transporte de passageiros','corrida','uber','motorista','ponto de taxi'] },
    // ── Outros serviços / autônomos ──
    { id:'chaveiro', chipLabel:'Chaveiro', ramoLabel:'Chaveiro', emoji:'🔑', icon:'ti-key', cor:'#fbbf24', bg:'rgba(251,191,36,0.12)',
      cadastro:true, filtro:true, busca:['chaveiro','chave','copia de chave','cópia de chave','fechadura','abertura de porta','abertura de fechadura','trava','cadeado','chaveiro 24h'] },
    { id:'costureira', chipLabel:'Costureira', ramoLabel:'Costureira / Ateliê de Costura', emoji:'🧵', icon:'ti-needle-thread', cor:'#f472b6', bg:'rgba(244,114,182,0.12)',
      cadastro:true, filtro:true, busca:['costureira','costura','atelie','ateliê','ajuste de roupa','reforma de roupa','conserto de roupa','bainha','barra','sob medida','alfaiate'] },
    { id:'dedetizacao', chipLabel:'Dedetização', ramoLabel:'Dedetização / Controle de Pragas', emoji:'🐜', icon:'ti-bug', cor:'#4ade80', bg:'rgba(74,222,128,0.12)',
      cadastro:true, filtro:true, busca:['dedetizacao','dedetização','dedetizadora','controle de pragas','pragas','desratizacao','desratização','descupinizacao','cupim','barata','rato','escorpiao','escorpião'] },
    { id:'guincho', chipLabel:'Guincho', ramoLabel:'Guincho / Reboque', emoji:'🚛', icon:'ti-truck-loading', cor:'#fb923c', bg:'rgba(251,146,60,0.12)',
      cadastro:true, filtro:true, busca:['guincho','reboque','rebocar','socorro','auto socorro','carro quebrado','pane','remocao de veiculo','remoção de veículo','24h'] },
    { id:'assistencia', chipLabel:'Assist. Técnica', ramoLabel:'Assistência Técnica a Domicílio', emoji:'🔧', icon:'ti-device-laptop', cor:'#38bdf8', bg:'rgba(56,189,248,0.12)',
      cadastro:true, filtro:true, busca:['assistencia tecnica','assistência técnica','conserto','tecnico a domicilio','técnico a domicílio','conserto de computador','conserto de celular','conserto de notebook','formatacao','formatação','manutencao','manutenção','tecnico de informatica'] },
    { id:'aulas', chipLabel:'Aulas Particulares', ramoLabel:'Aulas Particulares / Reforço', emoji:'📚', icon:'ti-school', cor:'#a78bfa', bg:'rgba(167,139,250,0.12)',
      cadastro:true, filtro:true, busca:['aula particular','aulas particulares','reforco escolar','reforço escolar','professor particular','explicadora','explicador','reforco','aula de matematica','aula de ingles','musica','violao','violão'] },
    { id:'personal', chipLabel:'Personal Trainer', ramoLabel:'Personal Trainer', emoji:'🏋️', icon:'ti-barbell', cor:'#fb7185', bg:'rgba(251,113,133,0.12)',
      cadastro:true, filtro:true, busca:['personal','personal trainer','treinador','treino','educador fisico','educador físico','treino em casa','condicionamento','musculacao','musculação'] },
    { id:'beleza-domicilio', chipLabel:'Beleza a Domicílio', ramoLabel:'Cabeleireiro / Manicure a Domicílio', emoji:'💅', icon:'ti-hand-finger', cor:'#f9a8d4', bg:'rgba(249,168,212,0.12)',
      cadastro:true, filtro:true, busca:['manicure','pedicure','cabeleireira a domicilio','cabeleireiro a domicilio','a domicilio','a domicílio','unha','esmalte','maquiagem','maquiadora','sobrancelha','depilacao','depilação'] },
  ];

  /* ── Derivados automáticos (NÃO editar à mão) ─────────────────── */
  // CATEGORIAS = chips de filtro do cliente. 'todos' fixo no topo;
  // 'servicos' como rede de segurança no fim (fallback do back-end).
  const CATEGORIAS = [
    { id:'todos', label:'Tudo', icon:'ti-bolt', cor:'#ff4444', bg:'rgba(255,68,68,0.12)' },
    ...CAT_DEF.filter(c => c.filtro).map(c => ({
      id:c.id, label:c.chipLabel, icon:c.icon, cor:c.cor, bg:c.bg
    })),
    { id:'servicos', label:'Serviços', icon:'ti-briefcase', cor:'#94a3b8', bg:'rgba(148,163,184,0.12)' },
  ];

  // RAMOS = itens do combobox de cadastro (derivado de CAT_DEF).
  const RAMOS = CAT_DEF.filter(c => c.cadastro).map(c => ({
    emoji:c.emoji, label:c.ramoLabel, slug:c.id, grupo:c.grupo, busca:c.busca
  }));

  const CAT_BG = Object.fromEntries(CATEGORIAS.map(c => [c.id, c.bg]));

  // Mapa categoria→emoji (derivado do CAT_DEF). Usado como FALLBACK quando a
  // loja não tem emoji próprio ou está com o genérico '🏪' que o cadastro
  // grava por padrão — assim um pedreiro mostra 👷, uma sorveteria 🍦, etc.,
  // sem o dono precisar configurar nada.
  const CAT_EMOJI = Object.fromEntries(CAT_DEF.map(c => [c.id, c.emoji]));

  // Retorna o emoji de exibição de uma loja: o próprio, se for específico;
  // senão o da categoria; senão o genérico. Trata '🏪' e vazio como 'sem emoji'.
  function emojiLoja(loja) {
    const e = String(loja && loja.emoji || '').trim();
    if (e && e !== '🏪') return e;
    return CAT_EMOJI[loja && loja.categoria] || e || '🏪';
  }

  // Mensagem inicial do WhatsApp ao tocar no botão WPP de uma loja.
  // Loja por agendamento não tem 'aberto agora' — a pessoa quer contratar,
  // então a saudação pede o agendamento em vez de perguntar se está aberto.
  function saudacaoWhats(loja) {
    if (loja && loja.agendamento) {
      return 'Olá, vi no AngatubaON! Gostaria de agendar seu serviço. Tem disponibilidade?';
    }
    return 'Olá, vi no AngatubaON! Está aberto agora?';
  }

  // Mapa categoria→sinônimos de busca (reaproveita CAT_DEF.busca, já usado no
  // autocomplete de cadastro) para a busca do CLIENTE também entender termos
  // como "hamburguer", "sorvete" etc. mesmo que a loja não tenha essa palavra
  // literal em tags/nome/sub.
  const CAT_BUSCA_MAP = Object.fromEntries(
    CAT_DEF.filter(c => Array.isArray(c.busca)).map(c => [c.id, c.busca.map(b => String(b).toLowerCase())])
  );

  // Distância de edição (Levenshtein) com CORTE em 1: retorna true se `a` e `b`
  // estão a no máximo 1 edição (troca/insercao/remocao de 1 caractere). Usada
  // como ÚLTIMO recurso da busca do cliente, para tolerar erro de teclado
  // ("acugue" → "acougue", "farmacya" → "farmacia"). Curto-circuita cedo por
  // diferença de tamanho e aborta assim que passa de 1 erro — barato o suficiente
  // para rodar por termo só quando nada bateu por substring.
  function _lev1(a, b) {
    if (a === b) return true;
    const la = a.length, lb = b.length;
    if (Math.abs(la - lb) > 1) return false;
    if (la > lb) { const t = a; a = b; b = t; }
    const n = a.length, m = b.length;
    let i = 0, j = 0, erros = 0;
    while (i < n && j < m) {
      if (a[i] === b[j]) { i++; j++; continue; }
      if (++erros > 1) return false;
      if (n === m) { i++; j++; }
      else { j++; }
    }
    if (j < m || i < n) erros++;
    return erros <= 1;
  }

  // Casa um termo de busca contra um alvo tolerando 1 erro de digitacao.
  // So aplica fuzzy em termos "longos o suficiente" (>=4 chars) para nao
  // colar coisas curtas por acaso ("bar" ~ "mar"). Compara o termo inteiro
  // contra o alvo inteiro E contra cada palavra do alvo.
  function _matchFuzzy(termo, alvo) {
    if (!termo || termo.length < 4 || !alvo) return false;
    if (_lev1(termo, alvo)) return true;
    const palavras = alvo.split(/[^a-z0-9]+/);
    for (let k = 0; k < palavras.length; k++) {
      const w = palavras[k];
      if (w.length >= 4 && _lev1(termo, w)) return true;
    }
    return false;
  }

  /* ══════════════════════════════════════════════════════════════
     LOJAS — carregadas dinamicamente do Google Sheets via Apps Script
     Lojas hardcoded abaixo são o fallback caso a API falhe
  ══════════════════════════════════════════════════════════════ */
  const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwmJMmvb5H6KkMWdXJV441SQ2h18SEfLrb_4-kvUYM0IiVL6Co-EKGGay7f_qvUEi0_cg/exec';

  /* ── Identidade leve p/ avaliações + utilitário de data ───────
     O sid NÃO é autenticação: é um identificador de dispositivo/navegador
     usado só para deduplicar e permitir editar/remover a própria avaliação. */
  function getAvalSid() {
    try {
      let sid = localStorage.getItem('angatuba_sid');
      if (!sid) {
        sid = (self.crypto && crypto.randomUUID)
          ? crypto.randomUUID()
          : 'sid-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
        localStorage.setItem('angatuba_sid', sid);
      }
      return sid;
    } catch (e) { return 'sid-anon'; }
  }
  function getAvalNome() {
    try { return localStorage.getItem('angatuba_aval_nome') || ''; } catch (e) { return ''; }
  }
  function setAvalNome(nome) {
    try { localStorage.setItem('angatuba_aval_nome', String(nome || '').slice(0, 40)); } catch (e) {}
  }
  // Registro local da avaliação do usuário (p/ editar/remover): { nota, texto, autor, ts }.
  // Retrocompat: valor legado era um timestamp puro — normaliza p/ objeto.
  function getMinhaAval(nome) {
    try {
      const v = JSON.parse(localStorage.getItem('aval_' + toSlug(nome)) || 'null');
      if (v && typeof v === 'object') return v;
      return v ? { legacy: true } : null;
    } catch (e) { return null; }
  }
  function setMinhaAval(nome, obj) {
    try { localStorage.setItem('aval_' + toSlug(nome), JSON.stringify(obj)); } catch (e) {}
  }
  function limparMinhaAval(nome) {
    try { localStorage.removeItem('aval_' + toSlug(nome)); } catch (e) {}
  }
  // "há 3 dias", "ontem", "há 2 h", "agora" — a partir de timestamp em ms.
  function tempoRelativo(ms) {
    const t = Number(ms);
    if (!t || isNaN(t)) return '';
    const diff = Date.now() - t;
    if (diff < 60000) return 'agora';
    const min = Math.floor(diff / 60000);
    if (min < 60) return 'há ' + min + ' min';
    const h = Math.floor(min / 60);
    if (h < 24) return 'há ' + h + ' h';
    const d = Math.floor(h / 24);
    if (d === 1) return 'ontem';
    if (d < 30) return 'há ' + d + ' dias';
    const mes = Math.floor(d / 30);
    if (mes < 12) return 'há ' + mes + (mes === 1 ? ' mês' : ' meses');
    const anos = Math.floor(d / 365);
    return 'há ' + anos + (anos === 1 ? ' ano' : ' anos');
  }
  const ADMIN_WPP_CONTATO = '5515981125349'; // número único — atualizar aqui se mudar

  /* ════════════════════════════════════════════════════════════
     HELPER de API — centraliza o padrão repetido de POST ao Apps Script.
     Monta o payload, aplica timeout, lê JSON e trata UNAUTHORIZED de forma
     consistente. Usado pelos fluxos homogêneos (toggle, cardápio, instagram,
     entrega, anúncio). Casos especiais (no-cors fire-and-forget, Promise.all,
     GET de carregarLojas) seguem com fetch direto de propósito.
     Retorna o objeto JSON parseado. Lança Error em falha de rede/timeout.
  ════════════════════════════════════════════════════════════ */
  async function apiPost(action, dados = {}, opts = {}) {
    const timeout = opts.timeout || 12000;
    const params  = new URLSearchParams();
    params.append('payload', JSON.stringify(Object.assign({ action }, dados)));
    const resp = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      body:   params,
      signal: AbortSignal.timeout(timeout),
    });
    const json = await resp.json();
    // Sessão expirada: trata de forma central (a menos que o chamador peça pra não)
    if (json && json.msg === 'UNAUTHORIZED' && !opts.ignoreUnauthorized) {
      if (typeof lojaLogout === 'function') lojaLogout(true);
      throw new Error('UNAUTHORIZED');
    }
    return json;
  }

  /* ── Máscara de WhatsApp progressiva: (15) 9 9999-9999 ──────────
     Fonte única usada tanto no cadastro quanto no login de loja. */
  function mascararWppBR(valorBruto) {
    const d = String(valorBruto || '').replace(/\D/g, '').slice(0, 11);
    if (d.length === 0) return '';
    if (d.length <= 2)  return '(' + d;
    if (d.length <= 6)  return `(${d.slice(0,2)}) ${d.slice(2)}`;
    // Fixo (10 dígitos): (XX) XXXX-XXXX. Celular (11, com 9): (XX) 9 XXXX-XXXX.
    // Enquanto digita (7-10), assume fixo; ao chegar no 11º dígito, vira celular.
    if (d.length <= 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
    return `(${d.slice(0,2)}) ${d.slice(2,3)} ${d.slice(3,7)}-${d.slice(7)}`;
  }

  /* ══════════════════════════════════════════════════════════════
     SPLASH SCREEN — vídeo da coruja (cacheado) ou CSS fallback
     Tempo mínimo: 1.8s. Máximo: 5s (failsafe).
  ══════════════════════════════════════════════════════════════ */
  const _splashInicio = Date.now();
  const _SPLASH_MIN   = 1800;
  const _SPLASH_MAX   = 5000;
  let   _splashOculta = false;

  // Inicia lógica do vídeo — só mostra se já estiver no cache (carrega < 400ms)
  (function _initSplashVideo() {
    const vid      = document.getElementById('spl-video');
    const fallback = document.getElementById('spl-fallback');
    const texto    = document.getElementById('spl-texto');
    if (!vid) return;

    const t0 = Date.now();
    vid.addEventListener('canplay', () => {
      if (Date.now() - t0 > 400) return; // demorou: não estava cacheado, mantém fallback
      // Vídeo cacheado: troca fallback pelo vídeo
      if (fallback) fallback.classList.add('oculto');
      vid.classList.add('pronto');
      if (texto) texto.classList.add('visivel');
      vid.play().catch(() => {});
    }, { once: true });

    // Se o vídeo não estiver disponível, garante que o fallback aparece limpo
    vid.addEventListener('error', () => {
      if (fallback) fallback.classList.remove('oculto');
    }, { once: true });
  })();

  function _esconderSplash() {
    if (_splashOculta) return;
    _splashOculta = true;
    const decorrido = Date.now() - _splashInicio;
    const espera    = Math.max(0, _SPLASH_MIN - decorrido);
    setTimeout(() => {
      const el = document.getElementById('splash-screen');
      if (!el) return;
      el.classList.add('splash-saindo');
      setTimeout(() => { try { el.remove(); } catch(e) {} }, 650);
    }, espera);
  }

  // Failsafe: some em no máximo 5s mesmo se algo travar
  setTimeout(_esconderSplash, _SPLASH_MAX);

  // Lojas fixas (fallback offline / enquanto carrega)
  const LOJAS_FIXAS = []; // migradas para a planilha

  // Array ativo — começa com as fixas, substituído pelas da API quando carregar
  let LOJAS = [...LOJAS_FIXAS];

  // Mapa nome→índice global — atualizado sempre que LOJAS muda.
  // Garante que abrirDetalhes(idx) sempre encontre a loja certa,
  // independente de filtros ativos na lista renderizada.
  let _lojaIdxMap = new Map();
  function _rebuildIdxMap() {
    _lojaIdxMap.clear();
    LOJAS.forEach((l, i) => _lojaIdxMap.set(l, i));
  }
  _rebuildIdxMap();

  /* ══════════════════════════════════════════════════════════════
     ENGINE
  ══════════════════════════════════════════════════════════════ */

  /* ══════════════════════════════════════════════════════════════
     FOCUS TRAP — genérico, usado pelos modais do cliente (detalhes,
     onboarding, cardápio, nudge de avaliação). Sem isso, Tab/Shift+Tab
     "vazava" para trás do backdrop, deixando elementos escondidos
     focáveis via teclado/leitor de tela.
  ══════════════════════════════════════════════════════════════ */
  const _FOCUS_SELECTOR = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
  let _focusTrapEl = null;
  let _focusTrapAnterior = null;
  function _focusTrapKeydown(e) {
    if (e.key !== 'Tab' || !_focusTrapEl) return;
    const focaveis = Array.prototype.slice.call(_focusTrapEl.querySelectorAll(_FOCUS_SELECTOR))
      .filter(el => el.offsetParent !== null); // só os visíveis
    if (!focaveis.length) return;
    const primeiro = focaveis[0];
    const ultimo   = focaveis[focaveis.length - 1];
    if (e.shiftKey && document.activeElement === primeiro) {
      e.preventDefault(); ultimo.focus();
    } else if (!e.shiftKey && document.activeElement === ultimo) {
      e.preventDefault(); primeiro.focus();
    }
  }
  // Ativa o trap: guarda o foco anterior e move o foco para dentro do container.
  function _focusTrapAtivar(container) {
    if (!container) return;
    _focusTrapAnterior = document.activeElement;
    _focusTrapEl = container;
    document.addEventListener('keydown', _focusTrapKeydown, true);
    // Move o foco pro primeiro elemento focável (ou pro próprio container).
    setTimeout(() => {
      if (!_focusTrapEl) return;
      const alvo = _focusTrapEl.querySelector(_FOCUS_SELECTOR);
      if (alvo) alvo.focus();
      else { _focusTrapEl.setAttribute('tabindex', '-1'); _focusTrapEl.focus(); }
    }, 50);
  }
  // Desativa o trap e devolve o foco a quem estava focado antes de abrir o modal.
  function _focusTrapDesativar() {
    document.removeEventListener('keydown', _focusTrapKeydown, true);
    _focusTrapEl = null;
    if (_focusTrapAnterior && document.contains(_focusTrapAnterior) && typeof _focusTrapAnterior.focus === 'function') {
      _focusTrapAnterior.focus();
    }
    _focusTrapAnterior = null;
  }

  // Helper: escapa HTML para evitar XSS — definido cedo pois é usado em cardHTML
  function escHTML(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // Formata número em reais no padrão BR (R$ 5,00).
  function _fmtBRL(n) {
    return 'R$ ' + (Number(n) || 0).toFixed(2).replace('.', ',');
  }

  // ── Taxa de entrega — parse do campo salvo (coluna AD) ──
  // Formatos: '' (sem taxa) | 'GRATIS' | 'COMBINAR' | 'FIXA:5.00' | 'MINIMO:100.00:8.00'
  // Recebe o subtotal do carrinho e devolve um objeto pronto para renderizar:
  //   { modo, valor, gratis, combinar, faltaParaGratis }
  //   - valor: quanto somar ao total (0 se grátis/combinar/sem taxa)
  //   - gratis: true quando não há custo de entrega
  //   - combinar: true quando o valor é 'a combinar com a loja'
  //   - faltaParaGratis: no modo MÍNIMO, quanto falta para zerar a taxa (0 se já zerou)
  //   - label: texto curto pronto ('Grátis', 'R$ 5,00', 'A combinar')
  function calcularTaxaEntrega(taxaStr, subtotal) {
    const s = String(taxaStr || '').trim().toUpperCase();
    const sub = Number(subtotal) || 0;
    const semTaxa = { modo: 'NENHUMA', valor: 0, gratis: true, combinar: false, faltaParaGratis: 0, label: '' };
    if (!s) return semTaxa;

    if (s === 'GRATIS') {
      return { modo: 'GRATIS', valor: 0, gratis: true, combinar: false, faltaParaGratis: 0, label: 'Grátis' };
    }
    if (s === 'COMBINAR') {
      return { modo: 'COMBINAR', valor: 0, gratis: false, combinar: true, faltaParaGratis: 0, label: 'A combinar' };
    }
    if (s.indexOf('FIXA:') === 0) {
      const v = parseFloat(s.slice(5).replace(',', '.'));
      if (isNaN(v) || v <= 0) return { modo: 'GRATIS', valor: 0, gratis: true, combinar: false, faltaParaGratis: 0, label: 'Grátis' };
      return { modo: 'FIXA', valor: v, gratis: false, combinar: false, faltaParaGratis: 0, label: _fmtBRL(v) };
    }
    if (s.indexOf('MINIMO:') === 0) {
      const partes = s.slice(7).split(':');
      const piso = parseFloat(String(partes[0] || '').replace(',', '.'));
      const taxa = parseFloat(String(partes[1] || '').replace(',', '.'));
      if (isNaN(piso) || isNaN(taxa) || taxa <= 0) {
        return { modo: 'GRATIS', valor: 0, gratis: true, combinar: false, faltaParaGratis: 0, label: 'Grátis' };
      }
      if (sub >= piso) {
        return { modo: 'MINIMO', valor: 0, gratis: true, combinar: false, faltaParaGratis: 0, piso: piso, taxaBase: taxa, label: 'Grátis' };
      }
      return { modo: 'MINIMO', valor: taxa, gratis: false, combinar: false, faltaParaGratis: piso - sub, piso: piso, taxaBase: taxa, label: _fmtBRL(taxa) };
    }
    return semTaxa; // formato desconhecido — trata como sem taxa
  }

  // Extrai o @handle puro de qualquer formato de entrada do Instagram:
  // "@usuario", "usuario", "https://instagram.com/usuario", "https://www.instagram.com/usuario?igsh=...", "instagram.com/usuario/"
  function normalizarInstagramHandle(input) {
    let s = String(input || '').trim();
    if (!s) return '';
    // Remove protocolo + domínio (com ou sem www)
    s = s.replace(/^https?:\/\/(www\.)?instagram\.com\//i, '');
    // Remove qualquer coisa a partir de "?" (query string) ou "#" (hash)
    s = s.split('?')[0].split('#')[0];
    // Remove barra final e qualquer subcaminho extra (ex: /reels, /p/...)
    s = s.split('/')[0];
    // Remove @ inicial
    s = s.replace(/^@/, '').trim();
    return s;
  }

  // Item 7: valida o formato de um handle do Instagram JÁ normalizado.
  // Regras do Instagram: letras, números, ponto e underscore; 1–30 caracteres.
  // Vazio é considerado válido (permite limpar o campo). Serve para não mostrar
  // "✅ atualizado" quando o link do perfil ficaria quebrado.
  function _igHandleValido(h) {
    if (!h) return true; // vazio = limpar, ok
    return /^[a-zA-Z0-9._]{1,30}$/.test(h);
  }

  // Gera slug de URL a partir do nome da loja
  function toSlug(nome) {
    return String(nome || '').toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .replace(/[^a-z0-9]+/g,'-')
      .replace(/^-+|-+$/g,'');
  }

  let activeCat        = 'todos';
  let searchQuery      = '';
  let activePillFilter = 'all';
  let activeBairro     = '';  // bairro filtrado atualmente

  /* ══════════════════════════════════════════════════════════════
     FAVORITOS — "Minhas lojas"
     ----------------------------------------------------------
     O cliente marca lojas com ❤️ e filtra só elas. Guardamos um
     IDENTIFICADOR ESTÁVEL da loja (id || wpp || nome — mesmo padrão
     já usado em thumbHTML/detalhes para o anel de anúncio), não o
     nome puro: o lojista pode renomear a loja pelo painel, e o WhatsApp
     (chave de login, praticamente imutável) sobrevive a isso. Favoritos
     salvos antes dessa mudança (por nome) são migrados automaticamente
     assim que as lojas carregam — ver _migrarFavoritosParaId().
     Persiste em localStorage.
  ══════════════════════════════════════════════════════════════ */
  const FAVORITOS_KEY = 'angatuba_favoritos';
  let _favoritos = (function () {
    try {
      const arr = JSON.parse(localStorage.getItem(FAVORITOS_KEY) || '[]');
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  })();

  function favNormNome(nome) {
    return String(nome || '').trim().toLowerCase();
  }
  // Identificador estável de uma loja para fins de favorito (mesmo critério
  // usado em outros pontos do app: id > wpp > nome, o mais durável primeiro).
  function favIdDeLoja(loja) {
    return favNormNome(loja && (loja.id || loja.wpp || loja.nome));
  }
  function isFavorito(idOuNome) {
    return _favoritos.indexOf(favNormNome(idOuNome)) !== -1;
  }
  function _salvarFavoritos() {
    try { localStorage.setItem(FAVORITOS_KEY, JSON.stringify(_favoritos)); } catch (e) {}
  }
  // Alterna o favorito de uma loja (recebe o id estável, não o nome).
  // Retorna o novo estado (true = favoritada).
  window.toggleFavorito = function (idRaw, ev) {
    if (ev) { ev.stopPropagation(); ev.preventDefault(); }
    const n = favNormNome(idRaw);
    if (!n) return false;
    const i = _favoritos.indexOf(n);
    const agoraFav = (i === -1);
    if (agoraFav) _favoritos.push(n); else _favoritos.splice(i, 1);
    _salvarFavoritos();

    // Atualiza o coração no modal (se aberto) sem re-render
    document.querySelectorAll('.fav-btn-big[data-fav-id="' + cssEscapeAttr(n) + '"]').forEach(function (btn) {
      btn.classList.toggle('is-fav', agoraFav);
      btn.setAttribute('aria-pressed', agoraFav ? 'true' : 'false');
      btn.setAttribute('aria-label', agoraFav ? 'Remover dos favoritos' : 'Adicionar aos favoritos');
      const ico = btn.querySelector('i');
      if (ico) ico.className = agoraFav ? 'fa-solid fa-heart' : 'fa-regular fa-heart';
    });

    // Feedback curto
    if (typeof showToastSimples === 'function') {
      showToastSimples(
        agoraFav ? '❤️ Adicionada às suas lojas' : 'Removida das suas lojas',
        agoraFav ? '/webp/owl-love.webp' : '/webp/owl-wave.webp'
      );
    }

    // Se o filtro de favoritos está ativo e a loja saiu, re-renderiza a lista
    if (activePillFilter === 'favoritos' && !agoraFav) {
      renderLojas();
    }
    // Atualiza o contador no pill de favoritos, se existir
    atualizarBadgeFavoritos();
    return agoraFav;
  };
  function contarFavoritos() { return _favoritos.length; }
  function atualizarBadgeFavoritos() {
    const lbl = document.getElementById('pill-fav-count');
    if (lbl) {
      const n = contarFavoritos();
      lbl.textContent = n > 0 ? String(n) : '';
      lbl.style.display = n > 0 ? '' : 'none';
    }
  }
  // Escapa um valor para uso seguro dentro de seletor de atributo CSS.
  function cssEscapeAttr(s) {
    return String(s).replace(/["\\]/g, '\\$&');
  }
  // Botão de coração do modal de detalhes (favoritar/desfavoritar).
  // Recebe o objeto loja inteiro (precisa dele pra calcular o id estável).
  function favBtnHTML(loja) {
    const n = favIdDeLoja(loja);
    const fav = isFavorito(n);
    const cls = 'fav-btn-big' + (fav ? ' is-fav' : '');
    const ico = fav ? 'fa-solid fa-heart' : 'fa-regular fa-heart';
    return '<button type="button" class="' + cls + '" data-fav-id="' + escAttr(n) + '"'
      + ' aria-pressed="' + (fav ? 'true' : 'false') + '"'
      + ' aria-label="' + (fav ? 'Remover dos favoritos' : 'Adicionar aos favoritos') + '"'
      + ' onclick="toggleFavorito(this.dataset.favId, event)">'
      + '<i class="' + ico + '"></i></button>';
  }

  // Migra favoritos salvos no formato antigo (nome da loja) para o novo
  // formato (id estável). Roda a cada carregamento de LOJAS (barato e
  // idempotente) em vez de travar com uma flag "rodou 1x" — assim, se o
  // cache-first inicial tiver uma lista parcial/desatualizada e não achar
  // a loja, a migração se corrige sozinha quando a API trouxer os dados
  // completos, sem precisar de nova ação do usuário.
  function _migrarFavoritosParaId() {
    if (!Array.isArray(LOJAS) || LOJAS.length === 0) return;
    if (!_favoritos.length) return;
    let mudou = false;
    const novos = _favoritos.map(function (entrada) {
      // Já bate com o id estável de alguma loja atual? Mantém como está.
      const jaBateId = LOJAS.some(function (l) { return favIdDeLoja(l) === entrada; });
      if (jaBateId) return entrada;
      // Formato legado: a entrada era o NOME normalizado da loja. Acha a
      // loja correspondente e migra para o id estável dela.
      const loja = LOJAS.find(function (l) { return favNormNome(l.nome) === entrada; });
      if (loja) { mudou = true; return favIdDeLoja(loja); }
      // Não achou (loja removida, ou ainda não carregada) — preserva a
      // entrada como está; se a loja reaparecer depois, tenta de novo.
      return entrada;
    });
    const dedup = novos.filter(function (v, i) { return novos.indexOf(v) === i; });
    if (mudou || dedup.length !== _favoritos.length) {
      _favoritos = dedup;
      _salvarFavoritos();
      atualizarBadgeFavoritos();
    }
  }

  const BAIRROS_ANGATUBA = [
    // Urbanos
    'Centro', 'Vila Ribeiro', 'Vila Volpi',
    'Vila Portela', 'Vila Nova', 'Vila Salto',
    'Vila Parque', 'Vila Maciel', 'Vila Progresso',
    'Vila Catanduva', 'Vila São Cristóvão', 'Vila Bela Vista',
    'Vila Nhô Ribeiro', 'Vila São José', 'Jardim Domingos dos Santos', 'Jardim Domingos Orsi',
    'Jardim Khouri', 'Jardim Monte Santo', 'Jardim Primavera',
    'Jardim Sol Nascente', 'Jardim Bela Vista', 'Jardim Ana',
    'Jardim Elisa', 'Jardim Luiza', 'Jardim do Paço', 'Jardim das Amoreiras',
    'Residencial Palas Atenas', 'Residencial Bela Vista', 'Residencial Simões',
    'Residencial Ingá', 'Residencial Vitória', 'Chácara Santo Antônio',
    'Portal Novo Horizonte',
    // Distritos e Zona Rural
    'Bom Retiro da Esperança', 'Bairro dos Rocinhos', 'Bairro dos Venâncios',
    'Bairro dos Pires', 'Bairro dos Oliveiras', 'Bairro dos Silveiras',
    'Bairro da Lagoa', 'Bairro do Guarei Velho', 'Bairro Chapada',
    'Bairro Palmital', 'Bairro Boa Vista', 'Bairro Campininha',
    'Bairro Faxinal', 'Bairro Morro Azul', 'Bairro dos Leites',
    'Bairro Machadinho',
  ];

  // Normalização: remove acentos e lowercase para comparação fuzzy
  function normBairro(s) {
    return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  }

  // Tenta detectar o bairro no display_name do Nominatim
  function detectarBairroDaRua(displayName) {
    const norm = normBairro(displayName);
    return BAIRROS_ANGATUBA.find(b => norm.includes(normBairro(b))) || '';
  }

  // Match unico usado pelo filtro E pela contagem de lojas por bairro,
  // garantindo que o numero no chip bata com o resultado ao clicar.
  function lojaEhDoBairro(loja, bairro) {
    if (!bairro) return true;
    const nb = normBairro(bairro);
    const lb = normBairro(loja.bairro);
    // 1) bairro salvo na loja bate exatamente (canonico)
    if (lb && lb === nb) return true;
    // 2) bairro salvo contem o filtro (tolera grafia parcial)
    if (lb && lb.includes(nb)) return true;
    // 3) fallback: detecta pelo endereco
    const end = normBairro(loja.endereco);
    if (end.includes(nb)) return true;
    // 4) rurais: endereco costuma omitir o prefixo 'Bairro '
    if (nb.startsWith('bairro ')) {
      const semPrefixo = nb.replace('bairro ', '');
      if (end.includes('- ' + semPrefixo) || end.startsWith(semPrefixo)) return true;
      if (lb.includes(semPrefixo)) return true;
    }
    return false;
  }

  // Conta quantas lojas casam com cada bairro (mesma logica do filtro).
  function contarLojasPorBairro() {
    const mapa = {};
    BAIRROS_ANGATUBA.forEach(b => { mapa[b] = 0; });
    LOJAS.forEach(loja => {
      BAIRROS_ANGATUBA.forEach(b => {
        if (lojaEhDoBairro(loja, b)) mapa[b]++;
      });
    });
    return mapa;
  }

  /* ── Calcula status pelo horário ─────────────────────────── */
  // Devolve o "agora" civil em America/Sao_Paulo (independente do fuso do
  // APARELHO do cliente). Sem isso, um celular com fuso errado/viajando
  // mostra Aberto/Fechado incorreto — a planilha/back-end já fixam SP,
  // o front precisa fazer o mesmo para o cálculo bater.
  const _DOW_MAP_SP = { Sun:0, Mon:1, Tue:2, Wed:3, Thu:4, Fri:5, Sat:6 };
  function _agoraSP() {
    let partes = {};
    try {
      const fmt = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'short',
      });
      fmt.formatToParts(new Date()).forEach(p => { if (p.type !== 'literal') partes[p.type] = p.value; });
    } catch (e) { partes = {}; }
    if (!partes.year) {
      // Fallback (Intl indisponível): usa o relógio do aparelho mesmo.
      const d = new Date();
      return {
        y: d.getFullYear(), mo: d.getMonth() + 1, d: d.getDate(),
        hh: d.getHours(), mm: d.getMinutes(), dow: d.getDay(),
      };
    }
    // Alguns motores retornam "24" na hora da meia-noite com hour12:false.
    const hh = parseInt(partes.hour, 10) % 24;
    return {
      y: parseInt(partes.year, 10), mo: parseInt(partes.month, 10), d: parseInt(partes.day, 10),
      hh, mm: parseInt(partes.minute, 10),
      dow: _DOW_MAP_SP[partes.weekday] ?? new Date().getDay(),
    };
  }
  // Chave numérica AAAAMMDDHHMM p/ comparar "agora" com um alvo ATE_/VOLTAMOS_ATE_
  // sem instanciar Date() (evita reintroduzir dependência do fuso do aparelho).
  function _chaveDataHora(y, mo, d, hh, mm) {
    return y * 100000000 + mo * 1000000 + d * 10000 + hh * 100 + mm;
  }
  /* ── calcStatusInfo: retorna { status, fechaStr } ───────────
     fechaStr = hora de fechamento formatada (ex: "23:00") ou ''
  ─────────────────────────────────────────────────────────── */
  function calcStatusInfo(loja) {
    const _agora = _agoraSP();
    // Override manual do dono da loja (campo statusLoja)
    if (loja.statusLoja === 'ABERTO')   return { status: 'open',   fechaStr: '' };
    if (loja.statusLoja === 'VOLTAMOS') return { status: 'zap',    fechaStr: '' };

    // Atende por agendamento: sem override manual acima, a loja não tem
    // aberto/fechado — mostra 'Sob agendamento'. Reaproveita o visual 'zap',
    // mas marca agendado:true para o badge trocar o texto. Só se aplica quando
    // não há um ABERTO_ATE_/VOLTAMOS_ATE_/FECHADO_HOJE_ ativo (esses são
    // temporários e o dono os define de propósito, então continuam valendo).
    if (loja.agendamento && !(loja.statusLoja || '').trim()) {
      return { status: 'zap', fechaStr: '', agendado: true };
    }

    // Ja voltamos com prazo: VOLTAMOS_ATE_YYYY-MM-DD_HHMM
    if ((loja.statusLoja || '').startsWith('VOLTAMOS_ATE_')) {
      const raw = loja.statusLoja.replace('VOLTAMOS_ATE_', '');
      if (raw.includes('_')) {
        const parts = raw.split('_');
        const hhmm  = parts[1];
        const hh = parseInt(hhmm.substring(0, 2));
        const mm = parseInt(hhmm.substring(2, 4));
        const [ay, amo, ad] = parts[0].split('-').map(Number);
        const alvo = _chaveDataHora(ay, amo, ad, hh, mm);
        const agoraChave = _chaveDataHora(_agora.y, _agora.mo, _agora.d, _agora.hh, _agora.mm);
        if (agoraChave < alvo) return { status: 'zap', fechaStr: '' };
      }
      // Expirou - cai no automatico abaixo
    }

    // Fechado só por hoje: FECHADO_HOJE_YYYY-MM-DD — expira na virada do dia
    if ((loja.statusLoja || '').startsWith('FECHADO_HOJE_')) {
      const dataFech = loja.statusLoja.replace('FECHADO_HOJE_', '');
      const hojeStr  = `${_agora.y}-${String(_agora.mo).padStart(2,'0')}-${String(_agora.d).padStart(2,'0')}`;
      if (dataFech === hojeStr) return { status: 'closed', fechaStr: '' };
      // Data anterior — expirou, cai no cálculo automático abaixo
    }

    // FECHADO legado (sem data) — trava permanente; tratamos como expirado
    // e seguimos para o cálculo automático (o trigger limpa o campo na planilha)
    if (loja.statusLoja === 'FECHADO')  { /* legado: ignora e usa automático */ }

    // Aberto com horário manual: ABERTO_ATE_YYYY-MM-DD_HHMM (ou legado HHMM)
    if ((loja.statusLoja || '').startsWith('ABERTO_ATE_')) {
      const raw  = loja.statusLoja.replace('ABERTO_ATE_', '');
      if (raw.includes('_')) {
        // Novo formato: YYYY-MM-DD_HHMM — compara data+hora exata
        const parts = raw.split('_');
        const datePart = parts[0];
        const hhmm2    = parts[1];
        const hh2 = parseInt(hhmm2.substring(0, 2));
        const mm2 = parseInt(hhmm2.substring(2, 4));
        const [ay2, amo2, ad2] = datePart.split('-').map(Number);
        const alvo2 = _chaveDataHora(ay2, amo2, ad2, hh2, mm2);
        const agoraChave2 = _chaveDataHora(_agora.y, _agora.mo, _agora.d, _agora.hh, _agora.mm);
        if (agoraChave2 < alvo2) return { status: 'open', fechaStr: `${String(hh2).padStart(2,'0')}:${String(mm2).padStart(2,'0')}` };
      }
      // Formato legado ou expirado — cai no cálculo automático abaixo
    }

    if (!loja.horario && !(loja.horarioTexto || loja.horario_texto)) {
      return { status: 'open', fechaStr: '' };
    }

    // ── Múltiplos turnos ──────────────────────────────────────
    // Fonte da verdade: o texto "Seg, Ter 08:00-18:00 | Sáb 08:00-12:00"
    // (separado por "|"). Se não houver texto parseável, cai no horário
    // estruturado legado {abre,fecha,dias} (turno único). Cada turno é
    // avaliado para o dia de HOJE/ONTEM; "aberto" vence, e o fechamento
    // exibido é o do turno que está aberto agora.
    const turnos = extrairTurnos(loja);
    if (!turnos.length) {
      // Sem horário utilizável — assume aberto (comportamento legado).
      return { status: 'open', fechaStr: '' };
    }

    const dow    = _agora.dow;
    const nowMin = _agora.hh * 60 + _agora.mm;
    // 00:00 como fechamento = meia-noite (1440 min)
    const parse = s => {
      const [h, m] = String(s).split(':').map(Number);
      return (h === 0 && m === 0) ? 1440 : h * 60 + m;
    };

    let melhorFechado = null; // guarda um "abre às" p/ exibir se nada abrir

    for (let ti = 0; ti < turnos.length; ti++) {
      const t = turnos[ti];
      if (!t.dias || !t.dias.length) continue;

      // 24h: abre 00:00 e fecha 23:59 (ou 00:00) — aberto o dia todo se for hoje
      const is24h = (t.abre === '00:00' && t.fecha === '23:59')
                 || (t.abre === '00:00' && t.fecha === '00:00');
      if (is24h) {
        if (t.dias.includes(dow)) return { status: 'open', fechaStr: '24h' };
        continue;
      }

      const abre  = parse(t.abre);
      const fecha = parse(t.fecha);
      if (abre === fecha) { // intervalo nulo, ignora este turno
        continue;
      }

      const viraNoite  = fecha < abre;            // ex: 22:00 → 02:00
      const abreHoje   = t.dias.includes(dow);
      const abriuOntem = t.dias.includes((dow + 6) % 7);

      // Vira a noite: abriu ontem e ainda não fechou
      if (viraNoite && abriuOntem && nowMin < fecha)
        return { status: 'open', fechaStr: t.fecha };

      if (abreHoje) {
        if (!viraNoite) {
          if (nowMin >= abre && nowMin < fecha)
            return { status: 'open', fechaStr: t.fecha };
          // fechado neste turno — lembra do "abre às" se ainda não abriu hoje
          if (nowMin < abre && melhorFechado === null) melhorFechado = t.abre;
        } else {
          // vira a noite e abre hoje: aberto se já passou da abertura
          if (nowMin >= abre) return { status: 'open', fechaStr: t.fecha };
          if (melhorFechado === null) melhorFechado = t.abre;
        }
      }
    }

    return { status: 'closed', fechaStr: melhorFechado || '' };
  }

  /* ── extrairTurnos: normaliza o horário da loja em lista de turnos ──
     Retorna [{dias:[0..6], abre:'HH:MM', fecha:'HH:MM'}, ...].
     Prioriza o texto multi-turno (separado por "|"); se não houver,
     usa o objeto estruturado loja.horario (turno único legado). */
  function extrairTurnos(loja) {
    const DIAS_IDX = { dom:0, seg:1, ter:2, qua:3, qui:4, sex:5, sab:6 };
    const txt = String(loja.horarioTexto || loja.horario_texto || '').trim();

    if (txt && txt.indexOf('|') !== -1) {
      const turnos = [];
      txt.split('|').forEach(parte => {
        parte = parte.trim();
        // "Seg, Ter, Qua 08:00-18:00"
        const m = parte.match(/^(.+?)\s+(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/);
        if (!m) return;
        const dias = m[1].split(',').map(d => {
          const key = d.trim().toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '').slice(0, 3); // remove acento, sáb→sab
          return DIAS_IDX[key];
        }).filter(d => d !== undefined);
        const fmt = hm => {
          const mm = hm.match(/(\d{1,2}):(\d{2})/);
          const h = Math.min(23, parseInt(mm[1], 10));
          const mi = Math.min(59, parseInt(mm[2], 10));
          return (h < 10 ? '0' : '') + h + ':' + (mi < 10 ? '0' : '') + mi;
        };
        if (dias.length) turnos.push({ dias, abre: fmt(m[2]), fecha: fmt(m[3]) });
      });
      if (turnos.length) return turnos;
    }

    // Fallback: estruturado legado (turno único)
    if (loja.horario && loja.horario.abre && loja.horario.fecha
        && Array.isArray(loja.horario.dias) && loja.horario.dias.length) {
      return [{
        dias: loja.horario.dias.slice(),
        abre: loja.horario.abre,
        fecha: loja.horario.fecha,
      }];
    }
    return [];
  }

  // Compat: calcStatus continua retornando só a string (usado em vários lugares)
  function calcStatus(loja) { return calcStatusInfo(loja).status; }

  /* ── Badge de status ─────────────────────────────────────── */
  // fechaStr opcional: se fornecido, exibe "Aberto até HH:MM" ou "Abre às HH:MM"
  function badgeHTML(status, fechaStr, agendado) {
    if (status === 'open') {
      const label = fechaStr ? `Aberto até ${fechaStr}` : 'Aberto Agora';
      return `<span class="badge badge-open"><span class="badge-dot"></span>${label}</span>`;
    }
    if (status === 'zap') {
      const zLabel = agendado ? 'Sob agendamento' : 'Chamar no Zap';
      return `<span class="badge badge-zap"><span class="badge-dot"></span>${zLabel}</span>`;
    }
    // closed
    const label = fechaStr ? `Abre às ${fechaStr}` : 'Fechado';
    return `<span class="badge badge-closed"><span class="badge-dot"></span>${label}</span>`;
  }

  /* ── Formata telefone para exibição ─────────────────────── */
  function formatTel(num) {
    const d = String(num || '').replace(/\D/g,'');
    // Fix 8: 0800 com 11 dígitos (ex: 08007257333 → 0800 725 7333)
    if (d.length === 11 && d.startsWith('0800')) return `${d.slice(0,4)} ${d.slice(4,7)} ${d.slice(7)}`;
    if (d.length === 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
    if (d.length === 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
    return num;
  }

  /* ── Escapa aspas em strings usadas em atributos HTML ───────── */
  function escAttr(s) {
    // Barra invertida primeiro para nao re-escapar as entidades inseridas depois.
    // Protege onclick inline (registrarClique) contra nomes com \\ ' " e quebra de linha.
    return String(s)
      .replace(/\\/g, '&#92;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/[\r\n]/g, ' ');
  }

  /* ── Botão de contato ────────────────────────────────────── */
  function contatoHTML(loja, status) {
    const abre     = loja.horario ? loja.horario.abre : '';
    const nomeAttr = escAttr(loja.nome); // Fix 4: escapa aspas para data-attr seguro
    // Campos para métricas — escapados para uso seguro em onclick inline
    const mNome = escAttr(loja.nome);
    const mPlan = escAttr(loja.plano || 'GRATIS');
    const mCat  = escAttr(loja.categoria || '');

    if ((!loja.wpp || loja.wpp === 'PREENCHER') && !loja.tel) {
      return `<button class="btn-wpp disabled" disabled aria-label="Sem contato"><i class="fab fa-whatsapp"></i></button>`;
    }

    if (loja.tel && !loja.wpp) {
      if (status === 'closed') {
        return `<button class="btn-tel closed"
          data-nome="${nomeAttr}" data-abre="${abre}" data-tel="${loja.tel}"
          onclick="showToast(this.dataset.nome,this.dataset.abre,this.dataset.tel)"
          aria-label="Loja fechada"><i class="fa fa-phone"></i></button>`;
      }
      return `<a href="tel:${loja.tel}" class="btn-tel open" aria-label="Ligar"
        data-nome="${mNome}" data-tipo="tel" data-plano="${mPlan}" data-cat="${mCat}"
        onclick="registrarClique(this.dataset.nome,this.dataset.tipo,this.dataset.plano,this.dataset.cat)">
        <i class="fa fa-phone"></i></a>`;
    }

    const msg = encodeURIComponent(saudacaoWhats(loja));
    const url = `https://wa.me/${loja.wpp}?text=${msg}`;

    if (status === 'open' || status === 'zap') {
      const cls = status === 'zap' ? 'zap' : 'open';
      return `<a href="${url}" target="_blank" rel="noopener" class="btn-wpp ${cls}" aria-label="WhatsApp"
        data-nome="${mNome}" data-tipo="wpp" data-plano="${mPlan}" data-cat="${mCat}"
        onclick="registrarClique(this.dataset.nome,this.dataset.tipo,this.dataset.plano,this.dataset.cat)">
        <i class="fab fa-whatsapp"></i></a>`;
    }

    return `<button class="btn-wpp closed"
      data-nome="${nomeAttr}" data-abre="${abre}"
      onclick="showToast(this.dataset.nome,this.dataset.abre)"
      aria-label="Loja fechada"><i class="fab fa-whatsapp"></i></button>`;
  }

  /* ── Lightbox de foto do anúncio (estilo status WPP) ─────── */
  // Persistência: marca qual VERSÃO do anúncio de cada loja já foi vista.
  // A chave inclui uma assinatura do conteúdo (texto+imagem), então se o
  // lojista publicar um anúncio novo, o ring reaparece — igual ao WhatsApp.
  const _ANUNCIO_VISTOS_KEY = 'angatuba_anuncios_vistos';
  // Fase 2: visto POR STORY (estilo WhatsApp). Guarda um mapa { storyKey: 1 }.
  // Ao abrir, começamos no primeiro story ainda não visto; os já vistos são
  // pulados. Chave por story = hash de id+mídia+texto, então editar um story
  // o torna "não visto" de novo (conta como novo, igual post novo no zap).
  const _STORY_VISTOS_KEY = 'angatuba_story_vistos';

  function _carregarStoryVistos() {
    try {
      const raw = localStorage.getItem(_STORY_VISTOS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
  }

  // Chave estável de um story individual (djb2 sobre id+mídia+texto).
  function _storyKey(st) {
    var base = (st.id || '') + '~' + (st.imagemUrl || '') + '~' + (st.texto || '');
    var h = 5381;
    for (var i = 0; i < base.length; i++) h = ((h << 5) + h + base.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  }

  function _storyJaVisto(st) {
    return !!_carregarStoryVistos()[_storyKey(st)];
  }

  function _marcarStoryVisto(st) {
    try {
      var v = _carregarStoryVistos();
      v[_storyKey(st)] = 1;
      // Poda simples: mantém no máx ~500 chaves para não crescer sem fim.
      var ks = Object.keys(v);
      if (ks.length > 500) { for (var i = 0; i < ks.length - 500; i++) delete v[ks[i]]; }
      localStorage.setItem(_STORY_VISTOS_KEY, JSON.stringify(v));
    } catch (e) {}
  }

  // Índice do primeiro story não visto. Se todos vistos, volta 0 (reabre do início).
  function _primeiroNaoVisto(stories) {
    var vistos = _carregarStoryVistos();
    for (var i = 0; i < stories.length; i++) {
      if (!vistos[_storyKey(stories[i])]) return i;
    }
    return 0;
  }

  // True se a loja tem ALGUM story não visto (para o anel ficar "aceso").
  function _lojaTemStoryNaoVisto(stories) {
    if (!stories || !stories.length) return false;
    var vistos = _carregarStoryVistos();
    for (var i = 0; i < stories.length; i++) {
      if (!vistos[_storyKey(stories[i])]) return true;
    }
    return false;
  }

  function _carregarVistos() {
    try {
      const raw = localStorage.getItem(_ANUNCIO_VISTOS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
  }

  // Fase 2: normaliza os stories de uma loja. Se vier o array 'stories' do
  // backend, usa-o; senão converte o anúncio único (Fase 1) em array de 1.
  // Também preenche loja.anuncio com o PRIMEIRO story, para que todo o código
  // legado de card/badge/modal (que lê loja.anuncio) siga funcionando.
  function _normalizarStories(loja) {
    if (!loja) return [];
    if (Array.isArray(loja._stories)) return loja._stories; // já normalizado
    var arr = [];
    if (Array.isArray(loja.stories) && loja.stories.length) {
      arr = loja.stories.filter(function(st){ return st && (st.texto || st.imagemUrl); });
    } else if (loja.anuncio && (loja.anuncio.texto || loja.anuncio.imagemUrl)) {
      arr = [loja.anuncio];
    }
    loja._stories = arr;
    // Espelha o primeiro no campo antigo (fonte para card/badge/modal).
    if (arr.length) loja.anuncio = arr[0];
    return arr;
  }

  // Assinatura curta e estável do conteúdo do anúncio (hash djb2)
  function _assinaturaAnuncio(loja) {
    var arr = _normalizarStories(loja);
    var base = arr.length
      ? arr.map(function(a){ return (a.texto||'') + '~' + (a.imagemUrl||''); }).join('|')
      : '';
    let h = 5381;
    for (let i = 0; i < base.length; i++) {
      h = ((h << 5) + h + base.charCodeAt(i)) | 0;
    }
    return (h >>> 0).toString(36);
  }

  // True se o anúncio ATUAL desta loja já foi visto
  function anuncioJaVisto(loja, lojaId) {
    const vistos = _carregarVistos();
    return vistos[lojaId] === _assinaturaAnuncio(loja);
  }

  function _marcarAnuncioVisto(lojaId, assinatura) {
    if (lojaId == null) return;
    try {
      const vistos = _carregarVistos();
      vistos[lojaId] = assinatura;
      localStorage.setItem(_ANUNCIO_VISTOS_KEY, JSON.stringify(vistos));
    } catch (e) {}
  }

  // Duração do "story" antes de fechar sozinho (ms)
  const _ANUNCIO_STORY_MS = 6000;

  function abrirFotoAnuncio(url, nomeAnuncio, lojaId, assinatura, nomeLoja, planoLoja, categoriaLoja, midiaTipo) {
    var _ehVideo = String(midiaTipo || 'foto') === 'video';
    const oldLb = document.getElementById('anuncio-lightbox');
    if (oldLb) oldLb.remove();

    // Métrica: conta UMA visualização por pessoa por versão do anúncio.
    // Se esta pessoa já viu esta mesma versão (assinatura já registrada no
    // localStorage), não conta de novo. Se o lojista publicar um anúncio
    // novo (assinatura muda), conta como uma nova visualização única.
    try {
      let jaContabilizado = false;
      if (lojaId != null && assinatura) {
        const vistos = _carregarVistos();
        jaContabilizado = (vistos[lojaId] === assinatura);
      }
      if (nomeLoja && !jaContabilizado) {
        registrarClique(nomeLoja, 'anuncio', planoLoja || 'PRO', categoriaLoja || '');
      }
    } catch (e) {}

    const lb = document.createElement('div');
    lb.id = 'anuncio-lightbox';
    lb.innerHTML = `
      <div id="anuncio-lightbox-bg"></div>
      <div id="anuncio-lightbox-wrap">
        <div id="anuncio-lightbox-progress"><span id="anuncio-lightbox-progress-fill"></span></div>
        <div id="anuncio-lightbox-topbar">
          <button id="anuncio-lightbox-close" aria-label="Fechar">
            <i class="ti ti-x"></i>
          </button>
          <span id="anuncio-lightbox-titulo">${escHTML(nomeAnuncio || '')}</span>
          ${_ehVideo ? `<button id="anuncio-lightbox-som" aria-label="Ativar som" title="Ativar som">
            <i class="ti ti-volume-off"></i>
          </button>` : ''}
        </div>
        <div id="anuncio-lightbox-imgwrap">
          <div id="anuncio-lightbox-spinner" aria-hidden="true"></div>
          ${_ehVideo
            ? `<video src="${escAttr(url)}" id="anuncio-lightbox-video" playsinline webkit-playsinline muted autoplay loop preload="auto"
                 style="max-width:100%;max-height:100%;object-fit:contain;"
                 oncanplay="this.classList.add('carregada');var s=document.getElementById('anuncio-lightbox-spinner');if(s)s.style.display='none';"
                 onerror="this.style.display='none';var s=document.getElementById('anuncio-lightbox-spinner');if(s)s.style.display='none';var w=document.getElementById('anuncio-lightbox-imgwrap');if(w)w.insertAdjacentHTML('beforeend','<p style=\'color:#fff;opacity:.55;font-size:13px\'>Vídeo indisponível</p>');"></video>`
            : `<img src="${escAttr(url)}" alt="${escAttr(nomeAnuncio || 'Anúncio')}" id="anuncio-lightbox-img" draggable="false"
                 onload="this.classList.add('carregada');var s=document.getElementById('anuncio-lightbox-spinner');if(s)s.style.display='none';"
                 onerror="this.style.display='none';var s=document.getElementById('anuncio-lightbox-spinner');if(s)s.style.display='none';var w=document.getElementById('anuncio-lightbox-imgwrap');if(w)w.insertAdjacentHTML('beforeend','<p style=\'color:#fff;opacity:.55;font-size:13px\'>Imagem indisponível</p>');" />`
          }
        </div>
      </div>`;
    document.body.appendChild(lb);

    lb.getBoundingClientRect();
    lb.classList.add('lb-visible');

    // Botão voltar do Android: cria entrada no histórico para que "voltar"
    // apenas feche o lightbox em vez de sair do app/PWA. O handler global de
    // popstate chama window._fecharAnuncioLightbox(true) quando isso ocorre.
    if (history.state?.modal !== 'anuncio-foto') {
      history.pushState({ modal: 'anuncio-foto' }, '');
    }

    let _fechado = false;
    let _autoTimer = null;

    const fechar = (viaPopstate = false) => {
      if (_fechado) return;
      _fechado = true;
      if (_autoTimer) { clearTimeout(_autoTimer); _autoTimer = null; }
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('visibilitychange', onVisibility);
      window._fecharAnuncioLightbox = null;

      if (lojaId != null) {
        _marcarAnuncioVisto(lojaId, assinatura);
        document.querySelectorAll('.anuncio-ring').forEach(el => {
          if (el.getAttribute('data-loja-id') === String(lojaId)) {
            el.classList.add('ring-visto');
          }
        });
      }

      // Fechamento manual (X, tap, swipe, Escape): desfaz a entrada fantasma.
      // Se veio do popstate, o histórico já foi consumido — não mexer.
      if (!viaPopstate && history.state?.modal === 'anuncio-foto') {
        history.back();
      }

      lb.classList.remove('lb-visible');
      lb.addEventListener('transitionend', () => lb.remove(), { once: true });
      setTimeout(() => { if (lb.parentNode) lb.remove(); }, 400);
    };

    // Exposto para o handler global de popstate fechar este lightbox.
    window._fecharAnuncioLightbox = fechar;

    // ── Barra de progresso do "story" ──────────────────────────
    const fill = lb.querySelector('#anuncio-lightbox-progress-fill');
    const _videoEl = lb.querySelector('#anuncio-lightbox-video');
    if (_ehVideo && _videoEl) {
      // Vídeo: a barra segue o tempo real do vídeo (timeupdate). Sem duração
      // fixa — respeita clipes de 5s ou 20s igualmente. Ao terminar, fecha.
      // A animação CSS é desligada; controlamos scaleX manualmente.
      if (fill) { fill.style.animation = 'none'; fill.style.transform = 'scaleX(0)'; }
      const _sync = () => {
        if (_fechado || !fill) return;
        const d = _videoEl.duration;
        if (d && isFinite(d) && d > 0) {
          fill.style.transform = 'scaleX(' + Math.min(_videoEl.currentTime / d, 1) + ')';
        }
      };
      _videoEl.addEventListener('timeupdate', _sync);
      // 'ended' não dispara com loop=true; usamos o próprio timeupdate para
      // fechar quando chega ao fim (evita depender de 'ended').
      _videoEl.addEventListener('timeupdate', () => {
        const d = _videoEl.duration;
        if (d && isFinite(d) && _videoEl.currentTime >= d - 0.15) fechar();
      });
      // Fallback: se os metadados não carregarem, fecha no tempo padrão.
      _autoTimer = setTimeout(() => { if (!_videoEl.duration) fechar(); }, _ANUNCIO_STORY_MS + 20000);
    } else if (fill) {
      fill.style.animationDuration = _ANUNCIO_STORY_MS + 'ms';
      // Auto-fecha ao fim da barra. Fechamento "automático" conta como manual
      // para fins de histórico (precisa desfazer a entrada fantasma).
      fill.addEventListener('animationend', () => fechar(), { once: true });
    } else {
      _autoTimer = setTimeout(() => fechar(), _ANUNCIO_STORY_MS);
    }

    // Controle de pausa robusto: contador de "travas" ativas.
    // Só retoma quando NENHUMA trava estiver ativa (dedo fora da tela).
    let _segurando = false;
    const pausar  = () => { _segurando = true;  if (fill) fill.style.animationPlayState = 'paused';
      if (_ehVideo && _videoEl) { try { _videoEl.pause(); } catch(e){} } };
    const retomar = () => { _segurando = false; if (fill && !_fechado) fill.style.animationPlayState = 'running';
      if (_ehVideo && _videoEl && !_fechado) { try { _videoEl.play(); } catch(e){} } };

    const imgwrap = lb.querySelector('#anuncio-lightbox-imgwrap');
    const wrap    = lb.querySelector('#anuncio-lightbox-wrap');

    // Bloqueia o menu de contexto nativo (copiar/baixar imagem) — igual WhatsApp.
    // Sem isso o long-press abre o menu do Chrome e "rouba" o touchend, travando o timer.
    lb.addEventListener('contextmenu', (e) => { e.preventDefault(); return false; });

    lb.querySelector('#anuncio-lightbox-close').onclick = (e) => { e.stopPropagation(); fechar(); };
    lb.querySelector('#anuncio-lightbox-bg').onclick = () => fechar();

    // Botão de som (só vídeo). O vídeo começa MUDO porque o navegador bloqueia
    // autoplay com áudio; o cliente toca aqui para ativar. stopPropagation em
    // todos os eventos de ponteiro para não fechar/pausar o story ao tocar.
    const _somBtn = lb.querySelector('#anuncio-lightbox-som');
    if (_somBtn && _ehVideo && _videoEl) {
      const _stop = (e) => { e.stopPropagation(); };
      _somBtn.addEventListener('touchstart', _stop, { passive: true });
      _somBtn.addEventListener('touchend', _stop, { passive: true });
      _somBtn.addEventListener('mousedown', _stop);
      _somBtn.addEventListener('mouseup', _stop);
      _somBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        _videoEl.muted = !_videoEl.muted;
        // Ao ativar o som, garante volume audível e que o vídeo está tocando.
        if (!_videoEl.muted) { _videoEl.volume = 1; try { _videoEl.play(); } catch(err){} }
        const ic = _somBtn.querySelector('i');
        if (ic) ic.className = _videoEl.muted ? 'ti ti-volume-off' : 'ti ti-volume';
        _somBtn.setAttribute('aria-label', _videoEl.muted ? 'Ativar som' : 'Silenciar');
        _somBtn.setAttribute('title', _videoEl.muted ? 'Ativar som' : 'Silenciar');
      });
    }

    // Se a aba perde foco/volta, garante estado coerente do progresso.
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') { if (fill) fill.style.animationPlayState = 'paused'; }
      else if (!_segurando) { retomar(); }
    };
    document.addEventListener('visibilitychange', onVisibility);

    if (imgwrap) {
      let _touchStartY = null, _touchStartT = 0, _moveu = false;

      imgwrap.addEventListener('touchstart', (e) => {
        _touchStartY = e.touches[0].clientY;
        _touchStartT = Date.now();
        _moveu = false;
        pausar(); // segurar pausa imediatamente
      }, { passive: true });

      imgwrap.addEventListener('touchmove', (e) => {
        if (_touchStartY == null) return;
        const dy = e.touches[0].clientY - _touchStartY;
        if (Math.abs(dy) > 8) _moveu = true;
        // swipe-down arrasta o lightbox
        if (dy > 8) {
          lb.style.transform = 'translateY(' + Math.min(dy, 400) + 'px)';
          lb.style.opacity = String(Math.max(1 - dy / 500, 0.2));
        }
      }, { passive: true });

      const _fimToque = () => {
        const dur = Date.now() - _touchStartT;
        const t = lb.style.transform;
        const dy = t ? parseFloat(t.replace(/[^0-9.]/g, '')) || 0 : 0;
        if (dy > 110) { fechar(); return; }
        // tap rápido (curto e sem mover) fecha; long-press apenas retoma
        if (!_moveu && dur < 250) { fechar(); return; }
        lb.style.transform = ''; lb.style.opacity = '';
        retomar(); // soltou o dedo → volta a contar
        _touchStartY = null;
      };
      imgwrap.addEventListener('touchend', _fimToque, { passive: true });
      // touchcancel dispara quando o sistema "rouba" o toque (menu, gesto do SO).
      // ESSENCIAL: sem isto o timer ficava travado em 'paused' pra sempre.
      imgwrap.addEventListener('touchcancel', () => {
        lb.style.transform = ''; lb.style.opacity = '';
        retomar();
        _touchStartY = null;
      }, { passive: true });

      // Desktop: segurar pausa, soltar retoma, clique simples fecha
      let _mouseDownT = 0, _mouseMoved = false, _mouseStartY = 0;
      imgwrap.addEventListener('mousedown', (e) => { _mouseDownT = Date.now(); _mouseMoved = false; _mouseStartY = e.clientY; pausar(); });
      imgwrap.addEventListener('mousemove', (e) => { if (_mouseDownT && Math.abs(e.clientY - _mouseStartY) > 6) _mouseMoved = true; });
      imgwrap.addEventListener('mouseup', () => {
        const dur = Date.now() - _mouseDownT;
        retomar();
        if (!_mouseMoved && dur < 250) fechar();
        _mouseDownT = 0;
      });
      // Se o mouse sai da área enquanto pressionado, retoma (não trava)
      imgwrap.addEventListener('mouseleave', () => { if (_mouseDownT) { retomar(); _mouseDownT = 0; } });
    }

    const onKey = (e) => { if (e.key === 'Escape') fechar(); };
    document.addEventListener('keydown', onKey);
  }
  window.abrirFotoAnuncio = abrirFotoAnuncio;

  // Abre o lightbox do anúncio lendo os dados do próprio elemento (data-*),
  // em vez de interpolar strings no onclick inline — nomes com aspas/apóstrofo
  // (ex.: "D'Angelo") decodificavam de volta e quebravam o handler. (#2/#3)
  window.abrirFotoAnuncioEl = function (el) {
    if (!el) return;
    const d = el.dataset;
    abrirFotoAnuncio(d.auImg, d.auTxt, d.auId, d.auAss, d.auNome, d.auPlano, d.auCat, d.auTipo);
  };

  // ══════════════════════════════════════════════════════════════
  //  FASE 2 — Lightbox de MÚLTIPLOS stories (navegável, estilo Instagram).
  //  Barra segmentada (1 por story), foto 6s, vídeo = duração real,
  //  avança ao terminar, fecha no último. Tap direita=próximo,
  //  esquerda=anterior, long-press=pausa, swipe-down=fecha.
  // ══════════════════════════════════════════════════════════════
  function abrirStories(stories, nomeLoja, lojaId, assinatura, planoLoja, categoriaLoja) {
    stories = (stories || []).filter(function(st){ return st && (st.texto || st.imagemUrl); });
    if (!stories.length) return;
    var oldLb = document.getElementById('anuncio-lightbox');
    if (oldLb) oldLb.remove();

    // Métrica: 1 view por pessoa por versão do conjunto (mesma regra da Fase 1).
    try {
      var jaCont = false;
      if (lojaId != null && assinatura) { var v = _carregarVistos(); jaCont = (v[lojaId] === assinatura); }
      if (nomeLoja && !jaCont) registrarClique(nomeLoja, 'anuncio', planoLoja || 'PRO', categoriaLoja || '');
    } catch (e) {}

    var idx = 0; // story atual
    var _fechado = false;
    var _timer = null;

    var lb = document.createElement('div');
    lb.id = 'anuncio-lightbox';
    // Barra segmentada: um <span> por story dentro de um wrapper flex.
    var segs = stories.map(function(_, i){
      return '<span class="anuncio-seg" data-i="' + i + '"><span class="anuncio-seg-fill"></span></span>';
    }).join('');
    lb.innerHTML =
      '<div id="anuncio-lightbox-bg"></div>' +
      '<div id="anuncio-lightbox-wrap">' +
        '<div id="anuncio-lightbox-segs">' + segs + '</div>' +
        '<div id="anuncio-lightbox-topbar">' +
          '<button id="anuncio-lightbox-close" aria-label="Fechar"><i class="ti ti-x"></i></button>' +
          '<span id="anuncio-lightbox-titulo">' + escHTML(nomeLoja || '') + '</span>' +
          '<button id="anuncio-lightbox-som" aria-label="Ativar som" title="Ativar som" style="display:none;"><i class="ti ti-volume-off"></i></button>' +
        '</div>' +
        '<div id="anuncio-lightbox-imgwrap">' +
          '<div id="anuncio-lightbox-spinner" aria-hidden="true"></div>' +
          '<div id="anuncio-story-slot"></div>' +
          '<div id="anuncio-story-caption"></div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(lb);
    lb.getBoundingClientRect();
    lb.classList.add('lb-visible');

    if (history.state && history.state.modal === 'anuncio-foto') { /* já */ }
    else { history.pushState({ modal: 'anuncio-foto' }, ''); }

    var slot    = lb.querySelector('#anuncio-story-slot');
    var caption = lb.querySelector('#anuncio-story-caption');
    var spinner = lb.querySelector('#anuncio-lightbox-spinner');
    var somBtn  = lb.querySelector('#anuncio-lightbox-som');
    var segEls  = Array.prototype.slice.call(lb.querySelectorAll('.anuncio-seg-fill'));

    function _pintarSegsAntes() {
      // Segmentos já vistos ficam cheios; o atual anima; os próximos vazios.
      for (var i = 0; i < segEls.length; i++) {
        var f = segEls[i];
        f.style.animation = 'none';
        f.style.transform = (i < idx) ? 'scaleX(1)' : 'scaleX(0)';
      }
    }

    var fechar = function (viaPopstate) {
      if (_fechado) return; _fechado = true;
      if (_timer) { clearTimeout(_timer); _timer = null; }
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('visibilitychange', onVis);
      window._fecharAnuncioLightbox = null;
      if (lojaId != null) {
        // Mantém a assinatura antiga por compat, mas o estado do anel agora vem
        // do visto POR STORY. Só apaga o anel se TODOS os stories foram vistos
        // (o usuário pode ter fechado no meio — aí o anel segue aceso).
        _marcarAnuncioVisto(lojaId, assinatura);
        if (!_lojaTemStoryNaoVisto(stories)) {
          document.querySelectorAll('.anuncio-ring').forEach(function(el){
            if (el.getAttribute('data-loja-id') === String(lojaId)) el.classList.add('ring-visto');
          });
        }
      }
      if (!viaPopstate && history.state && history.state.modal === 'anuncio-foto') history.back();
      lb.classList.remove('lb-visible');
      lb.addEventListener('transitionend', function(){ lb.remove(); }, { once: true });
      setTimeout(function(){ if (lb.parentNode) lb.remove(); }, 400);
    };
    window._fecharAnuncioLightbox = fechar;

    // Renderiza o story de índice i (mídia + legenda + botão de som se vídeo).
    function render(i) {
      if (_fechado) return;
      idx = i;
      if (idx >= stories.length) { fechar(); return; }
      if (idx < 0) idx = 0;
      if (_timer) { clearTimeout(_timer); _timer = null; }
      var st = stories[idx];
      _marcarStoryVisto(st); // visto individual (estilo WhatsApp)
      var ehVideo = String(st.midiaTipo || 'foto') === 'video';
      _pintarSegsAntes();
      // limpa slot
      slot.innerHTML = '';
      if (spinner) spinner.style.display = st.imagemUrl ? '' : 'none';
      // legenda (texto/emoji) sobreposta
      if (caption) {
        if (st.texto) {
          caption.innerHTML = '<span class="anuncio-cap-emoji">' + escHTML(st.emoji || '\ud83c\udfaf') + '</span> ' + escHTML(st.texto);
          caption.style.display = '';
        } else { caption.style.display = 'none'; }
      }
      var fill = segEls[idx];
      var startFillCss = function (ms) {
        if (!fill) return;
        fill.style.animation = 'none';
        // reflow para reiniciar a animação
        void fill.offsetWidth;
        fill.style.animation = 'anuncio-progress ' + ms + 'ms linear forwards';
        fill.addEventListener('animationend', function _ae(){ fill.removeEventListener('animationend', _ae); avancar(); }, { once: true });
      };
      if (ehVideo && st.imagemUrl) {
        if (somBtn) somBtn.style.display = '';
        var vid = document.createElement('video');
        vid.id = 'anuncio-lightbox-video';
        vid.src = st.imagemUrl;
        vid.setAttribute('playsinline',''); vid.setAttribute('webkit-playsinline','');
        vid.muted = true; vid.autoplay = true; vid.preload = 'auto';
        vid.style.cssText = 'max-width:100%;max-height:100%;object-fit:contain;';
        vid.oncanplay = function(){ vid.classList.add('carregada'); if (spinner) spinner.style.display='none'; };
        vid.onerror = function(){ if (spinner) spinner.style.display='none'; avancar(); };
        // barra segue o tempo real do vídeo
        vid.addEventListener('timeupdate', function(){
          if (!fill) return; var d = vid.duration;
          if (d && isFinite(d) && d > 0) fill.style.transform = 'scaleX(' + Math.min(vid.currentTime / d, 1) + ')';
        });
        vid.addEventListener('timeupdate', function(){
          var d = vid.duration; if (d && isFinite(d) && vid.currentTime >= d - 0.15) avancar();
        });
        if (fill) { fill.style.animation = 'none'; fill.style.transform = 'scaleX(0)'; }
        // fallback se metadados não vierem
        _timer = setTimeout(function(){ if (!vid.duration) avancar(); }, 25000);
        // botão de som deste story
        somBtn.onclick = function(e){ e.stopPropagation();
          vid.muted = !vid.muted;
          if (!vid.muted) { vid.volume = 1; try { vid.play(); } catch(err){} }
          var ic = somBtn.querySelector('i'); if (ic) ic.className = vid.muted ? 'ti ti-volume-off' : 'ti ti-volume';
        };
        slot.appendChild(vid);
        try { vid.play(); } catch(e){}
      } else {
        if (somBtn) somBtn.style.display = 'none';
        if (st.imagemUrl) {
          var img = document.createElement('img');
          img.id = 'anuncio-lightbox-img'; img.src = st.imagemUrl; img.draggable = false;
          img.onload = function(){ img.classList.add('carregada'); if (spinner) spinner.style.display='none'; };
          img.onerror = function(){ if (spinner) spinner.style.display='none'; };
          slot.appendChild(img);
        }
        startFillCss(_ANUNCIO_STORY_MS);
      }
      // Pré-carrega a mídia do próximo (leve) para transição fluida.
      var prox = stories[idx + 1];
      if (prox && prox.imagemUrl && String(prox.midiaTipo||'foto') !== 'video') {
        var pre = new Image(); pre.src = prox.imagemUrl;
      }
    }

    function avancar() { if (_fechado) return; if (idx + 1 >= stories.length) fechar(); else render(idx + 1); }
    function voltar()  { if (_fechado) return; if (idx <= 0) render(0); else render(idx - 1); }

    // pausa/retoma (long-press). Para vídeo, pausa o elemento; para foto,
    // pausa a animação CSS do segmento atual.
    var _segurando = false;
    function _fillAtual(){ return segEls[idx]; }
    function _vidAtual(){ return lb.querySelector('#anuncio-lightbox-video'); }
    var pausar = function(){ _segurando = true; var f=_fillAtual(); if (f) f.style.animationPlayState='paused'; var v=_vidAtual(); if (v){ try{v.pause();}catch(e){} } };
    var retomar = function(){ _segurando = false; if (_fechado) return; var f=_fillAtual(); if (f) f.style.animationPlayState='running'; var v=_vidAtual(); if (v){ try{v.play();}catch(e){} } };

    var imgwrap = lb.querySelector('#anuncio-lightbox-imgwrap');
    lb.addEventListener('contextmenu', function(e){ e.preventDefault(); return false; });
    lb.querySelector('#anuncio-lightbox-close').onclick = function(e){ e.stopPropagation(); fechar(); };
    lb.querySelector('#anuncio-lightbox-bg').onclick = function(){ fechar(); };

    var onVis = function(){
      if (document.visibilityState === 'hidden') { var f=_fillAtual(); if (f) f.style.animationPlayState='paused'; var v=_vidAtual(); if (v){ try{v.pause();}catch(e){} } }
      else if (!_segurando) retomar();
    };
    document.addEventListener('visibilitychange', onVis);

    if (imgwrap) {
      var _sy=null,_st0=0,_moveu=false,_downX=0;
      // Guarda contra o "ghost click": no celular, um toque dispara touchend E,
      // ~300ms depois, um mousedown/mouseup sintético. Sem isto, o toque avançava
      // DOIS stories (uma vez no touchend, outra no mouseup fantasma). Marcamos o
      // instante do último toque; os handlers de mouse ignoram eventos dentro da
      // janela do fantasma. No PC (sem touch) nada é ignorado.
      var _lastTouch = 0;
      var _ehFantasma = function(){ return (Date.now() - _lastTouch) < 700; };
      imgwrap.addEventListener('touchstart', function(e){ _lastTouch=Date.now(); _sy=e.touches[0].clientY; _downX=e.touches[0].clientX; _st0=Date.now(); _moveu=false; pausar(); }, { passive:true });
      imgwrap.addEventListener('touchmove', function(e){ _lastTouch=Date.now(); if (_sy==null) return; var dy=e.touches[0].clientY-_sy; if (Math.abs(dy)>8) _moveu=true; if (dy>8){ lb.style.transform='translateY('+Math.min(dy,400)+'px)'; lb.style.opacity=String(Math.max(1-dy/500,0.2)); } }, { passive:true });
      var _fim = function(e){
        _lastTouch=Date.now();
        var dur = Date.now()-_st0; var t=lb.style.transform; var dy=t?parseFloat(t.replace(/[^0-9.]/g,''))||0:0;
        if (dy>110){ fechar(); return; }
        lb.style.transform=''; lb.style.opacity='';
        if (!_moveu && dur<250){
          // tap curto: metade direita avança, esquerda volta.
          var x = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0].clientX : _downX;
          if (x < window.innerWidth * 0.33) voltar(); else avancar();
          return;
        }
        retomar(); _sy=null;
      };
      imgwrap.addEventListener('touchend', _fim, { passive:true });
      imgwrap.addEventListener('touchcancel', function(){ _lastTouch=Date.now(); lb.style.transform=''; lb.style.opacity=''; retomar(); _sy=null; }, { passive:true });
      // desktop (mouse). Ignora eventos sintéticos logo após um toque real.
      var _mdT=0,_mMoved=false,_mx=0,_my=0;
      imgwrap.addEventListener('mousedown', function(e){ if (_ehFantasma()) return; _mdT=Date.now(); _mMoved=false; _mx=e.clientX; _my=e.clientY; pausar(); });
      imgwrap.addEventListener('mousemove', function(e){ if (_mdT && (Math.abs(e.clientX-_mx)>6||Math.abs(e.clientY-_my)>6)) _mMoved=true; });
      imgwrap.addEventListener('mouseup', function(e){ if (_ehFantasma()) return; var dur=Date.now()-_mdT; retomar(); if (!_mMoved && dur<250){ if (e.clientX < window.innerWidth*0.33) voltar(); else avancar(); } _mdT=0; });
      imgwrap.addEventListener('mouseleave', function(){ if (_mdT){ retomar(); _mdT=0; } });
    }

    var onKey = function(e){ if (e.key==='Escape') fechar(); else if (e.key==='ArrowRight') avancar(); else if (e.key==='ArrowLeft') voltar(); };
    document.addEventListener('keydown', onKey);

    // Começa no primeiro story ainda não visto (estilo WhatsApp). Se todos já
    // foram vistos, reabre do início.
    render(_primeiroNaoVisto(stories));
  }
  window.abrirStories = abrirStories;

  // Abre a sequência lendo o array do registro global pelo lojaId (data-* não
  // comporta um array; o thumb já guardou os stories em window._STORIES_REG).
  window.abrirStoriesEl = function (el) {
    if (!el) return;
    var d = el.dataset;
    var reg = (window._STORIES_REG || {});
    var arr = reg[String(d.auId)] || reg[String(d.lojaId)] || [];
    if (!arr.length) {
      // Fallback: se por algum motivo o registro sumiu, abre o único do data-*.
      if (d.auImg || d.auTxt) arr = [{ midiaTipo: d.auTipo || 'foto', imagemUrl: d.auImg || '', texto: d.auTxt || '', emoji: '\ud83c\udfaf' }];
    }
    abrirStories(arr, d.auNome, d.auId, d.auAss, d.auPlano, d.auCat);
  };

  // Monta os atributos data-* seguros do anel de anúncio (card e modal).
  function _ringAnuncioData(loja, lojaId, assinatura) {
    return 'data-loja-id="' + escAttr(lojaId) + '"'
      + ' data-au-img="'   + escAttr(loja.anuncio.imagemUrl) + '"'
      + ' data-au-txt="'   + escAttr(loja.anuncio.texto || loja.nome) + '"'
      + ' data-au-id="'    + escAttr(lojaId) + '"'
      + ' data-au-ass="'   + escAttr(assinatura) + '"'
      + ' data-au-nome="'  + escAttr(loja.nome) + '"'
      + ' data-au-plano="' + escAttr(loja.plano || 'PRO') + '"'
      + ' data-au-cat="'   + escAttr(loja.categoria || '') + '"'
      + ' data-au-tipo="'  + escAttr((loja.anuncio && loja.anuncio.midiaTipo) || 'foto') + '"';
  }

  // Fallback do logo no card (#3): tenta a extensão alternativa e, se falhar,
  // cai no emoji. Lê data-* em vez de interpolar valores no onerror inline.
  window.thumbLogoFallback = function (img) {
    if (!img) return;
    const alt = img.dataset.alt || '';
    if (alt && img.dataset.altTried !== '1' && img.src !== alt) {
      img.dataset.altTried = '1';
      img.src = alt;
      return;
    }
    img.style.display = 'none';
    if (img.parentElement) img.parentElement.textContent = img.dataset.emoji || '';
  };

  /* ── Thumb ───────────────────────────────────────────────── */
  function thumbHTML(loja) {
    const bg    = CAT_BG[loja.categoria] || 'rgba(255,255,255,0.06)';
    // Ring "status WPP" — aparece apenas para PRO com foto de anúncio
    var _storiesArr = _normalizarStories(loja);
    const temFotoAnuncio = (loja.plano || '').toUpperCase() === 'PRO'
      && _storiesArr.some(function(st){ return st.imagemUrl; });
    const lojaId = loja.id || loja.wpp || loja.nome;
    const assinatura = temFotoAnuncio ? _assinaturaAnuncio(loja) : '';
    // Anel "aceso" (não visto) enquanto houver QUALQUER story não visto — igual
    // ao zap. Vira apagado só quando todos os stories foram vistos.
    const jaVisto = temFotoAnuncio && !_lojaTemStoryNaoVisto(_storiesArr);
    // Guarda os stories desta loja num registro global, endereçado pelo lojaId,
    // para o clique do anel abrir a sequência (data-* não comporta um array).
    if (temFotoAnuncio) { try { (window._STORIES_REG = window._STORIES_REG || {})[String(lojaId)] = _storiesArr; } catch(e){} }
    const ringOpen  = temFotoAnuncio
      ? `<div class="anuncio-ring${jaVisto ? ' ring-visto' : ''}" ${_ringAnuncioData(loja, lojaId, assinatura)} onclick="event.stopPropagation();abrirStoriesEl(this)" title="Ver stories">`
      : '';
    const isPro = (loja.plano || '').toUpperCase() === 'PRO';

    // Logo no card: só PRO
    if (isPro && loja.logo && loja.logo.trim()) {
      const alt = loja.logo.replace(/\.(png)$/i, '.jpg').replace(/\.(jpg|jpeg)$/i, '.png');
      return `${ringOpen}<div class="store-thumb" style="background:${bg}; overflow:hidden;">
        <img src="${escAttr(loja.logo)}" alt="Logo ${escHTML(loja.nome)}" class="store-logo-img" loading="lazy"
          data-alt="${escAttr(alt)}" data-emoji="${escAttr(emojiLoja(loja))}" onerror="thumbLogoFallback(this)" />
      </div>${ringOpen ? '</div>' : ''}`;
    }

    if (!loja.recomendado && loja.foto && loja.foto.trim()) {
      return `${ringOpen}<div class="store-thumb" style="background:${bg};">
        <img src="${escAttr(loja.foto)}" alt="${escHTML(loja.nome)}" loading="lazy" />
      </div>${ringOpen ? '</div>' : ''}`;
    }

    return `${ringOpen}<div class="store-thumb" style="background:${bg};">${escHTML(emojiLoja(loja))}</div>${ringOpen ? '</div>' : ''}`;
  }

  /* ── HTML de um card ─────────────────────────────────────── */
  // statusInfo pode ser string (compat) ou objeto { status, fechaStr }
  function cardHTML(loja, delay, statusInfo, idx) {
    // normaliza entrada: aceita string legada ou objeto novo
    let status, fechaStr, agendado;
    if (statusInfo && typeof statusInfo === 'object') {
      status   = statusInfo.status;
      fechaStr = statusInfo.fechaStr || '';
      agendado = !!statusInfo.agendado;
    } else {
      const _si = calcStatusInfo(loja);
      status   = statusInfo ?? _si.status;
      fechaStr = '';
      agendado = !!_si.agendado;
    }

    const plano  = (loja.plano || 'GRATIS').toUpperCase();
    const isPro  = plano === 'PRO';
    const isPlus = plano === 'PLUS';
    const isPago = isPro || isPlus;

    // Foto de capa apenas no PRO
    const hasCover = isPro && loja.foto && loja.foto.trim();

    // Indicador visual de localização — SEM href para não abrir maps no clique acidental
    // A função de abrir o maps fica apenas dentro do modal de detalhes
    const mapPin = loja.maps
      ? `<span class="contact-tag maps" title="Localização disponível"><i class="fa fa-map-marker-alt"></i> MAPS</span>`
      : '';

    const ctTag = loja.tel && !loja.wpp
      ? `<span class="contact-tag tel">📞 TEL</span>`
      : `<span class="contact-tag wpp">💬 WPP</span>`;

    // Linha de indicadores visuais (mapPin + ctTag) — fica no rodapé do card
    // Posição abaixo de "Ver detalhes" para evitar cliques acidentais ao abrir o card
    const indicadoresFooter = (mapPin || ctTag)
      ? `<div style="display:flex;align-items:center;gap:4px;margin-top:3px;">${mapPin}${ctTag}</div>`
      : '';

    // Selo visual por plano
    let planBadge = '';
    if (isPro)  planBadge = `<span class="plan-badge badge-pro">⭐ PRO</span>`;
    if (isPlus) planBadge = `<span class="plan-badge badge-plus">✦ PLUS</span>`;

    // Classes do card
    let cardClass = 'store-card fade-in';
    if (isPro)    cardClass += ' plano-pro';
    if (isPlus)   cardClass += ' plano-plus';
    if (hasCover) cardClass += ' has-cover';

    // #3: remove caracteres que poderiam encerrar o url()/atributo antes da hora.
    // URLs de imagem válidas (Cloudinary/ImgBB) não contêm aspas/parênteses/barra invertida.
    const _fotoCss = hasCover ? String(loja.foto).replace(/['"()\\]/g, '') : '';
    const bgStyle = hasCover ? `background-image:url('${_fotoCss}');` : '';

    // Todos os cards abrem o modal — pagos com visual completo, grátis simplificado.
    // #8: role=button + tabindex exigem ativação por teclado (Enter/Espaço).
    const infoClick = `onclick="abrirDetalhes(${idx})" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();abrirDetalhes(${idx});}" style="cursor:pointer;" role="button" tabindex="0"`;

    // Dica visual: "Ver detalhes" em todos, ícone diferente para grátis
    const expandHint = `<span style="font-size:9px;color:var(--muted);display:flex;align-items:center;gap:3px;margin-top:2px;">
           <i class="fa fa-${isPago ? 'expand-alt' : 'info-circle'}" style="font-size:8px;"></i> Ver detalhes
         </span>`;

    // Badge de anúncio do dia
    // Plus: texto + emoji | Pro: texto + emoji + indicador de foto (se houver)
    const temAnuncioPlus = (isPlus && loja.anuncio && loja.anuncio.texto);
    const temAnuncioPro  = (isPro  && loja.anuncio && loja.anuncio.texto);
    let anuncioBadge = '';
    if (temAnuncioPro || temAnuncioPlus) {
      // Badge de texto. Quando há foto, o gatilho visual é o anel animado no logo
      // (thumbHTML) — não duplicamos botão aqui pra não poluir o card.
      anuncioBadge = `<div class="store-anuncio-badge"><span>${escHTML(loja.anuncio.emoji || '🎯')}</span> ${escHTML(loja.anuncio.texto)}</div>`;
    }

    // Estrelas de avaliação — linha própria, só quando há avaliações
    let starsHTML = '';
    const avals = loja.avaliacoes;
    // #7: mostra a nota no card só com volume mínimo (>=3) — evita "5.0" de 1 avaliação
    if (avals && avals.length >= 3) {
      const media = avals.reduce((s, a) => s + (a.nota || 0), 0) / avals.length;
      const mediaFmt = media.toFixed(1);
      // Monta string de estrelas cheias/meia/vazias
      // #15: meia-estrela real via ligadura de fonte (FA6), não mais o glifo
      // ⭑ (estrela pequena) que parecia defeito visual em notas como 4.5.
      let estrelasHTML = '';
      for (let s = 1; s <= 5; s++) {
        if (media >= s - 0.25)      estrelasHTML += '<i class="fa-solid fa-star"></i>';
        else if (media >= s - 0.75) estrelasHTML += '<i class="fa-solid fa-star-half-stroke"></i>';
        else                        estrelasHTML += '<i class="fa-regular fa-star"></i>';
      }
      starsHTML = `<div class="store-stars">
        <span style="color:#f59e0b;letter-spacing:1px;font-size:10px;">${estrelasHTML}</span>
        <span style="font-weight:700;font-size:11px;color:#f59e0b;">${mediaFmt}</span>
        <span style="font-size:10px;color:var(--muted);">· ${avals.length} avaliação${avals.length > 1 ? 'ões' : ''}</span>
      </div>`;
    }

    return `
      <div class="${cardClass}"
        data-status="${status}" data-category="${loja.categoria}" data-plano="${plano}"
        style="animation-delay:${delay}s;${bgStyle}">
        ${thumbHTML(loja)}
        <div class="store-info" ${infoClick}>
          <div class="store-name-row">
            <div class="store-name">${escHTML(loja.nome)}</div>
            ${planBadge}
          </div>
          <div class="store-sub">${escHTML(loja.sub)}</div>
          <div class="store-row">${badgeHTML(status, fechaStr, agendado)}</div>
          ${starsHTML}
          ${anuncioBadge}
          ${expandHint}
          ${indicadoresFooter}
        </div>
        ${contatoHTML(loja, status)}
      </div>`;
  }

  /* ── Skeleton Loading ───────────────────────────────────── */
  function showSkeleton() {
    const listEl = document.getElementById('store-list');
    listEl.style.display = 'flex';
    listEl.innerHTML = Array(6).fill(0).map(() => `
      <div class="skeleton-card">
        <div class="skeleton-thumb"></div>
        <div class="skeleton-lines">
          <div class="skeleton-line"></div>
          <div class="skeleton-line short"></div>
          <div class="skeleton-line xshort"></div>
        </div>
      </div>`).join('');
  }

  function showSkeletonCat() {
    const bar = document.getElementById('cat-bar');
    bar.innerHTML = Array(9).fill(0).map(() => `
      <div class="skeleton-cat">
        <div class="skeleton-cat-icon"></div>
        <div class="skeleton-cat-label"></div>
      </div>`).join('');
  }

  /* ── Cache global de status — compartilhado entre renderLojas e renderCategorias ── */
  // Inicializado como Map vazio; populado por renderLojas a cada ciclo.
  // renderCategorias usa _statusSnapshot.get(l)?.status com fallback para calcStatus,
  // então é seguro mesmo antes do primeiro render.
  let _statusSnapshot = new Map();

  /* ── Cache de nós de card p/ reconciliação (#7) ─────────────
     chave estável (id > wpp > nome) → { html, el }. Reaproveita o
     nó quando o HTML não muda, evitando recriar <img> idênticos. */
  let _cardNodes = new Map();

  // Mostra/esconde o botao "Indicar um comercio" do estado vazio e monta o
  // link de WhatsApp pro admin ja com uma mensagem pronta. `contexto` e o que
  // faltou (nome da categoria como "Farmácias", ou o termo buscado entre aspas);
  // null esconde o botao.
  function _emptyIndicar(contexto) {
    const btn = document.getElementById('empty-indicar');
    if (!btn) return;
    if (!contexto) { btn.style.display = 'none'; return; }
    const lbl = document.getElementById('empty-indicar-label');
    if (lbl) lbl.textContent = 'Indicar ' + contexto;
    const msg = 'Olá! Procurei por ' + contexto + ' no AngatubaON e não encontrei. '
              + 'Queria indicar um estabelecimento pra vocês adicionarem. 🦉';
    btn.href = 'https://wa.me/' + ADMIN_WPP_CONTATO + '?text=' + encodeURIComponent(msg);
    btn.style.display = 'inline-flex';
  }

  /* ── Renderiza lista principal ───────────────────────────── */
  function renderLojas() {
    const listEl   = document.getElementById('store-list');
    const emptyEl  = document.getElementById('empty-state');
    const titleEl  = document.getElementById('list-title');
    const infoEl   = document.getElementById('filter-info');
    const emptyMsg = document.getElementById('empty-msg');
    const emptySub = document.getElementById('empty-sub');

    const q = searchQuery.toLowerCase().trim();

    // Memoiza calcStatusInfo para este render — cada loja calculada 1x só
    const statusCache = new Map();
    const getStatusInfo = loja => {
      if (!statusCache.has(loja)) statusCache.set(loja, calcStatusInfo(loja));
      return statusCache.get(loja);
    };
    const getStatus = loja => getStatusInfo(loja).status;

    let filtradas = LOJAS.filter(loja => {
      const catOk = activeCat === 'todos' || loja.categoria === activeCat;
      if (!catOk) return false;
      if (!q) return true;
      // Guard: garante que campos string existam antes de chamar .toLowerCase()
      const nome = (loja.nome  || '').toLowerCase();
      const tags = (loja.tags  || '').toLowerCase();
      const sub  = (loja.sub   || '').toLowerCase();
      if (nome.includes(q) || tags.includes(q) || sub.includes(q)) return true;
      // Sinônimos da categoria (ex.: buscar "hamburguer" acha lojas de "lanches")
      const sinonimos = CAT_BUSCA_MAP[loja.categoria];
      if (!!sinonimos && sinonimos.some(s => s.includes(q) || q.includes(s))) return true;
      // Último recurso: tolera 1 erro de digitação no nome ou nos sinônimos
      // ("acugue"→açougue, "farmacya"→farmácia). Só roda aqui, quando nada
      // bateu por substring — custo zero no caminho comum.
      if (_matchFuzzy(q, nome)) return true;
      return !!sinonimos && sinonimos.some(s => _matchFuzzy(q, s));
    });

    if (activePillFilter === 'open') {
      filtradas = filtradas.filter(l => getStatus(l) === 'open');
    } else if (activePillFilter === 'featured') {
      filtradas = filtradas.filter(l => l.recomendado === true);
    } else if (activePillFilter === 'delivery') {
      filtradas = filtradas.filter(l => l.fazEntrega === true);
    } else if (activePillFilter === 'favoritos') {
      filtradas = filtradas.filter(l => isFavorito(favIdDeLoja(l)));
    }

    if (activeBairro) {
      filtradas = filtradas.filter(l => lojaEhDoBairro(l, activeBairro));
    }

    // Peso por plano: PRO=0, PLUS=1, GRATIS=2
    const planOrd   = { PRO:0, PLUS:1, GRATIS:2 };
    // Peso por status: open=0, zap=1, closed=2
    const statusOrd = { open:0, zap:1, closed:2 };

    filtradas.sort((a, b) => {
      const planoA = (a.plano || 'GRATIS').toUpperCase();
      const planoB = (b.plano || 'GRATIS').toUpperCase();

      // 1º critério: plano
      const diffPlano = (planOrd[planoA] ?? 2) - (planOrd[planoB] ?? 2);
      if (diffPlano !== 0) return diffPlano;

      // 2º critério: recomendado (true sobe)
      const diffRec = (b.recomendado ? 1 : 0) - (a.recomendado ? 1 : 0);
      if (diffRec !== 0) return diffRec;

      // 3º critério: status (aberto sobe)
      const diffStatus = (statusOrd[getStatus(a)] ?? 2) - (statusOrd[getStatus(b)] ?? 2);
      if (diffStatus !== 0) return diffStatus;

      // 4º critério: ordem alfabética
      return a.nome.localeCompare(b.nome, 'pt-BR');
    });

    const abertas = filtradas.filter(l => getStatus(l) === 'open').length;

    // Perf (#7): reconciliação por chave estável em vez de reconstruir todo o
    // innerHTML a cada tecla/filtro. Reaproveita os nós cujo HTML não mudou —
    // não recria <img> idênticos (sem flicker/reload) e reduz thrash de layout.
    // O onclick inline de cada card carrega _lojaIdxMap.get(loja) — o índice REAL
    // da loja em LOJAS — para que abrirDetalhes(idx) abra sempre a loja certa.
    // O stagger posicional foi removido do HTML (assinatura independe da posição:
    // reordenar não recria o nó); cards novos ainda entram com fade via CSS.
    const _ordem  = [];
    const _vistos = new Set();
    for (let i = 0; i < filtradas.length; i++) {
      const loja  = filtradas[i];
      const idxReal = _lojaIdxMap.get(loja) ?? 0;
      const chave = favIdDeLoja(loja) || ('idx:' + idxReal);
      const html  = cardHTML(loja, 0, getStatusInfo(loja), idxReal);
      _vistos.add(chave);
      let entry = _cardNodes.get(chave);
      if (!entry || entry.html !== html) {
        const tmp = document.createElement('div');
        tmp.innerHTML = html;
        entry = { html, el: tmp.firstElementChild };
        _cardNodes.set(chave, entry);
      }
      if (entry.el) _ordem.push(entry.el);
    }
    // Descarta nós de lojas que saíram do resultado atual (evita vazamento do Map)
    _cardNodes.forEach((_v, k) => { if (!_vistos.has(k)) _cardNodes.delete(k); });
    // Reaplica na ordem: mover um nó já existente para o fragment NÃO o recria
    const _frag = document.createDocumentFragment();
    for (let i = 0; i < _ordem.length; i++) _frag.appendChild(_ordem[i]);
    listEl.replaceChildren(_frag);

    const temResultado = filtradas.length > 0;
    listEl.style.display = temResultado ? 'flex' : 'none';

    if (!temResultado) {
      emptyEl.style.display = 'block';
      const emptyOwl = document.getElementById('empty-owl');
      const owlOk = emptyOwl && emptyOwl.dataset.failed !== '1';
      const emptyTitle = document.getElementById('empty-title');
      // Uma categoria específica está selecionada (não "todos") e não há busca:
      // então o vazio é "não temos esse ramo ainda", não "não achei nada".
      const catEspecificaVazia = activeCat !== 'todos' && !q && activePillFilter === 'all' && !activeBairro;
      if (activePillFilter === 'favoritos') {
        document.getElementById('empty-icon').textContent = '❤️';
        if (owlOk) { emptyOwl.src = '/webp/owl-love.webp'; emptyOwl.style.display = 'block'; }
        if (emptyTitle) emptyTitle.textContent = 'Você ainda não tem lojas favoritas';
        emptyMsg.textContent = 'Toque no ❤️ de uma loja para salvá-la aqui e achar rapidinho depois.';
        emptySub.textContent = '';
        _emptyIndicar(null);
      } else if (LOJAS.length === 0) {
        document.getElementById('empty-icon').textContent = '🏗️';
        if (owlOk) { emptyOwl.src = '/webp/owl-idea.webp'; emptyOwl.style.display = 'block'; }
        if (emptyTitle) emptyTitle.textContent = 'Nenhuma loja por aqui ainda';
        emptyMsg.textContent = 'Seja o primeiro a cadastrar seu negócio em Angatuba!';
        emptySub.textContent = '';
        _emptyIndicar(null);
      } else if (catEspecificaVazia) {
        const catLabel = CATEGORIAS.find(c => c.id === activeCat)?.label ?? 'esse tipo';
        document.getElementById('empty-icon').textContent = '🔎';
        if (owlOk) { emptyOwl.src = '/webp/owl-search.webp'; emptyOwl.style.display = 'block'; }
        if (emptyTitle) emptyTitle.textContent = 'Ainda não temos ' + catLabel + ' aqui';
        emptyMsg.textContent = 'Conhece um bom estabelecimento de ' + catLabel + ' em Angatuba? Indique pra gente — a coruja convida!';
        emptySub.textContent = '';
        _emptyIndicar(catLabel);
      } else {
        document.getElementById('empty-icon').textContent = '🔍';
        if (owlOk) { emptyOwl.src = '/webp/owl-search.webp'; emptyOwl.style.display = 'block'; }
        if (emptyTitle) emptyTitle.textContent = 'Nenhuma loja encontrada';
        emptyMsg.textContent = 'A coruja procurou e não achou nada. Tente outro termo ou categoria.';
        emptySub.textContent = '';
        _emptyIndicar(q ? ('"' + q + '"') : null);
      }
    } else {
      emptyEl.style.display = 'none';
    }

    const catLabel = CATEGORIAS.find(c => c.id === activeCat)?.label ?? 'Todas';
    titleEl.textContent = q
      ? `🔍 "${q}"`
      : activeCat === 'todos' ? '📍 Todas as Lojas' : `📍 ${catLabel}`;

    infoEl.textContent = temResultado
      ? (abertas > 0 ? `${abertas} aberta${abertas>1?'s':''} agora` : 'Nenhuma aberta')
      : '';
    infoEl.className = 'filter-info' + (abertas > 0 ? ' has-open' : '');

    // Exporta snapshot para smartRefresh e renderCategorias
    _statusSnapshot = statusCache; // agora guarda { status, fechaStr }
  }

  /* ── Renderiza categorias ────────────────────────────────── */
  function renderCategorias() {
    const bar = document.getElementById('cat-bar');
    const getS = l => (_statusSnapshot.get(l)?.status) ?? calcStatus(l);

    bar.innerHTML = CATEGORIAS
      .filter(cat => {
        if (!cat || !cat.id || !cat.label) return false;
        // "Tudo" sempre aparece
        if (cat.id === 'todos') return true;
        // Só exibe se houver pelo menos 1 loja nessa categoria
        return LOJAS.some(l => l.categoria === cat.id);
      })
      .map(cat => {
        const qtd = cat.id === 'todos'
          ? LOJAS.filter(l => getS(l) === 'open').length
          : LOJAS.filter(l => l.categoria === cat.id && getS(l) === 'open').length;

        const badge    = qtd > 0 ? `<span class="cat-badge visible">${qtd}</span>` : '';
        const isActive = cat.id === activeCat;

        return `
          <button class="cat-item${isActive && cat.id !== 'todos' ? ' has-clear' : ''}" data-cat="${cat.id}" onclick="setCat('${cat.id}',this)">
            <div class="cat-icon ${isActive?'active':''}" style="background:${cat.bg};">
              <i class="ti ${cat.icon}" style="color:${cat.cor};"></i>
              ${badge}
            </div>
            <span class="cat-label">${cat.label}</span>
            ${cat.id !== 'todos' ? '<button class="cat-clear-btn" onclick="event.stopPropagation();limparCategoria()" aria-label="Limpar filtro">✕</button>' : ''}
          </button>`;
      }).join('');
  }

  /* ── Troca categoria ─────────────────────────────────────── */
  function setCat(cat, btn) {
    activeCat    = cat;
    searchQuery  = '';  // limpa busca ao trocar categoria
    const searchEl = document.getElementById('main-search');
    if (searchEl) searchEl.value = '';

    // Remove active de todos os ícones, marca só o clicado — sem re-renderizar o cat-bar inteiro
    document.querySelectorAll('.cat-icon').forEach(i => i.classList.remove('active'));
    document.querySelectorAll('.cat-item').forEach(i => i.classList.remove('has-clear'));
    btn.querySelector('.cat-icon').classList.add('active');
    // has-clear: mostra ✕ apenas quando não é "Todos"
    if (cat !== 'todos') btn.closest('.cat-item')?.classList.add('has-clear');

    activePillFilter = 'all';
    document.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));

    renderLojas();
  }

  /* ── Toast ───────────────────────────────────────────────── */
  let toastTimer = null;

  function showToast(nomeLoja, horarioAbre, tel) {
    const el    = document.getElementById('toast');
    const title = document.getElementById('toast-title');
    const msg   = document.getElementById('toast-msg');

    // Garante a coruja dormindo (o toast simples pode ter trocado antes)
    _setToastOwl('/webp/owl-sleeping.webp');

    title.textContent = `${nomeLoja} — fechado agora`;

    if (tel) {
      msg.innerHTML = horarioAbre
        ? `Abre às ${horarioAbre} · <a href="tel:${tel}" style="color:var(--zap);font-weight:600;">${formatTel(tel)}</a>`
        : `<a href="tel:${tel}" style="color:var(--zap);font-weight:600;">${formatTel(tel)}</a>`;
    } else {
      msg.textContent = horarioAbre
        ? `Atendimento começa às ${horarioAbre}`
        : 'Consulte o horário de funcionamento';
    }

    clearTimeout(toastTimer);
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
    toastTimer = setTimeout(hideToast, 4000);
  }

  function hideToast() {
    document.getElementById('toast').classList.remove('show');
    clearTimeout(toastTimer);
  }

  // Troca a coruja do toast (restaura src e visibilidade, mesmo após erro de load).
  function _setToastOwl(src) {
    const owl = document.getElementById('toast-owl');
    if (!owl) return;
    owl.style.display = '';
    owl.dataset.f = '';
    owl.src = src;
    // Esconde o ícone-fallback caso estivesse visível
    const fallback = owl.nextElementSibling;
    if (fallback && fallback.classList && fallback.classList.contains('toast-icon')) {
      fallback.style.display = 'none';
    }
  }

  // Toast genérico de mensagem curta (favoritos, avisos rápidos). Reusa o
  // elemento #toast, mas exibe só uma linha simples e some mais rápido.
  // owlSrc (opcional): caminho de uma coruja específica para o contexto.
  function showToastSimples(mensagem, owlSrc) {
    const el    = document.getElementById('toast');
    const title = document.getElementById('toast-title');
    const msg   = document.getElementById('toast-msg');
    if (!el || !title || !msg) return;
    if (owlSrc) _setToastOwl(owlSrc);
    title.textContent = mensagem;
    msg.textContent = '';
    clearTimeout(toastTimer);
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
    toastTimer = setTimeout(hideToast, 2200);
  }

  // Item 11: toast padronizado (avisos/sucesso/erro efemeros) no lugar de alert().
  // Reusa a infra visual de #toast (com a coruja) — troca a coruja conforme o tipo.
  function mlToast(mensagem, tipo, owlSrc) {
    var owl = owlSrc || (tipo === 'erro' ? '/webp/owl-sign.webp'
                       : tipo === 'ok'  ? '/webp/owl-thumbs-up.webp'
                       : '/webp/owl-tip.webp');
    if (typeof showToastSimples === 'function') { showToastSimples(mensagem, owl); return; }
    try { console.log('[toast]', mensagem); } catch(e) {}
  }

  // Prompt de texto no tema dark. Retorna Promise<string|null> — null = cancelou.
  // Existe porque o prompt() nativo abre com fundo branco e mostra o domínio
  // no iOS, quebrando o visual do painel (mesmo motivo do mlConfirmar).
  function mlPrompt(titulo, mensagem, opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var ov  = document.getElementById('ml-prompt-overlay');
      var tEl = document.getElementById('ml-prompt-titulo');
      var mEl = document.getElementById('ml-prompt-msg');
      var inp = document.getElementById('ml-prompt-input');
      var okB = document.getElementById('ml-prompt-ok');
      var cnB = document.getElementById('ml-prompt-cancel');
      var erE = document.getElementById('ml-prompt-erro');
      var owl = document.getElementById('ml-prompt-owl');
      if (!ov || !inp || !okB || !cnB) {
        var r = window.prompt((titulo ? titulo + '\n\n' : '') + (mensagem || ''), opts.valor || '');
        resolve(r === null ? null : String(r));
        return;
      }
      if (tEl) tEl.textContent = titulo || 'Editar';
      if (mEl) { mEl.textContent = mensagem || ''; mEl.style.display = mensagem ? '' : 'none'; }
      if (erE) erE.textContent = '';
      if (owl && opts.owlSrc) owl.src = opts.owlSrc;
      okB.textContent = opts.okLabel || 'Salvar';
      cnB.textContent = opts.cancelLabel || 'Cancelar';
      inp.value = opts.valor || '';
      inp.placeholder = opts.placeholder || '';
      if (opts.maxlength) inp.maxLength = opts.maxlength; else inp.removeAttribute('maxlength');

      var fechar = function (val) {
        ov.style.display = 'none';
        okB.onclick = null; cnB.onclick = null; ov.onclick = null; inp.onkeydown = null;
        document.removeEventListener('keydown', onKey);
        resolve(val);
      };
      var confirmar = function () {
        var v = String(inp.value || '').trim();
        if (!v) { if (erE) erE.textContent = 'Digite um nome.'; inp.focus(); return; }
        fechar(v);
      };
      var onKey = function (e) { if (e.key === 'Escape') fechar(null); };
      inp.onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); confirmar(); } };
      okB.onclick = confirmar;
      cnB.onclick = function () { fechar(null); };
      ov.onclick = function (e) { if (e.target === ov) fechar(null); };
      document.addEventListener('keydown', onKey);
      ov.style.display = 'flex';
      // Delay curto: no mobile, focar antes da pintura às vezes não abre o teclado.
      setTimeout(function () { try { inp.focus(); inp.select(); } catch (e) {} }, 60);
    });
  }
  window.mlPrompt = mlPrompt;

  // Item 11: modal de confirmacao no tema dark. Retorna Promise<boolean>.
  // Substitui o confirm() nativo (fundo branco + dominio no iOS).
  function mlConfirmar(titulo, mensagem, opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var ov = document.getElementById('ml-confirm-overlay');
      var tEl = document.getElementById('ml-confirm-titulo');
      var mEl = document.getElementById('ml-confirm-msg');
      var okB = document.getElementById('ml-confirm-ok');
      var cnB = document.getElementById('ml-confirm-cancel');
      var owl = document.getElementById('ml-confirm-owl');
      if (!ov || !tEl || !mEl || !okB || !cnB) { resolve(window.confirm((titulo ? titulo + '\n\n' : '') + (mensagem || ''))); return; }
      tEl.textContent = titulo || 'Confirmar';
      mEl.textContent = mensagem || '';
      mEl.style.whiteSpace = 'pre-line';
      okB.textContent = opts.okLabel || (opts.soOk ? 'Entendi' : 'Confirmar');
      cnB.textContent = opts.cancelLabel || 'Cancelar';
      cnB.style.display = opts.soOk ? 'none' : '';
      if (opts.soOk && !opts.okCor) {
        okB.style.background = 'var(--surface2)';
        okB.style.color = 'var(--text)';
        okB.style.border = '1px solid var(--border)';
      } else {
        okB.style.background = (opts.okCor === 'ok') ? 'var(--green)' : 'var(--red)';
        okB.style.color = (opts.okCor === 'ok') ? '#000' : '#fff';
        okB.style.border = 'none';
      }
      if (owl && opts.owlSrc) owl.src = opts.owlSrc;
      var fechar = function (val) {
        ov.style.display = 'none';
        okB.onclick = null; cnB.onclick = null; ov.onclick = null;
        document.removeEventListener('keydown', onKey);
        resolve(val);
      };
      var onKey = function (e) {
        if (e.key === 'Escape') fechar(false);
        else if (e.key === 'Enter') fechar(true);
      };
      okB.onclick = function () { fechar(true); };
      cnB.onclick = function () { fechar(false); };
      ov.onclick = function (e) { if (e.target === ov) fechar(false); };
      document.addEventListener('keydown', onKey);
      ov.style.display = 'flex';
      okB.focus();
    });
  }
  window.mlConfirmar = mlConfirmar;
  window.mlToast = mlToast;

  // Item 11b: aviso informativo (so OK) no tema dark — reusa o overlay do mlConfirmar.
  function mlAviso(titulo, mensagem, owlSrc) {
    return mlConfirmar(titulo, mensagem, { soOk: true, owlSrc: owlSrc });
  }
  window.mlAviso = mlAviso;

  /* ── Tema dia/noite (auto/claro/escuro) ──────────────────────────
     3 modos guardados em localStorage 'angatuba_theme':
       'auto'  → segue o relógio, IGUAL à foto da Igreja (dia 5h-18h = claro).
       'light' → força tema DIA (azul-céu).
       'dark'  → força tema NOITE (escuro).
     Toque no botão cicla auto → light → dark → auto.
     A janela do "dia" (5h-18h) é a MESMA de atualizarSaudacaoNoturna(),
     então fundo e foto da Igreja trocam juntos. */

  // Mesmo critério de "dia" da faixa da Igreja (htop-dia): 5h ≤ h < 18h.
  function _ehHorarioDia() {
    const h = new Date().getHours();
    return (h >= 5 && h < 18);
  }

  function _lerModoTema() {
    try {
      const m = localStorage.getItem('angatuba_theme');
      if (m === 'light' || m === 'dark' || m === 'auto') return m;
    } catch(e) {}
    return 'auto';
  }

  // Resolve o modo atual para claro(true)/escuro(false).
  function _temaClaroResolvido(modo) {
    if (modo === 'light') return true;
    if (modo === 'dark')  return false;
    return _ehHorarioDia(); // auto
  }

  // Ícone: sol (dia/claro), lua (noite/escuro), relógio quando em auto.
  function aplicarIconeTema() {
    const icon = document.getElementById('theme-toggle-icon');
    if (!icon) return;
    const modo    = _lerModoTema();
    const isLight = document.body.classList.contains('light-mode');
    icon.classList.remove('fa-moon', 'fa-sun', 'fa-clock');
    if (modo === 'auto')   icon.classList.add('fa-clock');
    else if (isLight)      icon.classList.add('fa-sun');
    else                   icon.classList.add('fa-moon');
    const btn = document.getElementById('theme-toggle-btn');
    if (btn) {
      const rotulo = modo === 'auto'
        ? (isLight ? 'Tema automático (dia)' : 'Tema automático (noite)')
        : (isLight ? 'Tema dia (fixo)' : 'Tema noite (fixo)');
      btn.setAttribute('aria-label', rotulo);
      btn.setAttribute('title', rotulo);
    }
  }

  // Aplica classe .light-mode + cor da barra do sistema conforme o modo.
  function aplicarTema() {
    const claro = _temaClaroResolvido(_lerModoTema());
    document.body.classList.toggle('light-mode', claro);
    const meta = document.getElementById('meta-theme-color');
    if (meta) meta.setAttribute('content', claro ? '#d2ddef' : '#0d0d0d');
    aplicarIconeTema();
  }
  window.aplicarTema = aplicarTema;

  // Toque cicla os 3 modos.
  function toggleTheme() {
    const ordem = ['auto', 'light', 'dark'];
    const atual = _lerModoTema();
    const prox  = ordem[(ordem.indexOf(atual) + 1) % ordem.length];
    try { localStorage.setItem('angatuba_theme', prox); } catch(e) {}
    aplicarTema();
  }
  window.toggleTheme = toggleTheme;

  // Aplica no boot (o script inline no <body> já evitou o flash inicial).
  aplicarTema();

  /* ── Métricas de clique ──────────────────────────────────────── */
  // Fire-and-forget: registra na planilha sem bloquear a ação do usuário.
  // Chamado apenas em botões de lojas ABERTAS (wpp/tel ativos).
  function registrarClique(nome, tipo, plano, categoria) {
    // Registra a visita para o "nudge" de avaliação (só contatos diretos)
    if (tipo === 'wpp' || tipo === 'tel') {
      registrarVisitaParaAvaliar(nome);
    }
    const params = new URLSearchParams();
    params.append('payload', JSON.stringify({
      action:    'registrarClique',
      loja:      nome,
      tipo:      tipo,       // 'wpp' ou 'tel'
      plano:     plano,
      categoria: categoria,
    }));
    fetch(APPS_SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: params })
      .catch(() => {}); // falha silenciosa — nunca interrompe o usuário
  }

  /* ── Debounce ────────────────────────────────────────────── */
  function debounce(fn, delay) {
    let t;
    return function(...args) { clearTimeout(t); t = setTimeout(() => fn.apply(this,args), delay); };
  }

  const searchEl = document.getElementById('main-search');

  const handleSearch = debounce(function(e) {
    // #14: busca não reseta mais categoria/pill ativos — refina dentro do
    // filtro já escolhido, em vez de descartá-lo silenciosamente a cada tecla.
    searchQuery = e.target.value.trim();
    renderLojas();
  }, 300);

  searchEl.addEventListener('input', handleSearch);
  searchEl.addEventListener('search', handleSearch);

  /* ── Modal Cadastro ──────────────────────────────────────── */
  function openModal() {
    // Abre direto no cadastro — plano é escolhido na etapa 3
    openCadastroModal();
  }

  function openCadastroModal() {
    const overlay = document.getElementById('modal-cadastro');
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    // Fix #6: entrada no histórico para o botão "voltar" (Android) fechar o modal
    if (history.state?.modal !== 'cadastro') history.pushState({ modal: 'cadastro' }, '');
    // Garante que começa na etapa 1
    cadIrParaEtapa(1);
    // Garante preços coerentes com o ciclo atual (default mensal)
    if (typeof cadAtualizarPrecos === 'function') cadAtualizarPrecos();
  }

  function closeModal(viaPopstate) {
    const overlay = document.getElementById('modal-cadastro');
    overlay.classList.remove('open');
    document.body.style.overflow = '';
    // Fix #6: desfaz a entrada do histórico ao fechar manualmente (popstate já consumiu)
    if (!viaPopstate && history.state?.modal === 'cadastro') history.back();
    // Reseta tela de sucesso após fechar (com delay para não piscar)
    setTimeout(() => {
      document.getElementById('cadastro-form').style.display = 'flex';
      document.getElementById('cadastro-success').classList.remove('show');
      document.getElementById('cadastro-success').querySelector('.success-wpp-btn')?.remove();
      document.getElementById('cadastro-form').reset();
      // Reseta o estado do toggle de agendamento (form.reset desmarca o checkbox,
      // mas o visual do switch/nota/botão precisa ser re-sincronizado) e a flag
      // de horário-tocado, para o próximo cadastro começar limpo.
      _schedTouched = false;
      if (typeof window.cadToggleAgendamento === 'function') window.cadToggleAgendamento(false);
      // Garante que o botão de submit está habilitado (pode ter ficado preso se modal foi fechado durante envio)
      const btn = document.querySelector('#cadastro-form .modal-submit');
      if (btn) { btn.disabled = false; btn.classList.remove('is-loading'); }
      // Reinicia o schedule builder visualmente
      scheduleTurnos = [{ dias: [1,2,3,4,5], abre: '08:00', fecha: '18:00' }];
      renderScheduleCards();
      syncHiddenFields();
      // Reseta campos de foto/logo
      ['foto', 'logo'].forEach(k => {
        const previewWrap = document.getElementById(k + '-preview-wrap');
        const previewImg  = document.getElementById(k + '-preview-img');
        const statusEl    = document.getElementById(k + '-upload-status');
        const hiddenUrl   = document.getElementById('f-' + k + '-url');
        if (previewWrap) previewWrap.style.display = 'none';
        if (previewImg)  previewImg.src = '';
        if (statusEl)    statusEl.textContent = '';
        if (hiddenUrl)   hiddenUrl.value = '';
      });
      // Reseta aviso de foto e plano selecionado
      const avisoEl = document.getElementById('cad-foto-aviso');
      if (avisoEl) avisoEl.style.display = 'none';
      selectedPlan = 'GRATIS';
      cadIrParaEtapa(1);
      // Reseta campo de ramo autocomplete
      if (typeof ramoReset === 'function') ramoReset();
    }, 300);
  }

  // Fecha ao clicar no overlay (fora do sheet)
  document.getElementById('modal-cadastro').addEventListener('click', function(e) {
    if (e.target === this) closeModal();
  });

  /* ── Modal de Planos ─────────────────────────────────────── */
  let selectedPlan = 'GRATIS';

  /* ── Ciclos de cobrança e preços ──────────────────────────────
     Base mensal: Plus R$29,90 · Pro R$49,90.
     Trimestral: -10%.  Anual: paga 10 meses (≈ -17%, "2 meses grátis").
     Tudo calculado a partir do mensal pra ficar fácil ajustar depois. */
  const PLANO_MENSAL = { PLUS: 29.90, PRO: 49.90 };
  const CICLOS = {
    mensal:     { meses: 1,  rotulo: 'Mensal',     fator: 1,    selo: '' },
    trimestral: { meses: 3,  rotulo: 'Trimestral', fator: 0.90, selo: '-10%' },
    anual:      { meses: 12, rotulo: 'Anual',      fator: null, selo: '2 meses grátis' }, // fator null = paga 10
  };
  let _cicloSelecionado = 'mensal';

  // Retorna { total, porMes, economia } de um plano pago num ciclo.
  function calcPreco(plano, ciclo) {
    const base = PLANO_MENSAL[plano];
    if (!base) return null;
    const c = CICLOS[ciclo] || CICLOS.mensal;
    let total;
    if (ciclo === 'anual') {
      total = base * 10;            // paga 10, leva 12
    } else {
      total = base * c.meses * c.fator;
    }
    const cheio   = base * c.meses; // o que custaria sem desconto
    const porMes  = total / c.meses;
    const economia = cheio - total;
    return { total, porMes, economia, meses: c.meses };
  }

  // Formata número como moeda BRL (R$ 1.234,56)
  function fmtBRL(v) {
    return 'R$ ' + v.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  /* ── Pagamento Mercado Pago ────────────────────────────────────
     Chama o backend para criar a preference e redireciona o usuário
     para o checkout do Mercado Pago. O valor é calculado no servidor. */
  async function iniciarPagamentoMP(wpp, plano, ciclo, btnEl) {
    const labelOrig = btnEl ? btnEl.innerHTML : '';
    if (btnEl) { btnEl.disabled = true; btnEl.innerHTML = '<i class="ti ti-loader-2"></i> Gerando pagamento…'; }
    try {
      const params = new URLSearchParams();
      params.append('payload', JSON.stringify({
        action: 'criarPreferenciaMP',
        wpp:    (() => { let n = String(wpp || '').replace(/\D/g, ''); return n && !n.startsWith('55') ? '55' + n : n; })(),
        plano:  plano,
        ciclo:  ciclo || 'mensal',
      }));
      const resp = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        body:   params,
        signal: AbortSignal.timeout(20000),
      });
      const json = await resp.json();
      if (json.status !== 'ok' || !json.data || !json.data.initPoint) {
        throw new Error((json && json.msg) || 'Não foi possível gerar o pagamento');
      }
      // Redireciona para o checkout do Mercado Pago
      window.location.href = json.data.initPoint;
    } catch (err) {
      if (btnEl) { btnEl.disabled = false; btnEl.innerHTML = labelOrig; }
      mlAviso('Não foi possível gerar o pagamento',
              (err.message || 'Tente novamente.') + '\n\nVocê também pode ativar pelo WhatsApp no botão abaixo.',
              '/webp/owl-sign.webp');
    }
  }
  window.iniciarPagamentoMP = iniciarPagamentoMP;

  /* ── Retorno do checkout (?pagamento=sucesso|pendente|falha) ──── */
  (function tratarRetornoPagamento() {
    try {
      const params = new URLSearchParams(window.location.search);
      const status = params.get('pagamento');
      if (!status) return;
      const msgs = {
        sucesso:  { t: '✅ Pagamento aprovado!', m: 'Seu plano está sendo ativado. Pode levar alguns instantes para aparecer em "Minha Loja".' },
        pendente: { t: '⏳ Pagamento pendente', m: 'Estamos aguardando a confirmação. Assim que for aprovado, seu plano será ativado automaticamente.' },
        falha:    { t: '❌ Pagamento não concluído', m: 'O pagamento não foi finalizado. Você pode tentar de novo ou falar com a gente pelo WhatsApp.' },
      };
      const info = msgs[status];
      if (info) setTimeout(() => mlAviso(info.t, info.m, status === 'sucesso' ? '/webp/owl-thumbsup.webp' : status === 'falha' ? '/webp/owl-sign.webp' : '/webp/owl-tip.webp'), 400);
      // Fix: no retorno de pagamento (sucesso ou pendente) o plano pode ter mudado no backend
      // via webhook. Invalida o cache da loja para forçar fetch fresco na próxima abertura
      // do painel — sem isto o lojista via o plano antigo até relogar.
      if (status === 'sucesso' || status === 'pendente') {
        try { localStorage.removeItem('angatuba_loja_dados'); } catch (e) {}
        // Melhoria: polling do plano. O webhook costuma confirmar em segundos, então
        // consultamos lojaDados algumas vezes e, assim que o plano mudar de GRATIS,
        // atualizamos cache + badge ao vivo (sem o lojista precisar reabrir nada).
        if (status === 'sucesso') iniciarPollingPlano();
      }
      // Limpa o parâmetro da URL sem recarregar
      params.delete('pagamento');
      const novaUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
      window.history.replaceState({}, '', novaUrl);
    } catch (e) {}
  })();

  /* ── Polling do plano após pagamento aprovado ─────────────────
     Consulta lojaDados em intervalos crescentes. Para assim que detectar
     plano != GRATIS (webhook processou) ou após esgotar as tentativas. */
  let _pollPlanoTimers = [];
  function pararPollingPlano() {
    _pollPlanoTimers.forEach(t => clearTimeout(t));
    _pollPlanoTimers = [];
  }
  function iniciarPollingPlano() {
    const token = localStorage.getItem('angatuba_loja_token');
    if (!token) return; // só faz sentido com loja logada
    pararPollingPlano();
    const atrasos = [3000, 7000, 13000, 22000]; // ~45s no total
    atrasos.forEach(ms => {
      const t = setTimeout(async () => {
        try {
          const json = await apiPost('lojaDados', { token }, { timeout: 10000, ignoreUnauthorized: true });
          if (json && json.status === 'ok' && json.data) {
            const plano = (json.data.plano || 'GRATIS').toUpperCase();
            // Atualiza o cache sempre (mantém painel fresco)
            try { localStorage.setItem('angatuba_loja_dados', JSON.stringify(json.data)); } catch(e) {}
            if (plano !== 'GRATIS') {
              pararPollingPlano();
              // Atualiza o badge ao vivo se o painel estiver aberto
              if (typeof _aplicarBadgePlano === 'function') _aplicarBadgePlano(plano);
              const overlay = document.getElementById('modal-minha-loja');
              if (overlay && overlay.classList.contains('open') && typeof _aplicarDadosLoja === 'function') {
                _aplicarDadosLoja(json.data, null, true);
                if (typeof mlCardapioCarregar === 'function') mlCardapioCarregar(plano);
              }
            }
          }
        } catch(e) { /* silencioso — é só um upgrade de UX */ }
      }, ms);
      _pollPlanoTimers.push(t);
    });
  }
  window.iniciarPollingPlano = iniciarPollingPlano;

  /* ── Polling de aprovação pós-cadastro ────────────────────────
     Após o cadastro (ou ao reabrir o app com cadastro pendente), verifica
     periodicamente se a loja foi aprovada. Enquanto aguarda, mostra a tela
     "Aguardando aprovação" (coruja analisando). Quando aprovada, troca para a
     coruja de celebração do plano, faz login automático e abre Minha Loja. */
  let _pollAprovTimers = [];
  function pararPollingAprovacao() {
    _pollAprovTimers.forEach(t => clearTimeout(t));
    _pollAprovTimers = [];
  }

  // Aplica o login e transição visual quando a loja é aprovada.
  function _aoAprovar(wpp, data) {
    pararPollingAprovacao();
    localStorage.removeItem('angatuba_pendente_wpp');
    localStorage.removeItem('angatuba_pendente_plano');
    localStorage.removeItem('angatuba_pendente_ciclo');
    _lojaToken = data.token;
    _lojaNome  = data.nome || '';
    localStorage.setItem('angatuba_loja_token', _lojaToken);
    localStorage.setItem('angatuba_loja_nome',  _lojaNome);
    localStorage.setItem('angatuba_loja_wpp',   wpp);
    _lojaWpp = wpp; // Fix onboarding: sem isto a flag por-loja não resolvia no fluxo de aprovação
    atualizarNav();

    const aguardando = document.getElementById('modal-aguardando');
    const aguardandoAberto = aguardando && aguardando.classList.contains('open');

    if (aguardandoAberto) {
      // Transição comemorativa: troca a coruja analisando pela de celebração
      // do plano e mostra "Aprovado!" por ~1,6s antes de abrir o painel.
      const plano = (data.plano || 'GRATIS').toUpperCase();
      const owlMap = { GRATIS: 'gratis', PLUS: 'plus', PRO: 'pro' };
      const owlEl = document.getElementById('aguardando-owl');
      if (owlEl) {
        owlEl.dataset.failed = '';
        owlEl.style.display = '';
        owlEl.src = `/webp/owl-celebrate-${owlMap[plano] || 'gratis'}.webp`;
      }
      const bigEl = document.getElementById('aguardando-title-big');
      if (bigEl) bigEl.innerHTML = 'Loja aprovada! 🎉';
      const subEl = document.getElementById('aguardando-sub');
      if (subEl) subEl.innerHTML = 'Tudo certo! Estamos abrindo a sua loja…';
      const statusEl = document.getElementById('aguardando-status');
      if (statusEl) statusEl.classList.add('aprovado');
      const statusTxt = document.getElementById('aguardando-status-text');
      if (statusTxt) statusTxt.textContent = 'Acesso liberado';
      const acoesEl = document.getElementById('aguardando-acoes');
      if (acoesEl) acoesEl.innerHTML = '';
      const hintEl = document.getElementById('aguardando-hint');
      if (hintEl) hintEl.style.display = 'none';
      const titEl = document.getElementById('aguardando-title');
      if (titEl) titEl.innerHTML = 'Pronto! <span>🎊</span>';

      setTimeout(() => {
        fecharAguardando(true);
        setTimeout(() => abrirMinhaLoja(), 250);
      }, 1600);
    } else {
      // App não estava na tela de aguardando (ex.: ainda no modal de cadastro,
      // ou aprovação detectada em background). Fecha o cadastro se aberto e abre.
      const modalCad = document.getElementById('modal-cadastro');
      if (modalCad && modalCad.classList.contains('open')) closeModal(false);
      setTimeout(() => abrirMinhaLoja(), 400);
    }
  }

  function iniciarPollingAprovacao(wpp) {
    if (!wpp) return;
    pararPollingAprovacao();
    const INTERVALO_MS = 20000;            // 20s entre checagens
    const PRIMEIRA_MS  = 1500;             // 1ª checagem quase imediata
    const MAX_TENTATIVAS = 90;             // ~30 min de espera
    let tentativa = 0;
    function tentar() {
      if (_lojaToken) { pararPollingAprovacao(); return; }
      tentativa++;
      if (tentativa > MAX_TENTATIVAS) { pararPollingAprovacao(); return; }
      const delay = (tentativa === 1) ? PRIMEIRA_MS : INTERVALO_MS;
      const t = setTimeout(async () => {
        if (_lojaToken) { pararPollingAprovacao(); return; }
        try {
          const params = new URLSearchParams();
          params.append('payload', JSON.stringify({ action: 'lojaVerificarAprovacao', wpp }));
          const resp = await fetch(APPS_SCRIPT_URL, {
            method: 'POST', body: params,
            signal: AbortSignal.timeout(12000),
          });
          const json = await resp.json();
          if (json.status === 'ok' && json.data && json.data.token) {
            _aoAprovar(wpp, json.data);
          } else { tentar(); }
        } catch(e) { tentar(); }
      }, delay);
      _pollAprovTimers.push(t);
    }
    tentar();
  }
  window.iniciarPollingAprovacao = iniciarPollingAprovacao;

  /* ── Tela "Aguardando aprovação" ──────────────────────────────
     Mostra a coruja analisando enquanto o cadastro não é aprovado. Pode ser
     aberta logo após o cadastro OU ao reabrir o app e tocar em "Minha Loja"
     com um cadastro ainda pendente. Reconstrói os botões de pagamento (planos
     pagos) a partir do plano/ciclo salvos. */
  function abrirAguardando(wpp, plano, ciclo) {
    const overlay = document.getElementById('modal-aguardando');
    if (!overlay) return;

    plano = (plano || 'GRATIS').toUpperCase();
    ciclo = ciclo || 'mensal';

    // Reseta o visual para o estado "analisando" (caso tenha ficado no estado
    // aprovado de uma sessão anterior na mesma aba)
    const owlEl = document.getElementById('aguardando-owl');
    if (owlEl) { owlEl.dataset.failed = ''; owlEl.style.display = ''; owlEl.src = '/webp/owl-search.webp'; }
    const titEl = document.getElementById('aguardando-title');
    if (titEl) titEl.innerHTML = 'Quase <span>lá!</span>';
    const bigEl = document.getElementById('aguardando-title-big');
    if (bigEl) bigEl.innerHTML = 'Estamos analisando 🔍';
    const statusEl = document.getElementById('aguardando-status');
    if (statusEl) statusEl.classList.remove('aprovado');
    const statusTxt = document.getElementById('aguardando-status-text');
    if (statusTxt) statusTxt.textContent = 'Verificando aprovação…';
    const hintEl = document.getElementById('aguardando-hint');
    if (hintEl) hintEl.style.display = '';

    const subEl   = document.getElementById('aguardando-sub');
    const acoesEl = document.getElementById('aguardando-acoes');
    if (acoesEl) acoesEl.innerHTML = '';

    const isPago = plano !== 'GRATIS';
    if (isPago && subEl) {
      const calc     = calcPreco(plano, ciclo);
      const cicloTxt = (CICLOS[ciclo] || CICLOS.mensal).rotulo.toLowerCase();
      const valorTxt = calc ? ` (${fmtBRL(calc.total)}${ciclo !== 'mensal' ? ' a cada ' + calc.meses + ' meses' : '/mês'})` : '';
      subEl.innerHTML =
        `Sua loja está em análise. <strong>Adiante a ativação do Plano ${plano}</strong> ` +
        `pagando agora — assim que aprovarmos, seu plano já entra ativo:`;

      // Botão "Pagar agora" (Mercado Pago) — ação primária
      const payBtn = document.createElement('button');
      payBtn.type = 'button';
      payBtn.className = 'success-pay-btn';
      payBtn.innerHTML = '<i class="ti ti-credit-card"></i> Pagar agora ' + (calc ? fmtBRL(calc.total) : '') + ' →';
      payBtn.onclick = () => iniciarPagamentoMP(wpp, plano, ciclo, payBtn);
      acoesEl.appendChild(payBtn);

      // Botão "Ativar via WhatsApp" — alternativa
      const wppMsg = encodeURIComponent(
        `Olá! Cadastrei minha loja no AngatubaON e escolhi o Plano ${plano} ${cicloTxt}${valorTxt}. Gostaria de ativá-lo!`
      );
      const wppBtn = document.createElement('a');
      wppBtn.className = 'success-wpp-btn';
      wppBtn.target = '_blank';
      wppBtn.rel = 'noopener';
      wppBtn.href = `https://wa.me/${ADMIN_WPP_CONTATO}?text=${wppMsg}`;
      wppBtn.innerHTML = '<i class="fab fa-whatsapp"></i> Ativar pelo WhatsApp →';
      acoesEl.appendChild(wppBtn);
    } else if (subEl) {
      subEl.innerHTML =
        `Recebemos os dados da sua loja e logo liberamos seu acesso.<br>` +
        `<strong>Assim que aprovarmos, sua loja abre aqui automaticamente.</strong>`;
    }

    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';

    // Garante o polling rodando (normaliza WPP com 55, igual à planilha)
    const wppNorm = (() => { const n = String(wpp || '').replace(/\D/g, ''); return n && !n.startsWith('55') ? '55' + n : n; })();
    if (wppNorm) iniciarPollingAprovacao(wppNorm);
  }
  window.abrirAguardando = abrirAguardando;

  function fecharAguardando(manterPolling) {
    const overlay = document.getElementById('modal-aguardando');
    if (overlay) overlay.classList.remove('open');
    document.body.style.overflow = '';
    // Ao fechar manualmente, o polling continua rodando em background até o
    // limite de tempo — mas só faz sentido se ainda há cadastro pendente.
    if (!manterPolling && !_lojaToken && !localStorage.getItem('angatuba_pendente_wpp')) {
      pararPollingAprovacao();
    }
  }
  window.fecharAguardando = fecharAguardando;

  let _carouselIdx = 0;
  const PLANS_ORDER = ['GRATIS', 'PLUS', 'PRO'];

  const PLAN_LABELS = {
    GRATIS: { btn: 'Continuar com Grátis →',  cls: 'cta-gratis', note: 'Cadastro gratuito, sem compromisso.' },
    PLUS:   { btn: '✦ Quero o Plano Plus →',  cls: 'cta-plus',   note: 'Você será contactado via WhatsApp para ativar o plano.' },
    PRO:    { btn: '⭐ Quero o Plano Pro →',   cls: 'cta-pro',    note: 'Você será contactado via WhatsApp para ativar o plano.' },
  };

  function openPlanModal() {
    document.getElementById('modal-planos').classList.add('open');
    document.body.style.overflow = 'hidden';
    // Começa sempre no Plus (índice 1) para aumentar conversão
    _irParaSlide(1, false);
  }

  function closePlanModal() {
    document.getElementById('modal-planos').classList.remove('open');
    document.body.style.overflow = '';
  }

  function _irParaSlide(idx, animado = true) {
    const carousel = document.getElementById('plan-carousel');
    if (!carousel) return;
    _carouselIdx = Math.max(0, Math.min(idx, PLANS_ORDER.length - 1));
    carousel.style.transition = animado ? 'transform 0.35s cubic-bezier(0.32,0.72,0,1)' : 'none';
    carousel.style.transform  = `translateX(-${_carouselIdx * 100}%)`;

    // Dots
    document.querySelectorAll('.plan-dot').forEach((d, i) => {
      d.classList.toggle('active', i === _carouselIdx);
    });

    // Card selecionado
    selectedPlan = PLANS_ORDER[_carouselIdx];
    document.querySelectorAll('.plan-slide .plan-card').forEach((c, i) => {
      c.classList.toggle('selected', i === _carouselIdx);
    });

    // Botão e nota
    const cfg  = PLAN_LABELS[selectedPlan];
    const btn  = document.getElementById('plan-cta-btn');
    const note = document.getElementById('plan-note');
    if (btn)  { btn.textContent = cfg.btn; btn.className = 'plan-cta ' + cfg.cls; }
    if (note) note.textContent = cfg.note;
  }

  // Dots clicáveis
  document.querySelectorAll('.plan-dot').forEach(dot => {
    dot.addEventListener('click', () => _irParaSlide(+dot.dataset.idx));
  });

  // Swipe touch no carrossel
  (function initCarouselSwipe() {
    const wrap = document.querySelector('.plan-carousel-wrap');
    if (!wrap) return;
    let startX = 0, startY = 0, isDragging = false, isHoriz = null;

    wrap.addEventListener('touchstart', e => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      isDragging = true; isHoriz = null;
    }, { passive: true });

    wrap.addEventListener('touchmove', e => {
      if (!isDragging) return;
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;
      if (isHoriz === null) isHoriz = Math.abs(dx) > Math.abs(dy);
      if (isHoriz) e.preventDefault();
    }, { passive: false });

    wrap.addEventListener('touchend', e => {
      if (!isDragging || !isHoriz) { isDragging = false; return; }
      const dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 40) {
        if (dx < 0) _irParaSlide(_carouselIdx + 1);
        else        _irParaSlide(_carouselIdx - 1);
      }
      isDragging = false;
    });

    // Mouse drag para desktop
    let mouseStartX = 0, mouseDragging = false;
    wrap.addEventListener('mousedown', e => { mouseStartX = e.clientX; mouseDragging = true; });
    wrap.addEventListener('mousemove', e => { if (mouseDragging) e.preventDefault(); });
    wrap.addEventListener('mouseup', e => {
      if (!mouseDragging) return;
      const dx = e.clientX - mouseStartX;
      if (Math.abs(dx) > 40) {
        if (dx < 0) _irParaSlide(_carouselIdx + 1);
        else        _irParaSlide(_carouselIdx - 1);
      }
      mouseDragging = false;
    });
    wrap.addEventListener('mouseleave', () => { mouseDragging = false; });
  })();

  function selectPlan(card) {
    // Mantido por compatibilidade, mas o carrossel gerencia tudo
    const idx = PLANS_ORDER.indexOf(card.dataset.plan);
    if (idx >= 0) _irParaSlide(idx);
  }

  function confirmPlan() {
    closePlanModal();
    // Aplica o plano selecionado na etapa 3 do cadastro
    cadSelecionarPlano(selectedPlan);
    openCadastroModal();
    // Vai direto para etapa 3 se veio do modal de planos
    setTimeout(() => cadIrParaEtapa(3), 50);
  }

  // Fecha plan modal ao clicar fora
  document.getElementById('modal-planos').addEventListener('click', function(e) {
    if (e.target === this) closePlanModal();
  });

  /* ── STEPPER DE CADASTRO ───────────────────────────────── */
  let _cadEtapaAtual = 1;

  let _cadIndoVoltar = false;
  function cadIrParaEtapa(n) {
    _cadEtapaAtual = n;
    const voltando = _cadIndoVoltar; _cadIndoVoltar = false;
    // Painéis
    [1,2,3].forEach(i => {
      const panel = document.getElementById('cad-panel-' + i);
      if (!panel) return;
      const ativo = (i === n);
      panel.classList.toggle('active', ativo);
      panel.classList.toggle('cad-back', ativo && voltando);
    });
    // Stepper visual
    [1,2,3].forEach(i => {
      const stepEl = document.getElementById('cad-step-ind-' + i);
      const circEl = document.getElementById('cad-step-circ-' + i);
      if (!stepEl) return;
      stepEl.classList.remove('active','done');
      if (i < n) { stepEl.classList.add('done'); if(circEl) circEl.innerHTML = '✓'; }
      else if (i === n) { stepEl.classList.add('active'); if(circEl) circEl.textContent = i; }
      else { if(circEl) circEl.textContent = i; }
    });
    // Linhas
    [1,2].forEach(i => {
      const lineEl = document.getElementById('cad-line-' + i);
      if (lineEl) lineEl.classList.toggle('done', i < n);
    });
    // Subtitle
    const subtitles = {1:'Dados da sua loja', 2:'Horário de funcionamento', 3:'Plano e fotos'};
    const subEl = document.getElementById('cad-modal-subtitle');
    if (subEl) subEl.textContent = subtitles[n] || '';
    // Rola para o topo do modal
    const sheet = document.querySelector('#modal-cadastro .modal-sheet');
    if (sheet) sheet.scrollTop = 0;
  }

  /* ── Acordeão de planos (etapa 3) ────────────────────────────
     Substituiu o carousel. _cadCarouselIdx é mantido só por
     compatibilidade com confirmPlan(). cadCarouselIr() vira um
     atalho que apenas seleciona o plano correspondente. */
  let _cadCarouselIdx = 1; // Plus por padrão
  const _CAD_PLANS = ['GRATIS','PLUS','PRO'];

  window.cadCarouselIr = function(idx) {
    idx = Math.max(0, Math.min(idx, 2));
    cadSelecionarPlano(_CAD_PLANS[idx]);
  };

  // ── Toggle 'Atendo por agendamento' no cadastro ─────────────
  // Liga/desliga o visual do switch e, principalmente, torna endereço e
  // horário opcionais (mão de obra não tem ponto fixo nem horário fixo).
  window.cadToggleAgendamento = function(on) {
    const sw    = document.getElementById('f-agendamento-switch');
    const thumb = document.getElementById('f-agendamento-thumb');
    const endReq  = document.getElementById('f-endereco-req');
    const horReq  = document.getElementById('f-horario-req');
    const endRua  = document.getElementById('f-endereco-rua');
    if (sw) {
      sw.style.background = on ? 'var(--green)' : 'var(--border)';
      sw.setAttribute('aria-checked', on ? 'true' : 'false');
    }
    if (thumb) thumb.style.left = on ? '21px' : '3px';
    // Endereço: some o asterisco e remove o required nativo do input de rua.
    if (endReq) endReq.style.display = on ? 'none' : '';
    if (endRua) { if (on) endRua.removeAttribute('required'); else endRua.setAttribute('required',''); }
    if (horReq) horReq.style.display = on ? 'none' : '';
    // Nota informativa na etapa de horário + esmaece o schedule builder.
    const note   = document.getElementById('f-agend-horario-note');
    const sched  = document.getElementById('sched-simple');
    const schedA = document.getElementById('sched-advanced');
    if (note) note.style.display = on ? '' : 'none';
    [sched, schedA].forEach(function(elx){
      if (!elx) return;
      elx.style.opacity = on ? '0.55' : '';
    });
    // Botão 'Próximo' da etapa de horário vira um 'pular' explícito, já que
    // a nota promete que dá pra pular. Sem isso o usuário não percebe que
    // clicar em Próximo já é o pulo.
    const nextBtn = document.querySelector('#cad-panel-2 .cad-next-btn');
    if (nextBtn) {
      nextBtn.innerHTML = on
        ? 'Pular horário — Escolher plano <i class="fa fa-arrow-right"></i>'
        : 'Próximo — Escolher plano <i class="fa fa-arrow-right"></i>';
    }
  };

  window.cadAvancar = function(etapa) {
    // Validação básica antes de avançar
    if (etapa === 2) {
      const nome   = document.getElementById('f-nome');
      const ramo   = document.getElementById('f-ramo');
      const wpp    = document.getElementById('f-wpp');
      const end    = document.getElementById('f-endereco-rua');
      const bairro = document.getElementById('f-bairro');
      if (!nome?.value.trim()) { cadShake(nome); nome?.focus(); return; }
      nome?.classList.remove('invalid');
      if (!ramo?.value.trim()) {
        document.getElementById('f-ramo-text')?.focus();
        return;
      }
      const _agendOn = document.getElementById('f-agendamento')?.checked;
      if (!_agendOn && !end?.value.trim()) { cadShake(end); end?.focus(); return; }
      end?.classList.remove('invalid');
      // Fix: valida o comprimento real do WPP (10-11 dígitos) em vez de só checar a classe
      // .invalid — um número incompleto que nunca recebeu blur passava direto pro step 2.
      const _wppDigits = (wpp?.value || '').replace(/\D/g, '');
      if (_wppDigits.length !== 10 && _wppDigits.length !== 11) {
        cadShake(wpp);
        wpp?.focus();
        return;
      }
      wpp?.classList.remove('invalid');
      // Bairro: obrigatório para lojas com ponto fixo (alimenta o filtro por
      // bairro). Para agendamento (mão de obra) é opcional — o autônomo atende
      // a cidade/região. Se preencher mesmo assim, validamos contra a lista.
      if (bairro) {
        const bv = bairro.value.trim();
        // Vazio + agendamento: pode seguir sem bairro.
        if (!bv && _agendOn) {
          bairro.classList.remove('invalid');
        } else {
          const bvNorm = normBairro(bv);
          const ehValido = BAIRROS_ANGATUBA.some(b => normBairro(b) === bvNorm);
          if (!bv || !ehValido) {
            const canonico = BAIRROS_ANGATUBA.find(b => normBairro(b) === bvNorm);
            if (canonico) {
              bairro.value = canonico;
            } else {
              cadShake(bairro);
              bairro.focus();
              setTimeout(() => bairro.classList.remove('invalid'), 2500);
              return;
            }
          }
        }
      }
      bairro?.classList.remove('invalid');
    }
    cadIrParaEtapa(etapa);
    if (etapa === 3) {
      // Abre já no Plus (mais escolhido) expandido; Grátis e Pro recolhidos.
      setTimeout(function() { cadSelecionarPlano('PLUS'); }, 60);
    }
  };

  // (Removido) O hint de swipe do carousel não existe mais no acordeão.
  function cadToggleVerTudo(plano, btn) {
    var ul = document.getElementById('acc-extra-' + plano);
    if (!ul) return;
    var aberto = ul.style.display !== 'none';
    ul.style.display = aberto ? 'none' : '';
    if (btn) {
      var ic  = btn.querySelector('i');
      var txt = btn.querySelector('span');
      if (ic)  ic.className = aberto ? 'ti ti-chevron-down' : 'ti ti-chevron-up';
      if (txt) txt.textContent = aberto ? 'ver o que mais vem no Plus' : 'ver menos';
    }
  }
  window.cadToggleVerTudo = cadToggleVerTudo;

  // Marca campo inválido + dispara shake (sem duplicar listeners).
  function cadShake(el) {
    if (!el) return;
    el.classList.add('invalid');
    el.classList.remove('cad-shake');
    void el.offsetWidth;
    el.classList.add('cad-shake');
    setTimeout(function () { el.classList.remove('cad-shake'); }, 450);
  }
  window.cadVoltar = function(etapa) { _cadIndoVoltar = true; cadIrParaEtapa(etapa); };

  /* ── Seletor de plano inline (etapa 3) ─────────────────── */
  window.cadSelecionarPlano = function(plano) {
    if (!_CAD_PLANS.includes(plano)) plano = 'GRATIS';
    selectedPlan = plano;
    _cadCarouselIdx = _CAD_PLANS.indexOf(plano);

    const isPago = plano !== 'GRATIS';

    // Acordeão: marca selecionado (expande) e recolhe os demais.
    ['GRATIS','PLUS','PRO'].forEach(p => {
      const el = document.getElementById('plan-sel-' + p.toLowerCase());
      if (!el) return;
      const ativo = (p === plano);
      el.classList.toggle('selected', ativo);
      el.setAttribute('aria-checked', ativo ? 'true' : 'false');
    });

    // Aviso "foto depois" só aparece em plano pago.
    const avisoEl = document.getElementById('cad-foto-aviso');
    if (avisoEl) avisoEl.style.display = isPago ? '' : 'none';

    // Mantém os previews todos renderizados (cada um vive dentro do seu card),
    // mas o card recolhido esconde o corpo via CSS, então não precisa toggle aqui.

    // Gera as barras de pico do Pro uma única vez.
    if (plano === 'PRO') {
      const barsEl = document.getElementById('cpp-pico-bars');
      if (barsEl && !barsEl.dataset.rendered) {
        const vals = [12, 18, 35, 28, 45, 60, 72, 55, 48, 65, 80, 58];
        const peak = Math.max(...vals);
        barsEl.innerHTML = vals.map(v =>
          `<div class="cpp-pico-bar${v === peak ? ' peak' : ''}" style="height:${Math.round((v/peak)*100)}%"></div>`
        ).join('');
        barsEl.dataset.rendered = '1';
      }
    }

    // Garante que os preços do ciclo atual estão aplicados nos cards pagos.
    if (typeof cadAtualizarPrecos === 'function') cadAtualizarPrecos();
  };

  /* ── Seleção de ciclo de cobrança ─────────────────────────── */
  window.cadSelecionarCiclo = function(ciclo) {
    if (!CICLOS[ciclo]) ciclo = 'mensal';
    _cicloSelecionado = ciclo;

    // Marca o botão ativo em TODOS os toggles de ciclo (Plus e Pro espelham o mesmo estado).
    document.querySelectorAll('#cad-ciclo-toggle .ciclo-btn, #cad-ciclo-toggle-pro .ciclo-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.ciclo === ciclo);
    });

    cadAtualizarPrecos();
  };

  // Atualiza os preços exibidos nos cards Plus/Pro conforme o ciclo escolhido.
  function cadAtualizarPrecos() {
    const ciclo = _cicloSelecionado;
    ['PLUS','PRO'].forEach(plano => {
      const sufixo  = plano.toLowerCase();
      const precoEl = document.getElementById('cad-preco-' + sufixo);
      const perEl   = document.getElementById('cad-per-' + sufixo);
      const infoEl  = document.getElementById('cad-ciclo-' + sufixo);
      const calc    = calcPreco(plano, ciclo);
      if (!precoEl || !calc) return;

      // micro-animação ao trocar o preço (fade rápido)
      precoEl.classList.remove('price-flash');
      void precoEl.offsetWidth;
      precoEl.classList.add('price-flash');

      if (ciclo === 'mensal') {
        precoEl.classList.remove('price-riscado');
        precoEl.textContent = fmtBRL(calc.porMes);
        if (perEl)  perEl.textContent = 'por mês';
        if (infoEl) { infoEl.style.display = 'none'; infoEl.innerHTML = ''; }
      } else {
        // Mostra preço POR MÊS em destaque (mais convertível) + total no rodapé
        precoEl.classList.remove('price-riscado');
        precoEl.textContent = fmtBRL(calc.porMes);
        if (perEl) perEl.textContent = 'por mês';
        if (infoEl) {
          const totalTxt = `${fmtBRL(calc.total)} a cada ${calc.meses} meses`;
          const econTxt  = calc.economia > 0
            ? ` · <span class="plan-ciclo-economia">economize ${fmtBRL(calc.economia)}</span>`
            : '';
          infoEl.innerHTML = totalTxt + econTxt;
          infoEl.style.display = '';
        }
      }
    });
  }


  /* ── Schedule simplificado ──────────────────────────────── */
  let _schedPreset = 'semana';
  // Marca se o usuário mexeu no horário. Usado no submit: loja de agendamento
  // que NÃO tocou no horário tem os campos zerados (vira 'Sob agendamento');
  // se tocou, mantém como horário de referência.
  let _schedTouched = false;
  window._schedFoiTocado = function() { return _schedTouched; };
  window._schedMarcarTocado = function() { _schedTouched = true; };

  const PRESET_DIAS = {
    semana:     [1,2,3,4,5],
    semana_sab: [1,2,3,4,5,6],
    todos:      [0,1,2,3,4,5,6],
    custom:     [],
  };

  window.schedPreset = function(preset, btn) {
    _schedTouched = true;
    _schedPreset = preset;
    document.querySelectorAll('.sched-preset-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    if (preset === 'custom') {
      schedMostrarAvancado();
    } else {
      schedSyncSimples();
    }
  };

  window.schedSyncSimples = function() {
    if (_schedPreset === 'custom') return;
    const dias  = PRESET_DIAS[_schedPreset] || [1,2,3,4,5];
    const abre  = document.getElementById('sched-abre')?.value  || '08:00';
    const fecha = document.getElementById('sched-fecha')?.value || '18:00';
    // Atualiza o scheduleTurnos para o builder avançado ficar em sincronia
    scheduleTurnos = [{ dias, abre, fecha }];
    renderScheduleCards();
    syncHiddenFields();
  };

  window.schedMostrarAvancado = function() {
    document.getElementById('sched-simple').style.display = 'none';
    document.getElementById('sched-advanced').style.display = '';
    // Sincroniza turno atual para o builder
    if (scheduleTurnos.length === 0) {
      scheduleTurnos = [{ dias: [1,2,3,4,5], abre: '08:00', fecha: '18:00' }];
      renderScheduleCards();
      syncHiddenFields();
    }
  };

  window.schedOcultarAvancado = function() {
    document.getElementById('sched-simple').style.display = '';
    document.getElementById('sched-advanced').style.display = 'none';
    _schedPreset = 'semana';
    document.querySelectorAll('.sched-preset-btn').forEach((b,i) => b.classList.toggle('active', i===0));
    schedSyncSimples();
  };

  /* ── Schedule Builder (avançado — acessível via link) ───── */
  const DIAS_LABEL = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  const scheduleBuilder = document.getElementById('schedule-builder');
  const scheduleAddBtn  = document.getElementById('schedule-add-btn');
  let scheduleTurnos = []; // [{dias:[1,2,3,4,5], abre:'08:00', fecha:'18:00'}]

  function criarCardTurno(idx) {
    const turno = scheduleTurnos[idx];
    const card = document.createElement('div');
    card.className = 'schedule-card';
    card.dataset.idx = idx;

    const title = document.createElement('div');
    title.className = 'schedule-card-title';
    title.textContent = idx === 0 ? 'Dias e horário principal' : 'Turno adicional';
    card.appendChild(title);

    // Dias
    const daysRow = document.createElement('div');
    daysRow.className = 'schedule-days';
    DIAS_LABEL.forEach((label, d) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'schedule-day-btn' + (turno.dias.includes(d) ? ' active' : '');
      btn.textContent = label;
      btn.dataset.day = d;
      btn.addEventListener('click', () => {
        const di = turno.dias.indexOf(d);
        if (di >= 0) turno.dias.splice(di, 1);
        else turno.dias.push(d);
        btn.classList.toggle('active');
        syncHiddenFields();
      });
      daysRow.appendChild(btn);
    });
    card.appendChild(daysRow);

    // Horários
    const timesRow = document.createElement('div');
    timesRow.className = 'schedule-times';

    const inAbre = document.createElement('input');
    inAbre.type = 'time'; inAbre.value = turno.abre;
    inAbre.addEventListener('change', () => { turno.abre = inAbre.value; syncHiddenFields(); });

    const sep = document.createElement('span');
    sep.textContent = 'até';

    const inFecha = document.createElement('input');
    inFecha.type = 'time'; inFecha.value = turno.fecha;
    inFecha.addEventListener('change', () => { turno.fecha = inFecha.value; syncHiddenFields(); });

    timesRow.appendChild(inAbre);
    timesRow.appendChild(sep);
    timesRow.appendChild(inFecha);
    card.appendChild(timesRow);

    // Botão remover (só em cards extras)
    if (idx > 0) {
      const rmBtn = document.createElement('button');
      rmBtn.type = 'button';
      rmBtn.className = 'schedule-remove';
      rmBtn.innerHTML = '<i class="fa fa-times"></i>';
      rmBtn.addEventListener('click', () => {
        scheduleTurnos.splice(idx, 1);
        renderScheduleCards();
        syncHiddenFields();
      });
      card.appendChild(rmBtn);
    }

    return card;
  }

  function renderScheduleCards() {
    scheduleBuilder.innerHTML = '';
    scheduleTurnos.forEach((_, idx) => {
      scheduleBuilder.appendChild(criarCardTurno(idx));
    });
  }

  function syncHiddenFields() {
    // Monta texto legível: "Seg-Sex 08:00-18:00 | Sáb 08:00-12:00"
    const texto = scheduleTurnos.map(t => {
      if (!t.dias.length) return null;
      const diasNomes = t.dias.sort((a,b)=>a-b).map(d => DIAS_LABEL[d]).join(', ');
      return diasNomes + ' ' + t.abre + '-' + t.fecha;
    }).filter(Boolean).join(' | ');

    // Usa o primeiro turno como principal para os campos estruturados
    const principal = scheduleTurnos[0];
    const diasStr = scheduleTurnos.flatMap(t => t.dias).filter((v,i,a)=>a.indexOf(v)===i).sort((a,b)=>a-b).join(',');

    document.getElementById('f-horario').value   = texto;
    document.getElementById('f-dias').value      = diasStr;
    document.getElementById('f-hora-abre').value  = principal ? principal.abre  : '';
    document.getElementById('f-hora-fecha').value = principal ? principal.fecha : '';
  }

  // Inicializa com um card padrão Seg-Sex
  scheduleTurnos = [{ dias: [1,2,3,4,5], abre: '08:00', fecha: '18:00' }];
  renderScheduleCards();
  syncHiddenFields();
  // Sincroniza campos simples na inicialização
  if (typeof schedSyncSimples === 'function') schedSyncSimples();

  scheduleAddBtn.addEventListener('click', () => {
    if (scheduleTurnos.length >= 3) return; // máximo 3 turnos
    scheduleTurnos.push({ dias: [], abre: '08:00', fecha: '12:00' });
    renderScheduleCards();
    syncHiddenFields();
  });

  // Submissão via Google Apps Script — funciona no GitHub Pages

  /* ── Máscara e validação de WhatsApp ─────────────────────── */
  (function initWppField() {
    const input = document.getElementById('f-wpp');
    const errEl = document.getElementById('f-wpp-err');
    if (!input) return;

    // Usa a máscara única (mascararWppBR) — antes havia duas implementações divergentes.
    function mask(v) { return mascararWppBR(v); }

    function validate(showErr) {
      const digits = input.value.replace(/\D/g,'');
      const ok = digits.length === 10 || digits.length === 11;
      input.classList.toggle('invalid', showErr && !ok);
      errEl.classList.toggle('show', showErr && !ok);
      return ok;
    }

    input.addEventListener('input', function() {
      const pos  = this.selectionStart;
      const prev = this.value.length;
      this.value = mask(this.value);
      const diff = this.value.length - prev;
      try { this.setSelectionRange(pos + diff, pos + diff); } catch(e) {}
      if (this.value.replace(/\D/g,'').length >= 10) validate(true);
      else { input.classList.remove('invalid'); errEl.classList.remove('show'); }
    });

    input.addEventListener('blur', () => {
      if (input.value.trim()) validate(true);
    });

    // Limpa erro ao focar de novo
    input.addEventListener('focus', () => {
      input.classList.remove('invalid');
      errEl.classList.remove('show');
    });

    window._validateWpp = () => validate(true);
  })();

  document.getElementById('cadastro-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    const btn = this.querySelector('.modal-submit');

    // Valida WPP antes de qualquer coisa
    if (window._validateWpp && !window._validateWpp()) {
      document.getElementById('f-wpp').scrollIntoView({ behavior: 'smooth', block: 'center' });
      document.getElementById('f-wpp').focus();
      return;
    }

    // Valida ramo (categoria) — campo obrigatório mas sem required nativo
    const ramoVal = document.getElementById('f-ramo')?.value.trim();
    if (!ramoVal) {
      const ramoInput = document.getElementById('f-ramo-text');
      ramoInput?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      ramoInput?.focus();
      cadShake(ramoInput);
      setTimeout(() => ramoInput?.classList.remove('invalid'), 2500);
      mlToast('Selecione o ramo / categoria da loja.', 'erro');
      return;
    }

    btn.classList.add('is-loading');
    btn.disabled = true;

    try {
      // Garante que endereço completo foi montado (rua selecionada da lista)
      const ruaInput  = document.getElementById('f-endereco-rua');
      const endOculto = document.getElementById('f-endereco');
      if (ruaInput && ruaInput.value.trim() && !endOculto.value) {
        endOculto.value = ruaInput.value.trim();
        const num = document.getElementById('f-endereco-numero')?.value.trim();
        if (num) endOculto.value += ', ' + num;
        document.getElementById('f-maps-url').value =
          `https://www.google.com/maps/search/${encodeURIComponent(endOculto.value + ', Angatuba, SP')}`;
      }

      // Valida horário — exceto quando a loja atende só por agendamento
      // (mão de obra não tem horário fixo).
      const _agendOn = document.getElementById('f-agendamento')?.checked;
      if (!_agendOn && !document.getElementById('f-horario').value) {
        mlToast('Selecione pelo menos um dia e horário de funcionamento.', 'erro');
        btn.classList.remove('is-loading');
        btn.disabled = false;
        return;
      }

      const formData = new FormData(this);
      const payload  = Object.fromEntries(formData.entries());
      payload.planoSolicitado = selectedPlan; // envia o plano escolhido
      // Agendamento: se o dono NÃO mexeu no horário, zera os campos (o schedule
      // tem um default Seg-Sex 08-18 que não faz sentido para mão de obra) →
      // a loja aparece como 'Sob agendamento'. Se ele mexeu de propósito,
      // mantém como horário de referência (a nota promete isso).
      const _tocou = (typeof window._schedFoiTocado === 'function') && window._schedFoiTocado();
      if (payload.agendamento === 'SIM' && !_tocou) {
        payload.horario  = '';
        payload.dias     = '';
        payload.horaAbre = '';
        payload.horaFecha = '';
      }

      const params = new URLSearchParams();
      params.append('payload', JSON.stringify(payload));

      const resp = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        body:   params,
        signal: AbortSignal.timeout(20000),
      });
      const json = await resp.json();
      if (json.status !== 'ok') throw new Error(json.msg || 'Erro no servidor. Tente novamente.');

      this.style.display = 'none';

      const nomeLoja  = payload.nome || payload.storeName || 'sua loja';
      const plano     = selectedPlan;

      // Normaliza o WPP com DDI 55, pois é assim que salvarNaPlanilha() grava na
      // planilha (col E). Sem o 55, buscarLojaPorWpp() faz comparação exata e
      // NUNCA encontra a loja — o auto-login ficaria preso em "PENDENTE".
      const wppCadastro = (() => {
        const n = String(payload.whatsapp || '').replace(/\D/g, '');
        return n && !n.startsWith('55') ? '55' + n : n;
      })();

      // Persiste o cadastro pendente (WPP + plano + ciclo) para que, se a pessoa
      // fechar e reabrir o app, a tela de aguardando seja reconstruída igual.
      if (wppCadastro) {
        localStorage.setItem('angatuba_pendente_wpp',   wppCadastro);
        localStorage.setItem('angatuba_pendente_plano', plano);
        localStorage.setItem('angatuba_pendente_ciclo', _cicloSelecionado);
      }

      // Fecha o modal de cadastro e abre a tela "Aguardando aprovação".
      // Ela mostra a coruja analisando, faz o polling e, ao aprovar, troca para
      // a coruja de celebração do plano e entra direto na conta.
      const modalCad = document.getElementById('modal-cadastro');
      if (modalCad && modalCad.classList.contains('open')) closeModal(false);
      setTimeout(() => abrirAguardando(wppCadastro, plano, _cicloSelecionado), 350);
    } catch {
      btn.classList.remove('is-loading');
      btn.disabled = false;
      mlToast('Erro ao enviar. Verifique sua conexão e tente novamente.', 'erro');
    }
  });

  /* ══════════════════════════════════════════════════════════════
     SESSÃO DE LOJA — login via WhatsApp + código
  ══════════════════════════════════════════════════════════════ */
  let _lojaToken = localStorage.getItem('angatuba_loja_token') || null;
  let _lojaNome  = localStorage.getItem('angatuba_loja_nome')  || '';
  let _mlPlanoAtual = 'GRATIS'; // plano da loja logada (Fase 2: decide stories múltiplos)
  let _lojaWpp   = ''; // capturado no passo 1 do login
  let _llVerificando = false;          // trava anti-duplo-submit do código
  let _llTimerInt    = null;           // timer de expiração (10 min)
  let _llTimerRestante = 0;            // segundos restantes
  let _llCooldownInt = null;           // cooldown do botão reenviar

  // Retoma o polling de aprovação se havia um WPP pendente (ex.: o lojista
  // recarregou a página antes da loja ser aprovada). Precisa rodar DEPOIS da
  // declaração de _lojaToken acima — se rodar antes, acessar _lojaToken cai na
  // TDZ (ReferenceError) e derruba o restante do script no reload.
  (function retomaPendente() {
    let wppPend = localStorage.getItem('angatuba_pendente_wpp');
    if (wppPend && !_lojaToken) {
      // Normaliza com DDI 55 — cobre valores antigos salvos sem o 55 por
      // versões anteriores, que de outra forma nunca casariam na planilha.
      const n = String(wppPend).replace(/\D/g, '');
      wppPend = n && !n.startsWith('55') ? '55' + n : n;
      localStorage.setItem('angatuba_pendente_wpp', wppPend);
      // Retoma o polling em background (sem abrir modal sozinho — seria
      // intrusivo no load). Se aprovar com o app aberto, _aoAprovar entra
      // direto no painel; se a pessoa tocar em "Minha Loja", vê a tela de
      // aguardando com o status ao vivo.
      iniciarPollingAprovacao(wppPend);
    }
  })();

  /* ── Atualiza a bottom nav conforme sessão ───────────────── */
  function atualizarNav() {
    const navLojaBtn      = document.getElementById('nav-loja');
    const navCadastrarBtn = document.getElementById('nav-cadastrar');
    if (!navLojaBtn) return;
    if (_lojaToken) {
      // Logado: Minha Loja em verde, Cadastrar some
      navLojaBtn.innerHTML = `<i class="fa fa-store"></i><span>Minha Loja</span>`;
      navLojaBtn.classList.add('logado');
      navCadastrarBtn?.classList.add('hidden');
    } else {
      // Deslogado: Minha Loja normal, Cadastrar visível
      navLojaBtn.innerHTML = `<i class="fa fa-store"></i><span>Minha Loja</span>`;
      navLojaBtn.classList.remove('logado');
      navCadastrarBtn?.classList.remove('hidden');
    }
  }

  /* ── Bottom nav events ───────────────────────────────────── */
  document.getElementById('nav-inicio').addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    document.getElementById('nav-inicio').classList.add('active');
    searchEl.value   = '';
    searchQuery      = '';
    activeCat        = 'todos';
    activePillFilter = 'all';
    document.querySelectorAll('.cat-icon').forEach(i => i.classList.remove('active'));
    document.querySelector('[data-cat="todos"] .cat-icon')?.classList.add('active');
    document.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));

    renderLojas();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  document.getElementById('nav-buscar').addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    document.getElementById('nav-buscar').classList.add('active');
    searchEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => searchEl.focus(), 320);
  });

  document.getElementById('nav-loja').addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    document.getElementById('nav-loja').classList.add('active');
    if (_lojaToken) {
      abrirMinhaLoja();
    } else if (localStorage.getItem('angatuba_pendente_wpp')) {
      // Tem cadastro aguardando aprovação — reabre a tela de status (checa na
      // hora se já foi aprovado), em vez de pedir login por código.
      const wpp   = localStorage.getItem('angatuba_pendente_wpp');
      const plano = localStorage.getItem('angatuba_pendente_plano') || 'GRATIS';
      const ciclo = localStorage.getItem('angatuba_pendente_ciclo') || 'mensal';
      abrirAguardando(wpp, plano, ciclo);
    } else {
      openLoginLoja(); // abre direto o login
    }
  });

  document.getElementById('nav-cadastrar').addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    document.getElementById('nav-cadastrar').classList.add('active');
    openModal(); // abre o seletor de planos → cadastro
  });

  /* ── Modais de login ─────────────────────────────────────── */
  function openLoginLoja() {
    loginStep(1);
    document.getElementById('ll-wpp').value    = '';
    document.getElementById('ll-codigo').value = '';
    const errEl = document.getElementById('ll-wpp-err');
    if (errEl) errEl.classList.remove('show');
    document.getElementById('ll-wpp').classList.remove('invalid');
    llOtpInit();
    // Melhoria: retoma o cooldown de reenvio se ainda estava ativo (reload da página).
    llIniciarCooldown(true);
    llOtpReset();
    document.getElementById('login-loja-title').innerHTML = 'Acessar <span>Minha Loja</span>';
    document.getElementById('login-loja-sub').textContent = 'Digite o WhatsApp cadastrado para receber seu código';
    document.getElementById('modal-login-loja').classList.add('open');
    document.body.style.overflow = 'hidden';
    setTimeout(() => document.getElementById('ll-wpp').focus(), 300);
  }

  function closeLoginLoja() {
    llPararTimer();
    if (_llCooldownInt) { clearInterval(_llCooldownInt); _llCooldownInt = null; }
    document.getElementById('modal-login-loja').classList.remove('open');
    document.body.style.overflow = '';
  }

  document.getElementById('modal-login-loja').addEventListener('click', function(e) {
    if (e.target === this) closeLoginLoja();
  });

  function loginStep(step) {
    document.getElementById('login-step1').style.display = step === 1 ? 'flex' : 'none';
    document.getElementById('login-step2').style.display = step === 2 ? 'flex' : 'none';
    if (step === 1) {
      llPararTimer();
      if (_llCooldownInt) { clearInterval(_llCooldownInt); _llCooldownInt = null; }
      const otp = document.getElementById('ll-otp');
      if (otp) otp.classList.remove('error','success');
    }
  }

  /* ════════════ OTP: 6 caixinhas com auto-advance/paste ═══════ */
  function llOtpBoxes() {
    return Array.from(document.querySelectorAll('#ll-otp .ll-otp-box'));
  }
  function llOtpFocus(i) {
    const b = llOtpBoxes();
    if (b[i]) { b[i].focus(); b[i].select && b[i].select(); }
  }
  function llOtpValor() {
    return llOtpBoxes().map(x => x.value).join('').replace(/\D/g,'');
  }
  function llOtpSync() {
    const hid = document.getElementById('ll-codigo');
    if (hid) hid.value = llOtpValor();
  }
  function llOtpReset() {
    const otp = document.getElementById('ll-otp');
    if (otp) otp.classList.remove('error','success');
    llOtpBoxes().forEach(b => { b.value = ''; b.classList.remove('filled'); });
    llOtpSync();
    llOtpFocus(0);
  }
  function llOtpErro(msg) {
    const hint = document.getElementById('login-codigo-hint');
    const otp  = document.getElementById('ll-otp');
    if (hint) hint.textContent = msg;
    if (otp) {
      otp.classList.add('error','shake');
      setTimeout(() => otp.classList.remove('shake'), 420);
    }
    setTimeout(() => llOtpReset(), 450);
  }
  // Liga os eventos das caixinhas (uma única vez)
  function llOtpInit() {
    const boxes = llOtpBoxes();
    if (!boxes.length || boxes[0].dataset.bound) return;
    boxes.forEach((box, i) => {
      box.dataset.bound = '1';
      box.addEventListener('input', () => {
        box.value = box.value.replace(/\D/g,'').slice(0,1);
        box.classList.toggle('filled', !!box.value);
        const otp = document.getElementById('ll-otp');
        if (otp) otp.classList.remove('error');
        if (box.value && i < boxes.length - 1) llOtpFocus(i + 1);
        llOtpSync();
        if (llOtpValor().length === 6) {
          setTimeout(() => lojaVerificarCodigo(), 120); // pequeno debounce p/ paste
        }
      });
      box.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !box.value && i > 0) {
          const prev = boxes[i-1];
          prev.value = ''; prev.classList.remove('filled');
          llOtpFocus(i-1); llOtpSync(); e.preventDefault();
        } else if (e.key === 'ArrowLeft' && i > 0) {
          llOtpFocus(i-1); e.preventDefault();
        } else if (e.key === 'ArrowRight' && i < boxes.length-1) {
          llOtpFocus(i+1); e.preventDefault();
        }
      });
      box.addEventListener('paste', (e) => {
        e.preventDefault();
        const txt = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g,'').slice(0,6);
        if (!txt) return;
        boxes.forEach((b, k) => {
          b.value = txt[k] || '';
          b.classList.toggle('filled', !!b.value);
        });
        llOtpSync();
        llOtpFocus(Math.min(txt.length, 5));
        if (txt.length === 6) setTimeout(() => lojaVerificarCodigo(), 120);
      });
    });
  }

  /* ════════════ Timer de expiração (10 min) ═══════════════════ */
  function llIniciarTimer() {
    llPararTimer();
    _llTimerRestante = 600; // 10 minutos
    llRenderTimer();
    _llTimerInt = setInterval(() => {
      _llTimerRestante--;
      if (_llTimerRestante <= 0) {
        llPararTimer();
        const hint = document.getElementById('login-codigo-hint');
        if (hint) hint.textContent = '⏱️ Código expirado. Toque em "Reenviar código".';
      } else {
        llRenderTimer();
      }
    }, 1000);
  }
  function llRenderTimer() {
    const el = document.getElementById('ll-timer');
    if (!el) return;
    const m = Math.floor(_llTimerRestante / 60);
    const s = _llTimerRestante % 60;
    el.textContent = m + ':' + String(s).padStart(2,'0');
  }
  function llPararTimer() {
    if (_llTimerInt) { clearInterval(_llTimerInt); _llTimerInt = null; }
  }

  /* ════════════ Cooldown do botão "Reenviar" (45s) ════════════ */
  const _LL_COOLDOWN_KEY = 'angatuba_otp_cooldown_ate';
  const _LL_COOLDOWN_SEG  = 60; // alinhado ao rate-limit do backend

  // Inicia o cooldown e grava o timestamp-alvo. Se 'restaurar' for true, retoma
  // um cooldown já em andamento (ex: usuário recarregou a página).
  function llIniciarCooldown(restaurar) {
    const btn = document.getElementById('ll-reenviar');
    if (!btn) return;
    if (_llCooldownInt) clearInterval(_llCooldownInt);

    let alvo;
    if (restaurar) {
      try { alvo = Number(localStorage.getItem(_LL_COOLDOWN_KEY)) || 0; } catch(e) { alvo = 0; }
      if (!alvo || alvo <= Date.now()) return; // nada a restaurar
    } else {
      alvo = Date.now() + _LL_COOLDOWN_SEG * 1000;
      try { localStorage.setItem(_LL_COOLDOWN_KEY, String(alvo)); } catch(e) {}
    }

    const tick = () => {
      const restante = Math.ceil((alvo - Date.now()) / 1000);
      if (restante <= 0) {
        clearInterval(_llCooldownInt); _llCooldownInt = null;
        btn.disabled = false;
        btn.textContent = 'Reenviar código';
        try { localStorage.removeItem(_LL_COOLDOWN_KEY); } catch(e) {}
      } else {
        btn.disabled = true;
        btn.textContent = `Reenviar em ${restante}s`;
      }
    };
    tick();
    _llCooldownInt = setInterval(tick, 1000);
  }
  function lojaReenviarCodigo() {
    const btn = document.getElementById('ll-reenviar');
    if (btn && btn.disabled) return;
    llOtpReset();
    const hint = document.getElementById('login-codigo-hint');
    if (hint) hint.innerHTML = 'Reenviando código…';
    // reaproveita o fluxo: _lojaWpp já está setado
    lojaRequestCodigo(true);
  }

  /* ── Máscara progressiva de WhatsApp: (15) 9 9999-9999 ─────── */
  function llMascaraWpp(el) {
    // Máscara única (mascararWppBR) — mesma lógica do campo de cadastro.
    el.value = mascararWppBR(el.value);
    // limpa erro ao digitar
    el.classList.remove('invalid');
    const errEl = document.getElementById('ll-wpp-err');
    if (errEl) errEl.classList.remove('show');
  }

  function llWppErro(msg) {
    const input = document.getElementById('ll-wpp');
    const errEl = document.getElementById('ll-wpp-err');
    if (input) input.classList.add('invalid');
    if (errEl) { errEl.textContent = msg; errEl.classList.add('show'); }
  }

  /* ── Passo 1: solicita código ──────────────────────────────── */
  async function lojaRequestCodigo(_ehReenvio) {
    const wppRaw = document.getElementById('ll-wpp').value.replace(/\D/g,'');
    const wpp = wppRaw.startsWith('55') ? wppRaw : '55' + wppRaw;
    if (wpp.length < 12) {
      llWppErro('Digite o número completo com DDD.');
      return;
    }
    _lojaWpp = wpp;

    // Fix: no reenvio o usuário está no step 2 — o botão do step 1 está oculto.
    // Mostra o loading no botão correto conforme o contexto.
    const btn = _ehReenvio
      ? document.getElementById('ll-reenviar')
      : document.querySelector('#login-step1 .modal-submit');
    const _btnLabelOrig = btn ? btn.innerHTML : '';
    if (btn) {
      btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> ' + (_ehReenvio ? 'Reenviando...' : 'Solicitando...');
      btn.disabled = true;
    }

    try {
      const params = new URLSearchParams();
      params.append('payload', JSON.stringify({ action: 'lojaRequestCodigo', wpp }));
      const resp = await fetch(APPS_SCRIPT_URL, {
        method: 'POST', body: params,
        signal: AbortSignal.timeout(30000),
      });
      const json = await resp.json();

      // Fix: backend devolve status:'ok' com cooldown:true quando o código já foi pedido
      // há pouco (rate-limit). Tratar como sucesso mostrava "código enviado" sem enviar nada.
      if (json.status === 'ok' && (json.data?.cooldown || json.cooldown)) {
        loginStep(2);
        const hintEl = document.getElementById('login-codigo-hint');
        if (hintEl) hintEl.textContent = json.msg || 'Código já enviado há pouco. Aguarde antes de pedir outro.';
        setTimeout(() => { llOtpFocus(0); }, 120);
        llIniciarCooldown();
      } else if (json.status === 'ok') {
        loginStep(2);
        document.getElementById('login-loja-sub').textContent = 'Código enviado! Confira seu WhatsApp.';

        // ── Preenche card de identidade da loja ─────────────────
        const infoLoja = json.data || {};
        const cardEl = document.getElementById('login-loja-card');
        if (cardEl) {
          cardEl.style.display = '';

          // Nome e ramo
          const nomeEl = document.getElementById('login-loja-nome');
          const ramoEl = document.getElementById('login-loja-ramo');
          if (nomeEl) nomeEl.textContent = infoLoja.nome || '—';
          if (ramoEl) ramoEl.textContent = infoLoja.ramo || '';

          // Badge de plano
          const badgeEl = document.getElementById('login-loja-badge');
          if (badgeEl) {
            const plano = (infoLoja.plano || 'GRATIS').toUpperCase();
            if (plano === 'PRO') {
              badgeEl.textContent = '⭐ PRO';
              badgeEl.style.background = 'linear-gradient(135deg, var(--plano-pro-1), var(--plano-pro-2))';
              badgeEl.style.color = '#000';
            } else if (plano === 'PLUS') {
              badgeEl.textContent = '✦ PLUS';
              badgeEl.style.background = 'linear-gradient(135deg, var(--plano-plus-1), var(--plano-plus-2))';
              badgeEl.style.color = '#fff';
            } else {
              badgeEl.textContent = 'GRÁTIS';
              badgeEl.style.background = 'rgba(122,122,122,0.3)';
              badgeEl.style.color = 'rgba(255,255,255,0.6)';
            }
          }

          // Logo da loja
          const logoImg   = document.getElementById('login-loja-logo-img');
          const logoEmoji = document.getElementById('login-loja-logo-emoji');
          if (logoImg && logoEmoji) {
            if (infoLoja.logo) {
              logoImg.src = infoLoja.logo;
              logoImg.style.display = '';
              logoEmoji.style.display = 'none';
            } else {
              logoImg.style.display = 'none';
              logoEmoji.style.display = '';
              // Tenta achar emoji na lista já carregada
              const lojaLocal = LOJAS.find(l => l.nome === infoLoja.nome);
              logoEmoji.textContent = lojaLocal?.emoji || '🏪';
            }
          }

          // BG foto de capa (borrada)
          const bgEl = document.getElementById('login-loja-bg');
          if (bgEl) {
            if (infoLoja.foto) {
              bgEl.style.backgroundImage = `url('${infoLoja.foto}')`;
              bgEl.style.display = '';
            } else {
              bgEl.style.display = 'none';
            }
          }

          // Cor de fundo baseada em categoria quando não tem foto
          const bgColorEl = document.getElementById('login-loja-bg-color');
          if (bgColorEl) {
            const cat = infoLoja.categoria || infoLoja.ramo || '';
            const catBg = CAT_BG[cat] || 'rgba(99,102,241,0.15)';
            bgColorEl.style.background = `linear-gradient(135deg,${catBg},rgba(13,13,13,0.9))`;
          }
        }

        setTimeout(() => { llOtpFocus(0); }, 120);
        llIniciarTimer();
        llIniciarCooldown();
      } else if (json.msg === 'WPP_NAO_ENCONTRADO') {
        llWppErro('Número não encontrado. Confira o WhatsApp ou use "Cadastrar".');
      } else if (json.msg === 'LOJA_NAO_APROVADA') {
        llWppErro('Sua loja ainda está pendente de aprovação. Aguarde o contato.');
      } else {
        llWppErro(json.msg || 'Erro ao solicitar. Tente novamente.');
      }
    } catch(e) {
      // Timeout não significa falha: o backend quase sempre já gerou e enviou
      // o código (o e-mail/WhatsApp chega), só não devolveu a resposta a tempo.
      // Em vez de travar, avança para a tela do código.
      const ehTimeout = e && (e.name === 'TimeoutError' || e.name === 'AbortError');
      if (ehTimeout) {
        loginStep(2);
        document.getElementById('login-loja-sub').textContent =
          'Se você está cadastrado, o código já está a caminho. Confira seu WhatsApp.';
        const cardEl = document.getElementById('login-loja-card');
        if (cardEl) cardEl.style.display = 'none';
        setTimeout(() => { llOtpFocus(0); }, 120);
        llIniciarTimer();
        llIniciarCooldown();
      } else {
        llWppErro('Erro de conexão. Verifique sua internet.');
      }
    } finally {
      // Fix: restaura o botão certo. No reenvio o cooldown (llIniciarCooldown) cuida do
      // texto/disabled do link; só restauramos o botão do step 1 aqui.
      if (btn && !_ehReenvio) {
        btn.innerHTML = '<i class="fab fa-whatsapp"></i> Receber código';
        btn.disabled = false;
      } else if (btn && _ehReenvio && !btn.disabled) {
        btn.innerHTML = _btnLabelOrig || 'Reenviar código';
      }
    }
  }

  /* ── Passo 2: verifica código ─────────────────────────────── */
  async function lojaVerificarCodigo() {
    if (_llVerificando) return;            // evita disparo duplo (auto + clique)
    const codigo = (document.getElementById('ll-codigo').value || '').trim();
    if (!/^\d{6}$/.test(codigo)) {
      document.getElementById('login-codigo-hint').textContent = 'O código tem 6 dígitos.';
      return;
    }
    _llVerificando = true;

    const btn = document.querySelector('#login-step2 .modal-submit');
    btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Verificando...';
    btn.disabled = true;

    try {
      const params = new URLSearchParams();
      params.append('payload', JSON.stringify({ action: 'lojaVerificarCodigo', wpp: _lojaWpp, codigo }));
      const resp = await fetch(APPS_SCRIPT_URL, {
        method: 'POST', body: params,
        signal: AbortSignal.timeout(30000),
      });
      const json = await resp.json();

      if (json.status === 'ok' && json.data.token) {
        llPararTimer();
        const otp = document.getElementById('ll-otp');
        if (otp) { otp.classList.remove('error'); otp.classList.add('success'); }
        _lojaToken = json.data.token;
        _lojaNome  = json.data.nome || '';
        localStorage.setItem('angatuba_loja_token', _lojaToken);
        localStorage.setItem('angatuba_loja_nome',  _lojaNome);
        localStorage.setItem('angatuba_loja_wpp',   _lojaWpp);
        setTimeout(() => {
          closeLoginLoja();
          atualizarNav();
          abrirMinhaLoja();
        }, 350);
      } else if (json.msg === 'CODIGO_INVALIDO') {
        llOtpErro('❌ Código inválido. Confira os dígitos ou solicite um novo.');
      } else if (json.msg === 'CODIGO_EXPIRADO') {
        llOtpErro('⏱️ Código expirado. Toque em "Reenviar código".');
      } else if (json.msg === 'CODIGO_BLOQUEADO') {
        llOtpErro('🔒 Muitas tentativas. Aguarde e reenvie o código.');
      } else {
        llOtpErro(json.msg || 'Erro ao verificar. Tente novamente.');
      }
    } catch(e) {
      const ehTimeout = e && (e.name === 'TimeoutError' || e.name === 'AbortError');
      const hintEl = document.getElementById('login-codigo-hint');
      if (ehTimeout && hintEl) {
        hintEl.textContent = '⏱️ O servidor demorou a responder. Aguarde alguns segundos e toque em Confirmar de novo.';
      } else {
        mlToast('Erro de conexão. Verifique sua internet.', 'erro');
      }
    } finally {
      _llVerificando = false;
      btn.innerHTML = '<i class="fa fa-check"></i> Confirmar código';
      btn.disabled = false;
    }
  }

  /* ── Painel Minha Loja ─────────────────────────────────────── */
  // Item 2: junção estável da própria loja com a lista pública LOJAS.
  // Antes cruzava por nome (LOJAS.find(l => l.nome === d.nome)); ao renomear
  // a loja, d.nome (cache fresco) deixava de casar com LOJAS (nome antigo até
  // o feed público revalidar) e o hero perdia foto/logo, o banner de avaliação
  // e as sugestões de tags paravam de achar a loja. O WhatsApp é chave estável:
  // não muda ao editar o nome. Comparamos só os dígitos, tolerando o prefixo 55
  // (o feed público faz replace(/\D/g,'') sem garantir 55; lojaDados pode ter 55).
  function _mlDigitos(v) { return String(v || '').replace(/\D/g, ''); }
  function _mlMesmoWpp(a, b) {
    a = _mlDigitos(a); b = _mlDigitos(b);
    if (!a || !b) return false;
    if (a === b) return true;
    // Tolera divergência do prefixo país: compara os últimos 11 dígitos (DDD+numero)
    const ax = a.startsWith('55') ? a.slice(2) : a;
    const bx = b.startsWith('55') ? b.slice(2) : b;
    return ax === bx && ax.length >= 10;
  }
  // Resolve o objeto da loja em LOJAS a partir dos dados do painel (d) ou de um
  // wpp/nome soltos. Prioriza wpp; nome é só último recurso (retrocompat).
  function _mlAcharLojaLocal(dOuWpp, nomeFallback) {
    if (typeof LOJAS === 'undefined' || !Array.isArray(LOJAS)) return null;
    let wpp = '', nome = '';
    if (dOuWpp && typeof dOuWpp === 'object') { wpp = dOuWpp.wpp || ''; nome = dOuWpp.nome || ''; }
    else { wpp = dOuWpp || ''; }
    if (!wpp) wpp = _lojaWpp || localStorage.getItem('angatuba_loja_wpp') || '';
    if (!nome) nome = nomeFallback || '';
    let loja = wpp ? LOJAS.find(l => _mlMesmoWpp(l.wpp, wpp)) : null;
    if (!loja && nome) loja = LOJAS.find(l => l.nome === nome); // fallback legado
    return loja || null;
  }
  function _mlAcharIdxLojaLocal(dOuWpp, nomeFallback) {
    const loja = _mlAcharLojaLocal(dOuWpp, nomeFallback);
    return loja ? LOJAS.indexOf(loja) : -1;
  }

  // Atualiza só o badge de plano no hero do painel. Extraído para ser reutilizado
  // pelo polling pós-pagamento (atualiza ao vivo mesmo fora do _aplicarDadosLoja).
  function _aplicarBadgePlano(plano) {
    const planBadge = document.getElementById('ml-plan-badge');
    if (!planBadge) return;
    const p = (plano || 'GRATIS').toUpperCase();
    // Item 12: usa os tokens canônicos de plano (var(--plano-*)) em vez de hex soltos.
    if (p === 'PRO') {
      planBadge.textContent = '⭐ PRO';
      planBadge.style.background = 'linear-gradient(135deg, var(--plano-pro-1), var(--plano-pro-2))';
      planBadge.style.color = '#000';
    } else if (p === 'PLUS') {
      planBadge.textContent = '✦ PLUS';
      planBadge.style.background = 'linear-gradient(135deg, var(--plano-plus-1), var(--plano-plus-2))';
      planBadge.style.color = '#fff';
    } else {
      planBadge.textContent = 'GRÁTIS';
      planBadge.style.background = 'rgba(122,122,122,0.4)';
      planBadge.style.color = 'rgba(255,255,255,0.7)';
    }
  }
  window._aplicarBadgePlano = _aplicarBadgePlano;

  // Aplica dados de lojaDados no painel (usado tanto pelo cache quanto pela API)
  function _aplicarDadosLoja(d, metJson, preservarToggle = false) {
    _lojaNome = d.nome;
    localStorage.setItem('angatuba_loja_nome', _lojaNome);

    document.getElementById('ml-nome').textContent = d.nome;
    document.getElementById('ml-ramo').textContent = d.ramo || '—';

    // ── Hero: foto de capa ────────────────────────────────
    const heroEl    = document.getElementById('ml-hero');
    const heroImgEl = document.getElementById('ml-hero-img');
    const plano     = d.plano || 'GRATIS';
    const isPago    = plano !== 'GRATIS';
    const isPro     = plano === 'PRO';
    _mlPlanoAtual = (plano || 'GRATIS').toUpperCase();
    const isPlus    = plano === 'PLUS';

    // Usa foto/logo do lojaDados; fallback na lista LOJAS já carregada.
    // Item 2: junção por WhatsApp (estável a renomeações), não por nome.
    const lojaLocal = _mlAcharLojaLocal(d);
    const fotoUrl   = d.foto  || lojaLocal?.foto  || '';
    const logoUrl   = d.logo  || lojaLocal?.logo  || '';

    if (isPago && fotoUrl) {
      if (heroImgEl) { heroImgEl.src = fotoUrl; heroImgEl.style.display = ''; }
      if (heroEl) heroEl.style.background = '#0d0d0d';
    } else {
      if (heroImgEl) heroImgEl.style.display = 'none';
      const cat   = lojaLocal?.categoria || '';
      const catBg = CAT_BG[cat] || 'rgba(99,102,241,0.12)';
      if (heroEl) heroEl.style.background = `linear-gradient(135deg, ${catBg} 0%, #0d0d0d 100%)`;
    }

    // ── Logo / emoji ──────────────────────────────────────
    const logoImgEl = document.getElementById('ml-logo-img');
    const emojiEl   = document.getElementById('ml-emoji');

    if (isPago && logoUrl) {
      if (logoImgEl) { logoImgEl.src = logoUrl; logoImgEl.style.display = ''; }
      if (emojiEl)   emojiEl.style.display = 'none';
    } else {
      if (logoImgEl) logoImgEl.style.display = 'none';
      if (emojiEl) {
        emojiEl.style.display = '';
        emojiEl.textContent = lojaLocal?.emoji || '🏪';
      }
    }

    // Badge de plano
    _aplicarBadgePlano(plano);

    // ── Instagram da loja ─────────────────────────────────
    const mlIgWrap = document.getElementById('ml-instagram-wrap');
    if (mlIgWrap) {
      mlIgWrap.style.display = '';
      const igHandleAtual = normalizarInstagramHandle(d.instagram);
      mlIgWrap.innerHTML = `
        <div style="display:flex;gap:8px;align-items:center;">
          <div style="position:relative;flex:1;display:flex;align-items:center;">
            <span style="position:absolute;left:11px;color:#e1306c;font-size:13px;pointer-events:none;">
              <i class="fab fa-instagram"></i>
            </span>
            <input type="text" id="ml-ig-input" value="${igHandleAtual ? '@'+igHandleAtual : ''}"
              placeholder="@nomedoperfil"
              style="width:100%;background:var(--surface);border:1px solid var(--border);border-radius:9px;
                     padding:9px 10px 9px 32px;font-size:12px;color:var(--text);box-sizing:border-box;"/>
          </div>
          <button onclick="mlSalvarInstagram()" id="ml-ig-save-btn"
            style="flex-shrink:0;padding:9px 14px;border-radius:9px;
                   background:linear-gradient(135deg,#e1306c,#c13584);color:#fff;
                   font-family:var(--font-h);font-size:11px;font-weight:800;border:none;cursor:pointer;">
            Salvar
          </button>
        </div>
        ${igHandleAtual ? `
        <a href="https://instagram.com/${igHandleAtual}" target="_blank" rel="noopener"
          style="display:flex;align-items:center;gap:6px;margin-top:8px;font-size:11px;color:#e1306c;text-decoration:none;">
          <i class="fa fa-external-link-alt" style="font-size:9px;"></i> Ver perfil atual: @${igHandleAtual}
        </a>` : ''}
        <div id="ml-ig-status" role="status" aria-live="polite" style="font-size:10px;margin-top:6px;min-height:13px;"></div>`;
    }

    // ── Toggle FazEntrega ─────────────────────────────────
    // Informacoes da loja (nome, telefone, endereco, horario, tags, descricao)
    if (typeof window.mlRenderInfo === 'function') window.mlRenderInfo(d);

    const mlEntregaWrap = document.getElementById('ml-entrega-wrap');
    if (mlEntregaWrap) {
      const entregaOn = !!d.fazEntrega;
      // Item 15: rótulo textual do estado ao lado do switch (antes a cor era o único
      // sinal de on/off, destoando dos botões de status que dizem o estado por extenso).
      // Item 12: cor verde padronizada em var(--green) (era #10b981, fora da paleta).
      mlEntregaWrap.innerHTML = `
        <label style="display:flex;align-items:center;justify-content:space-between;cursor:pointer;gap:12px;">
          <span style="font-size:12px;color:var(--text);line-height:1.4;">Fazemos entrega</span>
          <span style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
            <span id="ml-entrega-label" style="font-size:11px;font-weight:700;color:${entregaOn ? 'var(--green)' : 'var(--muted)'};min-width:64px;text-align:right;">${entregaOn ? 'Ativado' : 'Desativado'}</span>
            <div id="ml-entrega-toggle"
              onclick="mlToggleEntrega()"
              role="switch" tabindex="0" aria-checked="${entregaOn ? 'true' : 'false'}" aria-label="Fazemos entrega"
              data-ativo="${entregaOn ? '1' : '0'}"
              style="flex-shrink:0;width:42px;height:24px;border-radius:12px;
                     background:${entregaOn ? 'var(--green)' : 'var(--border)'};
                     position:relative;cursor:pointer;transition:background .2s;">
              <div style="position:absolute;top:3px;left:${entregaOn ? '21px' : '3px'};
                          width:18px;height:18px;border-radius:50%;background:#fff;
                          transition:left .2s;box-shadow:0 1px 3px rgba(0,0,0,.3);"
                   id="ml-entrega-thumb"></div>
            </div>
          </span>
        </label>
        <div id="ml-entrega-status" role="status" aria-live="polite" style="font-size:10px;margin-top:6px;min-height:13px;color:var(--muted);"></div>
        <!-- Painel de taxa: visível só quando 'Fazemos entrega' está ligado -->
        <div id="ml-taxa-wrap" style="display:${entregaOn ? 'block' : 'none'};margin-top:12px;padding-top:12px;border-top:1px solid var(--border);">
          <div style="font-size:11px;color:var(--text);font-weight:600;margin-bottom:8px;">Como você cobra a entrega?</div>
          <select id="ml-taxa-modo" onchange="mlTaxaModoChange()"
            style="width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:9px;padding:10px;color:var(--text);font-size:12px;font-family:var(--font-b);box-sizing:border-box;outline:none;-webkit-appearance:none;appearance:none;margin-bottom:8px;">
            <option value="GRATIS">🎉 Entrega grátis (não cobro)</option>
            <option value="FIXA">💵 Valor fixo</option>
            <option value="MINIMO">🎁 Grátis acima de um valor</option>
            <option value="COMBINAR">💬 A combinar com o cliente</option>
          </select>
          <!-- Campo: valor fixo -->
          <div id="ml-taxa-fixa-box" style="display:none;margin-bottom:8px;">
            <div style="display:flex;align-items:center;gap:6px;background:var(--surface2);border:1px solid var(--border);border-radius:9px;padding:9px 10px;">
              <span style="font-size:12px;color:var(--muted);">R$</span>
              <input type="text" id="ml-taxa-fixa-val" inputmode="decimal" placeholder="5,00"
                style="flex:1;background:none;border:none;color:var(--text);font-size:12px;font-family:var(--font-b);outline:none;">
            </div>
          </div>
          <!-- Campos: mínimo (piso + taxa) -->
          <div id="ml-taxa-min-box" style="display:none;margin-bottom:8px;">
            <div style="display:flex;align-items:center;gap:6px;background:var(--surface2);border:1px solid var(--border);border-radius:9px;padding:9px 10px;margin-bottom:6px;">
              <span style="font-size:11px;color:var(--muted);white-space:nowrap;">Grátis acima de R$</span>
              <input type="text" id="ml-taxa-min-piso" inputmode="decimal" placeholder="100,00"
                style="flex:1;background:none;border:none;color:var(--text);font-size:12px;font-family:var(--font-b);outline:none;">
            </div>
            <div style="display:flex;align-items:center;gap:6px;background:var(--surface2);border:1px solid var(--border);border-radius:9px;padding:9px 10px;">
              <span style="font-size:11px;color:var(--muted);white-space:nowrap;">Senão, cobro R$</span>
              <input type="text" id="ml-taxa-min-val" inputmode="decimal" placeholder="8,00"
                style="flex:1;background:none;border:none;color:var(--text);font-size:12px;font-family:var(--font-b);outline:none;">
            </div>
          </div>
          <button onclick="mlSalvarTaxaEntrega()" id="ml-taxa-salvar-btn"
            style="width:100%;padding:10px;border-radius:9px;background:var(--surface2);border:1px solid var(--green);color:var(--green);font-family:var(--font-h);font-size:12px;font-weight:700;cursor:pointer;">
            Salvar forma de cobrança
          </button>
          <div id="ml-taxa-status" role="status" aria-live="polite" style="font-size:10px;margin-top:6px;min-height:13px;color:var(--muted);"></div>
        </div>`;
      // Preenche a UI de taxa com o valor salvo (parse do formato MODO:VALOR).
      _mlPreencherTaxa(String(d.taxaEntrega || ''));
    }

    // ── Toggle Agendamento (espelho do FazEntrega) ───────────
    const mlAgendWrap = document.getElementById('ml-agendamento-wrap');
    if (mlAgendWrap) {
      const agendOn = !!d.agendamento;
      mlAgendWrap.innerHTML = `
        <label style="display:flex;align-items:center;justify-content:space-between;cursor:pointer;gap:12px;">
          <span style="font-size:12px;color:var(--text);line-height:1.4;">Atendo por agendamento</span>
          <span style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
            <span id="ml-agend-label" style="font-size:11px;font-weight:700;color:${agendOn ? 'var(--green)' : 'var(--muted)'};min-width:64px;text-align:right;">${agendOn ? 'Ativado' : 'Desativado'}</span>
            <div id="ml-agend-toggle"
              onclick="mlToggleAgendamento()"
              role="switch" tabindex="0" aria-checked="${agendOn ? 'true' : 'false'}" aria-label="Atendo por agendamento"
              data-ativo="${agendOn ? '1' : '0'}"
              style="flex-shrink:0;width:42px;height:24px;border-radius:12px;
                     background:${agendOn ? 'var(--green)' : 'var(--border)'};
                     position:relative;cursor:pointer;transition:background .2s;">
              <div style="position:absolute;top:3px;left:${agendOn ? '21px' : '3px'};
                          width:18px;height:18px;border-radius:50%;background:#fff;
                          transition:left .2s;box-shadow:0 1px 3px rgba(0,0,0,.3);"
                   id="ml-agend-thumb"></div>
            </div>
          </span>
        </label>
        <div id="ml-agend-status" role="status" aria-live="polite" style="font-size:10px;margin-top:6px;min-height:13px;color:var(--muted);"></div>`;
    }

    // Toggle — só aplica se o dono não interagiu durante carregamento
    if (!preservarToggle) marcarToggle(d.statusLoja || '');

    // Atualiza hero com status + cliques do dia
    const cliquesHoje = (metJson && metJson.status === 'ok' && metJson.data.metricas)
      ? (metJson.data.metricas.hoje ?? 0) : 0;
    if (typeof mlAtualizarHeroStatus === 'function') {
      mlAtualizarHeroStatus(d.statusLoja || '', cliquesHoje);
    }

    // CTA upgrade
    const upgradeCta = document.getElementById('ml-upgrade-cta');
    upgradeCta.style.display = (plano === 'GRATIS') ? '' : 'none';
    if (plano === 'GRATIS') {
      const upgradeMsg = encodeURIComponent(`Olá! Sou dono da loja *${d.nome}* no AngatubaON e quero saber mais sobre os planos pagos!`);
      const upgradeUrl = `https://wa.me/${ADMIN_WPP_CONTATO}?text=${upgradeMsg}`;
      document.getElementById('ml-upgrade-link').href = upgradeUrl;
      const lockLink = document.getElementById('ml-lock-upgrade-link');
      if (lockLink) lockLink.href = upgradeUrl;
    }

    // ── Banners da aba Hoje: vencimento (#3) e nova avaliação (#5) ──
    mlRenderVencimento(d);
    mlRenderAvaliacaoNova(d);

    // ── Link de compartilhamento (Plus e Pro) ────────────
    const shareSection = document.getElementById('ml-share-section');
    if (shareSection) {
      shareSection.style.display = isPago ? '' : 'none';
      if (isPago) mlMontarCompartilhamento(d.nome);
    }

    // ── Upload de imagens (Plus e Pro) ───────────────────
    const uploadSection = document.getElementById('ml-upload-section');
    if (uploadSection) {
      uploadSection.style.display = isPago ? '' : 'none';
      if (isPago) {
        // Preenche nome/ramo no preview do card
        const nomePreview = document.getElementById('ml-up-nome-preview');
        const ramoPreview = document.getElementById('ml-up-ramo-preview');
        if (nomePreview) nomePreview.textContent = d.nome || '—';
        // Item 14: lojaDados devolve `ramo` (não `categoria`) — usa a fonte real.
        // Antes usava `d.categoria || d.ramo`, e d.categoria era sempre undefined.
        if (ramoPreview) ramoPreview.textContent = d.ramo || '—';
        if (fotoUrl) mlSetPreviewUpload('foto', fotoUrl);
        if (logoUrl) mlSetPreviewUpload('logo', logoUrl);
      }
    }

    // ── Anúncio do dia (Plus = texto; Pro = texto + foto) ──
    const anuncioSection = document.getElementById('ml-anuncio-section');
    if (anuncioSection) {
      const temAnuncio = isPro || isPlus;
      anuncioSection.style.display = temAnuncio ? '' : 'none';

      // Badge dinâmico: Plus ou Pro
      const planoBadgeEl = document.getElementById('ml-anuncio-plano-badge');
      if (planoBadgeEl) planoBadgeEl.textContent = isPro ? 'PRO' : 'PLUS';

      // Seção upload de imagem: só Pro
      const imgSection = document.getElementById('ml-anuncio-img-section');
      if (imgSection) imgSection.style.display = isPro ? '' : 'none';

      if (isPro) {
        // Fase 2: Pro usa lista de stories (até 5). Esconde o card único
        // e carrega a lista do backend.
        var _av = document.getElementById('ml-anuncio-ativo');
        if (_av) _av.style.display = 'none';
        var _lst = document.getElementById('ml-stories-lista');
        var _cnt = document.getElementById('ml-stories-contador');
        if (_lst) _lst.style.display = '';
        if (_cnt) _cnt.style.display = '';
        mlStoriesCarregar();
      } else if (temAnuncio && metJson && metJson.status === 'ok') {
        // PLUS: comportamento Fase 1 (anúncio único de texto).
        if (metJson.data.anuncio) {
          mlExibirAnuncioAtivo(metJson.data.anuncio);
        } else {
          try {
            const cache = localStorage.getItem('angatuba_anuncio');
            if (cache) {
              const obj = JSON.parse(cache);
              if (obj.expira && new Date(obj.expira) > new Date()) {
                mlExibirAnuncioAtivo(obj);
              } else {
                localStorage.removeItem('angatuba_anuncio');
                document.getElementById('ml-anuncio-ativo').style.display = 'none';
              }
            }
          } catch(e) {}
        }
      }
    }

    // ── Métricas ─────────────────────────────────────────
    if (metJson && metJson.status === 'ok') {
      const m = metJson.data.metricas || { total:0, wpp:0, tel:0, d7:0, d30:0 };
      const lockEl = document.getElementById('ml-metricas-lock');

      // Badge de novos cliques desde última visita
      const novos = metJson.data.novosCliques ?? 0;
      const tituloMetricas = document.querySelector('#ml-metricas-wrap')?.previousElementSibling;
      if (tituloMetricas && novos > 0) {
        const existeBadge = tituloMetricas.querySelector('.ml-badge-novo');
        if (!existeBadge) {
          tituloMetricas.insertAdjacentHTML('beforeend',
            `<span class="ml-badge-novo">+${novos} hoje</span>`);
        }
      }
      // Item 4: removida a escrita de `angatuba_ultima_visita_<token>` — a chave
      // era gravada aqui mas NUNCA lida em nenhum ponto do código (código morto que
      // ainda acumulava uma chave órfã por sessão no localStorage). O cálculo de
      // "novos cliques hoje" é feito 100% no backend (calcNovosHojeComDados).
      if (typeof mlAtualizarBadgeMetricas === 'function') {
        mlAtualizarBadgeMetricas(novos);
      }

      if (isPago) {
        if (lockEl) lockEl.style.display = 'none';
        document.getElementById('ml-m-7d').textContent    = m.d7   ?? 0;
        document.getElementById('ml-m-30d').textContent   = m.d30  ?? 0;
        document.getElementById('ml-m-total').textContent = m.total ?? 0;
        document.getElementById('ml-m-wpp').textContent   = m.wpp  ?? 0;
        document.getElementById('ml-m-tel').textContent   = m.tel  ?? 0;
        if (document.getElementById('ml-m-ig')) document.getElementById('ml-m-ig').textContent = m.ig ?? 0;
      } else {
        // Item 1: plano Grátis NÃO deve renderizar os números detalhados no DOM.
        // O backend já envia só { total, bloqueado } — aqui escrevemos '—' nos
        // campos travados (o overlay de bloqueio cobre o grid) e populamos apenas
        // o total do overlay ("você já tem N cliques"). Nada de dado real no DOM.
        document.getElementById('ml-m-7d').textContent    = '—';
        document.getElementById('ml-m-30d').textContent   = '—';
        document.getElementById('ml-m-total').textContent = '—';
        document.getElementById('ml-m-wpp').textContent   = '—';
        document.getElementById('ml-m-tel').textContent   = '—';
        if (document.getElementById('ml-m-ig')) document.getElementById('ml-m-ig').textContent = '—';
        document.getElementById('ml-lock-total').textContent = m.total ?? 0;
        if (lockEl) lockEl.style.display = '';
      }

      // ── Visibilidade / Crescimento / Conversão (só Pro) ──
      mlRenderMetricasExtra(m, isPro);

      // ── Melhor mês histórico (#6, só Pro) ──
      mlRenderMelhorMes(metJson.data.melhorMes, isPro);

      // ── Horário de pico (só Pro) ──────────────────────
      const picoSection = document.getElementById('ml-pico-section');
      if (picoSection) {
        picoSection.style.display = isPro ? '' : 'none';
        if (isPro && metJson.data.pico) {
          requestAnimationFrame(() => mlRenderizarPico(metJson.data.pico));
        }
      }
    }
  }

  // ── Banner de vencimento do plano (#3) ───────────────────
  // Usa d.planoValidade ('dd/mm/yyyy') que já vem do backend. Mostra o banner
  // quando faltam <= 7 dias, ou quando já venceu (edge: cache antigo). Só pagas.
  function mlRenderVencimento(d) {
    const banner = document.getElementById('ml-vencimento-banner');
    if (!banner) return;
    const plano = (d.plano || 'GRATIS').toUpperCase();
    const val   = String(d.planoValidade || '').trim();
    // Grátis, ou sem validade (vitalício admin): nunca mostra.
    if (plano === 'GRATIS' || !val) { banner.style.display = 'none'; return; }
    const partes = val.split('/');
    if (partes.length !== 3) { banner.style.display = 'none'; return; }
    // Meia-noite BRT do dia de validade vs. hoje BRT (mesma referência do backend)
    const validade = new Date(Date.UTC(
      parseInt(partes[2], 10), parseInt(partes[1], 10) - 1, parseInt(partes[0], 10), 3, 0, 0));
    const now  = new Date();
    const hoje = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 3, 0, 0));
    const dias = Math.round((validade.getTime() - hoje.getTime()) / (24 * 60 * 60 * 1000));

    const titulo = document.getElementById('ml-vencimento-titulo');
    const texto  = document.getElementById('ml-vencimento-texto');
    const owl    = document.getElementById('ml-vencimento-owl');
    const nomePlano = plano === 'PRO' ? 'Pro' : 'Plus';

    // Só avisa a partir de 7 dias antes. Mais que isso: não incomoda.
    if (dias > 7) { banner.style.display = 'none'; return; }

    let urgente = false;
    let msg = '';
    if (dias > 1) {
      msg = `Seu plano ${nomePlano} vence em ${dias} dias. Renove para não perder o destaque e as métricas.`;
    } else if (dias === 1) {
      urgente = true;
      msg = `Seu plano ${nomePlano} vence amanhã. Renove para não cair para o Grátis.`;
    } else if (dias === 0) {
      urgente = true;
      msg = `Seu plano ${nomePlano} vence hoje. Renove agora para não perder seus benefícios.`;
    } else {
      // já venceu (backend ainda não rebaixou, ou cache antigo)
      urgente = true;
      msg = `Seu plano ${nomePlano} venceu. Renove para reativar o destaque e as métricas.`;
    }

    // Cor: âmbar (aviso) até 2 dias, vermelho (urgente) em 0/1/vencido
    if (urgente) {
      banner.style.background = 'linear-gradient(135deg,rgba(239,68,68,0.14),rgba(239,68,68,0.05))';
      banner.style.border = '1px solid rgba(239,68,68,0.35)';
      if (titulo) titulo.style.color = 'var(--red)';
      if (owl) owl.src = '/webp/owl-empty-wallet.webp';
    } else {
      banner.style.background = 'linear-gradient(135deg,rgba(245,158,11,0.14),rgba(245,158,11,0.05))';
      banner.style.border = '1px solid rgba(245,158,11,0.3)';
      if (titulo) titulo.style.color = 'var(--zap)';
      if (owl) owl.src = '/webp/owl-sign.webp';
    }
    if (texto) texto.textContent = msg;
    banner.style.display = 'flex';
  }

  // ── Banner de nova avaliação (#5, só pagas) ──────────────
  // Compara nº de avaliações atual (da lista pública LOJAS) com o total
  // guardado na última visita ao painel. Se aumentou, avisa. Chave por loja.
  function mlRenderAvaliacaoNova(d) {
    const banner = document.getElementById('ml-aval-nova-banner');
    if (!banner) return;
    const plano = (d.plano || 'GRATIS').toUpperCase();
    if (plano === 'GRATIS') { banner.style.display = 'none'; return; }

    // Item 2: junção por WhatsApp (estável a renomeações), não por nome.
    const lojaLocal = _mlAcharLojaLocal(d);
    const avals = (lojaLocal && lojaLocal.avaliacoes) ? lojaLocal.avaliacoes : null;
    // Sem dados de avaliação carregados ainda: não arrisca falso positivo.
    if (!avals) { banner.style.display = 'none'; return; }
    const atual = avals.length;

    const chave = `angatuba_aval_count_${toSlug(d.nome)}`;
    let anterior = null;
    try {
      const v = localStorage.getItem(chave);
      if (v !== null) anterior = parseInt(v, 10);
    } catch(e) {}

    // Primeira visita (sem baseline): só registra, não mostra banner.
    if (anterior === null || isNaN(anterior)) {
      try { localStorage.setItem(chave, String(atual)); } catch(e) {}
      banner.style.display = 'none';
      return;
    }

    const novas = atual - anterior;
    if (novas <= 0) {
      // Empatou ou diminuiu (avaliação removida/sinalizada): atualiza baseline.
      try { localStorage.setItem(chave, String(atual)); } catch(e) {}
      banner.style.display = 'none';
      return;
    }

    // Há avaliações novas: monta mensagem com a nota mais recente, se houver.
    const texto = document.getElementById('ml-aval-nova-texto');
    let msg;
    if (novas === 1) {
      // Tenta destacar a nota da avaliação mais recente (última do array)
      const ultima = avals[avals.length - 1];
      const nota = ultima && ultima.nota ? ultima.nota : null;
      msg = nota
        ? `Você recebeu uma nova avaliação ${nota}★! Toque para ver.`
        : `Você recebeu uma nova avaliação! Toque para ver.`;
    } else {
      msg = `Você recebeu ${novas} novas avaliações! Toque para ver.`;
    }
    if (texto) texto.textContent = msg;
    banner.style.display = 'flex';

    // NÃO atualiza o baseline aqui: só depois que o lojista abrir as avaliações
    // (mlIrParaAvaliacoes). Assim o aviso persiste até ele de fato conferir.
    banner.dataset.avalCount = String(atual);
    banner.dataset.avalChave = chave;
  }

  // Abre os detalhes públicos da própria loja (onde ficam as avaliações)
  // e zera o baseline de "novas avaliações".
  window.mlIrParaAvaliacoes = function() {
    const banner = document.getElementById('ml-aval-nova-banner');
    // Consolida baseline: o lojista está indo conferir.
    if (banner && banner.dataset.avalChave) {
      try { localStorage.setItem(banner.dataset.avalChave, banner.dataset.avalCount || '0'); } catch(e) {}
      banner.style.display = 'none';
    }
    const nome = _lojaNome || localStorage.getItem('angatuba_loja_nome') || '';
    // Item 2: acha a própria loja por WhatsApp (estável a renomeações); nome é fallback.
    const idx = _mlAcharIdxLojaLocal(null, nome);
    if (idx < 0) return;
    // Fecha o painel e abre os detalhes da loja
    if (typeof fecharMinhaLoja === 'function') fecharMinhaLoja();
    setTimeout(() => { if (typeof abrirDetalhes === 'function') abrirDetalhes(idx); }, 200);
  };

  // Botão "Renovar" do banner de vencimento → WhatsApp de contato (mesmo do upgrade)
  window.mlRenovarPlano = function() {
    const nome = _lojaNome || localStorage.getItem('angatuba_loja_nome') || 'minha loja';
    const msg = encodeURIComponent(`Olá! Sou dono da loja *${nome}* no AngatubaON e quero renovar meu plano.`);
    window.open(`https://wa.me/${ADMIN_WPP_CONTATO}?text=${msg}`, '_blank', 'noopener');
  };

  // ── Card "Seu melhor mês" (#6, só Pro) ───────────────────
  // Recebe { rotulo, total, ym } do backend (calcMelhorMesComDados) ou null.
  function mlRenderMelhorMes(mm, isPro) {
    const box = document.getElementById('ml-melhormes-box');
    if (!box) return;
    if (!isPro || !mm || !mm.total) { box.style.display = 'none'; return; }

    const elRot   = document.getElementById('ml-melhormes-rotulo');
    const elTotal = document.getElementById('ml-melhormes-total');
    const elMsg   = document.getElementById('ml-melhormes-msg');
    if (elRot)   elRot.textContent = mm.rotulo || '—';
    if (elTotal) elTotal.textContent = mm.total;

    if (elMsg) {
      // Se o melhor mês é o mês atual, celebra recorde em andamento.
      const now = new Date();
      const ymAtual = now.getFullYear() + '-' + ('0' + (now.getMonth() + 1)).slice(-2);
      if (mm.ym === ymAtual) {
        elMsg.textContent = 'É este mês! Você está batendo seu próprio recorde. 🚀';
      } else {
        elMsg.textContent = `Seu recorde de cliques de contato num único mês. Bora superar?`;
      }
    }
    box.style.display = '';
  }

  // Renderiza os blocos extra de métricas: visualizações, crescimento semanal
  // e conversão por canal. Exclusivos do plano Pro. Tudo a partir do objeto
  // que o backend já devolve.
  function mlRenderMetricasExtra(m, isPro) {
    const visRow   = document.getElementById('ml-visibilidade-row');
    const crescBox = document.getElementById('ml-crescimento-box');
    const convBox  = document.getElementById('ml-conversao-box');

    // Só Pro: nos demais planos esses blocos ficam escondidos.
    if (!isPro) {
      if (visRow)   visRow.style.display   = 'none';
      if (crescBox) crescBox.style.display = 'none';
      if (convBox)  convBox.style.display  = 'none';
      const taxaBoxHide = document.getElementById('ml-taxaconv-box');
      if (taxaBoxHide) taxaBoxHide.style.display = 'none';
      return;
    }

    const views = m.views ?? 0;
    const menu  = m.menu  ?? 0;
    const wpp   = m.wpp   ?? 0;
    const tel   = m.tel   ?? 0;
    const ig    = m.ig    ?? 0;
    const totalContato = wpp + tel + ig;

    // ── Visualizações ──
    if (visRow) {
      const elV = document.getElementById('ml-m-views');
      const elM = document.getElementById('ml-m-menu');
      if (elV) elV.textContent = views;
      if (elM) elM.textContent = menu;
      visRow.style.display = 'flex';
    }

    // ── Viram anúncio (só aparece quando há registros) ──
    const anuncios = m.anuncios ?? 0;
    const anuncioCard = document.getElementById('ml-m-anuncio-card');
    const elAnuncio = document.getElementById('ml-m-anuncio');
    if (anuncioCard && elAnuncio) {
      if (anuncios > 0) {
        elAnuncio.textContent = anuncios;
        anuncioCard.style.display = '';
      } else {
        anuncioCard.style.display = 'none';
      }
    }

    // ── Taxa de conversão (views → cliques de contato) ──
    const taxaBox = document.getElementById('ml-taxaconv-box');
    if (taxaBox) {
      const elVal = document.getElementById('ml-taxaconv-val');
      const elMsg = document.getElementById('ml-taxaconv-msg');
      if (views === 0) {
        if (elVal) elVal.textContent = '—';
        if (elMsg) elMsg.textContent = 'Quando as pessoas começarem a ver sua loja, mostramos aqui quantas chamam você.';
      } else {
        const taxa = (totalContato / views) * 100;
        // 1 casa decimal só quando < 10%, senão inteiro (fica mais limpo)
        const taxaTxt = taxa < 10 ? taxa.toFixed(1) : Math.round(taxa).toString();
        if (elVal) elVal.textContent = taxaTxt + '%';
        if (elMsg) {
          elMsg.textContent =
            `De cada 100 pessoas que veem sua loja, cerca de ${Math.round(taxa)} entram em contato ` +
            `(${totalContato} de ${views} visualizações).`;
        }
      }
      taxaBox.style.display = '';
    }

    // ── Crescimento semanal (d7 vs d7ant) ──
    if (crescBox) {
      const d7    = m.d7    ?? 0;
      const d7ant = m.d7ant ?? 0;
      const elAtual = document.getElementById('ml-cresc-atual');
      const elBadge = document.getElementById('ml-cresc-badge');
      const elMsg   = document.getElementById('ml-cresc-msg');
      if (elAtual) elAtual.textContent = d7;

      let pct = null;
      if (d7ant > 0) pct = Math.round(((d7 - d7ant) / d7ant) * 100);

      if (elBadge && elMsg) {
        if (d7ant === 0 && d7 === 0) {
          elBadge.textContent = '—';
          elBadge.style.background = 'var(--surface2)';
          elBadge.style.color = 'var(--muted)';
          elMsg.textContent = 'Ainda sem dados suficientes pra comparar com a semana passada.';
        } else if (pct === null) {
          // Semana anterior teve 0, esta teve algo: novo movimento
          elBadge.textContent = '↑ novo';
          elBadge.style.background = 'rgba(37,211,102,0.15)';
          elBadge.style.color = '#25d366';
          elMsg.textContent = `Você teve ${d7} clique(s) esta semana. Semana passada não houve nenhum.`;
        } else if (pct >= 0) {
          elBadge.textContent = `↑ ${pct}%`;
          elBadge.style.background = 'rgba(37,211,102,0.15)';
          elBadge.style.color = '#25d366';
          elMsg.textContent = `${pct === 0 ? 'Estável' : 'Subiu'} em relação à semana passada (${d7ant} → ${d7}).`;
        } else {
          elBadge.textContent = `↓ ${Math.abs(pct)}%`;
          elBadge.style.background = 'rgba(239,68,68,0.13)';
          elBadge.style.color = 'var(--red)';
          elMsg.textContent = `Caiu em relação à semana passada (${d7ant} → ${d7}). Que tal publicar um anúncio?`;
        }
      }
      crescBox.style.display = '';
    }

    // ── Conversão por canal ──
    if (convBox) {
      const legenda = document.getElementById('ml-conv-legenda');
      const bWpp = document.getElementById('ml-conv-wpp');
      const bTel = document.getElementById('ml-conv-tel');
      const bIg  = document.getElementById('ml-conv-ig');
      if (totalContato === 0) {
        if (bWpp) bWpp.style.width = '0%';
        if (bTel) bTel.style.width = '0%';
        if (bIg)  bIg.style.width  = '0%';
        if (legenda) legenda.textContent = 'Sem contatos registrados ainda.';
      } else {
        const pW = Math.round((wpp / totalContato) * 100);
        const pT = Math.round((tel / totalContato) * 100);
        const pI = Math.max(0, 100 - pW - pT);
        if (bWpp) bWpp.style.width = pW + '%';
        if (bTel) bTel.style.width = pT + '%';
        if (bIg)  bIg.style.width  = pI + '%';
        const partes = [];
        if (wpp) partes.push(`${pW}% WhatsApp`);
        if (tel) partes.push(`${pT}% telefone`);
        if (ig)  partes.push(`${pI}% Instagram`);
        if (legenda) legenda.textContent = partes.join(' · ');
      }
      convBox.style.display = '';
    }
  }

  // ── Dicas da Coruja (painel do lojista) ──────────────────
  const ML_DICAS = [
    'Mantenha seu status sempre atualizado — lojas abertas aparecem primeiro na busca.',
    'Adicione uma foto de capa caprichada: lojas com foto recebem muito mais cliques.',
    'Responda no WhatsApp o mais rápido possível — agilidade fecha mais vendas.',
    'Peça aos clientes satisfeitos para avaliarem sua loja. Estrelas atraem novos clientes.',
    'Confira o endereço e o horário de funcionamento: dados certos evitam clientes perdidos.',
    'Use o botão "Já voltamos" quando sair rapidinho — assim ninguém pensa que fechou de vez.',
    'Compartilhe o link da sua loja nas suas redes sociais para alcançar mais gente.',
    'No plano Pro você adiciona logo, cardápio e vê métricas detalhadas dos seus cliques.',
  ];
  let _mlDicaIdx = -1;

  function mlSortearDica() {
    _mlDicaIdx = Math.floor(Math.random() * ML_DICAS.length);
    mlAplicarDica();
  }
  function mlProximaDica() {
    _mlDicaIdx = (_mlDicaIdx + 1) % ML_DICAS.length;
    mlAplicarDica();
  }
  function mlAplicarDica() {
    const el = document.getElementById('ml-dica-texto');
    if (el) el.textContent = ML_DICAS[_mlDicaIdx] || ML_DICAS[0];
  }
  window.mlProximaDica = mlProximaDica;

  // ══════════════════════════════════════════════════════════
  //  ONBOARDING — tela de boas-vindas no 1º acesso ao painel
  //  Aparece uma única vez por loja. A chave usa o WhatsApp NORMALIZADO
  //  (DDI 55) para que login e aprovação gerem a mesma flag — sem isso,
  //  conta nova (fluxo de aprovação) não casava com a flag e reaparecia
  //  ou (no caso atual) o número vazio fazia a flag virar 'angatuba_onboarded_'.
  //  Coruja owl-wave. Overlay criado via JS (sem tocar no index.html).
  // ══════════════════════════════════════════════════════════
  function _wppFlagOnb() {
    let n = String(_lojaWpp || localStorage.getItem('angatuba_loja_wpp') || '').replace(/\D/g, '');
    if (n && !n.startsWith('55')) n = '55' + n;
    return n;
  }
  function mostrarOnboarding(_tentativa) {
    const wppN = _wppFlagOnb();
    // Sem WhatsApp resolvido ainda (token via cache, dados a caminho): tenta de novo
    // até 3x com intervalo curto, em vez de gravar uma flag genérica vazia.
    if (!wppN) {
      const t = (_tentativa || 0) + 1;
      if (t <= 3) { setTimeout(() => mostrarOnboarding(t), 500); }
      return;
    }
    const flag = 'angatuba_onboarded_' + wppN;
    try { if (localStorage.getItem(flag) === '1') return; } catch(e) { return; }
    if (document.getElementById('onboarding-overlay')) return;

    const nome = (_lojaNome || localStorage.getItem('angatuba_loja_nome') || '').trim();
    const primeiroNome = nome ? nome.split(' ')[0] : '';
    const saud = primeiroNome ? ('Bem-vindo, ' + escHTML(primeiroNome) + '!') : 'Bem-vindo!';

    const ov = document.createElement('div');
    ov.id = 'onboarding-overlay';
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    ov.innerHTML =
      '<div class="onb-card">' +
        '<button type="button" class="onb-close" aria-label="Fechar" onclick="fecharOnboarding()">&times;</button>' +
        '<img class="onb-owl" src="/webp/owl-wave.webp" alt="" onerror="if(!this.dataset.f){this.dataset.f=1;this.style.display=\'none\';}" />' +
        '<div class="onb-title">' + saud + ' <span>\uD83C\uDF89</span></div>' +
        '<div class="onb-sub">Sua loja está no ar! Veja o que você pode fazer por aqui:</div>' +
        '<div class="onb-steps">' +
          '<div class="onb-step"><div class="onb-ico"><i class="ti ti-pencil"></i></div>' +
            '<div class="onb-step-txt"><strong>Edite sua loja</strong>Atualize horários, endereço, fotos e contatos quando quiser.</div></div>' +
          '<div class="onb-step"><div class="onb-ico"><i class="ti ti-tools-kitchen-2"></i></div>' +
            '<div class="onb-step-txt"><strong>Monte seu cardápio</strong>Adicione seus produtos e preços para os clientes verem.</div></div>' +
          '<div class="onb-step"><div class="onb-ico"><i class="ti ti-chart-bar"></i></div>' +
            '<div class="onb-step-txt"><strong>Acompanhe os acessos</strong>Veja quantas pessoas viram sua loja e clicaram no WhatsApp.</div></div>' +
        '</div>' +
        '<button type="button" class="onb-cta" onclick="fecharOnboarding()">Bora começar \u2192</button>' +
      '</div>';
    document.body.appendChild(ov);
    requestAnimationFrame(() => ov.classList.add('open'));
    try { localStorage.setItem(flag, '1'); } catch(e) {}
  }
  function fecharOnboarding() {
    const ov = document.getElementById('onboarding-overlay');
    if (!ov) return;
    ov.classList.remove('open');
    setTimeout(() => { if (ov.parentNode) ov.parentNode.removeChild(ov); }, 300);
  }
  window.fecharOnboarding = fecharOnboarding;

  /* ══════════════════════════════════════════════════════════════
     ONBOARDING DO CLIENTE — 3 telas na primeira vez que abre o app
     ----------------------------------------------------------
     Diferente do onboarding do lojista (boas-vindas ao painel).
     Este explica ao morador como usar: buscar, filtrar, contatar.
     Aparece só 1x (flag em localStorage) e pode ser pulado.
  ══════════════════════════════════════════════════════════════ */
  const CLIENTE_ONB_KEY = 'angatuba_cliente_onboarded';
  const CLIENTE_ONB_SLIDES = [
    {
      owl: '/webp/owl-search.webp',
      icon: '🔎',
      titulo: 'Ache tudo em Angatuba',
      texto: 'Busque por nome ou tipo — pizza, farmácia, mercado — ou navegue pelas categorias. As lojas da cidade num só lugar.'
    },
    {
      owl: '/webp/owl-point.webp',
      icon: '🎯',
      titulo: 'Filtre do seu jeito',
      texto: 'Veja só o que está <strong>aberto agora</strong>, quem <strong>faz entrega</strong>, ou filtre pelo <strong>seu bairro</strong>. Menos rolagem, mais praticidade.'
    },
    {
      owl: '/webp/owl-love.webp',
      icon: '💬',
      titulo: 'Fale e favorite',
      texto: 'Chame a loja direto no <strong>WhatsApp</strong> com um toque, e salve suas preferidas no <strong>❤️</strong> para achar rapidinho depois.'
    }
  ];
  let _clienteOnbIdx = 0;

  function clienteJaViuOnboarding() {
    try { return localStorage.getItem(CLIENTE_ONB_KEY) === '1'; } catch (e) { return true; }
  }
  function marcarClienteOnboarding() {
    try { localStorage.setItem(CLIENTE_ONB_KEY, '1'); } catch (e) {}
  }

  function mostrarOnboardingCliente() {
    if (clienteJaViuOnboarding()) return;
    if (document.getElementById('cliente-onb-overlay')) return;
    _clienteOnbIdx = 0;

    const ov = document.createElement('div');
    ov.id = 'cliente-onb-overlay';
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    ov.setAttribute('aria-label', 'Bem-vindo ao AngatubaON');
    ov.innerHTML =
      '<div class="conb-card">' +
        '<button type="button" class="conb-skip" onclick="pularOnboardingCliente()">Pular</button>' +
        '<div class="conb-owl-wrap"><img class="conb-owl" id="conb-owl" src="" alt="" ' +
          'onerror="if(!this.dataset.f){this.dataset.f=1;this.style.display=\'none\';}" /></div>' +
        '<div class="conb-icon" id="conb-icon"></div>' +
        '<div class="conb-title" id="conb-title"></div>' +
        '<div class="conb-text" id="conb-text"></div>' +
        '<div class="conb-dots" id="conb-dots"></div>' +
        '<button type="button" class="conb-cta" id="conb-cta" onclick="avancarOnboardingCliente()">Próximo</button>' +
      '</div>';
    document.body.appendChild(ov);
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(function () { ov.classList.add('open'); });
    renderOnboardingClienteSlide();
    _focusTrapAtivar(ov);
  }

  function renderOnboardingClienteSlide() {
    const s = CLIENTE_ONB_SLIDES[_clienteOnbIdx];
    if (!s) return;
    const owl = document.getElementById('conb-owl');
    const icon = document.getElementById('conb-icon');
    const titulo = document.getElementById('conb-title');
    const texto = document.getElementById('conb-text');
    const dots = document.getElementById('conb-dots');
    const cta = document.getElementById('conb-cta');
    if (owl) { owl.dataset.f = ''; owl.style.display = ''; owl.src = s.owl; }
    if (icon) icon.textContent = s.icon;
    if (titulo) titulo.textContent = s.titulo;
    if (texto) texto.innerHTML = s.texto;
    if (dots) {
      dots.innerHTML = CLIENTE_ONB_SLIDES.map(function (_, i) {
        return '<span class="conb-dot' + (i === _clienteOnbIdx ? ' active' : '') + '"></span>';
      }).join('');
    }
    if (cta) cta.textContent = (_clienteOnbIdx === CLIENTE_ONB_SLIDES.length - 1) ? 'Começar a explorar 🚀' : 'Próximo';
  }

  window.avancarOnboardingCliente = function () {
    if (_clienteOnbIdx < CLIENTE_ONB_SLIDES.length - 1) {
      _clienteOnbIdx++;
      renderOnboardingClienteSlide();
    } else {
      fecharOnboardingCliente();
    }
  };
  window.pularOnboardingCliente = function () { fecharOnboardingCliente(); };

  function fecharOnboardingCliente() {
    marcarClienteOnboarding();
    const ov = document.getElementById('cliente-onb-overlay');
    if (!ov) return;
    ov.classList.remove('open');
    document.body.style.overflow = '';
    _focusTrapDesativar();
    setTimeout(function () {
      if (ov.parentNode) ov.parentNode.removeChild(ov);
      // O onboarding pode ter bloqueado as tentativas automáticas do nudge de
      // avaliação (que checam se este overlay está na tela) — tenta de novo
      // agora que ele já saiu, para não perder o convite nesta sessão.
      if (typeof _tentarNudgeAposCarga === 'function') _tentarNudgeAposCarga();
    }, 300);
  }
  window.mostrarOnboardingCliente = mostrarOnboardingCliente;

  /* ══════════════════════════════════════════════════════════════
     NUDGE DE AVALIAÇÃO — convida o cliente a avaliar depois de usar
     ----------------------------------------------------------
     Quando o cliente chama uma loja no WhatsApp/telefone, guardamos
     a visita. Numa PRÓXIMA abertura (algumas horas depois — não no
     mesmo momento, pra não atrapalhar), aparece um convite gentil
     para avaliar. Respeita: 1 loja por vez, some se já avaliou/pulou,
     e nunca insiste na mesma loja.
  ══════════════════════════════════════════════════════════════ */
  const VISITAS_KEY   = 'angatuba_visitas_avaliar';
  const AVALIADAS_KEY = 'angatuba_lojas_avaliadas';
  // Só sugere avaliar depois deste tempo desde a visita (30 min): dá tempo de a
  // pessoa ter ido/comprado, sem deixar o convite distante demais do contexto.
  const NUDGE_DELAY_MS = 30 * 60 * 1000;
  // Não sugere visitas muito antigas (7 dias) — perderia o contexto.
  const NUDGE_MAX_IDADE_MS = 7 * 24 * 60 * 60 * 1000;
  let _nudgeAutoDismissTimer = null;

  function _lerJSON(key, fallback) {
    try { const v = JSON.parse(localStorage.getItem(key) || 'null'); return v || fallback; }
    catch (e) { return fallback; }
  }
  function _gravarJSON(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }

  // Registra (ou atualiza) a visita a uma loja para futura sugestão de avaliação.
  function registrarVisitaParaAvaliar(nome) {
    const n = favNormNome(nome);
    if (!n) return;
    // Se já avaliou essa loja, não registra
    const avaliadas = _lerJSON(AVALIADAS_KEY, []);
    if (avaliadas.indexOf(n) !== -1) return;
    const visitas = _lerJSON(VISITAS_KEY, {});
    // Guarda nome original (pra exibir bonito) + quando + se já foi dispensada
    const existente = visitas[n] || {};
    visitas[n] = {
      nome: String(nome).trim(),
      ts: Date.now(),
      dispensada: existente.dispensada || false
    };
    _gravarJSON(VISITAS_KEY, visitas);
  }

  // Marca que o cliente já avaliou uma loja (chamado após envio de avaliação).
  window.marcarLojaAvaliada = function (nome) {
    const n = favNormNome(nome);
    if (!n) return;
    const avaliadas = _lerJSON(AVALIADAS_KEY, []);
    if (avaliadas.indexOf(n) === -1) { avaliadas.push(n); _gravarJSON(AVALIADAS_KEY, avaliadas); }
    // Remove das visitas pendentes
    const visitas = _lerJSON(VISITAS_KEY, {});
    if (visitas[n]) { delete visitas[n]; _gravarJSON(VISITAS_KEY, visitas); }
  };

  // Escolhe a melhor visita elegível para sugerir avaliação (mais recente
  // dentro da janela válida, ainda não dispensada nem avaliada).
  function escolherVisitaParaAvaliar() {
    const visitas = _lerJSON(VISITAS_KEY, {});
    const avaliadas = _lerJSON(AVALIADAS_KEY, []);
    const agora = Date.now();
    let melhor = null;
    Object.keys(visitas).forEach(function (n) {
      const v = visitas[n];
      if (!v || v.dispensada) return;
      if (avaliadas.indexOf(n) !== -1) return;
      const idade = agora - (v.ts || 0);
      if (idade < NUDGE_DELAY_MS) return;      // muito recente
      if (idade > NUDGE_MAX_IDADE_MS) return;  // muito antiga
      // A loja mais recente pode ter sido removida/renomeada — não vale a
      // pena escolhê-la e travar aqui; segue procurando a próxima elegível.
      const existe = LOJAS.some(function (l) { return favNormNome(l.nome) === favNormNome(v.nome); });
      if (!existe) return;
      if (!melhor || v.ts > melhor.ts) melhor = v;
    });
    return melhor;
  }

  function mostrarNudgeAvaliacao() {
    // Não sobrepõe outros overlays (onboarding, modais)
    if (document.getElementById('cliente-onb-overlay')) return;
    if (document.getElementById('nudge-aval')) return;
    const v = escolherVisitaParaAvaliar();
    if (!v) return; // já garante que a loja existe (checado dentro da função acima)

    const el = document.createElement('div');
    el.id = 'nudge-aval';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'Convite para avaliar loja');
    el.innerHTML =
      '<div class="nudge-aval-card">' +
        '<img class="nudge-aval-owl" src="/webp/owl-tip.webp" alt="" ' +
          'onerror="if(!this.dataset.f){this.dataset.f=1;this.style.display=\'none\';}" />' +
        '<div class="nudge-aval-body">' +
          '<div class="nudge-aval-title">Como foi na ' + escHTML(v.nome) + '?</div>' +
          '<div class="nudge-aval-sub">Sua avaliação ajuda outros moradores de Angatuba. 🌟</div>' +
        '</div>' +
        '<button type="button" class="nudge-aval-close" aria-label="Agora não" ' +
          'onclick="dispensarNudgeAvaliacao()">&times;</button>' +
        '<div class="nudge-aval-actions">' +
          '<button type="button" class="nudge-aval-btn-later" onclick="dispensarNudgeAvaliacao()">Agora não</button>' +
          '<button type="button" class="nudge-aval-btn-go" data-nome="' + escAttr(v.nome) + '" ' +
            'onclick="abrirAvaliacaoDoNudge(this.dataset.nome)">⭐ Avaliar</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(el);
    requestAnimationFrame(function () { el.classList.add('open'); });
    // Some sozinho depois de um tempo — não deve ficar flutuando por cima
    // de outros modais indefinidamente se o usuário simplesmente ignorar.
    // Não marca como "dispensada": pode ser sugerido de novo em outra sessão.
    _nudgeAutoDismissTimer = setTimeout(function () { _fecharNudgeAval(); }, 12000);
  }

  // "Agora não": não insiste nessa loja de novo (marca dispensada).
  window.dispensarNudgeAvaliacao = function () {
    const el = document.getElementById('nudge-aval');
    const nome = el ? el.querySelector('.nudge-aval-btn-go')?.dataset.nome : '';
    if (nome) {
      const n = favNormNome(nome);
      const visitas = _lerJSON(VISITAS_KEY, {});
      if (visitas[n]) { visitas[n].dispensada = true; _gravarJSON(VISITAS_KEY, visitas); }
    }
    _fecharNudgeAval();
  };

  // "Avaliar": abre o modal da loja já na seção de avaliação.
  window.abrirAvaliacaoDoNudge = function (nome) {
    _fecharNudgeAval();
    const idx = LOJAS.findIndex(function (l) { return favNormNome(l.nome) === favNormNome(nome); });
    if (idx === -1) return;
    abrirDetalhes(idx);
    // Após o modal montar, rola até o formulário de avaliação e destaca
    setTimeout(function () {
      const form = document.getElementById('aval-form-' + idx);
      if (form) {
        form.scrollIntoView({ behavior: 'smooth', block: 'center' });
        form.classList.add('aval-form-highlight');
        setTimeout(function () { form.classList.remove('aval-form-highlight'); }, 1800);
      }
    }, 350);
  };

  function _fecharNudgeAval() {
    if (_nudgeAutoDismissTimer) { clearTimeout(_nudgeAutoDismissTimer); _nudgeAutoDismissTimer = null; }
    const el = document.getElementById('nudge-aval');
    if (!el) return;
    el.classList.remove('open');
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 300);
  }
  window.mostrarNudgeAvaliacao = mostrarNudgeAvaliacao;

  // Dispara o nudge no máximo 1x por sessão, e só quando já há lojas carregadas
  // e nenhum overlay competindo. Chamado após cada render de lojas.
  let _nudgeJaTentado = false;
  function _tentarNudgeAposCarga() {
    if (_nudgeJaTentado) return;
    if (location.hash) return;                                   // deep-link para uma loja
    if (!Array.isArray(LOJAS) || LOJAS.length === 0) return;     // lista ainda não carregou
    if (document.getElementById('cliente-onb-overlay')) return;  // onboarding na tela
    _nudgeJaTentado = true;
    mostrarNudgeAvaliacao();
  }
  window._tentarNudgeAposCarga = _tentarNudgeAposCarga;

  // ── Helper de teste (console): força uma visita "antiga" e mostra o nudge ──
  // Uso no DevTools: _testarNudge('Nome da Loja')  — ou sem argumento usa a 1ª loja.
  window._testarNudge = function (nome) {
    const alvo = nome || (LOJAS[0] && LOJAS[0].nome);
    if (!alvo) { console.warn('[nudge] nenhuma loja disponível'); return; }
    const n = favNormNome(alvo);
    const visitas = _lerJSON(VISITAS_KEY, {});
    // Simula visita de 1h atrás (passa do delay), não avaliada nem dispensada
    visitas[n] = { nome: String(alvo).trim(), ts: Date.now() - (60 * 60 * 1000), dispensada: false };
    _gravarJSON(VISITAS_KEY, visitas);
    // Remove de avaliadas, se estiver
    const av = _lerJSON(AVALIADAS_KEY, []);
    const i = av.indexOf(n); if (i !== -1) { av.splice(i, 1); _gravarJSON(AVALIADAS_KEY, av); }
    const fila = document.getElementById('nudge-aval'); if (fila) fila.remove();
    _nudgeJaTentado = false;
    mostrarNudgeAvaliacao();
    console.log('[nudge] tentativa forçada para:', alvo);
  };

  async function abrirMinhaLoja() {
    if (!_lojaToken) { openLoginLoja(); return; }

    // ── Limpa cache de anúncio se for uma loja diferente da anterior ──
    const wppSalvo = localStorage.getItem('angatuba_loja_wpp') || '';
    if (_lojaWpp && wppSalvo && wppSalvo !== _lojaWpp) {
      localStorage.removeItem('angatuba_anuncio');
    }

    const overlay = document.getElementById('modal-minha-loja');
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    if (typeof mlAvisoOffline === 'function') mlAvisoOffline(false); // Item 3: reseta aviso ao (re)abrir
    mlSortearDica();
    // Onboarding de boas-vindas: só na 1ª vez que esta loja abre o painel.
    // Espera o painel pintar antes de sobrepor (evita corrida com a transição de aprovação).
    setTimeout(() => mostrarOnboarding(), 900);
    // Fix #6: entrada no histórico para o botão "voltar" (Android) fechar o painel
    if (history.state?.modal !== 'minha-loja') history.pushState({ modal: 'minha-loja' }, '');

    // ── Abre instantaneamente com cache do localStorage ───────
    const dadosCache = (() => {
      try { return JSON.parse(localStorage.getItem('angatuba_loja_dados') || 'null'); } catch(e) { return null; }
    })();

    if (dadosCache) {
      // Painel visível imediatamente com dados do cache
      _aplicarDadosLoja(dadosCache, null);
      // Restaura anúncio do cache local
      try {
        const anuncioCache = localStorage.getItem('angatuba_anuncio');
        if (anuncioCache) {
          const obj = JSON.parse(anuncioCache);
          if (obj.expira && new Date(obj.expira) > new Date()) {
            const anuncioSection = document.getElementById('ml-anuncio-section');
            if (anuncioSection) anuncioSection.style.display = '';
            mlExibirAnuncioAtivo(obj);
          } else {
            localStorage.removeItem('angatuba_anuncio');
          }
        }
      } catch(e) {}
    } else {
      // Sem cache: placeholders mínimos
      document.getElementById('ml-nome').textContent = _lojaNome || '...';
      document.getElementById('ml-ramo').textContent = '—';
      document.getElementById('ml-m-7d').textContent  = '—';
      document.getElementById('ml-m-30d').textContent = '—';
      document.getElementById('ml-m-total').textContent = '—';
      document.getElementById('ml-m-wpp').textContent = '—';
      document.getElementById('ml-m-tel').textContent = '—';
    }

    // ── Busca dados frescos em background ─────────────────────
    // Fix: bind único por botão (dataset.flagBound) — antes acumulava um listener a cada
    // abertura do painel quando o usuário não clicava em nenhum toggle.
    window._mlPainelInteragido = false;
    ['ml-toggle-aberto','ml-toggle-voltamos','ml-toggle-fechado','ml-entrega-toggle'].forEach(id => {
      const elT = document.getElementById(id);
      if (elT && !elT.dataset.flagBound) {
        elT.dataset.flagBound = '1';
        elT.addEventListener('click', () => { window._mlPainelInteragido = true; });
      }
    });
    try {
      // Token via POST — nunca em query string (logs de servidor, histórico do browser)
      const mkParams = action => {
        const p = new URLSearchParams();
        p.append('payload', JSON.stringify({ action, token: _lojaToken }));
        return p;
      };
      const [dadosResp, metResp] = await Promise.all([
        fetch(APPS_SCRIPT_URL, { method: 'POST', body: mkParams('lojaDados'),    signal: AbortSignal.timeout(10000) }),
        fetch(APPS_SCRIPT_URL, { method: 'POST', body: mkParams('lojaMetricas'), signal: AbortSignal.timeout(10000) }),
      ]);

      const dadosJson = await dadosResp.json();
      const metJson   = await metResp.json();

      // Sessão expirada
      if (dadosJson.msg === 'UNAUTHORIZED') {
        lojaLogout(true); return;
      }

      if (dadosJson.status === 'ok') {
        // Salva cache para próxima abertura ser instantânea
        try { localStorage.setItem('angatuba_loja_dados', JSON.stringify(dadosJson.data)); } catch(e) {}

        _aplicarDadosLoja(dadosJson.data, metJson, window._mlPainelInteragido);
        mlAvisoOffline(false); // Item 3: rede ok — garante que o aviso não fica preso

        // ── Cardápio ─────────────────────────────────────
        await mlCardapioCarregar(dadosJson.data.plano || 'GRATIS');
      }
    } catch(e) {
      console.warn('[MinhaLoja] Erro ao carregar dados:', e.message);
      // Item 3: a atualização de rede falhou. Antes ficava só no console e o painel
      // exibia cache (ou placeholders '—') sem avisar — dava impressão de "zerou".
      // Mostra um aviso discreto, diferenciando ter dados salvos de não ter.
      mlAvisoOffline(true, dadosCache
        ? 'Sem conexão — mostrando os últimos dados salvos.'
        : 'Sem conexão — não foi possível carregar seus dados agora.');
    }
  }

  // Item 3: controla o banner de aviso offline do painel Minha Loja.
  function mlAvisoOffline(mostrar, txt) {
    const box = document.getElementById('ml-aviso-offline');
    if (!box) return;
    if (mostrar) {
      const t = document.getElementById('ml-aviso-offline-txt');
      if (t && txt) t.textContent = txt;
      box.style.display = 'flex';
    } else {
      box.style.display = 'none';
    }
  }

  function fecharMinhaLoja(viaPopstate) {
    document.getElementById('modal-minha-loja').classList.remove('open');
    document.body.style.overflow = '';
    if (typeof _mlPararTimerAnuncio === 'function') _mlPararTimerAnuncio(); // Item 17: não deixa o interval rodando com o painel fechado
    // Fix #6: desfaz a entrada do histórico ao fechar manualmente (popstate já consumiu)
    if (!viaPopstate && history.state?.modal === 'minha-loja') history.back();
  }

  document.getElementById('modal-minha-loja').addEventListener('click', function(e) {
    if (e.target === this) fecharMinhaLoja();
  });

  /* ── Toggle de status manual ─────────────────────────────── */
  function marcarToggle(status) {
    const BORDERS = {
      'ABERTO':   '2px solid rgba(0,208,132,0.3)',
      'VOLTAMOS': '2px solid rgba(245,158,11,0.3)',
      'FECHADO':  '2px solid rgba(255,68,68,0.3)',
    };
    document.querySelectorAll('.toggle-status-btn').forEach(btn => {
      const isActive = btn.dataset.status === status ||
                       (btn.dataset.status === 'ABERTO'   && (status || '').startsWith('ABERTO_ATE_')) ||
                       (btn.dataset.status === 'VOLTAMOS' && (status || '').startsWith('VOLTAMOS_ATE_')) ||
                       (btn.dataset.status === 'FECHADO'  && (status || '').startsWith('FECHADO_HOJE_'));
      btn.style.opacity    = isActive ? '1' : '0.45';
      btn.style.fontWeight = isActive ? '800' : '600';
      btn.style.boxShadow  = isActive ? '0 0 0 2px currentColor inset' : '';
      btn.style.border     = isActive ? '2px solid currentColor' : (BORDERS[btn.dataset.status] || '');
      // Fix #4: marca a classe .ativo para que o rollback de lojaToggle saiba o status anterior
      btn.classList.toggle('ativo', isActive);
    });
  }

  // Botão "Aberto" e "Já voltamos" — mostra painel de opções antes de confirmar
  function lojaToggleComHorario(status) {
    // Item 6: escolher ABERTO/VOLTAMOS cancela uma confirmação de "Fechado" pendente.
    if (typeof _mlResetFechadoConfirm === 'function') _mlResetFechadoConfirm();
    const wrapAberto   = document.getElementById('ml-aberto-ate-wrap');
    const wrapVoltamos = document.getElementById('ml-voltamos-ate-wrap');
    // Feedback visual imediato — marca o botão clicado mesmo antes de confirmar
    marcarToggle(status);
    if (status === 'ABERTO') {
      if (wrapVoltamos) wrapVoltamos.style.display = 'none';
      if (!wrapAberto) { lojaToggle(status); return; }
      wrapAberto.style.display = '';
      const agora = new Date();
      agora.setHours(agora.getHours() + 1, 0);
      const hh = String(agora.getHours()).padStart(2,'0');
      document.getElementById('ml-aberto-ate-time').value = `${hh}:00`;
      document.getElementById('ml-aberto-ate-time').focus();
    } else if (status === 'VOLTAMOS') {
      if (wrapAberto) wrapAberto.style.display = 'none';
      if (!wrapVoltamos) { lojaToggle(status); return; }
      wrapVoltamos.style.display = '';
    }
  }

  // Confirma "Já voltamos" com prazo em minutos (0 = sem previsão)
  async function lojaToggleVoltamos(minutos) {
    document.getElementById('ml-voltamos-ate-wrap').style.display = 'none';
    if (!minutos) { await lojaToggle('VOLTAMOS'); return; }
    const ate = new Date(Date.now() + minutos * 60000);
    const yyyy = ate.getFullYear();
    const mm   = String(ate.getMonth() + 1).padStart(2, '0');
    const dd   = String(ate.getDate()).padStart(2, '0');
    const hh   = String(ate.getHours()).padStart(2, '0');
    const min  = String(ate.getMinutes()).padStart(2, '0');
    await lojaToggle(`VOLTAMOS_ATE_${yyyy}-${mm}-${dd}_${hh}${min}`);
  }

  // Confirma "Aberto" com horário personalizado
  async function lojaToggleAberto() {
    const time = document.getElementById('ml-aberto-ate-time')?.value;
    // Inclui data LOCAL para saber quando expirou (formato ABERTO_ATE_YYYY-MM-DD_HHMM)
    // IMPORTANTE: usa getFullYear/Month/Date (local) em vez de toISOString() que retorna UTC
    // Entre 21:00-23:59 BRT, o UTC já é amanhã — causaria status "aberto por 23h"
    const _agora = new Date();
    // Fix #5: "aberto até" com horário menor/igual ao horário atual (ex: 00:00 = meia-noite)
    // significa amanhã. Sem isto, ABERTO_ATE_<hoje>_0000 vira "início de hoje", já no passado.
    const _alvo = new Date(_agora);
    if (time) {
      const [_h, _m] = time.split(':').map(Number);
      _alvo.setHours(_h, _m, 0, 0);
      if (_alvo <= _agora) _alvo.setDate(_alvo.getDate() + 1); // rola para o dia seguinte
    }
    const hoje = `${_alvo.getFullYear()}-${String(_alvo.getMonth()+1).padStart(2,'0')}-${String(_alvo.getDate()).padStart(2,'0')}`;
    const status = time ? `ABERTO_ATE_${hoje}_${time.replace(':','')}` : 'ABERTO';
    document.getElementById('ml-aberto-ate-wrap').style.display = 'none';
    await lojaToggle(status);
  }

  window.lojaToggleComHorario = lojaToggleComHorario;
  window.lojaToggleAberto     = lojaToggleAberto;
  window.lojaToggleVoltamos   = lojaToggleVoltamos;

  // Botão "Fechado": fecha apenas até o fim do dia. Grava FECHADO_HOJE_<hoje>
  // (data LOCAL/BRT) para que o status volte ao automático na virada do dia.
  // Item 6: fechar a loja some da descoberta pública — é destrutivo e acontecia
  // com um único toque. Exige confirmação de dois toques (sem confirm() nativo,
  // pra não quebrar o tema dark).
  let _mlFechadoConfirmar = false;
  let _mlFechadoTimer = null;
  async function lojaToggleFechado() {
    if (!_mlFechadoConfirmar) {
      _mlFechadoConfirmar = true;
      _mlToggleFeedback('aviso', '⚠️ Isso fecha sua loja para os clientes hoje. Toque de novo em "Fechado" para confirmar.');
      const btn = document.querySelector('.toggle-status-btn[data-status="FECHADO"]');
      if (btn) btn.textContent = 'Confirmar?';
      // Reseta a intenção se o lojista não confirmar em 5s
      if (_mlFechadoTimer) clearTimeout(_mlFechadoTimer);
      _mlFechadoTimer = setTimeout(() => { _mlResetFechadoConfirm(); }, 5000);
      return;
    }
    _mlResetFechadoConfirm();
    const d = new Date();
    const hoje = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    await lojaToggle(`FECHADO_HOJE_${hoje}`);
  }
  function _mlResetFechadoConfirm() {
    _mlFechadoConfirmar = false;
    if (_mlFechadoTimer) { clearTimeout(_mlFechadoTimer); _mlFechadoTimer = null; }
    const btn = document.querySelector('.toggle-status-btn[data-status="FECHADO"]');
    if (btn) btn.textContent = 'Fechado';
  }
  window.lojaToggleFechado = lojaToggleFechado;

  // Item 6: feedback unificado e à prova de corrida para o toggle de status.
  // Antes sucesso e erro escreviam no mesmo #ml-toggle-erro trocando a cor na mão,
  // e uma troca rápida de status fazia um setTimeout apagar a mensagem da outra.
  // Aqui cancelamos qualquer timer pendente antes de exibir a nova mensagem.
  let _mlToggleMsgTimer = null;
  function _mlToggleFeedback(tipo, texto) {
    const box = document.getElementById('ml-toggle-erro');
    if (!box) return;
    if (_mlToggleMsgTimer) { clearTimeout(_mlToggleMsgTimer); _mlToggleMsgTimer = null; }
    const cor = tipo === 'ok' ? 'var(--green)' : (tipo === 'aviso' ? 'var(--zap)' : 'var(--red)');
    box.style.color = cor;
    box.textContent = texto;
    // Avisos de confirmação não somem sozinhos (o fluxo do botão os limpa);
    // sucesso/erro auto-limpam.
    if (tipo === 'ok' || tipo === 'erro') {
      const ms = tipo === 'ok' ? 2500 : 4000;
      _mlToggleMsgTimer = setTimeout(() => { if (box) { box.textContent = ''; box.style.color = 'var(--red)'; } _mlToggleMsgTimer = null; }, ms);
    }
  }

  async function lojaToggle(novoStatus) {
    if (!_lojaToken) return;
    // Fix #4: captura o status anterior ANTES do feedback otimista (para rollback em falha)
    const statusAnterior = document.querySelector('.toggle-status-btn.ativo')?.dataset?.status || '';
    let statusCacheAnterior = null;
    try {
      const c = JSON.parse(localStorage.getItem('angatuba_loja_dados') || 'null');
      if (c) statusCacheAnterior = c.statusLoja ?? '';
    } catch(e) {}

    marcarToggle(novoStatus); // feedback imediato
    // Esconde os painéis de opções se estiverem visíveis
    const wrap = document.getElementById('ml-aberto-ate-wrap');
    if (wrap) wrap.style.display = 'none';
    const wrapV = document.getElementById('ml-voltamos-ate-wrap');
    if (wrapV) wrapV.style.display = 'none';

    // Atualiza cache do localStorage para que próxima abertura mostre status correto
    try {
      const cache = JSON.parse(localStorage.getItem('angatuba_loja_dados') || 'null');
      if (cache) { cache.statusLoja = novoStatus; localStorage.setItem('angatuba_loja_dados', JSON.stringify(cache)); }
    } catch(e) {}
    try {
      // Token via POST — nunca em query string (logs de servidor, histórico do browser)
      const json = await apiPost('lojaToggle', { token: _lojaToken, statusLoja: novoStatus }, { timeout: 10000 });
      // backend pode devolver erro de negócio (linha mudou, data inválida) com status != ok.
      if (json.status !== 'ok') throw new Error(json.msg || 'Falha ao salvar status');
      // Item 6: feedback de sucesso via helper à prova de corrida.
      _mlToggleFeedback('ok', '✅ Status salvo');
    } catch(e) {
      if (e.message === 'UNAUTHORIZED') return; // apiPost já fez logout
      console.warn('[lojaToggle] Erro:', e.message);
      // Fix #4: reverte visual E cache do localStorage (estava sobrescrevendo otimista)
      if (statusAnterior) marcarToggle(statusAnterior);
      if (statusCacheAnterior !== null) {
        try {
          const cache = JSON.parse(localStorage.getItem('angatuba_loja_dados') || 'null');
          if (cache) { cache.statusLoja = statusCacheAnterior; localStorage.setItem('angatuba_loja_dados', JSON.stringify(cache)); }
        } catch(e2) {}
      }
      _mlToggleFeedback('erro', '❌ Sem conexão. Status não foi salvo.');
    }
  }

  /* ── Salvar Instagram (painel Minha Loja) ────────────────── */
  async function mlSalvarInstagram() {
    if (!_lojaToken) return;
    const input  = document.getElementById('ml-ig-input');
    const status = document.getElementById('ml-ig-status');
    const btn    = document.getElementById('ml-ig-save-btn');
    if (!input) return;

    const valor = normalizarInstagramHandle(input.value);

    // Item 7: valida o formato antes de salvar. Sem isto, um valor com espaços,
    // acentos ou caracteres inválidos era aceito e o link "Ver perfil atual"
    // apontava para instagram.com/<lixo> — o lojista achava que salvou certo.
    if (!_igHandleValido(valor)) {
      if (status) {
        status.textContent = '⚠️ Usuário do Instagram inválido. Use só letras, números, ponto e "_" (ex.: minha.loja).';
        status.style.color = 'var(--zap)';
      }
      input.focus();
      return;
    }

    if (btn) { btn.disabled = true; btn.textContent = 'Salvando...'; }
    if (status) { status.textContent = ''; status.style.color = ''; }

    try {
      const json = await apiPost('lojaAtualizarInstagram', { token: _lojaToken, instagram: valor }, { timeout: 10000, ignoreUnauthorized: true });

      if (json.status === 'erro' || json.msg === 'UNAUTHORIZED') {
        if (status) { status.textContent = '❌ Erro ao salvar. Tente novamente.'; status.style.color = 'var(--red)'; }
        return;
      }

      if (status) { status.textContent = '✅ Instagram atualizado!'; status.style.color = 'var(--green)'; }
      input.value = valor ? '@' + valor : '';

      // Atualiza o link "Ver perfil atual" inline sem re-abrir o painel inteiro
      const igWrap = document.getElementById('ml-instagram-wrap');
      if (igWrap && valor) {
        const linkExistente = igWrap.querySelector('a[href*="instagram.com"]');
        if (linkExistente) {
          linkExistente.href = `https://instagram.com/${valor}`;
          linkExistente.innerHTML = `<i class="fa fa-external-link-alt" style="font-size:9px;"></i> Ver perfil atual: @${valor}`;
        } else {
          const a = document.createElement('a');
          a.href = `https://instagram.com/${valor}`;
          a.target = '_blank'; a.rel = 'noopener';
          a.style.cssText = 'display:flex;align-items:center;gap:6px;margin-top:8px;font-size:11px;color:#e1306c;text-decoration:none;';
          a.innerHTML = `<i class="fa fa-external-link-alt" style="font-size:9px;"></i> Ver perfil atual: @${valor}`;
          igWrap.appendChild(a);
        }
      }

    } catch(e) {
      if (status) { status.textContent = '❌ Erro de conexão.'; status.style.color = 'var(--red)'; }
      console.warn('[mlSalvarInstagram] Erro:', e.message);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Salvar'; }
    }
  }

  /* ── Logout de loja ──────────────────────────────────────── */
  function lojaLogout(silencioso) {
    if (_lojaToken) {
      // Token via POST — nunca em query string
      const params = new URLSearchParams();
      params.append('payload', JSON.stringify({ action: 'lojaLogout', token: _lojaToken }));
      fetch(APPS_SCRIPT_URL, { method: 'POST', body: params }).catch(() => {});
    }
    _lojaToken = null;
    _lojaNome  = '';
    localStorage.removeItem('angatuba_loja_token');
    localStorage.removeItem('angatuba_loja_nome');
    localStorage.removeItem('angatuba_loja_wpp');
    localStorage.removeItem('angatuba_anuncio');
    localStorage.removeItem('angatuba_loja_dados');
    localStorage.removeItem('angatuba_pendente_wpp');
    localStorage.removeItem('angatuba_pendente_plano');
    localStorage.removeItem('angatuba_pendente_ciclo');
    pararPollingAprovacao();
    fecharMinhaLoja();
    atualizarNav();
    if (!silencioso) {
      // Reseta nav para Início
      document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
      document.getElementById('nav-inicio').classList.add('active');
    }
  }

  // Número do admin para CTAs de WhatsApp — definido em ADMIN_WPP_CONTATO no topo do arquivo

  /* ── Inicializa nav ──────────────────────────────────────── */
  atualizarNav();
  // Se tem token de loja na session, valida silenciosamente ao carregar
  if (_lojaToken) {
    const _validParams = new URLSearchParams();
    _validParams.append('payload', JSON.stringify({ action: 'lojaDados', token: _lojaToken }));
    fetch(APPS_SCRIPT_URL, { method: 'POST', body: _validParams, signal: AbortSignal.timeout(8000) })
      .then(r => r.json())
      .then(j => { if (j.msg === 'UNAUTHORIZED') { _lojaToken = null; localStorage.removeItem('angatuba_loja_token'); atualizarNav(); } })
      .catch(() => {});
  }

  /* ── Pill filter events ──────────────────────────────────── */
  document.querySelectorAll('.pill-btn:not(.pill-bairro-btn)').forEach(btn => {
    btn.addEventListener('click', () => {
      // #12: clicar de novo na pill já ativa desliga o filtro (toggle-off),
      // em vez de reaplicar o mesmo filtro sem dar jeito de "limpar" pela pill.
      const isTogglingOff = btn.classList.contains('active') && activePillFilter === btn.dataset.filter;
      document.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
      if (isTogglingOff) {
        activePillFilter = 'all';
      } else {
        btn.classList.add('active');
        activePillFilter = btn.dataset.filter;
      }
      activeBairro     = '';
      document.getElementById('pill-bairro-label').textContent = 'Bairro';
      renderLojas();
    });
  });

  /* ── Chip de bairro ──────────────────────────────────────── */
  (function initBairroFilter() {
    const btn      = document.getElementById('pill-bairro-btn');
    const overlay  = document.getElementById('bairro-sheet-overlay');
    const sheet    = document.getElementById('bairro-sheet');
    const grabber  = document.getElementById('bairro-sheet-grabber');
    const closeBtn = document.getElementById('bairro-sheet-close');
    const search   = document.getElementById('bairro-search');
    const list     = document.getElementById('bairro-list');
    const label    = document.getElementById('pill-bairro-label');
    if (!btn || !overlay) return;

    function abrirSheet() {
      overlay.classList.add('open');
      overlay.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      search.value = '';
      renderBairroChips('');
      btn.classList.add('active');
    }

    function fecharSheet() {
      overlay.classList.remove('open');
      overlay.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      // Se nenhum bairro está ativo, tira o destaque da pill
      if (!activeBairro) btn.classList.remove('active');
    }

    function aplicarBairro(b) {
      activeBairro = b;
      label.textContent = b || 'Bairro';
      document.querySelectorAll('.pill-btn').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      activePillFilter = 'all';
      renderLojas();
      fecharSheet();
    }

    function limparBairro() {
      activeBairro = '';
      label.textContent = 'Bairro';
      btn.classList.remove('active');
      activePillFilter = 'all';
      renderLojas();
      fecharSheet();
    }

    function renderBairroChips(query) {
      const norm = normBairro(query);
      const contagem = contarLojasPorBairro();
      let filtrados = norm
        ? BAIRROS_ANGATUBA.filter(b => normBairro(b).includes(norm))
        : BAIRROS_ANGATUBA;
      // Esconde bairros sem nenhuma loja (a menos que seja o filtro ativo).
      // Limpa a lista de 47 itens mostrando so onde ha comercio.
      filtrados = filtrados.filter(b =>
        contagem[b] > 0 || normBairro(b) === normBairro(activeBairro)
      );

      list.innerHTML = '';

      // Chip "limpar" no topo, ocupando a linha inteira, só se há filtro ativo
      if (activeBairro) {
        const limpar = document.createElement('button');
        limpar.type = 'button';
        limpar.className = 'bairro-chip bairro-chip-clear';
        limpar.innerHTML = '<i class="fa fa-times"></i> Limpar filtro de bairro';
        limpar.addEventListener('click', limparBairro);
        list.appendChild(limpar);
      }

      if (!filtrados.length) {
        const vazio = document.createElement('div');
        vazio.className = 'bairro-chips-empty';
        vazio.textContent = 'Nenhum bairro encontrado';
        list.appendChild(vazio);
        return;
      }

      filtrados.forEach(b => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'bairro-chip' + (normBairro(b) === normBairro(activeBairro) ? ' bairro-chip-active' : '');
        const nome = document.createElement('span');
        nome.className = 'bairro-chip-nome';
        nome.textContent = b;
        chip.appendChild(nome);
        const n = contagem[b] || 0;
        if (n > 0) {
          const badge = document.createElement('span');
          badge.className = 'bairro-chip-count';
          badge.textContent = n;
          chip.appendChild(badge);
        }
        chip.addEventListener('click', () => aplicarBairro(b));
        list.appendChild(chip);
      });
    }

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (overlay.classList.contains('open')) fecharSheet();
      else abrirSheet();
    });

    search.addEventListener('input', () => renderBairroChips(search.value));

    // Fechar: botão, clique no overlay (fora do sheet), Esc
    if (closeBtn) closeBtn.addEventListener('click', fecharSheet);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) fecharSheet(); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay.classList.contains('open')) fecharSheet();
    });

    // Swipe-down no grabber/sheet para fechar
    let startY = 0, curY = 0, dragging = false;
    function onStart(y) { startY = y; curY = y; dragging = true; sheet.style.transition = 'none'; }
    function onMove(y) {
      if (!dragging) return;
      curY = y;
      const dy = Math.max(0, curY - startY);
      sheet.style.transform = 'translateY(' + dy + 'px)';
    }
    function onEnd() {
      if (!dragging) return;
      dragging = false;
      sheet.style.transition = '';
      const dy = curY - startY;
      sheet.style.transform = '';
      if (dy > 90) fecharSheet();
    }
    [grabber, sheet].forEach(el => {
      if (!el) return;
      el.addEventListener('touchstart', (e) => onStart(e.touches[0].clientY), { passive: true });
      el.addEventListener('touchmove',  (e) => {
        // só arrasta se o gesto começou perto do topo (grabber) ou a lista está no topo
        if (el === grabber || list.scrollTop <= 0) onMove(e.touches[0].clientY);
      }, { passive: true });
      el.addEventListener('touchend', onEnd, { passive: true });
    });
  })();

  /* ── Autocomplete de bairro no formulário de cadastro ─────── */
  (function initBairroCadastro() {
    const input    = document.getElementById('f-bairro');
    const dropdown = document.getElementById('bairro-cad-dropdown');
    if (!input || !dropdown) return;

    // Posicionamento agora e 100% CSS (position:absolute ancorado ao
    // .field-group pai). Antes usava position:fixed com coordenadas
    // calculadas, que defasavam quando o teclado abria/fechava no mobile
    // -> dropdown flutuava longe do campo. Ancorar resolve nativamente.
    function renderCadList(query) {
      const norm = normBairro(query);
      const filtrados = norm
        ? BAIRROS_ANGATUBA.filter(b => normBairro(b).includes(norm))
        : BAIRROS_ANGATUBA;

      if (!filtrados.length || !query) { dropdown.style.display = 'none'; return; }

      dropdown.innerHTML = filtrados.map(b =>
        `<div class="addr-item" tabindex="0"><i class="fa fa-map-marker-alt"></i><div><div class="addr-item-main">${b}</div></div></div>`
      ).join('');

      dropdown.querySelectorAll('.addr-item').forEach((el, i) => {
        const b = filtrados[i];
        const select = () => { input.value = b; dropdown.style.display = 'none'; };
        el.addEventListener('click', select);
        el.addEventListener('keydown', e => { if (e.key === 'Enter') select(); });
      });

      dropdown.style.display = 'block';
    }

    input.addEventListener('input', () => renderCadList(input.value));
    input.addEventListener('focus', () => { if (input.value) renderCadList(input.value); });
    document.addEventListener('click', e => {
      if (!input.contains(e.target) && !dropdown.contains(e.target)) dropdown.style.display = 'none';
    });
  })();

  /* ── Auto-refresh inteligente ───────────────────────────── */
  // Só re-renderiza se algum status mudou, evitando repaints desnecessários
  function smartRefresh() {
    const changed = LOJAS.some(l => calcStatus(l) !== (_statusSnapshot.get(l)?.status ?? ''));
    if (changed) {
      renderLojas();
      renderCategorias();
    }
  }

  // Intervalo de 60s — #13: pausa de verdade (clearInterval) com a aba oculta
  // e retoma ao voltar, em vez de rodar em background indefinidamente.
  let _smartRefreshInterval = setInterval(smartRefresh, 60_000);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      clearInterval(_smartRefreshInterval);
    } else {
      smartRefresh(); // refresh imediato ao voltar para a aba
      clearInterval(_smartRefreshInterval);
      _smartRefreshInterval = setInterval(smartRefresh, 60_000);
    }
  }, { passive: true });

  /* ── Limpa will-change após animação ─────────────────────── */
  document.addEventListener('animationend', e => {
    if (e.target.classList.contains('fade-in')) e.target.style.willChange = 'auto';
  }, { passive: true });

  /* ── Instalação do PWA (banner customizado) ──────────────── */
  (function () {
    const ADIAR_KEY = 'angatuba_install_adiado_ate';
    let deferredPrompt = null;

    function appJaInstalado() {
      return window.matchMedia('(display-mode: standalone)').matches
        || window.navigator.standalone === true; // iOS (modo "tela de início")
    }

    function podeMostrarBanner() {
      if (appJaInstalado()) return false;
      try {
        const adiadoAte = localStorage.getItem(ADIAR_KEY);
        if (adiadoAte && Date.now() < Number(adiadoAte)) return false;
      } catch (e) {}
      return true;
    }

    function adiarBanner(dias) {
      try {
        localStorage.setItem(ADIAR_KEY, String(Date.now() + dias * 24 * 60 * 60 * 1000));
      } catch (e) {}
    }

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();          // bloqueia o mini-infobar nativo do Chrome
      deferredPrompt = e;
      if (podeMostrarBanner()) _mostrarBannerInstall();
    });

    // iOS/Safari não dispara beforeinstallprompt — exibe instruções manuais
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    if (isIOS && !appJaInstalado() && podeMostrarBanner()) {
      const banner = document.getElementById('pwa-install-banner');
      const btnInstalar = document.getElementById('pwa-install-btn');
      const btnFechar   = document.getElementById('pwa-install-dismiss');
      if (banner && btnInstalar) {
        banner.style.display = 'flex';
        btnInstalar.textContent = '📱 Como instalar no iPhone';
        btnInstalar.onclick = () => {
          banner.style.display = 'none';
          adiarBanner(7);
          mlAviso('Instalar no iPhone', '1️⃣ Toque no botão Compartilhar ⬆️ (barra inferior do Safari)\n\n2️⃣ Role para baixo e toque em "Adicionar à Tela de Início"\n\n3️⃣ Confirme tocando em "Adicionar"', '/webp/owl-phone.webp');
        };
        if (btnFechar) btnFechar.onclick = () => { banner.style.display = 'none'; adiarBanner(7); };
      }
    }

    function _mostrarBannerInstall() {
      const banner = document.getElementById('pwa-install-banner');
      const btnInstalar = document.getElementById('pwa-install-btn');
      const btnFechar = document.getElementById('pwa-install-dismiss');
      if (!banner || !btnInstalar || !btnFechar) return;

      banner.style.display = 'flex';

      btnInstalar.onclick = async () => {
        banner.style.display = 'none';
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        deferredPrompt = null;
        if (outcome === 'dismissed') adiarBanner(7); // não insiste por 7 dias
      };

      btnFechar.onclick = () => {
        banner.style.display = 'none';
        adiarBanner(7);
      };
    }

    window.addEventListener('appinstalled', () => {
      deferredPrompt = null;
      const banner = document.getElementById('pwa-install-banner');
      if (banner) banner.style.display = 'none';
      try { localStorage.removeItem(ADIAR_KEY); } catch (e) {}
    });
  })();

  /* ── Service Worker ──────────────────────────────────────── */
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/service-worker.js', { scope: '/' })
        .then(reg => {
          // Verifica se há update a cada 60 segundos
          setInterval(() => { if (!document.hidden) reg.update(); }, 60_000);

          // SW esperando para ativar = há versão nova instalada
          const onUpdateFound = () => {
            const novo = reg.installing || reg.waiting;
            if (!novo) return;
            novo.addEventListener('statechange', () => {
              if (novo.state === 'installed' && navigator.serviceWorker.controller) {
                _mostrarBannerUpdate(novo);
              }
            });
          };

          if (reg.waiting) {
            // Já há update esperando (voltou para a aba após update)
            _mostrarBannerUpdate(reg.waiting);
          }
          reg.addEventListener('updatefound', onUpdateFound);
        })
        .catch(err => console.warn('[SW] Falha no registro:', err));

      // Quando o SW ativa (após skipWaiting), recarrega a página.
      // #10: o 1º controlador de uma aba recém-aberta vem do clients.claim() do
      // install inicial — NÃO deve recarregar (evita o "flash"/reload no primeiro
      // acesso). Só recarrega em trocas posteriores (update via SKIP_WAITING).
      let refreshing = false;
      let _tinhaControlador = !!navigator.serviceWorker.controller;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!_tinhaControlador) { _tinhaControlador = true; return; }
        if (!refreshing) { refreshing = true; window.location.reload(); }
      });
    });
  }

  function _mostrarBannerUpdate(swWaiting) {
    const banner = document.getElementById('sw-update-banner');
    const btn    = document.getElementById('sw-update-btn');
    if (!banner || !btn) return;
    banner.style.display = 'flex';
    btn.onclick = () => {
      btn.textContent = 'Atualizando...';
      btn.disabled = true;
      swWaiting.postMessage('SKIP_WAITING');
    };
  }

  /* ── Carrega lojas da API (Apps Script → Google Sheets) ─────── */
  const _retryDelays = [8000, 20000, 45000]; // backoff progressivo: 8s, 20s, 45s
  let   _retryCount  = 0;
  let   _retryTimer  = null; // referência para cancelar retry pendente

  let _carregandoLojas = false;
  async function carregarLojas() {
    if (_carregandoLojas) return; // evita execucoes concorrentes (retry + reconexao)
    _carregandoLojas = true;
    try {
      const resp = await fetch(APPS_SCRIPT_URL, { signal: AbortSignal.timeout(10000) });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const json = await resp.json();
      if (json.status === 'ok' && Array.isArray(json.data) && json.data.length > 0) {
        // Junta lojas da API com as fixas, evitando duplicatas pelo nome
        const nomesApi = new Set(json.data.map(l => (l.nome || '').trim().toLowerCase()));
        const fixasSemDuplicata = LOJAS_FIXAS.filter(l => !nomesApi.has((l.nome || '').trim().toLowerCase()));
        LOJAS = [...json.data, ...fixasSemDuplicata].map(l => ({
          ...l,
          nome:      l.nome      || '',
          tags:      l.tags      || '',
          sub:       l.sub       || '',
          categoria: l.categoria || 'servicos',
          plano:     (l.plano    || 'GRATIS').toUpperCase(),
          emoji:     l.emoji     || '🏪',
        }));
        // Sucesso: cancela qualquer retry pendente e reseta contador
        if (_retryTimer) { clearTimeout(_retryTimer); _retryTimer = null; }
        _retryCount = 0;
        _rebuildIdxMap();
        renderLojas();
        renderCategorias();
        _esconderSplash(); // lojas prontas — desvela o app
        _migrarFavoritosParaId();
        _tentarNudgeAposCarga(); // lojas carregadas: pode sugerir avaliação
        // Deep link: abre a loja (e o cardápio, se o hash pedir /cardapio).
        // Centralizado em _resolverDeepLink — antes havia lógica duplicada aqui.
        _resolverDeepLink();
        if (DEBUG) console.log('[AngatubaON] ' + json.data.length + ' da API + ' + fixasSemDuplicata.length + ' fixas ✅');
        // Salva snapshot para uso offline (primeiro acesso sem internet mostra dados cacheados)
        try {
          localStorage.setItem('angatuba_lojas_cache', JSON.stringify(LOJAS));
          localStorage.setItem('angatuba_lojas_cache_ts', Date.now().toString());
        } catch(e) {}
      } else {
        console.warn('[AngatubaON] API retornou dados vazios — usando fallback');
        _mostrarErroCarregamento(false);
        _esconderSplash(); // sem dados mas não trava o usuário
      }
    } catch(err) {
      console.warn('[AngatubaON] API indisponível, usando lojas fixas:', err.message);
      _mostrarErroCarregamento(_retryCount < _retryDelays.length);
      _esconderSplash(); // erro de rede — desvela de qualquer forma
      // Retry com backoff progressivo (máx 3 tentativas)
      // Cancela timer anterior antes de agendar novo (evita chamadas duplicadas)
      if (_retryCount < _retryDelays.length) {
        const delay = _retryDelays[_retryCount++];
        if (DEBUG) console.log(`[AngatubaON] Retry ${_retryCount}/${_retryDelays.length} em ${delay/1000}s...`);
        if (_retryTimer) clearTimeout(_retryTimer);
        _retryTimer = setTimeout(() => { _retryTimer = null; carregarLojas(); }, delay);
      }
    } finally {
      _carregandoLojas = false; // libera para o proximo retry/reconexao
    }
  }

  function _mostrarErroCarregamento(vaiRetry) {
    // Tenta usar snapshot cacheado do último acesso com internet (válido por 24h)
    try {
      const cached = localStorage.getItem('angatuba_lojas_cache');
      const ts     = parseInt(localStorage.getItem('angatuba_lojas_cache_ts') || '0');
      if (cached && (Date.now() - ts) < 86_400_000) {
        const lojasCache = JSON.parse(cached);
        if (Array.isArray(lojasCache) && lojasCache.length > 0) {
          LOJAS = lojasCache.map(function(l){return Object.assign({},l,{plano:(l.plano||'GRATIS').toUpperCase(),emoji:l.emoji||'🏪'});});
          _rebuildIdxMap();
          renderLojas();
          renderCategorias();
          _migrarFavoritosParaId();
          _tentarNudgeAposCarga(); // lojas do cache carregadas
          return; // não mostra tela de erro
        }
      }
    } catch(e) {}
    if (LOJAS.length > 0) return; // tem fallback fixo, não precisa mostrar erro
    const listEl  = document.getElementById('store-list');
    listEl.innerHTML = '';
    listEl.style.display = 'none';
    const emptyEl = document.getElementById('empty-state');
    emptyEl.style.display = 'block';
    document.getElementById('empty-icon').textContent = '📡';
    document.getElementById('empty-msg').textContent = 'Sem conexão com o servidor.';
    document.getElementById('empty-sub').textContent = vaiRetry
      ? 'Tentando novamente em alguns segundos...'
      : 'Verifique sua conexão e recarregue a página.';
  }

  /* ── Address Autocomplete (Nominatim / OpenStreetMap) ──────── */
  // Gratuito, sem chave de API, limitado a 1 req/s (respeitamos com debounce de 500ms)
  (function initAddressAutocomplete() {
    const inputRua   = document.getElementById('f-endereco-rua');
    const inputNum   = document.getElementById('f-endereco-numero');
    const dropdown   = document.getElementById('addr-suggestions');
    const hiddenEnd  = document.getElementById('f-endereco');   // endereço completo
    const hiddenMaps = document.getElementById('f-maps-url');
    const statusEl   = document.getElementById('maps-status');
    const hintEl     = document.getElementById('maps-hint');

    if (!inputRua) return;

    let debounceTimer = null;
    let currentQuery  = '';
    let ruaSelecionada = ''; // nome curto da rua selecionada (ex: "R. Salvador Rodrigues dos Santos")

    function setStatus(icon, text, color) {
      statusEl.textContent = icon + ' ' + text;
      statusEl.style.color = color || 'var(--muted)';
    }

    function clearMaps() {
      hiddenMaps.value  = '';
      hiddenEnd.value   = '';
      ruaSelecionada    = '';
      statusEl.textContent = '';
      statusEl.style.color = 'var(--muted)';
    }

    // Monta endereço completo e link Maps sempre que rua ou número mudam
    function atualizarEnderecoCompleto() {
      if (!ruaSelecionada) return;
      const num     = inputNum.value.trim();
      const endFull = num ? `${ruaSelecionada}, ${num}` : ruaSelecionada;
      hiddenEnd.value  = endFull;
      // Link do Maps por texto: legível na planilha
      hiddenMaps.value = `https://www.google.com/maps/search/${encodeURIComponent(endFull + ', Angatuba, SP')}`;
    }

    // Extrai o nome curto da rua a partir do display_name do Nominatim
    // Ex: "Rua Salvador Rodrigues dos Santos, Vila Progresso, Angatuba, ..." → "Rua Salvador Rodrigues dos Santos, Vila Progresso"
    function extrairNomeRua(displayName) {
      const parts = displayName.split(', ');
      // Pega até 2 partes (rua + bairro se houver)
      return parts.slice(0, 2).join(', ');
    }

    function buildSuggestionHTML(item) {
      const parts    = item.display_name.split(', ');
      // Mostra só a rua (parte[0]) para não confundir com bairros incorretos do Nominatim
      const ruaPart  = parts[0];
      // Subtítulo: cidade/estado para contexto
      const subPart  = parts.slice(2, 4).join(', ');
      return `
        <div class="addr-item" tabindex="0"
          data-display="${escAttr(item.display_name)}"
          data-rua="${escAttr(ruaPart)}">
          <i class="fa fa-map-marker-alt"></i>
          <div>
            <div class="addr-item-main">${ruaPart}</div>
            ${subPart ? `<div class="addr-item-sub">${subPart}</div>` : ''}
          </div>
        </div>`;
    }

    function showDropdown(items) {
      if (!items.length) {
        dropdown.innerHTML = '<div class="addr-loading">Nenhum endereço encontrado. Tente ser mais específico.</div>';
      } else {
        dropdown.innerHTML = items.map(buildSuggestionHTML).join('');
        dropdown.querySelectorAll('.addr-item').forEach(el => {
          const select = () => {
            ruaSelecionada    = el.dataset.rua;
            inputRua.value    = el.dataset.rua;
            dropdown.style.display = 'none';
            atualizarEnderecoCompleto();
            setStatus('✅', 'Rua confirmada — adicione o número ao lado', 'var(--green)');
            if (hintEl) hintEl.style.display = 'none';
            inputNum.focus();
          };
          el.addEventListener('click',   select);
          el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') select(); });
        });
      }
      dropdown.style.display = 'block';
    }

    async function buscarEnderecos(query) {
      if (query !== currentQuery) return;
      try {
        const url = `https://nominatim.openstreetmap.org/search?` +
          `q=${encodeURIComponent(query + ', Angatuba, SP, Brasil')}` +
          `&format=json&limit=5&countrycodes=br&addressdetails=1` +
          `&accept-language=pt-BR`;

        const resp = await fetch(url, {
          headers: { 'Accept-Language': 'pt-BR', 'User-Agent': 'AngatubaON/1.0' },
          signal: AbortSignal.timeout(8000)
        });
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        const data = await resp.json();

        if (query !== currentQuery) return;

        if (data.length === 0) {
          const url2 = `https://nominatim.openstreetmap.org/search?` +
            `q=${encodeURIComponent(query + ', São Paulo, Brasil')}` +
            `&format=json&limit=5&countrycodes=br` +
            `&accept-language=pt-BR`;
          const resp2 = await fetch(url2, {
            headers: { 'Accept-Language': 'pt-BR', 'User-Agent': 'AngatubaON/1.0' },
            signal: AbortSignal.timeout(8000)
          });
          const data2 = await resp2.json();
          showDropdown(data2);
        } else {
          showDropdown(data);
        }
      } catch (err) {
        dropdown.innerHTML = `<div class="addr-loading">Erro na busca. Verifique sua conexão.</div>`;
        dropdown.style.display = 'block';
        console.warn('[AngatubaON] Nominatim error:', err.message);
      }
    }

    // Digitar na rua → buscar sugestões
    inputRua.addEventListener('input', function() {
      const q = this.value.trim();
      clearMaps();
      clearTimeout(debounceTimer);

      if (q.length < 4) {
        dropdown.style.display = 'none';
        if (hintEl) hintEl.style.display = '';
        return;
      }

      currentQuery = q;
      dropdown.innerHTML = '<div class="addr-loading"><i class="fa fa-spinner fa-spin"></i> Buscando...</div>';
      dropdown.style.display = 'block';
      if (hintEl) hintEl.style.display = 'none';

      debounceTimer = setTimeout(() => buscarEnderecos(q), 500);
    });

    // Digitar número → atualiza endereço completo e link Maps
    inputNum.addEventListener('input', function() {
      atualizarEnderecoCompleto();
    });

    // Fecha dropdown ao clicar fora
    document.addEventListener('click', function(e) {
      if (!inputRua.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.style.display = 'none';
      }
    });

    // Navega entre itens com teclado
    inputRua.addEventListener('keydown', function(e) {
      if (!['ArrowDown','ArrowUp','Escape'].includes(e.key)) return;
      if (e.key === 'Escape') { dropdown.style.display = 'none'; return; }
      const items = [...dropdown.querySelectorAll('.addr-item')];
      if (!items.length) return;
      e.preventDefault();
      const focused = document.activeElement;
      const idx     = items.indexOf(focused);
      if (e.key === 'ArrowDown') (items[idx + 1] || items[0]).focus();
      if (e.key === 'ArrowUp')   (items[idx - 1] || items[items.length - 1]).focus();
    });
  })();

  /* ══════════════════════════════════════════════════════════════
     MODAL DE DETALHES — Planos Pagos (Plus / Pro)
  ══════════════════════════════════════════════════════════════ */

  const DIAS_NOMES_FULL = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];

  // Abre o modal preenchendo dinamicamente o conteúdo.
  // `idx` é o índice da loja no array LOJAS — evita serialização de objetos em onclick inline.
  function abrirDetalhes(idx) {
    const loja = LOJAS[idx];
    if (!loja) return;

    // Fecha o nudge de avaliação se estiver visível — evita ele flutuar
    // por cima do modal que está abrindo (idempotente: _fecharNudgeAval
    // já verifica se o elemento existe antes de agir).
    if (typeof _fecharNudgeAval === 'function') _fecharNudgeAval();

    // Back button Android: empurra estado para que voltar feche o modal.
    // Evita empilhar entrada duplicada se já estamos num estado 'detalhes'
    // (ex.: abrir outra loja a partir de dentro do próprio modal).
    if (history.state?.modal === 'detalhes') {
      history.replaceState({ modal: 'detalhes', idx }, '', '#' + toSlug(loja.nome));
    } else {
      history.pushState({ modal: 'detalhes', idx }, '', '#' + toSlug(loja.nome));
    }

    const overlay = document.getElementById('modal-detalhes');
    const sheet   = document.getElementById('detail-sheet');

    // Perf: feedback imediato — o sheet comeca a animar JA, antes de montar
    // o conteudo pesado. A montagem (innerHTML gigante) e diferida para o
    // proximo frame dentro do rAF abaixo, mascarada pela animacao de entrada.
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    _focusTrapAtivar(sheet);

    requestAnimationFrame(() => {
    const plano  = (loja.plano || 'GRATIS').toUpperCase();
    const isPro  = plano === 'PRO';
    const isPlus = plano === 'PLUS';
    const isPago = isPro || isPlus;
    const { status, fechaStr, agendado } = calcStatusInfo(loja);

    // ── CAPA com logo sobreposto ───────────────────────────────
    const hasFoto = isPago && loja.foto && loja.foto.trim();
    const hasLogo = isPago && loja.logo && loja.logo.trim();

    // Tem foto de anuncio? Logo ganha anel animado + abre o story ao tocar.
    const _mLogoAnuncio = isPro && loja.anuncio && loja.anuncio.imagemUrl;
    const _mLogoId  = loja.id || loja.wpp || loja.nome;
    const _mLogoAss = _mLogoAnuncio ? _assinaturaAnuncio(loja) : '';
    const _mLogoVisto = _mLogoAnuncio && anuncioJaVisto(loja, _mLogoId);
    const logoOverlay = hasLogo
      ? (_mLogoAnuncio
        ? `<div class="detail-logo-ring${_mLogoVisto ? ' ring-visto' : ''}"
             ${_ringAnuncioData(loja, _mLogoId, _mLogoAss)} onclick="abrirFotoAnuncioEl(this)"
             role="button" tabindex="0" title="Ver foto do anuncio"
             onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();abrirFotoAnuncioEl(this);}">
           <div class="detail-logo-inner">
             <img src="${escAttr(loja.logo)}" loading="lazy" decoding="async" style="width:100%;height:100%;object-fit:cover;"
               onerror="this.parentElement.parentElement.style.display='none'" />
           </div>
           <span class="detail-logo-cam"><i class="fa fa-camera"></i></span>
         </div>`
        : `<div style="position:absolute;bottom:12px;right:14px;z-index:3;
            width:52px;height:52px;border-radius:12px;overflow:hidden;
            border:2px solid rgba(255,255,255,0.2);box-shadow:0 4px 14px rgba(0,0,0,0.5);
            background:var(--surface);">
           <img src="${escAttr(loja.logo)}" loading="lazy" decoding="async" style="width:100%;height:100%;object-fit:cover;"
             onerror="this.parentElement.style.display='none'" />
         </div>`)
      : '';

    const coverHTML = hasFoto
      ? `<div class="detail-cover-wrap">
           <img class="detail-cover" loading="lazy" decoding="async" src="${escAttr(loja.foto)}" alt="Foto ${escAttr(loja.nome)}"
             onerror="this.parentElement.innerHTML = placeholderCover('${escAttr(emojiLoja(loja))}', '${escAttr(loja.categoria || '')}');" />
           <div class="detail-top-bar">
             <div class="detail-handle"></div>
             <button class="detail-close" onclick="fecharDetalhes()" aria-label="Fechar">✕</button>
           </div>
           <div class="detail-cover-badge">${badgeHTML(status, fechaStr, agendado)}</div>
           ${logoOverlay}
         </div>`
      : isPago
      ? `<div class="detail-cover-wrap">
           <div class="detail-cover-placeholder" style="background:${CAT_BG[loja.categoria] || 'rgba(255,255,255,0.06)'};">
             ${emojiLoja(loja)}
           </div>
           <div class="detail-top-bar">
             <div class="detail-handle"></div>
             <button class="detail-close" onclick="fecharDetalhes()" aria-label="Fechar">✕</button>
           </div>
           <div class="detail-cover-badge">${badgeHTML(status, fechaStr, agendado)}</div>
           ${logoOverlay}
         </div>`
      : `<div style="
            position:relative;height:80px;border-radius:20px 20px 0 0;overflow:hidden;
            background:linear-gradient(135deg,${CAT_BG[loja.categoria]||'rgba(99,102,241,0.15)'} 0%,#0d0d0d 100%);
            display:flex;align-items:center;justify-content:space-between;padding:0 16px;flex-shrink:0;">
           <div style="font-size:2.5rem;filter:drop-shadow(0 2px 8px rgba(0,0,0,0.5));">${emojiLoja(loja)}</div>
           <div class="detail-handle" style="position:absolute;top:10px;left:50%;transform:translateX(-50%);"></div>
           <button class="detail-close" onclick="fecharDetalhes()" aria-label="Fechar"
             style="position:static;transform:none;background:rgba(0,0,0,0.3);backdrop-filter:blur(4px);border:1px solid rgba(255,255,255,0.1);color:#fff;">✕</button>
         </div>`;

    // ── BADGE DE PLANO — junto com o nome ─────────────────────
    let planBadge = '';
    if (isPro)         planBadge = `<span class="plan-badge badge-pro">⭐ PRO</span>`;
    else if (isPlus)   planBadge = `<span class="plan-badge badge-plus">✦ PLUS</span>`;

    // ── ANÚNCIO DO DIA ────────────────────────────────────────
    const temAnuncioModal = ((isPro || isPlus) && loja.anuncio && loja.anuncio.texto);
    let anuncioHTML = '';
    if (temAnuncioModal) {
      // Com foto, a imagem NAO ocupa o bloco: ela vive no anel do logo (acima).
      // Aqui fica so o texto + uma pista discreta de que da pra ver a foto tocando no logo.
      const _temFotoModal = isPro && loja.anuncio.imagemUrl;
      const fotoHint = _temFotoModal
        ? `<span style="display:inline-flex;align-items:center;gap:4px;flex-shrink:0;
             font-size:10px;font-weight:700;color:var(--zap);opacity:.85;white-space:nowrap;">
             <i class="fa fa-camera"></i> toque no logo
           </span>`
        : '';
      anuncioHTML = `<div style="
            display:flex;align-items:center;gap:10px;
            background:linear-gradient(135deg,rgba(245,158,11,0.1),rgba(245,158,11,0.04));
            border:1px solid rgba(245,158,11,0.3);border-radius:10px;
            padding:10px 12px;margin-bottom:14px;">
           <span style="font-size:1.3rem;flex-shrink:0;">${escHTML(loja.anuncio.emoji || '🎯')}</span>
           <span style="flex:1;min-width:0;font-size:12px;font-weight:600;color:var(--zap);line-height:1.4;">${escHTML(loja.anuncio.texto)}</span>
           ${fotoHint}
         </div>`;
    }

    // ── BOTÃO CARDÁPIO ────────────────────────────────────────
    const temCardapio = loja.cardapio && loja.cardapio.length > 0;

    // Label e emoji dinâmico por categoria
    const _cat = (loja.categoria || '').toLowerCase();
    const _cardapioLabel = (() => {
      const _lblMap = {
        'pizzaria':['🍽️','Ver Cardápio'],'lanches':['🍽️','Ver Cardápio'],'restaurante':['🍽️','Ver Cardápio'],
        'carnes':['🍽️','Ver Cardápio'],'sorveteria':['🍽️','Ver Cardápio'],'padaria':['🍽️','Ver Cardápio'],
        'adega':['🛒','Ver Produtos'],'mercado':['🛒','Ver Produtos'],'farmacia':['🛒','Ver Produtos'],
        'pet':['🛒','Ver Produtos'],'calcados':['🛒','Ver Produtos'],'roupas':['🛒','Ver Produtos'],
        'joalheria':['🛒','Ver Produtos'],'informatica':['🛒','Ver Produtos'],'celular':['🛒','Ver Produtos'],
        'papelaria':['🛒','Ver Produtos'],'variedades':['🛒','Ver Produtos'],'moveis':['🛒','Ver Produtos'],
        'construcao':['🛒','Ver Produtos'],'autopecas':['🛒','Ver Produtos'],'agropecuaria':['🛒','Ver Produtos'],
        'barbearia':['✂️','Ver Serviços'],'salao':['💅','Ver Serviços'],'mecanica':['🔧','Ver Serviços'],
        'tattoo':['🎨','Ver Portfólio'],'fotografia':['📸','Ver Portfólio'],
        'clinica':['🩺','Ver Consultas'],'laboratorio':['🧪','Ver Exames'],
        'academia':['💪','Ver Planos'],'seguros':['📋','Ver Planos'],
        'imobiliaria':['🏠','Ver Imóveis'],'viagens':['✈️','Ver Pacotes'],
        'idiomas':['📚','Ver Cursos'],'grafica':['🖨️','Ver Serviços'],
        'advocacia':['⚖️','Ver Serviços'],'contabilidade':['📊','Ver Serviços'],
        'posto':['⛽','Ver Combustíveis'],
      };
      const _lbl = _lblMap[_cat] || ['🔧','Ver Serviços'];
      return { emoji:_lbl[0], label:_lbl[1] };
    })();

    const cardapioBtn = temCardapio
      ? `<button onclick="fecharDetalhes(true);abrirCardapioCliente(${idx});" style="
            width:100%;display:flex;align-items:center;justify-content:center;gap:8px;
            padding:12px;border-radius:12px;margin-bottom:14px;
            background:linear-gradient(135deg,rgba(16,185,129,0.12),rgba(16,185,129,0.05));
            border:1px solid rgba(16,185,129,0.3);
            color:var(--green);font-family:var(--font-h);font-size:13px;font-weight:800;cursor:pointer;">
           ${_cardapioLabel.emoji} ${_cardapioLabel.label}
           <span style="background:var(--green);color:#000;font-size:10px;font-weight:800;padding:2px 7px;border-radius:20px;">
             ${loja.cardapio.length} ${loja.cardapio.length !== 1 ? 'itens' : 'item'}
           </span>
         </button>`
      : '';

    // ── ENDEREÇO ─────────────────────────────────────────────
    const _mapsHref = (loja.maps && loja.maps.startsWith('https://'))
      ? ` data-maps="${escAttr(loja.maps)}" onclick="window.open(this.dataset.maps,'_blank','noopener')" style="cursor:pointer;"` : '';
    const _mapsTag = (loja.maps && loja.maps.startsWith('https://'))
      ? '<span style="font-size:9px;opacity:.55;margin-left:4px;color:var(--green);">↗ Maps</span>' : '';
    const enderecoHTML = loja.endereco
      ? `<div class="detail-info-row"${_mapsHref}>
           <div class="detail-info-icon addr"><i class="fa fa-map-marker-alt"></i></div>
           <div class="detail-info-text">
             <span class="detail-info-label">Endereço ${_mapsTag}</span>
             ${escHTML(loja.endereco)}
           </div>
         </div>`
      : '';

    // ── HORÁRIO ESTRUTURADO ───────────────────────────────────
    const horarioHTML = buildHorarioHTML(loja);

    // ── OBS — col H reaproveitada como descrição pública ("sobre") ──
    // obsHTML dentro de .detail-info fica vazio; a descrição é renderizada como
    // bloco "sobre" logo abaixo da categoria (ver sobreHTML abaixo).
    const obsHTML = '';
    // Descrição pública: só para lojas pagas (perk PRO/PLUS) e só se preenchida.
    // Além disso, o bloco se protege de "lixo": se a descrição for só uma cópia
    // das tags ou parecer uma lista de palavras-chave (e não uma frase), não mostra
    // — senão só repetiria a categoria que já aparece logo acima.
    const sobreHTML = (function () {
      if (!isPago) return '';
      // (1) tira vírgula/espaço pendurados no fim ("...suco," → "...suco")
      let txt = (loja.obs || '').trim().replace(/[\s,;]+$/, '').trim();
      if (!txt) return '';
      // Normalizador: minúsculas, sem acento, vírgulas/espaços colapsados.
      const norm = function (s) {
        return String(s).toLowerCase()
          .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          .replace(/[\s,;]+/g, ' ').trim();
      };
      // (2) é basicamente igual às tags? então é duplicata — esconde.
      const tagsTxt = (loja.tags || '').trim();
      if (tagsTxt && norm(txt) === norm(tagsTxt)) return '';
      // (3) "parece lista de keywords" e não frase? esconde.
      //     Heurística: tem vírgula, NÃO tem pontuação de frase (.!?:) e
      //     todo segmento tem no máx. 2 palavras. Frases de verdade passam.
      const temVirgula = txt.indexOf(',') !== -1;
      const temPontFrase = /[.!?:]/.test(txt);
      if (temVirgula && !temPontFrase) {
        const segs = txt.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
        const todosCurtos = segs.length >= 2 && segs.every(function (s) {
          return s.split(/\s+/).filter(Boolean).length <= 2;
        });
        if (todosCurtos) return '';
      }
      return `<div class="detail-sobre">${escHTML(txt)}</div>`;
    })();

    // ── BOTÕES DE AÇÃO ────────────────────────────────────────
    const { main: actionsMain, ig: actionsIg } = buildActionsHTML(loja, status);

    // ── AVALIAÇÕES ────────────────────────────────────────────
    const avaliacoes = loja.avaliacoes || [];
    const mediaAval  = avaliacoes.length
      ? (avaliacoes.reduce((s, a) => s + (a.nota || 0), 0) / avaliacoes.length).toFixed(1)
      : null;

    // Selo de excelência: nota máxima com volume mínimo de avaliações
    const isTopRated = mediaAval && parseFloat(mediaAval) >= 5 && avaliacoes.length >= 3;
    const trofeuHTML = (isPago && isTopRated)
      ? `<img src="/webp/owl-trophy.webp" alt="Loja nota máxima" title="Nota máxima!"
             style="width:40px;height:40px;object-fit:contain;flex-shrink:0;margin-left:auto;
                    filter:drop-shadow(0 2px 6px rgba(245,158,11,0.4));" onerror="this.style.display='none'" />`
      : '';

    // ── Resumo de avaliações: honesto quanto a volume ──
    // Média/estrelas em destaque só com volume mínimo (>=3). Com 1-2, mostra
    // contagem + microcopy — evita "5.0" enganoso de uma única avaliação.
    // O troféu de excelência segue exclusivo de planos pagos (perk mantido).
    const AVAL_MIN_MEDIA = 3;
    const temAvals = avaliacoes.length > 0;
    const temMedia = avaliacoes.length >= AVAL_MIN_MEDIA;
    const avalResumoHTML = temAvals
      ? `<div style="margin-bottom:12px;">
           ${temMedia
             ? `<div style="display:flex;align-items:center;gap:8px;">
                  <span style="font-size:1.4rem;font-weight:800;font-family:var(--font-h);">${mediaAval}</span>
                  <div>
                    <div style="display:flex;gap:2px;">${[1,2,3,4,5].map(s => {
                      const cor = s <= Math.round(mediaAval) ? '#f59e0b' : 'rgba(255,255,255,0.15)';
                      return `<span style="color:${cor};font-size:14px;">★</span>`;
                    }).join('')}</div>
                    <div style="font-size:10px;color:var(--muted);">${avaliacoes.length} avaliação${avaliacoes.length>1?'ões':''}</div>
                  </div>
                  ${trofeuHTML}
                </div>`
             : `<div style="font-size:11.5px;color:var(--muted);display:flex;align-items:center;gap:6px;">
                  <span style="color:#f59e0b;">★</span> ${avaliacoes.length} avaliação${avaliacoes.length>1?'ões':''} · a média aparece a partir de ${AVAL_MIN_MEDIA}
                </div>`}
           <button type="button" id="aval-toggle-${idx}" onclick="avalToggleLista(${idx})"
             style="width:100%;margin-top:10px;padding:9px;border-radius:9px;cursor:pointer;
                    background:var(--surface2);border:1px solid var(--border);color:var(--text);
                    font-family:var(--font-b);font-size:12.5px;font-weight:600;
                    display:flex;align-items:center;justify-content:center;gap:6px;-webkit-tap-highlight-color:transparent;">
             <span class="aval-toggle-txt">Ver ${avaliacoes.length} avaliação${avaliacoes.length>1?'ões':''}</span>
             <span class="aval-toggle-chev" style="transition:transform 0.25s;">⌄</span>
           </button>
         </div>`
      : '';

    // ── Lista de avaliações (colapsável, renderiza no máx. 8 por vez) ──
    const AVAL_VISIVEIS = 8;
    const _isDonoAval = _lojaToken && _lojaNome === loja.nome;
    const avalListaItens = (lista) => lista.map((a) => avalItemHTML(a, idx, _isDonoAval)).join('');

    const avalMaisBtn = avaliacoes.length > AVAL_VISIVEIS
      ? `<button type="button" id="aval-mais-${idx}" onclick="avalVerTodas(${idx})"
           style="width:100%;padding:8px;border-radius:8px;cursor:pointer;margin-top:2px;
                  background:none;border:1px dashed var(--border);color:var(--muted);
                  font-family:var(--font-b);font-size:12px;font-weight:600;-webkit-tap-highlight-color:transparent;">
           + Ver todas as ${avaliacoes.length}
         </button>`
      : '';

    const avalListaHTML = temAvals
      ? `<div id="aval-lista-${idx}" class="aval-lista-colapsada">
           <div id="aval-lista-itens-${idx}">${avalListaItens(avaliacoes.slice(0, AVAL_VISIVEIS))}</div>
           ${avalMaisBtn}
         </div>`
      : '';

    // Formulário de avaliação — 3 estados: dono (nada), já avaliou (editar/remover), novo.
    const _souDonoAval = _lojaToken && _lojaNome === loja.nome;
    const _minhaAval   = getMinhaAval(loja.nome);
    const avalFormHTML = _souDonoAval
      ? ''
      : (_minhaAval ? avalMinhaPainelHTML(idx, loja.nome, _minhaAval) : avalFormNovoHTML(idx, loja.nome));

    // ── MONTA SHEET ──────────────────────────────────────────
    sheet.innerHTML = `
      ${coverHTML}
      <div class="detail-body">
        <div class="detail-name-row">
          <div class="detail-name" id="detail-name-text">${escHTML(loja.nome)}</div>
          ${planBadge}
          ${favBtnHTML(loja)}
        </div>
        <div class="detail-sub">${escHTML(loja.sub || loja.categoria || '')}</div>
        ${sobreHTML}
        ${!isPago ? `<div style="margin-bottom:12px;">${badgeHTML(status, fechaStr, agendado)}</div>` : ''}
        ${anuncioHTML}
        ${cardapioBtn}
        <div class="detail-info">
          ${enderecoHTML}
          ${horarioHTML}
          ${obsHTML}
        </div>
        ${avalResumoHTML}
        ${avalListaHTML}
      </div>
      <div class="detail-actions">${actionsMain}</div>
      ${actionsIg ? `<div class="detail-actions" style="padding-top:8px;">${actionsIg}</div>` : ''}
      <div class="detail-aval-form-wrap">${avalFormHTML}</div>
    `;

    });
  }

  // Compartilhar loja via Web Share API ou fallback para clipboard
  function detalhesCompartilhar(idx) {
    const loja = LOJAS[idx];
    if (!loja) return;
    const url = `${location.origin}/#${toSlug(loja.nome)}`;

    // Monta texto rico com status e horário
    const { status, fechaStr } = calcStatusInfo(loja);
    const statusTxt = status === 'open'   ? `✅ Aberto agora${fechaStr ? ` até ${fechaStr}` : ''}`
                    : status === 'closed' ? '🔴 Fechado agora'
                    : status === 'zap'    ? '⏰ Já voltamos em breve'
                    : '';
    const anuncioTxt = (loja.anuncio?.texto)
      ? `\n${loja.anuncio.emoji || '🎯'} *Promoção:* ${loja.anuncio.texto}`
      : '';

    const text = `${emojiLoja(loja) || '📍'} *${loja.nome}*\n${loja.sub || loja.categoria || ''}${loja.endereco ? `\n📍 ${loja.endereco}` : ''}\n${statusTxt}${anuncioTxt}\n\nVeja no AngatubaON: ${url}`;

    if (navigator.share) {
      navigator.share({ title: loja.nome, text, url }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(url).then(() => {
        // #17: reseta a coruja do toast (evita herdar a coruja de um toast
        // anterior) e reusa o timer global para não colidir com outro toast.
        const t = document.getElementById('toast');
        _setToastOwl('/webp/owl-tada.webp');
        document.getElementById('toast-title').textContent = 'Link copiado!';
        document.getElementById('toast-msg').textContent   = url;
        clearTimeout(toastTimer);
        t.classList.add('show');
        toastTimer = setTimeout(hideToast, 2500);
      }).catch(() => {});
    }
  }

  function fecharDetalhes(silencioso = false) {
    const overlay = document.getElementById('modal-detalhes');
    overlay.classList.remove('open');
    document.body.style.overflow = '';
    _focusTrapDesativar();
    if (silencioso) {
      // Chamado antes de abrir outro modal — limpa o hash sem history.back()
      // para evitar que o popstate feche o próximo modal
      if (location.hash) history.replaceState(null, '', location.pathname + location.search);
    } else if (history.state?.modal === 'detalhes') {
      history.back();
    } else if (location.hash) {
      history.replaceState(null, '', location.pathname + location.search);
    }
  }

  // Fecha ao clicar no overlay fora do sheet
  document.getElementById('modal-detalhes').addEventListener('click', function(e) {
    if (e.target === this) fecharDetalhes();
  });

  // Fecha com tecla Escape — respeita hierarquia de modais abertos
  document.addEventListener('keydown', function(e) {
    if (e.key !== 'Escape') return;
    // Lightbox de foto tem prioridade máxima — fecha antes de qualquer modal
    if (document.getElementById('cc-lightbox')?.classList.contains('open')) {
      ccFecharFoto(); return;
    }
    if (document.getElementById('modal-cardapio-cliente')?.classList.contains('open')) {
      fecharCardapioCliente(true); return;
    }
    if (document.getElementById('modal-login-loja')?.classList.contains('open')) {
      closeLoginLoja(); return;
    }
    if (document.getElementById('modal-detalhes').classList.contains('open')) {
      fecharDetalhes(); return;
    }
    if (document.getElementById('modal-cadastro').classList.contains('open')) {
      closeModal(); return;
    }
    if (document.getElementById('modal-planos').classList.contains('open')) {
      closePlanModal();
    }
  });

  // Back button Android — fecha o modal correto ao pressionar voltar
  // Placeholder quando foto falha
  function placeholderCover(emoji, categoria) {
    const bg = CAT_BG[categoria] || 'rgba(255,255,255,0.06)';
    return `<div class="detail-cover-placeholder" style="background:${bg};">${emoji}</div>`;
  }

  // Constrói a seção de horários legível (grade de dias)
  function buildHorarioHTML(loja) {
    const txt = loja.horarioTexto || loja.horario_texto || '';

    // ── Agendamento ───────────────────────────────────────────
    // Sem horário definido: a linha vira 'Atende por agendamento' (sem
    // aberto/fechado). Com horário definido: mostra o horário normal, mas
    // com um selo indicando que o atendimento é só com agendamento.
    const _temHorario = !!txt || !!loja.horario;
    if (loja.agendamento && !_temHorario) {
      return `<div class="detail-info-row">
        <div class="detail-info-icon clock"><i class="fa fa-calendar-check"></i></div>
        <div class="detail-info-text">
          <span class="detail-info-label">Atendimento</span>
          <span class="detail-agendamento-txt">Atende por agendamento</span>
        </div>
      </div>`;
    }
    const _seloAgend = loja.agendamento
      ? '<div class="detail-agendamento-selo"><i class="fa fa-calendar-check"></i> Somente com agendamento</div>'
      : '';

    // Se tem múltiplos turnos (separados por |), renderiza cada um como linha
    if (txt && txt.includes('|')) {
      const hoje = new Date().getDay();
      const DIAS_LABEL_SHORT = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
      const DIAS_IDX = { dom:0, seg:1, ter:2, qua:3, qui:4, sex:5, sáb:6, sab:6 };

      const linhas = txt.split('|').map(parte => {
        parte = parte.trim();
        // formato: "Seg, Ter, Qua, Qui, Sex 08:00-18:00"
        const match = parte.match(/^(.+?)\s+(\d{2}:\d{2})-(\d{2}:\d{2})$/);
        if (!match) return `<div class="detail-schedule-row"><span class="detail-schedule-day">${escHTML(parte)}</span></div>`;
        const diasStr = match[1];
        const horaStr = `${match[2]} – ${match[3]}`;
        // Verifica se hoje está nesse turno
        const diasMencioandos = diasStr.split(',').map(d => {
          const key = d.trim().toLowerCase().normalize('NFC').slice(0,3);
          return DIAS_IDX[key];
        }).filter(d => d !== undefined);
        const temHoje = diasMencioandos.includes(hoje);
        const hojeLabel = temHoje ? ` <span style="font-size:9px;opacity:0.7;">(hoje)</span>` : '';
        return `<div class="detail-schedule-row${temHoje ? ' today' : ''}">
          <span class="detail-schedule-day">${escHTML(diasStr)}${hojeLabel}</span>
          <span class="detail-schedule-time">${horaStr}</span>
        </div>`;
      });

      // Colapso: linha de hoje primeiro como resumo, demais expansíveis
      const linhasArr = linhas; // é array neste ponto (antes do join)
      // ordena hoje primeiro
      linhasArr.sort((a, b) => {
        const aHoje = a.includes('(hoje)');
        const bHoje = b.includes('(hoje)');
        return aHoje === bHoje ? 0 : aHoje ? -1 : 1;
      });
      const primeiraP = linhasArr.length ? linhasArr[0] : '';
      const restoP    = linhasArr.slice(1).join('');
      const temRestoP = restoP.trim().length > 0;
      const toggleP   = temRestoP
        ? `<span class="detail-horario-toggle">ver todos <i class="fa fa-chevron-down"></i></span>`
        : '';
      const onclickP  = temRestoP
        ? ` onclick="this.closest('.detail-horario-wrap').classList.toggle('expanded')"` : '';

      return `<div class="detail-info-row detail-horario-wrap">
        <div class="detail-info-icon clock"><i class="fa fa-clock"></i></div>
        <div class="detail-info-text" style="flex:1;">
          <span class="detail-info-label">Horário de Funcionamento</span>
          <div class="detail-schedule">
            <div class="detail-horario-resumo"${onclickP}>
              <div style="flex:1;min-width:0;">${primeiraP}</div>
              ${toggleP}
            </div>
            ${temRestoP ? `<div class="detail-horario-full"><div>${restoP}</div></div>` : ''}
          </div>
          ${_seloAgend}
        </div>
      </div>`;
    }

    if (!loja.horario) {
      if (!txt) return '';
      return `<div class="detail-info-row">
        <div class="detail-info-icon clock"><i class="fa fa-clock"></i></div>
        <div class="detail-info-text">
          <span class="detail-info-label">Horário</span>
          ${escHTML(txt)}
          ${_seloAgend}
        </div>
      </div>`;
    }

    const { dias, abre, fecha } = loja.horario;
    const hoje   = new Date().getDay();
    const is24h  = abre === '00:00' && fecha === '23:59';
    const horaStr = is24h ? '24 horas' : `${abre} – ${fecha}`;
    const DIAS_ABREV = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

    // ── Agrupa dias consecutivos com mesmo status ──────────────
    // Constrói array de segmentos: { label, horario, fechado, temHoje }
    const segmentos = [];
    let i = 0;
    while (i < 7) {
      const aberto = dias.includes(i);
      // Avança enquanto o próximo dia tiver mesmo status
      let j = i + 1;
      while (j < 7 && dias.includes(j) === aberto) j++;

      const diasDoSeg = Array.from({ length: j - i }, (_, k) => i + k);
      const temHoje   = diasDoSeg.includes(hoje);

      // Monta label do segmento
      let label;
      if (diasDoSeg.length === 1) {
        label = DIAS_NOMES_FULL[diasDoSeg[0]];
      } else if (diasDoSeg.length === 2) {
        label = `${DIAS_ABREV[diasDoSeg[0]]} e ${DIAS_ABREV[diasDoSeg[1]]}`;
      } else {
        label = `${DIAS_ABREV[diasDoSeg[0]]}–${DIAS_ABREV[diasDoSeg[diasDoSeg.length - 1]]}`;
      }

      segmentos.push({ label, aberto, temHoje, dias: diasDoSeg });
      i = j;
    }

    // ── Ordena: hoje primeiro, depois abertos, depois fechados ─
    segmentos.sort((a, b) => {
      if (a.temHoje && !b.temHoje) return -1;
      if (!a.temHoje && b.temHoje) return 1;
      if (a.aberto && !b.aberto)   return -1;
      if (!a.aberto && b.aberto)   return 1;
      return 0;
    });

    // ── Gera linhas HTML ───────────────────────────────────────
    const linhas = segmentos.map(seg => {
      const hojeLabel = seg.temHoje
        ? ` <span style="font-size:9px;opacity:0.7;">(hoje)</span>`
        : '';

      if (seg.aberto) {
        return `<div class="detail-schedule-row${seg.temHoje ? ' today' : ''}">
          <span class="detail-schedule-day">${seg.label}${hojeLabel}</span>
          <span class="detail-schedule-time">${horaStr}</span>
        </div>`;
      } else {
        return `<div class="detail-schedule-row day-closed${seg.temHoje ? ' today' : ''}">
          <span class="detail-schedule-day">${seg.label}${hojeLabel}</span>
          <span class="detail-schedule-closed">Fechado</span>
        </div>`;
      }
    });

    // Horário colapsável: 1ª linha (hoje) sempre visível como resumo;
    // demais dias dentro do bloco expansível (toque para abrir/fechar).
    const primeira = linhas.length ? linhas[0] : '';
    const resto    = linhas.length > 1 ? linhas.slice(1).join('') : '';
    const temResto = resto.trim().length > 0;

    const toggle = temResto
      ? `<span class="detail-horario-toggle">ver todos <i class="fa fa-chevron-down"></i></span>`
      : '';
    const onclick = temResto
      ? ` onclick="this.closest('.detail-horario-wrap').classList.toggle('expanded')"`
      : '';

    return `<div class="detail-info-row detail-horario-wrap">
      <div class="detail-info-icon clock"><i class="fa fa-clock"></i></div>
      <div class="detail-info-text" style="flex:1;">
        <span class="detail-info-label">Horário de Funcionamento</span>
        <div class="detail-schedule">
          <div class="detail-horario-resumo"${onclick}>
            <div style="flex:1;min-width:0;">${primeira}</div>
            ${toggle}
          </div>
          ${temResto ? `<div class="detail-horario-full"><div>${resto}</div></div>` : ''}
        </div>
        ${_seloAgend}
      </div>
    </div>`;
  }

  // Constrói os botões de ação do modal
  // Retorna { main: html da linha principal, ig: html do botão instagram (linha separada) }
  function buildActionsHTML(loja, status) {
    const mNome = escAttr(loja.nome);
    const mPlan = escAttr(loja.plano || 'GRATIS');
    const mCat  = escAttr(loja.categoria || '');
    const abre  = loja.horario ? loja.horario.abre : '';

    let main = '';
    let ig   = '';

    // Botão WhatsApp
    if (loja.wpp) {
      const msg = encodeURIComponent(saudacaoWhats(loja));
      const url = `https://wa.me/${loja.wpp}?text=${msg}`;
      if (status === 'open' || status === 'zap') {
        main += `<a href="${url}" target="_blank" rel="noopener"
          class="detail-btn-wpp"
          data-nome="${mNome}" data-tipo="wpp" data-plano="${mPlan}" data-cat="${mCat}"
          onclick="registrarClique(this.dataset.nome,this.dataset.tipo,this.dataset.plano,this.dataset.cat)">
          <i class="fab fa-whatsapp"></i> WhatsApp
        </a>`;
      } else {
        main += `<button class="detail-btn-wpp closed-wpp"
          data-nome="${mNome}" data-abre="${escAttr(abre)}"
          onclick="fecharDetalhes(); showToast(this.dataset.nome, this.dataset.abre);">
          <i class="fab fa-whatsapp"></i> Fechado agora
        </button>`;
      }
    }

    // Botão Telefone
    if (loja.tel) {
      if (status === 'closed') {
        const abreTel = loja.horario ? loja.horario.abre : '';
        main += `<button class="detail-btn-tel" style="opacity:0.55;"
          data-nome="${mNome}" data-abre="${escAttr(abreTel)}" data-tel="${escAttr(loja.tel)}"
          onclick="fecharDetalhes(); showToast(this.dataset.nome, this.dataset.abre, this.dataset.tel);">
          <i class="fa fa-phone"></i> Fechado
        </button>`;
      } else {
        main += `<a href="tel:${loja.tel}" class="detail-btn-tel"
          data-nome="${mNome}" data-tipo="tel" data-plano="${mPlan}" data-cat="${mCat}"
          onclick="registrarClique(this.dataset.nome,this.dataset.tipo,this.dataset.plano,this.dataset.cat)">
          <i class="fa fa-phone"></i> Ligar
        </a>`;
      }
    }

    // Botão Mapa: mostrado apenas quando NÃO há contato (wpp/tel)
    // Quando há contato, o endereço já é clicável → sem duplicidade
    // Fix #24: só insere o href se a URL começa com https://
    if (loja.maps && loja.maps.startsWith('https://')) {
      const mapsUrl = escAttr(loja.maps);
      const temContato = loja.wpp || loja.tel;
      if (!temContato) {
        main += `<a href="${mapsUrl}" target="_blank" rel="noopener"
            class="detail-btn-maps-full" aria-label="Como chegar">
            <i class="fa fa-map-marker-alt"></i> Como chegar
          </a>`;
      }
    }

    // Botão compartilhar — sempre presente
    const _idx = _lojaIdxMap.get(loja) ?? LOJAS.indexOf(loja);
    const _temContBtns = !!(loja.wpp || loja.tel);
    main += `<button onclick="detalhesCompartilhar(${_idx})"
      class="${_temContBtns ? 'detail-btn-maps' : 'detail-btn-maps-full'}" aria-label="Compartilhar"
      style="background:rgba(99,102,241,0.1);border-color:rgba(99,102,241,0.25);color:var(--indigo);">
      <i class="fa fa-share-nodes"></i>${_temContBtns ? '' : ' Compartilhar'}
    </button>`;

    // Botão Instagram — linha separada
    if (loja.instagram) {
      const igHandle = normalizarInstagramHandle(loja.instagram);
      if (igHandle) {
        const igUrl = `https://instagram.com/${igHandle}`;
        ig = `<a href="${igUrl}" target="_blank" rel="noopener"
          class="detail-btn-ig"
          data-nome="${mNome}" data-tipo="ig" data-plano="${mPlan}" data-cat="${mCat}"
          onclick="registrarClique(this.dataset.nome,this.dataset.tipo,this.dataset.plano,this.dataset.cat)">
          <i class="fab fa-instagram"></i> @${igHandle}
        </a>`;
      }
    }

    return { main, ig };
  }

  /* ══════════════════════════════════════════════════════════════
     UPLOAD DE IMAGENS — proxy via Apps Script
     A chave da ImgBB fica no servidor (Script Properties),
     nunca exposta no JS público.
     Apps Script action: 'uploadImagem' — recebe base64 + mime,
     faz o upload e devolve { status:'ok', url:'https://...' }.
  ══════════════════════════════════════════════════════════════ */

  // Converte File em base64 (sem o prefixo data:...)
  async function _fileToBase64(file) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload  = () => res(r.result.split(',')[1]);
      r.onerror = () => rej(new Error('Leitura de arquivo falhou'));
      r.readAsDataURL(file);
    });
  }

  // Upload direto para Cloudinary — 2 etapas:
  // 1. Busca assinatura do GAS (chamada leve, sem base64)
  // 2. Envia imagem diretamente do browser para Cloudinary (sem passar pelo GAS)
  // Isso evita o problema de passar megabytes de base64 pelo Apps Script
  // Item 13: redimensiona/recomprime a imagem no browser antes de enviar.
  // Foto de celular tem 3–8MB e ~4000px; o card exibe pequeno e a capa/hero puxa
  // a imagem para todo cliente que abre a loja. Reduzir para ~1280px e recomprimir
  // acelera muito o upload (crítico no 4G rural de Angatuba) e o carregamento público.
  // Preserva proporção, nunca faz upscale, mantém PNG (alpha de logos) quando aplicável,
  // e cai no arquivo original se algo falhar.
  function _mlRedimensionarImagem(file, maxDim, quality) {
    return new Promise(function (resolve) {
      try {
        if (!file || !/^image\//.test(file.type) || file.type === 'image/gif') {
          return resolve(file); // gif animado / não-imagem: não mexe
        }
        const reader = new FileReader();
        reader.onerror = function () { resolve(file); };
        reader.onload = function (ev) {
          const img = new Image();
          img.onerror = function () { resolve(file); };
          img.onload = function () {
            try {
              const w = img.naturalWidth, h = img.naturalHeight;
              if (!w || !h) return resolve(file);
              // Já pequena o suficiente: não redimensiona (evita upscale e perda à toa).
              if (Math.max(w, h) <= maxDim) return resolve(file);
              const escala = maxDim / Math.max(w, h);
              const nw = Math.round(w * escala), nh = Math.round(h * escala);
              const canvas = document.createElement('canvas');
              canvas.width = nw; canvas.height = nh;
              const ctx = canvas.getContext('2d');
              if (!ctx) return resolve(file);
              ctx.drawImage(img, 0, 0, nw, nh);
              // PNG preserva transparência (logos); resto vira JPEG comprimido.
              const ehPng = file.type === 'image/png';
              const mime  = ehPng ? 'image/png' : 'image/jpeg';
              canvas.toBlob(function (blob) {
                // Se a conversão falhou ou ficou maior que o original, usa o original.
                if (!blob || blob.size >= file.size) return resolve(file);
                const nome = (file.name || 'img').replace(/\.[^.]+$/, '') + (ehPng ? '.png' : '.jpg');
                try {
                  resolve(new File([blob], nome, { type: mime, lastModified: Date.now() }));
                } catch (e) {
                  // Ambientes sem construtor File: devolve o Blob (FormData aceita).
                  resolve(blob);
                }
              }, mime, ehPng ? undefined : (quality || 0.85));
            } catch (e) { resolve(file); }
          };
          img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
      } catch (e) { resolve(file); }
    });
  }

  async function uploadImagem(file, statusEl) {
    if (!file) return null;
    // Item 13: reduz antes de qualquer checagem de tamanho (uma foto de 6MB/4000px
    // costuma cair para poucas centenas de KB, evitando o erro de "máx 5MB" e timeouts).
    if (statusEl) { statusEl.textContent = '⏳ Otimizando imagem...'; statusEl.style.color = 'var(--muted)'; }
    file = await _mlRedimensionarImagem(file, 1280, 0.85);
    if (file.size > 5 * 1024 * 1024) {
      statusEl.textContent = '❌ Arquivo muito grande (máx 5MB)';
      statusEl.style.color = 'var(--red)';
      return null;
    }

    statusEl.textContent = '⏳ Preparando upload...';
    statusEl.style.color = 'var(--muted)';

    try {
      // Etapa 1: pede assinatura ao GAS (só timestamp, token e folder — sem base64)
      const sigParams = new URLSearchParams();
      sigParams.append('payload', JSON.stringify({
        action: 'cloudinaryAssinar',
        token:  _lojaToken,
      }));
      const sigResp = await fetch(APPS_SCRIPT_URL, {
        method: 'POST', body: sigParams,
        signal: AbortSignal.timeout(30000),
      });
      const sigJson = await sigResp.json();
      if (sigJson.status !== 'ok') throw new Error(sigJson.msg || 'Erro ao assinar upload');

      const { cloud, apiKey, timestamp, folder, signature } = sigJson.data;

      // Etapa 2: upload direto do browser para Cloudinary (sem passar pelo GAS)
      statusEl.textContent = '⏳ Enviando imagem...';
      const formData = new FormData();
      formData.append('file',      file);
      formData.append('api_key',   apiKey);
      formData.append('timestamp', timestamp);
      formData.append('folder',    folder);
      formData.append('signature', signature);

      const uploadResp = await fetch(
        `https://api.cloudinary.com/v1_1/${cloud}/image/upload`,
        { method: 'POST', body: formData, signal: AbortSignal.timeout(60000) }
      );
      const uploadJson = await uploadResp.json();

      if (uploadJson.secure_url) {
        statusEl.textContent = '✅ Imagem enviada!';
        statusEl.style.color = 'var(--green)';
        return uploadJson.secure_url;
      } else {
        const msg = uploadJson.error?.message || 'Falha no upload';
        throw new Error(msg);
      }
    } catch (err) {
      statusEl.textContent = '❌ Erro: ' + err.message;
      statusEl.style.color = 'var(--red)';
      return null;
    }
  }

  // Lê a duração de um arquivo de vídeo sem reproduzir. Resolve em segundos
  // (ou 0 se não conseguir). Usa um <video> temporário só com metadados.
  function _duracaoVideo(file) {
    return new Promise(function (resolve) {
      try {
        var v = document.createElement('video');
        v.preload = 'metadata';
        v.muted = true;
        var url = URL.createObjectURL(file);
        var done = function (seg) { try { URL.revokeObjectURL(url); } catch(e){} resolve(seg); };
        v.onloadedmetadata = function () { done(v.duration || 0); };
        v.onerror = function () { done(0); };
        // Safety net: metadados podem travar em conexões ruins.
        setTimeout(function () { done(v.duration || 0); }, 8000);
        v.src = url;
      } catch (e) { resolve(0); }
    });
  }

  // Upload de VÍDEO do anúncio (Pro). Diferente da foto: não há como
  // recomprimir no browser, então validamos duração (<= 20s) e tamanho
  // (<= 30MB) antes de subir. Assina com tipo:'video' e envia para
  // o endpoint /video/upload do Cloudinary.
  async function uploadVideoAnuncio(file, statusEl) {
    if (!file) return null;
    statusEl.textContent = '⏳ Verificando vídeo...';
    statusEl.style.color = 'var(--muted)';
    var seg = await _duracaoVideo(file);
    if (seg && seg > 20 + 0.5) {
      statusEl.textContent = '❌ Vídeo muito longo (máx 20s). O seu tem ' + Math.round(seg) + 's.';
      statusEl.style.color = 'var(--red)';
      return null;
    }
    if (file.size > 30 * 1024 * 1024) {
      statusEl.textContent = '❌ Vídeo muito pesado (máx 30MB).';
      statusEl.style.color = 'var(--red)';
      return null;
    }
    try {
      statusEl.textContent = '⏳ Preparando envio...';
      var sigParams = new URLSearchParams();
      sigParams.append('payload', JSON.stringify({ action: 'cloudinaryAssinar', token: _lojaToken, tipo: 'video' }));
      var sigResp = await fetch(APPS_SCRIPT_URL, { method:'POST', body:sigParams, signal:AbortSignal.timeout(30000) });
      var sigJson = await sigResp.json();
      if (sigJson.status !== 'ok') throw new Error(sigJson.msg || 'Erro ao assinar upload');
      var d = sigJson.data;
      statusEl.textContent = '⏳ Enviando vídeo...';
      var fd = new FormData();
      fd.append('file', file);
      fd.append('api_key', d.apiKey);
      fd.append('timestamp', d.timestamp);
      fd.append('folder', d.folder);
      fd.append('signature', d.signature);
      // Vídeo pode demorar no 4G: timeout generoso.
      var upResp = await fetch('https://api.cloudinary.com/v1_1/' + d.cloud + '/video/upload',
        { method:'POST', body:fd, signal:AbortSignal.timeout(120000) });
      var upJson = await upResp.json();
      if (upJson.secure_url) {
        statusEl.textContent = '✅ Vídeo enviado!';
        statusEl.style.color = 'var(--green)';
        return upJson.secure_url;
      }
      throw new Error((upJson.error && upJson.error.message) || 'Falha no upload do vídeo');
    } catch (err) {
      statusEl.textContent = '❌ Erro: ' + err.message;
      statusEl.style.color = 'var(--red)';
      return null;
    }
  }

  function initImageUpload(fileInputId, hiddenId, previewImgId, previewWrapId, statusId) {
    const fileInput  = document.getElementById(fileInputId);
    const hiddenUrl  = document.getElementById(hiddenId);
    const previewImg = document.getElementById(previewImgId);
    const statusEl   = document.getElementById(statusId);

    if (!fileInput) return;

    fileInput.addEventListener('change', async function() {
      const file = this.files[0];
      if (!file) return;

      // Preview local imediato no card
      const reader = new FileReader();
      reader.onload = e => {
        if (previewImg) {
          previewImg.src = e.target.result;
          previewImg.style.display = 'block';
          // Esconde placeholder correspondente
          const isLogo = previewImgId === 'logo-preview-img';
          const placeholder = document.getElementById(isLogo ? 'prev-logo-placeholder' : 'prev-capa-placeholder');
          if (placeholder) placeholder.style.display = 'none';
        }
      };
      reader.readAsDataURL(file);

      // Upload real
      const url = await uploadImagem(file, statusEl);
      if (url) hiddenUrl.value = url;
    });
  }

  // Atualiza nome/ramo no preview do card em tempo real
  function initCardPreviewSync() {
    const nomeInput = document.getElementById('f-nome');
    const prevNome  = document.getElementById('prev-nome');
    const prevRamo  = document.getElementById('prev-ramo');

    if (nomeInput && prevNome) {
      nomeInput.addEventListener('input', () => {
        prevNome.textContent = nomeInput.value.trim() || 'Nome da sua loja';
      });
    }

    // Observar mudanças no campo oculto de ramo (preenchido pelo autocomplete)
    const ramoText = document.getElementById('f-ramo-text');
    if (ramoText && prevRamo) {
      ramoText.addEventListener('input', () => {
        prevRamo.textContent = ramoText.value.trim() || 'Ramo / categoria';
      });
    }

    // ── Drag para reposicionar a capa ──────────────────────────
    const capaWrap = document.getElementById('prev-capa-wrap');
    const capaImg  = document.getElementById('foto-preview-img');
    const capaPosEl= document.getElementById('f-foto-pos');
    const dragHint = document.getElementById('prev-capa-drag-hint');

    if (!capaWrap || !capaImg) return;

    let dragging = false;
    let startX = 0, startY = 0;
    // posição atual em % (0–100)
    let posX = 50, posY = 50;

    function applyPos() {
      capaImg.style.objectPosition = `${posX}% ${posY}%`;
      if (capaPosEl) capaPosEl.value = `${posX}% ${posY}%`;
    }

    function onDragStart(clientX, clientY) {
      if (capaImg.style.display === 'none') return; // sem foto
      dragging = true;
      startX = clientX;
      startY = clientY;
      capaWrap.style.cursor = 'grabbing';
      if (dragHint) dragHint.style.display = 'none';
    }

    function onDragMove(clientX, clientY) {
      if (!dragging) return;
      const dx = clientX - startX;
      const dy = clientY - startY;
      startX = clientX;
      startY = clientY;
      // sensibilidade: cada px de movimento = 0.3% de deslocamento
      posX = Math.min(100, Math.max(0, posX - dx * 0.3));
      posY = Math.min(100, Math.max(0, posY - dy * 0.3));
      applyPos();
    }

    function onDragEnd() {
      dragging = false;
      capaWrap.style.cursor = 'grab';
    }

    // Mouse
    capaWrap.addEventListener('mousedown', e => {
      if (e.target.closest('label')) return; // não interfere no botão trocar
      e.preventDefault();
      onDragStart(e.clientX, e.clientY);
    });
    window.addEventListener('mousemove', e => onDragMove(e.clientX, e.clientY));
    window.addEventListener('mouseup', onDragEnd);

    // Touch
    capaWrap.addEventListener('touchstart', e => {
      if (e.target.closest('label')) return;
      const t = e.touches[0];
      onDragStart(t.clientX, t.clientY);
    }, { passive: true });
    capaWrap.addEventListener('touchmove', e => {
      if (!dragging) return;
      e.preventDefault();
      const t = e.touches[0];
      onDragMove(t.clientX, t.clientY);
    }, { passive: false });
    capaWrap.addEventListener('touchend', onDragEnd);

    // Ativa cursor grab quando há foto
    const observer = new MutationObserver(() => {
      if (capaImg.style.display !== 'none') {
        capaWrap.style.cursor = 'grab';
        if (dragHint) {
          dragHint.style.display = 'block';
          // esconde hint após 3s
          setTimeout(() => { dragHint.style.display = 'none'; }, 3000);
        }
      }
    });
    observer.observe(capaImg, { attributes: true, attributeFilter: ['style'] });
  }
  initCardPreviewSync();

  // Mostra o contador de favoritos no pill logo na carga
  atualizarBadgeFavoritos();

  // Onboarding do cliente (1ª vez): espera a lista pintar e não interrompe
  // quem abriu direto num link de loja (deep-link com #hash).
  if (!location.hash) {
    setTimeout(function () {
      if (!location.hash) mostrarOnboardingCliente();
    }, 900);
  }

  // Nudge de avaliação: disparado após as lojas carregarem de verdade
  // (ver _tentarNudgeAposCarga chamado no fim de carregarLojas). O timeout
  // aqui é só uma rede de segurança caso o cache já esteja em memória.
  setTimeout(function () { _migrarFavoritosParaId(); _tentarNudgeAposCarga(); }, 2600);

  // Inicializa os dois campos de upload
  initImageUpload('f-foto-file', 'f-foto-url', 'foto-preview-img', null, 'foto-upload-status');
  initImageUpload('f-logo-file', 'f-logo-url', 'logo-preview-img', null, 'logo-upload-status');

  /* ══════════════════════════════════════════════════════════════
     RAMO AUTOCOMPLETE
     Substitui o <select> estático por um combobox com busca em tempo real.
     O campo oculto #f-ramo recebe o slug/valor real enviado ao servidor.
  ══════════════════════════════════════════════════════════════ */
  (function initRamoAutocomplete() {

    /* ── Catálogo completo ──────────────────────────────────── */
    // RAMOS agora é derivado de CAT_DEF (definido no topo do arquivo).

    /* ── Helpers ──────────────────────────────────────────── */
    // Remove acentos e converte para minúsculas para busca insensível
    function norm(s) {
      return String(s).toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9 ]/g, ' ').trim();
    }
    // Envolve o trecho coincidente em <mark> para highlight
    function hl(label, raw) {
      if (!raw) return label;
      const re = new RegExp(`(${raw.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')})`, 'gi');
      return label.replace(re, '<mark>$1</mark>');
    }

    /* ── DOM refs ─────────────────────────────────────────── */
    const inputEl    = document.getElementById('f-ramo-text');
    const hiddenEl   = document.getElementById('f-ramo');
    const dropEl     = document.getElementById('ramo-dropdown');
    const emojiEl    = document.getElementById('ramo-emoji');
    const clearEl    = document.getElementById('ramo-clear');
    const okEl       = document.getElementById('ramo-ok');
    if (!inputEl) return;

    /* ── Estado interno ───────────────────────────────────── */
    let chosen  = null;   // objeto RAMOS escolhido
    let kbIdx   = -1;     // índice com foco via teclado
    let visible = [];     // itens renderizados no momento

    /* ── Renderiza o dropdown ─────────────────────────────── */
    function renderDrop(q) {
      const qn  = norm(q);
      const qRaw = q.trim();

      const matched = qn
        ? RAMOS.filter(r =>
            norm(r.label).includes(qn) ||
            r.busca.some(b => norm(b).includes(qn))
          )
        : RAMOS;   // vazio = mostra todos

      // Agrupa por grupo
      const map = new Map();
      matched.forEach(r => {
        if (!map.has(r.grupo)) map.set(r.grupo, []);
        map.get(r.grupo).push(r);
      });

      visible = [];
      let html = '';

      if (!matched.length && qRaw) {
        // Sem resultado: opção de usar o texto livre
        visible = [{ emoji:'➕', label:`"${qRaw}"`, slug: qRaw, grupo:'', busca:[], _custom: true }];
        html = `<div class="ramo-opt is-outro" role="option" data-idx="0">
          <span class="ramo-opt-emoji">➕</span>
          <span class="ramo-opt-label">Usar <mark>${qRaw}</mark> como ramo</span>
        </div>`;
      } else {
        map.forEach((items, grupo) => {
          html += `<div class="ramo-group-label">${grupo}</div>`;
          items.forEach(r => {
            const i = visible.length;
            visible.push(r);
            html += `<div class="ramo-opt" role="option" data-idx="${i}">
              <span class="ramo-opt-emoji">${r.emoji}</span>
              <span class="ramo-opt-label">${hl(r.label, qRaw)}</span>
            </div>`;
          });
        });
        // "Outro ramo" sempre disponível no final
        const oi = visible.length;
        visible.push({ emoji:'➕', label:'Outro ramo (não listado)', slug:'outro', grupo:'', busca:[] });
        html += `<div class="ramo-opt is-outro" role="option" data-idx="${oi}">
          <span class="ramo-opt-emoji">➕</span>
          <span class="ramo-opt-label">Outro ramo (não listado)</span>
        </div>`;
      }

      dropEl.innerHTML = html;
      kbIdx = -1;

      // Clicks nas opções
      dropEl.querySelectorAll('.ramo-opt').forEach(el => {
        el.addEventListener('mousedown', ev => {
          ev.preventDefault();               // impede blur antes do click
          escolher(visible[+el.dataset.idx]);
        });
      });
    }

    /* ── Aplica a escolha ─────────────────────────────────── */
    function escolher(ramo) {
      if (!ramo) return;
      chosen = ramo;
      inputEl.value    = ramo._custom ? ramo.slug : ramo.label;
      hiddenEl.value   = ramo._custom ? ramo.slug : ramo.slug;
      emojiEl.textContent = ramo._custom ? '' : ramo.emoji;
      okEl.classList.add('show');
      clearEl.classList.add('show');
      fecharDrop();
      inputEl.setAttribute('aria-expanded', 'false');
      // Sugere tags padrão da categoria escolhida (balões no campo de tags)
      if (window.tagsInjectDefaults) window.tagsInjectDefaults(ramo._custom ? '' : ramo.slug);
    }

    /* ── Abre / fecha ─────────────────────────────────────── */
    function abrirDrop() {
      renderDrop(inputEl.value);
      dropEl.classList.add('open');
      inputEl.setAttribute('aria-expanded', 'true');
    }
    function fecharDrop() {
      dropEl.classList.remove('open');
      inputEl.setAttribute('aria-expanded', 'false');
      kbIdx = -1;
    }

    /* ── Foco via teclado ─────────────────────────────────── */
    function moverKb(dir) {
      const opts = dropEl.querySelectorAll('.ramo-opt');
      if (!opts.length) return;
      opts[kbIdx]?.classList.remove('kb-focus');
      kbIdx = (kbIdx + dir + opts.length) % opts.length;
      opts[kbIdx]?.classList.add('kb-focus');
      opts[kbIdx]?.scrollIntoView({ block: 'nearest' });
    }

    /* ── Eventos ──────────────────────────────────────────── */
    inputEl.addEventListener('focus', () => {
      if (chosen) inputEl.select();
      abrirDrop();
    });

    inputEl.addEventListener('input', () => {
      chosen = null;
      hiddenEl.value = '';
      okEl.classList.remove('show');
      emojiEl.textContent = '';
      clearEl.classList.toggle('show', inputEl.value.length > 0);
      renderDrop(inputEl.value);
      dropEl.classList.add('open');
      inputEl.setAttribute('aria-expanded', 'true');
    });

    inputEl.addEventListener('keydown', e => {
      if (!dropEl.classList.contains('open')) {
        if (e.key === 'ArrowDown' || e.key === 'Enter') abrirDrop();
        return;
      }
      switch (e.key) {
        case 'ArrowDown':  e.preventDefault(); moverKb(+1); break;
        case 'ArrowUp':    e.preventDefault(); moverKb(-1); break;
        case 'Escape':     fecharDrop(); break;
        case 'Tab':
        case 'Enter':
          if (kbIdx >= 0 && visible[kbIdx]) { e.preventDefault(); escolher(visible[kbIdx]); }
          else if (e.key === 'Enter') fecharDrop();
          break;
      }
    });

    inputEl.addEventListener('blur', () => {
      // Delay pequeno para o mousedown dos itens disparar antes
      setTimeout(() => {
        fecharDrop();
        // Se digitou algo sem confirmar: tenta autocomplete pelo melhor match
        if (!chosen && inputEl.value.trim()) {
          const qn = norm(inputEl.value);
          const hit = RAMOS.find(r =>
            norm(r.label).includes(qn) || r.busca.some(b => norm(b).includes(qn))
          );
          if (hit) {
            escolher(hit);
          } else {
            // Mantém como texto livre (ramo customizado)
            hiddenEl.value = inputEl.value.trim();
            okEl.classList.add('show');
          }
        }
      }, 200);
    });

    clearEl.addEventListener('click', () => ramoReset());

    // Fecha ao clicar fora
    document.addEventListener('click', e => {
      if (!e.target.closest('.ramo-wrap')) fecharDrop();
    });

    /* ── API pública — usada no closeModal ────────────────── */
    window.ramoReset = function () {
      chosen = null;
      inputEl.value       = '';
      hiddenEl.value      = '';
      emojiEl.textContent = '';
      okEl.classList.remove('show');
      clearEl.classList.remove('show');
      fecharDrop();
      if (window.tagsClearDefaults) window.tagsClearDefaults();
    };

  })(); // ── fim initRamoAutocomplete ──────────────────────────

  /* ──────────────────────────────────────────────────────────
     TAGS DE BUSCA — caixa de balões (chips)
     ----------------------------------------------------------
     Sementes vindas de CAT_DEF[].busca da categoria escolhida.
     Os chips sincronizam SEMPRE para #f-tags (textarea oculto),
     que é o que o FormData do cadastro envia ao servidor — sem
     alterar nem o submit nem o backend.
     • Chip "padrão" (veio da categoria) tem visual neutro.
     • Chip "manual" (digitado) tem visual âmbar.
     • Trocar de ramo: recarrega os padrões e PRESERVA os manuais.
     • Enter ou vírgula adiciona; ✕ remove; teto de 20; dedupe.
     ────────────────────────────────────────────────────────── */
  (function initTagChips() {
    const box     = document.getElementById('f-tags-box');
    const chipsEl = document.getElementById('f-tags-chips');
    const inputEl = document.getElementById('f-tags-input');
    const hidden  = document.getElementById('f-tags'); // textarea oculto (name="tags")
    if (!box || !chipsEl || !inputEl || !hidden) return;

    const MAX_TAGS = 20;
    const MAX_LEN  = 28;

    // Normaliza p/ comparação (dedupe): minúsculas, sem acento, espaços colapsados.
    function norm(s) {
      return String(s).toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ').trim();
    }
    // Limpa o texto exibido no chip (preserva acentos, corta tamanho).
    function limpar(s) {
      return String(s).replace(/[,\n\r]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_LEN);
    }

    // Estado: cada tag = { texto, isDefault }
    let tags = [];

    function sincronizarHidden() {
      hidden.value = tags.map(t => t.texto).join(', ');
    }

    function jaExiste(txt) {
      const n = norm(txt);
      return tags.some(t => norm(t.texto) === n);
    }

    function atualizarEstadoCaixa() {
      const cheio = tags.length >= MAX_TAGS;
      box.classList.toggle('is-full', cheio);
      inputEl.disabled = cheio;
      inputEl.placeholder = cheio
        ? `Máximo de ${MAX_TAGS} tags atingido`
        : (tags.length ? 'Adicionar outra…' : 'Digite e tecle Enter (ex: açaí, marmita...)');
    }

    function render() {
      chipsEl.innerHTML = '';
      tags.forEach((t, i) => {
        const chip = document.createElement('span');
        chip.className = 'tag-chip' + (t.isDefault ? ' is-default' : '');
        const txt = document.createElement('span');
        txt.className = 'tag-chip-txt';
        txt.textContent = t.texto;
        const x = document.createElement('button');
        x.type = 'button';
        x.className = 'tag-chip-x';
        x.setAttribute('aria-label', 'Remover ' + t.texto);
        x.textContent = '✕';
        x.addEventListener('click', (e) => { e.stopPropagation(); removerIdx(i); });
        chip.appendChild(txt);
        chip.appendChild(x);
        chipsEl.appendChild(chip);
      });
      atualizarEstadoCaixa();
      sincronizarHidden();
    }

    function adicionar(textoRaw, isDefault) {
      const texto = limpar(textoRaw);
      if (!texto) return false;
      if (tags.length >= MAX_TAGS) return false;
      if (jaExiste(texto)) return false;
      tags.push({ texto, isDefault: !!isDefault });
      return true;
    }

    function removerIdx(i) {
      tags.splice(i, 1);
      render();
    }

    // Processa o que está no input (Enter/vírgula/blur). Aceita vários separados por vírgula.
    function consumirInput() {
      const partes = inputEl.value.split(',');
      let mudou = false;
      partes.forEach(p => { if (adicionar(p, false)) mudou = true; });
      inputEl.value = '';
      if (mudou) render();
      else atualizarEstadoCaixa();
    }

    /* ── API pública (chamada pelo combobox de ramo) ───────── */
    // Injeta as tags padrão da categoria; preserva tags manuais já digitadas
    // e remove as tags-padrão de uma categoria anterior.
    window.tagsInjectDefaults = function (slug) {
      // Mantém só os chips manuais (digitados pela pessoa)
      tags = tags.filter(t => !t.isDefault);
      if (slug) {
        const def = (typeof CAT_DEF !== 'undefined')
          ? CAT_DEF.find(c => c.id === slug)
          : null;
        const sementes = (def && Array.isArray(def.busca)) ? def.busca : [];
        sementes.forEach(s => adicionar(s, true)); // adicionar() já dedupa contra os manuais
      }
      render();
    };

    // Limpa tudo (usado no ramoReset / fechar modal de cadastro)
    window.tagsClearDefaults = function () {
      tags = [];
      inputEl.value = '';
      render();
    };

    /* ── Eventos ───────────────────────────────────────────── */
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        consumirInput();
      } else if (e.key === 'Backspace' && inputEl.value === '' && tags.length) {
        // Backspace com input vazio remove o último chip
        removerIdx(tags.length - 1);
      }
    });
    // Vírgula digitada/colada também separa
    inputEl.addEventListener('input', () => {
      if (inputEl.value.includes(',')) consumirInput();
    });
    inputEl.addEventListener('blur', () => {
      box.classList.remove('is-focused');
      if (inputEl.value.trim()) consumirInput();
    });
    inputEl.addEventListener('focus', () => box.classList.add('is-focused'));
    // Clicar em qualquer ponto da caixa foca o input
    box.addEventListener('click', () => { if (!inputEl.disabled) inputEl.focus(); });

    render(); // estado inicial vazio
  })(); // ── fim initTagChips ──────────────────────────────────

  /* ══════════════════════════════════════════════════════════════
     MINHA LOJA — Edição de informações (nome, telefone, endereço,
     descrição, tags, horário). UI inline com leitura→edição.
     Cada save chama um endpoint dedicado do GAS.
  ══════════════════════════════════════════════════════════════ */
  (function initMlInfoEditor() {
    const DIAS_LBL = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

    // Estado dos dados atuais da loja (preenchido por mlRenderInfo)
    let cur = {};
    // Flag: há um editor de campo aberto? Bloqueia re-render (evita perder edição
    // quando os dados frescos da API chegam logo após o cache — race condition).
    let editando = false;

    // Helpers locais ----------------------------------------------------
    function el(id) { return document.getElementById(id); }
    // Persiste o cur atualizado no cache local, para que ao reabrir o painel
    // o valor editado já apareça (evita piscar o valor antigo até o fetch).
    function persistirCache() {
      try {
        const c = JSON.parse(localStorage.getItem('angatuba_loja_dados') || 'null');
        if (c) {
          // Sincroniza só os campos que o painel edita
          ['nome','tel','endereco','horario','tags','obs','bairro'].forEach(function (k) {
            if (cur[k] !== undefined) c[k] = cur[k];
          });
          localStorage.setItem('angatuba_loja_dados', JSON.stringify(c));
        }
      } catch (e) { /* cache é só otimização — falha silenciosa */ }
    }
    function fmtTel(d) {
      d = String(d || '').replace(/\D/g, '');
      if (!d) return '';
      if (d.length <= 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
      return `(${d.slice(0,2)}) ${d.slice(2,3)} ${d.slice(3,7)}-${d.slice(7)}`;
    }

    // ── Render principal: monta as linhas de info ─────────────────────
    window.mlRenderInfo = function (d) {
      // Se o usuário está editando um campo, NÃO re-renderiza (perderia a edição).
      // Apenas atualiza os dados de fundo para refletir os valores frescos da API
      // nos campos que NÃO estão sendo editados (visíveis na próxima vez que abrir).
      if (editando) {
        if (d) {
          // Preserva o objeto cur (mesma referência) mesclando os campos novos
          Object.keys(d).forEach(function (k) { cur[k] = d[k]; });
        }
        return;
      }
      cur = d || {};
      const list = el('ml-info-list');
      if (!list) return;

      const rows = [
        { key:'nome',      icon:'fa-store',        label:'Nome da loja',  val: cur.nome || '',                empty:'Sem nome' },
        { key:'telefone',  icon:'fa-phone',        label:'Telefone fixo', val: fmtTel(cur.tel),               empty:'Não informado' },
        { key:'endereco',  icon:'fa-location-dot', label:'Endereço',      val: cur.endereco || '',            empty:'Não informado' },
        { key:'horario',   icon:'fa-clock',        label:'Horário',       val: cur.horario || '',             empty:'Não informado' },
        { key:'tags',      icon:'fa-magnifying-glass', label:'Tags de busca', val: cur.tags || '',            empty:'Nenhuma palavra-chave' },
        { key:'descricao', icon:'fa-align-left',   label:'Descrição',     val: cur.obs || '',                 empty:'Sem descrição' },
      ];

      list.innerHTML = rows.map(function (r) {
        const isEmpty = !r.val;
        const shown = isEmpty ? r.empty : escHTML(r.val);
        return `
        <div class="ml-info-row" id="ml-info-row-${r.key}">
          <div class="ml-info-icon"><i class="fa ${r.icon}"></i></div>
          <div class="ml-info-body">
            <div class="ml-info-label">${r.label}</div>
            <div class="ml-info-value${isEmpty ? ' is-empty' : ''}" id="ml-info-val-${r.key}">${shown}</div>
          </div>
          <button class="ml-info-edit-btn" aria-label="Editar ${r.label}" onclick="mlEditField('${r.key}')">
            <i class="fa fa-pen"></i>
          </button>
        </div>`;
      }).join('');
    };

    // ── Fecha o editor: zera a flag e re-renderiza ────────────────────
    // Usado por Cancelar e após salvar com sucesso.
    // keyDestaque (opcional): chave do campo salvo, para flash de confirmação.
    window.mlFecharEditor = function (d, keyDestaque) {
      editando = false;
      window.mlRenderInfo(d || cur);
      if (keyDestaque) {
        const row = el('ml-info-row-' + keyDestaque);
        if (row) {
          row.classList.add('salvou');
          setTimeout(function () { row.classList.remove('salvou'); }, 1100);
        }
      }
    };

    // ── Entra em modo edição de um campo ──────────────────────────────
    window.mlEditField = function (key) {
      const row = el('ml-info-row-' + key);
      if (!row) return;
      editando = true; // bloqueia re-render enquanto edita

      if (key === 'tags')     return abrirEditorTags(row);
      if (key === 'horario')  return abrirEditorHorario(row);
      if (key === 'endereco') return abrirEditorEndereco(row);

      // Campos simples: nome, telefone, descrição
      const cfg = {
        nome:      { label:'Nome da loja',  ph:'Nome da sua loja',          max:60,  multiline:false, val: cur.nome || '' },
        telefone:  { label:'Telefone fixo', ph:'(15) 3255-0000',            max:16,  multiline:false, val: fmtTel(cur.tel), tel:true },
        descricao: { label:'Descrição',     ph:'Ex: Hambúrguer artesanal na chapa, massa de pizza fermentada 48h…', max:200, multiline:true, val: cur.obs || '',
                     hint:'Conte o diferencial da sua loja — não repita as palavras-chave de busca. É o texto que aparece no seu anúncio.' },
      }[key];
      if (!cfg) return;

      const inputHTML = cfg.multiline
        ? `<textarea class="ml-info-input" id="ml-info-edit-input" maxlength="${cfg.max}" placeholder="${escAttr(cfg.ph)}" rows="3">${escHTML(cfg.val)}</textarea>`
        : `<input type="${cfg.tel ? 'tel' : 'text'}" class="ml-info-input" id="ml-info-edit-input" maxlength="${cfg.max}" placeholder="${escAttr(cfg.ph)}" value="${escAttr(cfg.val)}" ${cfg.tel ? 'inputmode="numeric"' : ''}/>`;

      row.innerHTML = `
        <div class="ml-info-icon"><i class="fa fa-pen"></i></div>
        <div class="ml-info-editor">
          <div class="ml-info-label">${cfg.label}</div>
          ${inputHTML}
          ${cfg.hint ? `<div class="ml-info-hint">${escHTML(cfg.hint)}</div>` : ''}
          <div class="ml-info-actions">
            <button class="ml-info-btn ml-info-btn-cancel" onclick="mlFecharEditor()">Cancelar</button>
            <button class="ml-info-btn ml-info-btn-save" id="ml-info-save-btn" onclick="mlSaveField('${key}')">Salvar</button>
          </div>
          <div class="ml-info-msg" id="ml-info-msg"></div>
        </div>`;

      const inp = el('ml-info-edit-input');
      if (inp) {
        inp.focus();
        if (cfg.tel) inp.addEventListener('input', function () { inp.value = mascararWppBR(inp.value); });
      }
    };
    // Guarda referência para o cancelar reconstruir
    Object.defineProperty(window, '_mlInfoCur', { get: function () { return cur; }, configurable: true });

    // ── Salva campo simples ───────────────────────────────────────────
    window.mlSaveField = async function (key) {
      const inp = el('ml-info-edit-input');
      const msg = el('ml-info-msg');
      const btn = el('ml-info-save-btn');
      if (!inp) return;
      const raw = inp.value.trim();

      // Validações leves client-side
      if (key === 'nome' && !raw) { if (msg) { msg.textContent = 'O nome não pode ficar vazio.'; msg.style.color = '#ef4444'; } return; }

      const map = {
        // Item 2: ao renomear, propaga o novo nome para todos os pontos que ainda
        // usam nome como referência (global _lojaNome, objeto em LOJAS via wpp,
        // e o cache do localStorage). Assim a renomeação fica consistente na hora,
        // sem esperar o feed público revalidar (cache de até 60s no GAS).
        nome:      { action:'lojaAtualizarNome',      payload:{ nome: raw },                          apply:function(){
                       cur.nome = raw;
                       _lojaNome = raw;
                       try { localStorage.setItem('angatuba_loja_nome', raw); } catch(e) {}
                       // _lojaIdxMap indexa por REFERÊNCIA do objeto (não por nome),
                       // então mutar lj.nome não invalida o índice — basta atualizar o campo.
                       const lj = _mlAcharLojaLocal(cur);
                       if (lj) lj.nome = raw;
                     } },
        telefone:  { action:'lojaAtualizarTelefone',  payload:{ telefone: raw.replace(/\D/g,'') },    apply:function(){ cur.tel = raw.replace(/\D/g,''); } },
        descricao: { action:'lojaAtualizarDescricao', payload:{ descricao: raw },                     apply:function(){ cur.obs = raw; } },
      }[key];
      if (!map) return;

      if (btn) { btn.disabled = true; btn.textContent = 'Salvando…'; }
      try {
        const json = await apiPost(map.action, Object.assign({ token: _lojaToken }, map.payload), { timeout: 10000, ignoreUnauthorized: true });
        if (json.status === 'ok') {
          map.apply();
          persistirCache();
          mlFecharEditor(cur, key);
        } else {
          throw new Error(json.msg || 'Erro');
        }
      } catch (e) {
        if (msg) { msg.textContent = 'Erro ao salvar: ' + e.message; msg.style.color = '#ef4444'; }
        if (btn) { btn.disabled = false; btn.textContent = 'Salvar'; }
      }
    };

    /* ════════════════ TAGS (chips) ════════════════ */
    let tagState = []; // [{texto, isDefault}]

    function normTag(s) {
      return String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();
    }
    function limparTag(s) {
      return String(s).replace(/[,\n\r]/g,' ').replace(/\s+/g,' ').trim().slice(0, 28);
    }

    function abrirEditorTags(row) {
      // Semeia o estado com as tags atuais (todas como "manuais" — já são da loja)
      const atuais = String(cur.tags || '').split(',').map(function(t){return t.trim();}).filter(Boolean);
      tagState = atuais.map(function(t){ return { texto: t, isDefault: false }; });

      // Descobre a categoria da loja p/ oferecer sugestões padrão
      const slug = mlSlugDaLoja();
      const def = (typeof CAT_DEF !== 'undefined' && slug) ? CAT_DEF.find(function(c){ return c.id === slug; }) : null;
      const sementes = (def && Array.isArray(def.busca)) ? def.busca : [];

      row.innerHTML = `
        <div class="ml-info-icon"><i class="fa fa-magnifying-glass"></i></div>
        <div class="ml-info-editor">
          <div class="ml-info-label">Tags de busca</div>
          <div class="tags-box" id="mle-tags-box">
            <div class="tags-chips" id="mle-tags-chips"></div>
            <input type="text" class="tags-input" id="mle-tags-input" placeholder="Adicionar palavra…" autocomplete="off" maxlength="28"/>
          </div>
          ${sementes.length ? `<div class="ml-info-hint" id="mle-tags-sugestoes-wrap"><span style="opacity:.7;">Sugestões da sua categoria:</span> <span id="mle-tags-sugestoes"></span></div>` : ''}
          <div class="ml-info-actions">
            <button class="ml-info-btn ml-info-btn-cancel" onclick="mlFecharEditor()">Cancelar</button>
            <button class="ml-info-btn ml-info-btn-save" id="mle-tags-save" onclick="mlSaveTags()">Salvar</button>
          </div>
          <div class="ml-info-msg" id="mle-tags-msg"></div>
        </div>`;

      renderTagChips();
      renderSugestoes(sementes);

      const inp = el('mle-tags-input');
      if (inp) {
        inp.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); consumirTagInput(); }
          else if (e.key === 'Backspace' && inp.value === '' && tagState.length) { tagState.pop(); renderTagChips(); }
        });
        inp.addEventListener('input', function () { if (inp.value.includes(',')) consumirTagInput(); });
        inp.addEventListener('blur', function () {
          el('mle-tags-box')?.classList.remove('is-focused');
          if (inp.value.trim()) consumirTagInput();
        });
        inp.addEventListener('focus', function () { el('mle-tags-box')?.classList.add('is-focused'); });
      }
      const box = el('mle-tags-box');
      if (box) box.addEventListener('click', function () { if (!inp.disabled) inp.focus(); });
    }

    function tagExiste(txt) {
      const n = normTag(txt);
      return tagState.some(function (t) { return normTag(t.texto) === n; });
    }
    function addTag(raw, isDef) {
      const t = limparTag(raw);
      if (!t) return false;
      if (tagState.length >= 20) return false;
      if (tagExiste(t)) return false;
      tagState.push({ texto: t, isDefault: !!isDef });
      return true;
    }
    function consumirTagInput() {
      const inp = el('mle-tags-input');
      if (!inp) return;
      let mudou = false;
      inp.value.split(',').forEach(function (p) { if (addTag(p, false)) mudou = true; });
      inp.value = '';
      if (mudou) { renderTagChips(); renderSugestoes(); }
    }
    function renderTagChips() {
      const wrap = el('mle-tags-chips');
      if (!wrap) return;
      wrap.innerHTML = '';
      tagState.forEach(function (t, i) {
        const chip = document.createElement('span');
        chip.className = 'tag-chip' + (t.isDefault ? ' is-default' : '');
        const txt = document.createElement('span');
        txt.className = 'tag-chip-txt';
        txt.textContent = t.texto;
        const x = document.createElement('button');
        x.type = 'button'; x.className = 'tag-chip-x'; x.textContent = '✕';
        x.setAttribute('aria-label', 'Remover ' + t.texto);
        x.addEventListener('click', function (e) { e.stopPropagation(); tagState.splice(i, 1); renderTagChips(); renderSugestoes(); });
        chip.appendChild(txt); chip.appendChild(x);
        wrap.appendChild(chip);
      });
      const inp = el('mle-tags-input');
      const cheio = tagState.length >= 20;
      if (inp) { inp.disabled = cheio; inp.placeholder = cheio ? 'Máximo de 20 tags' : 'Adicionar palavra…'; }
    }
    // Sugestões clicáveis (só mostra as que ainda não estão no estado)
    let _sementesCache = [];
    function renderSugestoes(sementes) {
      if (sementes) _sementesCache = sementes;
      const wrap = el('mle-tags-sugestoes');
      if (!wrap) return;
      const disponiveis = _sementesCache.filter(function (s) { return !tagExiste(s); });
      const sugWrap = el('mle-tags-sugestoes-wrap');
      if (!disponiveis.length) { if (sugWrap) sugWrap.style.display = 'none'; return; }
      if (sugWrap) sugWrap.style.display = '';
      // Monta os botões com textContent (sem injeção) e liga via listener (evita
      // quebra se um termo tiver apóstrofo).
      wrap.innerHTML = '';
      disponiveis.forEach(function (s) {
        const b = document.createElement('button');
        b.type = 'button';
        b.style.cssText = 'display:inline-flex;align-items:center;gap:3px;background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.25);color:var(--zap);border-radius:999px;padding:2px 8px;font-size:11px;font-weight:600;cursor:pointer;margin:2px 3px 2px 0;font-family:var(--font-b);';
        b.textContent = '+ ' + s;
        b.addEventListener('click', function () {
          if (addTag(s, true)) { renderTagChips(); renderSugestoes(); }
        });
        wrap.appendChild(b);
      });
    }
    window.mlAddSugestao = function (s) {
      if (addTag(s, true)) { renderTagChips(); renderSugestoes(); }
    };

    window.mlSaveTags = async function () {
      const btn = el('mle-tags-save');
      const msg = el('mle-tags-msg');
      const valor = tagState.map(function (t) { return t.texto; }).join(', ');
      if (btn) { btn.disabled = true; btn.textContent = 'Salvando…'; }
      try {
        const json = await apiPost('lojaAtualizarTags', { token: _lojaToken, tags: valor }, { timeout: 10000, ignoreUnauthorized: true });
        if (json.status === 'ok') {
          cur.tags = json.data && typeof json.data.tags === 'string' ? json.data.tags : valor;
          persistirCache();
          mlFecharEditor(cur, 'tags');
        } else { throw new Error(json.msg || 'Erro'); }
      } catch (e) {
        if (msg) { msg.textContent = 'Erro ao salvar: ' + e.message; msg.style.color = '#ef4444'; }
        if (btn) { btn.disabled = false; btn.textContent = 'Salvar'; }
      }
    };

    /* ════════════════ ENDEREÇO (com autocomplete) ════════════════ */
    let mleAddrRua = '';
    let mleAddrTimer = null;

    function abrirEditorEndereco(row) {
      mleAddrRua = '';
      // Separa rua e número do endereço atual. Ex: "Rua X, 123" → rua "Rua X", num "123".
      // Pega o último trecho após vírgula se for só dígitos; senão deixa tudo na rua.
      let ruaInicial = cur.endereco || '';
      let numInicial = '';
      const mNum = ruaInicial.match(/^(.*),\s*(\d+[A-Za-z]?)\s*$/);
      if (mNum) { ruaInicial = mNum[1].trim(); numInicial = mNum[2].trim(); }
      row.innerHTML = `
        <div class="ml-info-icon"><i class="fa fa-location-dot"></i></div>
        <div class="ml-info-editor">
          <div class="ml-info-label">Endereço</div>
          <div style="display:flex;gap:8px;align-items:flex-start;">
            <div style="flex:1;position:relative;">
              <input type="text" class="ml-info-input" id="mle-addr-rua" placeholder="Digite a rua…" value="${escAttr(ruaInicial)}" autocomplete="off"/>
              <div class="mle-addr-suggestions" id="mle-addr-sugg" style="display:none;"></div>
            </div>
            <input type="text" class="ml-info-input" id="mle-addr-num" placeholder="Nº" inputmode="numeric" value="${escAttr(numInicial)}" style="width:70px;flex-shrink:0;"/>
          </div>
          <div class="ml-info-hint" id="mle-addr-status">📍 Digite ao menos 4 letras para buscar a rua.</div>
          <div class="ml-info-label" style="margin-top:10px;">Bairro</div>
          <select class="ml-info-input" id="mle-addr-bairro" style="cursor:pointer;">
            <option value="">Selecione o bairro…</option>
            ${BAIRROS_ANGATUBA.map(function (b) {
              const sel = (normBairro(b) === normBairro(cur.bairro || '')) ? ' selected' : '';
              return `<option value="${escAttr(b)}"${sel}>${escHTML(b)}</option>`;
            }).join('')}
          </select>
          <div class="ml-info-actions">
            <button class="ml-info-btn ml-info-btn-cancel" onclick="mlFecharEditor()">Cancelar</button>
            <button class="ml-info-btn ml-info-btn-save" id="mle-addr-save" onclick="mlSaveEndereco()">Salvar</button>
          </div>
          <div class="ml-info-msg" id="mle-addr-msg"></div>
        </div>`;

      const inpRua = el('mle-addr-rua');
      const sugg   = el('mle-addr-sugg');
      if (inpRua) {
        inpRua.focus();
        inpRua.addEventListener('input', function () {
          mleAddrRua = ''; // invalida seleção ao digitar
          // Item 10: mudou o texto → reseta o estado de confirmação de endereço livre.
          _mleEndConfirmarLivre = false;
          const btnS = el('mle-addr-save'); if (btnS && !btnS.disabled) btnS.textContent = 'Salvar';
          const q = inpRua.value.trim();
          if (mleAddrTimer) clearTimeout(mleAddrTimer);
          if (q.length < 4) { if (sugg) sugg.style.display = 'none'; return; }
          mleAddrTimer = setTimeout(function () { mleBuscarEndereco(q); }, 500);
        });
      }
    }

    async function mleBuscarEndereco(query) {
      const sugg = el('mle-addr-sugg');
      const status = el('mle-addr-status');
      if (status) status.textContent = '🔎 Buscando…';
      try {
        const headers = { 'Accept-Language': 'pt-BR', 'User-Agent': 'AngatubaON/1.0' };
        const url = 'https://nominatim.openstreetmap.org/search?q=' +
          encodeURIComponent(query + ', Angatuba, SP, Brasil') +
          '&format=json&limit=5&countrycodes=br&addressdetails=1&accept-language=pt-BR';
        const resp = await fetch(url, { headers: headers, signal: AbortSignal.timeout(8000) });
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        let items = await resp.json();
        // Fallback: amplia a busca se nada vier (mesma estratégia do cadastro)
        if (!items.length) {
          const url2 = 'https://nominatim.openstreetmap.org/search?q=' +
            encodeURIComponent(query + ', São Paulo, Brasil') +
            '&format=json&limit=5&countrycodes=br&accept-language=pt-BR';
          const resp2 = await fetch(url2, { headers: headers, signal: AbortSignal.timeout(8000) });
          if (resp2.ok) items = await resp2.json();
        }
        if (!sugg) return;
        if (!items.length) {
          sugg.innerHTML = '<div class="mle-addr-item" style="cursor:default;color:var(--muted);">Nenhum endereço encontrado.</div>';
          sugg.style.display = 'block';
          if (status) status.textContent = '📍 Tente ser mais específico ou digite manualmente.';
          return;
        }
        sugg.innerHTML = items.map(function (it) {
          const parts = it.display_name.split(', ');
          const rua = parts[0];
          const sub = parts.slice(2, 4).join(', ');
          return `<div class="mle-addr-item" data-rua="${escAttr(rua)}">
            <i class="fa fa-map-marker-alt"></i>
            <div><div>${escHTML(rua)}</div>${sub ? `<div class="mle-addr-item-sub">${escHTML(sub)}</div>` : ''}</div>
          </div>`;
        }).join('');
        sugg.querySelectorAll('.mle-addr-item').forEach(function (elItem) {
          if (!elItem.dataset.rua) return;
          elItem.addEventListener('click', function () {
            mleAddrRua = elItem.dataset.rua;
            el('mle-addr-rua').value = mleAddrRua;
            sugg.style.display = 'none';
            // Item 10: seleção confirmada no mapa → limpa estado de confirmação livre.
            _mleEndConfirmarLivre = false;
            const btnS = el('mle-addr-save'); if (btnS && !btnS.disabled) btnS.textContent = 'Salvar';
            const msgE = el('mle-addr-msg'); if (msgE) { msgE.textContent = ''; }
            if (status) { status.textContent = '✅ Rua confirmada — adicione o número ao lado.'; }
            el('mle-addr-num')?.focus();
          });
        });
        sugg.style.display = 'block';
      } catch (e) {
        if (status) status.textContent = '⚠️ Erro na busca. Você pode digitar o endereço manualmente.';
      }
    }

    // Item 10: guarda o estado "endereço digitado à mão, sem confirmar no mapa".
    // Se o lojista não escolheu uma sugestão do autocomplete, o backend gera o link
    // do Maps por busca textual — que pode cair no lugar errado. Em vez de salvar
    // silenciosamente, exigimos um segundo toque de confirmação (sem confirm() nativo,
    // pra não quebrar o tema dark — o próprio botão vira o aviso).
    let _mleEndConfirmarLivre = false;

    window.mlSaveEndereco = async function () {
      const inpRua = el('mle-addr-rua');
      const inpNum = el('mle-addr-num');
      const selBairro = el('mle-addr-bairro');
      const msg = el('mle-addr-msg');
      const btn = el('mle-addr-save');
      if (!inpRua) return;
      // Usa a rua selecionada se houver; senão o texto digitado (permite endereço manual)
      const ruaBase = mleAddrRua || inpRua.value.trim();
      if (!ruaBase) { if (msg) { msg.textContent = 'Informe o endereço.'; msg.style.color = '#ef4444'; _mleEndConfirmarLivre = false; return; } return; }

      // Item 10: endereço não veio de uma sugestão do mapa → confirma antes de salvar.
      const enderecoNaoConfirmado = !mleAddrRua;
      if (enderecoNaoConfirmado && !_mleEndConfirmarLivre) {
        _mleEndConfirmarLivre = true;
        if (msg) {
          msg.innerHTML = '⚠️ Não confirmamos esse endereço no mapa — o link de "como chegar" pode ficar impreciso. Toque em <b>Salvar assim mesmo</b> para continuar, ou escolha uma sugestão da lista.';
          msg.style.color = 'var(--zap)';
        }
        if (btn) { btn.textContent = 'Salvar assim mesmo'; }
        return;
      }

      const num = (inpNum?.value || '').trim();
      const endFull = num ? (ruaBase + ', ' + num) : ruaBase;
      const bairro = selBairro ? selBairro.value : '';

      if (btn) { btn.disabled = true; btn.textContent = 'Salvando…'; }
      try {
        const json = await apiPost('lojaAtualizarEndereco', { token: _lojaToken, endereco: endFull, bairro: bairro }, { timeout: 10000, ignoreUnauthorized: true });
        if (json.status === 'ok') {
          cur.endereco = endFull;
          cur.bairro = bairro;
          _mleEndConfirmarLivre = false;
          persistirCache();
          mlFecharEditor(cur, 'endereco');
        } else { throw new Error(json.msg || 'Erro'); }
      } catch (e) {
        if (msg) { msg.textContent = 'Erro ao salvar: ' + e.message; msg.style.color = '#ef4444'; }
        if (btn) { btn.disabled = false; btn.textContent = _mleEndConfirmarLivre ? 'Salvar assim mesmo' : 'Salvar'; }
      }
    };

    /* ════════════════ HORÁRIO (turnos) ════════════════ */
    let mleTurnos = []; // [{dias:[...], abre, fecha}]

    const MLE_PRESET_DIAS = {
      semana:     [1,2,3,4,5],
      semana_sab: [1,2,3,4,5,6],
      todos:      [0,1,2,3,4,5,6],
    };

    function abrirEditorHorario(row) {
      // Tenta parsear o horarioTexto atual.
      const parsed = mleParseHorario(cur.horario);
      // Se NÃO conseguiu parsear mas HAVIA um horário salvo, não assume Seg-Sex
      // silenciosamente (sobrescreveria o horário real). Avisa e começa vazio.
      const horarioSalvoNaoReconhecido = !parsed && !!String(cur.horario || '').trim();
      // Item 9: se havia horário salvo mas o formato não foi reconhecido, NÃO semeia
      // Seg-Sex 08-18 (o lojista poderia salvar sem reparar e sobrescrever o horário
      // real por um genérico). Começa com um turno de DIAS VAZIOS: os cards aparecem
      // sem nenhum dia marcado, o preview pede "selecione um dia" e o mlSaveHorario
      // bloqueia salvar enquanto não houver dia+horário escolhidos de fato.
      // Só quando não há horário nenhum (loja nova) usamos o default de conveniência.
      mleTurnos = parsed
        ? parsed
        : (horarioSalvoNaoReconhecido
            ? [{ dias:[], abre:'08:00', fecha:'18:00' }]
            : [{ dias:[1,2,3,4,5], abre:'08:00', fecha:'18:00' }]);

      row.innerHTML = `
        <div class="ml-info-icon"><i class="fa fa-clock"></i></div>
        <div class="ml-info-editor">
          <div class="ml-info-label">Horário de funcionamento</div>
          ${horarioSalvoNaoReconhecido ? `<div class="ml-info-msg" style="color:var(--zap);margin:0 0 8px;">⚠️ Seu horário atual ("${escHTML(String(cur.horario).slice(0,40))}") está num formato antigo. Monte abaixo para atualizar.</div>` : ''}
          <div class="mle-sched-presets">
            <button type="button" class="mle-sched-preset" data-preset="semana" onclick="mlSchedPreset('semana')">📅 Seg a Sex</button>
            <button type="button" class="mle-sched-preset" data-preset="semana_sab" onclick="mlSchedPreset('semana_sab')">📅 Seg a Sáb</button>
            <button type="button" class="mle-sched-preset" data-preset="todos" onclick="mlSchedPreset('todos')">🗓️ Todos os dias</button>
            <button type="button" class="mle-sched-preset" data-preset="custom" onclick="mlSchedPreset('custom')">✏️ Personalizar</button>
          </div>
          <div id="mle-sched-cards"></div>
          <button type="button" class="mle-sched-add" id="mle-sched-add" onclick="mlSchedAddTurno()" style="display:none;"><i class="fa fa-plus"></i> Adicionar turno diferente</button>
          <div class="ml-info-hint" id="mle-sched-preview"></div>
          <div class="ml-info-actions">
            <button class="ml-info-btn ml-info-btn-cancel" onclick="mlFecharEditor()">Cancelar</button>
            <button class="ml-info-btn ml-info-btn-save" id="mle-sched-save" onclick="mlSaveHorario()">Salvar</button>
          </div>
          <div class="ml-info-msg" id="mle-sched-msg"></div>
        </div>`;

      mleRenderCards();
      mleMarcarPreset();
    }

    // Parse "Seg, Ter 08:00-18:00 | Sáb 08:00-12:00" → [{dias,abre,fecha}]
    // Tolerante: aceita acento ou não (Sáb/Sab), separador vírgula OU hífen (Seg-Sex).
    function mleParseHorario(txt) {
      if (!txt) return null;
      try {
        // Normaliza acentos para casar "Sab"/"Sáb", "Ter"/"Têr" etc.
        const semAcento = function (s) {
          return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        };
        const LBL_NORM = DIAS_LBL.map(semAcento); // ['Dom','Seg',...,'Sab']
        const blocos = String(txt).split('|').map(function (b) { return b.trim(); }).filter(Boolean);
        const turnos = [];
        blocos.forEach(function (bl) {
          const m = bl.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
          if (!m) return;
          const abre = m[1].padStart(5, '0');
          const fecha = m[2].padStart(5, '0');
          const diasParte = semAcento(bl.slice(0, m.index).trim());
          let dias = [];

          // Caso 1: range com hífen entre dois dias (ex: "Seg-Sex", "Seg - Sab")
          const rangeMatch = diasParte.match(new RegExp('(' + LBL_NORM.join('|') + ')\\s*[-–]\\s*(' + LBL_NORM.join('|') + ')', 'i'));
          if (rangeMatch) {
            const ini = LBL_NORM.findIndex(function (l) { return l.toLowerCase() === rangeMatch[1].toLowerCase(); });
            const fim = LBL_NORM.findIndex(function (l) { return l.toLowerCase() === rangeMatch[2].toLowerCase(); });
            if (ini >= 0 && fim >= 0 && fim >= ini) {
              for (let d = ini; d <= fim; d++) dias.push(d);
            }
          }
          // Caso 2 (ou complemento): dias listados individualmente
          if (!dias.length) {
            LBL_NORM.forEach(function (lbl, idx) {
              const re = new RegExp('(^|[,\\s])' + lbl + '([,\\s]|$)', 'i');
              if (re.test(diasParte)) dias.push(idx);
            });
          }
          if (dias.length) {
            // Remove duplicatas e ordena
            dias = dias.filter(function (v, i, a) { return a.indexOf(v) === i; }).sort(function (a, b) { return a - b; });
            turnos.push({ dias: dias, abre: abre, fecha: fecha });
          }
        });
        return turnos.length ? turnos : null;
      } catch (e) { return null; }
    }

    window.mlSchedPreset = function (preset) {
      if (preset === 'custom') {
        // Modo livre: mostra botão de adicionar turno, mantém turnos atuais
        el('mle-sched-add').style.display = '';
        mleMarcarPreset('custom');
        return;
      }
      mleTurnos = [{ dias: MLE_PRESET_DIAS[preset].slice(), abre: mleTurnos[0]?.abre || '08:00', fecha: mleTurnos[0]?.fecha || '18:00' }];
      el('mle-sched-add').style.display = 'none';
      mleRenderCards();
      mleMarcarPreset(preset);
    };

    function mleMarcarPreset(forcado) {
      let presetAtivo = forcado || null;
      if (!presetAtivo) {
        // Detecta preset pelos dias do turno único
        if (mleTurnos.length === 1) {
          const ds = mleTurnos[0].dias.slice().sort().join(',');
          if (ds === '1,2,3,4,5') presetAtivo = 'semana';
          else if (ds === '1,2,3,4,5,6') presetAtivo = 'semana_sab';
          else if (ds === '0,1,2,3,4,5,6') presetAtivo = 'todos';
          else presetAtivo = 'custom';
        } else {
          presetAtivo = 'custom';
        }
      }
      document.querySelectorAll('.mle-sched-preset').forEach(function (b) {
        b.classList.toggle('active', b.dataset.preset === presetAtivo);
      });
      if (presetAtivo === 'custom') el('mle-sched-add').style.display = '';
      mleAtualizarPreview();
    }

    window.mlSchedAddTurno = function () {
      mleTurnos.push({ dias: [6], abre: '08:00', fecha: '12:00' });
      mleRenderCards();
      mleAtualizarPreview();
    };

    function mleRenderCards() {
      const wrap = el('mle-sched-cards');
      if (!wrap) return;
      wrap.innerHTML = '';
      mleTurnos.forEach(function (turno, idx) {
        const card = document.createElement('div');
        card.className = 'mle-sched-card';

        const title = document.createElement('div');
        title.className = 'mle-sched-card-title';
        title.textContent = idx === 0 ? 'Dias e horário' : 'Turno adicional';
        card.appendChild(title);

        const daysRow = document.createElement('div');
        daysRow.className = 'mle-sched-days';
        DIAS_LBL.forEach(function (lbl, d) {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'mle-sched-day' + (turno.dias.includes(d) ? ' active' : '');
          b.textContent = lbl;
          b.addEventListener('click', function () {
            const di = turno.dias.indexOf(d);
            if (di >= 0) turno.dias.splice(di, 1); else turno.dias.push(d);
            b.classList.toggle('active');
            mleMarcarPreset();
          });
          daysRow.appendChild(b);
        });
        card.appendChild(daysRow);

        const times = document.createElement('div');
        times.className = 'mle-sched-times';
        const inA = document.createElement('input');
        inA.type = 'time'; inA.value = turno.abre;
        inA.addEventListener('change', function () { turno.abre = inA.value; mleAtualizarPreview(); });
        const sep = document.createElement('span'); sep.textContent = 'até';
        const inF = document.createElement('input');
        inF.type = 'time'; inF.value = turno.fecha;
        inF.addEventListener('change', function () { turno.fecha = inF.value; mleAtualizarPreview(); });
        times.appendChild(inA); times.appendChild(sep); times.appendChild(inF);
        card.appendChild(times);

        if (idx > 0) {
          const rm = document.createElement('button');
          rm.type = 'button'; rm.className = 'mle-sched-remove';
          rm.innerHTML = '<i class="fa fa-times"></i>';
          rm.addEventListener('click', function () { mleTurnos.splice(idx, 1); mleRenderCards(); mleMarcarPreset(); });
          card.appendChild(rm);
        }
        wrap.appendChild(card);
      });
      mleAtualizarPreview();
    }

    function mleMontarTexto() {
      return mleTurnos.map(function (t) {
        if (!t.dias.length) return null;
        const nomes = t.dias.slice().sort(function (a, b) { return a - b; }).map(function (d) { return DIAS_LBL[d]; }).join(', ');
        return nomes + ' ' + t.abre + '-' + t.fecha;
      }).filter(Boolean).join(' | ');
    }
    function mleMontarDias() {
      return mleTurnos.flatMap(function (t) { return t.dias; })
        .filter(function (v, i, a) { return a.indexOf(v) === i; })
        .sort(function (a, b) { return a - b; }).join(',');
    }
    function mleAtualizarPreview() {
      const pv = el('mle-sched-preview');
      if (!pv) return;
      const txt = mleMontarTexto();
      pv.textContent = txt ? ('Resumo: ' + txt) : 'Selecione pelo menos um dia.';
    }

    window.mlSaveHorario = async function () {
      const btn = el('mle-sched-save');
      const msg = el('mle-sched-msg');
      const texto = mleMontarTexto();
      if (!texto) { if (msg) { msg.textContent = 'Selecione ao menos um dia e horário.'; msg.style.color = '#ef4444'; } return; }
      if (btn) { btn.disabled = true; btn.textContent = 'Salvando…'; }
      try {
        const json = await apiPost('lojaAtualizarHorario', { token: _lojaToken, horario: texto, dias: mleMontarDias() }, { timeout: 10000, ignoreUnauthorized: true });
        if (json.status === 'ok') {
          cur.horario = texto;
          persistirCache();
          mlFecharEditor(cur, 'horario');
        } else { throw new Error(json.msg || 'Erro'); }
      } catch (e) {
        if (msg) { msg.textContent = 'Erro ao salvar: ' + e.message; msg.style.color = '#ef4444'; }
        if (btn) { btn.disabled = false; btn.textContent = 'Salvar'; }
      }
    };

    /* ── Descobre o slug da categoria da loja (p/ sugestões de tags) ── */
    function mlSlugDaLoja() {
      // 1) tenta pela lista LOJAS (já tem categoria mapeada)
      // Item 2: junção por WhatsApp (estável a renomeações), não por nome.
      const lj = _mlAcharLojaLocal(cur);
      if (lj && lj.categoria) return lj.categoria;
      // 2) tenta casar o ramo textual contra os ramoLabel de CAT_DEF
      if (typeof CAT_DEF !== 'undefined' && cur.ramo) {
        const rn = String(cur.ramo).toLowerCase();
        const hit = CAT_DEF.find(function (c) {
          return String(c.ramoLabel || '').toLowerCase() === rn ||
                 String(c.chipLabel || '').toLowerCase() === rn ||
                 (Array.isArray(c.busca) && c.busca.some(function (b) { return rn.includes(String(b).toLowerCase()); }));
        });
        if (hit) return hit.id;
      }
      return '';
    }

  // ── Acordeão das "Informações da loja" ────────────────────
  // Alterna a visibilidade do corpo (#ml-info-body) e gira a seta.
  // forcar (opcional): true = abrir, false = fechar; ausente = alterna.
  window.mlToggleInfoSection = function (forcar) {
    const body = document.getElementById('ml-info-body');
    const chev = document.getElementById('ml-info-chev');
    const hdr  = document.getElementById('ml-info-header');
    if (!body) return;
    const estaAberto = body.style.display !== 'none';
    const abrir = (typeof forcar === 'boolean') ? forcar : !estaAberto;
    body.style.display = abrir ? '' : 'none';
    if (chev) chev.style.transform = abrir ? 'rotate(180deg)' : 'rotate(0deg)';
    if (hdr)  hdr.setAttribute('aria-expanded', abrir ? 'true' : 'false');
  };

  // Acordeao da secao de grupos de opcoes (mesmo padrao da secao de infos).
  window.mlToggleGruposSection = function (forcar) {
    const body = document.getElementById('ml-grupos-body');
    const chev = document.getElementById('ml-grupos-chev');
    const hdr  = document.getElementById('ml-grupos-header');
    if (!body) return;
    const estaAberto = body.style.display !== 'none';
    const abrir = (typeof forcar === 'boolean') ? forcar : !estaAberto;
    body.style.display = abrir ? '' : 'none';
    if (chev) chev.style.transform = abrir ? 'rotate(180deg)' : 'rotate(0deg)';
    if (hdr)  hdr.setAttribute('aria-expanded', abrir ? 'true' : 'false');
  };

  })(); // ── fim initMlInfoEditor ──────────────────────────────────

  /* ── INIT ────────────────────────────────────────────────── */
  // Stale-while-revalidate: se houver snapshot cacheado válido (24h), renderiza
  // IMEDIATAMENTE — app interativo em ~50ms em vez de esperar o GAS (400–1200ms).
  // carregarLojas() roda em seguida e re-renderiza com dados frescos da rede.
  // Mesmo padrão de _mostrarErroCarregamento: _rebuildIdxMap() ANTES do render,
  // garantindo que os índices embutidos nos cards (onclick=abrirDetalhes(idx)) fiquem corretos.
  let _renderizouDoCache = false;
  (function _renderCacheImediato() {
    try {
      const cached = localStorage.getItem('angatuba_lojas_cache');
      const ts     = parseInt(localStorage.getItem('angatuba_lojas_cache_ts') || '0');
      if (cached && (Date.now() - ts) < 86_400_000) {
        const arr = JSON.parse(cached);
        if (Array.isArray(arr) && arr.length > 0) {
          LOJAS = arr.map(function(l){ return Object.assign({}, l, {
            nome:      l.nome      || '',
            tags:      l.tags      || '',
            sub:       l.sub       || '',
            categoria: l.categoria || 'servicos',
            plano:     (l.plano    || 'GRATIS').toUpperCase(),
            emoji:     l.emoji     || '🏪',
          }); });
          _rebuildIdxMap();
          renderLojas();
          renderCategorias();
          _esconderSplash();   // app já usável; rede atualiza por baixo
          _renderizouDoCache = true;
          if (typeof _migrarFavoritosParaId === 'function') _migrarFavoritosParaId();
          if (typeof _tentarNudgeAposCarga === 'function') _tentarNudgeAposCarga();
        }
      }
    } catch(e) {}
  })();

  // Mostra skeletons enquanto API carrega (só se o cache não pintou nada ainda)
  if (!_renderizouDoCache) {
    showSkeleton();
    showSkeletonCat();
  }

  // Carrega lojas dinâmicas em background
  // ── Saudação noturna (22h–5h) ─────────────────────────────
  function atualizarSaudacaoNoturna() {
    const el = document.getElementById('saudacao-noturna');
    if (!el) return;
    const h = new Date().getHours();
    const ehNoite = (h >= 22 || h < 5);
    el.style.display = ehNoite ? 'flex' : 'none';
    // Igreja Matriz SO na faixa do topo (header-top) — preserva o glass
    // das categorias/pills logo abaixo. Dia (5h-18h) / Noite (22h-5h).
    // Entardecer (18h-22h): fundo escuro normal (zona de transição).
    const _htop = document.querySelector('.header-top');
    if (_htop) {
      const _hh = new Date().getHours();
      const _ehDia    = (_hh >= 5  && _hh < 18);
      const _ehNoite2 = (_hh >= 22 || _hh < 5);
      _htop.classList.toggle('htop-dia',   _ehDia);
      _htop.classList.toggle('htop-noite', _ehNoite2);
    }
    // Tema dia/noite acompanha a foto quando em modo automático.
    if (typeof aplicarTema === 'function') aplicarTema();
  }
  function saudacaoNoturnaFiltrar() {
    const pillAberto = document.querySelector('.pill-btn[data-filter="open"]');
    if (pillAberto) {
      pillAberto.click();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }
  window.saudacaoNoturnaFiltrar = saudacaoNoturnaFiltrar;
  atualizarSaudacaoNoturna();
  // Fix: reavalia a cada minuto para o banner aparecer/sumir sozinho ao cruzar 22h/05h
  // sem precisar recarregar a página.
  setInterval(atualizarSaudacaoNoturna, 60_000);

  carregarLojas().then(() => {
    // Deep link: abre detalhes de loja pelo hash da URL (ex: /#mr-centro-automotivo)
    _resolverDeepLink();
  });

  /* ══════════════════════════════════════════════════════════════
     DEEP LINK — /#slug-da-loja  ou  /#slug-da-loja/cardapio
  ══════════════════════════════════════════════════════════════ */
  // Separa o hash em { slug, cardapio }. Aceita "#loja" e "#loja/cardapio".
  // O slug de loja nunca contém "/" (toSlug troca tudo que não é a-z0-9 por "-"),
  // então a primeira "/" divide com segurança o slug do sufixo de ação.
  function _parseHash() {
    const raw = (location.hash || '').replace(/^#/, '').trim();
    if (!raw) return { slug: '', cardapio: false };
    const barra = raw.indexOf('/');
    if (barra === -1) return { slug: raw, cardapio: false };
    const slug   = raw.slice(0, barra);
    const sufixo = raw.slice(barra + 1).toLowerCase();
    return { slug: slug, cardapio: sufixo === 'cardapio' || sufixo === 'cardápio' };
  }

  function _resolverDeepLink() {
    // Não abre modal de detalhes se outro modal já está aberto
    const modaisAbertos = ['modal-cadastro','modal-planos','modal-login-loja','modal-minha-loja','modal-detalhes'];
    if (modaisAbertos.some(id => document.getElementById(id)?.classList.contains('open'))) return;

    const { slug, cardapio } = _parseHash();
    if (!slug) return;
    const loja = LOJAS.find(l => toSlug(l.nome) === slug);
    if (!loja) return;
    const idx = _lojaIdxMap.get(loja);
    if (idx == null) return;
    // Pequeno delay para garantir que o DOM está pronto
    setTimeout(() => {
      abrirDetalhes(idx);
      // Se o link pede o cardápio E a loja tem itens, abre por cima dos detalhes.
      if (cardapio && loja.cardapio && loja.cardapio.length > 0) {
        setTimeout(() => abrirCardapioCliente(idx), 260);
      }
    }, 200);
  }

  // Também resolve ao navegar pelo histórico (botão voltar/avançar)
  window.addEventListener('hashchange', _resolverDeepLink);

  // Back button Android no PWA — fecha o modal ativo em vez de sair do app
  // Handler único de popstate (botão voltar Android). Ordem importa:
  // cardápio → detalhes → minha-loja → cadastro. Cada return encerra o handler,
  // então um único "voltar" fecha apenas o modal do topo da pilha.
  window.addEventListener('popstate', function() {
    // Lightbox do anúncio (status) vem primeiro: pode estar sobre detalhes/lista
    if (typeof window._fecharAnuncioLightbox === 'function') {
      window._fecharAnuncioLightbox(true); return;
    }
    // Cardápio cliente vem primeiro: pode estar empilhado sobre detalhes
    if (document.getElementById('modal-cardapio-cliente')?.classList.contains('open')) {
      fecharCardapioCliente(true); return;
    }
    // Fecha modal de detalhes se aberto
    if (document.getElementById('modal-detalhes')?.classList.contains('open')) {
      const overlay = document.getElementById('modal-detalhes');
      overlay.classList.remove('open');
      document.body.style.overflow = '';
      if (location.hash) history.replaceState(null, '', location.pathname + location.search);
      return;
    }
    // Fecha painel Minha Loja
    if (document.getElementById('modal-minha-loja')?.classList.contains('open')) {
      fecharMinhaLoja(true); return;
    }
    // Fecha modal de cadastro
    if (document.getElementById('modal-cadastro')?.classList.contains('open')) {
      closeModal(true); return;
    }
  });

  /* ══════════════════════════════════════════════════════════════
     COMPARTILHAMENTO — painel Minha Loja
  ══════════════════════════════════════════════════════════════ */
  window.mlCopiarLink = function() {
    const urlEl = document.getElementById('ml-share-url');
    const btn   = document.getElementById('ml-copy-btn');
    if (!urlEl) return;
    navigator.clipboard.writeText(urlEl.textContent.trim()).then(() => {
      btn.innerHTML = '<i class="fa fa-check"></i> Copiado!';
      btn.style.color = 'var(--green)';
      setTimeout(() => {
        btn.innerHTML = '<i class="fa fa-copy"></i> Copiar';
        btn.style.color = '';
      }, 2000);
    }).catch(() => {
      // Fallback para browsers sem clipboard API
      const tmp = document.createElement('input');
      tmp.value = urlEl.textContent.trim();
      document.body.appendChild(tmp);
      tmp.select();
      document.execCommand('copy');
      document.body.removeChild(tmp);
      btn.innerHTML = '<i class="fa fa-check"></i> Copiado!';
      setTimeout(() => { btn.innerHTML = '<i class="fa fa-copy"></i> Copiar'; }, 2000);
    });
  };

  // Copia o link direto do cardápio (mesma UX do mlCopiarLink, botão próprio).
  window.mlCopiarCardapio = function() {
    const urlEl = document.getElementById('ml-share-cardapio-url');
    const btn   = document.getElementById('ml-copy-cardapio-btn');
    if (!urlEl || !btn) return;
    const texto = urlEl.textContent.trim();
    const feedback = () => {
      btn.innerHTML = '<i class="fa fa-check"></i> Copiado!';
      btn.style.color = 'var(--green)';
      setTimeout(() => { btn.innerHTML = '<i class="fa fa-copy"></i> Copiar'; btn.style.color = ''; }, 2000);
    };
    navigator.clipboard.writeText(texto).then(feedback).catch(() => {
      const tmp = document.createElement('input');
      tmp.value = texto;
      document.body.appendChild(tmp);
      tmp.select();
      document.execCommand('copy');
      document.body.removeChild(tmp);
      feedback();
    });
  };

  function mlMontarCompartilhamento(nome) {
    const slug    = toSlug(nome);
    const url     = `${location.origin}/#${slug}`;
    const urlEl   = document.getElementById('ml-share-url');
    const wppEl   = document.getElementById('ml-share-wpp');
    const igEl    = document.getElementById('ml-share-ig');
    if (urlEl) urlEl.textContent = url;
    if (wppEl) wppEl.href = `https://wa.me/?text=${encodeURIComponent(`Confira ${nome} no AngatubaON! 📍\n${url}`)}`;
    // Usa o handle do Instagram da loja (se disponível), senão abre o app
    const lojaLocal = _mlAcharLojaLocal(null, nome);
    if (igEl) {
      // Item 2: junção por WhatsApp (estável a renomeações); nome é fallback.
      const igHandle  = lojaLocal ? normalizarInstagramHandle(lojaLocal.instagram || '') : '';
      igEl.href = igHandle ? `https://www.instagram.com/${igHandle}` : `https://www.instagram.com/`;
    }
    // Link direto do cardápio: só aparece se a loja tem itens no menu.
    // Usa o sufixo /cardapio que o _resolverDeepLink entende (abre a loja
    // e já sobe o cardápio por cima).
    const cardWrap = document.getElementById('ml-share-cardapio-wrap');
    if (cardWrap) {
      const temCardapio = !!(lojaLocal && Array.isArray(lojaLocal.cardapio) && lojaLocal.cardapio.length > 0);
      if (temCardapio) {
        const urlCard = `${location.origin}/#${slug}/cardapio`;
        const urlCardEl = document.getElementById('ml-share-cardapio-url');
        const wppCardEl = document.getElementById('ml-share-cardapio-wpp');
        if (urlCardEl) urlCardEl.textContent = urlCard;
        if (wppCardEl) wppCardEl.href = `https://wa.me/?text=${encodeURIComponent(`Veja o cardápio de ${nome} no AngatubaON! 📖
${urlCard}`)}`;
        cardWrap.style.display = '';
      } else {
        cardWrap.style.display = 'none';
      }
    }
  }

  /* ══════════════════════════════════════════════════════════════
     GRÁFICO DE PICO — canvas simples, sem lib externa
  ══════════════════════════════════════════════════════════════ */
  function mlRenderizarPico(pico) {
    const canvas = document.getElementById('ml-pico-chart');
    if (!canvas) return;
    const ctx    = canvas.getContext('2d');
    const W      = canvas.offsetWidth || 300;
    const H      = 80;
    canvas.width  = W * window.devicePixelRatio;
    canvas.height = H * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    const max  = Math.max(...pico, 1);
    const barW = W / 24;
    const pad  = 2;

    // Cor do horário atual
    const horaAtual = new Date().getHours();

    pico.forEach((val, h) => {
      const barH   = Math.max(2, (val / max) * (H - 10));
      const x      = h * barW + pad / 2;
      const y      = H - barH;
      const isPico = val === max && val > 0;
      const isNow  = h === horaAtual;

      // Gradiente da barra
      const grad = ctx.createLinearGradient(0, y, 0, H);
      if (isPico) {
        grad.addColorStop(0, '#f59e0b');
        grad.addColorStop(1, 'rgba(245,158,11,0.3)');
      } else if (isNow) {
        grad.addColorStop(0, '#6366f1');
        grad.addColorStop(1, 'rgba(99,102,241,0.3)');
      } else {
        grad.addColorStop(0, 'rgba(255,255,255,0.25)');
        grad.addColorStop(1, 'rgba(255,255,255,0.05)');
      }

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(x, y, barW - pad, barH, [2, 2, 0, 0]);
      ctx.fill();
    });

    // Destaque textual
    const idxPico = pico.indexOf(Math.max(...pico));
    const destaqueEl = document.getElementById('ml-pico-destaque');
    if (destaqueEl) {
      if (Math.max(...pico) === 0) {
        destaqueEl.textContent = 'Nenhum clique registrado nos últimos 30 dias.';
      } else {
        const fmt = h => `${String(h).padStart(2,'0')}h`;
        destaqueEl.innerHTML =
          `🔥 Pico às <strong style="color:#f59e0b;">${fmt(idxPico)}–${fmt(idxPico+1)}</strong> · ${pico[idxPico]} clique${pico[idxPico]>1?'s':''}` +
          `<div style="margin-top:5px;color:var(--muted);font-size:10px;line-height:1.4;">💡 Publique seu anúncio do dia perto das ${fmt(idxPico)} — é quando mais gente vê sua loja.</div>`;
      }
    }
  }
  /* ══════════════════════════════════════════════════════════════
     UPLOAD DE IMAGENS — painel Minha Loja
  ══════════════════════════════════════════════════════════════ */
  // Atualiza preview da logo ou da capa na seção de configurações
  function mlSetPreviewUpload(tipo, url) {
    if (!url) return;
    if (tipo === 'logo') {
      const previewEl = document.getElementById('ml-up-logo-preview');
      if (previewEl) previewEl.innerHTML = `<img src="${url}" style="width:100%;height:100%;object-fit:contain;border-radius:9px;" onerror="this.parentElement.innerHTML='<i class=\\'fa fa-store\\' style=\\'color:var(--border);font-size:1.1rem;\\'></i>'" />`;
    } else {
      const img = document.getElementById('ml-up-foto-preview');
      const ph  = document.getElementById('ml-up-capa-placeholder');
      if (img) { img.src = url; img.style.display = ''; }
      if (ph)  ph.style.display = 'none';
      // Foto JÁ SALVA, só visualização: NÃO ativa edição/drag.
      // Reposicionar só vale quando a pessoa upa/troca a foto (mlUploadImagem).
      // Mantém a posição salva (50% padrão) e deixa o scroll da página livre.
      _mlEditandoCapa = false;
      mlInitCapaDrag(false);
    }
  }

  // Inicializa drag de reposicionamento da capa no painel (chamado após foto ser exibida)
  // Fix #8: estado de posição no escopo pai — listeners são anexados UMA vez só.
  // Antes, o reset (foto nova) zerava o guard e re-anexava window mousemove/mouseup,
  // vazando um par de listeners globais a cada troca de foto.
  let _mlCapaDragInited = false;
  let _mlEditandoCapa = false; // só true após upload/troca — libera arraste e bloqueia scroll
  let _mlPosX = 50, _mlPosY = 50;
  function mlInitCapaDrag(mostrarHint) {
    const capaWrap = document.getElementById('ml-up-capa-wrap');
    const capaImg  = document.getElementById('ml-up-foto-preview');
    const dragHint = document.getElementById('ml-up-capa-drag-hint');
    if (!capaWrap || !capaImg) return;

    // Cursor/hint de arraste SÓ quando em modo edição (foto recém-trocada).
    // Em visualização, cursor normal e sem hint — nada sugere arraste.
    if (capaImg.style.display !== 'none' && _mlEditandoCapa) {
      capaWrap.style.cursor = 'grab';
      if (mostrarHint && dragHint) {
        dragHint.style.display = 'block';
        setTimeout(() => { dragHint.style.display = 'none'; }, 3000);
      }
    } else {
      capaWrap.style.cursor = 'default';
      if (dragHint) dragHint.style.display = 'none';
    }

    if (_mlCapaDragInited) return;
    _mlCapaDragInited = true;

    let dragging = false;
    let startX = 0, startY = 0;

    function applyPos() {
      capaImg.style.objectPosition = `${_mlPosX}% ${_mlPosY}%`;
      // Replica no hero do painel para feedback em tempo real
      const heroImg = document.getElementById('ml-hero-img');
      if (heroImg) heroImg.style.objectPosition = `${_mlPosX}% ${_mlPosY}%`;
    }

    function onStart(cx, cy) {
      // Bloqueio principal: sem modo edição, não inicia arraste algum.
      if (!_mlEditandoCapa) return;
      if (capaImg.style.display === 'none') return;
      dragging = true; startX = cx; startY = cy;
      capaWrap.style.cursor = 'grabbing';
      if (dragHint) dragHint.style.display = 'none';
    }
    function onMove(cx, cy) {
      if (!dragging) return;
      _mlPosX = Math.min(100, Math.max(0, _mlPosX - (cx - startX) * 0.3));
      _mlPosY = Math.min(100, Math.max(0, _mlPosY - (cy - startY) * 0.3));
      startX = cx; startY = cy;
      applyPos();
    }
    function onEnd() { dragging = false; capaWrap.style.cursor = capaImg.style.display !== 'none' ? 'grab' : 'default'; }

    capaWrap.addEventListener('mousedown', e => { if (!e.target.closest('label')) { e.preventDefault(); onStart(e.clientX, e.clientY); } });
    window.addEventListener('mousemove',  e => onMove(e.clientX, e.clientY));
    window.addEventListener('mouseup',    onEnd);
    capaWrap.addEventListener('touchstart', e => { if (!_mlEditandoCapa) return; if (!e.target.closest('label')) { const t=e.touches[0]; onStart(t.clientX, t.clientY); } }, { passive: true });
    capaWrap.addEventListener('touchmove',  e => { if (!dragging) return; e.preventDefault(); const t=e.touches[0]; onMove(t.clientX, t.clientY); }, { passive: false });
    capaWrap.addEventListener('touchend', onEnd);
  }

  // Fix #8: reseta posição da capa para o centro SEM re-anexar listeners.
  function _mlResetCapaPos(mostrarHint) {
    _mlPosX = 50; _mlPosY = 50;
    const capaImg = document.getElementById('ml-up-foto-preview');
    const heroImg = document.getElementById('ml-hero-img');
    if (capaImg) capaImg.style.objectPosition = '50% 50%';
    if (heroImg) heroImg.style.objectPosition = '50% 50%';
    mlInitCapaDrag(mostrarHint); // garante init na 1ª vez; nas seguintes só atualiza cursor/hint
  }

  async function mlUploadImagem(tipo, input) {
    const file = input.files[0];
    if (!file) return;
    const statusEl = document.getElementById(`ml-up-${tipo}-status`);

    // Preview local imediato
    const reader = new FileReader();
    reader.onload = e => {
      if (tipo === 'logo') {
        const previewEl = document.getElementById('ml-up-logo-preview');
        if (previewEl) previewEl.innerHTML = `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:contain;border-radius:9px;" />`;
      } else {
        const img = document.getElementById('ml-up-foto-preview');
        const ph  = document.getElementById('ml-up-capa-placeholder');
        if (img) { img.src = e.target.result; img.style.display = ''; }
        if (ph)  ph.style.display = 'none';
        _mlEditandoCapa = true;   // foto nova: libera arraste de reposicionamento
        mlInitCapaDrag(true);     // foto nova — mostrar hint
      }
    };
    reader.readAsDataURL(file);

    // Item 13: a checagem de tamanho saiu daqui — uploadImagem() redimensiona a
    // imagem antes de validar, então uma foto grande de celular passa a ser aceita
    // (vira poucos KB) em vez de barrada de cara.
    statusEl.textContent = '⏳ Enviando...';
    statusEl.style.color = 'var(--muted)';

    try {
      const url = await uploadImagem(file, statusEl);
      if (!url) return; // uploadImagem já exibiu erro no statusEl

      // Salva URL na planilha
      const campo = tipo === 'logo' ? 'logoUrl' : 'fotoUrl';
      const params = new URLSearchParams();
      params.append('payload', JSON.stringify({
        action: 'lojaAtualizarImagem',
        token:  _lojaToken,
        campo,
        url,
      }));
      const saveResp = await fetch(APPS_SCRIPT_URL, { method:'POST', body:params, signal:AbortSignal.timeout(10000) });
      const saveJson = await saveResp.json();
      if (saveJson.status !== 'ok') throw new Error(saveJson.msg || 'Erro ao salvar');

      // Atualiza hero/logo no painel imediatamente
      if (tipo === 'foto') {
        const heroImg = document.getElementById('ml-hero-img');
        if (heroImg) { heroImg.src = url; heroImg.style.display = ''; }
        // Fix #8: reseta posição sem re-anexar listeners globais (evita vazamento)
        _mlResetCapaPos(true);
      } else {
        const logoImg = document.getElementById('ml-logo-img');
        const emojiEl = document.getElementById('ml-emoji');
        if (logoImg) { logoImg.src = url; logoImg.style.display = ''; }
        if (emojiEl) emojiEl.style.display = 'none';
      }

      statusEl.textContent = '✅ Salvo!';
      statusEl.style.color = 'var(--green)';
      setTimeout(() => { statusEl.textContent = ''; }, 3000);
    } catch(e) {
      statusEl.textContent = '❌ ' + e.message;
      statusEl.style.color = 'var(--red)';
    }
  }

  /* ══════════════════════════════════════════════════════════════
     ANÚNCIO DO DIA — painel Minha Loja
  ══════════════════════════════════════════════════════════════ */
  let _anuncioEmojiSelecionado = '🎯';
  let _anuncioImagemUrl = ''; // URL final após upload (Pro)
  let _anuncioMidiaTipo = 'foto'; // 'foto' | 'video' — tipo da mídia selecionada (Pro)
  let _mlStoriesCache = []; // Fase 2: stories atuais do painel (Pro)
  let _anuncioTimerInterval = null; // Item 17: handle do setInterval do contador de expiração

  // Garante um <video> de preview ao lado do <img> de preview. Criado sob
  // demanda para não mexer no HTML. Reutiliza o mesmo espaço visual.
  function _mlAnuncioVideoPreviewEl() {
    var v = document.getElementById('ml-anuncio-video-nova');
    if (v) return v;
    var img = document.getElementById('ml-anuncio-img-nova');
    if (!img || !img.parentNode) return null;
    v = document.createElement('video');
    v.id = 'ml-anuncio-video-nova';
    v.setAttribute('playsinline', ''); v.setAttribute('webkit-playsinline', '');
    v.muted = true; v.loop = true; v.controls = true; v.preload = 'metadata';
    v.style.cssText = 'display:none;width:100%;max-height:140px;object-fit:cover;border-radius:8px;margin-top:8px;border:1px solid var(--border);';
    img.parentNode.insertBefore(v, img.nextSibling);
    return v;
  }

  function mlAnuncioPreviewImagem(input) {
    const file = input.files[0];
    if (!file) return;
    const imgNova   = document.getElementById('ml-anuncio-img-nova');
    const vidNova   = _mlAnuncioVideoPreviewEl();
    const labelTxt  = document.getElementById('ml-anuncio-img-label-txt');
    const removerBtn= document.getElementById('ml-anuncio-img-remover');
    const statusEl  = document.getElementById('ml-anuncio-img-status');
    const ehVideo   = /^video\//.test(file.type);
    _anuncioMidiaTipo = ehVideo ? 'video' : 'foto';
    if (ehVideo) {
      // Preview de vídeo via object URL (base64 de vídeo estoura memória).
      if (imgNova) { imgNova.style.display = 'none'; imgNova.src = ''; }
      if (vidNova) {
        try { if (vidNova.dataset.objurl) URL.revokeObjectURL(vidNova.dataset.objurl); } catch(e){}
        var u = URL.createObjectURL(file);
        vidNova.dataset.objurl = u;
        vidNova.src = u; vidNova.style.display = '';
      }
      if (labelTxt) labelTxt.textContent = file.name + ' (vídeo)';
      if (removerBtn) removerBtn.style.display = '';
      if (statusEl) statusEl.textContent = '';
    } else {
      if (vidNova) { vidNova.style.display = 'none'; vidNova.removeAttribute('src'); }
      const reader = new FileReader();
      reader.onload = e => {
        if (imgNova) { imgNova.src = e.target.result; imgNova.style.display = ''; }
        if (labelTxt) labelTxt.textContent = file.name;
        if (removerBtn) removerBtn.style.display = '';
        if (statusEl) statusEl.textContent = '';
      };
      reader.readAsDataURL(file);
    }
    _anuncioImagemUrl = ''; // Resetar URL — será gerado no publicar
  }

  function mlAnuncioRemoverImagem() {
    _anuncioImagemUrl = '';
    _anuncioMidiaTipo = 'foto';
    const imgNova   = document.getElementById('ml-anuncio-img-nova');
    const vidNova   = document.getElementById('ml-anuncio-video-nova');
    const labelTxt  = document.getElementById('ml-anuncio-img-label-txt');
    const removerBtn= document.getElementById('ml-anuncio-img-remover');
    const statusEl  = document.getElementById('ml-anuncio-img-status');
    const input     = document.getElementById('ml-anuncio-img-input');
    if (imgNova)    { imgNova.src = ''; imgNova.style.display = 'none'; }
    if (vidNova)    { try { if (vidNova.dataset.objurl) URL.revokeObjectURL(vidNova.dataset.objurl); } catch(e){}
                      vidNova.removeAttribute('src'); vidNova.style.display = 'none'; }
    if (labelTxt)   labelTxt.textContent = 'Toque para escolher foto ou vídeo';
    if (removerBtn) removerBtn.style.display = 'none';
    if (statusEl)   statusEl.textContent = '';
    if (input)      input.value = '';
  }

  function mlSelectEmoji(btn) {
    document.querySelectorAll('.anuncio-emoji-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    _anuncioEmojiSelecionado = btn.dataset.emoji;
  }

  // Contador de caracteres
  document.getElementById('ml-anuncio-texto')?.addEventListener('input', function() {
    const charEl = document.getElementById('ml-anuncio-chars');
    if (charEl) charEl.textContent = `${this.value.length}/80`;
  });

  function mlExibirAnuncioAtivo(anuncio) {
    if (!anuncio || (!anuncio.texto && !anuncio.imagemUrl)) return;
    const ativoEl = document.getElementById('ml-anuncio-ativo');
    if (!ativoEl) return;

    // Verifica se ainda não expirou
    if (anuncio.expira && new Date(anuncio.expira) <= new Date()) {
      localStorage.removeItem('angatuba_anuncio');
      return;
    }

    // Persiste no sessionStorage para sobreviver ao recarregar
    localStorage.setItem('angatuba_anuncio', JSON.stringify(anuncio));

    ativoEl.style.display = '';
    document.getElementById('ml-anuncio-emoji-preview').textContent = anuncio.emoji || '🎯';
    const _txtPrev = document.getElementById('ml-anuncio-texto-preview');
    if (_txtPrev) {
      _txtPrev.textContent = anuncio.texto || '';
      _txtPrev.style.display = anuncio.texto ? '' : 'none';
    }

    // Mídia do anúncio (só Pro): foto no <img> existente; vídeo num <video>
    // criado sob demanda ao lado (mesmo espaço visual).
    const imgPreview = document.getElementById('ml-anuncio-img-preview');
    const _ehVideoAtivo = String(anuncio.midiaTipo || 'foto') === 'video';
    let vidPreview = document.getElementById('ml-anuncio-video-preview');
    if (_ehVideoAtivo && anuncio.imagemUrl && imgPreview && imgPreview.parentNode && !vidPreview) {
      vidPreview = document.createElement('video');
      vidPreview.id = 'ml-anuncio-video-preview';
      vidPreview.setAttribute('playsinline', ''); vidPreview.setAttribute('webkit-playsinline', '');
      vidPreview.muted = true; vidPreview.loop = true; vidPreview.controls = true; vidPreview.preload = 'metadata';
      vidPreview.style.cssText = 'display:none;width:100%;max-height:120px;object-fit:cover;border-radius:8px;margin-top:8px;';
      imgPreview.parentNode.insertBefore(vidPreview, imgPreview.nextSibling);
    }
    if (anuncio.imagemUrl) {
      if (_ehVideoAtivo) {
        if (imgPreview) imgPreview.style.display = 'none';
        if (vidPreview) { vidPreview.src = anuncio.imagemUrl; vidPreview.style.display = ''; }
      } else {
        if (vidPreview) { vidPreview.style.display = 'none'; vidPreview.removeAttribute('src'); }
        if (imgPreview) { imgPreview.src = anuncio.imagemUrl; imgPreview.style.display = ''; }
      }
    } else {
      if (imgPreview) imgPreview.style.display = 'none';
      if (vidPreview) vidPreview.style.display = 'none';
    }

    // Timer de expiração — Item 17: atualiza a cada 60s (antes era calculado uma
    // única vez; com o painel aberto o número ficava velho e, ao cruzar a virada
    // do dia, o anúncio sumia no público mas o painel ainda mostrava tempo restante).
    if (anuncio.expira) {
      _mlIniciarTimerAnuncio(anuncio.expira, ativoEl);
      // Se já expirou na primeira checagem, aborta a exibição.
      if (new Date(anuncio.expira) - new Date() <= 0) return;
    }

    // Oculta o formulário enquanto há anúncio ativo
    const formEl = document.getElementById('ml-anuncio-form');
    if (formEl) formEl.style.display = 'none';

    // Guarda dados no form para caso o usuário remova e queira reeditar
    const textarea = document.getElementById('ml-anuncio-texto');
    if (textarea) {
      textarea.value = anuncio.texto || '';
      document.getElementById('ml-anuncio-chars').textContent = `${(anuncio.texto || '').length}/80`;
    }
    const emojiBtn = document.querySelector(`.anuncio-emoji-btn[data-emoji="${anuncio.emoji}"]`);
    if (emojiBtn) mlSelectEmoji(emojiBtn);

    // Guarda URL da mídia atual para caso o usuário reedite
    if (anuncio.imagemUrl) {
      _anuncioImagemUrl = anuncio.imagemUrl;
      _anuncioMidiaTipo = _ehVideoAtivo ? 'video' : 'foto';
      const imgNova    = document.getElementById('ml-anuncio-img-nova');
      const labelTxt   = document.getElementById('ml-anuncio-img-label-txt');
      const removerBtn = document.getElementById('ml-anuncio-img-remover');
      if (_ehVideoAtivo) {
        const vidNova = _mlAnuncioVideoPreviewEl();
        if (imgNova) imgNova.style.display = 'none';
        if (vidNova) { vidNova.src = anuncio.imagemUrl; vidNova.style.display = ''; }
        if (labelTxt) labelTxt.textContent = 'Vídeo atual (toque para trocar)';
      } else {
        const vidNova = document.getElementById('ml-anuncio-video-nova');
        if (vidNova) { vidNova.style.display = 'none'; vidNova.removeAttribute('src'); }
        if (imgNova)    { imgNova.src = anuncio.imagemUrl; imgNova.style.display = ''; }
        if (labelTxt)   labelTxt.textContent = 'Foto atual (toque para trocar)';
      if (removerBtn) removerBtn.style.display = '';
      }
    }
  }

  // Item 17: contador de expiração do anúncio que se atualiza sozinho a cada 60s.
  // Renderiza imediatamente e reagenda; ao expirar, esconde o card, limpa o cache
  // e para o timer. Também para no visibilitychange→hidden e ao fechar o painel.
  function _mlIniciarTimerAnuncio(expira, ativoEl) {
    _mlPararTimerAnuncio(); // nunca acumula mais de um interval
    const render = () => {
      const timerEl = document.getElementById('ml-anuncio-timer');
      const restante = new Date(expira) - new Date();
      if (restante <= 0) {
        if (timerEl) timerEl.textContent = 'Expirado';
        if (ativoEl) ativoEl.style.display = 'none';
        try { localStorage.removeItem('angatuba_anuncio'); } catch(e) {}
        _mlPararTimerAnuncio();
        return;
      }
      if (timerEl) {
        const h = Math.floor(restante / 3600000);
        const m = Math.floor((restante % 3600000) / 60000);
        timerEl.textContent = `Expira em ${h}h ${m}m`;
      }
    };
    render();
    _anuncioTimerInterval = setInterval(render, 60000);
  }
  function _mlPararTimerAnuncio() {
    if (_anuncioTimerInterval) { clearInterval(_anuncioTimerInterval); _anuncioTimerInterval = null; }
  }

  async function mlPublicarAnuncio() {
    // Fase 2: no Pro, publicar = adicionar um story à lista (até 5).
    if (_mlPlanoAtual === 'PRO') { return mlStoryAdicionar(); }
    const texto = document.getElementById('ml-anuncio-texto')?.value.trim() || '';

    const btn = document.getElementById('ml-anuncio-btn');
    btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Publicando...';
    btn.disabled = true;

    try {
      // Upload da imagem (só Pro, se houver arquivo novo)
      const imgInput  = document.getElementById('ml-anuncio-img-input');
      const statusEl  = document.getElementById('ml-anuncio-img-status');
      let imagemUrl   = _anuncioImagemUrl; // Pode ser URL já salva ou vazia

      if (imgInput && imgInput.files[0]) {
        const imgFile = imgInput.files[0];
        const _ehVideoUp = /^video\//.test(imgFile.type) || _anuncioMidiaTipo === 'video';
        const _dst = statusEl || { textContent: '', style: {} };
        // Vídeo e foto têm caminhos de upload distintos (endpoint e validação).
        const uploadedUrl = _ehVideoUp
          ? await uploadVideoAnuncio(imgFile, _dst)
          : await uploadImagem(imgFile, _dst);
        if (uploadedUrl) {
          imagemUrl = uploadedUrl;
          _anuncioImagemUrl = imagemUrl;
          _anuncioMidiaTipo = _ehVideoUp ? 'video' : 'foto';
        } else {
          // uploadImagem/uploadVideoAnuncio já exibiu o erro no statusEl
          btn.innerHTML = '<i class="fa fa-bullhorn"></i> Publicar';
          btn.disabled = false;
          return;
        }
      }

      // Exige pelo menos texto OU mídia (mídia sozinha vale para PRO)
      if (!texto && !imagemUrl) {
        mlToast('Escreva um texto ou escolha uma foto/vídeo para o anúncio.', 'erro');
        btn.innerHTML = '<i class="fa fa-bullhorn"></i> Publicar';
        btn.disabled = false;
        return;
      }

      const params = new URLSearchParams();
      params.append('payload', JSON.stringify({
        action:    'lojaPublicarAnuncio',
        token:     _lojaToken,
        emoji:     _anuncioEmojiSelecionado,
        texto,
        imagemUrl: imagemUrl || '',
        midiaTipo: imagemUrl ? _anuncioMidiaTipo : 'foto',
      }));
      const resp = await fetch(APPS_SCRIPT_URL, { method:'POST', body:params, signal:AbortSignal.timeout(12000) });
      const json = await resp.json();

      if (json.status === 'ok') {
        mlExibirAnuncioAtivo({ emoji: _anuncioEmojiSelecionado, texto, expira: json.data?.expira, imagemUrl: imagemUrl || '', midiaTipo: imagemUrl ? _anuncioMidiaTipo : 'foto' });
        // form já foi ocultado por mlExibirAnuncioAtivo; reabilita btn para quando reaparecer
        btn.innerHTML = '<i class="fa fa-bullhorn"></i> Publicar';
        btn.disabled = false;
      } else {
        throw new Error(json.msg || 'Erro');
      }
    } catch(e) {
      mlToast('Erro ao publicar: ' + e.message, 'erro');
      btn.innerHTML = '<i class="fa fa-bullhorn"></i> Publicar';
      btn.disabled = false;
    }
  }

  // ── Fase 2: lista de stories no painel (Pro) ─────────────────
  function _mlLimparFormAnuncio() {
    var t = document.getElementById('ml-anuncio-texto'); if (t) t.value = '';
    var c = document.getElementById('ml-anuncio-chars'); if (c) c.textContent = '0/80';
    if (typeof mlAnuncioRemoverImagem === 'function') { try { mlAnuncioRemoverImagem(); } catch(e){} }
    _anuncioImagemUrl = ''; _anuncioMidiaTipo = 'foto';
  }

  async function mlStoriesCarregar() {
    var lst = document.getElementById('ml-stories-lista');
    var cnt = document.getElementById('ml-stories-contador');
    if (!lst) return;
    try {
      var params = new URLSearchParams();
      params.append('payload', JSON.stringify({ action:'lojaStoriesListar', token:_lojaToken }));
      var resp = await fetch(APPS_SCRIPT_URL, { method:'POST', body:params, signal:AbortSignal.timeout(12000) });
      var json = await resp.json();
      if (json.status !== 'ok') { lst.innerHTML = ''; return; }
      var stories = json.data.stories || [];
      var limite = json.data.limite || 5;
      _mlStoriesCache = stories;
      if (cnt) cnt.textContent = stories.length + ' de ' + limite + ' stories publicados';
      if (!stories.length) {
        lst.innerHTML = '<div style="font-size:11px;color:var(--muted);padding:6px 2px;">Nenhum story ainda. Crie o primeiro abaixo \u2014 pode ter at\u00e9 ' + limite + '.</div>';
      } else {
        lst.innerHTML = stories.map(function(st){
          var ehVideo = String(st.midiaTipo||'foto') === 'video';
          var thumb = st.imagemUrl
            ? (ehVideo
                ? '<div style="width:44px;height:44px;border-radius:8px;background:#000;display:flex;align-items:center;justify-content:center;flex-shrink:0;"><i class="ti ti-player-play" style="color:#fff;font-size:16px;"></i></div>'
                : '<img src="' + escAttr(st.imagemUrl) + '" style="width:44px;height:44px;border-radius:8px;object-fit:cover;flex-shrink:0;" />')
            : '<div style="width:44px;height:44px;border-radius:8px;background:var(--surface);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:1.2rem;">' + escHTML(st.emoji||'\ud83c\udfaf') + '</div>';
          var txt = st.texto ? escHTML(st.texto) : '<span style="opacity:.5;">(sem texto)</span>';
          var tag = ehVideo ? '<span style="font-size:8px;background:rgba(245,158,11,.2);color:var(--zap);padding:1px 5px;border-radius:4px;font-weight:700;margin-left:4px;">V\u00cdDEO</span>' : '';
          return '<div style="display:flex;align-items:center;gap:9px;padding:7px;background:var(--surface);border:1px solid var(--border);border-radius:9px;margin-bottom:6px;">' +
            thumb +
            '<div style="flex:1;min-width:0;font-size:11px;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + txt + tag + '</div>' +
            '<button onclick="mlStoryRemover(\'' + escAttr(st.id) + '\')" style="font-size:10px;color:var(--red);background:none;border:1px solid rgba(255,68,68,0.3);border-radius:6px;cursor:pointer;padding:3px 8px;flex-shrink:0;">Remover</button>' +
          '</div>';
        }).join('');
      }
      // Esconde/mostra o form conforme o limite.
      var form = document.getElementById('ml-anuncio-form');
      var btn = document.getElementById('ml-anuncio-btn');
      if (stories.length >= limite) {
        if (form) form.style.opacity = '.5';
        if (btn) { btn.disabled = true; btn.title = 'Limite de ' + limite + ' stories atingido'; }
      } else {
        if (form) form.style.opacity = '';
        if (btn) { btn.disabled = false; btn.title = ''; }
      }
    } catch(e) { lst.innerHTML = '<div style="font-size:11px;color:var(--red);">Erro ao carregar stories.</div>'; }
  }
  window.mlStoriesCarregar = mlStoriesCarregar;

  async function mlStoryAdicionar() {
    var texto = (document.getElementById('ml-anuncio-texto')||{}).value;
    texto = (texto || '').trim();
    var btn = document.getElementById('ml-anuncio-btn');
    if (btn) { btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Publicando...'; btn.disabled = true; }
    try {
      var imgInput = document.getElementById('ml-anuncio-img-input');
      var statusEl = document.getElementById('ml-anuncio-img-status');
      var imagemUrl = _anuncioImagemUrl;
      var midiaTipo = _anuncioMidiaTipo;
      if (imgInput && imgInput.files[0]) {
        var f = imgInput.files[0];
        var ehVid = /^video\//.test(f.type) || _anuncioMidiaTipo === 'video';
        var dst = statusEl || { textContent:'', style:{} };
        var url = ehVid ? await uploadVideoAnuncio(f, dst) : await uploadImagem(f, dst);
        if (!url) { if (btn){ btn.innerHTML='<i class="fa fa-bullhorn"></i> Publicar'; btn.disabled=false; } return; }
        imagemUrl = url; midiaTipo = ehVid ? 'video' : 'foto';
      }
      if (!texto && !imagemUrl) {
        mlToast('Escreva um texto ou escolha uma foto/vídeo.', 'erro');
        if (btn){ btn.innerHTML='<i class="fa fa-bullhorn"></i> Publicar'; btn.disabled=false; } return;
      }
      var params = new URLSearchParams();
      params.append('payload', JSON.stringify({
        action:'lojaStorySalvar', token:_lojaToken,
        emoji:_anuncioEmojiSelecionado, texto:texto,
        imagemUrl: imagemUrl || '', midiaTipo: imagemUrl ? midiaTipo : 'foto',
      }));
      var resp = await fetch(APPS_SCRIPT_URL, { method:'POST', body:params, signal:AbortSignal.timeout(15000) });
      var json = await resp.json();
      if (json.status === 'ok') {
        mlToast('Story publicado!', 'ok');
        _mlLimparFormAnuncio();
        await mlStoriesCarregar();
      } else { throw new Error(json.msg || 'Erro'); }
    } catch(e) { mlToast('Erro ao publicar: ' + e.message, 'erro'); }
    finally { if (btn){ btn.innerHTML='<i class="fa fa-bullhorn"></i> Publicar'; btn.disabled=false; } }
  }
  window.mlStoryAdicionar = mlStoryAdicionar;

  async function mlStoryRemover(id) {
    if (!id) return;
    try {
      var params = new URLSearchParams();
      params.append('payload', JSON.stringify({ action:'lojaStoryRemover', token:_lojaToken, id:id }));
      var resp = await fetch(APPS_SCRIPT_URL, { method:'POST', body:params, signal:AbortSignal.timeout(12000) });
      var json = await resp.json();
      if (json.status === 'ok') { mlToast('Story removido.', 'ok'); await mlStoriesCarregar(); }
      else { mlToast('Erro ao remover: ' + (json.msg||''), 'erro'); }
    } catch(e) { mlToast('Erro ao remover.', 'erro'); }
  }
  window.mlStoryRemover = mlStoryRemover;

  async function mlRemoverAnuncio() {
    try {
      const params = new URLSearchParams();
      params.append('payload', JSON.stringify({ action:'lojaRemoverAnuncio', token:_lojaToken }));
      await fetch(APPS_SCRIPT_URL, { method:'POST', body:params, signal:AbortSignal.timeout(10000) });
      document.getElementById('ml-anuncio-ativo').style.display = 'none';
      document.getElementById('ml-anuncio-timer').textContent = '';
      if (typeof _mlPararTimerAnuncio === 'function') _mlPararTimerAnuncio(); // Item 17
      localStorage.removeItem('angatuba_anuncio');
      // Limpa imagem e texto
      _anuncioImagemUrl = '';
      mlAnuncioRemoverImagem();
      const textarea = document.getElementById('ml-anuncio-texto');
      if (textarea) { textarea.value = ''; }
      document.getElementById('ml-anuncio-chars').textContent = '0/80';
      // Mostra o formulário de novo
      const formEl = document.getElementById('ml-anuncio-form');
      if (formEl) formEl.style.display = '';
    } catch(e) {
      console.warn('[Anuncio] Erro ao remover:', e.message);
    }
  }

  /* ══════════════════════════════════════════════════════════════
     AVALIAÇÕES
  ══════════════════════════════════════════════════════════════ */
  // Fonte única do HTML de um item de avaliação (lista inicial e "ver todas").
  function avalItemHTML(a, idx, isDono) {
    const nota = a.nota || 0;
    const estrelas = '★'.repeat(nota) + '☆'.repeat(5 - nota);
    const quando = tempoRelativo(a.data);
    const dataHTML = quando ? `<span style="font-size:10px;color:var(--muted);">· ${quando}</span>` : '';
    const idSafe = String(a.id || '');
    const sinalizarBtn = isDono
      ? `<button onclick="avalSinalizar(${idx},'${escAttr(idSafe)}','${escAttr(a.texto||'')}')" title="Sinalizar para revisão" style="font-size:11px;color:var(--muted);background:none;border:none;cursor:pointer;padding:2px 6px;border-radius:5px;border:1px solid var(--border);flex-shrink:0;">🚩</button>`
      : '';
    const responderBtn = (isDono && !a.resposta)
      ? `<button onclick="avalResponder(${idx},'${escAttr(idSafe)}')" style="font-size:10.5px;color:#f59e0b;background:none;border:none;cursor:pointer;padding:2px 4px;font-weight:700;">Responder</button>`
      : '';
    const textoHTML = a.texto ? `<p style="font-size:11.5px;color:var(--text);margin:0;line-height:1.5;">${escHTML(a.texto)}</p>` : '';
    const respHTML = a.resposta
      ? `<div style="margin-top:8px;padding:8px 10px;background:var(--surface);border-left:3px solid #f59e0b;border-radius:6px;">
           <div style="font-size:9.5px;font-weight:800;color:#f59e0b;text-transform:uppercase;letter-spacing:.04em;margin-bottom:2px;">Resposta da loja</div>
           <p style="font-size:11px;color:var(--muted);margin:0;line-height:1.45;">${escHTML(a.resposta)}</p>
         </div>`
      : '';
    return `<div id="aval-item-${idx}-${idSafe}" style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:10px 12px;margin-bottom:6px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;gap:6px;">
          <div style="display:flex;align-items:center;gap:6px;min-width:0;">
            <span style="font-size:12px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHTML(a.autor || 'Anônimo')}</span>${dataHTML}
          </div>
          <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">
            <span style="font-size:11px;color:#f59e0b;letter-spacing:1px;">${estrelas}</span>${responderBtn}${sinalizarBtn}
          </div>
        </div>
        ${textoHTML}${respHTML}
      </div>`;
  }

  // Form de nova avaliação (com nome obrigatório).
  function avalFormNovoHTML(idx, nome) {
    const nomeSalvo = getAvalNome();
    return `
      <div id="aval-form-${idx}" style="margin-bottom:14px;margin-top:4px;padding-top:14px;border-top:1px solid var(--border);">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
          <img src="/webp/owl-wave.webp" alt="" style="width:32px;height:32px;object-fit:contain;flex-shrink:0;" onerror="this.style.display='none'" />
          <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;">Avaliar esta loja</div>
        </div>
        <div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:12px;">
          <div style="display:flex;gap:4px;margin-bottom:8px;" id="aval-stars-${idx}" role="radiogroup" aria-label="Sua nota, de 1 a 5 estrelas">
            ${[1,2,3,4,5].map(st => `<button onclick="avalSetNota(${idx},${st})" data-nota="${st}" style="font-size:1.6rem;background:none;border:none;cursor:pointer;color:rgba(255,255,255,0.15);transition:color 0.1s;-webkit-tap-highlight-color:transparent;" class="aval-star" role="radio" aria-checked="false" aria-label="${st} estrela${st > 1 ? 's' : ''}">★</button>`).join('')}
          </div>
          <input id="aval-nome-${idx}" type="text" maxlength="40" value="${escAttr(nomeSalvo)}" placeholder="Seu nome (ex.: João S.)" autocomplete="name"
            style="width:100%;background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:8px 10px;font-size:12px;color:var(--text);box-sizing:border-box;font-family:var(--font-b);margin-bottom:6px;" />
          <textarea id="aval-texto-${idx}" maxlength="120" rows="2" placeholder="Conte sua experiência... (opcional)"
            oninput="var c=document.getElementById('aval-contador-${idx}');if(c)c.textContent=this.value.length+'/120';"
            style="width:100%;background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:8px 10px;font-size:12px;color:var(--text);resize:none;box-sizing:border-box;font-family:var(--font-b);line-height:1.5;margin-bottom:2px;"></textarea>
          <div id="aval-contador-${idx}" style="font-size:10px;color:var(--muted);text-align:right;margin-bottom:6px;">0/120</div>
          <button onclick="avalEnviar(${idx},'${escAttr(nome)}')"
            style="width:100%;padding:10px;border-radius:8px;background:linear-gradient(135deg,#f59e0b,#d97706);color:#000;font-family:var(--font-h);font-size:13px;font-weight:800;border:none;cursor:pointer;">
            ⭐ Enviar avaliação
          </button>
          <div id="aval-msg-${idx}" style="font-size:11px;text-align:center;margin-top:6px;min-height:16px;"></div>
        </div>
      </div>`;
  }

  // Painel "você já avaliou" (editar/remover), autenticado por sid no backend.
  function avalMinhaPainelHTML(idx, nome, minha) {
    const nota = (minha && minha.nota) || 0;
    const estrelas = nota ? ('★'.repeat(nota) + '☆'.repeat(5 - nota)) : '';
    const notaTxt = estrelas ? `<span style="color:#f59e0b;">${estrelas}</span>` : '';
    return `
      <div id="aval-form-${idx}" style="margin-bottom:14px;margin-top:4px;padding-top:14px;border-top:1px solid var(--border);">
        <div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:12px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
            <img src="/webp/owl-thumbsup.webp" alt="" style="width:28px;height:28px;object-fit:contain;flex-shrink:0;" onerror="this.style.display='none'" />
            <div style="font-size:12px;font-weight:700;color:var(--text);">Você já avaliou esta loja ${notaTxt}</div>
          </div>
          <div id="aval-min-area-${idx}" style="display:flex;gap:8px;">
            <button onclick="avalEditarAbrir(${idx},'${escAttr(nome)}')" style="flex:1;padding:9px;border-radius:8px;background:var(--surface);border:1px solid var(--border);color:var(--text);font-family:var(--font-b);font-size:12px;font-weight:700;cursor:pointer;-webkit-tap-highlight-color:transparent;">✏️ Editar</button>
            <button onclick="avalRemover(${idx},'${escAttr(nome)}')" style="flex:1;padding:9px;border-radius:8px;background:var(--surface);border:1px solid var(--border);color:var(--red);font-family:var(--font-b);font-size:12px;font-weight:700;cursor:pointer;-webkit-tap-highlight-color:transparent;">🗑️ Remover</button>
          </div>
          <div id="aval-msg-${idx}" style="font-size:11px;text-align:center;margin-top:8px;min-height:16px;"></div>
        </div>
      </div>`;
  }

  let _avalNota = {};

  // Dono sinaliza avaliação para revisão (localiza pela ID estável, não por índice)
  window.avalSinalizar = async function(lojaIdx, avalId, textoEsperado) {
    const ok = await mlConfirmar('Sinalizar avaliação?', 'Ela ficará oculta até ser analisada pela nossa equipe.', { okLabel: 'Sinalizar', owlSrc: '/webp/owl-sign.webp' });
    if (!ok) return;
    try {
      const params = new URLSearchParams();
      params.append('payload', JSON.stringify({
        action: 'lojaSinalizarAvaliacao',
        token:  _lojaToken,
        avalId: avalId,
        textoEsperado: textoEsperado || '',
      }));
      const resp = await fetch(APPS_SCRIPT_URL, { method:'POST', body:params, signal:AbortSignal.timeout(10000) });
      const json = await resp.json();
      if (json.status === 'ok') {
        mlToast('Avaliação sinalizada! Será revisada em breve.', 'ok');
        const arr = LOJAS[lojaIdx] && LOJAS[lojaIdx].avaliacoes;
        if (arr) {
          const pos = arr.findIndex(function(a){ return String(a.id||'') === String(avalId); });
          if (pos !== -1) arr.splice(pos, 1);
        }
        abrirDetalhes(lojaIdx);
      } else throw new Error(json.msg);
    } catch(e) {
      mlToast('Erro ao sinalizar: ' + e.message, 'erro');
    }
  };

  // Expande/recolhe a lista de avaliações
  window.avalToggleLista = function(idx) {
    const lista = document.getElementById('aval-lista-' + idx);
    const btn   = document.getElementById('aval-toggle-' + idx);
    if (!lista || !btn) return;
    const aberta = lista.classList.toggle('aberta');
    const chev = btn.querySelector('.aval-toggle-chev');
    const txt  = btn.querySelector('.aval-toggle-txt');
    if (chev) chev.style.transform = aberta ? 'rotate(180deg)' : '';
    if (aberta) {
      lista.style.maxHeight = lista.scrollHeight + 'px';
      if (txt) txt.textContent = 'Ocultar avaliações';
    } else {
      lista.style.maxHeight = '0px';
      const loja = LOJAS[idx];
      const n = loja && loja.avaliacoes ? loja.avaliacoes.length : 0;
      if (txt) txt.textContent = 'Ver ' + n + ' avaliação' + (n > 1 ? 'ões' : '');
    }
  };

  // Renderiza TODAS as avaliações (quando passam do limite inicial)
  window.avalVerTodas = function(idx) {
    const loja = LOJAS[idx];
    if (!loja || !loja.avaliacoes) return;
    const cont = document.getElementById('aval-lista-itens-' + idx);
    const maisBtn = document.getElementById('aval-mais-' + idx);
    const lista = document.getElementById('aval-lista-' + idx);
    if (!cont) return;
    const isDono = _lojaToken && _lojaNome === loja.nome;
    cont.innerHTML = loja.avaliacoes.map(function(a){ return avalItemHTML(a, idx, isDono); }).join('');
    if (maisBtn) maisBtn.remove();
    if (lista && lista.classList.contains('aberta')) lista.style.maxHeight = lista.scrollHeight + 'px';
  };

  window.avalSetNota = function(idx, nota) {
    _avalNota[idx] = nota;
    const stars = document.querySelectorAll(`#aval-stars-${idx} .aval-star`);
    stars.forEach((s, i) => {
      s.style.color = i < nota ? '#f59e0b' : 'rgba(255,255,255,0.15)';
      s.setAttribute('aria-checked', i < nota ? 'true' : 'false'); // #16
    });
  };

  window.avalEnviar = async function(idx, nome) {
    const avalBtn = document.querySelector(`#aval-form-${idx} button[onclick*="avalEnviar"]`);
    if (avalBtn && avalBtn.disabled) return;
    const msgEl = document.getElementById(`aval-msg-${idx}`);
    const nota  = _avalNota[idx];
    if (!nota || nota < 1) {
      if (msgEl) { msgEl.textContent = '⭐ Selecione uma nota antes de enviar.'; msgEl.style.color = 'var(--red)'; }
      return;
    }
    const nomeInput = document.getElementById(`aval-nome-${idx}`);
    const autor = ((nomeInput && nomeInput.value) || '').trim();
    if (autor.length < 2) {
      if (msgEl) { msgEl.textContent = '✍️ Coloque seu nome (ao menos 2 letras).'; msgEl.style.color = 'var(--red)'; }
      if (nomeInput) nomeInput.focus();
      return;
    }
    if (_lojaToken && _lojaNome === nome) {
      if (msgEl) { msgEl.textContent = '❌ Você não pode avaliar sua própria loja.'; msgEl.style.color = 'var(--red)'; }
      return;
    }
    if (getMinhaAval(nome)) {
      if (msgEl) { msgEl.textContent = 'Você já avaliou esta loja!'; msgEl.style.color = 'var(--muted)'; }
      return;
    }
    if (avalBtn) avalBtn.disabled = true;
    const textoEl = document.getElementById(`aval-texto-${idx}`);
    const texto = (textoEl && textoEl.value.trim()) || '';
    if (msgEl) { msgEl.textContent = '⏳ Enviando...'; msgEl.style.color = 'var(--muted)'; }
    try {
      setAvalNome(autor);
      const params = new URLSearchParams();
      params.append('payload', JSON.stringify({
        action: 'registrarAvaliacao',
        loja:   nome,
        nota,
        texto,
        autor,
        sessionId: getAvalSid(),
      }));
      const resp = await fetch(APPS_SCRIPT_URL, { method:'POST', body:params, signal:AbortSignal.timeout(12000) });
      const json = await resp.json();
      if (json.status === 'ok') {
        setMinhaAval(nome, { nota, texto, autor, ts: Date.now() });
        if (typeof window.marcarLojaAvaliada === 'function') window.marcarLojaAvaliada(nome);
        const aprovada = json.data && json.data.aprovada;
        if (msgEl) {
          msgEl.textContent = aprovada ? '✅ Avaliação publicada. Obrigado!' : '✅ Enviada! Aparecerá após moderação.';
          msgEl.style.color = 'var(--green)';
        }
        const formEl = document.getElementById(`aval-form-${idx}`);
        if (formEl) { formEl.style.opacity = '0.5'; formEl.style.pointerEvents = 'none'; }
      } else {
        if (avalBtn) avalBtn.disabled = false;
        if (msgEl) { msgEl.textContent = '❌ ' + (json.msg || 'Erro ao enviar.'); msgEl.style.color = 'var(--red)'; }
      }
    } catch(e) {
      if (avalBtn) avalBtn.disabled = false;
      if (msgEl) { msgEl.textContent = '❌ Erro ao enviar. Tente novamente.'; msgEl.style.color = 'var(--red)'; }
    }
  };

  /* ── Editar / remover a própria avaliação (auth por sid no backend) ── */
  window._avalEditNota = window._avalEditNota || {};
  window.avalEditSetNota = function(idx, nota) {
    window._avalEditNota[idx] = nota;
    document.querySelectorAll(`#avaledit-stars-${idx} .aval-star`).forEach(function(el, i){
      el.style.color = i < nota ? '#f59e0b' : 'rgba(255,255,255,0.15)';
      el.setAttribute('aria-checked', i < nota ? 'true' : 'false');
    });
  };
  window.avalEditarAbrir = function(idx, nome) {
    const area = document.getElementById('aval-min-area-' + idx);
    if (!area) return;
    const minha = getMinhaAval(nome) || {};
    const nota = minha.nota || 0;
    window._avalEditNota[idx] = nota;
    const stars = [1,2,3,4,5].map(function(st){
      return `<button onclick="avalEditSetNota(${idx},${st})" class="aval-star" role="radio" aria-checked="${st<=nota?'true':'false'}" style="font-size:1.5rem;background:none;border:none;cursor:pointer;color:${st<=nota?'#f59e0b':'rgba(255,255,255,0.15)'};-webkit-tap-highlight-color:transparent;">★</button>`;
    }).join('');
    area.innerHTML = `
      <div style="width:100%;">
        <div style="display:flex;gap:4px;margin-bottom:8px;" id="avaledit-stars-${idx}" role="radiogroup" aria-label="Nova nota">${stars}</div>
        <textarea id="avaledit-texto-${idx}" maxlength="120" rows="2" placeholder="Conte sua experiência... (opcional)"
          style="width:100%;background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:8px 10px;font-size:12px;color:var(--text);resize:none;box-sizing:border-box;font-family:var(--font-b);line-height:1.5;margin-bottom:6px;">${escHTML(minha.texto || '')}</textarea>
        <div style="display:flex;gap:8px;">
          <button onclick="avalEditarEnviar(${idx},'${escAttr(nome)}')" style="flex:1;padding:9px;border-radius:8px;background:linear-gradient(135deg,#f59e0b,#d97706);color:#000;font-family:var(--font-h);font-size:12px;font-weight:800;border:none;cursor:pointer;">Salvar</button>
          <button onclick="abrirDetalhes(${idx})" style="padding:9px 14px;border-radius:8px;background:var(--surface);border:1px solid var(--border);color:var(--muted);font-family:var(--font-b);font-size:12px;font-weight:700;cursor:pointer;">Cancelar</button>
        </div>
      </div>`;
  };
  window.avalEditarEnviar = async function(idx, nome) {
    const msgEl = document.getElementById('aval-msg-' + idx);
    const nota = window._avalEditNota[idx];
    if (!nota || nota < 1) { if (msgEl) { msgEl.textContent = '⭐ Selecione uma nota.'; msgEl.style.color = 'var(--red)'; } return; }
    const txtEl = document.getElementById('avaledit-texto-' + idx);
    const texto = (txtEl && txtEl.value.trim()) || '';
    const minhaOld = getMinhaAval(nome) || {};
    if (msgEl) { msgEl.textContent = '⏳ Salvando...'; msgEl.style.color = 'var(--muted)'; }
    try {
      const params = new URLSearchParams();
      params.append('payload', JSON.stringify({ action:'editarAvaliacao', loja:nome, nota:nota, texto:texto, sessionId:getAvalSid() }));
      const resp = await fetch(APPS_SCRIPT_URL, { method:'POST', body:params, signal:AbortSignal.timeout(12000) });
      const json = await resp.json();
      if (json.status !== 'ok') { if (msgEl) { msgEl.textContent = '❌ ' + (json.msg || 'Erro ao salvar.'); msgEl.style.color = 'var(--red)'; } return; }
      setMinhaAval(nome, { nota:nota, texto:texto, autor:getAvalNome(), ts:Date.now() });
      const aprovada = json.data && json.data.aprovada;
      const arr = LOJAS[idx] && LOJAS[idx].avaliacoes;
      if (arr) {
        const pos = arr.findIndex(function(a){
          return (a.autor||'') === (minhaOld.autor||getAvalNome()) && (a.nota||0) === (minhaOld.nota||0) && (a.texto||'') === (minhaOld.texto||'');
        });
        if (pos !== -1) {
          if (aprovada) { arr[pos].nota = nota; arr[pos].texto = texto; arr[pos].data = Date.now(); }
          else { arr.splice(pos, 1); }
        }
      }
      if (msgEl) { msgEl.textContent = aprovada ? '✅ Avaliação atualizada!' : '✅ Atualizada! Passará por moderação.'; msgEl.style.color = 'var(--green)'; }
      setTimeout(function(){ abrirDetalhes(idx); }, 700);
    } catch(e) {
      if (msgEl) { msgEl.textContent = '❌ Erro ao salvar.'; msgEl.style.color = 'var(--red)'; }
    }
  };
  window.avalRemover = async function(idx, nome) {
    const ok = await mlConfirmar('Remover sua avaliação?', 'Ela deixará de aparecer para todos.', { okLabel:'Remover', owlSrc:'/webp/owl-sign.webp' });
    if (!ok) return;
    const msgEl = document.getElementById('aval-msg-' + idx);
    const minhaOld = getMinhaAval(nome) || {};
    if (msgEl) { msgEl.textContent = '⏳ Removendo...'; msgEl.style.color = 'var(--muted)'; }
    try {
      const params = new URLSearchParams();
      params.append('payload', JSON.stringify({ action:'removerAvaliacao', loja:nome, sessionId:getAvalSid() }));
      const resp = await fetch(APPS_SCRIPT_URL, { method:'POST', body:params, signal:AbortSignal.timeout(12000) });
      const json = await resp.json();
      if (json.status !== 'ok') { if (msgEl) { msgEl.textContent = '❌ ' + (json.msg || 'Erro ao remover.'); msgEl.style.color = 'var(--red)'; } return; }
      limparMinhaAval(nome);
      const arr = LOJAS[idx] && LOJAS[idx].avaliacoes;
      if (arr) {
        const pos = arr.findIndex(function(a){
          return (a.autor||'') === (minhaOld.autor||getAvalNome()) && (a.nota||0) === (minhaOld.nota||0) && (a.texto||'') === (minhaOld.texto||'');
        });
        if (pos !== -1) arr.splice(pos, 1);
      }
      mlToast('Avaliação removida.', 'ok');
      abrirDetalhes(idx);
    } catch(e) {
      if (msgEl) { msgEl.textContent = '❌ Erro ao remover.'; msgEl.style.color = 'var(--red)'; }
    }
  };

  /* ── Dono responde publicamente uma avaliação ── */
  window.avalResponder = function(lojaIdx, avalId) {
    const item = document.getElementById('aval-item-' + lojaIdx + '-' + avalId);
    if (!item || item.querySelector('.aval-resp-form')) return;
    const div = document.createElement('div');
    div.className = 'aval-resp-form';
    div.style.marginTop = '8px';
    div.innerHTML =
      `<textarea id="aval-resp-txt-${lojaIdx}-${avalId}" maxlength="150" rows="2" placeholder="Responder publicamente..." style="width:100%;background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:7px 9px;font-size:11px;color:var(--text);resize:none;box-sizing:border-box;font-family:var(--font-b);margin-bottom:6px;"></textarea>
       <div style="display:flex;gap:6px;">
         <button onclick="avalResponderEnviar(${lojaIdx},'${escAttr(avalId)}')" style="flex:1;padding:7px;border-radius:6px;background:linear-gradient(135deg,#f59e0b,#d97706);color:#000;font-family:var(--font-h);font-size:11px;font-weight:800;border:none;cursor:pointer;">Publicar</button>
         <button onclick="this.closest('.aval-resp-form').remove()" style="padding:7px 12px;border-radius:6px;background:var(--surface);border:1px solid var(--border);color:var(--muted);font-size:11px;font-weight:700;cursor:pointer;">Cancelar</button>
       </div>
       <div class="aval-resp-msg" style="font-size:10px;text-align:center;margin-top:4px;min-height:12px;"></div>`;
    item.appendChild(div);
    const ta = div.querySelector('textarea'); if (ta) ta.focus();
  };
  window.avalResponderEnviar = async function(lojaIdx, avalId) {
    const item = document.getElementById('aval-item-' + lojaIdx + '-' + avalId);
    const ta = document.getElementById('aval-resp-txt-' + lojaIdx + '-' + avalId);
    const msg = item ? item.querySelector('.aval-resp-msg') : null;
    const resposta = ((ta && ta.value) || '').trim();
    if (resposta.length < 2) { if (msg) { msg.textContent = 'Escreva uma resposta.'; msg.style.color = 'var(--red)'; } return; }
    if (msg) { msg.textContent = 'Publicando...'; msg.style.color = 'var(--muted)'; }
    try {
      const params = new URLSearchParams();
      params.append('payload', JSON.stringify({ action:'lojaResponderAvaliacao', token:_lojaToken, avalId:avalId, resposta:resposta }));
      const resp = await fetch(APPS_SCRIPT_URL, { method:'POST', body:params, signal:AbortSignal.timeout(10000) });
      const json = await resp.json();
      if (json.status !== 'ok') { if (msg) { msg.textContent = '❌ ' + (json.msg || 'Erro.'); msg.style.color = 'var(--red)'; } return; }
      const arr = LOJAS[lojaIdx] && LOJAS[lojaIdx].avaliacoes;
      if (arr) { const a = arr.find(function(x){ return String(x.id||'') === String(avalId); }); if (a) a.resposta = resposta; }
      mlToast('Resposta publicada!', 'ok');
      abrirDetalhes(lojaIdx);
    } catch(e) {
      if (msg) { msg.textContent = '❌ Erro ao publicar.'; msg.style.color = 'var(--red)'; }
    }
  };

  /* ══════════════════════════════════════════════════════════════
     CARDÁPIO — PAINEL DO DONO
  ══════════════════════════════════════════════════════════════ */
  let _cardapioItens  = [];
  const PLUS_LIMITE_ITENS = 8; // fonte única do limite de itens do plano PLUS
  let _cardapioBusca = '';           // termo de busca atual (em memória)
  let _cardapioGruposFechados = {};  // { categoria: true } = colapsado
  let _cardapioPlano  = 'GRATIS';
  let _cardapioLojaWpp = null;
  let _cardapioLojaInfo = null;
  let _cardapioUploadEmAndamento = false; // Fix #22: bloqueia salvar durante upload de foto
  let _mlGrupos = [];            // grupos de opcoes da loja (PRO). [{id,nome,tipo,min,max,precoModo,ativo,opcoes:[...]}]
  let _mlGrupoEditId = null;     // grupo aberto no editor de opcoes, ou null
  // ID da opcao em edicao. null = form de opcao esta no modo 'criar nova'.
  // Declarado aqui (junto do estado irmao) porque mlGrupoAbrirOpcoes e
  // mlOpcoesFechar referenciam esta variavel antes deste ponto no arquivo.
  let _mlOpcaoEditId = null;

  async function mlCardapioCarregar(plano) {
    _cardapioPlano = plano;
    _cardapioBusca = '';
    const buscaInput = document.getElementById('ml-cardapio-busca');
    if (buscaInput) buscaInput.value = '';
    const isPro  = plano === 'PRO';
    const isPlus = plano === 'PLUS';

    const section = document.getElementById('ml-cardapio-section');
    if (!section) return;
    section.style.display = (isPro || isPlus) ? '' : 'none';
    // Grupos de opcoes: PRO-only. Aparece logo abaixo do cardapio.
    const gruposSection = document.getElementById('ml-grupos-section');
    if (gruposSection) gruposSection.style.display = isPro ? '' : 'none';
    // Acordeão de infos: loja paga (com cardápio no topo) começa fechada;
    // loja Grátis (sem cardápio) começa aberta — senão a aba abriria vazia.
    if (typeof window.mlToggleInfoSection === 'function') {
      window.mlToggleInfoSection(!(isPro || isPlus));
    }
    if (!isPro && !isPlus) return;

    // Badge do plano
    const badge = document.getElementById('ml-cardapio-badge');
    if (badge) {
      if (isPro) {
        badge.textContent = 'PRO';
        badge.style.background = 'linear-gradient(135deg, var(--plano-pro-1), var(--plano-pro-2))';
      } else {
        badge.textContent = 'PLUS · até ' + PLUS_LIMITE_ITENS + ' itens';
        badge.style.background = 'linear-gradient(135deg, var(--plano-plus-1), var(--plano-plus-2))';
        badge.style.color = '#fff';
      }
    }

    // Plus não tem foto, categoria nem destaque (recursos só do PRO)
    document.getElementById('ml-cardapio-foto-wrap').style.display = isPro ? '' : 'none';
    document.getElementById('ml-cardapio-cat-wrap').style.display  = isPro ? '' : 'none';
    // Fix #1: gate do checkbox de destaque na UI (gate real é server-side)
    const _destWrap = document.getElementById('ml-cardapio-destaque-wrap');
    if (_destWrap) _destWrap.style.display = isPro ? 'flex' : 'none';

    try {
      const params = new URLSearchParams();
      params.append('payload', JSON.stringify({ action:'lojaCardapioListar', token:_lojaToken }));
      const resp = await fetch(APPS_SCRIPT_URL, { method:'POST', body:params, signal:AbortSignal.timeout(12000) });
      const json = await resp.json();
      if (json.status === 'ok') {
        _cardapioItens = json.data.itens || [];
        mlCardapioRenderLista();
      }
    } catch(e) { console.warn('[Cardapio] Erro ao carregar:', e.message); }
    // Grupos de opcoes sao PRO-only; carrega em paralelo (nao bloqueia o cardapio).
    if (isPro) { mlGruposCarregar(); }
  }

  /* ═══════════════════════════════════════════════════════════
     GRUPOS DE OPCOES — painel do lojista (PRO)
  ═══════════════════════════════════════════════════════════ */
  async function mlGruposCarregar() {
    try {
      const json = await apiPost('lojaOpcoesListar', { token: _lojaToken }, { timeout: 12000, ignoreUnauthorized: true });
      if (json.status === 'ok') {
        _mlGrupos = json.data.grupos || [];
        mlGruposRenderLista();
      }
    } catch(e) { console.warn('[Grupos] Erro ao carregar:', e.message); }
  }

  function mlGruposRenderLista() {
    const lista = document.getElementById('ml-grupos-lista');
    if (!lista) return;
    if (!_mlGrupos.length) {
      lista.innerHTML = `<div style="text-align:center;padding:18px 12px;color:var(--muted);font-size:11px;line-height:1.5;">
        Nenhum grupo ainda. Crie grupos como <strong>Tamanho</strong>, <strong>Acréscimos</strong> ou <strong>Borda</strong><br>e depois vincule aos itens do cardápio.
      </div>`;
      return;
    }
    lista.innerHTML = _mlGrupos.map(g => {
      const tipoTxt = g.tipo === 'UNICA' ? 'Escolha única' : 'Múltipla';
      const modoTxt = g.precoModo === 'ABSOLUTO' ? 'preço final' : 'acréscimo';
      const nOps = (g.opcoes || []).length;
      return `<div class="ml-grupo-card">
        <div style="flex:1;min-width:0;">
          <div style="font-family:var(--font-h);font-size:12px;font-weight:800;">${escHTML(g.nome)}</div>
          <div style="font-size:9px;color:var(--muted);text-transform:uppercase;margin-top:2px;">${tipoTxt} · ${modoTxt} · ${nOps} opção${nOps!==1?'ões':''}</div>
        </div>
        <div style="display:flex;gap:6px;flex-shrink:0;">
          <button onclick="mlGrupoAbrirAplicar('${g.id}')" style="padding:6px 10px;border-radius:7px;background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);color:#10b981;font-size:10px;font-weight:700;cursor:pointer;"><i class="fa fa-layer-group"></i> Aplicar</button>
          <button onclick="mlGrupoAbrirOpcoes('${g.id}')" style="padding:6px 10px;border-radius:7px;background:rgba(124,58,237,0.1);border:1px solid rgba(124,58,237,0.25);color:#7c3aed;font-size:10px;font-weight:700;cursor:pointer;"><i class="fa fa-list"></i> Opções</button>
          <button onclick="mlGrupoAbrirForm('${g.id}')" style="padding:6px 10px;border-radius:7px;background:var(--surface);border:1px solid var(--border);color:var(--text);font-size:10px;font-weight:700;cursor:pointer;"><i class="fa fa-pencil"></i></button>
          <button onclick="mlGrupoRemover('${g.id}','${escAttr(g.nome)}')" style="padding:6px 10px;border-radius:7px;background:rgba(255,68,68,0.08);border:1px solid rgba(255,68,68,0.2);color:var(--red);font-size:10px;font-weight:700;cursor:pointer;"><i class="fa fa-trash"></i></button>
        </div>
      </div>`;
    }).join('');
  }

  window.mlGrupoAbrirForm = function(editId) {
    const form = document.getElementById('ml-grupo-form');
    if (!form) return;
    form.style.display = '';
    document.getElementById('ml-grupo-form-msg').textContent = '';
    const g = editId ? _mlGrupos.find(x => x.id === editId) : null;
    document.getElementById('ml-grupo-form-title').textContent = g ? 'Editar grupo' : 'Novo grupo';
    document.getElementById('ml-grupo-edit-id').value = editId || '';
    document.getElementById('ml-grupo-nome').value = g ? g.nome : '';
    document.getElementById('ml-grupo-tipo').value = g ? g.tipo : 'MULTIPLA';
    document.getElementById('ml-grupo-modo').value = g ? g.precoModo : 'DELTA';
    document.getElementById('ml-grupo-min').value = g ? g.min : 0;
    document.getElementById('ml-grupo-max').value = g ? g.max : 0;
    mlGrupoSyncTipo();
    form.scrollIntoView({ behavior:'smooth', block:'nearest' });
  };

  window.mlGrupoFecharForm = function() {
    document.getElementById('ml-grupo-form').style.display = 'none';
  };

  // Ajusta os campos min/max conforme o tipo: UNICA esconde max (sempre 1) e
  // troca min por um checkbox 'obrigatorio'. Mantem a UI simples pro lojista.
  // Mostra/esconde o aviso do modo POR_ITEM no form do grupo.
  window.mlGrupoSyncModo = function() {
    const modo = document.getElementById('ml-grupo-modo').value;
    const aviso = document.getElementById('ml-grupo-modo-aviso');
    if (!aviso) return;
    if (modo === 'POR_ITEM') {
      aviso.style.display = '';
      aviso.innerHTML = '\uD83D\uDCA1 As op\u00e7\u00f5es aqui s\u00e3o s\u00f3 os <strong>nomes</strong> dos tamanhos. '
                      + 'O <strong>pre\u00e7o de cada tamanho</strong> voc\u00ea define em cada item do card\u00e1pio.';
    } else {
      aviso.style.display = 'none';
    }
  };

  window.mlGrupoSyncTipo = function() {
    const tipo = document.getElementById('ml-grupo-tipo').value;
    const maxWrap = document.getElementById('ml-grupo-max-wrap');
    const minLabel = document.getElementById('ml-grupo-min-label');
    const hint = document.getElementById('ml-grupo-tipo-hint');
    if (tipo === 'UNICA') {
      if (maxWrap) maxWrap.style.display = 'none';
      if (minLabel) minLabel.textContent = 'Obrigatório escolher? (0 = opcional, 1 = sim)';
      if (hint) hint.textContent = 'Ex.: Tamanho (Broto/Grande) ou Borda (nenhuma/catupiry).';
    } else {
      if (maxWrap) maxWrap.style.display = '';
      if (minLabel) minLabel.textContent = 'Mínimo de escolhas (0 = livre)';
      if (hint) hint.textContent = 'Ex.: Acréscimos (bacon, cheddar...). Máx 0 = sem limite.';
    }
  };

  window.mlGrupoSalvar = async function() {
    const nome = document.getElementById('ml-grupo-nome').value.trim();
    const msg  = document.getElementById('ml-grupo-form-msg');
    if (!nome) { msg.textContent = '❌ Informe o nome do grupo.'; msg.style.color = 'var(--red)'; return; }
    const tipo = document.getElementById('ml-grupo-tipo').value;
    const modo = document.getElementById('ml-grupo-modo').value;
    let min = parseInt(document.getElementById('ml-grupo-min').value, 10) || 0;
    let max = parseInt(document.getElementById('ml-grupo-max').value, 10) || 0;
    const btn = document.getElementById('ml-grupo-salvar-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Salvando...'; }
    try {
      const json = await apiPost('lojaGrupoSalvar', {
        token: _lojaToken,
        id: document.getElementById('ml-grupo-edit-id').value,
        nome, tipo, precoModo: modo, min, max,
      }, { timeout: 15000, ignoreUnauthorized: true });
      if (json.status !== 'ok') throw new Error(json.msg || 'Erro');
      mlGrupoFecharForm();
      await mlGruposCarregar();
      mlToast('Grupo salvo!', 'ok');
    } catch(e) {
      if (e.message === 'UNAUTHORIZED') return;
      msg.textContent = '❌ ' + e.message; msg.style.color = 'var(--red)';
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa fa-check"></i> Salvar grupo'; }
    }
  };

  window.mlGrupoRemover = async function(id, nome) {
    const ok = await mlConfirmar('Remover grupo?', `“${nome}” e suas opções serão removidos, e desvinculados de todos os itens.`, { okLabel: 'Remover', owlSrc: '/webp/owl-sign.webp' });
    if (!ok) return;
    try {
      const json = await apiPost('lojaGrupoRemover', { token: _lojaToken, id }, { timeout: 15000, ignoreUnauthorized: true });
      if (json.status !== 'ok') { mlToast('Erro: ' + (json.msg || 'tente de novo.'), 'erro'); return; }
      if (_mlGrupoEditId === id) { _mlGrupoEditId = null; const ed = document.getElementById('ml-opcoes-editor'); if (ed) ed.style.display = 'none'; }
      if (_mlAplicarGrupoId === id) { mlAplicarFechar(); }
      await mlGruposCarregar();
      await mlCardapioCarregar(_cardapioPlano); // vinculos podem ter mudado
    } catch(e) {
      if (e.message === 'UNAUTHORIZED') return;
      mlToast('Erro: ' + e.message, 'erro');
    }
  };

  // ── Editor de opcoes de um grupo ──
  window.mlGrupoAbrirOpcoes = function(grupoId) {
    _mlGrupoEditId = grupoId;
    const g = _mlGrupos.find(x => x.id === grupoId);
    const ed = document.getElementById('ml-opcoes-editor');
    if (!g || !ed) return;
    document.getElementById('ml-opcoes-grupo-nome').textContent = g.nome;
    ed.style.display = '';
    // Abrir outro grupo cancela qualquer edicao pendente: o id em _mlOpcaoEditId
    // pertence ao grupo anterior e salvaria no lugar errado.
    _mlOpcaoEditId = null;
    mlOpcoesRenderLista();
    // limpa o form de nova opcao
    const nome = document.getElementById('ml-opcao-nome'); if (nome) nome.value = '';
    const preco = document.getElementById('ml-opcao-preco'); if (preco) preco.value = '';
    const qmax = document.getElementById('ml-opcao-qtdmax'); if (qmax) qmax.value = '';
    _mlOpcaoSyncBotoes();
    ed.scrollIntoView({ behavior:'smooth', block:'nearest' });
  };

  /* ─── Aplicar grupo em massa (por categoria) ─────────────────
     Resolve o caso real: cardapio ja montado com dezenas de itens.
     Em vez de abrir item por item, o lojista escolhe as categorias.
     O vinculo continua morando no item (coluna K) — isto e so um
     atalho de preenchimento, entao da pra ajustar item a item depois. */
  let _mlAplicarGrupoId = null;

  window.mlGrupoAbrirAplicar = function(grupoId) {
    _mlAplicarGrupoId = grupoId;
    const g = _mlGrupos.find(x => x.id === grupoId);
    const painel = document.getElementById('ml-aplicar-painel');
    if (!g || !painel) return;
    const nomeEl = document.getElementById('ml-aplicar-grupo-nome');
    if (nomeEl) nomeEl.textContent = g.nome;
    painel.style.display = '';
    mlAplicarRenderCategorias();
    painel.scrollIntoView({ behavior:'smooth', block:'nearest' });
  };

  window.mlAplicarFechar = function() {
    _mlAplicarGrupoId = null;
    const p = document.getElementById('ml-aplicar-painel');
    if (p) p.style.display = 'none';
  };

  // Monta a lista de categorias com contagem total e quantos ja tem o grupo.
  function mlAplicarRenderCategorias() {
    const lista = document.getElementById('ml-aplicar-cats');
    const gid = _mlAplicarGrupoId;
    if (!lista || !gid) return;

    const ativos = _cardapioItens.filter(i => i.ativo !== 'NAO');
    if (!ativos.length) {
      lista.innerHTML = '<div style="font-size:11px;color:var(--muted);text-align:center;padding:10px;">Nenhum item no cardápio ainda.</div>';
      return;
    }

    // Agrupa por categoria preservando ordem de aparicao (igual a lista principal).
    const porCat = {}; const ordem = [];
    ativos.forEach(item => {
      const cat = (item.categoria || '').trim() || 'Sem categoria';
      if (!porCat[cat]) { porCat[cat] = []; ordem.push(cat); }
      porCat[cat].push(item);
    });

    lista.innerHTML = ordem.map(cat => {
      const itens = porCat[cat];
      // Quantos itens desta categoria ja tem o grupo vinculado.
      const jaTem = itens.filter(it => Array.isArray(it.grupos) && it.grupos.some(gg => gg.id === gid)).length;
      const total = itens.length;
      const todos = jaTem === total;
      const status = jaTem === 0 ? ''
        : (todos ? '<span style="color:#10b981;font-weight:700;">todos já têm</span>'
                 : `<span style="color:#f59e0b;font-weight:700;">${jaTem} de ${total} já têm</span>`);
      return `<label class="ml-aplicar-cat">
        <input type="checkbox" value="${escAttr(cat)}" data-total="${total}" onchange="this.closest('.ml-aplicar-cat').classList.toggle('on', this.checked);mlAplicarAtualizarResumo()">
        <span style="flex:1;min-width:0;">
          <span style="font-family:var(--font-h);font-size:12px;font-weight:800;display:block;">${escHTML(cat)}</span>
          <span style="font-size:9px;color:var(--muted);">${total} item${total!==1?'s':''} ${status ? '· ' + status : ''}</span>
        </span>
      </label>`;
    }).join('');
    mlAplicarAtualizarResumo();
  }

  // Atualiza o contador do botao conforme as categorias marcadas.
  window.mlAplicarAtualizarResumo = function() {
    const lista = document.getElementById('ml-aplicar-cats');
    const btn   = document.getElementById('ml-aplicar-btn');
    const btnR  = document.getElementById('ml-aplicar-btn-remover');
    if (!lista || !btn) return;
    const marcadas = Array.from(lista.querySelectorAll('input[type=checkbox]:checked'));
    const totalItens = marcadas.reduce((s, c) => s + (parseInt(c.dataset.total, 10) || 0), 0);
    btn.disabled = marcadas.length === 0;
    if (btnR) btnR.disabled = marcadas.length === 0;
    btn.innerHTML = marcadas.length
      ? `<i class="fa fa-check"></i> Aplicar a ${totalItens} item${totalItens!==1?'s':''}`
      : '<i class="fa fa-check"></i> Selecione as categorias';
  };

  // Envia a aplicacao (ou remocao) em lote.
  async function _mlAplicarExecutar(modo) {
    const gid = _mlAplicarGrupoId;
    const lista = document.getElementById('ml-aplicar-cats');
    const msg = document.getElementById('ml-aplicar-msg');
    if (!gid || !lista) return;
    const marcadas = Array.from(lista.querySelectorAll('input[type=checkbox]:checked')).map(c => c.value);
    if (!marcadas.length) return;

    const g = _mlGrupos.find(x => x.id === gid);
    const nomeGrupo = g ? g.nome : 'grupo';
    if (modo === 'REMOVER') {
      const ok = await mlConfirmar('Remover dos itens?', `“${nomeGrupo}” será desvinculado dos itens dessas categorias.`, { okLabel: 'Remover', owlSrc: '/webp/owl-sign.webp' });
      if (!ok) return;
    }

    const btn  = document.getElementById('ml-aplicar-btn');
    const btnR = document.getElementById('ml-aplicar-btn-remover');
    if (btn)  btn.disabled = true;
    if (btnR) btnR.disabled = true;
    if (msg) { msg.textContent = '⏳ Aplicando...'; msg.style.color = 'var(--muted)'; }

    try {
      // Separador |~| porque nome de categoria pode conter virgula.
      const json = await apiPost('lojaGrupoAplicarEmMassa', {
        token: _lojaToken,
        grupoId: gid,
        categorias: marcadas.join('|~|'),
        modo: modo,
      }, { timeout: 30000, ignoreUnauthorized: true });
      if (json.status !== 'ok') throw new Error(json.msg || 'Erro');
      const n = (json.data && json.data.afetados) || 0;
      if (msg) {
        msg.textContent = n > 0
          ? `✅ ${n} item${n!==1?'s':''} atualizado${n!==1?'s':''}!`
          : 'ℹ️ Nada mudou (os itens já estavam assim).';
        msg.style.color = n > 0 ? 'var(--green)' : 'var(--muted)';
      }
      // Recarrega o cardapio para refletir os novos vinculos nos contadores.
      await mlCardapioCarregar(_cardapioPlano);
      mlAplicarRenderCategorias();
      setTimeout(() => { if (msg) msg.textContent = ''; }, 4000);
    } catch(e) {
      if (e.message === 'UNAUTHORIZED') return;
      if (msg) { msg.textContent = '❌ ' + e.message; msg.style.color = 'var(--red)'; }
    } finally {
      mlAplicarAtualizarResumo();
    }
  }

  window.mlAplicarConfirmar = function() { _mlAplicarExecutar('ADICIONAR'); };
  window.mlAplicarRemover   = function() { _mlAplicarExecutar('REMOVER'); };
  window.mlOpcoesFechar = function() {
    // Fechar o painel tambem encerra a edicao em andamento.
    _mlOpcaoEditId = null;
    _mlOpcaoSyncBotoes();
    _mlGrupoEditId = null;
    const ed = document.getElementById('ml-opcoes-editor');
    if (ed) ed.style.display = 'none';
  };

  function mlOpcoesRenderLista() {
    const g = _mlGrupos.find(x => x.id === _mlGrupoEditId);
    const lista = document.getElementById('ml-opcoes-lista');
    if (!g || !lista) return;
    const modoAbs = g.precoModo === 'ABSOLUTO';
    const modoPorItem = g.precoModo === 'POR_ITEM';
    const label = document.getElementById('ml-opcao-preco-label');
    if (label) {
      label.textContent = modoPorItem ? 'Preço padrão (opcional)'
                        : modoAbs      ? 'Preço final (R$)'
                                       : 'Acréscimo (R$, 0 = grátis)';
    }
    // No modo POR_ITEM o preco de verdade vem do item; explica isso na lista.
    const dicaEl = document.getElementById('ml-opcoes-dica');
    if (dicaEl) {
      dicaEl.style.display = modoPorItem ? '' : 'none';
      dicaEl.textContent = 'Cada item do cardápio define o preço destes tamanhos. '
                         + 'Edite um item para preencher.';
    }
    // Repetir a mesma opcao so faz sentido em MULTIPLA + DELTA: em UNICA a
    // escolha e exclusiva e em ABSOLUTO o preco substitui a base do item.
    const podeRepetir = !modoAbs && g.tipo !== 'UNICA';
    const qtdWrap = document.getElementById('ml-opcao-qtdmax-wrap');
    if (qtdWrap) qtdWrap.style.display = podeRepetir ? '' : 'none';
    if (!podeRepetir) { const qi = document.getElementById('ml-opcao-qtdmax'); if (qi) qi.value = ''; }
    if (!g.opcoes.length) {
      lista.innerHTML = `<div style="text-align:center;padding:12px;color:var(--muted);font-size:11px;">Nenhuma opção. Adicione abaixo.</div>`;
      return;
    }
    lista.innerHTML = g.opcoes.map(op => {
      const p = parseFloat(op.preco) || 0;
      const precoTxt = modoPorItem ? 'definido no item'
                     : modoAbs      ? 'R$ ' + p.toFixed(2).replace('.',',')
                     : (p > 0 ? '+ R$ ' + p.toFixed(2).replace('.',',') : 'grátis');
      // Badge so aparece quando a opcao realmente repete (qtdMax > 1).
      const qMax = parseInt(op.qtdMax, 10) || 0;
      const qBadge = (podeRepetir && qMax > 1)
        ? `<span style="font-size:9px;font-weight:800;color:#7c3aed;background:rgba(124,58,237,0.12);border-radius:5px;padding:2px 5px;margin-right:6px;">até ${qMax}x</span>`
        : '';
      // Linha em edicao ganha borda roxa, p/ o lojista saber o que o form edita.
      const emEdicao = (_mlOpcaoEditId === op.id);
      return `<div class="ml-opcao-row${emEdicao ? ' editando' : ''}">
        <span style="flex:1;font-size:12px;font-weight:600;">${escHTML(op.nome)}</span>
        ${qBadge}
        <span style="font-size:11px;color:var(--green);font-weight:700;margin-right:6px;">${precoTxt}</span>
        <button onclick="mlOpcaoEditar('${op.id}')" aria-label="Editar ${escAttr(op.nome)}" style="padding:4px 8px;border-radius:6px;background:var(--surface);border:1px solid var(--border);color:var(--text);font-size:10px;cursor:pointer;"><i class="fa fa-pencil"></i></button>
        <button onclick="mlOpcaoRemover('${op.id}','${escAttr(op.nome)}')" style="padding:4px 8px;border-radius:6px;background:rgba(255,68,68,0.08);border:1px solid rgba(255,68,68,0.2);color:var(--red);font-size:10px;cursor:pointer;"><i class="fa fa-trash"></i></button>
      </div>`;
    }).join('');
  }

  // Carrega uma opcao existente no form, que passa a operar em modo edicao.
  // Reusa o mesmo form da criacao — so muda o rotulo do botao e o estado.
  window.mlOpcaoEditar = function(opcaoId) {
    const g = _mlGrupos.find(x => x.id === _mlGrupoEditId); if (!g) return;
    const op = (g.opcoes || []).find(o => o.id === opcaoId); if (!op) return;
    _mlOpcaoEditId = opcaoId;
    const nomeEl  = document.getElementById('ml-opcao-nome');
    const precoEl = document.getElementById('ml-opcao-preco');
    const qtdEl   = document.getElementById('ml-opcao-qtdmax');
    if (nomeEl)  nomeEl.value  = op.nome || '';
    // Preco vem numerico do backend; exibe no formato brasileiro pra edicao.
    if (precoEl) precoEl.value = (parseFloat(op.preco) || 0).toFixed(2).replace('.', ',');
    if (qtdEl) {
      const q = parseInt(op.qtdMax, 10) || 0;
      qtdEl.value = q > 1 ? String(q) : '';
    }
    const msg = document.getElementById('ml-opcao-form-msg');
    if (msg) msg.textContent = '';
    mlOpcoesRenderLista();   // redesenha p/ marcar a linha em edicao
    _mlOpcaoSyncBotoes();
    setTimeout(() => nomeEl?.focus(), 60);
  };

  // Volta o form para o modo 'criar nova opcao'.
  window.mlOpcaoCancelarEdicao = function() {
    _mlOpcaoEditId = null;
    const nomeEl  = document.getElementById('ml-opcao-nome');
    const precoEl = document.getElementById('ml-opcao-preco');
    const qtdEl   = document.getElementById('ml-opcao-qtdmax');
    if (nomeEl)  nomeEl.value  = '';
    if (precoEl) precoEl.value = '';
    if (qtdEl)   qtdEl.value   = '';
    const msg = document.getElementById('ml-opcao-form-msg');
    if (msg) msg.textContent = '';
    mlOpcoesRenderLista();
    _mlOpcaoSyncBotoes();
  };

  // Ajusta rotulo do botao principal e visibilidade do 'Cancelar' conforme
  // o modo (criar x editar). Chamado sempre que _mlOpcaoEditId muda.
  function _mlOpcaoSyncBotoes() {
    const btn = document.getElementById('ml-opcao-add-btn');
    const cancelar = document.getElementById('ml-opcao-cancelar-btn');
    const editando = !!_mlOpcaoEditId;
    if (btn) btn.innerHTML = editando
      ? '<i class="fa fa-check"></i> Salvar alteração'
      : '<i class="fa fa-plus"></i> Adicionar';
    if (cancelar) cancelar.style.display = editando ? '' : 'none';
  }

  window.mlOpcaoSalvar = async function() {
    const g = _mlGrupos.find(x => x.id === _mlGrupoEditId);
    if (!g) return;
    const nome = document.getElementById('ml-opcao-nome').value.trim();
    const precoRaw = document.getElementById('ml-opcao-preco').value;
    const msg = document.getElementById('ml-opcao-form-msg');
    if (!nome) { if (msg) { msg.textContent = '❌ Informe o nome.'; msg.style.color = 'var(--red)'; } return; }
    const preco = parseFloat(String(precoRaw).replace(/[^\d,.-]/g,'').replace(',','.'));
    if (isNaN(preco) || preco < 0) { if (msg) { msg.textContent = '❌ Preço inválido.'; msg.style.color = 'var(--red)'; } return; }
    // Repeticao: vazio/0/1 = opcao simples. Só vale em MULTIPLA + DELTA.
    const podeRepetir = g.precoModo !== 'ABSOLUTO' && g.tipo !== 'UNICA';
    let qtdMax = 0;
    if (podeRepetir) {
      const qRaw = String(document.getElementById('ml-opcao-qtdmax')?.value || '').trim();
      if (qRaw) {
        qtdMax = parseInt(qRaw, 10);
        if (isNaN(qtdMax) || qtdMax < 0 || qtdMax > 99) {
          if (msg) { msg.textContent = '❌ Repetição inválida (0 a 99).'; msg.style.color = 'var(--red)'; }
          return;
        }
      }
    }
    const btn = document.getElementById('ml-opcao-add-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i>'; }
    // Em edicao envia o id (backend faz update) e PRESERVA a ordem atual —
    // recalcular como length+1 jogaria a opcao editada para o fim da lista.
    const editandoId = _mlOpcaoEditId;
    const opAtual = editandoId ? (g.opcoes || []).find(o => o.id === editandoId) : null;
    const ordemEnviar = editandoId
      ? (parseInt(opAtual && opAtual.ordem, 10) || 0)
      : (g.opcoes.length + 1);
    try {
      const json = await apiPost('lojaOpcaoSalvar', {
        token: _lojaToken, grupoId: g.id, nome, preco, qtdMax,
        id: editandoId || '',
        ordem: ordemEnviar,
      }, { timeout: 15000, ignoreUnauthorized: true });
      if (json.status !== 'ok') throw new Error(json.msg || 'Erro');
      document.getElementById('ml-opcao-nome').value = '';
      document.getElementById('ml-opcao-preco').value = '';
      const _qi = document.getElementById('ml-opcao-qtdmax'); if (_qi) _qi.value = '';
      // Sai do modo edicao ANTES de redesenhar, senao a linha continua marcada.
      _mlOpcaoEditId = null;
      if (msg) {
        msg.textContent = editandoId ? '✅ Opção atualizada.' : '';
        msg.style.color = 'var(--green)';
        if (editandoId) setTimeout(() => { if (msg) msg.textContent = ''; }, 2500);
      }
      await mlGruposCarregar();
      // reabre o editor no mesmo grupo (dados atualizados)
      mlOpcoesRenderLista();
      _mlOpcaoSyncBotoes();
      setTimeout(() => document.getElementById('ml-opcao-nome')?.focus(), 60);
    } catch(e) {
      if (e.message === 'UNAUTHORIZED') return;
      if (msg) { msg.textContent = '❌ ' + e.message; msg.style.color = 'var(--red)'; }
    } finally {
      // _mlOpcaoSyncBotoes decide o rotulo: se o salvamento falhou continuamos
      // em edicao e o botao precisa voltar como 'Salvar alteração'.
      if (btn) btn.disabled = false;
      _mlOpcaoSyncBotoes();
    }
  };

  window.mlOpcaoRemover = async function(id, nome) {
    const ok = await mlConfirmar('Remover opção?', `“${nome}” será removida do grupo.`, { okLabel: 'Remover', owlSrc: '/webp/owl-sign.webp' });
    if (!ok) return;
    try {
      const json = await apiPost('lojaOpcaoRemover', { token: _lojaToken, id }, { timeout: 15000, ignoreUnauthorized: true });
      if (json.status !== 'ok') { mlToast('Erro: ' + (json.msg || 'tente de novo.'), 'erro'); return; }
      // Se a opcao removida era a que estava no form, sai do modo edicao —
      // senao 'Salvar alteração' apontaria para um id que nao existe mais.
      if (_mlOpcaoEditId === id) {
        _mlOpcaoEditId = null;
        const _n = document.getElementById('ml-opcao-nome');   if (_n) _n.value = '';
        const _p = document.getElementById('ml-opcao-preco');  if (_p) _p.value = '';
        const _q = document.getElementById('ml-opcao-qtdmax'); if (_q) _q.value = '';
      }
      await mlGruposCarregar();
      mlOpcoesRenderLista();
      _mlOpcaoSyncBotoes();
    } catch(e) {
      if (e.message === 'UNAUTHORIZED') return;
      mlToast('Erro: ' + e.message, 'erro');
    }
  };

  // ── Vinculo item -> grupos (checkboxes no form do item) ──
  // Renderiza a lista de grupos disponiveis com o estado atual do item.
  function mlRenderVinculoGrupos(item) {
    const wrap = document.getElementById('ml-cardapio-grupos-wrap');
    const lista = document.getElementById('ml-cardapio-grupos-lista');
    if (!wrap || !lista) return;
    // So faz sentido no PRO e se ha grupos criados.
    if (_cardapioPlano !== 'PRO' || !_mlGrupos.length) { wrap.style.display = 'none'; return; }
    wrap.style.display = '';
    const vinculados = (item && Array.isArray(item.grupos)) ? item.grupos.map(g => g.id) : [];
    lista.innerHTML = _mlGrupos.map(g => {
      const on = vinculados.indexOf(g.id) >= 0;
      return `<label class="ml-vinculo-chip${on?' on':''}">
        <input type="checkbox" value="${g.id}" ${on?'checked':''} style="display:none;" onchange="this.parentNode.classList.toggle('on', this.checked);mlSyncPrecosPorItem()">
        <i class="fa fa-${on?'check-':''}circle"></i> ${escHTML(g.nome)}
      </label>`;
    }).join('');
  }

  // Chamada pelo onchange dos chips: re-renderiza os campos de preco
  // preservando o que ja foi digitado (para nao perder valores ao marcar
  // outro grupo antes de salvar).
  window.mlSyncPrecosPorItem = function() {
    const atuais = mlLerPrecosPorItem();
    const editId = document.getElementById('ml-cardapio-edit-id').value;
    const itemSalvo = editId ? _cardapioItens.find(i => i.id === editId) : null;
    // Mescla: o que esta na tela vence o que estava salvo.
    const merged = Object.assign({}, (itemSalvo && itemSalvo.precosOpcao) || {}, atuais);
    mlRenderPrecosPorItem({ precosOpcao: merged });
  };

  // Campos de preco por tamanho (grupos POR_ITEM vinculados ao item).
  // Aparecem no form do item logo abaixo dos chips de vinculo.
  function mlRenderPrecosPorItem(item) {
    const wrap  = document.getElementById('ml-cardapio-precos-wrap');
    const lista = document.getElementById('ml-cardapio-precos-lista');
    if (!wrap || !lista) return;

    // Quais grupos POR_ITEM estao vinculados a este item? Usa os chips
    // marcados (estado atual da tela), nao o item salvo — assim o lojista
    // marca 'Tamanho' e os campos aparecem na hora.
    const vinculados = mlLerVinculoGrupos();
    const gruposPI = _mlGrupos.filter(g => g.precoModo === 'POR_ITEM' && vinculados.indexOf(g.id) >= 0);
    if (!gruposPI.length) { wrap.style.display = 'none'; lista.innerHTML = ''; return; }

    const precos = (item && item.precosOpcao) || {};
    wrap.style.display = '';
    lista.innerHTML = gruposPI.map(g => {
      const campos = (g.opcoes || []).map(op => {
        const v = (precos[op.id] != null) ? precos[op.id] : '';
        return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
            <span style="flex:1;font-size:12px;font-weight:600;color:var(--text);">${escHTML(op.nome)}</span>
            <div style="display:flex;align-items:center;gap:4px;">
              <span style="font-size:11px;color:var(--muted);">R$</span>
              <input type="text" inputmode="decimal" class="ml-preco-opcao"
                data-opcao-id="${escAttr(op.id)}" value="${escAttr(String(v).replace('.',','))}"
                placeholder="0,00"
                style="width:82px;background:var(--surface2);border:1px solid var(--border);border-radius:7px;padding:7px;font-size:13px;color:var(--text);text-align:right;">
            </div>
          </div>`;
      }).join('');
      return `<div style="margin-bottom:8px;">
          <div style="font-size:10px;font-weight:700;color:#7c3aed;text-transform:uppercase;margin-bottom:5px;">${escHTML(g.nome)}</div>
          ${campos}
        </div>`;
    }).join('');
  }

  // Le os campos de preco por tamanho. Vazio = nao definido (cai no base).
  function mlLerPrecosPorItem() {
    const lista = document.getElementById('ml-cardapio-precos-lista');
    if (!lista) return {};
    const out = {};
    lista.querySelectorAll('.ml-preco-opcao').forEach(inp => {
      const id = inp.dataset.opcaoId;
      const raw = String(inp.value || '').trim();
      if (!id || !raw) return;
      const v = parseFloat(raw.replace(/[^\d,.-]/g,'').replace(',','.'));
      if (!isNaN(v) && v >= 0) out[id] = v;
    });
    return out;
  }

  // Le os checkboxes marcados no form do item.
  function mlLerVinculoGrupos() {
    const lista = document.getElementById('ml-cardapio-grupos-lista');
    if (!lista) return [];
    return Array.from(lista.querySelectorAll('input[type=checkbox]:checked')).map(c => c.value);
  }

  function mlCardapioRenderLista() {
    const lista  = document.getElementById('ml-cardapio-lista');
    const limite = document.getElementById('ml-cardapio-limite');
    if (!lista) return;

    const isPro   = _cardapioPlano === 'PRO';
    const ativos  = _cardapioItens.filter(i => i.ativo !== 'NAO');

    if (limite) {
      // Fix #7: restaura cor padrão (mlCardapioAbrirForm pinta de vermelho ao bloquear)
      limite.style.color = 'var(--muted)';
      const restam = PLUS_LIMITE_ITENS - ativos.length;
      if (isPro) {
        limite.textContent = `${ativos.length} item${ativos.length !== 1 ? 's' : ''} no cardápio`;
        limite.style.color = 'var(--muted)';
      } else if (restam < 0) {
        // Acima do limite: avisa que itens extras ficam ocultos no app
        limite.textContent = `${ativos.length}/${PLUS_LIMITE_ITENS} itens · ${Math.abs(restam)} oculto${Math.abs(restam)!==1?'s':''} no app (faça upgrade para PRO)`;
        limite.style.color = 'var(--orange, #f59e0b)';
      } else {
        limite.textContent = `${ativos.length}/${PLUS_LIMITE_ITENS} itens · ${restam} restante${restam!==1?'s':''}`;
        limite.style.color = 'var(--muted)';
      }
    }

    // Mostra busca apenas para PRO com itens suficientes para justificar
    const buscaWrap = document.getElementById('ml-cardapio-busca-wrap');
    if (buscaWrap) buscaWrap.style.display = (isPro && ativos.length >= 6) ? '' : 'none';

    if (ativos.length === 0) {
      lista.innerHTML = `<div style="text-align:center;padding:24px 16px 20px;color:var(--muted);">
        <img src="/webp/owl-idea.webp" alt="" style="width:72px;height:72px;object-fit:contain;margin-bottom:8px;opacity:.9;" onerror="this.style.display='none'" />
        <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:4px;">Cardápio vazio</div>
        <div style="font-size:11px;line-height:1.5;">Clique em <strong style="color:var(--green);">+ Adicionar</strong> para incluir<br>seu primeiro produto ou serviço.</div>
      </div>`;
      return;
    }

    // Aplica filtro de busca (em memória)
    const termo = (_cardapioBusca || '').trim().toLowerCase();
    const visiveis = termo
      ? ativos.filter(i => (i.nome||'').toLowerCase().includes(termo) || (i.categoria||'').toLowerCase().includes(termo))
      : ativos;

    if (visiveis.length === 0) {
      lista.innerHTML = `<div style="text-align:center;padding:20px;color:var(--muted);font-size:12px;">
        Nenhum item encontrado para "<strong>${escHTML(termo)}</strong>".
      </div>`;
      return;
    }

    // PRO + sem busca ativa + tem categorias → agrupa em seções colapsáveis
    const usarGrupos = isPro && !termo && ativos.some(i => i.categoria);

    if (!usarGrupos) {
      lista.innerHTML = visiveis.map(mlCardapioItemHTML).join('');
      return;
    }

    // Agrupa por categoria. A ordem espelha exatamente a do cardápio público:
    // catOrdem primeiro, ordem de aparição como desempate/legado.
    const grupos = {};
    const ordemDef = {};   // categoria -> menor catOrdem
    const apareceu = {};   // categoria -> índice de primeira aparição
    visiveis.forEach((item, i) => {
      const cat = (item.categoria || '').trim() || 'Sem categoria';
      if (!grupos[cat]) { grupos[cat] = []; apareceu[cat] = i; }
      grupos[cat].push(item);
      const o = parseInt(item.catOrdem, 10) || 0;
      if (o > 0 && (ordemDef[cat] === undefined || o < ordemDef[cat])) ordemDef[cat] = o;
    });
    const ordemCats = Object.keys(grupos).sort((a, b) => {
      const oa = ordemDef[a] || 0, ob = ordemDef[b] || 0;
      if (oa && ob) return oa - ob;
      if (oa) return -1;
      if (ob) return 1;
      return apareceu[a] - apareceu[b];
    });
    // Guarda a ordem corrente para as setas ↑/↓ saberem quem troca com quem.
    _cardapioOrdemAtual = ordemCats.slice();

    const totalCats = ordemCats.length;
    lista.innerHTML = ordemCats.map((cat, idx) => {
      const aberto = _cardapioGruposFechados[cat] === true; // padrão: fechado — lojista expande
      const itens = grupos[cat].map(mlCardapioItemHTML).join('');
      // Quantos itens do grupo ainda estão sem foto — alimenta o badge do botão
      const semFoto = grupos[cat].filter(i => !i.foto).length;
      return `
        <div class="ml-cardapio-grupo">
          <div class="ml-cardapio-grupo-row">
            <button type="button" class="ml-cardapio-grupo-head" onclick="mlCardapioToggleGrupo('${escAttr(cat)}')">
              <span><i class="fa fa-chevron-${aberto ? 'down' : 'right'}" style="font-size:9px;margin-right:6px;opacity:.7;"></i>${escHTML(cat)}</span>
              <span class="ml-cardapio-grupo-count">${grupos[cat].length}</span>
            </button>
            <button type="button" class="ml-cardapio-grupo-foto"
              title="Aplicar uma foto a todos os itens de ${escAttr(cat)}"
              aria-label="Aplicar foto a todos os itens de ${escAttr(cat)}"
              onclick="mlCardapioFotoLoteAbrir('${escAttr(cat)}')">
              <i class="fa fa-camera"></i>
              ${semFoto ? `<span class="ml-cardapio-grupo-foto-badge">${semFoto}</span>` : ''}
            </button>
          </div>
          <div class="ml-cardapio-grupo-acoes">
            <button type="button" class="ml-cat-acao" ${idx === 0 ? 'disabled' : ''}
              title="Mover para cima" aria-label="Mover ${escAttr(cat)} para cima"
              onclick="mlCategoriaMover('${escAttr(cat)}',-1)">
              <i class="fa fa-arrow-up"></i>
            </button>
            <button type="button" class="ml-cat-acao" ${idx === totalCats - 1 ? 'disabled' : ''}
              title="Mover para baixo" aria-label="Mover ${escAttr(cat)} para baixo"
              onclick="mlCategoriaMover('${escAttr(cat)}',1)">
              <i class="fa fa-arrow-down"></i>
            </button>
            <button type="button" class="ml-cat-acao ml-cat-acao-txt"
              title="Renomear categoria" aria-label="Renomear ${escAttr(cat)}"
              onclick="mlCategoriaRenomear('${escAttr(cat)}')">
              <i class="fa fa-pencil"></i> Renomear
            </button>
          </div>
          <div class="ml-cardapio-grupo-body" style="display:${aberto ? 'flex' : 'none'};">${itens}</div>
        </div>`;
    }).join('');
  }

  // HTML de um único item do cardápio (reutilizado em lista plana e agrupada)
  function mlCardapioItemHTML(item) {
    return `
      <div class="ml-cardapio-item">
        ${item.foto
          ? `<img loading="lazy" decoding="async" src="${item.foto}" class="ml-cardapio-item-foto" onerror="this.style.display='none'">`
          : `<div class="ml-cardapio-item-foto" style="display:flex;align-items:center;justify-content:center;font-size:1.2rem;">${_ccEmojiItem(item, '🍽️')}</div>`}
        <div style="flex:1;min-width:0;">
          <div style="font-family:var(--font-h);font-size:12px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHTML(item.nome)}</div>
          ${item.categoria ? `<div style="font-size:9px;color:var(--muted);text-transform:uppercase;margin-top:1px;">${escHTML(item.categoria)}</div>` : ''}
          <div style="font-size:12px;font-weight:700;color:var(--green);margin-top:3px;">R$ ${(parseFloat(item.preco) || 0).toFixed(2).replace('.',',')}</div>
        </div>
        <div style="display:flex;gap:6px;flex-shrink:0;">
          <button onclick="mlCardapioAbrirForm('${item.id}')"
            style="padding:6px 10px;border-radius:7px;background:var(--surface);border:1px solid var(--border);color:var(--text);font-size:10px;font-weight:700;cursor:pointer;">
            <i class="fa fa-pencil"></i>
          </button>
          <button onclick="mlCardapioRemover('${item.id}','${escAttr(item.nome)}')"
            style="padding:6px 10px;border-radius:7px;background:rgba(255,68,68,0.08);border:1px solid rgba(255,68,68,0.2);color:var(--red);font-size:10px;font-weight:700;cursor:pointer;">
            <i class="fa fa-trash"></i>
          </button>
        </div>
      </div>`;
  }

  // Busca: filtra em memória e re-renderiza
  function mlCardapioFiltrar(termo) {
    _cardapioBusca = termo || '';
    mlCardapioRenderLista();
  }

  // Colapsa/expande um grupo de categoria
  function mlCardapioToggleGrupo(cat) {
    _cardapioGruposFechados[cat] = !_cardapioGruposFechados[cat];
    mlCardapioRenderLista();
  }

  function mlCardapioAbrirForm(editId) {
    const form = document.getElementById('ml-cardapio-form');
    if (!form) return;
    // Fix #7: PLUS é limitado a 5 itens — bloqueia abrir form para NOVO item ao atingir o limite
    if (!editId && _cardapioPlano !== 'PRO') {
      const ativos = _cardapioItens.filter(i => i.ativo !== 'NAO').length;
      if (ativos >= PLUS_LIMITE_ITENS) {
        const limiteEl = document.getElementById('ml-cardapio-limite');
        if (limiteEl) {
          limiteEl.textContent = `⚠️ Limite de ${PLUS_LIMITE_ITENS} itens do plano PLUS atingido. Faça upgrade para PRO para itens ilimitados.`;
          limiteEl.style.color = 'var(--red)';
          setTimeout(() => { mlCardapioRenderLista(); }, 4000); // restaura o texto normal do contador
        }
        return;
      }
    }
    form.style.display = '';
    document.getElementById('ml-cardapio-form-msg').textContent = '';

    if (editId) {
      const item = _cardapioItens.find(i => i.id === editId);
      if (!item) return;
      document.getElementById('ml-cardapio-form-title').textContent = 'Editar item';
      document.getElementById('ml-cardapio-edit-id').value = editId;
      document.getElementById('ml-cardapio-nome').value    = item.nome;
      document.getElementById('ml-cardapio-desc').value    = item.descricao || '';
      document.getElementById('ml-cardapio-preco').value   = item.preco;
      document.getElementById('ml-cardapio-cat').value     = item.categoria || '';
      document.getElementById('ml-cardapio-foto-url').value = item.foto || '';
      const destaqueChk = document.getElementById('ml-cardapio-destaque');
      if (destaqueChk) destaqueChk.checked = item.destaque === 'SIM';
      const prev = document.getElementById('ml-cardapio-foto-preview');
      if (prev) prev.innerHTML = item.foto
        ? `<img src="${item.foto}" style="width:100%;height:100%;object-fit:cover;border-radius:9px;">`
        : '<i class="fa fa-image" style="color:var(--muted);font-size:1.2rem;"></i>';
      mlRenderVinculoGrupos(item);
      mlRenderPrecosPorItem(item);
    } else {
      document.getElementById('ml-cardapio-form-title').textContent = 'Novo item';
      document.getElementById('ml-cardapio-edit-id').value = '';
      document.getElementById('ml-cardapio-nome').value    = '';
      document.getElementById('ml-cardapio-desc').value    = '';
      document.getElementById('ml-cardapio-preco').value   = '';
      document.getElementById('ml-cardapio-cat').value     = '';
      document.getElementById('ml-cardapio-foto-url').value = '';
      const destaqueChkN = document.getElementById('ml-cardapio-destaque');
      if (destaqueChkN) destaqueChkN.checked = false;
      const prev = document.getElementById('ml-cardapio-foto-preview');
      if (prev) prev.innerHTML = '<i class="fa fa-image" style="color:var(--muted);font-size:1.2rem;"></i>';
      mlRenderVinculoGrupos(null);
      mlRenderPrecosPorItem(null);
    }
    form.scrollIntoView({ behavior:'smooth', block:'nearest' });
  }

  function mlCardapioFecharForm() {
    document.getElementById('ml-cardapio-form').style.display = 'none';
  }

  /* ─────────────────────────────────────────────────────
     CATEGORIAS — renomear e reordenar
     Categoria não é entidade própria: é o texto da coluna
     Categoria repetido em cada item. Por isso renomear é
     uma operação em lote no backend, e a ordem mora numa
     coluna (CatOrdem) replicada nos itens da categoria.
  ───────────────────────────────────────────────────── */
  let _cardapioOrdemAtual = [];
  let _catOperacaoEmAndamento = false;

  // Envia a ordem corrente inteira; o backend grava o índice de cada
  // categoria em todos os itens dela.
  async function _mlCategoriasSalvarOrdem(ordem) {
    const json = await apiPost('lojaCategoriasReordenar', {
      token: _lojaToken,
      ordem: ordem.filter(c => c !== 'Sem categoria').join('|||'),
    }, { timeout: 30000 });
    if (json.status !== 'ok') throw new Error(json.msg || 'Erro ao salvar ordem');
    return json;
  }

  async function mlCategoriaMover(cat, delta) {
    if (_catOperacaoEmAndamento) return;
    const ordem = _cardapioOrdemAtual.slice();
    const i = ordem.indexOf(cat);
    const j = i + delta;
    if (i === -1 || j < 0 || j >= ordem.length) return;
    // Troca as duas posições
    const tmp = ordem[i]; ordem[i] = ordem[j]; ordem[j] = tmp;

    _catOperacaoEmAndamento = true;
    // Otimista: reordena na tela antes da resposta para o toque parecer
    // instantâneo. Se o servidor recusar, mlCardapioCarregar restaura.
    _cardapioOrdemAtual = ordem;
    try {
      await _mlCategoriasSalvarOrdem(ordem);
      await mlCardapioCarregar(_cardapioPlano);
    } catch (e) {
      if (e.message !== 'UNAUTHORIZED') {
        mlToast('Não foi possível salvar a ordem: ' + e.message, 'erro');
        await mlCardapioCarregar(_cardapioPlano);
      }
    } finally {
      _catOperacaoEmAndamento = false;
    }
  }

  async function mlCategoriaRenomear(cat) {
    if (_catOperacaoEmAndamento) return;
    if (cat === 'Sem categoria') {
      mlAviso('Categoria automática',
        'Os itens sem categoria aparecem juntos aqui. Para nomear esse grupo, edite os itens e preencha o campo Categoria.',
        '/webp/owl-tip.webp');
      return;
    }
    const qtd = (_cardapioItens || []).filter(i =>
      i.ativo !== 'NAO' && ((i.categoria || '').trim() || 'Sem categoria') === cat).length;

    const novo = await mlPrompt('Renomear categoria',
      `O novo nome será aplicado aos ${qtd} item(ns) de "${cat}".`,
      { valor: cat, maxlength: 40, okLabel: 'Renomear', placeholder: 'Nome da categoria' });
    if (novo === null) return;                 // cancelou
    const limpo = String(novo).trim();
    if (!limpo || limpo === cat) return;       // vazio ou sem mudança

    _catOperacaoEmAndamento = true;
    try {
      const json = await apiPost('lojaCategoriaRenomear', {
        token: _lojaToken, de: cat, para: limpo,
      }, { timeout: 30000 });
      if (json.status !== 'ok') throw new Error(json.msg || 'Erro ao renomear');
      // O estado de expandido/colapsado é indexado pelo nome: migra a chave
      // para o nome novo, senão a categoria renomeada volta fechada.
      if (_cardapioGruposFechados[cat] !== undefined) {
        _cardapioGruposFechados[limpo] = _cardapioGruposFechados[cat];
        delete _cardapioGruposFechados[cat];
      }
      // A ordem é gravada por nome; reenvia com o nome novo no mesmo lugar.
      const idx = _cardapioOrdemAtual.indexOf(cat);
      if (idx !== -1) {
        const ordem = _cardapioOrdemAtual.slice();
        ordem[idx] = limpo;
        try { await _mlCategoriasSalvarOrdem(ordem); } catch (e) { /* ordem é secundária */ }
      }
      await mlCardapioCarregar(_cardapioPlano);
      mlToast(json.data && json.data.msg ? json.data.msg : 'Categoria renomeada', 'ok');
    } catch (e) {
      if (e.message !== 'UNAUTHORIZED') mlToast('Erro: ' + e.message, 'erro');
    } finally {
      _catOperacaoEmAndamento = false;
    }
  }

  window.mlCategoriaMover    = mlCategoriaMover;
  window.mlCategoriaRenomear = mlCategoriaRenomear;

  /* ─────────────────────────────────────────────────────
     FOTO EM LOTE — uma imagem para todos os itens de uma categoria
     Fluxo: escolhe arquivo → 1 upload no Cloudinary → 1 POST no GAS
     que grava a mesma URL em todas as linhas da categoria.
     Sem isso, aplicar foto em 19 itens seriam 19 requisições.
  ───────────────────────────────────────────────────── */
  let _fotoLoteCategoria = null;

  function mlCardapioFotoLoteAbrir(cat) {
    // Recurso de plano pago — igual à foto unitária.
    if (_cardapioPlano !== 'PRO' && _cardapioPlano !== 'PLUS') {
      mlAviso('Recurso do plano Plus', 'Fotos nos itens do cardápio fazem parte dos planos Plus e Pro.', '/webp/owl-tip.webp');
      return;
    }
    _fotoLoteCategoria = cat;
    const input = document.getElementById('ml-cardapio-lote-input');
    if (!input) return;
    input.value = ''; // permite reescolher o mesmo arquivo
    input.click();
  }

  async function mlCardapioFotoLoteSelecionado(input) {
    const file = input.files && input.files[0];
    const cat  = _fotoLoteCategoria;
    if (!file || cat === null || cat === undefined) return;

    const itensCat = _cardapioItens.filter(i =>
      i.ativo !== 'NAO' &&
      ((i.categoria || '').trim() || 'Sem categoria') === cat
    );
    if (!itensCat.length) return;

    const comFoto = itensCat.filter(i => i.foto).length;
    const total   = itensCat.length;

    // Se alguns já têm foto, pergunta se sobrescreve — evita apagar
    // trabalho que o lojista já teve.
    let somenteSemFoto = false;
    if (comFoto > 0) {
      const manter = await mlConfirmar(
        'Alguns itens já têm foto',
        `${comFoto} de ${total} itens de "${cat}" já têm foto própria.\n\nQuer manter essas fotos e preencher só os ${total - comFoto} que estão sem?`,
        { okLabel: 'Manter as existentes', cancelLabel: 'Substituir todas', owlSrc: '/webp/owl-tip.webp' }
      );
      somenteSemFoto = !!manter;
      if (somenteSemFoto && total - comFoto === 0) return;
    }

    const msgEl = document.getElementById('ml-cardapio-lote-msg');
    const alvo  = somenteSemFoto ? (total - comFoto) : total;
    if (msgEl) {
      msgEl.style.display = '';
      msgEl.style.color = 'var(--muted)';
      msgEl.textContent = '\u23F3 Otimizando imagem...';
    }

    _cardapioUploadEmAndamento = true;
    try {
      // 1 upload só — a mesma URL é reaproveitada em todos os itens
      const url = await uploadImagem(file, msgEl || { textContent: '', style: {} });
      if (!url) return;

      if (msgEl) msgEl.textContent = `\u23F3 Aplicando em ${alvo} item(ns)...`;

      const json = await apiPost('lojaCardapioFotoLote', {
        token: _lojaToken,
        categoria: cat === 'Sem categoria' ? '' : cat,
        foto: url,
        somenteSemFoto: somenteSemFoto ? 'SIM' : 'NAO',
      }, { timeout: 30000 });

      if (json.status !== 'ok') throw new Error(json.msg || 'Erro ao aplicar foto');

      await mlCardapioCarregar(_cardapioPlano);
      if (msgEl) {
        msgEl.style.color = 'var(--green)';
        msgEl.textContent = '\u2705 ' + (json.data && json.data.msg ? json.data.msg : 'Foto aplicada!');
        setTimeout(() => { msgEl.textContent = ''; msgEl.style.display = 'none'; }, 3000);
      }
    } catch (e) {
      if (e.message === 'UNAUTHORIZED') return;
      if (msgEl) {
        msgEl.style.color = 'var(--red)';
        msgEl.textContent = '\u274C ' + e.message;
      }
    } finally {
      _cardapioUploadEmAndamento = false;
      _fotoLoteCategoria = null;
      input.value = '';
    }
  }

  window.mlCardapioFotoLoteAbrir      = mlCardapioFotoLoteAbrir;
  window.mlCardapioFotoLoteSelecionado = mlCardapioFotoLoteSelecionado;

  async function mlCardapioFotoPreview(input) {
    const file = input.files[0];
    if (!file) return;
    const prev = document.getElementById('ml-cardapio-foto-preview');
    const msgEl = document.getElementById('ml-cardapio-form-msg');
    // Preview local
    const reader = new FileReader();
    reader.onload = e => {
      prev.innerHTML = `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover;border-radius:9px;">`;
    };
    reader.readAsDataURL(file);
    // Item 13: sem barreira antecipada de 5MB — uploadImagem() reduz antes de validar.
    // Upload via proxy (Apps Script → ImgBB) — chave nunca exposta no JS
    msgEl.textContent = '⏳ Enviando foto...';
    _cardapioUploadEmAndamento = true;
    try {
      const url = await uploadImagem(file, msgEl);
      if (url) {
        document.getElementById('ml-cardapio-foto-url').value = url;
        setTimeout(() => { msgEl.textContent = ''; }, 2000);
      }
    } finally {
      _cardapioUploadEmAndamento = false;
    }
  }

  window.mlCardapioFotoPreview = mlCardapioFotoPreview;

  /* ─────────────────────────────────────────────────────
     PAINEL MINHA LOJA — funções das abas e hero
  ───────────────────────────────────────────────────── */

  window.mlSwitchTab = function(tab) {
    document.querySelectorAll('.ml-tab-content').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.ml-tab-btn').forEach(btn => {
      btn.classList.remove('ml-tab-active');
      btn.style.color = 'var(--muted)';
      btn.style.borderBottomColor = 'transparent';
    });
    var content = document.getElementById('ml-tab-' + tab);
    if (content) content.style.display = '';
    var btn = document.querySelector('.ml-tab-btn[data-tab="' + tab + '"]');
    if (btn) {
      btn.classList.add('ml-tab-active');
      btn.style.color = 'var(--red)';
      btn.style.borderBottomColor = 'var(--red)';
    }
  };

  window.mlAplicarTemplate = function(btn) {
    var tpl = btn.dataset.tpl;
    if (!tpl) return;
    var textarea = document.getElementById('ml-anuncio-texto');
    if (!textarea) return;
    textarea.value = tpl;
    var chars = document.getElementById('ml-anuncio-chars');
    if (chars) chars.textContent = tpl.length + '/80';
    textarea.focus();
    // Dispara evento input para o contador do app.js reagir
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  };

  window.mlAtualizarHeroStatus = function(statusLoja, cliquesHoje) {
    var dot  = document.getElementById('ml-hero-status-dot');
    var txt  = document.getElementById('ml-hero-status-txt');
    var hDiv = document.getElementById('ml-hero-cliques');
    var hNum = document.getElementById('ml-hero-cliques-num');
    if (!dot || !txt) return;
    var s = (statusLoja || '').toUpperCase();
    if (s.indexOf('ABERTO') === 0) {
      dot.style.background = '#00d084'; dot.style.animation = 'blink 1.5s infinite';
      txt.textContent = 'Aberta agora';
    } else if (s.indexOf('VOLTAMOS') === 0) {
      dot.style.background = '#f59e0b'; dot.style.animation = '';
      txt.textContent = 'Já voltamos';
    } else if (s === 'FECHADO' || s.indexOf('FECHADO_HOJE_') === 0) {
      dot.style.background = '#ff4444'; dot.style.animation = '';
      txt.textContent = 'Fechada agora';
    } else {
      dot.style.background = '#555';
      txt.textContent = 'Status automático';
    }
    if (hDiv && hNum && typeof cliquesHoje === 'number' && cliquesHoje > 0) {
      hNum.textContent = cliquesHoje;
      hDiv.style.display = 'flex';
    }
  };

  window.mlAtualizarBadgeMetricas = function(novos) {
    var badge = document.getElementById('ml-tab-badge-metricas');
    if (!badge) return;
    if (novos > 0) {
      badge.textContent = '+' + novos;
      badge.style.display = 'inline-block';
    } else {
      badge.style.display = 'none';
    }
  };

  async function mlCardapioSalvar(manterAberto = false) {
    const nome  = document.getElementById('ml-cardapio-nome').value.trim();
    const preco = document.getElementById('ml-cardapio-preco').value;
    const msgEl = document.getElementById('ml-cardapio-form-msg');
    if (!nome)  { msgEl.textContent = '❌ Informe o nome do item.'; msgEl.style.color='var(--red)'; return; }
    if (!preco) { msgEl.textContent = '❌ Informe o preço.'; msgEl.style.color='var(--red)'; return; }
    const precoNum = parseFloat(String(preco).replace(/[^\d,.-]/g, '').replace(',', '.'));
    if (isNaN(precoNum)) { msgEl.textContent = '❌ Preço inválido. Use apenas números (ex: 15,00).'; msgEl.style.color='var(--red)'; return; }
    if (precoNum < 0) { msgEl.textContent = '❌ Preço não pode ser negativo.'; msgEl.style.color='var(--red)'; return; }
    // Fix #22: bloqueia se upload de foto ainda está em andamento
    if (_cardapioUploadEmAndamento) {
      msgEl.textContent = '⏳ Aguarde o upload da foto terminar antes de salvar.';
      msgEl.style.color = 'var(--muted)';
      return;
    }

    const btn      = document.getElementById('ml-cardapio-salvar-btn');
    const btnProx  = document.getElementById('ml-cardapio-proximo-btn');
    const salvarEl = manterAberto ? btnProx : btn;
    if (btn)      { btn.disabled = true; }
    if (btnProx)  { btnProx.disabled = true; }
    if (salvarEl) salvarEl.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Salvando...';

    try {
      const params = new URLSearchParams();
      params.append('payload', JSON.stringify({
        action:     'lojaCardapioSalvar',
        token:      _lojaToken,
        id:         document.getElementById('ml-cardapio-edit-id').value,
        nome,
        descricao:  document.getElementById('ml-cardapio-desc').value.trim(),
        preco:      precoNum,
        foto:       document.getElementById('ml-cardapio-foto-url').value,
        categoria:  document.getElementById('ml-cardapio-cat').value.trim(),
        destaque:   document.getElementById('ml-cardapio-destaque')?.checked ? 'SIM' : 'NAO',
      }));
      const resp = await fetch(APPS_SCRIPT_URL, { method:'POST', body:params, signal:AbortSignal.timeout(30000) });
      const json = await resp.json();
      if (json.status === 'ok') {
        // Vincula grupos ao item (PRO). Usa o id retornado (novo) ou o edit-id.
        if (_cardapioPlano === 'PRO') {
          const itemIdFinal = (json.data && json.data.id) || document.getElementById('ml-cardapio-edit-id').value;
          const gruposSel = mlLerVinculoGrupos();
          if (itemIdFinal) {
            try {
              await apiPost('lojaItemVincularGrupos', { token: _lojaToken, itemId: itemIdFinal, grupos: gruposSel.join(',') }, { timeout: 12000, ignoreUnauthorized: true });
            } catch(eV) { if (eV.message !== 'UNAUTHORIZED') console.warn('[Vinculo] ' + eV.message); }
            // Precos por tamanho (grupos POR_ITEM). Enviado sempre: objeto
            // vazio limpa os precos do item (volta ao preco base).
            try {
              const precosPI = mlLerPrecosPorItem();
              await apiPost('lojaItemPrecosSalvar', { token: _lojaToken, itemId: itemIdFinal, precos: JSON.stringify(precosPI) }, { timeout: 12000, ignoreUnauthorized: true });
            } catch(eP) { if (eP.message !== 'UNAUTHORIZED') console.warn('[Precos] ' + eP.message); }
          }
        }
        // Atualiza a lista sem fechar o form quando manterAberto=true
        await mlCardapioCarregar(_cardapioPlano);

        if (manterAberto) {
          // Modo rápido: limpa o form e deixa pronto para o próximo item.
          // Preserva o que normalmente se REPETE entre itens seguidos da mesma
          // leva: categoria, preço, grupos vinculados e preços por tamanho.
          // Ex.: cadastrar as 13 pizzas de R$42 vira só digitar nome+descrição.
          const catAtual    = document.getElementById('ml-cardapio-cat').value;
          const precoAtual  = document.getElementById('ml-cardapio-preco').value;
          const gruposAtual = mlLerVinculoGrupos();
          const precosAtual = mlLerPrecosPorItem();

          mlCardapioAbrirForm(null); // reseta form para novo item

          document.getElementById('ml-cardapio-cat').value   = catAtual;
          document.getElementById('ml-cardapio-preco').value = precoAtual;
          // Remarca os chips dos mesmos grupos e repõe os preços por tamanho.
          mlRenderVinculoGrupos({ grupos: gruposAtual.map(id => ({ id })) });
          mlRenderPrecosPorItem({ precosOpcao: precosAtual });

          // Avisa o que foi mantido, para não parecer que o form não limpou.
          const mantidos = [];
          if (catAtual)   mantidos.push('categoria');
          if (precoAtual) mantidos.push('preço');
          if (Object.keys(precosAtual).length) mantidos.push('tamanhos');
          msgEl.textContent = mantidos.length
            ? '✅ Salvo! Mantive ' + mantidos.join(', ') + ' para o próximo.'
            : '✅ Salvo! Preencha o próximo.';
          msgEl.style.color = 'var(--green)';
          setTimeout(() => { msgEl.textContent = ''; }, 3500);
          // Auto-foco no nome para digitação imediata
          setTimeout(() => document.getElementById('ml-cardapio-nome')?.focus(), 100);
        } else {
          mlCardapioFecharForm();
          msgEl.textContent = '';
        }
      } else throw new Error(json.msg || 'Erro');
    } catch(e) {
      msgEl.textContent = '❌ ' + e.message;
      msgEl.style.color = 'var(--red)';
    } finally {
      if (btn)     { btn.innerHTML = '<i class="fa fa-check"></i> Salvar item'; btn.disabled = false; }
      if (btnProx) { btnProx.innerHTML = '<i class="fa fa-plus"></i> Salvar e adicionar próximo'; btnProx.disabled = false; }
    }
  }

  async function mlCardapioRemover(id, nome) {
    const ok = await mlConfirmar('Remover do cardápio?', `"${nome}" será removido do seu cardápio.`, { okLabel: 'Remover', owlSrc: '/webp/owl-sign.webp' });
    if (!ok) return;
    try {
      const json = await apiPost('lojaCardapioRemover', { token: _lojaToken, id });
      if (json.status !== 'ok') {
        mlToast('Erro ao remover: ' + (json.msg || 'tente novamente.'), 'erro');
        return;
      }
      await mlCardapioCarregar(_cardapioPlano);
    } catch(e) {
      if (e.message === 'UNAUTHORIZED') return; // apiPost já fez logout
      mlToast('Erro ao remover: ' + e.message, 'erro');
    }
  }

  window.mlCardapioAbrirForm  = mlCardapioAbrirForm;
  window.mlCardapioFiltrar    = mlCardapioFiltrar;
  window.mlCardapioToggleGrupo = mlCardapioToggleGrupo;
  window.mlCardapioFecharForm = mlCardapioFecharForm;
  window.mlCardapioSalvar     = mlCardapioSalvar;
  window.mlCardapioRemover    = mlCardapioRemover;
  window.mlGruposCarregar     = mlGruposCarregar;
  window.mlSalvarInstagram    = mlSalvarInstagram;

  window.mlToggleEntrega = async function() {
    const toggle  = document.getElementById('ml-entrega-toggle');
    const thumb   = document.getElementById('ml-entrega-thumb');
    const label   = document.getElementById('ml-entrega-label');
    const statusEl = document.getElementById('ml-entrega-status');
    if (!toggle) return;
    const novoValor = toggle.dataset.ativo !== '1';
    toggle.dataset.ativo = novoValor ? '1' : '0';
    toggle.setAttribute('aria-checked', novoValor ? 'true' : 'false');
    toggle.style.background = novoValor ? 'var(--green)' : 'var(--border)';
    if (thumb) thumb.style.left = novoValor ? '21px' : '3px';
    // Item 15: mantém o rótulo textual sincronizado com o estado.
    if (label) { label.textContent = novoValor ? 'Ativado' : 'Desativado'; label.style.color = novoValor ? 'var(--green)' : 'var(--muted)'; }
    if (statusEl) { statusEl.textContent = 'Salvando…'; statusEl.style.color = 'var(--muted)'; }
    // Mostra/esconde o painel de forma de cobrança junto com o toggle.
    const taxaWrap = document.getElementById('ml-taxa-wrap');
    if (taxaWrap) taxaWrap.style.display = novoValor ? 'block' : 'none';
    try {
      const json = await apiPost('lojaAtualizarEntrega', { token: _lojaToken, fazEntrega: novoValor ? 'SIM' : 'NAO' });
      if (json.status === 'ok') {
        if (statusEl) {
          statusEl.textContent = novoValor ? '✅ Entrega ativada' : '✅ Entrega desativada';
          statusEl.style.color = 'var(--green)';
          setTimeout(() => { if (statusEl) statusEl.textContent = ''; }, 3000);
        }
      } else throw new Error(json.msg || 'Erro');
    } catch(e) {
      if (e.message === 'UNAUTHORIZED') return; // apiPost já fez logout
      // Reverte estado, cor, thumb E rótulo
      toggle.dataset.ativo = novoValor ? '0' : '1';
      toggle.setAttribute('aria-checked', novoValor ? 'false' : 'true');
      toggle.style.background = novoValor ? 'var(--border)' : 'var(--green)';
      if (thumb) thumb.style.left = novoValor ? '3px' : '21px';
      if (label) { label.textContent = novoValor ? 'Desativado' : 'Ativado'; label.style.color = novoValor ? 'var(--muted)' : 'var(--green)'; }
      if (statusEl) { statusEl.textContent = '❌ ' + e.message; statusEl.style.color = 'var(--red)'; }
    }
  };
  // Item 15: acessibilidade — o switch agora é focável (role="switch"); Enter/Espaço alternam.
  document.addEventListener('keydown', function(e) {
    if ((e.key === 'Enter' || e.key === ' ') && document.activeElement?.id === 'ml-entrega-toggle') {
      e.preventDefault();
      if (typeof window.mlToggleEntrega === 'function') window.mlToggleEntrega();
    }
  });

  // ── Taxa de entrega (painel lojista) ────────────────────────
  // Converte 'reais' digitado para número (aceita vírgula ou ponto).
  function _mlParseReais(str) {
    const v = parseFloat(String(str || '').replace(/\s/g, '').replace(',', '.'));
    return (isNaN(v) || v < 0) ? null : v;
  }
  function _mlFmtInput(n) {
    return (Number(n) || 0).toFixed(2).replace('.', ',');
  }

  // Preenche a UI de taxa a partir do valor salvo (formato MODO:VALOR).
  window._mlPreencherTaxa = function(taxaStr) {
    const s = String(taxaStr || '').trim().toUpperCase();
    const modoEl = document.getElementById('ml-taxa-modo');
    const fixaEl = document.getElementById('ml-taxa-fixa-val');
    const pisoEl = document.getElementById('ml-taxa-min-piso');
    const minValEl = document.getElementById('ml-taxa-min-val');
    if (!modoEl) return;

    let modo = 'GRATIS';
    if (s.indexOf('FIXA:') === 0) {
      modo = 'FIXA';
      if (fixaEl) fixaEl.value = _mlFmtInput(parseFloat(s.slice(5).replace(',', '.')));
    } else if (s.indexOf('MINIMO:') === 0) {
      modo = 'MINIMO';
      const p = s.slice(7).split(':');
      if (pisoEl)  pisoEl.value  = _mlFmtInput(parseFloat(String(p[0] || '').replace(',', '.')));
      if (minValEl) minValEl.value = _mlFmtInput(parseFloat(String(p[1] || '').replace(',', '.')));
    } else if (s === 'COMBINAR') {
      modo = 'COMBINAR';
    } else {
      modo = 'GRATIS'; // '' ou 'GRATIS'
    }
    modoEl.value = modo;
    if (typeof window.mlTaxaModoChange === 'function') window.mlTaxaModoChange();
  };

  // Mostra/esconde os campos conforme o modo escolhido.
  window.mlTaxaModoChange = function() {
    const modo = (document.getElementById('ml-taxa-modo') || {}).value || 'GRATIS';
    const fixaBox = document.getElementById('ml-taxa-fixa-box');
    const minBox  = document.getElementById('ml-taxa-min-box');
    if (fixaBox) fixaBox.style.display = (modo === 'FIXA')   ? 'block' : 'none';
    if (minBox)  minBox.style.display  = (modo === 'MINIMO') ? 'block' : 'none';
  };

  // Valida e salva a forma de cobrança da entrega.
  window.mlSalvarTaxaEntrega = async function() {
    const modo = (document.getElementById('ml-taxa-modo') || {}).value || 'GRATIS';
    const statusEl = document.getElementById('ml-taxa-status');
    const btn = document.getElementById('ml-taxa-salvar-btn');
    const setStatus = (txt, cor) => { if (statusEl) { statusEl.textContent = txt; statusEl.style.color = cor || 'var(--muted)'; } };

    // Monta a string MODO:VALOR e valida no cliente antes de enviar.
    let taxa = '';
    if (modo === 'GRATIS')   taxa = 'GRATIS';
    else if (modo === 'COMBINAR') taxa = 'COMBINAR';
    else if (modo === 'FIXA') {
      const v = _mlParseReais((document.getElementById('ml-taxa-fixa-val') || {}).value);
      if (v === null || v === 0) { setStatus('❌ Digite um valor de entrega válido', 'var(--red)'); return; }
      taxa = 'FIXA:' + v.toFixed(2);
    } else if (modo === 'MINIMO') {
      const piso = _mlParseReais((document.getElementById('ml-taxa-min-piso') || {}).value);
      const val  = _mlParseReais((document.getElementById('ml-taxa-min-val') || {}).value);
      if (piso === null || piso === 0) { setStatus('❌ Digite o valor mínimo para frete grátis', 'var(--red)'); return; }
      if (val === null || val === 0)   { setStatus('❌ Digite a taxa cobrada abaixo do mínimo', 'var(--red)'); return; }
      taxa = 'MINIMO:' + piso.toFixed(2) + ':' + val.toFixed(2);
    }

    if (btn) btn.disabled = true;
    setStatus('Salvando…', 'var(--muted)');
    try {
      const json = await apiPost('lojaAtualizarTaxaEntrega', { token: _lojaToken, taxa });
      if (json.status === 'ok') {
        setStatus('✅ Forma de cobrança salva', 'var(--green)');
        // Atualiza o objeto da loja em memória para refletir no cardápio sem recarregar.
        try {
          const wppLoja = (typeof _lojaWpp !== 'undefined') ? _lojaWpp : '';
          if (wppLoja) {
            const alvo = String(wppLoja).replace(/\D/g, '');
            for (let i = 0; i < LOJAS.length; i++) {
              if (LOJAS[i] && String(LOJAS[i].wpp).replace(/\D/g, '') === alvo) { LOJAS[i].taxaEntrega = json.data.taxaEntrega; break; }
            }
          }
        } catch(e) {}
        setTimeout(() => setStatus('', 'var(--muted)'), 3000);
      } else throw new Error(json.msg || 'Erro');
    } catch(e) {
      if (e.message === 'UNAUTHORIZED') return; // apiPost já fez logout
      setStatus('❌ ' + e.message, 'var(--red)');
    } finally {
      if (btn) btn.disabled = false;
    }
  };

  // ── Toggle 'Atendo por agendamento' no painel Minha Loja ────
  window.mlToggleAgendamento = async function() {
    const toggle   = document.getElementById('ml-agend-toggle');
    const thumb    = document.getElementById('ml-agend-thumb');
    const label    = document.getElementById('ml-agend-label');
    const statusEl = document.getElementById('ml-agend-status');
    if (!toggle) return;
    const novoValor = toggle.dataset.ativo !== '1';
    toggle.dataset.ativo = novoValor ? '1' : '0';
    toggle.setAttribute('aria-checked', novoValor ? 'true' : 'false');
    toggle.style.background = novoValor ? 'var(--green)' : 'var(--border)';
    if (thumb) thumb.style.left = novoValor ? '21px' : '3px';
    if (label) { label.textContent = novoValor ? 'Ativado' : 'Desativado'; label.style.color = novoValor ? 'var(--green)' : 'var(--muted)'; }
    if (statusEl) { statusEl.textContent = 'Salvando…'; statusEl.style.color = 'var(--muted)'; }
    try {
      const json = await apiPost('lojaAtualizarAgendamento', { token: _lojaToken, agendamento: novoValor ? 'SIM' : 'NAO' });
      if (json.status === 'ok') {
        if (statusEl) {
          statusEl.textContent = novoValor ? '✅ Agendamento ativado' : '✅ Agendamento desativado';
          statusEl.style.color = 'var(--green)';
          setTimeout(() => { if (statusEl) statusEl.textContent = ''; }, 3000);
        }
      } else throw new Error(json.msg || 'Erro');
    } catch(e) {
      if (e.message === 'UNAUTHORIZED') return;
      toggle.dataset.ativo = novoValor ? '0' : '1';
      toggle.setAttribute('aria-checked', novoValor ? 'false' : 'true');
      toggle.style.background = novoValor ? 'var(--border)' : 'var(--green)';
      if (thumb) thumb.style.left = novoValor ? '3px' : '21px';
      if (label) { label.textContent = novoValor ? 'Desativado' : 'Ativado'; label.style.color = novoValor ? 'var(--muted)' : 'var(--green)'; }
      if (statusEl) { statusEl.textContent = '❌ ' + e.message; statusEl.style.color = 'var(--red)'; }
    }
  };
  document.addEventListener('keydown', function(e) {
    if ((e.key === 'Enter' || e.key === ' ') && document.activeElement?.id === 'ml-agend-toggle') {
      e.preventDefault();
      if (typeof window.mlToggleAgendamento === 'function') window.mlToggleAgendamento();
    }
  });

  /* ══════════════════════════════════════════════════════════════
     CARDÁPIO — TELA DO CLIENTE
  ══════════════════════════════════════════════════════════════ */
  let _ccLojaIdx   = null;
  let _ccCarrinho  = {}; // { itemId: { item, qty } }
  let _ccCartExpanded = false; // estado do carrinho colapsável
  let _ccModoAtual = 'produto'; // 'produto' | 'servico' | 'vitrine

  /* ─── MODIFICADORES (grupos de opções) no cliente ───────────────
     item.grupos vem do payload publico. Cada grupo:
       { id, nome, tipo:'UNICA'|'MULTIPLA', min, max, precoModo:'DELTA'|'ABSOLUTO',
         opcoes:[{id,nome,preco,qtdMax}] }
     qtdMax por opcao: 0/1 = opcao simples (marca 1x, checkbox). >1 = repetivel
     ate N (stepper). As escolhas continuam sendo um ARRAY DE IDs, e a repeticao
     e representada repetindo o id: ['op1','op1','op1'] = 3x. Assim _ccPrecoUnitario
     (que soma por id) e _ccLineKey (que ordena e junta) seguem corretos sem mudanca.
     Carrinho passa a ser chaveado por lineKey (item + escolhas), pois
     'Pizza Grande' e 'Pizza Broto' sao linhas distintas do mesmo item. */

  // Estado da tela de personalizacao em aberto.
  let _ccPersItem = null;      // item sendo personalizado
  let _ccPersEscolhas = {};    // { grupoId: [opcaoId, ...] }

  // Quantas vezes uma opcao esta escolhida (array pode repetir o mesmo id).
  function _ccQtdOpcao(sel, opcaoId) {
    let n = 0;
    for (let i = 0; i < sel.length; i++) if (sel[i] === opcaoId) n++;
    return n;
  }

  // Teto de repeticao de uma opcao. So vale em grupo MULTIPLA + DELTA: em
  // UNICA a escolha e exclusiva e em ABSOLUTO o preco substitui a base
  // (repetir nao faria sentido). Fora disso, 1 = comportamento historico.
  function _ccOpcaoQtdMax(g, op) {
    if (!g || g.tipo === 'UNICA' || g.precoModo === 'ABSOLUTO') return 1;
    const n = parseInt(op && op.qtdMax, 10) || 0;
    return n > 1 ? Math.min(99, n) : 1;
  }

  function _ccItemTemGrupos(item) {
    return Array.isArray(item && item.grupos) && item.grupos.length > 0;
  }

  // Exige passar pela tela de personalizacao? So quando ha grupo obrigatorio
  // (min>=1), como Tamanho. Grupos 100% opcionais (acrescimos) NAO obrigam:
  // o '+' adiciona direto no padrao e quem quiser personalizar toca no card.
  function _ccItemExigePersonalizar(item) {
    return (item && item.grupos || []).some(g => (g.min || 0) >= 1);
  }

  // Escolhas padrao de um item: vazio para grupos opcionais. Usado quando o
  // cliente adiciona direto pelo '+', sem abrir a personalizacao.
  function _ccEscolhasPadrao(item) {
    const out = {};
    (item.grupos || []).forEach(g => { out[g.id] = []; });
    return out;
  }

  // Preco unitario de uma configuracao. Regra:
  //  - grupo ABSOLUTO: a opcao escolhida SUBSTITUI o preco base (tamanho).
  //    Se houver mais de um grupo absoluto, o ultimo escolhido vence a base;
  //    na pratica so ha um (tamanho). Grupos sem escolha nao mexem na base.
  //  - grupo DELTA: cada opcao escolhida SOMA seu preco.
  function _ccPrecoUnitario(item, escolhas) {
    let base = parseFloat(item.preco) || 0;
    let somaDelta = 0;
    (item.grupos || []).forEach(g => {
      const sel = (escolhas && escolhas[g.id]) || [];
      if (!sel.length) return;
      if (g.precoModo === 'ABSOLUTO' || g.precoModo === 'POR_ITEM') {
        // A escolha define a base. UNICA => 1 opcao; pega a primeira selecionada.
        // POR_ITEM: o backend ja injetou o preco DESTE item em op.preco
        // (ou o preco base, quando o lojista nao preencheu aquele tamanho).
        const op = g.opcoes.find(o => o.id === sel[0]);
        if (op) base = parseFloat(op.preco) || 0;
      } else {
        sel.forEach(oid => {
          const op = g.opcoes.find(o => o.id === oid);
          if (op) somaDelta += parseFloat(op.preco) || 0;
        });
      }
    });
    return base + somaDelta;
  }

  // Chave estavel de linha: itemId + escolhas ordenadas. Mesma config => mesma
  // linha (agrupa qty); config diferente => linha separada.
  function _ccLineKey(item, escolhas) {
    if (!_ccItemTemGrupos(item)) return item.id;
    const partes = [];
    (item.grupos || []).forEach(g => {
      const sel = ((escolhas && escolhas[g.id]) || []).slice().sort();
      if (sel.length) partes.push(g.id + ':' + sel.join('+'));
    });
    return item.id + '|' + partes.join('|');
  }

  // Texto curto das escolhas, p/ exibir no carrinho e na mensagem.
  function _ccResumoEscolhas(item, escolhas) {
    const linhas = [];
    (item.grupos || []).forEach(g => {
      const sel = (escolhas && escolhas[g.id]) || [];
      // Agrupa ids repetidos preservando a ordem de 1a aparicao, para virar
      // '3x Salsicha' em vez de tres linhas iguais no carrinho e no WhatsApp.
      const vistos = [];
      sel.forEach(oid => { if (vistos.indexOf(oid) < 0) vistos.push(oid); });
      vistos.forEach(oid => {
        const op = g.opcoes.find(o => o.id === oid);
        if (!op) return;
        const qtd = _ccQtdOpcao(sel, oid);
        const p = parseFloat(op.preco) || 0;
        if (g.precoModo === 'ABSOLUTO' || g.precoModo === 'POR_ITEM') {
          // Tamanho nao e 'acrescimo': mostra so o nome, sem '+R$'.
          linhas.push(op.nome);
        } else {
          // O valor mostrado e o total da opcao (preco x quantidade).
          const tot = p * qtd;
          const pref = qtd > 1 ? (qtd + 'x ') : '';
          linhas.push(pref + op.nome + (tot > 0 ? ' (+' + tot.toFixed(2).replace('.',',') + ')' : ''));
        }
      });
    });
    return linhas;
  }

  // Valida min/max de cada grupo. Retorna '' se ok, ou mensagem do 1o erro.
  function _ccValidarEscolhas(item, escolhas) {
    const gs = item.grupos || [];
    for (let i = 0; i < gs.length; i++) {
      const g = gs[i];
      // n conta UNIDADES: 3 salsichas + 1 alface = 4. E o que o lojista espera
      // de 'maximo de acrescimos'. Como o array repete ids, .length ja e isso.
      const n = ((escolhas && escolhas[g.id]) || []).length;
      if (g.min > 0 && n < g.min) {
        return g.tipo === 'UNICA'
          ? 'Escolha uma opção em “' + g.nome + '”'
          : 'Escolha ao menos ' + g.min + ' em “' + g.nome + '”';
      }
      if (g.max > 0 && n > g.max) {
        return 'Máximo de ' + g.max + ' em “' + g.nome + '”';
      }
    }
    return '';
  }

  window.abrirCardapioCliente = function(idx) {
    const loja = LOJAS[idx];
    if (!loja || !loja.cardapio || loja.cardapio.length === 0) return;
    _ccLojaIdx  = idx;
    _ccCarrinho = {};
    _ccCartExpanded = false;
    // Remove botao de confirmacao residual de um pedido anterior (Fix: botao fantasma)
    document.getElementById('cc-carrinho-bar')?.querySelector('.cc-confirm-btn')?.remove();

    // Label dinâmico por slug — cada categoria tem seu nome mais adequado
    const _slug = (loja.categoria || '').toLowerCase();
    const _labelMap = {
      // Alimentação — Cardápio
      'pizzaria':'Cardápio', 'lanches':'Cardápio', 'restaurante':'Cardápio',
      'sorveteria':'Cardápio', 'padaria':'Cardápio', 'doceria':'Cardápio',
      'carnes':'Cardápio', 'cafeteria':'Cardápio', 'saudavel':'Cardápio',
      'japonesa':'Cardápio', 'italiana':'Cardápio', 'marmita':'Cardápio',
      // Bebidas — Produtos
      'adega':'Produtos',
      // Comércio — Produtos
      'mercado':'Produtos', 'farmacia':'Produtos', 'pet':'Produtos',
      'calcados':'Produtos', 'roupas':'Produtos', 'joalheria':'Produtos',
      'otica':'Produtos', 'informatica':'Produtos', 'celular':'Produtos',
      'papelaria':'Produtos', 'variedades':'Produtos', 'festas':'Produtos',
      'armarinho':'Produtos', 'floricultura':'Produtos', 'moveis':'Produtos',
      'tintas':'Produtos', 'construcao':'Produtos', 'madeireira':'Produtos',
      'autopecas':'Produtos', 'agropecuaria':'Produtos', 'insumos':'Produtos',
      // Saúde — Serviços específicos
      'clinica':'Consultas', 'laboratorio':'Exames', 'hospital':'Atendimentos',
      // Beleza — Serviços específicos
      'barbearia':'Serviços', 'salao':'Serviços', 'estetica':'Serviços',
      'tattoo':'Portfólio', 'spa':'Serviços', 'academia':'Planos',
      // Automotivo — Serviços específicos
      'mecanica':'Serviços', 'borracharia':'Serviços', 'funilaria':'Serviços',
      'lava-rapido':'Serviços', 'posto':'Combustíveis', 'autopecas':'Produtos',
      'bicicletaria':'Serviços',
      // Casa — Serviços/Produtos
      'construcao':'Produtos', 'vidracaria':'Serviços', 'serralheria':'Serviços',
      'refrigeracao':'Serviços', 'consertos':'Serviços', 'eletricista':'Serviços',
      'encanamento':'Serviços', 'pintura':'Serviços',
      // Tecnologia — Serviços
      'grafica':'Serviços', 'informatica':'Produtos', 'celular':'Produtos',
      // Profissionais — Serviços específicos
      'advocacia':'Serviços', 'contabilidade':'Serviços', 'fotografia':'Portfólio',
      'imobiliaria':'Imóveis', 'viagens':'Pacotes', 'seguros':'Planos',
      // Educação
      'idiomas':'Cursos', 'escolinha':'Serviços', 'bancario':'Serviços',
      // Gas/Água
      'gas':'Produtos',
    };
    const label = _labelMap[_slug] || 'Itens';

    document.getElementById('cc-loja-nome').textContent = loja.nome;
    document.getElementById('cc-loja-sub').textContent  = label;

    // Mostrar/ocultar seção de entrega
    const entregaSec = document.getElementById('cc-entrega-section');
    if (entregaSec) {
      entregaSec.style.display = loja.fazEntrega ? '' : 'none';
      // Pré-preenche com o último endereço/pagamento usado (recompra mais rápida)
      const endEl = document.getElementById('cc-entrega-endereco');
      const pagEl = document.getElementById('cc-entrega-pagamento');
      let _cliEnd = '', _cliPag = '';
      try {
        _cliEnd = localStorage.getItem('angatuba_cli_endereco') || '';
        _cliPag = localStorage.getItem('angatuba_cli_pagamento') || '';
      } catch (e) {}
      if (endEl) endEl.value = _cliEnd;
      if (pagEl) pagEl.value = _cliPag;
    }

    ccRenderItens(loja);
    ccAtualizarCarrinho();

    // Back button Android: empurra estado para que voltar feche o cardápio
    history.pushState({ modal: 'cardapio', idx }, '', location.pathname + location.search + location.hash);

    document.getElementById('modal-cardapio-cliente').classList.add('open');
    document.body.style.overflow = 'hidden';
    _focusTrapAtivar(document.getElementById('modal-cardapio-cliente'));

    // Métrica: registra visualização de cardápio (fire-and-forget, não bloqueia)
    try {
      registrarClique(loja.nome, 'menu', loja.plano || 'GRATIS', loja.categoria || '');
    } catch(e) {}
  };

  window.limparCategoria = function() {
    var todosBtn = document.querySelector('[data-cat="todos"]');
    if (todosBtn && typeof setCat === 'function') setCat('todos', todosBtn);
  };

  // Marca uma tab como ativa e a traz para o campo de visão da barra de tabs.
  function _ccMarcarTab(id) {
    let ativa = null;
    document.querySelectorAll('.cc-tab-pill').forEach(b => {
      const on = b.dataset.catId === id;
      b.classList.toggle('active', on);
      if (on) ativa = b;
    });
    // Com muitas categorias a tab ativa pode estar fora da tela na barra
    // horizontal; traz ela para perto sem mexer no scroll vertical da página.
    if (ativa && ativa.parentNode && ativa.parentNode.scrollWidth > ativa.parentNode.clientWidth) {
      const barra = ativa.parentNode;
      const alvo = ativa.offsetLeft - (barra.clientWidth / 2) + (ativa.offsetWidth / 2);
      barra.scrollTo({ left: Math.max(0, alvo), behavior: 'smooth' });
    }
  }

  // Enquanto o scroll suave do clique está em curso, o spy precisa ficar
  // calado: senão as seções que passam no caminho roubam a marcação e as
  // tabs "piscam" entre a origem e o destino.
  let _ccSpyTravadoAte = 0;
  let _ccSpyHandler = null;

  window.ccScrollTocat = function(id) {
    const el = document.getElementById(id);
    const wrap = document.getElementById('cc-itens-wrap');
    if (!el || !wrap) return;
    _ccSpyTravadoAte = Date.now() + 700; // ~duração do smooth scroll
    const offset = el.offsetTop - 8;
    wrap.scrollTo({ top: offset, behavior: 'smooth' });
    _ccMarcarTab(id);
  };

  // Scrollspy: durante a rolagem manual, ativa a tab da seção que está
  // cruzando o topo da área visível. Antes disso a marcação só mudava no
  // clique (ccScrollTocat), então rolar com o dedo mantinha a tab errada.
  function _ccScrollspyLigar() {
    const wrap = document.getElementById('cc-itens-wrap');
    if (!wrap) return;
    if (_ccSpyHandler) wrap.removeEventListener('scroll', _ccSpyHandler);

    let agendado = false;
    _ccSpyHandler = function() {
      if (agendado) return;
      agendado = true;
      requestAnimationFrame(function() {
        agendado = false;
        if (Date.now() < _ccSpyTravadoAte) return; // clique em andamento
        const labels = wrap.querySelectorAll('.cc-cat-label');
        if (!labels.length) return;
        // Última seção cujo topo já passou da linha de leitura (topo + 12px).
        const linha = wrap.scrollTop + 12;
        let atual = labels[0].id;
        for (let i = 0; i < labels.length; i++) {
          if (labels[i].offsetTop - 8 <= linha) atual = labels[i].id;
          else break;
        }
        // No fim da lista, a última categoria pode nunca alcançar a linha
        // (seção curta); força ela quando o scroll chega ao fundo.
        if (wrap.scrollTop + wrap.clientHeight >= wrap.scrollHeight - 4) {
          atual = labels[labels.length - 1].id;
        }
        _ccMarcarTab(atual);
      });
    };
    wrap.addEventListener('scroll', _ccSpyHandler, { passive: true });
  }

  window.fecharCardapioCliente = function(viaPopstate) {
    // Se o lightbox de foto estiver aberto, fecha junto (evita ficar órfão sobre a home)
    const lb = document.getElementById('cc-lightbox');
    if (lb) lb.classList.remove('open');
    document.getElementById('modal-cardapio-cliente').classList.remove('open');
    document.body.style.overflow = '';
    _focusTrapDesativar();
    if (!viaPopstate && history.state && history.state.modal === 'cardapio') history.back();
    // Reseta tela de sucesso para a próxima abertura
    const sucesso = document.getElementById('cc-pedido-sucesso');
    if (sucesso) sucesso.style.display = 'none';
    const wrap = document.getElementById('cc-itens-wrap');
    if (wrap) wrap.style.display = '';
  };

  // Emoji placeholder inteligente por categoria (usado por todos os modos)
  const _ccCatEmoji = {
    'pizzaria':'🍕','lanches':'🍔','restaurante':'🍽️','carnes':'🥩','sorveteria':'🍦',
    'padaria':'🥐','adega':'🍺','mercado':'🛒','farmacia':'💊','pet':'🐾',
    'barbearia':'💈','salao':'💅','mecanica':'🔧','eletricista':'⚡','tattoo':'🎨',
    'academia':'💪','clinica':'🩺','laboratorio':'🧪','otica':'👓','calcados':'👟',
    'roupas':'👗','joalheria':'💍','informatica':'💻','celular':'📱',
    'construcao':'🧱','moveis':'🛋️','autopecas':'🔩','borracharia':'🚗','posto':'⛽',
    'floricultura':'💐','fotografia':'📸','agropecuaria':'🌾','insumos':'🚜',
    'estetica':'💆','spa':'🧖','funilaria':'🚙','lava-rapido':'🚿','bicicletaria':'🚲',
    'vidracaria':'🪟','serralheria':'🔩','refrigeracao':'❄️','consertos':'🛠️',
    'encanamento':'🚰','pintura':'🎨','grafica':'🖨️','advocacia':'⚖️','contabilidade':'📊',
    'imobiliaria':'🏠','viagens':'✈️','seguros':'🛡️','idiomas':'📚','escolinha':'✏️',
    'papelaria':'📎','variedades':'🎁','festas':'🎉','armarinho':'🧵','tintas':'🎨',
    'madeireira':'🪵','gas':'🔥','hospital':'🏥','saudavel':'🥗','cafeteria':'☕',
    'japonesa':'🍱','italiana':'🍝','marmita':'🍱','doceria':'🍰','bancario':'🏦',
  };

  // ── Emoji inferido pelo PRÓPRIO ITEM (nome + categoria) ──────────────────
  // Antes o placeholder era fixo pela categoria da LOJA: uma pizzaria mostrava
  // 🍕 em cima de "Dog Costela" e "Ferreira Burguer". Aqui a gente deduz pelo
  // texto do item; só cai no emoji da loja quando nada casa.
  // Ordem importa: termos mais específicos primeiro ("hot dog" antes de "dog",
  // "milk shake" antes de "shake"). Match por palavra/substring normalizada.
  const _CC_ITEM_EMOJI_REGRAS = [
    // Lanches e salgados
    ['\uD83C\uDF2D', ['hot dog','hotdog','cachorro quente','cachorro-quente','dogao','dog ']],
    ['\uD83C\uDF54', ['hamburguer','hamburgue','burguer','burger','xburguer','x-burguer','xis','cheeseburguer','cheese burguer','xsalada','x-salada','xtudo','x-tudo','xbacon','x-bacon','lanche','sanduiche','sanduba','misto quente','bauru']],
    // 'porcao de calabresa' e churrasco, nao pizza: precisa vir antes da regra de pizza
    ['\uD83E\uDD69', ['porcao de calabresa','porcao calabresa','espeto de calabresa','calabresa acebolada']],
    ['\uD83C\uDF55', ['pizza','calabresa','marguerita','margherita','portuguesa','mussarela','muçarela','brotinho','esfiha','esfirra']],
    ['\uD83C\uDF2E', ['taco','burrito','tortilla','nachos','guacamole','quesadilla']],
    ['\uD83E\uDD53', ['bacon','tapioca','crepe','panqueca','omelete','ovo ']],
    ['\uD83C\uDF57', ['frango','galeto','coxinha','asinha','tulipa','nugget','strogonoff','franguinho']],
    ['\uD83E\uDD69', ['picanha','carne','churrasco','costela','maminha','alcatra','fraldinha','contra file','contrafile','file mignon','bife','espetinho','espeto','churrasquinho','linguica','linguiça','cupim','panceta','matambre','pernil']],
    ['\uD83C\uDF5F', ['batata frita','fritas','batata','porcao de batata','onion rings','polenta frita','mandioca frita','aipim frito']],
    ['\uD83E\uDD57', ['salada','alface','rucula','caesar','salad','vegano','vegetariano','verdura']],
    ['\uD83C\uDF5D', ['macarrao','massa','espaguete','spaghetti','lasanha','nhoque','talharim','penne','fettuccine','ravioli','capeletti','panqueca de']],
    ['\uD83C\uDF5B', ['marmita','marmitex','prato feito','pf ','quentinha','executivo','self service','refeicao','almoco','buffet','arroz','feijoada','feijao','tutu','virado','parmegiana','parmigiana','file de']],
    ['\uD83C\uDF71', ['sushi','sashimi','temaki','yakisoba','japones','combo japones','hot roll','uramaki','niguiri','harumaki','gyoza']],
    ['\uD83C\uDF5C', ['sopa','caldo','canja','caldinho','creme de']],
    ['\uD83D\uDC1F', ['peixe','tilapia','salmao','bacalhau','camarao','frutos do mar','pescado','moqueca','isca de peixe']],
    ['\uD83E\uDD59', ['pastel','pastelzinho','esfiha aberta','kibe','quibe','risole','risoles','empada','empadao','enroladinho','salgado','salgadinho','pao de queijo','folhado','croissant','bolinho']],
    // Doces, padaria e sobremesas
    ['\uD83C\uDF66', ['sorvete','acai','açaí','picole','sundae','casquinha','gelato','frozen','milk shake','milkshake','shake','copao','copão']],
    ['\uD83C\uDF70', ['bolo','torta','fatia','cheesecake','pave','pavê','mousse','sobremesa','doce','pudim','brigadeiro','brownie','petit gateau','cupcake','tortinha','banoffee']],
    ['\uD83C\uDF69', ['donut','rosquinha','sonho','churros']],
    ['\uD83C\uDF6B', ['chocolate','bombom','trufa','ovo de pascoa','kitkat','nutella']],
    ['\uD83E\uDD50', ['pao','pão','baguete','ciabatta','broa','rosca','bisnaguinha','padaria','frances']],
    // Bebidas
    ['\uD83E\uDD64', ['refrigerante','refri','coca','guarana','guaraná','fanta','sprite','pepsi','soda','suco','sucos','vitamina','agua','água','h2o','isotonico','energetico','red bull','cha gelado','chá gelado','limonada']],
    ['\uD83C\uDF7A', ['cerveja','chopp','chope','brahma','skol','heineken','budweiser','antarctica','original','long neck','litrao','litrão','breja','ipa','puro malte']],
    ['\uD83C\uDF77', ['vinho','espumante','prosecco','tinto','branco seco','sangria']],
    ['\uD83C\uDF78', ['drink','caipirinha','caipiroska','vodka','whisky','gin','tequila','rum','cachaca','cachaça','pinga','licor','coquetel','batida','aperitivo','dose']],
    ['\u2615', ['cafe','café','cappuccino','expresso','espresso','pingado','media','chá','cha ','cha de','mate','capuccino','latte','mocha']],
    // Mercado / conveniência
    ['\uD83E\uDDC0', ['queijo','mussarela fatiada','requeijao','catupiry','provolone','parmesao']],
    ['\uD83E\uDD5B', ['leite','iogurte','achocolatado','danone','manteiga','creme de leite','leite condensado']],
    ['\uD83C\uDF4E', ['fruta','maca','maçã','banana','laranja','uva','melancia','abacaxi','manga','morango','limao','limão','mamao','mamão','verdura','legume','tomate','cebola','batata inglesa','cenoura']],
    ['\uD83E\uDDF9', ['limpeza','detergente','sabao','sabão','desinfetante','amaciante','agua sanitaria','veja','cloro','esponja','vassoura','rodo','alvejante']],
    ['\uD83E\uDDFB', ['papel higienico','papel higiênico','guardanapo','toalha de papel','fralda','absorvente','lenco']],
    ['\uD83E\uDDF4', ['shampoo','condicionador','sabonete','creme dental','pasta de dente','desodorante','hidratante','perfume','higiene']],
    ['\uD83D\uDC8A', ['remedio','remédio','dipirona','paracetamol','ibuprofeno','antibiotico','comprimido','xarope','pomada','vitamina c','suplemento','whey','creatina']],
    ['\uD83D\uDEBE', ['gas','gás','botijao','botijão','p13','galao','galão','agua mineral','20l']],
    // Serviços
    ['\uD83D\uDC88', ['corte','cabelo','barba','degrade','degradê','navalha','pezinho','sobrancelha','platinado','luzes','progressiva','escova','hidratacao capilar','penteado','coloracao']],
    ['\uD83D\uDC85', ['unha','manicure','pedicure','esmaltacao','alongamento','gel','fibra','cutilagem','spa dos pes']],
    ['\uD83D\uDD27', ['revisao','revisão','troca de oleo','troca de óleo','alinhamento','balanceamento','suspensao','freio','embreagem','motor','injecao','injeção','diagnostico','manutencao','conserto','reparo','instalacao']],
    ['\uD83D\uDE97', ['lavagem','lava rapido','polimento','higienizacao','enceramento','cristalizacao','pneu','roda','borracharia']],
    ['\uD83D\uDCAA', ['musculacao','treino','personal','aula de','crossfit','pilates','funcional','avaliacao fisica']],
    ['\uD83E\uDE7A', ['consulta','exame','avaliacao','sessao','terapia','fisioterapia','massagem','drenagem','limpeza de pele','botox','preenchimento']],
  ];

  // Normaliza para casar sem acento/caixa
  function _ccNorm(s) {
    return String(s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Emoji do item: tenta nome, depois categoria do item, depois cai no fallback
  // (emoji da loja). Cache simples porque roda por item em lista longa.
  const _ccEmojiCache = Object.create(null);
  function _ccEmojiItem(item, fallback) {
    const chave = (item && (item.nome || '')) + '|' + (item && (item.categoria || ''));
    if (_ccEmojiCache[chave] !== undefined) return _ccEmojiCache[chave] || fallback;
    const alvo = _ccNorm((item && item.nome) || '') + ' ' + _ccNorm((item && item.categoria) || '');
    let achado = '';
    for (let r = 0; r < _CC_ITEM_EMOJI_REGRAS.length && !achado; r++) {
      const emoji = _CC_ITEM_EMOJI_REGRAS[r][0];
      const termos = _CC_ITEM_EMOJI_REGRAS[r][1];
      for (let t = 0; t < termos.length; t++) {
        if (alvo.indexOf(termos[t]) !== -1) { achado = emoji; break; }
      }
    }
    _ccEmojiCache[chave] = achado;
    return achado || fallback;
  }

  // Define o MODO de exibição do cardápio conforme o tipo de negócio.
  //   'produto' → card em lista, tap adiciona ao carrinho (comida, mercado, farmácia…)
  //   'servico' → card em lista, botão "Agendar" abre WhatsApp (barbearia, mecânica, clínica…)
  //   'vitrine' → grade 2 colunas com foto grande, botão "Tenho interesse" (roupas, móveis, imóveis…)
  const _CC_MODO_SERVICO = new Set([
    'barbearia','salao','estetica','tattoo','spa','academia',
    'mecanica','borracharia','funilaria','lava-rapido','bicicletaria',
    'clinica','laboratorio','hospital',
    'vidracaria','serralheria','refrigeracao','consertos',
    'grafica','advocacia','contabilidade','fotografia',
    'viagens','seguros','idiomas','escolinha','bancario',
    // Serviços e Reformas (mão de obra) — sempre modo Agendar
    'pedreiro','eletricista','encanador','pintor','marceneiro',
    'jardinagem','diarista','fretes',
    // Transporte + outros autônomos — também modo Agendar
    'transporte','chaveiro','costureira','dedetizacao','guincho',
    'assistencia','aulas','personal','beleza-domicilio',
  ]);
  const _CC_MODO_VITRINE = new Set([
    'roupas','calcados','joalheria','otica','moveis','floricultura',
    'imobiliaria','informatica','celular',
  ]);
  function _ccModoLoja(loja) {
    // Loja por agendamento sempre usa o modo serviço (botão Agendar), mesmo que
    // a categoria normalmente fosse produto/vitrine — ninguém adiciona pedreiro
    // ao carrinho.
    if (loja.agendamento) return 'servico';
    const slug = (loja.categoria || '').toLowerCase();
    if (_CC_MODO_SERVICO.has(slug)) return 'servico';
    if (_CC_MODO_VITRINE.has(slug)) return 'vitrine';
    return 'produto';
  }

  // ID de âncora seguro para uma categoria. O nome é digitado pelo lojista,
  // então pode conter acento, '#', '&', aspas — tudo que estraga um seletor
  // CSS ou um atributo onclick. O índice no fim garante unicidade.
  function _ccCatId(cat, idx) {
    const slug = String(cat || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 32);
    return 'cc-cat-' + (slug || 'cat') + '-' + idx;
  }

  function ccRenderItens(loja) {
    const wrap  = document.getElementById('cc-itens-wrap');
    const isPro = (loja.plano || '').toUpperCase() === 'PRO';
    const modo  = _ccModoLoja(loja);
    _ccModoAtual = modo;

    const placeholderEmoji = emojiLoja(loja) || _ccCatEmoji[(loja.categoria||'').toLowerCase()] || '🏪';

    // Agrupa por categoria, guardando a ordem definida pelo lojista (catOrdem)
    // e a ordem de aparição como desempate/legado.
    const grupos = {};
    const ordemCat = {};   // categoria -> menor catOrdem vista
    const apareceu = {};   // categoria -> índice de primeira aparição
    loja.cardapio.forEach((item, i) => {
      const cat = (isPro && item.categoria) ? item.categoria : 'Itens';
      if (!grupos[cat]) { grupos[cat] = []; apareceu[cat] = i; }
      grupos[cat].push(item);
      const o = parseInt(item.catOrdem, 10) || 0;
      if (o > 0 && (ordemCat[cat] === undefined || o < ordemCat[cat])) ordemCat[cat] = o;
    });

    // Categorias COM ordem definida vêm primeiro (ordenadas); as sem ordem
    // mantêm o comportamento antigo (ordem de inserção) logo depois.
    const catsOrdenadas = Object.keys(grupos).sort((a, b) => {
      const oa = ordemCat[a] || 0, ob = ordemCat[b] || 0;
      if (oa && ob) return oa - ob;
      if (oa) return -1;
      if (ob) return 1;
      return apareceu[a] - apareceu[b];
    });

    // ── Sticky category tabs ──────────────────────────────────────────────
    const tabsEl = document.getElementById('cc-cat-tabs');
    const cats = catsOrdenadas;
    if (tabsEl) {
      if (cats.length > 1) {
        tabsEl.style.display = '';
        tabsEl.innerHTML = cats.map((cat, i) => {
          const cid = _ccCatId(cat, i);
          return `<button class="cc-tab-pill${i===0?' active':''}" data-cat-id="${escAttr(cid)}" onclick="ccScrollTocat('${escAttr(cid)}')">${escHTML(cat)}</button>`;
        }).join('');
      } else {
        tabsEl.style.display = 'none';
      }
    }

    // Escolhe o renderizador de item conforme o modo
    // placeholderEmoji vira apenas o FALLBACK: cada item deduz o seu.
    const renderItem = modo === 'vitrine'
      ? (item) => _ccItemVitrineHTML(item, _ccEmojiItem(item, placeholderEmoji))
      : modo === 'servico'
        ? (item) => _ccItemServicoHTML(item, _ccEmojiItem(item, placeholderEmoji))
        : (item) => _ccItemProdutoHTML(item, _ccEmojiItem(item, placeholderEmoji));

    // Vitrine embrulha os itens numa grade 2-colunas; os demais empilham.
    wrap.innerHTML = cats.map((cat, i) => `
      <div class="cc-cat-label" id="${escAttr(_ccCatId(cat, i))}">${escHTML(cat)}</div>
      ${modo === 'vitrine'
        ? `<div class="cc-vitrine-grid">${grupos[cat].map(renderItem).join('')}</div>`
        : grupos[cat].map(renderItem).join('')}
    `).join('');

    // (re)liga o scrollspy sempre que a lista é redesenhada
    _ccScrollspyLigar();
  }

  // ── MODO PRODUTO: card em lista, tap adiciona ao carrinho ─────────────────
  function _ccItemProdutoHTML(item, placeholderEmoji) {
    const temFoto = !!item.foto;
    const temGrupos = _ccItemTemGrupos(item);
    const exigePers = _ccItemExigePersonalizar(item);
    const precoBase = parseFloat(item.preco) || 0;
    // 'A partir de' so faz sentido quando o preco final DEPENDE de uma escolha
    // obrigatoria (ex.: tamanho). Com acrescimos opcionais, o preco base ja e
    // o preco real de venda — mostrar 'a partir de' so confunde.
    const precoHTML = exigePers
      ? `<div class="cc-item-preco"><span style="font-size:9px;font-weight:600;color:var(--muted);text-transform:uppercase;">a partir de</span> R$ ${precoBase.toFixed(2).replace('.',',')}</div>`
      : `<div class="cc-item-preco">R$ ${precoBase.toFixed(2).replace('.',',')}</div>`;
    // Botao: so vira 'personalizar' (roxo) quando ha escolha obrigatoria.
    // Caso contrario e o '+' normal, que adiciona direto no padrao.
    const btnHTML = exigePers
      ? `<button class="cc-item-add cc-item-personalizar" aria-label="Escolher opções de ${escAttr(item.nome)}" onclick="event.stopPropagation();ccAbrirPersonalizacao('${item.id}')">+</button>`
      : `<button class="cc-item-add" aria-label="Adicionar ${escAttr(item.nome)}" onclick="event.stopPropagation();ccAdicionarItem('${item.id}')">+</button>`;
    // Toque no card = adicionar +1 (comportamento de sempre). Item que exige
    // escolha (tamanho) abre a personalizacao, porque nao da pra adicionar sem.
    const clickAttr = exigePers
      ? `onclick="ccAbrirPersonalizacao('${item.id}')"`
      : `onclick="ccCardClick(event,'${item.id}')"`;
    // Acrescimos opcionais: um botao proprio, so ele abre a personalizacao.
    // Assim o resto do card continua adicionando +1 com um toque.
    const dicaHTML = (temGrupos && !exigePers)
      ? `<button type="button" class="cc-item-dica" onclick="event.stopPropagation();ccDicaClick(event,'${item.id}')"><i class="fa fa-sliders"></i> Adicionar acréscimos</button>`
      : '';
    return `
      <div class="cc-item-card cc-item-clickable" id="cc-card-${item.id}" role="button" tabindex="0" ${clickAttr} style="margin-bottom:8px;cursor:pointer;${item.destaque==='SIM'?'border-color:rgba(245,158,11,0.5);background:rgba(245,158,11,0.05);':''}">
        ${temFoto
          ? `<div class="cc-foto-wrap">
               <img loading="lazy" decoding="async" src="${escAttr(item.foto)}" class="cc-item-foto" onerror="this.parentNode.style.display='none'">
               <button class="cc-foto-zoom" aria-label="Ver foto de ${escAttr(item.nome)}" onclick="event.stopPropagation();ccAbrirFoto('${item.id}')">🔍</button>
             </div>`
          : `<div class="cc-item-foto-placeholder">${placeholderEmoji}</div>`}
        <div class="cc-item-info">
          <div class="cc-item-nome">
            ${item.destaque === 'SIM' ? '<span class="cc-badge-destaque">⭐ Mais pedido</span>' : ''}
            ${escHTML(item.nome)}
          </div>
          ${item.descricao ? `<div class="cc-item-desc">${escHTML(item.descricao)}</div>` : ''}
          ${precoHTML}
          ${dicaHTML}
        </div>
        <div class="cc-qty-ctrl" id="cc-qty-${item.id}" onclick="event.stopPropagation()">
          ${btnHTML}
        </div>
      </div>`;
  }

  // ── MODO SERVIÇO: card em lista, botão "Agendar" abre WhatsApp ─────────────
  function _ccItemServicoHTML(item, placeholderEmoji) {
    const temFoto = !!item.foto;
    const preco = parseFloat(item.preco) || 0;
    return `
      <div class="cc-item-card cc-servico-card" id="cc-card-${item.id}" style="margin-bottom:8px;${item.destaque==='SIM'?'border-color:rgba(245,158,11,0.5);background:rgba(245,158,11,0.05);':''}">
        ${temFoto
          ? `<img loading="lazy" decoding="async" src="${escAttr(item.foto)}" class="cc-item-foto" onclick="ccAbrirFoto('${item.id}')" style="cursor:zoom-in;" onerror="this.style.display='none'">`
          : `<div class="cc-item-foto-placeholder">${placeholderEmoji}</div>`}
        <div class="cc-item-info">
          <div class="cc-item-nome">
            ${item.destaque === 'SIM' ? '<span class="cc-badge-destaque">⭐ Mais procurado</span>' : ''}
            ${escHTML(item.nome)}
          </div>
          ${item.descricao ? `<div class="cc-item-desc">${escHTML(item.descricao)}</div>` : ''}
          ${preco > 0 ? `<div class="cc-item-preco">R$ ${preco.toFixed(2).replace('.',',')}</div>` : '<div class="cc-item-preco cc-preco-consultar">Sob consulta</div>'}
        </div>
        <button class="cc-btn-agendar" onclick="ccAgendarServico('${item.id}')">
          <i class="fab fa-whatsapp"></i> Agendar
        </button>
      </div>`;
  }

  // ── MODO VITRINE: grade 2 colunas, foto grande, "Tenho interesse" ─────────
  function _ccItemVitrineHTML(item, placeholderEmoji) {
    const temFoto = !!item.foto;
    const preco = parseFloat(item.preco) || 0;
    // Placeholder fica sempre no fundo do wrap; a foto (se houver) cobre por cima.
    // Se a foto falhar, onerror apenas esconde a <img> e o placeholder reaparece,
    // sem destruir o badge de destaque (bug antigo: innerHTML apagava a estrela).
    const zoomAttr = temFoto ? ` onclick="ccAbrirFoto('${item.id}')" style="cursor:zoom-in;"` : '';
    return `
      <div class="cc-vitrine-card" id="cc-card-${item.id}">
        <div class="cc-vitrine-foto-wrap"${zoomAttr}>
          <div class="cc-vitrine-foto-ph">${placeholderEmoji}</div>
          ${temFoto
            ? `<img loading="lazy" decoding="async" src="${escAttr(item.foto)}" class="cc-vitrine-foto" onerror="this.style.display='none'">`
            : ''}
          ${item.destaque === 'SIM' ? '<span class="cc-vitrine-badge">⭐ Destaque</span>' : ''}
        </div>
        <div class="cc-vitrine-info">
          <div class="cc-vitrine-nome">${escHTML(item.nome)}</div>
          ${item.descricao ? `<div class="cc-vitrine-desc">${escHTML(item.descricao)}</div>` : ''}
          ${preco > 0 ? `<div class="cc-vitrine-preco">R$ ${preco.toFixed(2).replace('.',',')}</div>` : '<div class="cc-vitrine-preco cc-preco-consultar">Sob consulta</div>'}
          <button class="cc-btn-interesse" onclick="ccInteresse('${item.id}')">
            <i class="fab fa-whatsapp"></i> Tenho interesse
          </button>
        </div>
      </div>`;
  }

  // Clique no card inteiro adiciona +1 ao carrinho.
  // Guarda anti-scroll: se o dedo se moveu (rolagem), não conta como clique.
  let _ccTouchY = null, _ccTouchMoved = false;
  document.addEventListener('touchstart', function(e) {
    // Arma a guarda para o card inteiro E para o botao de acrescimos, que
    // fica dentro do card mas tem handler proprio.
    const alvo = e.target.closest && e.target.closest('.cc-item-clickable, .cc-item-dica');
    if (alvo) { _ccTouchY = e.touches[0].clientY; _ccTouchMoved = false; }
  }, { passive: true });
  document.addEventListener('touchmove', function(e) {
    if (_ccTouchY !== null && Math.abs(e.touches[0].clientY - _ccTouchY) > 8) _ccTouchMoved = true;
  }, { passive: true });

  window.ccCardClick = function(event, itemId) {
    // Ignora se o toque foi na verdade uma rolagem
    if (_ccTouchMoved) { _ccTouchMoved = false; _ccTouchY = null; return; }
    _ccTouchY = null;
    ccAdicionarItem(itemId);
  };

  // Botao 'Adicionar acrescimos': mesma guarda anti-rolagem do card, senao
  // rolar a lista com o dedo em cima dele abriria a personalizacao sem querer.
  window.ccDicaClick = function(event, itemId) {
    if (_ccTouchMoved) { _ccTouchMoved = false; _ccTouchY = null; return; }
    _ccTouchY = null;
    ccAbrirPersonalizacao(itemId);
  };

  window.ccAdicionarItem = function(itemId) {
    const loja = LOJAS[_ccLojaIdx];
    const item = loja.cardapio.find(i => i.id === itemId);
    if (!item) return;

    // So obriga a personalizar quando ha escolha obrigatoria (ex.: tamanho).
    // Com acrescimos opcionais, o '+' adiciona direto no padrao.
    if (_ccItemExigePersonalizar(item)) { ccAbrirPersonalizacao(itemId); return; }

    // Item com grupos opcionais: entra como linha 'padrao' (sem acrescimos).
    // A chave inclui as escolhas vazias, entao se depois o cliente montar um
    // com bacon, vira outra linha — e nao mistura com este.
    const escolhasPadrao = _ccItemTemGrupos(item) ? _ccEscolhasPadrao(item) : null;
    const chave = escolhasPadrao ? _ccLineKey(item, escolhasPadrao) : itemId;
    if (!_ccCarrinho[chave]) {
      _ccCarrinho[chave] = {
        item, qty: 0,
        escolhas: escolhasPadrao,
        precoUnit: escolhasPadrao ? _ccPrecoUnitario(item, escolhasPadrao) : (parseFloat(item.preco) || 0),
      };
    }
    _ccCarrinho[chave].qty++;

    // Troca botão "+" por controles de quantidade (usa a chave da linha, que
    // para item com grupos opcionais nao e igual ao itemId).
    const qtyEl = document.getElementById(`cc-qty-${itemId}`);
    if (qtyEl) {
      const kEsc = String(chave).replace(/'/g, "\\'");
      qtyEl.innerHTML = `
        <button class="cc-qty-btn" onclick="event.stopPropagation();ccAlterarQty('${kEsc}',-1)">−</button>
        <span class="cc-qty-num">${_ccCarrinho[chave].qty}</span>
        <button class="cc-qty-btn" onclick="event.stopPropagation();ccAlterarQty('${kEsc}',+1)" style="background:linear-gradient(135deg,#10b981,#059669);color:#fff;border:none;">+</button>
      `;
    }
    ccAtualizarCarrinho();
  };

  /* ─── Tela de personalizacao (item com grupos) ─────────────── */
  window.ccAbrirPersonalizacao = function(itemId) {
    const loja = LOJAS[_ccLojaIdx];
    const item = loja.cardapio.find(i => i.id === itemId);
    if (!item || !_ccItemTemGrupos(item)) return;
    _ccPersItem = item;
    _ccPersEscolhas = {};
    // Pre-seleciona a 1a opcao de grupos UNICA obrigatorios (min>=1), p/ nunca
    // deixar o cliente com um estado invalido de largada (ex.: tamanho).
    (item.grupos || []).forEach(g => {
      if (g.tipo === 'UNICA' && g.min >= 1 && g.opcoes.length) {
        _ccPersEscolhas[g.id] = [g.opcoes[0].id];
      } else {
        _ccPersEscolhas[g.id] = [];
      }
    });
    _ccRenderPersonalizacao();
    const modal = document.getElementById('modal-cc-pers');
    if (modal) { modal.style.display = 'flex'; requestAnimationFrame(() => modal.classList.add('aberto')); }
  };

  window.ccFecharPersonalizacao = function() {
    const modal = document.getElementById('modal-cc-pers');
    if (modal) { modal.classList.remove('aberto'); setTimeout(() => { modal.style.display = 'none'; }, 200); }
    _ccPersItem = null; _ccPersEscolhas = {};
  };

  // Marca/desmarca uma opcao respeitando o tipo do grupo.
  window.ccPersToggle = function(grupoId, opcaoId) {
    const item = _ccPersItem; if (!item) return;
    const g = (item.grupos || []).find(x => x.id === grupoId); if (!g) return;
    const atual = _ccPersEscolhas[grupoId] || [];
    if (g.tipo === 'UNICA') {
      // Radio: se ja marcada e o grupo e opcional (min 0), desmarca; senao troca.
      if (atual.length === 1 && atual[0] === opcaoId && g.min === 0) _ccPersEscolhas[grupoId] = [];
      else _ccPersEscolhas[grupoId] = [opcaoId];
    } else {
      // Checkbox: alterna, respeitando o teto max (se >0). Opcoes repetiveis
      // (qtdMax>1) nao passam por aqui — usam ccPersQtd (stepper).
      const idx = atual.indexOf(opcaoId);
      if (idx >= 0) { atual.splice(idx, 1); }
      else {
        if (g.max > 0 && atual.length >= g.max) { mlToast('Máximo de ' + g.max + ' em ' + g.nome, 'erro'); return; }
        atual.push(opcaoId);
      }
      _ccPersEscolhas[grupoId] = atual;
    }
    _ccRenderPersonalizacao();
  };

  // Stepper de opcao repetivel: soma/subtrai UMA unidade do id no array.
  // Barra em dois tetos: o qtdMax da propria opcao e o max do grupo (unidades).
  window.ccPersQtd = function(grupoId, opcaoId, delta) {
    const item = _ccPersItem; if (!item) return;
    const g = (item.grupos || []).find(x => x.id === grupoId); if (!g) return;
    const op = (g.opcoes || []).find(o => o.id === opcaoId); if (!op) return;
    const atual = _ccPersEscolhas[grupoId] || [];
    const qtd = _ccQtdOpcao(atual, opcaoId);

    if (delta > 0) {
      const teto = _ccOpcaoQtdMax(g, op);
      if (qtd >= teto) { mlToast('Máximo de ' + teto + 'x ' + op.nome, 'erro'); return; }
      if (g.max > 0 && atual.length >= g.max) { mlToast('Máximo de ' + g.max + ' em ' + g.nome, 'erro'); return; }
      atual.push(opcaoId);
    } else {
      const idx = atual.indexOf(opcaoId);
      if (idx < 0) return;
      atual.splice(idx, 1);
    }
    _ccPersEscolhas[grupoId] = atual;
    _ccRenderPersonalizacao();
  };

  function _ccRenderPersonalizacao() {
    const item = _ccPersItem; if (!item) return;
    const cont = document.getElementById('cc-pers-corpo');
    const tituloEl = document.getElementById('cc-pers-titulo');
    if (tituloEl) tituloEl.textContent = item.nome;
    if (!cont) return;

    const gruposHTML = (item.grupos || []).map(g => {
      const sel = _ccPersEscolhas[g.id] || [];
      const obrig = g.min > 0;
      // Com opcoes repetiveis o teto do grupo conta UNIDADES (3 salsichas = 3),
      // entao o texto precisa dizer 'itens' para nao parecer que conta opcoes.
      const _temRepetivel = (g.opcoes || []).some(o => _ccOpcaoQtdMax(g, o) > 1);
      const regra = g.tipo === 'UNICA'
        ? (obrig ? 'Escolha 1' : 'Opcional')
        : (g.max > 0 ? ('Ate ' + g.max + (_temRepetivel ? ' itens' : '')) : 'Quantos quiser');
      const opcoesHTML = g.opcoes.map(op => {
        const qtd = _ccQtdOpcao(sel, op.id);
        const marcada = qtd > 0;
        const p = parseFloat(op.preco) || 0;
        const precoTxt = (g.precoModo === 'ABSOLUTO' || g.precoModo === 'POR_ITEM')
          ? 'R$ ' + p.toFixed(2).replace('.',',')
          : (p > 0 ? '+ R$ ' + p.toFixed(2).replace('.',',') : '');
        const teto = _ccOpcaoQtdMax(g, op);

        // Opcao repetivel: stepper no lugar do checkbox. Precisa ser <div> —
        // botao dentro de botao e HTML invalido e quebra o clique no Android.
        if (teto > 1) {
          const noTeto = qtd >= teto;
          return `<div class="cc-pers-opcao cc-pers-opcao-qtd${marcada?' sel':''}">
              <span class="cc-pers-opcao-nome">${escHTML(op.nome)}</span>
              ${precoTxt ? `<span class="cc-pers-opcao-preco">${precoTxt}</span>` : ''}
              <span class="cc-pers-stepper">
                <button type="button" class="cc-pers-step-btn" ${qtd<=0?'disabled':''}
                  aria-label="Menos um ${escAttr(op.nome)}"
                  onclick="ccPersQtd('${g.id}','${op.id}',-1)">&minus;</button>
                <span class="cc-pers-step-num${marcada?' on':''}">${qtd}</span>
                <button type="button" class="cc-pers-step-btn mais" ${noTeto?'disabled':''}
                  aria-label="Mais um ${escAttr(op.nome)}"
                  onclick="ccPersQtd('${g.id}','${op.id}',1)">+</button>
              </span>
            </div>`;
        }

        const marca = g.tipo === 'UNICA'
          ? `<span class="cc-pers-radio${marcada?' on':''}"></span>`
          : `<span class="cc-pers-check${marcada?' on':''}"><i class="fa fa-check"></i></span>`;
        return `<button type="button" class="cc-pers-opcao${marcada?' sel':''}" onclick="ccPersToggle('${g.id}','${op.id}')">
            ${marca}
            <span class="cc-pers-opcao-nome">${escHTML(op.nome)}</span>
            ${precoTxt ? `<span class="cc-pers-opcao-preco">${precoTxt}</span>` : ''}
          </button>`;
      }).join('');
      return `<div class="cc-pers-grupo">
          <div class="cc-pers-grupo-head">
            <span class="cc-pers-grupo-nome">${escHTML(g.nome)}${obrig?'<span class="cc-pers-obrig">obrigatório</span>':''}</span>
            <span class="cc-pers-grupo-regra">${regra}</span>
          </div>
          ${opcoesHTML}
        </div>`;
    }).join('');
    cont.innerHTML = gruposHTML;

    // Rodape: preco unitario ao vivo + estado do botao.
    const precoUnit = _ccPrecoUnitario(item, _ccPersEscolhas);
    const erro = _ccValidarEscolhas(item, _ccPersEscolhas);
    const btn = document.getElementById('cc-pers-add-btn');
    const precoEl = document.getElementById('cc-pers-preco');
    if (precoEl) precoEl.textContent = 'R$ ' + precoUnit.toFixed(2).replace('.',',');
    if (btn) {
      btn.disabled = !!erro;
      btn.querySelector('.cc-pers-add-label').textContent = erro || 'Adicionar ao pedido';
    }
  }

  // Confirma a personalizacao: adiciona (ou incrementa) a linha no carrinho.
  // Redesenha o controle de quantidade do card de um item, refletindo o
  // carrinho. Como um item pode ter varias linhas (configuracoes diferentes),
  // o card mostra a linha PADRAO (sem acrescimos) — que e a que o '+' cria.
  // Se ela nao existe, volta ao botao original do card.
  function _ccSincronizarCard(item) {
    if (!item) return;
    const qtyEl = document.getElementById(`cc-qty-${item.id}`);
    if (!qtyEl) return;
    const chavePadrao = _ccItemTemGrupos(item)
      ? _ccLineKey(item, _ccEscolhasPadrao(item))
      : item.id;
    const linha = _ccCarrinho[chavePadrao];
    if (linha && linha.qty > 0) {
      const kEsc = String(chavePadrao).replace(/'/g, "\\'");
      qtyEl.innerHTML = `
        <button class="cc-qty-btn" onclick="event.stopPropagation();ccAlterarQty('${kEsc}',-1)">−</button>
        <span class="cc-qty-num">${linha.qty}</span>
        <button class="cc-qty-btn" onclick="event.stopPropagation();ccAlterarQty('${kEsc}',+1)" style="background:linear-gradient(135deg,#10b981,#059669);color:#fff;border:none;">+</button>
      `;
    } else {
      qtyEl.innerHTML = _ccItemExigePersonalizar(item)
        ? `<button class="cc-item-add cc-item-personalizar" onclick="event.stopPropagation();ccAbrirPersonalizacao('${item.id}')">+</button>`
        : `<button class="cc-item-add" onclick="event.stopPropagation();ccAdicionarItem('${item.id}')">+</button>`;
    }
  }

  window.ccPersConfirmar = function() {
    const item = _ccPersItem; if (!item) return;
    const erro = _ccValidarEscolhas(item, _ccPersEscolhas);
    if (erro) { mlToast(erro, 'erro'); return; }
    const escolhas = JSON.parse(JSON.stringify(_ccPersEscolhas));
    const key = _ccLineKey(item, escolhas);
    const precoUnit = _ccPrecoUnitario(item, escolhas);
    if (!_ccCarrinho[key]) {
      _ccCarrinho[key] = { item, qty: 0, escolhas, precoUnit };
    }
    _ccCarrinho[key].qty++;
    _ccCarrinho[key].precoUnit = precoUnit; // reafirma (caso preco tenha mudado)
    _ccSincronizarCard(item);
    ccFecharPersonalizacao();
    ccAtualizarCarrinho();
    // Abre o carrinho pra dar feedback de que entrou.
    _ccCartExpanded = true; ccAplicarEstadoCarrinho();
  };

  // Recebe a CHAVE da linha do carrinho (que pode ser 'itemId|grupo:opcao').
  window.ccAlterarQty = function(chave, delta) {
    const linha = _ccCarrinho[chave];
    if (!linha) return;
    // O card na tela e identificado pelo id do item, nao pela chave da linha.
    const itemId = (linha.item && linha.item.id) || String(chave).split('|')[0];
    linha.qty += delta;
    if (linha.qty <= 0) {
      delete _ccCarrinho[chave];
      // Volta para o botao original do card (respeitando se exige personalizar).
      const qtyEl = document.getElementById(`cc-qty-${itemId}`);
      if (qtyEl) {
        const it = linha.item;
        qtyEl.innerHTML = (it && _ccItemExigePersonalizar(it))
          ? `<button class="cc-item-add cc-item-personalizar" onclick="event.stopPropagation();ccAbrirPersonalizacao('${itemId}')">+</button>`
          : `<button class="cc-item-add" onclick="event.stopPropagation();ccAdicionarItem('${itemId}')">+</button>`;
      }
    } else {
      const qtyEl = document.getElementById(`cc-qty-${itemId}`);
      const numEl = qtyEl && qtyEl.querySelector('.cc-qty-num');
      if (numEl) numEl.textContent = linha.qty;
    }
    // Garante que o card reflita a linha padrao (pode ter mexido em outra).
    _ccSincronizarCard(linha.item);
    ccAtualizarCarrinho();
  };

  window.ccLimparCarrinho = function() {
    _ccCarrinho = {};
    const loja = LOJAS[_ccLojaIdx];
    if (loja) ccRenderItens(loja);
    ccAtualizarCarrinho();
  };

  // ── Foto ampliada (lightbox) — compartilhado por todos os modos ──────────
  window.ccAbrirFoto = function(itemId) {
    const loja = LOJAS[_ccLojaIdx];
    const item = loja && loja.cardapio.find(i => i.id === itemId);
    if (!item || !item.foto) return;
    let lb = document.getElementById('cc-lightbox');
    if (!lb) {
      lb = document.createElement('div');
      lb.id = 'cc-lightbox';
      lb.className = 'cc-lightbox';
      lb.onclick = () => ccFecharFoto();
      document.body.appendChild(lb);
    }
    const preco = parseFloat(item.preco) || 0;
    lb.innerHTML = `
      <button class="cc-lightbox-close" aria-label="Fechar" onclick="event.stopPropagation();ccFecharFoto()">&times;</button>
      <div class="cc-lightbox-inner" onclick="event.stopPropagation()">
        <img src="${escAttr(item.foto)}" class="cc-lightbox-img" alt="${escAttr(item.nome)}">
        <div class="cc-lightbox-meta">
          <div class="cc-lightbox-nome">${escHTML(item.nome)}</div>
          ${item.descricao ? `<div class="cc-lightbox-desc">${escHTML(item.descricao)}</div>` : ''}
          ${preco > 0 ? `<div class="cc-lightbox-preco">R$ ${preco.toFixed(2).replace('.',',')}</div>` : ''}
        </div>
      </div>`;
    // força reflow para animar entrada
    void lb.offsetWidth;
    lb.classList.add('open');
    document.body.style.overflow = 'hidden';
  };
  window.ccFecharFoto = function() {
    const lb = document.getElementById('cc-lightbox');
    if (!lb) return;
    lb.classList.remove('open');
    // mantém overflow travado se o modal do cardápio ainda estiver aberto
    const cardapioAberto = document.getElementById('modal-cardapio-cliente')?.classList.contains('open');
    document.body.style.overflow = cardapioAberto ? 'hidden' : '';
  };

  // ── Ação por WhatsApp para modos serviço/vitrine (sem carrinho) ──────────
  function _ccAbrirWhatsItem(itemId, verbo) {
    const loja = LOJAS[_ccLojaIdx];
    if (!loja) return;
    const item = loja.cardapio.find(i => i.id === itemId);
    if (!item) return;
    if (!loja.wpp) { mlToast('Esta loja não tem WhatsApp cadastrado.', 'erro'); return; }
    const preco = parseFloat(item.preco) || 0;
    const precoTxt = preco > 0 ? ` (R$ ${preco.toFixed(2).replace('.',',')})` : '';
    const msg = `Olá! Vim pelo AngatubaON 👋\n\n${verbo}: *${item.nome}*${precoTxt}\n\nPoderia me passar mais informações?`;
    const url = `https://wa.me/${loja.wpp}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank', 'noopener');
    try { registrarClique(loja.nome, 'whatsapp', loja.plano || 'GRATIS', loja.categoria || ''); } catch(e) {}
  }
  window.ccAgendarServico = function(itemId) { _ccAbrirWhatsItem(itemId, 'Quero agendar'); };
  window.ccInteresse = function(itemId) {
    const loja = LOJAS[_ccLojaIdx];
    const slug = (loja && loja.categoria || '').toLowerCase();
    _ccAbrirWhatsItem(itemId, slug === 'imobiliaria' ? 'Tenho interesse neste imóvel' : 'Tenho interesse em');
  };

  function ccAtualizarCarrinho() {
    const bar    = document.getElementById('cc-carrinho-bar');
    const lista  = document.getElementById('cc-carrinho-itens');
    const totalEl = document.getElementById('cc-total');
    const totalHeadEl = document.getElementById('cc-total-head');
    const countEl = document.getElementById('cc-cart-count');
    const itens  = Object.values(_ccCarrinho);

    if (itens.length === 0) {
      if (bar) bar.style.display = 'none';
      _ccCartExpanded = false;
      ccAplicarEstadoCarrinho();
      return;
    }

    // Pulse de atenção quando o carrinho aparece (estava oculto e agora tem itens)
    const estavaOculto = bar && (bar.style.display === 'none' || bar.style.display === '');
    if (bar) bar.style.display = '';
    if (estavaOculto && bar && !_ccCartExpanded) {
      bar.classList.remove('cc-cart-pulse');
      // força reflow para reiniciar a animação
      void bar.offsetWidth;
      bar.classList.add('cc-cart-pulse');
      setTimeout(() => bar.classList.remove('cc-cart-pulse'), 600);
    }

    let subtotal = 0, totalQty = 0;
    // Preco por linha = precoUnit (ja inclui modificadores) * qty. Itens antigos
    // sem precoUnit caem no preco base do item (retrocompat).
    const _precoLinha = (linha) => {
      const unit = (linha.precoUnit != null) ? linha.precoUnit : (parseFloat(linha.item.preco) || 0);
      return unit * linha.qty;
    };
    if (lista) {
      lista.innerHTML = itens.map((linha) => {
        const { item, qty, escolhas } = linha;
        const sub = _precoLinha(linha);
        subtotal += sub; totalQty += qty;
        const extras = escolhas ? _ccResumoEscolhas(item, escolhas) : [];
        const extrasHTML = extras.length
          ? `<div style="font-size:10px;color:var(--muted);line-height:1.4;margin-top:1px;">${extras.map(e => '+ ' + escHTML(e)).join('<br>')}</div>`
          : '';
        return `<div style="display:flex;align-items:flex-start;justify-content:space-between;font-size:12px;gap:8px;">
          <span style="flex:1;color:var(--text);">${qty}× ${escHTML(item.nome)}${extrasHTML}</span>
          <span style="color:var(--green);font-weight:700;flex-shrink:0;">R$ ${sub.toFixed(2).replace('.',',')}</span>
        </div>`;
      }).join('');
    } else {
      itens.forEach((linha) => { subtotal += _precoLinha(linha); totalQty += linha.qty; });
    }

    // ── Taxa de entrega: só entra no cálculo se a loja faz entrega ──
    const loja = LOJAS[_ccLojaIdx];
    const taxa = (loja && loja.fazEntrega)
      ? calcularTaxaEntrega(loja.taxaEntrega, subtotal)
      : { modo: 'NENHUMA', valor: 0, gratis: true, combinar: false, faltaParaGratis: 0, label: '' };

    const total = subtotal + (taxa.valor || 0);

    // Elementos do resumo
    const subRow    = document.getElementById('cc-subtotal-row');
    const subEl     = document.getElementById('cc-subtotal');
    const entRow    = document.getElementById('cc-entrega-row');
    const entValEl  = document.getElementById('cc-entrega-valor');
    const entHint   = document.getElementById('cc-entrega-hint');

    // Mostra linha de subtotal + entrega apenas quando há taxa (fixa/mínimo/combinar/grátis explícito)
    const temTaxaDefinida = loja && loja.fazEntrega && taxa.modo !== 'NENHUMA';
    if (subRow) subRow.style.display = temTaxaDefinida ? 'flex' : 'none';
    if (subEl)  subEl.textContent = `R$ ${subtotal.toFixed(2).replace('.',',')}`;

    if (entRow && entValEl) {
      if (temTaxaDefinida) {
        entRow.style.display = 'flex';
        if (taxa.combinar) {
          entValEl.textContent = 'A combinar';
          entValEl.style.color = '#fb923c';
        } else if (taxa.gratis) {
          entValEl.textContent = 'Grátis';
          entValEl.style.color = 'var(--green)';
        } else {
          entValEl.textContent = _fmtBRL(taxa.valor);
          entValEl.style.color = 'var(--text)';
        }
      } else {
        entRow.style.display = 'none';
      }
    }

    // Dica "falta R$ X para frete grátis" (só no modo MÍNIMO ainda não atingido)
    if (entHint) {
      if (temTaxaDefinida && taxa.modo === 'MINIMO' && taxa.faltaParaGratis > 0) {
        entHint.textContent = `🎁 Falta ${_fmtBRL(taxa.faltaParaGratis)} para ganhar entrega grátis`;
        entHint.style.display = 'block';
      } else {
        entHint.style.display = 'none';
      }
    }

    const totalStr = `R$ ${total.toFixed(2).replace('.',',')}`;
    if (totalEl) totalEl.textContent = totalStr;
    if (totalHeadEl) totalHeadEl.textContent = totalStr;
    if (countEl) countEl.textContent = `${totalQty} ${totalQty === 1 ? 'item' : 'itens'}`;

    // Se o carrinho está aberto, recalcula a altura (conteúdo mudou)
    if (_ccCartExpanded) ccAplicarEstadoCarrinho();
  }

  // Estado de expansão do carrinho colapsável

  function ccAplicarEstadoCarrinho() {
    const body    = document.getElementById('cc-cart-body');
    const head    = document.getElementById('cc-cart-head');
    const chevron = document.getElementById('cc-cart-chevron');
    const action  = document.getElementById('cc-cart-action-text');
    if (!body) return;
    if (_ccCartExpanded) {
      // limita a metade da altura do sheet para nunca cobrir a lista toda
      const max = Math.round(window.innerHeight * 0.5);
      body.style.maxHeight = Math.min(body.scrollHeight, max) + 'px';
      body.style.overflowY = body.scrollHeight > max ? 'auto' : 'hidden';
      if (chevron) chevron.style.transform = 'rotate(180deg)';
      if (action)  action.textContent = 'Recolher pedido';
      if (head) head.setAttribute('aria-expanded', 'true');
    } else {
      body.style.maxHeight = '0px';
      body.style.overflowY = 'hidden';
      if (chevron) chevron.style.transform = '';
      if (action)  action.textContent = 'Ver pedido e finalizar';
      if (head) head.setAttribute('aria-expanded', 'false');
    }
  }

  window.ccToggleCarrinho = function() {
    _ccCartExpanded = !_ccCartExpanded;
    ccAplicarEstadoCarrinho();
  };

  window.ccFinalizarPedido = function() {
    const loja  = LOJAS[_ccLojaIdx];
    if (!loja || !loja.wpp) { mlToast('Esta loja não tem WhatsApp cadastrado.', 'erro'); return; }

    const itens = Object.values(_ccCarrinho);
    if (itens.length === 0) return;

    // Proteção contra double-submit: desabilita o botão imediatamente
    const finalizarBtn = document.querySelector('#modal-cardapio-cliente button[onclick="ccFinalizarPedido()"]');
    if (finalizarBtn) {
      if (finalizarBtn.disabled) return;
      finalizarBtn.disabled = true;
      setTimeout(() => { if (finalizarBtn) finalizarBtn.disabled = false; }, 6000);
    }

    let subtotal = 0;
    const linhas = itens.map((linha) => {
      const { item, qty, escolhas } = linha;
      const unit = (linha.precoUnit != null) ? linha.precoUnit : (parseFloat(item.preco) || 0);
      const sub = unit * qty;
      subtotal += sub;
      const extras = escolhas ? _ccResumoEscolhas(item, escolhas) : [];
      const extrasTxt = extras.length ? extras.map(e => '\n   + ' + e).join('') : '';
      return `• ${qty}× ${item.nome}${extrasTxt} — R$ ${sub.toFixed(2).replace('.',',')}`;
    });

    const obsEl = document.getElementById('cc-obs-input');
    const obs = obsEl ? obsEl.value.trim() : '';
    const obsLine = obs ? `\n\n📝 *Observações:* ${obs}` : '';

    // ── Taxa de entrega ──
    const taxa = loja.fazEntrega
      ? calcularTaxaEntrega(loja.taxaEntrega, subtotal)
      : { modo: 'NENHUMA', valor: 0, gratis: true, combinar: false, label: '' };
    const total = subtotal + (taxa.valor || 0);
    const temTaxaDefinida = loja.fazEntrega && taxa.modo !== 'NENHUMA';

    // Dados de entrega (se loja faz entrega)
    let entregaLine = '';
    if (loja.fazEntrega) {
      const endEl = document.getElementById('cc-entrega-endereco');
      const pagEl = document.getElementById('cc-entrega-pagamento');
      const end = endEl ? endEl.value.trim() : '';
      const pag = pagEl ? pagEl.value.trim() : '';
      if (!end) { if (finalizarBtn) finalizarBtn.disabled = false; mlToast('Informe o endereço para entrega.', 'erro'); return; }
      if (!pag) { if (finalizarBtn) finalizarBtn.disabled = false; mlToast('Selecione a forma de pagamento.', 'erro'); return; }
      entregaLine = `\n\n📍 *Entrega para:* ${end}\n💰 *Pagamento:* ${pag}`;
      // Guarda para acelerar o próximo pedido (recompra)
      try { localStorage.setItem('angatuba_cli_endereco', end); localStorage.setItem('angatuba_cli_pagamento', pag); } catch (e) {}
    }

    // Bloco de valores: mostra subtotal + entrega separados só quando há taxa definida
    let valoresBloco;
    if (temTaxaDefinida) {
      let entTxt;
      if (taxa.combinar)   entTxt = 'a combinar';
      else if (taxa.gratis) entTxt = 'grátis';
      else                  entTxt = 'R$ ' + taxa.valor.toFixed(2).replace('.', ',');
      valoresBloco = `Subtotal: R$ ${subtotal.toFixed(2).replace('.',',')}\n`
                   + `🛵 Entrega: ${entTxt}\n`
                   + `*Total: R$ ${total.toFixed(2).replace('.',',')}*`;
    } else {
      valoresBloco = `*Total: R$ ${total.toFixed(2).replace('.',',')}*`;
    }

    const msg = `Olá! Fiz um pedido pelo AngatubaON 🛒\n\n${linhas.join('\n')}\n\n${valoresBloco}${entregaLine}${obsLine}\n\nPoderia confirmar?`;
    const url = `https://wa.me/${loja.wpp}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank', 'noopener');

    // Exibe botão de confirmação explícita em vez de detectar visibilitychange
    // (visibilitychange dispara para qualquer troca de app, não só para o WhatsApp)
    const cartInner = document.querySelector('#cc-cart-body > div')
                   || document.getElementById('cc-carrinho-bar');
    if (cartInner) {
      // Remove botão anterior se existir (evita acúmulo a cada chamada)
      cartInner.querySelector('.cc-confirm-btn')?.remove();
      const confirmBtn = document.createElement('button');
      confirmBtn.className = 'cc-confirm-btn';
      confirmBtn.style.cssText = `
        width:100%;margin-top:8px;padding:13px;border-radius:12px;
        background:rgba(37,211,102,0.15);border:1px solid rgba(37,211,102,0.4);
        color:#25d366;font-family:var(--font-h);font-size:13px;font-weight:800;
        cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;
      `;
      confirmBtn.innerHTML = '<i class="fab fa-whatsapp"></i> Pedido enviado! Confirmar';
      confirmBtn.onclick = () => _ccMostrarSucesso();
      cartInner.appendChild(confirmBtn);
      // Garante que o carrinho fique aberto para o usuário ver o botão de confirmar
      _ccCartExpanded = true;
      ccAplicarEstadoCarrinho();
    }
  };

  window._ccMostrarSucesso = function() {
    // Esconde o carrinho e mostra a mensagem de sucesso dentro do modal
    const carrinhoBar = document.getElementById('cc-carrinho-bar');
    const wrap        = document.getElementById('cc-itens-wrap');

    // Cria (ou reutiliza) div de sucesso
    let sucesso = document.getElementById('cc-pedido-sucesso');
    if (!sucesso) {
      sucesso = document.createElement('div');
      sucesso.id = 'cc-pedido-sucesso';
      sucesso.style.cssText = `
        display:flex; flex-direction:column; align-items:center; justify-content:center;
        gap:12px; padding:40px 24px; text-align:center;
      `;
      sucesso.innerHTML = `
        <div style="font-size:3rem;">✅</div>
        <div style="font-family:var(--font-h);font-size:1.2rem;font-weight:800;color:var(--text);">Pedido enviado!</div>
        <p style="font-size:13px;color:var(--muted);margin:0;">Seu pedido foi enviado pelo WhatsApp.<br>Aguarde a confirmação da loja.</p>
        <button onclick="fecharCardapioCliente()" style="
          margin-top:8px; padding:12px 28px; border-radius:12px;
          background:linear-gradient(135deg,#25d366,#128c7e);
          color:#fff; font-family:var(--font-h); font-size:14px; font-weight:800;
          border:none; cursor:pointer;
        ">Fechar</button>
      `;
      // Insere dentro do modal de forma estável, após o wrap de itens
      const modalBody = document.getElementById('cc-itens-wrap')?.parentNode
                     || document.getElementById('modal-cardapio-cliente');
      if (modalBody) modalBody.appendChild(sucesso);
    }

    if (carrinhoBar) carrinhoBar.style.display = 'none';
    if (wrap)        wrap.style.display        = 'none';
    sucesso.style.display = 'flex';

    // Limpa carrinho
    _ccCarrinho = {};
  };

  document.getElementById('modal-cardapio-cliente')?.addEventListener('click', function(e) {
    if (e.target === this) fecharCardapioCliente();
  });
  /* ───────────────────────────────────────────────────────────
     Swipe-to-dismiss: arrastar a barrinha para baixo fecha o modal.
     Funciona em todos os sheets que têm handle (.detail-handle /
     .modal-handle / .cc-handle-bar). Segue o dedo e fecha se passar
     do limiar; senão volta à posição.
     ─────────────────────────────────────────────────────────── */
  (function initSheetSwipe() {
    // overlayId -> { sheetSelector, close }
    const MAP = {
      'modal-detalhes':         { sheet: '.detail-sheet', close: () => fecharDetalhes() },
      'modal-minha-loja':       { sheet: '.detail-sheet', close: () => fecharMinhaLoja() },
      'modal-cardapio-cliente': { sheet: '.detail-sheet', close: () => fecharCardapioCliente() },
      'modal-cadastro':         { sheet: '.modal-sheet',  close: () => closeModal() },
    };

    const THRESHOLD   = 130;  // px de arraste para fechar (puxão claro)
    const FLICK_DY    = 50;   // px mínimos para considerar flick
    const FLICK_VEL   = 0.9;  // px/ms — flick precisa ser rápido E ter distância

    let active = null;      // { sheet, close, startY, lastY, lastT, dy, samples }

    function isHandle(el) {
      return el && el.closest && el.closest('.detail-handle, .modal-handle, .cc-handle-bar');
    }

    function findCtx(handle) {
      const overlay = handle.closest('.detail-overlay, .modal-overlay');
      if (!overlay || !overlay.id) return null;
      const cfg = MAP[overlay.id];
      if (!cfg) return null;
      const sheet = overlay.querySelector(cfg.sheet);
      if (!sheet) return null;
      return { sheet, close: cfg.close };
    }

    function start(clientY, handle) {
      const ctx = findCtx(handle);
      if (!ctx) return;
      active = { sheet: ctx.sheet, close: ctx.close, startY: clientY, lastY: clientY, lastT: Date.now(), dy: 0, samples: [{ y: clientY, t: Date.now() }] };
      ctx.sheet.style.transition = 'none';
    }

    function move(clientY) {
      if (!active) return;
      const now = Date.now();
      const dy = clientY - active.startY;
      active.dy = dy;
      active.lastY = clientY;
      active.lastT = now;
      // mantém amostras dos últimos ~120ms para medir velocidade real
      active.samples.push({ y: clientY, t: now });
      while (active.samples.length > 1 && now - active.samples[0].t > 120) {
        active.samples.shift();
      }
      // só permite arrastar para baixo
      const offset = Math.max(0, dy);
      active.sheet.style.transform = `translateY(${offset}px)`;
      active.sheet.style.opacity = String(Math.max(0.4, 1 - offset / 600));
    }

    function end() {
      if (!active) return;
      const a = active; active = null;
      a.sheet.style.transition = '';

      // velocidade média na janela de amostras (px/ms), nunca por um único frame curto
      let vel = 0;
      if (a.samples.length >= 2) {
        const first = a.samples[0];
        const last  = a.samples[a.samples.length - 1];
        const dt = last.t - first.t;
        if (dt > 0) vel = (last.y - first.y) / dt;
      }

      // Fecha se: puxou bem longe (THRESHOLD)  OU  flick rápido para baixo com distância mínima
      const fecharPorArraste = a.dy > THRESHOLD;
      const fecharPorFlick   = a.dy > FLICK_DY && vel > FLICK_VEL;

      if (fecharPorArraste || fecharPorFlick) {
        a.close();
      } else {
        // volta suave para o lugar
        a.sheet.style.transform = '';
        a.sheet.style.opacity = '';
        return;
      }
      // limpa estilos inline (a classe .open reaplica o transform correto)
      setTimeout(() => {
        a.sheet.style.transform = '';
        a.sheet.style.opacity = '';
      }, 0);
    }

    // Touch
    document.addEventListener('touchstart', e => {
      const h = isHandle(e.target);
      if (h) start(e.touches[0].clientY, h);
    }, { passive: true });
    document.addEventListener('touchmove', e => {
      if (active) { move(e.touches[0].clientY); e.preventDefault(); }
    }, { passive: false });
    document.addEventListener('touchend', end);
    document.addEventListener('touchcancel', end);

    // Mouse (desktop)
    document.addEventListener('mousedown', e => {
      const h = isHandle(e.target);
      if (h) { start(e.clientY, h); e.preventDefault(); }
    });
    document.addEventListener('mousemove', e => { if (active) move(e.clientY); });
    document.addEventListener('mouseup', end);
  })();
