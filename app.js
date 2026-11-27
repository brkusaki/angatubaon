'use strict';

  /* Flag de debug — ligue para ver logs no console (window.__ANGATUBA_DEBUG = true) */
  const DEBUG = (typeof window !== 'undefined' && window.__ANGATUBA_DEBUG === true);

  /* Flag consumida pelo handler global de popstate (mais abaixo, no fim do
     arquivo): setada logo antes de qualquer history.back() disparado por um
     fechamento manual de modal, pra o próprio handler saber que essa
     navegação já foi tratada por quem chamou back() e não tentar fechar
     outro modal por baixo (ver A1.3/A4.1 na auditoria). */
  let _popstateNosso = false;

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
    // 20s (era 12s): margem para o GAS "frio". Com 12s ações normais do painel
    // (salvar status, etc.) falhavam com "sem conexão" mesmo com rede boa.
    const timeout = opts.timeout || 20000;
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

  // Injeta um <script> uma única vez. Resolve quando carrega.
  function _injetarScript(src) {
    return new Promise(function (resolve, reject) {
      var existente = document.querySelector('script[data-jogo-src="' + src + '"]');
      if (existente) { resolve(); return; }
      var s = document.createElement('script');
      s.src = src;
      s.async = false;
      s.setAttribute('data-jogo-src', src);
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error('Falha ao carregar ' + src)); };
      document.head.appendChild(s);
    });
  }

  // Injeta um <link rel=stylesheet> uma única vez (não bloqueia se falhar).
  function _injetarCSS(href) {
    if (!href) return;
    if (document.querySelector('link[data-jogo-css="' + href + '"]')) return;
    var l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = href;
    l.setAttribute('data-jogo-css', href);
    document.head.appendChild(l);
  }

  /* ── Firebase: SDKs compat carregados sob demanda ─────────────────
     Antes, os 4 SDKs (app/auth/firestore/database) vinham em <script>
     fixos no index.html, ANTES do app_min.js — bloqueavam o parse pra
     todo mundo, inclusive quem só queria ver o cardápio.
     Agora:
     - app + auth: carregam em paralelo ao boot (não bloqueiam o
       primeiro render), porque login é usado tanto no ranking dos
       jogos quanto no botão de postar aviso (fora dos jogos) — ver
       a chamada de cliAuthInit() no início do app.
     - firestore + database: só entram quando o hub de jogos abre (ver
       _abrirGamesHub) ou um jogo carrega (ver _jogoLoader), porque só
       servem ranking e sinalização de multiplayer. Se falharem,
       ranking/multiplayer degradam sozinhos (ver _rankDb / multiplayer.js)
       — não travam o resto do app.
  ══════════════════════════════════════════════════════════════ */
  var FIREBASE_SDK_BASE = 'https://www.gstatic.com/firebasejs/12.17.1/';
  var _fbConfig = {
    // Config do projeto Firebase (valores públicos por design).
    apiKey: "AIzaSyClKx3gSCgM1O6X6SMh3VyJLthp-oYnx3k",
    authDomain: "angatubaon-cd333.firebaseapp.com",
    projectId: "angatubaon-cd333",
    storageBucket: "angatubaon-cd333.firebasestorage.app",
    messagingSenderId: "559185630365",
    appId: "1:559185630365:web:a2e7fc4cc9d26bfea67074",
    // Preencher depois de criar o Realtime Database no console do Firebase
    // (Build > Realtime Database > Criar banco de dados). A URL aparece
    // no topo da tela de dados, algo como:
    // "https://angatubaon-cd333-default-rtdb.firebaseio.com" ou com um
    // sufixo de região (ex.: "...-default-rtdb.southamerica-east1.firebasedatabase.app").
    // Enquanto ficar vazio, o multiplayer degrada com elegância (fica indisponível, sem quebrar o app).
    databaseURL: "https://angatubaon-cd333-default-rtdb.firebaseio.com"
  };

  // Promises cacheadas — evitam injetar 2x quando já carregado (ou
  // carregando). Em caso de falha (ex.: rede caiu bem na hora), a própria
  // promise limpa seu cache antes de propagar o erro, pra uma PRÓXIMA
  // chamada (outro clique no badge, abrir outro jogo) poder tentar nascer
  // de novo — sem isso, um erro de rede uma única vez travaria auth,
  // ranking e multiplayer pro resto da sessão.
  var _fbAppCarregado = null;
  function _carregarFirebaseApp() {
    if (_fbAppCarregado) return _fbAppCarregado;
    _fbAppCarregado = _injetarScript(FIREBASE_SDK_BASE + 'firebase-app-compat.js').then(function () {
      try { if (window.firebase && firebase.initializeApp) firebase.initializeApp(_fbConfig); }
      catch (e) { console.warn('[Firebase] init falhou:', e); }
    }).catch(function (err) { _fbAppCarregado = null; throw err; });
    return _fbAppCarregado;
  }

  var _fbAuthCarregado = null;
  function _carregarFirebaseAuthCore() {
    if (_fbAuthCarregado) return _fbAuthCarregado;
    _fbAuthCarregado = _carregarFirebaseApp().then(function () {
      return _injetarScript(FIREBASE_SDK_BASE + 'firebase-auth-compat.js');
    }).catch(function (err) { _fbAuthCarregado = null; throw err; });
    return _fbAuthCarregado;
  }

  /* Realtime Database sozinho — usado pela PRESENÇA (ver bloco de
     presença, perto do fim do arquivo), que precisa dele fora do hub de
     jogos. Jogos/hub.js tem o seu próprio loader (_carregarFirebaseJogos)
     que traz Firestore + Database juntos; os dois convivem porque
     _injetarScript não injeta a mesma URL duas vezes.
     O espera-pelo-global existe por causa desse compartilhamento: se o
     hub já tiver COMEÇADO a injetar o script, _injetarScript acha a tag
     e resolve na hora, mesmo antes do onload — sem a espera, um
     firebase.database() logo em seguida estouraria. */
  var _fbDbCarregado = null;
  function _carregarFirebaseDb() {
    if (_fbDbCarregado) return _fbDbCarregado;
    _fbDbCarregado = _carregarFirebaseAuthCore().then(function () {
      return _injetarScript(FIREBASE_SDK_BASE + 'firebase-database-compat.js');
    }).then(function () {
      return new Promise(function (resolve, reject) {
        var tentativas = 0;
        (function checar() {
          if (window.firebase && firebase.database) { resolve(); return; }
          if (++tentativas > 100) { reject(new Error('Realtime Database não carregou.')); return; }
          setTimeout(checar, 50);
        })();
      });
    }).catch(function (err) { _fbDbCarregado = null; throw err; });
    return _fbDbCarregado;
  }

  /* Messaging (FCM) sozinho — igual em espírito ao _carregarFirebaseDb
     acima: SDK carregado sob demanda, só quando o bloco de PUSH (perto
     do fim do arquivo) decide pedir permissão ou buscar o token. Quem
     nunca loga (ou loga e nunca ativa) jamais baixa esse script. */
  var _fbMsgCarregado = null;
  function _carregarFirebaseMessaging() {
    if (_fbMsgCarregado) return _fbMsgCarregado;
    _fbMsgCarregado = _carregarFirebaseAuthCore().then(function () {
      return _injetarScript(FIREBASE_SDK_BASE + 'firebase-messaging-compat.js');
    }).then(function () {
      return new Promise(function (resolve, reject) {
        var tentativas = 0;
        (function checar() {
          if (window.firebase && firebase.messaging) { resolve(); return; }
          if (++tentativas > 100) { reject(new Error('Firebase Messaging não carregou.')); return; }
          setTimeout(checar, 50);
        })();
      });
    }).catch(function (err) { _fbMsgCarregado = null; throw err; });
    return _fbMsgCarregado;
  }

  /* ══════════════════════════════════════════════════════════════
     REMOTE CONFIG (Firebase) — Fase 1, item 3
     ------------------------------------------------------------
     Textos de evento, flags e valores simples que dá pra mudar pelo
     Console do Firebase sem deploy. Regra de ouro: o app NUNCA depende
     do Remote Config pra funcionar.
       1. Valores em uso = cache local (angatuba_rc) ou, sem cache, os
          padrões de RC_PADROES abaixo — aplicados na hora, no boot,
          sem rede nenhuma.
       2. A busca no Firebase só acontece quando o hub de jogos abre
          (único lugar que usa os valores hoje — quem só vê o cardápio
          nunca baixa o SDK), no máx. 1x por hora (RC_INTERVALO_MS; o
          próprio SDK respeita esse intervalo e devolve o que já tem).
       3. Falhou (offline, SDK bloqueado, timeout de 8s, parâmetro com
          lixo)? Fica o que já estava. Todo valor passa por _rcSanear
          (tipo certo, texto curto, multiplicador entre 1 e 3) e data
          inválida desliga o evento (fail-closed).

     Parâmetros (criar no Console › Remote Config com estes nomes):
       evento_ativo          bool    liga o banner de evento no hub de jogos
       evento_titulo         string  título do banner (máx. 60)
       evento_texto          string  linha de baixo do banner (máx. 140)
       evento_inicio         string  'AAAA-MM-DD' (ou ISO), opcional
       evento_fim            string  'AAAA-MM-DD' (inclusive) ou ISO, opcional
       mostrar_corujinha     bool    false esconde a Corujinha (card + atalho)
       moedas_multiplicador  number  1 = normal; 2 = moedas em dobro nos
                                     jogos (1 a 3; vale só dentro da janela
                                     evento_inicio–evento_fim, se houver)

     API (window.AngatubaConfig): get(chave), eventoAtivo(),
     multiplicadorMoedas(), corujinhaLiberada(), atualizar(),
     aoMudar(cb).
  ══════════════════════════════════════════════════════════════ */
  var RC_CACHE_KEY = 'angatuba_rc';
  var RC_PADROES = {
    evento_ativo: false,
    evento_titulo: '',
    evento_texto: '',
    evento_inicio: '',
    evento_fim: '',
    mostrar_corujinha: true,
    moedas_multiplicador: 1
  };
  var RC_TEXTO_MAX = { evento_titulo: 60, evento_texto: 140, evento_inicio: 25, evento_fim: 25 };
  var RC_INTERVALO_MS = 60 * 60 * 1000;
  var RC_TIMEOUT_MS = 8000;
  var RC_MULT_MAX = 3;
  var _rcValores = null;
  var _rcBuscando = null;
  var _rcOuvintes = [];

  // Força cada chave pro tipo do padrão; chave ausente/estranha = padrão.
  function _rcSanear(bruto) {
    bruto = (bruto && typeof bruto === 'object') ? bruto : {};
    var out = {};
    Object.keys(RC_PADROES).forEach(function (k) {
      var pad = RC_PADROES[k], v = bruto[k];
      if (typeof pad === 'boolean') {
        out[k] = (v === true || v === 'true') ? true : ((v === false || v === 'false') ? false : pad);
      } else if (typeof pad === 'number') {
        var n = Number(v);
        out[k] = isFinite(n) ? n : pad;
      } else {
        out[k] = (v == null) ? pad : String(v).trim().slice(0, RC_TEXTO_MAX[k] || 140);
      }
    });
    var m = out.moedas_multiplicador;
    out.moedas_multiplicador = (m >= 1) ? Math.min(RC_MULT_MAX, Math.round(m * 10) / 10) : 1;
    return out;
  }

  function _rcLerCache() {
    try {
      var o = JSON.parse(localStorage.getItem(RC_CACHE_KEY) || 'null');
      return _rcSanear(o && o.v);
    } catch (e) { return _rcSanear(null); }
  }

  function _rcVal() {
    if (!_rcValores) _rcValores = _rcLerCache();
    return _rcValores;
  }

  // 'AAAA-MM-DD' = dia local (fimDoDia: até 23:59:59); senão Date.parse.
  // null = sem data; NaN = data inválida.
  function _rcData(str, fimDoDia) {
    str = String(str || '').trim();
    if (!str) return null;
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str);
    if (m) {
      var d = new Date(+m[1], +m[2] - 1, +m[3]);
      if (fimDoDia) d.setHours(23, 59, 59, 999);
      return d.getTime();
    }
    var t = Date.parse(str);
    return isNaN(t) ? NaN : t;
  }
  function _rcDentroDaJanela() {
    var v = _rcVal(), agora = Date.now();
    var ini = _rcData(v.evento_inicio, false), fim = _rcData(v.evento_fim, true);
    if (ini !== null && (isNaN(ini) || agora < ini)) return false;
    if (fim !== null && (isNaN(fim) || agora > fim)) return false;
    return true;
  }
  function _rcEventoAtivo() {
    var v = _rcVal();
    return !!(v.evento_ativo && v.evento_titulo && _rcDentroDaJanela());
  }
  function _rcMultiplicadorMoedas() {
    var v = _rcVal();
    return (v.moedas_multiplicador > 1 && _rcDentroDaJanela()) ? v.moedas_multiplicador : 1;
  }
  function _rcCorujinhaLiberada() { return _rcVal().mostrar_corujinha !== false; }

  /* Aplica os valores na tela: banner do hub de jogos e Corujinha.
     Idempotente — roda no boot (cache), depois de cada busca e quando o
     hub abre (a janela de datas pode ter virado com o app aberto). */
  function _rcAplicar() {
    var v = _rcVal();
    var mult = _rcMultiplicadorMoedas();
    var banner = document.getElementById('rc-evento-banner');
    if (banner) {
      var ativo = _rcEventoAtivo();
      if (ativo || mult > 1) {
        var multTxt = String(mult).replace('.', ',');
        var titulo = ativo ? v.evento_titulo : 'Evento de moedas! 🪙';
        var texto = ativo ? v.evento_texto : ('Moedas x' + multTxt + ' nas partidas dos jogos.');
        banner.innerHTML = '';
        var ico = document.createElement('span');
        ico.className = 'rc-evento-ico'; ico.setAttribute('aria-hidden', 'true'); ico.textContent = '🎉';
        var txt = document.createElement('span');
        txt.className = 'rc-evento-txt';
        var t1 = document.createElement('span');
        t1.className = 'rc-evento-titulo'; t1.textContent = titulo;
        txt.appendChild(t1);
        if (texto) {
          var t2 = document.createElement('span');
          t2.className = 'rc-evento-sub'; t2.textContent = texto;
          txt.appendChild(t2);
        }
        banner.appendChild(ico);
        banner.appendChild(txt);
        if (mult > 1) {
          var chip = document.createElement('span');
          chip.className = 'rc-evento-chip'; chip.textContent = '🪙 x' + multTxt;
          banner.appendChild(chip);
        }
        banner.hidden = false;
      } else {
        banner.hidden = true;
        banner.innerHTML = '';
      }
    }
    // Corujinha: card do menu + chip "Sorte" (só ela mora lá). O filtro
    // do hub (_gamesAplicarFiltro) pula card com .rc-oculto.
    var liberada = _rcCorujinhaLiberada();
    document.querySelectorAll('#games-menu .gc-corujinha').forEach(function (c) {
      c.classList.toggle('rc-oculto', !liberada);
    });
    var chipSorte = document.querySelector('#games-cat-chips [data-cat="sorte"]');
    if (chipSorte) chipSorte.classList.toggle('rc-oculto', !liberada);
    if (typeof window._gamesFiltrar === 'function') { try { window._gamesFiltrar(); } catch (e) {} }
    _rcOuvintes.forEach(function (cb) { try { cb(v); } catch (e) {} });
  }

  var _fbRcCarregado = null;
  function _carregarFirebaseRC() {
    if (_fbRcCarregado) return _fbRcCarregado;
    _fbRcCarregado = _carregarFirebaseApp().then(function () {
      return _injetarScript(FIREBASE_SDK_BASE + 'firebase-remote-config-compat.js');
    }).then(function () {
      return new Promise(function (resolve, reject) {
        var tentativas = 0;
        (function checar() {
          if (window.firebase && firebase.remoteConfig) { resolve(); return; }
          if (++tentativas > 100) { reject(new Error('Remote Config não carregou.')); return; }
          setTimeout(checar, 50);
        })();
      });
    }).catch(function (err) { _fbRcCarregado = null; throw err; });
    return _fbRcCarregado;
  }

  // Busca + ativa no Firebase. Resolve true se aplicou valores da nuvem,
  // false em qualquer falha (nunca rejeita — quem chama não precisa catch).
  function _rcAtualizar() {
    _rcAplicar();   // janela de datas pode ter virado desde o boot
    if (_rcBuscando) return _rcBuscando;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return Promise.resolve(false);
    _rcBuscando = _carregarFirebaseRC().then(function () {
      var rc = firebase.remoteConfig();
      rc.settings = { minimumFetchIntervalMillis: RC_INTERVALO_MS, fetchTimeoutMillis: RC_TIMEOUT_MS };
      // Padrão do SDK = o que já está em uso: parâmetro que não existir no
      // Console mantém o valor atual em vez de "zerar".
      rc.defaultConfig = _rcVal();
      return rc.fetchAndActivate().then(function () {
        var novo = {};
        Object.keys(RC_PADROES).forEach(function (k) {
          var val = rc.getValue(k), tipo = typeof RC_PADROES[k];
          novo[k] = (tipo === 'boolean') ? val.asBoolean() : (tipo === 'number' ? val.asNumber() : val.asString());
        });
        _rcValores = _rcSanear(novo);
        try { localStorage.setItem(RC_CACHE_KEY, JSON.stringify({ v: _rcValores, em: Date.now() })); } catch (e) {}
        _rcAplicar();
        return true;
      });
    }).catch(function (err) {
      if (typeof DEBUG !== 'undefined' && DEBUG) console.log('[remote-config] usando cache/padrão:', err && (err.code || err.message));
      return false;
    }).then(function (r) { _rcBuscando = null; return r; });
    return _rcBuscando;
  }

  window.AngatubaConfig = {
    get: function (chave) { return _rcVal()[chave]; },
    eventoAtivo: _rcEventoAtivo,
    multiplicadorMoedas: _rcMultiplicadorMoedas,
    corujinhaLiberada: _rcCorujinhaLiberada,
    atualizar: _rcAtualizar,
    aoMudar: function (cb) { if (typeof cb === 'function') _rcOuvintes.push(cb); }
  };
  // Boot: aplica o cache (ou os padrões) já — sem rede, sem esperar nada.
  try { _rcAplicar(); } catch (e) {}

  /* ── Hub de jogos: Jogos/hub.js carregado sob demanda ──────────────
     O hub inteiro (menu, streak, quiz, ranking, loader dos jogos
     externos) foi extraído pra Jogos/hub.js — quem só quer ver o
     cardápio nunca baixa esse código. Carrega no primeiro toque no
     badge da coruja ou no botao "Jogos" da bottom nav do modo cliente
     (slide Utilidades) -- ver _abrirGamesHub abaixo
     e, uma vez carregado, o próprio hub.js SUBSTITUI a função abaixo
     por sua versão real (mesmo nome — ver window._abrirGamesHub no
     fim de Jogos/hub.js), então cliques seguintes já chamam ela direto,
     sem passar pelo carregamento de novo. */
  var _hubJogosCarregado = null;
  function _carregarHubJogos() {
    if (_hubJogosCarregado) return _hubJogosCarregado;
    // O social.js vem junto (em paralelo): o perfil e os amigos do hub
    // usam window.AngatubaAmigos/AngatubaPresenca. Se ele falhar, o hub
    // abre do mesmo jeito, só sem esses botões.
    _hubJogosCarregado = Promise.all([
      _injetarScript('/Jogos/hub.min.js'),
      _carregarSocial().catch(function () {})
    ]).catch(function (err) {
      _hubJogosCarregado = null; // permite tentar de novo no próximo toque
      throw err;
    });
    return _hubJogosCarregado;
  }

  function _abrirGamesHub() {
    if (typeof showToastSimples === 'function') showToastSimples('Carregando jogos…', '/webp/owl-search.webp');
    _carregarHubJogos().then(function () {
      // Neste ponto Jogos/hub.js já rodou e trocou window._abrirGamesHub
      // pela implementação real — chamar de novo já abre o hub de verdade.
      if (typeof window._abrirGamesHub === 'function') window._abrirGamesHub();
    }).catch(function (err) {
      if (typeof DEBUG !== 'undefined' && DEBUG) console.log('[hub] falha ao carregar Jogos/hub.min.js:', err && err.message);
      if (typeof showToastSimples === 'function') showToastSimples('Não foi possível abrir os jogos. Verifique a conexão.', '/webp/owl-sign.webp');
    });
  }
  // Exposto pro badge da coruja (index.html) e pro botão "Jogos" da
  // bottom nav no modo cliente. Ver comentário acima: hub.js troca este
  // stub pela versão real assim que carrega.
  window._abrirGamesHub = _abrirGamesHub;

  /* Volta pro jogo que estava aberto quando a página recarrega sozinha
     (o Android descarta a aba em segundo plano pra liberar memória e,
     ao voltar, recarrega do zero). Jogos/hub.js grava o jogo aberto no
     sessionStorage (só desta aba) e apaga ao sair do jogo; aqui só
     reabrimos se a marca for recente (até 30 min). */
  (function _restaurarJogoAberto() {
    var m = null;
    try { m = JSON.parse(sessionStorage.getItem('angatuba_jogo_aberto') || 'null'); } catch (e) {}
    if (!m || !m.n || Date.now() - (m.t || 0) > 30 * 60 * 1000) return;
    var reabrir = function () {
      setTimeout(function () {
        _carregarHubJogos().then(function () {
          if (typeof window._abrirGamesHub === 'function') window._abrirGamesHub();
          setTimeout(function () { if (typeof window._abrirJogo === 'function') window._abrirJogo(m.n); }, 350);
        }).catch(function () {});
      }, 700);
    };
    if (document.readyState === 'complete') reabrir(); else window.addEventListener('load', reabrir, { once: true });
  })();

  /* ── Módulo Aprender: Aprender/hub.js + Aprender/conteudo.js carregados
     sob demanda ──────────────────────────────────────────────────
     Mesmo padrão do hub de jogos acima: só baixa quem toca no botão
     "Aprender" da bottom nav do modo cliente. conteudo.js (banco de lições) entra ANTES de hub.js —
     hub.js lê window.APRENDER_CONTEUDO já na primeira renderização.
     Uma vez carregado, o próprio hub.js SUBSTITUI a função abaixo pela
     versão real (mesmo nome — ver window._abrirAprender no fim de
     Aprender/hub.js). */
  var _hubAprenderCarregado = null;
  function _carregarHubAprender() {
    if (_hubAprenderCarregado) return _hubAprenderCarregado;
    _hubAprenderCarregado = _injetarScript('/Aprender/conteudo.js').then(function () {
      return _injetarScript('/Aprender/hub.min.js');
    }).catch(function (err) {
      _hubAprenderCarregado = null; // permite tentar de novo no próximo toque
      throw err;
    });
    return _hubAprenderCarregado;
  }

  function _abrirAprender() {
    if (typeof showToastSimples === 'function') showToastSimples('Carregando…', '/webp/owl-search.webp');
    _carregarHubAprender().then(function () {
      if (typeof window._abrirAprender === 'function') window._abrirAprender();
    }).catch(function (err) {
      if (typeof DEBUG !== 'undefined' && DEBUG) console.log('[aprender] falha ao carregar Aprender/hub.min.js:', err && err.message);
      if (typeof showToastSimples === 'function') showToastSimples('Não foi possível abrir. Verifique a conexão.', '/webp/owl-sign.webp');
    });
  }
  // Exposto pro botão "Aprender" da bottom nav no modo cliente. Ver
  // comentário acima: hub.js troca este stub pela versão real ao carregar.
  window._abrirAprender = _abrirAprender;

  /* ── Biblioteca da Coruja: Biblioteca/hub.min.js + biblioteca.css
     carregados sob demanda ──────────────────────────────────────
     Mesmo padrão do Aprender: só baixa quem toca em "Livros" na bottom
     nav do modo cliente. O CSS vai junto (fica fora do styles.css pra
     não pesar o boot de ninguém). O texto de cada livro é outro arquivo
     (Biblioteca/livros/<id>.json), baixado só quando o livro abre.
     Uma vez carregado, hub.js SUBSTITUI a função abaixo pela versão
     real (mesmo nome — ver window._abrirBiblioteca em Biblioteca/hub.js). */
  var _bibliotecaCarregada = null;
  function _carregarBiblioteca() {
    if (_bibliotecaCarregada) return _bibliotecaCarregada;
    _injetarCSS('/Biblioteca/biblioteca.css');
    _bibliotecaCarregada = _injetarScript('/Biblioteca/hub.min.js').catch(function (err) {
      _bibliotecaCarregada = null; // permite tentar de novo no próximo toque
      throw err;
    });
    return _bibliotecaCarregada;
  }

  function _abrirBiblioteca() {
    if (typeof showToastSimples === 'function') showToastSimples('Abrindo a biblioteca…', '/webp/owl-search.webp');
    _carregarBiblioteca().then(function () {
      // Aqui o Biblioteca/hub.js já rodou e trocou window._abrirBiblioteca
      // pela implementação real — chamar de novo já abre a biblioteca.
      if (typeof window._abrirBiblioteca === 'function') window._abrirBiblioteca();
    }).catch(function (err) {
      if (typeof DEBUG !== 'undefined' && DEBUG) console.log('[biblioteca] falha ao carregar Biblioteca/hub.min.js:', err && err.message);
      if (typeof showToastSimples === 'function') showToastSimples('Não foi possível abrir a biblioteca. Verifique a conexão.', '/webp/owl-sign.webp');
    });
  }
  // Exposto pro botão "Livros" da bottom nav no modo cliente.
  window._abrirBiblioteca = _abrirBiblioteca;

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
     SPLASH SCREEN — a animação mora num script inline no index.html
     (coruja pousando no letreiro ON). Aqui só avisamos que o app está
     pronto; a splash sai quando a animação termina. Failsafe: 5s.
  ══════════════════════════════════════════════════════════════ */
  const _splashInicio = Date.now();
  const _SPLASH_MIN   = 1800;
  const _SPLASH_MAX   = 5000;
  let   _splashOculta = false;

  function _esconderSplash() {
    if (_splashOculta) return;
    _splashOculta = true;
    if (typeof window.__splashFechar === 'function') { window.__splashFechar(); return; }
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

  // Link da loja que sobrevive a renomeação: #nome-da-loja--k3f9a.
  // O código final vem do WhatsApp (hash FNV-1a em base36), que não muda
  // quando a loja troca de nome. toSlug() nunca gera "--", então o separador
  // é inequívoco. Loja sem WhatsApp fica só com o slug do nome.
  function lojaLinkId(wpp) {
    const w = String(wpp || '').replace(/\D/g, '');
    if (!w) return '';
    let h = 0x811c9dc5;
    for (let i = 0; i < w.length; i++) { h ^= w.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h.toString(36);
  }
  function lojaHash(nome, wpp) {
    const id = lojaLinkId(wpp);
    return toSlug(nome) + (id ? '--' + id : '');
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
    // Logado (Fase 2): a lista é da conta — guarda com os tempos e
    // agenda a sincronia (ver FAVORITOS SINCRONIZADOS, logo abaixo).
    if (_favDono && _favEstado) { _favRegistrarLista(); return; }
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
    _uiSom(agoraFav ? 'favoritar' : 'desfavoritar');

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

  /* ══════════════════════════════════════════════════════════════
     FAVORITOS SINCRONIZADOS (Firestore) — Fase 2, item 3
     ------------------------------------------------------------
     Visitante (deslogado): exatamente como sempre — array em
     angatuba_favoritos, só no aparelho.

     Conta nomeada: a lista passa a ser DA CONTA.
       · local:  angatuba_favoritos_u_<uid> = { fav:{id:t}, rem:{id:t} }
       · nuvem:  favoritos/{uid}            = { fav, rem, atualizadoEm }
     `t` = quando o id entrou (fav) ou saiu (rem). O `rem` é a
     "lápide": sem ela, juntar dois aparelhos ressuscitaria o favorito
     que a pessoa tirou no outro. Mesclagem = por id, vence o `t` mais
     novo (lápides com mais de FAV_REM_DIAS somem).

     SINCRONIA SEMPRE POR TRANSAÇÃO (lê → mescla → grava): o set()
     substitui o doc inteiro, e a transação garante que o que vai pra
     nuvem já contém o que outro aparelho gravou um segundo antes.
     Roda no login, 2s depois de cada mudança e quando a rede volta.
     Offline: a mudança fica no local (com o `t` dela) e sobe na
     próxima sincronia — o `t` decide quem ganha.

     1º login desta conta NESTE aparelho: os favoritos do visitante
     são adotados pela conta (com `t` antigo — perdem pra qualquer
     decisão já registrada na nuvem) e a lista do visitante é limpa.
     Ao sair, a tela volta pra lista do visitante (decisão do Bruno:
     celular compartilhado não vaza os favoritos de quem saiu).
  ══════════════════════════════════════════════════════════════ */
  const FAV_CHAVE_CONTA = 'angatuba_favoritos_u_';
  const FAV_MAX = 300;                       // = favoritosValido em firestore.rules
  const FAV_REM_DIAS = 90;
  let _favDono = null;                       // uid dono da lista em uso (null = visitante)
  let _favEstado = null;                     // { fav, rem } da conta em uso
  let _favNuvemTimer = null;
  let _favPendente = false;                  // mudança local ainda não confirmada na nuvem
  let _favSincronizando = null;
  let _favConfirmado = false;                // login confirmado pelo Firebase nesta sessão
  const FAV_ULTIMO_UID = 'angatuba_favoritos_ultimo_uid';

  function _favLerVisitante() {
    try {
      const arr = JSON.parse(localStorage.getItem(FAVORITOS_KEY) || '[]');
      return Array.isArray(arr) ? arr.map(favNormNome).filter(Boolean) : [];
    } catch (e) { return []; }
  }

  // Limpa um { fav, rem } vindo do disco ou da nuvem: chaves válidas,
  // `t` numérico, cada id num lado só (o mais novo), lápide velha fora
  // e tetos de tamanho (sai o mais antigo).
  function _favNormEstado(o) {
    o = (o && typeof o === 'object') ? o : {};
    const out = { fav: {}, rem: {} };
    const limite = Date.now() - FAV_REM_DIAS * 86400000;
    ['fav', 'rem'].forEach(function (lado) {
      const m = (o[lado] && typeof o[lado] === 'object') ? o[lado] : {};
      Object.keys(m).forEach(function (k) {
        const id = favNormNome(k);
        const t = Math.floor(Number(m[k]) || 0);
        if (!id || /^__.*__$/.test(id) || t <= 0) return;
        if (lado === 'rem' && t < limite) return;
        const outro = lado === 'fav' ? 'rem' : 'fav';
        if (out[outro][id] && out[outro][id] >= t) return;
        delete out[outro][id];
        if (!out[lado][id] || out[lado][id] < t) out[lado][id] = t;
      });
    });
    ['fav', 'rem'].forEach(function (lado) {
      const ids = Object.keys(out[lado]);
      if (ids.length <= FAV_MAX) return;
      ids.sort(function (a, b) { return out[lado][b] - out[lado][a]; })
        .slice(FAV_MAX).forEach(function (id) { delete out[lado][id]; });
    });
    return out;
  }
  function _favMesclar(a, b) {
    const junto = { fav: {}, rem: {} };
    [a, b].forEach(function (e) {
      if (!e) return;
      ['fav', 'rem'].forEach(function (lado) {
        Object.keys(e[lado] || {}).forEach(function (id) {
          if (!junto[lado][id] || junto[lado][id] < e[lado][id]) junto[lado][id] = e[lado][id];
        });
      });
    });
    return _favNormEstado(junto);
  }
  // Ordem da lista = ordem em que entrou (igual ao push de antes).
  function _favListaDe(est) {
    return Object.keys(est.fav).sort(function (a, b) { return est.fav[a] - est.fav[b]; });
  }
  function _favAssinatura(est) {
    const s = function (m) { return Object.keys(m).sort().map(function (k) { return k + '=' + m[k]; }).join('|'); };
    return s(est.fav) + '#' + s(est.rem);
  }
  function _favGravarLocalConta() {
    if (!_favDono || !_favEstado) return;
    try { localStorage.setItem(FAV_CHAVE_CONTA + _favDono, JSON.stringify(_favEstado)); } catch (e) {}
  }

  // Traduz o array _favoritos (que o resto do app mexe) pro estado com
  // tempos: entrou = fav agora, saiu = lápide agora. Genérico de
  // propósito — cobre o toggle e a migração nome→id do mesmo jeito.
  function _favRegistrarLista() {
    if (!_favEstado) return;
    const agora = Date.now(), na = {};
    _favoritos.forEach(function (id) {
      na[id] = true;
      if (!_favEstado.fav[id]) { _favEstado.fav[id] = agora; delete _favEstado.rem[id]; }
    });
    Object.keys(_favEstado.fav).forEach(function (id) {
      if (!na[id]) { delete _favEstado.fav[id]; _favEstado.rem[id] = agora; }
    });
    _favGravarLocalConta();
    _favPendente = true;
    clearTimeout(_favNuvemTimer);
    _favNuvemTimer = setTimeout(_favSincronizar, 2000);
  }

  let _favFbCarregado = null;
  function _favCarregarFirestore() {
    if (_favFbCarregado) return _favFbCarregado;
    _favFbCarregado = _carregarFirebaseAuthCore().then(function () {
      return _injetarScript(FIREBASE_SDK_BASE + 'firebase-firestore-compat.js');
    }).then(function () {
      return new Promise(function (resolve, reject) {
        let n = 0;
        (function checar() {
          if (window.firebase && firebase.firestore) { resolve(firebase.firestore()); return; }
          if (++n > 100) { reject(new Error('Firestore indisponível')); return; }
          setTimeout(checar, 50);
        })();
      });
    }).catch(function (err) { _favFbCarregado = null; throw err; });
    return _favFbCarregado;
  }

  // Lê → mescla → grava, numa transação. Atualiza a tela se a nuvem
  // trouxe algo de outro aparelho. Silencioso: sem rede, tenta de novo
  // no evento 'online' (ou na próxima mudança/login).
  function _favSincronizar() {
    const uid = _favDono;
    if (!uid || !_favEstado || !_favConfirmado) return Promise.resolve(false);
    if (_favSincronizando) return _favSincronizando;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return Promise.resolve(false);
    let mesclado = null;
    _favSincronizando = _favCarregarFirestore().then(function (db) {
      const ref = db.collection('favoritos').doc(uid);
      return db.runTransaction(function (tx) {
        return tx.get(ref).then(function (doc) {
          const remoto = (doc && doc.exists) ? _favNormEstado(doc.data()) : null;
          mesclado = _favMesclar(_favEstado, remoto);
          if (!remoto || _favAssinatura(remoto) !== _favAssinatura(mesclado)) {
            tx.set(ref, { fav: mesclado.fav, rem: mesclado.rem, atualizadoEm: firebase.firestore.FieldValue.serverTimestamp() });
          }
        });
      });
    }).then(function () {
      if (_favDono !== uid || !mesclado) return false;
      // O que mudou localmente DURANTE a transação também entra.
      const antes = _favAssinatura(_favEstado);
      _favEstado = _favMesclar(_favEstado, mesclado);
      _favPendente = (_favAssinatura(_favEstado) !== _favAssinatura(mesclado));
      _favGravarLocalConta();
      const novaLista = _favListaDe(_favEstado);
      const mudouTela = novaLista.join('\n') !== _favoritos.join('\n');
      _favoritos = novaLista;
      if (mudouTela) _favRepintar();
      if (_favPendente) { clearTimeout(_favNuvemTimer); _favNuvemTimer = setTimeout(_favSincronizar, 2000); }
      return antes !== _favAssinatura(_favEstado) || mudouTela;
    }).catch(function (err) {
      if (typeof DEBUG !== 'undefined' && DEBUG) console.log('[favoritos] sync falhou:', err && (err.code || err.message));
      return false;
    }).then(function (r) { _favSincronizando = null; return r; });
    return _favSincronizando;
  }

  // Redesenha o que mostra favoritos: contador do pill, lista filtrada
  // e a seção do painel de conta.
  function _favRepintar() {
    atualizarBadgeFavoritos();
    if (typeof activePillFilter !== 'undefined' && activePillFilter === 'favoritos' && typeof renderLojas === 'function') renderLojas();
    const conta = document.getElementById('modal-cli-conta');
    if (conta && conta.classList.contains('open') && typeof cliRenderFavoritos === 'function') cliRenderFavoritos();
  }

  // Login / logout / troca de conta (onAuthStateChanged).
  function _favAoMudarConta() {
    const uid = (typeof _cliUser !== 'undefined' && _cliContaReal(_cliUser) && _cliUser.uid) || null;
    // Mesma conta que o boot já tinha aberto (ver o fim deste bloco): só
    // confirma e sincroniza, sem trocar a lista na tela.
    if (uid && uid === _favDono) {
      if (!_favConfirmado) { _favConfirmado = true; _favSincronizar(); }
      return;
    }
    if (!uid && !_favDono) return;
    clearTimeout(_favNuvemTimer);
    _favDono = uid;
    _favConfirmado = !!uid;
    _favPendente = false;
    try {
      if (uid) localStorage.setItem(FAV_ULTIMO_UID, uid);
      else localStorage.removeItem(FAV_ULTIMO_UID);
    } catch (e) {}
    if (uid) {
      let est = null;
      try { const raw = localStorage.getItem(FAV_CHAVE_CONTA + uid); if (raw) est = _favNormEstado(JSON.parse(raw)); } catch (e) {}
      if (!est) {
        // 1º login desta conta aqui: adota a lista do visitante. `t`
        // pequeno de propósito (1, 2, 3...): mantém a ordem e perde pra
        // qualquer decisão que a conta já tenha na nuvem.
        est = { fav: {}, rem: {} };
        _favLerVisitante().forEach(function (id, i) { if (!est.fav[id]) est.fav[id] = i + 1; });
        try { localStorage.removeItem(FAVORITOS_KEY); } catch (e) {}
        _favPendente = Object.keys(est.fav).length > 0;
      }
      _favEstado = est;
      _favoritos = _favListaDe(est);
      _favGravarLocalConta();
      _favSincronizar();
    } else {
      _favEstado = null;
      _favoritos = _favLerVisitante();
    }
    _favRepintar();
  }

  // Boot: quem estava logado no último uso já abre com a lista da conta
  // (o Firebase Auth leva um instante pra reidratar a sessão; sem isto
  // os corações piscariam com a lista errada). Até o login se confirmar
  // (_favConfirmado), mudanças ficam só no local da conta; se a sessão
  // tiver caído, o _favAoMudarConta volta pra lista do visitante.
  (function () {
    try {
      const u = localStorage.getItem(FAV_ULTIMO_UID);
      const raw = u ? localStorage.getItem(FAV_CHAVE_CONTA + u) : null;
      if (!raw) return;
      _favDono = u;
      _favEstado = _favNormEstado(JSON.parse(raw));
      _favoritos = _favListaDe(_favEstado);
    } catch (e) {}
  })();

  window.addEventListener('online', function () {
    if (_favDono && _favPendente) _favSincronizar();
  });

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
  // "Esgotado hoje": o item guarda a data (PAUSADO_YYYY-MM-DD na planilha;
  // no cardápio público vem como item.esgotado). Só vale no dia marcado.
  function _cardEsgotadoHoje(item) {
    if (!item) return false;
    let v = item.esgotado || '';
    if (!v && /^PAUSADO_\d{4}-\d{2}-\d{2}$/.test(String(item.ativo || ''))) v = String(item.ativo).slice(8);
    if (!v) return false;
    const a = _agoraSP();
    return v === `${a.y}-${String(a.mo).padStart(2,'0')}-${String(a.d).padStart(2,'0')}`;
  }

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

    // Dia marcado como fechado (feriado/folga) pelo dono no painel
    if (Array.isArray(loja.fechadoEm) && loja.fechadoEm.length) {
      const hojeFe = `${_agora.y}-${String(_agora.mo).padStart(2,'0')}-${String(_agora.d).padStart(2,'0')}`;
      if (loja.fechadoEm.indexOf(hojeFe) !== -1) return { status: 'closed', fechaStr: '' };
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

    // Turno único ("Seg, Ter 08:00-18:00") também é lido do texto: é o que o
    // painel grava ao editar o horário. Texto livre não parseável cai no legado.
    if (txt) {
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
      const label = fechaStr ? `Aberto até ${escHTML(fechaStr)}` : 'Aberto Agora';
      return `<span class="badge badge-open"><span class="badge-dot"></span>${label}</span>`;
    }
    if (status === 'zap') {
      const zLabel = agendado ? 'Sob agendamento' : 'Chamar no Zap';
      return `<span class="badge badge-zap"><span class="badge-dot"></span>${zLabel}</span>`;
    }
    // closed
    const label = fechaStr ? `Abre às ${escHTML(fechaStr)}` : 'Fechado';
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
  // Posição da capa salva pelo lojista ("X% Y%", col AG). Só aceita o formato
  // exato que o GAS grava — vai direto pra object-/background-position.
  function fotoPosCss(loja) {
    const v = String((loja && loja.fotoPos) || '').trim();
    return /^\d{1,3}% \d{1,3}%$/.test(v) ? v : '';
  }

  function escAttr(s) {
    // Barra invertida primeiro para nao re-escapar as entidades inseridas depois.
    // Protege onclick inline (registrarClique) contra nomes com \\ ' " e quebra de linha.
    // Fix A4.11: String(undefined) vira a string literal "undefined" — igual
    // ao escHTML (que já se protege com String(s || '')), null/undefined
    // agora viram string vazia em vez de vazar pro atributo (ex.:
    // data-au-img="undefined" -> <img src="undefined"> -> 404).
    return String(s == null ? '' : s)
      .replace(/\\/g, '&#92;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/[\r\n]/g, ' ');
  }

  // Texto dentro de onclick="fn('…')": escAttr não basta, porque o navegador
  // desfaz &#39; antes de rodar o JS e o apóstrofo fecha a string (nome
  // "Sant'Ana" quebrava o botão; texto montado rodava código). Aqui o texto
  // vira escape de string JS (\x27…), que o HTML não mexe.
  function escJsArg(s) {
    return String(s == null ? '' : s)
      .replace(/\\/g, '\\\\')
      .replace(/'/g, '\\x27').replace(/"/g, '\\x22')
      .replace(/&/g, '\\x26').replace(/</g, '\\x3c').replace(/>/g, '\\x3e')
      .replace(/[\r\n\u2028\u2029]/g, ' ');
  }

  // @ do Instagram já normalizado e no formato válido; senão ''. Vai cru
  // para href e texto do link, então nada fora do formato passa.
  function _igHandleSeguro(input) {
    const h = normalizarInstagramHandle(input);
    return _igHandleValido(h) ? h : '';
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
          data-nome="${nomeAttr}" data-abre="${escAttr(abre)}" data-tel="${escAttr(loja.tel)}"
          onclick="showToast(this.dataset.nome,this.dataset.abre,this.dataset.tel)"
          aria-label="Loja fechada"><i class="fa fa-phone"></i></button>`;
      }
      return `<a href="tel:${escAttr(loja.tel)}" class="btn-tel open" aria-label="Ligar"
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
      data-nome="${nomeAttr}" data-abre="${escAttr(abre)}"
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

  // Badge no ícone do app (PWA instalado): nº de lojas com story não visto.
  // navigator.setAppBadge só existe em navegadores compatíveis; falha silenciosa.
  function _atualizarBadgeApp() {
    try {
      if (!('setAppBadge' in navigator)) return;
      var n = 0;
      for (var i = 0; i < LOJAS.length; i++) {
        if (_lojaTemStoryNaoVisto(LOJAS[i] && LOJAS[i].stories)) n++;
      }
      if (n > 0) navigator.setAppBadge(n).catch(function(){});
      else navigator.clearAppBadge().catch(function(){});
    } catch (e) {}
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
  // Fix A4.12: as duas fases tinham fallbacks de vídeo divergentes (Fase 1:
  // _ANUNCIO_STORY_MS + 20000 = 26s; Fase 2: 25000 fixo) — mesma constante
  // pras duas agora, pra nunca mais desalinhar sozinhas.
  const _ANUNCIO_VIDEO_FALLBACK_MS = 25000;

  function abrirFotoAnuncio(url, nomeAnuncio, lojaId, assinatura, nomeLoja, planoLoja, categoriaLoja, midiaTipo) {
    var _ehVideo = String(midiaTipo || 'foto') === 'video';
    // Fecha de verdade o lightbox anterior (timers/listeners inclusos) em
    // vez de só remover o nó — sem isto o _timer de 25s do fallback de
    // vídeo da loja anterior sobrevivia e fechava ESTE lightbox sozinho
    // minutos depois (ver A4.2).
    if (typeof window._fecharAnuncioLightbox === 'function') window._fecharAnuncioLightbox(true);
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
        _popstateNosso = true;
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
      _autoTimer = setTimeout(() => { if (!_videoEl.duration) fechar(); }, _ANUNCIO_VIDEO_FALLBACK_MS);
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
  // Busca { hoje, ontem } e injeta um badge discreto no topo do lightbox.
  // Falha silenciosa: badge é acessório, nunca quebra o viewer.
  async function _mostrarBadgeViewsStory() {
    try {
      var params = new URLSearchParams();
      params.append('payload', JSON.stringify({ action:'lojaAnuncioViews', token:_lojaToken }));
      var resp = await fetch(APPS_SCRIPT_URL, { method:'POST', body:params, signal:AbortSignal.timeout(8000) });
      var json = await resp.json();
      if (json.status !== 'ok') return;
      var lb = document.getElementById('anuncio-lightbox');
      if (!lb) return; // já fechou
      var hoje  = parseInt(json.data.hoje, 10)  || 0;
      var ontem = parseInt(json.data.ontem, 10) || 0;

      var comp = '';
      if (ontem > 0) {
        if (hoje > ontem)      comp = ' \u00b7 ontem ' + ontem + ' \u2191';
        else if (hoje < ontem) comp = ' \u00b7 ontem ' + ontem + ' \u2193';
        else                   comp = ' \u00b7 igual a ontem';
      } else if (hoje > 0) {
        comp = ' \u00b7 1\u00ba do dia';
      }

      var el = document.createElement('div');
      el.id = 'story-views-badge';
      el.style.cssText = 'position:absolute;top:52px;left:50%;transform:translateX(-50%);' +
        'z-index:12;background:rgba(0,0,0,.62);backdrop-filter:blur(6px);' +
        'color:#fff;font-size:11px;font-weight:600;padding:5px 11px;border-radius:20px;' +
        'display:flex;align-items:center;gap:5px;pointer-events:none;white-space:nowrap;' +
        'font-family:var(--font-b);border:1px solid rgba(255,255,255,.14);';
      el.innerHTML = '<i class="ti ti-eye" style="font-size:13px;"></i>' +
                     '<span>' + hoje + (hoje === 1 ? ' pessoa hoje' : ' pessoas hoje') + '</span>' +
                     '<span style="opacity:.7;font-weight:400;">' + comp + '</span>';
      lb.appendChild(el);
    } catch (e) { /* badge é acessório */ }
  }

  function abrirStories(stories, nomeLoja, lojaId, assinatura, planoLoja, categoriaLoja) {
    stories = (stories || []).filter(function(st){ return st && (st.texto || st.imagemUrl); });
    if (!stories.length) return;
    // Fecha de verdade o lightbox anterior (timers/listeners inclusos) em
    // vez de só remover o nó — mesmo problema e mesma correção do A4.2 na
    // Fase 1 (abrirFotoAnuncio) logo acima.
    if (typeof window._fecharAnuncioLightbox === 'function') window._fecharAnuncioLightbox(true);
    var oldLb = document.getElementById('anuncio-lightbox');
    if (oldLb) oldLb.remove();

    // Fix A4.9: decide "sou eu mesmo conferindo o próprio story" ANTES de
    // contar a view — antes essa checagem só rodava depois do
    // registrarClique, então o dono somava uma view (e via isso refletido
    // no próprio badge de alcance) a cada vez que conferia sua publicação.
    var _souDonoDoStory = !!(_lojaToken && _lojaNome && nomeLoja === _lojaNome);

    // Métrica: 1 view por pessoa por versão do conjunto (mesma regra da Fase 1).
    try {
      var jaCont = false;
      if (lojaId != null && assinatura) { var v = _carregarVistos(); jaCont = (v[lojaId] === assinatura); }
      // storyId do 1º story do conjunto — é o que a pessoa vê ao abrir.
      var _sid = (stories[0] && stories[0].id) ? String(stories[0].id) : '';
      if (nomeLoja && !jaCont && !_souDonoDoStory) registrarClique(nomeLoja, 'anuncio', planoLoja || 'PRO', categoriaLoja || '', _sid);
    } catch (e) {}

    // Badge de alcance: só aparece se ESTA loja está logada no painel.
    // Número do dia + comparação com ontem — nunca acumula.
    try {
      if (_souDonoDoStory) _mostrarBadgeViewsStory();
    } catch (eB) {}

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
      if (!viaPopstate && history.state && history.state.modal === 'anuncio-foto') { _popstateNosso = true; history.back(); }
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
        _timer = setTimeout(function(){ if (!vid.duration) avancar(); }, _ANUNCIO_VIDEO_FALLBACK_MS);
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
          // Fix A4.17: antes só apagava o spinner e deixava os 6s do
          // segmento correndo sobre um espaço vazio — igual ao onerror do
          // vídeo (acima), agora pula pro próximo story na hora.
          img.onerror = function(){ if (spinner) spinner.style.display='none'; avancar(); };
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
        <img src="${escAttr(loja.foto)}" alt="${escHTML(loja.nome)}" loading="lazy"${fotoPosCss(loja) ? ` style="object-position:${fotoPosCss(loja)}"` : ''} />
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
    const bgStyle = hasCover ? `background-image:url('${_fotoCss}');${fotoPosCss(loja) ? `background-position:${fotoPosCss(loja)};` : ''}` : '';

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
        <span style="font-size:10px;color:var(--muted);">· ${avals.length} ${avals.length > 1 ? 'avaliações' : 'avaliação'}</span>
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
    titleEl.innerHTML = q
      ? `<i class="fa fa-magnifying-glass sec-ico" aria-hidden="true"></i>"${escHTML(q)}"`
      : `<i class="fa fa-location-dot sec-ico" aria-hidden="true"></i>${escHTML(activeCat === 'todos' ? 'Todas as Lojas' : catLabel)}`;

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
              <img class="cat-img" src="webp/cat/${cat.id}.webp" alt="" decoding="async" onerror="this.nextElementSibling.style.display='';this.remove()">
              <i class="ti ${cat.icon}" style="color:${cat.cor};display:none;"></i>
              ${badge}
            </div>
            <span class="cat-label">${cat.label}</span>
            ${cat.id !== 'todos' ? '<button class="cat-clear-btn" onclick="event.stopPropagation();limparCategoria()" aria-label="Limpar filtro">✕</button>' : ''}
          </button>`;
      }).join('');
  }

  /* ── Troca categoria ─────────────────────────────────────── */
  function setCat(cat, btn) {
    // Se o hub de jogos estava aberto, fecha e volta pra lista de lojas.
    if (typeof _gamesHubAberto === 'function' && _gamesHubAberto()) {
      _fecharGamesHub();
    }
    // Idem pro hub Aprender.
    if (typeof _aprenderAberto === 'function' && _aprenderAberto()) {
      _fecharAprender();
    }
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
    // O loop abaixo apaga o destaque do chip de bairro: sem zerar o
    // activeBairro junto, o filtro seguia valendo escondido.
    activeBairro     = '';
    const _lblBairro = document.getElementById('pill-bairro-label');
    if (_lblBairro) _lblBairro.textContent = 'Bairro';
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
    _uiSom('aviso');

    title.textContent = `${nomeLoja} — fechado agora`;

    if (tel) {
      // Montado por DOM: hora e telefone vêm do cadastro e não passam por innerHTML.
      msg.textContent = horarioAbre ? `Abre às ${horarioAbre} · ` : '';
      const aTel = document.createElement('a');
      aTel.href = 'tel:' + String(tel).replace(/[^\d+]/g, '');
      aTel.style.cssText = 'color:var(--zap);font-weight:600;';
      aTel.textContent = formatTel(tel);
      msg.appendChild(aTel);
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

  // ── SONS DO APP (ElevenLabs, /sons/ui/<nome>.mp3 — ver claude/sons-catalogo-elevenlabs.md) ──
  // Curtos e baixos. Ligados por padrão; desliga em Minha conta → "Sons do app"
  // (localStorage 'angatuba_sons_app' = '0'). Web Audio: cada arquivo é baixado
  // e decodificado uma vez (no 1º toque da pessoa) e toca sem atraso. Sem
  // suporte, sem arquivo ou com o som desligado: silêncio, nada quebra.
  var SONS_APP_KEY = 'angatuba_sons_app';
  var _UI_SONS = ['toque','abrir','fechar','aba','favoritar','desfavoritar','sucesso','erro','aviso',
    'notificacao','mensagem','enviar','copiar','compartilhar','whatsapp','atualizar','loja-abriu','loja-fechou','interruptor',
    'noticia','pagina','abrir-livro'];   // noticia: feed "Hoje em Angatuba"; pagina/abrir-livro: Biblioteca (Biblioteca/hub.js)
  var _UI_SOM_VOL = { toque: 0.35, aba: 0.4, mensagem: 0.4, copiar: 0.45, interruptor: 0.45, pagina: 0.35, noticia: 0.4 };
  var _uiSomNoticiaTocou = false;
  var _uiSomCtx = null, _uiSomBuf = {}, _uiSomUlt = {};
  function _uiSonsLigados() { try { return localStorage.getItem(SONS_APP_KEY) !== '0'; } catch (e) { return true; } }
  function _uiSomCarregar(nome) {
    if (!_uiSomBuf[nome]) {
      _uiSomBuf[nome] = fetch('/sons/ui/' + nome + '.mp3')
        .then(function (r) { if (!r.ok) throw new Error('sem som'); return r.arrayBuffer(); })
        .then(function (ab) { return new Promise(function (ok, falha) { _uiSomCtx.decodeAudioData(ab, ok, falha); }); });
      _uiSomBuf[nome].catch(function () {});
    }
    return _uiSomBuf[nome];
  }
  function _uiSomPreparar() {
    if (_uiSomCtx || !_uiSonsLigados()) return !!_uiSomCtx;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try { _uiSomCtx = new AC(); } catch (e) { return false; }
    _UI_SONS.forEach(_uiSomCarregar);
    return true;
  }
  function _uiSom(nome) {
    if (!_uiSonsLigados() || !_uiSomPreparar()) return;
    var agora = Date.now();
    if (agora - (_uiSomUlt[nome] || 0) < 90) return; // evita som dobrado (dois handlers no mesmo toque)
    _uiSomUlt[nome] = agora;
    try { if (_uiSomCtx.state === 'suspended') _uiSomCtx.resume(); } catch (e) {}
    _uiSomCarregar(nome).then(function (buf) {
      var src = _uiSomCtx.createBufferSource(), g = _uiSomCtx.createGain();
      src.buffer = buf;
      g.gain.value = _UI_SOM_VOL[nome] || 0.55;
      src.connect(g); g.connect(_uiSomCtx.destination);
      src.start(0);
    }).catch(function () {});
  }
  // 1º toque destrava o áudio (iOS/Chrome exigem gesto) e pré-carrega tudo.
  // Os toques genéricos ficam aqui, num ouvinte só: barra de baixo (aba),
  // pílulas de filtro (toque) e qualquer link do WhatsApp (whatsapp).
  document.addEventListener('pointerdown', function () { _uiSomPreparar(); }, { capture: true, passive: true });
  document.addEventListener('click', function (ev) {
    var t = ev.target;
    if (!t || !t.closest) return;
    if (t.closest('#bottom-nav .nav-item')) _uiSom('aba');
    else if (t.closest('.pill-btn')) _uiSom('toque');
    else if (t.closest('a[href*="wa.me/"]')) _uiSom('whatsapp');
  }, true);

  // Item 11: toast padronizado (avisos/sucesso/erro efemeros) no lugar de alert().
  // Reusa a infra visual de #toast (com a coruja) — troca a coruja conforme o tipo.
  function mlToast(mensagem, tipo, owlSrc) {
    if (tipo === 'ok') _uiSom('sucesso'); else if (tipo === 'erro') _uiSom('erro');
    var owl = owlSrc || (tipo === 'erro' ? '/webp/owl-sign.webp'
                       : tipo === 'ok'  ? '/webp/owl-thumbsup.webp'
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
    return 'dark'; // padrao: escuro (usuario troca no botao se quiser)
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
    if (meta) meta.setAttribute('content', claro ? '#c2cddd' : '#0d0d0d');
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
  function registrarClique(nome, tipo, plano, categoria, storyId, valor, resumo) {
    // Registra a visita para o "nudge" de avaliação (só contatos diretos)
    if (tipo === 'wpp' || tipo === 'tel' || tipo === 'pedido') {
      registrarVisitaParaAvaliar(nome);
    }
    let wppLoja = '';
    try { const lj = LOJAS.find(l => l.nome === nome); wppLoja = (lj && lj.wpp) || ''; } catch (e) {}
    // O dono logado testando a própria loja não entra nas métricas dela
    // (as visitas já eram filtradas; cliques e pedidos de teste não eram).
    try {
      const meuWpp = _lojaToken ? (_lojaWpp || localStorage.getItem('angatuba_loja_wpp') || '') : '';
      if (meuWpp && wppLoja && _mlMesmoWpp(wppLoja, meuWpp)) return;
    } catch (e) {}
    const params = new URLSearchParams();
    params.append('payload', JSON.stringify({
      action:    'registrarClique',
      loja:      nome,
      tipo:      tipo,       // 'wpp' ou 'tel'
      plano:     plano,
      categoria: categoria,
      storyId:   storyId || '',  // só usado quando tipo==='anuncio'
      valor:     valor || '',    // só usado quando tipo==='pedido' (total do carrinho)
      resumo:    resumo || '',   // só pedido: itens (sem dados do cliente)
      wpp:       wppLoja,        // métricas sobrevivem a renomear a loja
      sid:       getAvalSid(),   // identifica o DISPOSITIVO pro rate-limit do GAS (ver A4.4)
    }));
    // sendBeacon sobrevive à navegação — sem isto, abrir o WhatsApp no mesmo
    // gesto (comum no Android) podia descartar a página antes do fetch em
    // voo terminar, perdendo justamente o clique mais valioso (ver A4.3).
    // keepalive é o fallback pra quando sendBeacon não existe.
    var _clkEnviouBeacon = false;
    if (navigator.sendBeacon) {
      try { _clkEnviouBeacon = navigator.sendBeacon(APPS_SCRIPT_URL, params); } catch (e) {}
    }
    if (!_clkEnviouBeacon) {
      fetch(APPS_SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: params, keepalive: true })
        .catch(() => {}); // falha silenciosa — nunca interrompe o usuário
    }
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
    // Se o hub de jogos estava aberto, fecha pra mostrar os resultados.
    if (typeof _gamesHubAberto === 'function' && _gamesHubAberto()) {
      _fecharGamesHub();
    }
    // Idem pro hub Aprender.
    if (typeof _aprenderAberto === 'function' && _aprenderAberto()) {
      _fecharAprender();
    }
    searchQuery = e.target.value.trim();
    renderLojas();
  }, 300);

  searchEl.addEventListener('input', handleSearch);
  searchEl.addEventListener('search', handleSearch);

  /* ══════════════════════════════════════════════════════════════
     LOJISTA SOB DEMANDA — cadastro, planos/pagamento, login da loja,
     painel Minha Loja (checklist, tour, status, edição, anúncio do
     dia, stories, compartilhar) e cardápio do dono moram em lojista.js.
     ------------------------------------------------------------
     Quem só procura loja nunca baixa nem processa esse código. Ele
     carrega no 1º toque em "Minha Loja"/"Cadastrar" (ou em qualquer
     função do lojista), no retorno do Mercado Pago, na retomada de um
     cadastro pendente e, pra quem já tem loja logada, alguns segundos
     depois do boot (o painel já abre pronto).

     Mesmo esquema do SOCIAL SOB DEMANDA (mais abaixo): cada função
     aqui é um stub com o MESMO nome da real (declaração de função, sobe
     pro topo — o boot pode chamar antes desta linha); quando
     lojista.min.js roda, as declarações dele substituem estas.
       (padrão) carrega o módulo e chama a real (devolve uma Promise)
       'parar'  fechar: se o módulo nunca foi pedido, nada está aberto
     Função nova do lojista.js chamada daqui, de outro arquivo ou de um
     onclick do index.html? Ganha um stub aqui (o build não pega isso).
  ══════════════════════════════════════════════════════════════ */
  var _lojistaCarregado = null, _lojistaOk = false;
  function _carregarLojista() {
    if (_lojistaCarregado) return _lojistaCarregado;
    _lojistaCarregado = _injetarScript('/lojista.min.js').then(function () {
      _lojistaOk = true;
    }).catch(function (err) {
      _lojistaCarregado = null; // permite tentar de novo no próximo pedido
      throw err;
    });
    return _lojistaCarregado;
  }
  function _lojistaChamar(nome, args, modo) {
    if (!_lojistaOk && modo === 'parar' && !_lojistaCarregado) return;
    var real = function () {
      var f = window[nome];
      if (typeof f !== 'function' || f._lojistaStub) {
        if (typeof DEBUG !== 'undefined' && DEBUG) console.log('[lojista] sem a função real:', nome);
        return;
      }
      return f.apply(null, args);
    };
    if (_lojistaOk) return real();
    return _carregarLojista().then(real).catch(function (err) {
      if (typeof DEBUG !== 'undefined' && DEBUG) console.log('[lojista] falha ao carregar lojista.min.js:', err && err.message);
      if (nome.charAt(0) !== '_' && typeof showToastSimples === 'function') {
        showToastSimples('Não foi possível abrir. Verifique a conexão.', '/webp/owl-sign.webp');
      }
    });
  }
  function _aoAprovar() { return _lojistaChamar('_aoAprovar', arguments); }
  function _aplicarDadosLoja() { return _lojistaChamar('_aplicarDadosLoja', arguments); }
  function _irParaSlide() { return _lojistaChamar('_irParaSlide', arguments); }
  function abrirAguardando() { return _lojistaChamar('abrirAguardando', arguments); }
  function abrirMinhaLoja() { return _lojistaChamar('abrirMinhaLoja', arguments); }
  function cadAvancar() { return _lojistaChamar('cadAvancar', arguments); }
  function cadSelecionarCiclo() { return _lojistaChamar('cadSelecionarCiclo', arguments); }
  function cadSelecionarPlano() { return _lojistaChamar('cadSelecionarPlano', arguments); }
  function cadToggleAgendamento() { return _lojistaChamar('cadToggleAgendamento', arguments); }
  function cadToggleVerTudo() { return _lojistaChamar('cadToggleVerTudo', arguments); }
  function cadVoltar() { return _lojistaChamar('cadVoltar', arguments); }
  function closeLoginLoja() { return _lojistaChamar('closeLoginLoja', arguments, 'parar'); }
  function closeModal() { return _lojistaChamar('closeModal', arguments, 'parar'); }
  function closePlanModal() { return _lojistaChamar('closePlanModal', arguments, 'parar'); }
  function confirmPlan() { return _lojistaChamar('confirmPlan', arguments); }
  function fecharAguardando() { return _lojistaChamar('fecharAguardando', arguments, 'parar'); }
  function fecharMinhaLoja() { return _lojistaChamar('fecharMinhaLoja', arguments, 'parar'); }
  function fecharOnboardingLojista() { return _lojistaChamar('fecharOnboardingLojista', arguments, 'parar'); }
  function iniciarPollingAprovacao() { return _lojistaChamar('iniciarPollingAprovacao', arguments); }
  function iniciarPollingPlano() { return _lojistaChamar('iniciarPollingPlano', arguments); }
  function llMascaraWpp() { return _lojistaChamar('llMascaraWpp', arguments); }
  function loginStep() { return _lojistaChamar('loginStep', arguments); }
  function lojaLogout() { return _lojistaChamar('lojaLogout', arguments); }
  function lojaReenviarCodigo() { return _lojistaChamar('lojaReenviarCodigo', arguments); }
  function lojaRequestCodigo() { return _lojistaChamar('lojaRequestCodigo', arguments); }
  function lojaToggle() { return _lojistaChamar('lojaToggle', arguments); }
  function lojaToggleAberto() { return _lojistaChamar('lojaToggleAberto', arguments); }
  function lojaToggleComHorario() { return _lojistaChamar('lojaToggleComHorario', arguments); }
  function lojaToggleFechado() { return _lojistaChamar('lojaToggleFechado', arguments); }
  function lojaToggleVoltamos() { return _lojistaChamar('lojaToggleVoltamos', arguments); }
  function lojaVerificarCodigo() { return _lojistaChamar('lojaVerificarCodigo', arguments); }
  function mlAbrirUpgrade() { return _lojistaChamar('mlAbrirUpgrade', arguments); }
  function mlAgendaCancelar() { return _lojistaChamar('mlAgendaCancelar', arguments); }
  function mlAgendaPreviewImagem() { return _lojistaChamar('mlAgendaPreviewImagem', arguments); }
  function mlAgendaRecorrenciaChange() { return _lojistaChamar('mlAgendaRecorrenciaChange', arguments); }
  function mlAgendaRemoverImagem() { return _lojistaChamar('mlAgendaRemoverImagem', arguments); }
  function mlAgendaSalvar() { return _lojistaChamar('mlAgendaSalvar', arguments); }
  function mlAgendaSelectEmoji() { return _lojistaChamar('mlAgendaSelectEmoji', arguments); }
  function mlAgendaToggleDia() { return _lojistaChamar('mlAgendaToggleDia', arguments); }
  function mlAgendaToggleForm() { return _lojistaChamar('mlAgendaToggleForm', arguments); }
  function mlAnuncioPreviewImagem() { return _lojistaChamar('mlAnuncioPreviewImagem', arguments); }
  function mlAnuncioRemoverImagem() { return _lojistaChamar('mlAnuncioRemoverImagem', arguments); }
  function mlAplicarConfirmar() { return _lojistaChamar('mlAplicarConfirmar', arguments); }
  function mlAplicarFechar() { return _lojistaChamar('mlAplicarFechar', arguments); }
  function mlAplicarRemover() { return _lojistaChamar('mlAplicarRemover', arguments); }
  function mlAplicarTemplate() { return _lojistaChamar('mlAplicarTemplate', arguments); }
  function mlAtualizarBadgeMetricas() { return _lojistaChamar('mlAtualizarBadgeMetricas', arguments); }
  function mlAtualizarHeroStatus() { return _lojistaChamar('mlAtualizarHeroStatus', arguments); }
  function mlAvisoOffline() { return _lojistaChamar('mlAvisoOffline', arguments); }
  function mlBaixarQR() { return _lojistaChamar('mlBaixarQR', arguments); }
  function mlBaixarStatus() { return _lojistaChamar('mlBaixarStatus', arguments); }
  function mlCardapioAbrirForm() { return _lojistaChamar('mlCardapioAbrirForm', arguments); }
  function mlCardapioFecharForm() { return _lojistaChamar('mlCardapioFecharForm', arguments); }
  function mlCardapioFiltrar() { return _lojistaChamar('mlCardapioFiltrar', arguments); }
  function mlCardapioFotoLoteAbrir() { return _lojistaChamar('mlCardapioFotoLoteAbrir', arguments); }
  function mlCardapioFotoLoteSelecionado() { return _lojistaChamar('mlCardapioFotoLoteSelecionado', arguments); }
  function mlCardapioFotoPreview() { return _lojistaChamar('mlCardapioFotoPreview', arguments); }
  function mlCardapioSalvar() { return _lojistaChamar('mlCardapioSalvar', arguments); }
  function mlChecklistDispensar() { return _lojistaChamar('mlChecklistDispensar', arguments); }
  function mlChecklistRender() { return _lojistaChamar('mlChecklistRender', arguments); }
  function mlCopiarCardapio() { return _lojistaChamar('mlCopiarCardapio', arguments); }
  function mlCopiarLink() { return _lojistaChamar('mlCopiarLink', arguments); }
  function mlDiasFechadosAdd() { return _lojistaChamar('mlDiasFechadosAdd', arguments); }
  function mlEntrarOutroCelular() { return _lojistaChamar('mlEntrarOutroCelular', arguments); }
  function mlGrupoAbrirForm() { return _lojistaChamar('mlGrupoAbrirForm', arguments); }
  function mlGrupoFecharForm() { return _lojistaChamar('mlGrupoFecharForm', arguments); }
  function mlGrupoSalvar() { return _lojistaChamar('mlGrupoSalvar', arguments); }
  function mlGrupoSyncModo() { return _lojistaChamar('mlGrupoSyncModo', arguments); }
  function mlGrupoSyncTipo() { return _lojistaChamar('mlGrupoSyncTipo', arguments); }
  function mlIrParaAvaliacoes() { return _lojistaChamar('mlIrParaAvaliacoes', arguments); }
  function mlOpcaoCancelarEdicao() { return _lojistaChamar('mlOpcaoCancelarEdicao', arguments); }
  function mlOpcaoEditar() { return _lojistaChamar('mlOpcaoEditar', arguments); }
  function mlOpcaoSalvar() { return _lojistaChamar('mlOpcaoSalvar', arguments); }
  function mlOpcoesFechar() { return _lojistaChamar('mlOpcoesFechar', arguments); }
  function mlOpcoesRenderLista() { return _lojistaChamar('mlOpcoesRenderLista', arguments); }
  function mlPlanosCiclo() { return _lojistaChamar('mlPlanosCiclo', arguments); }
  function mlProximaDica() { return _lojistaChamar('mlProximaDica', arguments); }
  function mlPublicarAnuncio() { return _lojistaChamar('mlPublicarAnuncio', arguments); }
  function mlRemoverAnuncio() { return _lojistaChamar('mlRemoverAnuncio', arguments); }
  function mlRenovarPlano() { return _lojistaChamar('mlRenovarPlano', arguments); }
  function mlSairDaConta() { return _lojistaChamar('mlSairDaConta', arguments); }
  function mlSelectEmoji() { return _lojistaChamar('mlSelectEmoji', arguments); }
  function mlSwitchTab() { return _lojistaChamar('mlSwitchTab', arguments); }
  function mlUploadImagem() { return _lojistaChamar('mlUploadImagem', arguments); }
  function mlVerComoCliente() { return _lojistaChamar('mlVerComoCliente', arguments); }
  function mlVerPedidos() { return _lojistaChamar('mlVerPedidos', arguments); }
  function openLoginLoja() { return _lojistaChamar('openLoginLoja', arguments); }
  function openModal() { return _lojistaChamar('openModal', arguments); }
  function schedMostrarAvancado() { return _lojistaChamar('schedMostrarAvancado', arguments); }
  function schedOcultarAvancado() { return _lojistaChamar('schedOcultarAvancado', arguments); }
  function schedPreset() { return _lojistaChamar('schedPreset', arguments); }
  function schedSyncSimples() { return _lojistaChamar('schedSyncSimples', arguments); }
  ['_aoAprovar', '_aplicarDadosLoja', '_irParaSlide', 'abrirAguardando', 'abrirMinhaLoja', 'cadAvancar', 'cadSelecionarCiclo', 'cadSelecionarPlano', 'cadToggleAgendamento', 'cadToggleVerTudo', 'cadVoltar', 'closeLoginLoja', 'closeModal', 'closePlanModal', 'confirmPlan', 'fecharAguardando', 'fecharMinhaLoja', 'fecharOnboardingLojista', 'iniciarPollingAprovacao', 'iniciarPollingPlano', 'llMascaraWpp', 'loginStep', 'lojaLogout', 'lojaReenviarCodigo', 'lojaRequestCodigo', 'lojaToggle', 'lojaToggleAberto', 'lojaToggleComHorario', 'lojaToggleFechado', 'lojaToggleVoltamos', 'lojaVerificarCodigo', 'mlAbrirUpgrade', 'mlAgendaCancelar', 'mlAgendaPreviewImagem', 'mlAgendaRecorrenciaChange', 'mlAgendaRemoverImagem', 'mlAgendaSalvar', 'mlAgendaSelectEmoji', 'mlAgendaToggleDia', 'mlAgendaToggleForm', 'mlAnuncioPreviewImagem', 'mlAnuncioRemoverImagem', 'mlAplicarConfirmar', 'mlAplicarFechar', 'mlAplicarRemover', 'mlAplicarTemplate', 'mlAtualizarBadgeMetricas', 'mlAtualizarHeroStatus', 'mlAvisoOffline', 'mlBaixarQR', 'mlBaixarStatus', 'mlCardapioAbrirForm', 'mlCardapioFecharForm', 'mlCardapioFiltrar', 'mlCardapioFotoLoteAbrir', 'mlCardapioFotoLoteSelecionado', 'mlCardapioFotoPreview', 'mlCardapioSalvar', 'mlChecklistDispensar', 'mlChecklistRender', 'mlCopiarCardapio', 'mlCopiarLink', 'mlDiasFechadosAdd', 'mlEntrarOutroCelular', 'mlGrupoAbrirForm', 'mlGrupoFecharForm', 'mlGrupoSalvar', 'mlGrupoSyncModo', 'mlGrupoSyncTipo', 'mlIrParaAvaliacoes', 'mlOpcaoCancelarEdicao', 'mlOpcaoEditar', 'mlOpcaoSalvar', 'mlOpcoesFechar', 'mlOpcoesRenderLista', 'mlPlanosCiclo', 'mlProximaDica', 'mlPublicarAnuncio', 'mlRemoverAnuncio', 'mlRenovarPlano', 'mlSairDaConta', 'mlSelectEmoji', 'mlSwitchTab', 'mlUploadImagem', 'mlVerComoCliente', 'mlVerPedidos', 'openLoginLoja', 'openModal', 'schedMostrarAvancado', 'schedOcultarAvancado', 'schedPreset', 'schedSyncSimples'].forEach(function (n) {
    if (typeof window[n] === 'function') window[n]._lojistaStub = true;
  });
  // Loja já logada neste aparelho: baixa o módulo com o boot assentado,
  // pro painel abrir sem espera quando a pessoa tocar em "Minha Loja".
  if (localStorage.getItem('angatuba_loja_token')) {
    window.addEventListener('load', function () {
      setTimeout(function () { _carregarLojista().catch(function () {}); }, 4000);
    }, { once: true });
  }


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

  /* (trecho do lojista movido para lojista.js — ver LOJISTA SOB DEMANDA) */

  /* ══════════════════════════════════════════════════════════════
     SESSÃO DE LOJA — login via WhatsApp + código
  ══════════════════════════════════════════════════════════════ */
  let _lojaToken = localStorage.getItem('angatuba_loja_token') || null;
  let _lojaNome  = localStorage.getItem('angatuba_loja_nome')  || '';
  let _mlPlanoAtual = 'GRATIS'; // plano da loja logada (Fase 2: decide stories múltiplos)
  let _mlUpgradeWppUrl = ''; // A1: link wa.me de fallback do CTA de upgrade do painel
  let _mlChecklistD = null;  // A1: últimos dados da loja aplicados, para o checklist re-renderizar sob demanda
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

  // Link de "entrar em outro celular" (?entrar=<código de uso único>).
  (function entrarPorLink() {
    let code = '';
    try { code = new URLSearchParams(location.search).get('entrar') || ''; } catch (e) {}
    if (!code) return;
    try {
      const q = new URLSearchParams(location.search); q.delete('entrar');
      history.replaceState(history.state, '', location.pathname + (q.toString() ? '?' + q.toString() : '') + location.hash);
    } catch (e) {}
    apiPost('lojaEntrarComLink', { code }, { timeout: 30000, ignoreUnauthorized: true }).then(json => {
      if (json.status === 'ok' && json.data && json.data.token) {
        _lojaToken = json.data.token;
        _lojaNome  = json.data.nome || '';
        _lojaWpp   = String(json.data.wpp || '');
        localStorage.setItem('angatuba_loja_token', _lojaToken);
        localStorage.setItem('angatuba_loja_nome',  _lojaNome);
        localStorage.setItem('angatuba_loja_wpp',   _lojaWpp);
        localStorage.removeItem('angatuba_loja_dados');
        atualizarNav();
        setTimeout(() => abrirMinhaLoja(), 300);
      } else {
        mlAviso('Link expirado', 'Esse link de acesso já foi usado ou passou dos 10 minutos. Gere um novo no celular que já está logado (Minha Loja → Loja → Entrar em outro celular).', '/webp/owl-sign.webp');
      }
    }).catch(() => {
      mlAviso('Não foi possível entrar', 'Confira a internet e abra o link de novo (ele vale 10 minutos).', '/webp/owl-sign.webp');
    });
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
    activeBairro     = '';  // Início zera tudo, inclusive o bairro
    const _lblBairroIni = document.getElementById('pill-bairro-label');
    if (_lblBairroIni) _lblBairroIni.textContent = 'Bairro';
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

  // A3: extraído para função nomeada — o mesmo roteamento (painel logado /
  // aguardando aprovação / login) é reaproveitado pelo atalho de instalação
  // "Meu painel" (?atalho=painel, ver _atalhoPainelNoBoot mais abaixo).
  function _abrirPainelOuLogin() {
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
  }
  document.getElementById('nav-loja').addEventListener('click', _abrirPainelOuLogin);

  document.getElementById('nav-cadastrar').addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    document.getElementById('nav-cadastrar').classList.add('active');
    openModal(); // abre o seletor de planos → cadastro
  });

  /* ── Bottom nav do modo cliente (slide Utilidades / body.feed-mode) ──
     Jogos · Aprender · Livros · Conta. Abrem overlays em tela cheia
     (hubs) ou modal (conta), não "abas" da home — por isso NÃO mexem no
     .active da nav: quem estava marcado (Início) continua marcado quando
     o overlay fecha, sem estado preso. Só disparam os fluxos que já
     existem. A visibilidade dos botões é 100% CSS (ver styles.css). */
  document.getElementById('nav-jogos').addEventListener('click', () => {
    // Só um hub por vez — mesma regra do badge da coruja.
    if (typeof _aprenderAberto === 'function' && _aprenderAberto()) { _fecharAprender(); }
    _abrirGamesHub();
  });

  document.getElementById('nav-aprender').addEventListener('click', () => {
    if (typeof _gamesHubAberto === 'function' && _gamesHubAberto()) { _fecharGamesHub(); }
    _abrirAprender();
  });

  // Biblioteca da Coruja: ela mesma fecha os outros hubs ao abrir.
  document.getElementById('nav-biblioteca').addEventListener('click', () => {
    _abrirBiblioteca();
  });

  document.getElementById('nav-conta').addEventListener('click', () => {
    // Deslogado → mesmo login/cadastro de cliente usado pelo ranking dos
    // jogos. Logado → painel de conta que já existe (apelido, foto, tema,
    // recordes, favoritos, sair). _cliUser é o estado de sessão do
    // Firebase Auth mantido lá embaixo, no bloco de auth do cliente.
    if (_cliUser) {
      cliAbrirPainelConta();
    } else {
      cliAbrirLogin('Entre para salvar sua pontuação, seus favoritos e aparecer no ranking da cidade.');
    }
  });

  /* (trecho do lojista movido para lojista.js — ver LOJISTA SOB DEMANDA) */

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

  /* (trecho do lojista movido para lojista.js — ver LOJISTA SOB DEMANDA) */

  /* ══════════════════════════════════════════════════════════════
     ONBOARDING DO CLIENTE — 3 telas na primeira vez que abre o app
     ----------------------------------------------------------
     Diferente do onboarding do lojista (boas-vindas ao painel).
     Este explica ao morador como usar: buscar, filtrar, contatar.
     Aparece só 1x (flag em localStorage) e pode ser pulado.
  ══════════════════════════════════════════════════════════════ */
  /* ══════════════════════════════════════════════════════════════
     ONBOARDING DO CLIENTE — tour guiado (spotlight) no 1º acesso
     ----------------------------------------------------------
     Diferente do onboarding do lojista (boas-vindas ao painel).
     1 card de boas-vindas + destaques ancorados nos elementos reais
     do cabeçalho (busca, categorias, filtros, favoritos, bairro) e
     nos dots do carrossel da home (clima/notícias no 2º slide). Um
     recorte escuro ("furo") destaca cada elemento e um balão explica
     o que faz, ali no contexto — em vez de telas genéricas soltas.
     Aparece só 1x (flag versionada em localStorage) e pode ser pulado.
     Só ancora em elementos ESTÁTICOS do header, então não depende do
     carregamento das lojas (GAS) para funcionar.
  ══════════════════════════════════════════════════════════════ */
  // Versionada: bump o sufixo (_v2 -> _v3) para relançar o tour quando
  // adicionar uma feature nova, sem remostrar a versão antiga a quem já viu.
  const CLIENTE_ONB_KEY = 'angatuba_cliente_onboarded_v3';
  // Passos do tour. O passo 0 é o card de boas-vindas central (sem alvo).
  // Os demais apontam para um elemento real via seletor CSS. Se o alvo não
  // existir na tela, o passo é pulado automaticamente.
  const CLIENTE_ONB_STEPS = [
    {
      hero: true,
      owl: '/webp/owl-wave.webp',
      icon: '👋',
      titulo: 'Bem-vindo ao AngatubaON',
      texto: 'Oi! Sou a coruja daqui. Deixa eu te mostrar em alguns toques como achar tudo na cidade.'
    },
    {
      sel: '.search-wrap',
      owl: '/webp/owl-search.webp',
      icon: '🔎',
      titulo: 'Busque o que quiser',
      texto: 'Digite o <strong>nome</strong> ou o <strong>tipo</strong> — pizza, farmácia, mercado. As lojas de Angatuba num só lugar.'
    },
    {
      sel: '#cat-bar',
      owl: '/webp/owl-idea.webp',
      icon: '🗂️',
      titulo: 'Navegue por categoria',
      texto: 'Toque numa <strong>categoria</strong> — farmácia, pizza, mercado — e veja só quem é daquele ramo.'
    },
    {
      sel: '.pill-btn[data-filter="open"]',
      owl: '/webp/owl-point.webp',
      icon: '🎯',
      titulo: 'Só o que está aberto',
      texto: 'Toque aqui pra ver <strong>só quem está aberto agora</strong>. Do lado dá pra filtrar quem <strong>faz entrega</strong> também.'
    },
    {
      sel: '.pill-fav-btn',
      owl: '/webp/owl-love.webp',
      icon: '❤️',
      titulo: 'Salve suas favoritas',
      texto: 'Toque no <strong>❤️</strong> dentro da loja pra salvar. Depois é só abrir aqui os <strong>Favoritos</strong> pra achar rapidinho.'
    },
    {
      sel: '#pill-bairro-btn',
      owl: '/webp/owl-tip.webp',
      icon: '📍',
      titulo: 'Filtre pelo seu bairro',
      texto: 'Quer ver só quem é mais perto de você? Filtre por <strong>bairro</strong> aqui.'
    },
    {
      sel: '#home-dots',
      owl: '/webp/owl-highlight.webp',
      icon: '👉',
      titulo: 'Tem mais um lado aqui',
      texto: 'Arraste a tela (ou toque nas bolinhas) e veja o <strong>clima de Angatuba</strong> e as <strong>notícias da cidade</strong>. O menu de baixo também muda, com <strong>Jogos</strong> e <strong>Aprender</strong> 🦉'
    }
  ];
  let _clienteOnbIdx = 0;
  let _clienteOnbReposHandler = null;

  function clienteJaViuOnboarding() {
    try { return localStorage.getItem(CLIENTE_ONB_KEY) === '1'; } catch (e) { return true; }
  }
  function marcarClienteOnboarding() {
    try { localStorage.setItem(CLIENTE_ONB_KEY, '1'); } catch (e) {}
  }

  // Retorna o índice do próximo passo cujo alvo existe (ou é hero), a partir
  // de "from" inclusive, na direção "dir" (+1 avançar / -1 nunca usado aqui).
  // Passos com alvo ausente são ignorados para o furo nunca apontar pro vazio.
  function _clienteOnbProxValido(from) {
    for (let i = from; i < CLIENTE_ONB_STEPS.length; i++) {
      const st = CLIENTE_ONB_STEPS[i];
      if (st.hero) return i;
      if (st.sel && document.querySelector(st.sel)) return i;
    }
    return -1;
  }

  // Mesmo alinhamento das bolinhas do tour do lojista: lista de índices
  // que existem de fato na tela, pra bolinha não contar passo sem alvo.
  function _clienteOnbIndicesValidos() {
    const out = [];
    let i = 0;
    while (i < CLIENTE_ONB_STEPS.length) {
      const prox = _clienteOnbProxValido(i);
      if (prox < 0) break;
      out.push(prox);
      i = prox + 1;
    }
    return out;
  }

  function mostrarOnboardingCliente() {
    if (clienteJaViuOnboarding()) return;
    if (document.getElementById('cliente-onb-overlay')) return;
    _clienteOnbIdx = _clienteOnbProxValido(0);
    if (_clienteOnbIdx < 0) { marcarClienteOnboarding(); return; }

    const ov = document.createElement('div');
    ov.id = 'cliente-onb-overlay';
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    ov.setAttribute('aria-label', 'Bem-vindo ao AngatubaON');
    ov.innerHTML =
      // Camada de recorte: 4 painéis escuros que emolduram o alvo, deixando
      // um "furo" transparente no meio. No passo hero eles cobrem tudo.
      '<div class="conb-mask" id="conb-mask">' +
        '<div class="conb-mask-pane" data-p="top"></div>' +
        '<div class="conb-mask-pane" data-p="right"></div>' +
        '<div class="conb-mask-pane" data-p="bottom"></div>' +
        '<div class="conb-mask-pane" data-p="left"></div>' +
      '</div>' +
      // Anel destacando o alvo.
      '<div class="conb-ring" id="conb-ring"></div>' +
      // Botão pular (fixo o tour inteiro).
      '<button type="button" class="conb-skip" id="conb-skip" onclick="pularOnboardingCliente()">Pular</button>' +
      // Balão explicativo (reposicionado por JS conforme o alvo).
      '<div class="conb-pop" id="conb-pop" role="document">' +
        '<div class="conb-pop-arrow" id="conb-pop-arrow"></div>' +
        '<div class="conb-owl-wrap"><img class="conb-owl" id="conb-owl" src="" alt="" ' +
          'onerror="if(!this.dataset.f){this.dataset.f=1;this.style.display=\'none\';this.parentNode.nextElementSibling.style.display=\'\';}" /></div>' +
        '<div class="conb-icon" id="conb-icon"></div>' +
        '<div class="conb-title" id="conb-title"></div>' +
        '<div class="conb-text" id="conb-text"></div>' +
        '<div class="conb-foot">' +
          '<div class="conb-dots" id="conb-dots"></div>' +
          '<button type="button" class="conb-cta" id="conb-cta" onclick="avancarOnboardingCliente()">Próximo</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(ov);
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(function () { ov.classList.add('open'); });

    // Reposiciona no scroll/resize/rotação para o furo seguir o alvo.
    _clienteOnbReposHandler = function () { posicionarOnboardingCliente(); };
    window.addEventListener('resize', _clienteOnbReposHandler, { passive: true });
    window.addEventListener('scroll', _clienteOnbReposHandler, { passive: true, capture: true });
    window.addEventListener('orientationchange', _clienteOnbReposHandler, { passive: true });

    renderOnboardingClienteStep();
    _focusTrapAtivar(ov);
  }

  // Preenche o conteúdo do passo atual e chama o posicionamento.
  function renderOnboardingClienteStep() {
    const s = CLIENTE_ONB_STEPS[_clienteOnbIdx];
    if (!s) return;
    const owl = document.getElementById('conb-owl');
    const icon = document.getElementById('conb-icon');
    const titulo = document.getElementById('conb-title');
    const texto = document.getElementById('conb-text');
    const dots = document.getElementById('conb-dots');
    const cta = document.getElementById('conb-cta');
    if (owl) { owl.dataset.f = ''; owl.style.display = ''; owl.src = s.owl || ''; }
    // Emoji do passo é só reserva: com a coruja na tela ele repetia a ideia
    // (👋 embaixo da coruja acenando). Volta pelo onerror da coruja.
    if (icon) { icon.textContent = s.icon || ''; icon.style.display = s.owl ? 'none' : ''; }
    if (titulo) titulo.textContent = s.titulo || '';
    if (texto) texto.innerHTML = s.texto || '';
    const _clienteOnbValidos = _clienteOnbIndicesValidos();
    if (dots) {
      dots.innerHTML = _clienteOnbValidos.map(function (idx) {
        return '<span class="conb-dot' + (idx === _clienteOnbIdx ? ' active' : '') + '"></span>';
      }).join('');
    }
    const _clienteEhUltimoPasso = _clienteOnbValidos.length > 0 &&
      _clienteOnbIdx === _clienteOnbValidos[_clienteOnbValidos.length - 1];
    if (cta) cta.textContent = _clienteEhUltimoPasso ? 'Entendi! 🚀' : 'Próximo';
    posicionarOnboardingCliente();
  }

  // Calcula o retângulo do alvo e posiciona máscara, anel e balão.
  // Passo hero: máscara cobre tudo e o balão fica centralizado.
  function posicionarOnboardingCliente() {
    const ov = document.getElementById('cliente-onb-overlay');
    if (!ov) return;
    const s = CLIENTE_ONB_STEPS[_clienteOnbIdx];
    const pop = document.getElementById('conb-pop');
    const ring = document.getElementById('conb-ring');
    const arrow = document.getElementById('conb-pop-arrow');
    const mask = document.getElementById('conb-mask');
    const panes = {
      top: mask.querySelector('[data-p="top"]'),
      right: mask.querySelector('[data-p="right"]'),
      bottom: mask.querySelector('[data-p="bottom"]'),
      left: mask.querySelector('[data-p="left"]')
    };
    const vw = window.innerWidth, vh = window.innerHeight;

    // HERO: sem alvo. Escurece tudo, esconde anel/seta, centraliza o balão.
    if (s.hero || !s.sel) {
      ov.classList.add('is-hero');
      if (ring) ring.style.display = 'none';
      if (arrow) arrow.style.display = 'none';
      // Painel "top" cobre a tela inteira; os outros zerados.
      panes.top.style.cssText = 'top:0;left:0;width:100%;height:100%;';
      panes.right.style.cssText = 'width:0;height:0;';
      panes.bottom.style.cssText = 'width:0;height:0;';
      panes.left.style.cssText = 'width:0;height:0;';
      if (pop) {
        pop.classList.add('centered');
        pop.style.left = ''; pop.style.top = '';
      }
      return;
    }

    const el = document.querySelector(s.sel);
    if (!el) { avancarOnboardingCliente(); return; }
    ov.classList.remove('is-hero');
    if (pop) pop.classList.remove('centered');

    const r = el.getBoundingClientRect();
    const pad = 8; // respiro em volta do alvo
    const hx = Math.max(0, r.left - pad);
    const hy = Math.max(0, r.top - pad);
    const hw = Math.min(vw, r.right + pad) - hx;
    const hh = Math.min(vh, r.bottom + pad) - hy;

    // Molduras (4 retângulos escuros ao redor do furo).
    panes.top.style.cssText = 'top:0;left:0;width:100%;height:' + hy + 'px;';
    panes.bottom.style.cssText = 'top:' + (hy + hh) + 'px;left:0;width:100%;height:' + Math.max(0, vh - (hy + hh)) + 'px;';
    panes.left.style.cssText = 'top:' + hy + 'px;left:0;width:' + hx + 'px;height:' + hh + 'px;';
    panes.right.style.cssText = 'top:' + hy + 'px;left:' + (hx + hw) + 'px;width:' + Math.max(0, vw - (hx + hw)) + 'px;height:' + hh + 'px;';

    // Anel no alvo.
    if (ring) {
      ring.style.display = 'block';
      ring.style.left = hx + 'px';
      ring.style.top = hy + 'px';
      ring.style.width = hw + 'px';
      ring.style.height = hh + 'px';
    }

    // Balão: por padrão abaixo do alvo; se não couber, acima.
    if (pop) {
      // Mede o balão fora da tela para saber a altura antes de posicionar.
      pop.style.left = '-9999px'; pop.style.top = '0px';
      const pw = pop.offsetWidth || 320;
      const ph = pop.offsetHeight || 200;
      const gap = 16;
      const belowTop = hy + hh + gap;
      const fitsBelow = (belowTop + ph) <= (vh - 12);
      let popTop, arrowUp;
      if (fitsBelow) { popTop = belowTop; arrowUp = true; }
      else { popTop = Math.max(12, hy - gap - ph); arrowUp = false; }
      // Centraliza horizontalmente no alvo, preso às margens da tela.
      const targetCx = hx + hw / 2;
      let popLeft = targetCx - pw / 2;
      popLeft = Math.max(12, Math.min(popLeft, vw - pw - 12));
      pop.style.left = popLeft + 'px';
      pop.style.top = popTop + 'px';
      // Seta apontando pro centro do alvo.
      if (arrow) {
        arrow.style.display = 'block';
        arrow.classList.toggle('up', arrowUp);
        arrow.classList.toggle('down', !arrowUp);
        let ax = targetCx - popLeft;
        ax = Math.max(18, Math.min(ax, pw - 18));
        arrow.style.left = ax + 'px';
      }
    }
  }

  window.avancarOnboardingCliente = function () {
    const prox = _clienteOnbProxValido(_clienteOnbIdx + 1);
    if (prox >= 0) {
      _clienteOnbIdx = prox;
      renderOnboardingClienteStep();
    } else {
      fecharOnboardingCliente();
    }
  };
  window.pularOnboardingCliente = function () { fecharOnboardingCliente(); };

  function fecharOnboardingCliente() {
    marcarClienteOnboarding();
    const ov = document.getElementById('cliente-onb-overlay');
    if (_clienteOnbReposHandler) {
      window.removeEventListener('resize', _clienteOnbReposHandler);
      window.removeEventListener('scroll', _clienteOnbReposHandler, { capture: true });
      window.removeEventListener('orientationchange', _clienteOnbReposHandler);
      _clienteOnbReposHandler = null;
    }
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

  /* (trecho do lojista movido para lojista.js — ver LOJISTA SOB DEMANDA) */

  /* ── Inicializa nav ──────────────────────────────────────── */
  atualizarNav();
  // Inicializa auth de cliente (Firebase). Isolado do login de loja.
  // app+auth carregam em paralelo ao boot (ver _carregarFirebaseAuthCore) —
  // não bloqueiam o primeiro render de quem só quer ver o cardápio. Login
  // é usado tanto no ranking dos jogos quanto no botão de postar aviso.
  if (typeof _carregarFirebaseAuthCore === 'function') {
    _carregarFirebaseAuthCore().then(function () {
      if (typeof cliAuthInit === 'function') cliAuthInit();
    }).catch(function (err) {
      console.warn('[Firebase] auth indisponível:', err);
      if (typeof cliAtualizarHeader === 'function') cliAtualizarHeader(); // mantém UI deslogada, sem quebrar nada
    });
  }
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
      // As pills "Jogos" e "Aprender" saíram desta faixa: aqui só moram
      // filtros de LOJA. Os dois hubs agora abrem pela bottom nav do modo
      // cliente (slide Utilidades) e, no caso dos jogos, também pelo badge
      // da coruja — ver os handlers de #nav-jogos / #nav-aprender.
      // Se algum hub estava aberto, fecha e volta pra lista.
      if (typeof _gamesHubAberto === 'function' && _gamesHubAberto()) {
        _fecharGamesHub();
      }
      if (typeof _aprenderAberto === 'function' && _aprenderAberto()) {
        _fecharAprender();
      }
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
      // Se o hub de jogos estava aberto, fecha antes de abrir o filtro de bairro.
      if (typeof _gamesHubAberto === 'function' && _gamesHubAberto()) {
        _fecharGamesHub();
      }
      // Idem pro hub Aprender.
      if (typeof _aprenderAberto === 'function' && _aprenderAberto()) {
        _fecharAprender();
      }
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
      // Clima não tinha refresh nenhum dentro da mesma sessão (só ao
      // recarregar a página) — _carregarClima já respeita o cache de 30min
      // por conta própria, então chamar de novo aqui é barato (ver A3.3).
      if (_utilidadesCarregadas && typeof _carregarClima === 'function') _carregarClima();
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
  // Registration guardada pro bloco de PUSH (FCM), perto do fim do
  // arquivo — getToken() precisa dela porque o app registra o SW num
  // caminho próprio ('/service-worker.js'), não no nome padrão que o
  // Messaging procura sozinho.
  var _swRegistration = null;
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/service-worker.js', { scope: '/' })
        .then(reg => {
          _swRegistration = reg;
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
    // Coruja segurando o cabo solto (a do empty-state ficava na última
    // pose usada, que podia ser a da lupa "não achei nada").
    const _owlOff = document.getElementById('empty-owl');
    if (_owlOff) { _owlOff.src = '/webp/owl-offline.webp'; _owlOff.style.display = 'block'; }
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
            <div class="addr-item-main">${escHTML(ruaPart)}</div>
            ${subPart ? `<div class="addr-item-sub">${escHTML(subPart)}</div>` : ''}
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
    _uiSom('abrir');

    // Fecha o nudge de avaliação se estiver visível — evita ele flutuar
    // por cima do modal que está abrindo (idempotente: _fecharNudgeAval
    // já verifica se o elemento existe antes de agir).
    if (typeof _fecharNudgeAval === 'function') _fecharNudgeAval();

    // Back button Android: empurra estado para que voltar feche o modal.
    // Evita empilhar entrada duplicada se já estamos num estado 'detalhes'
    // (ex.: abrir outra loja a partir de dentro do próprio modal).
    if (history.state?.modal === 'detalhes') {
      history.replaceState({ modal: 'detalhes', idx }, '', '#' + lojaHash(loja.nome, loja.wpp));
    } else {
      history.pushState({ modal: 'detalhes', idx }, '', '#' + lojaHash(loja.nome, loja.wpp));
    }

    // Métrica de visualização (antes nunca era enviada: Visualizações e
    // Conversão ficavam sempre em 0). Abrir a própria loja não conta.
    try {
      const souDono = !!_lojaToken && _mlMesmoWpp(loja.wpp, localStorage.getItem('angatuba_loja_wpp') || '');
      if (!souDono) registrarClique(loja.nome, 'view', loja.plano || 'GRATIS', loja.categoria || '');
    } catch (e) {}

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
    const hasFoto = loja.foto && loja.foto.trim(); // capa liberada no Grátis
    const hasLogo = isPago && loja.logo && loja.logo.trim();

    // Tem foto de anuncio? Logo ganha anel animado + abre a sequência de
    // stories ao tocar. Fix A4.6/A4.7/A4.8: migrado pro mesmo modelo Fase 2
    // do card (thumbHTML) — antes a ficha usava o modelo Fase 1 (só o
    // primeiro story, "visto" por assinatura do conjunto inteiro), o que
    // abria só o 1º story em vez da sequência, divergia do card sobre
    // visto/não-visto, e escondia o anel quando o 1º story era só texto.
    const _mStoriesArr = _normalizarStories(loja);
    const _mLogoAnuncio = isPro && _mStoriesArr.some(function(st){ return st.imagemUrl; });
    const _mLogoId  = loja.id || loja.wpp || loja.nome;
    const _mLogoAss = _mLogoAnuncio ? _assinaturaAnuncio(loja) : '';
    const _mLogoVisto = _mLogoAnuncio && !_lojaTemStoryNaoVisto(_mStoriesArr);
    if (_mLogoAnuncio) { try { (window._STORIES_REG = window._STORIES_REG || {})[String(_mLogoId)] = _mStoriesArr; } catch(e){} }
    const logoOverlay = hasLogo
      ? (_mLogoAnuncio
        ? `<div class="detail-logo-ring${_mLogoVisto ? ' ring-visto' : ''}"
             ${_ringAnuncioData(loja, _mLogoId, _mLogoAss)} onclick="abrirStoriesEl(this)"
             role="button" tabindex="0" title="Ver stories"
             onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();abrirStoriesEl(this);}">
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
           <img class="detail-cover" loading="lazy" decoding="async" src="${escAttr(loja.foto)}" alt="Foto ${escAttr(loja.nome)}"${fotoPosCss(loja) ? ` style="object-position:${fotoPosCss(loja)}"` : ''}
             onerror="this.parentElement.innerHTML = placeholderCover('${escJsArg(emojiLoja(loja))}', '${escJsArg(loja.categoria || '')}');" />
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
                    <div style="font-size:10px;color:var(--muted);">${avaliacoes.length} ${avaliacoes.length>1?'avaliações':'avaliação'}</div>
                  </div>
                  ${trofeuHTML}
                </div>`
             : `<div style="font-size:11.5px;color:var(--muted);display:flex;align-items:center;gap:6px;">
                  <span style="color:#f59e0b;">★</span> ${avaliacoes.length} ${avaliacoes.length>1?'avaliações':'avaliação'} · a média aparece a partir de ${AVAL_MIN_MEDIA}
                </div>`}
           <button type="button" id="aval-toggle-${idx}" onclick="avalToggleLista(${idx})"
             style="width:100%;margin-top:10px;padding:9px;border-radius:9px;cursor:pointer;
                    background:var(--surface2);border:1px solid var(--border);color:var(--text);
                    font-family:var(--font-b);font-size:12.5px;font-weight:600;
                    display:flex;align-items:center;justify-content:center;gap:6px;-webkit-tap-highlight-color:transparent;">
             <span class="aval-toggle-txt">Ver ${avaliacoes.length} ${avaliacoes.length>1?'avaliações':'avaliação'}</span>
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
    const url = `${location.origin}/#${lojaHash(loja.nome, loja.wpp)}`;

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

    _uiSom('compartilhar');
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
    if (overlay.classList.contains('open')) _uiSom('fechar');
    overlay.classList.remove('open');
    document.body.style.overflow = '';
    _focusTrapDesativar();
    if (silencioso) {
      // Chamado antes de abrir outro modal — limpa o hash sem history.back()
      // para evitar que o popstate feche o próximo modal
      if (location.hash) history.replaceState(null, '', location.pathname + location.search);
    } else if (history.state?.modal === 'detalhes') {
      _popstateNosso = true;
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
    const horaStr = is24h ? '24 horas' : `${escHTML(abre)} – ${escHTML(fecha)}`;
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
      const igHandle = _igHandleSeguro(loja.instagram);
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

      const { cloud, apiKey, timestamp, folder, signature, allowed_formats } = sigJson.data;

      // Etapa 2: upload direto do browser para Cloudinary (sem passar pelo GAS)
      statusEl.textContent = '⏳ Enviando imagem...';
      const formData = new FormData();
      formData.append('file',      file);
      formData.append('api_key',   apiKey);
      formData.append('timestamp', timestamp);
      formData.append('folder',    folder);
      // Entra na assinatura do GAS: tem que ir exatamente como veio.
      if (allowed_formats) formData.append('allowed_formats', allowed_formats);
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
      if (d.allowed_formats) fd.append('allowed_formats', d.allowed_formats);
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

  /* (trecho do lojista movido para lojista.js — ver LOJISTA SOB DEMANDA) */

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

  /* ══════════════════════════════════════════════════════════════════
     Carrossel horizontal da Home: Página 1 (Lojas) / Página 2 (Utilidades)
     — clima de Angatuba + "Hoje em Angatuba" (avisos locais).
     Preferência de página inicial salva no localStorage; o valor já foi
     lido e aplicado ANTES deste script rodar (ver <script> inline logo
     após o carrossel no index.html, que evita o "pulo" visual).
     ══════════════════════════════════════════════════════════════════ */
  var HOME_PAGINA_PREF_KEY = 'angatuba_home_pagina_pref';
  var _homePaginaAtual = (window._homePaginaInicial === 1) ? 1 : 0;

  function _irParaPaginaHome(idx, animado = true) {
    var carousel = document.getElementById('home-carousel');
    if (!carousel) return;
    idx = Math.max(0, Math.min(idx, 1));
    // Vinheta de notícia ao deslizar pro "Hoje em Angatuba" (1x por sessão).
    if (animado && idx === 1 && _homePaginaAtual !== 1 && !_uiSomNoticiaTocou) { _uiSomNoticiaTocou = true; _uiSom('noticia'); }
    _homePaginaAtual = idx;
    carousel.style.transition = animado ? 'transform 0.32s cubic-bezier(0.32,0.72,0,1)' : 'none';
    carousel.style.transform  = 'translateX(-' + (idx * 100) + '%)';
    document.querySelectorAll('.home-dot').forEach(function (d, i) {
      d.classList.toggle('active', i === idx);
    });
    // Modo Feed: na pagina 2 ("Hoje em Angatuba"), busca/categorias/pills
    // somem via CSS (body.feed-mode) para o feed ocupar a tela toda.
    document.body.classList.toggle('feed-mode', idx === 1);
    if (idx === 1) _carregarUtilidadesHome();
  }
  window._irParaPaginaHome = _irParaPaginaHome;

  // Mostra o botão "abrir sempre..." só na página que NÃO é a preferida
  // atual (na página já definida como padrão, o botão some — não faz
  // sentido oferecer pra definir de novo o que já está definido).
  function _atualizarBotoesPrefHome() {
    var pref = 0;
    try { pref = (localStorage.getItem(HOME_PAGINA_PREF_KEY) === '1') ? 1 : 0; } catch (e) {}
    var b0 = document.getElementById('home-pref-btn-0');
    var b1 = document.getElementById('home-pref-btn-1');
    if (b0) b0.style.display = (pref === 0) ? 'none' : '';
    if (b1) b1.style.display = (pref === 1) ? 'none' : '';
  }

  // Botões discretos "Abrir sempre nas lojas" / "Abrir sempre nesta página".
  function _definirPaginaInicialHome(idx, btn) {
    try { localStorage.setItem(HOME_PAGINA_PREF_KEY, String(idx)); } catch (e) {}
    if (btn) {
      var txtOriginal = btn.textContent;
      btn.textContent = '✓ Página inicial definida';
      btn.disabled = true;
      setTimeout(function () {
        btn.textContent = txtOriginal;
        btn.disabled = false;
        _atualizarBotoesPrefHome(); // some deste lado, some só o outro fica visível
      }, 1200);
    } else {
      _atualizarBotoesPrefHome();
    }
  }
  window._definirPaginaInicialHome = _definirPaginaInicialHome;

  /* ── Página 2: Previsão do tempo (Open-Meteo — API gratuita, sem
     chave, CORS liberado; por isso é chamada direto do client, sem
     passar pelo GAS). Coordenadas fixas de Angatuba-SP: app hiperlocal
     de uma cidade só, não precisa pedir geolocalização do usuário.
     Resultado cacheado 30min no localStorage p/ evitar refetch a cada
     troca de página. ── */
  var _utilidadesCarregadas = false;
  // v2: cardápio de campos mudou (hora a hora + semana + umidade/vento/chuva);
  // troquei a chave pra não reaproveitar um cache antigo com o formato velho.
  // v3: formato do cache mudou (pontosPorDia + umidade por hora) — bump pra
  // não reaproveitar cache antigo incompatível salvo por usuários antes
  // dessas mudanças.
  var WEATHER_CACHE_KEY    = 'angatuba_weather_cache_v3';
  var WEATHER_CACHE_TS_KEY = 'angatuba_weather_cache_v3_ts';
  var WEATHER_CACHE_MS     = 30 * 60 * 1000;
  var WEATHER_LAT = -23.4886, WEATHER_LON = -48.4159;
  var _climaBruto = null;   // resposta já processada, guardada pro gráfico (abas)
  var _climaAbaAtual = 'temp';
  var WEATHER_TAB_CFG = {
    temp:  { campo: 'temp',  cor: '#fbbf24', sufixo: '°' },
    chuva: { campo: 'chuva', cor: '#60a5fa', sufixo: '%' },
    vento: { campo: 'vento', cor: '#38bdf8', sufixo: '' },
  };
  // ic = ícone Font Awesome (sem o prefixo "fa-"), col = cor do ícone.
  // dia/noite: só os códigos de céu limpo/poucas nuvens têm variante
  // noturna (sol vira lua) — o resto do mapa vale pros dois períodos.
  var WMO_MAP = {
    0:  { icDia: 'fa-sun',        icNoite: 'fa-moon',       txt: 'Céu limpo',            col: '#fbbf24', colNoite: '#c7d2fe' },
    1:  { icDia: 'fa-cloud-sun',  icNoite: 'fa-cloud-moon', txt: 'Poucas nuvens',         col: '#fbbf24', colNoite: '#c7d2fe' },
    2:  { icDia: 'fa-cloud-sun',  icNoite: 'fa-cloud-moon', txt: 'Parcialmente nublado',  col: '#e2b45c', colNoite: '#c7d2fe' },
    3:  { icDia: 'fa-cloud',      txt: 'Nublado',              col: '#94a3b8' },
    45: { icDia: 'fa-smog',       txt: 'Neblina',               col: '#94a3b8' },
    48: { icDia: 'fa-smog',       txt: 'Neblina',               col: '#94a3b8' },
    51: { icDia: 'fa-cloud-rain', txt: 'Garoa fraca',           col: '#60a5fa' },
    53: { icDia: 'fa-cloud-rain', txt: 'Garoa',                 col: '#60a5fa' },
    55: { icDia: 'fa-cloud-rain', txt: 'Garoa forte',           col: '#3b82f6' },
    61: { icDia: 'fa-cloud-rain', txt: 'Chuva fraca',           col: '#60a5fa' },
    63: { icDia: 'fa-cloud-showers-heavy', txt: 'Chuva',        col: '#3b82f6' },
    65: { icDia: 'fa-cloud-showers-heavy', txt: 'Chuva forte',  col: '#2563eb' },
    80: { icDia: 'fa-cloud-rain', txt: 'Pancadas de chuva',     col: '#3b82f6' },
    81: { icDia: 'fa-cloud-showers-heavy', txt: 'Pancadas de chuva', col: '#3b82f6' },
    82: { icDia: 'fa-cloud-bolt', txt: 'Pancadas fortes',       col: '#818cf8' },
    95: { icDia: 'fa-cloud-bolt', txt: 'Tempestade',            col: '#a78bfa' },
    96: { icDia: 'fa-cloud-bolt', txt: 'Tempestade c/ granizo', col: '#a78bfa' },
    99: { icDia: 'fa-cloud-bolt', txt: 'Tempestade c/ granizo', col: '#a78bfa' },
  };
  function _weatherInfo(code, isDay) {
    var m = WMO_MAP[code] || { icDia: 'fa-cloud', txt: '—', col: '#94a3b8' };
    var noite = (isDay === false) && m.icNoite;
    return { ic: noite ? m.icNoite : m.icDia, txt: m.txt, col: noite ? (m.colNoite || m.col) : m.col };
  }

  // ── Sugestão do dia (card "Sugestão do dia" no topo do clima) ──
  // Texto 100% local: nenhuma chamada extra de API, só regras simples em
  // cima do code/temp/chuva que a Open-Meteo já devolveu. Prioridade:
  // chuva > frio > nublado > quente > ameno (chuva/frio são os que mais
  // mudam o plano do dia de quem está lendo, por isso vêm primeiro).
  var CHUVA_WMO_CODES = { 51:1, 53:1, 55:1, 61:1, 63:1, 65:1, 80:1, 81:1, 82:1, 95:1, 96:1, 99:1 };
  function _calcularSugestaoDoDia(code, temp, chuvaProb, isDay) {
    var t = (temp == null) ? null : Math.round(temp);
    var temChuvaCondicao = !!CHUVA_WMO_CODES[code];
    var temChuvaProvavel = chuvaProb != null && chuvaProb >= 60;
    var nublado = code === 3 || code === 45 || code === 48;
    var frio    = t != null && t <= 15;
    var quente  = t != null && t >= 28;

    if (isDay === false) {
      if (temChuvaCondicao || temChuvaProvavel) return { ic: 'fa-umbrella', txt: 'Chuva à noite — leve guarda-chuva se for sair.' };
      if (frio) return { ic: 'fa-mug-hot', txt: 'Noite fria — ótima pra um chocolate quente ou um filme em casa.' };
      return { ic: 'fa-moon', txt: 'Noite boa pra pedir delivery ou sair com casaco.' };
    }
    if (temChuvaCondicao || temChuvaProvavel) return { ic: 'fa-umbrella', txt: 'Leve o guarda-chuva. Evite a feira se estiver chovendo forte.' };
    if (frio)    return { ic: 'fa-mug-hot',    txt: 'Dia mais frio — ótimo pra um café quente ou almoço caseiro.' };
    if (nublado) return { ic: 'fa-cloud',      txt: 'Dia nublado — ótimo pra resolver as compras sem o sol forte.' };
    if (quente)  return { ic: 'fa-sun',        txt: 'Dia quente e ensolarado — boa pra feira, sorvete ou praça.' };
    return           { ic: 'fa-cloud-sun',  txt: 'Tempo bom pra caminhar no centro ou tomar um café.' };
  }
  function _pintarSugestaoDoDia(code, temp, chuvaProb, isDay) {
    var elTxt = document.getElementById('weather-sugestao-txt');
    if (!elTxt) return;
    var s = _calcularSugestaoDoDia(code, temp, chuvaProb, isDay);
    var elIc = document.getElementById('weather-sugestao-icon');
    if (elIc) elIc.className = 'fa ' + s.ic;
    elTxt.textContent = s.txt;
  }

  // ── Alerta de chuva nas próximas horas (banner discreto no topo do card) ──
  // Usa os pontos de 3 em 3h de hoje (pontosHoje) já calculados por
  // _montarDadosClima — não faz nenhuma chamada extra. Olha só os próximos
  // pontos (ainda não passados) e avisa se algum tiver risco de chuva alto.
  function _calcularAlertaChuva(pontosHoje, horaAtual) {
    if (!Array.isArray(pontosHoje) || !pontosHoje.length) return null;
    var futuros = pontosHoje.filter(function (p) {
      var h = parseInt(p.hora, 10);
      return !isNaN(h) && h >= horaAtual;
    }).slice(0, 3);
    var risco = null;
    for (var i = 0; i < futuros.length; i++) {
      if (futuros[i].chuva != null && futuros[i].chuva >= 60) { risco = futuros[i]; break; }
    }
    if (!risco) return null;
    var diff = parseInt(risco.hora, 10) - horaAtual;
    if (diff <= 1) return 'Chuva forte possível a qualquer momento — leve o guarda-chuva.';
    return 'Chuva possível nas próximas ' + diff + ' horas.';
  }
  function _pintarAlertaChuva(pontosHoje) {
    var el = document.getElementById('weather-alerta-chuva');
    var elTxt = document.getElementById('weather-alerta-chuva-txt');
    if (!el || !elTxt) return;
    var msg = _calcularAlertaChuva(pontosHoje, _horaSP().h);
    if (msg) { elTxt.textContent = msg; el.style.display = 'flex'; }
    else { el.style.display = 'none'; }
  }

  // Zero-pad simples e string de hora local "yyyy-mm-ddThh" (SEM converter
  // pra UTC) — a API devolve os horários já no fuso de Angatuba porque
  // pedimos timezone=America/Sao_Paulo, então comparamos hora local com
  // hora local direto, sem trocar de fuso no meio do caminho.
  function _p2(n) { return (n < 10 ? '0' : '') + n; }
  function _horaLocalStr(dt) {
    return dt.getFullYear() + '-' + _p2(dt.getMonth() + 1) + '-' + _p2(dt.getDate()) + 'T' + _p2(dt.getHours());
  }
  // Fix: a API é pedida com timezone=America/Sao_Paulo, mas a "chuva agora"
  // e o alerta comparavam com a hora do RELÓGIO DO DEVICE (_horaLocalStr/
  // getHours) — num aparelho com fuso diferente (viagem, configuração
  // errada) o horário não batia com nenhum ponto da API e o fallback caía
  // silenciosamente na meia-noite. Deriva a hora de Angatuba de verdade.
  function _horaSP() {
    try {
      var partes = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false
      }).formatToParts(new Date());
      var o = {};
      partes.forEach(function (p) { o[p.type] = p.value; });
      var hora = o.hour === '24' ? '00' : o.hour; // alguns navegadores devolvem "24" à meia-noite
      return { str: o.year + '-' + o.month + '-' + o.day + 'T' + hora, h: parseInt(hora, 10) };
    } catch (e) {
      return { str: _horaLocalStr(new Date()), h: new Date().getHours() }; // sem Intl: cai no relógio do device mesmo
    }
  }

  // Monta o formato interno usado pela UI a partir da resposta crua da
  // Open-Meteo: condição atual + resumo (chuva/umidade/vento) + os 8
  // pontos de 3 em 3h (01h,04h...22h, igual ao Google) de CADA um dos 7
  // dias (pontosPorDia) + a semana. O gráfico troca de dia ao clicar na
  // tira semanal (ver _selecionarDiaClima).
  // Fix A3.10: coage pra número (ou null) na entrada — hoje não existe
  // vetor de XSS explorável (tudo já passa por Math.round/parseInt antes de
  // ir pro innerHTML), mas o objeto monta HTML/SVG por concatenação de
  // string e é re-hidratado de JSON.parse(localStorage), uma fonte cuja
  // forma o código não controla. Defesa barata que documenta a intenção.
  function _climaNum(v) { return (v == null) ? null : Number(v); }

  function _montarDadosClima(j) {
    // Fix A3.5: a Open-Meteo pode devolver 200 com "hourly" parcial (rate
    // limit) — sem guardas, um índice ausente virava TypeError dentro do
    // .then e derrubava o card inteiro. Falta de current/daily aborta cedo;
    // os demais campos ganham fallback pra [] e seguem undefined (os `?`
    // no template do topo já tratam undefined como "--").
    if (!j || !j.current || !j.daily) return null;
    var DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    var diasStr = (j.daily && j.daily.time) || [];
    var horasAlvo = [1, 4, 7, 10, 13, 16, 19, 22];
    var pontosPorDia = diasStr.map(function () { return []; });
    var hourly = j.hourly || {};
    if (hourly.time) {
      hourly.time.forEach(function (t, i) {
        var diaIdx = diasStr.indexOf(t.slice(0, 10));
        if (diaIdx === -1) return;
        var h = parseInt(t.slice(11, 13), 10);
        if (horasAlvo.indexOf(h) === -1) return;
        pontosPorDia[diaIdx].push({
          hora:    _p2(h) + 'h',
          temp:    _climaNum((hourly.temperature_2m || [])[i]),
          chuva:   _climaNum(hourly.precipitation_probability ? hourly.precipitation_probability[i] : 0),
          vento:   _climaNum((hourly.wind_speed_10m || [])[i]),
          umidade: _climaNum(hourly.relative_humidity_2m ? hourly.relative_humidity_2m[i] : null),
        });
      });
    }
    var semana = diasStr.slice(0, 7).map(function (dt, i) {
      return {
        nome: i === 0 ? 'Hoje' : DIAS_SEMANA[new Date(dt + 'T12:00:00').getDay()],
        max:  _climaNum((j.daily.temperature_2m_max || [])[i]),
        min:  _climaNum((j.daily.temperature_2m_min || [])[i]),
        code: (j.daily.weather_code || [])[i],
      };
    });
    // % de chuva "agora": pega a hora corrente na lista de horas (não os
    // 8 pontos de 3 em 3h — a hora exata mais próxima do relógio).
    var chuvaAgora = null;
    if (hourly.time && hourly.precipitation_probability) {
      var alvo = _horaSP().str;
      var idx = hourly.time.findIndex(function (t) { return t.slice(0, 13) === alvo; });
      if (idx !== -1) chuvaAgora = _climaNum(hourly.precipitation_probability[idx]); // sem match: fica null ("--"), não mais meia-noite
    }
    return {
      temp:    _climaNum(j.current.temperature_2m),
      code:    j.current.weather_code,
      isDay:   j.current.is_day !== 0,
      umidade: _climaNum(j.current.relative_humidity_2m),
      vento:   _climaNum(j.current.wind_speed_10m),
      chuva:   chuvaAgora,
      max:     _climaNum((j.daily.temperature_2m_max || [])[0]),
      min:     _climaNum((j.daily.temperature_2m_min || [])[0]),
      pontosHoje:   pontosPorDia[0] || [],
      pontosPorDia: pontosPorDia,
      semana:       semana,
    };
  }

  // Pinta o card grande do topo (ícone, temperatura, condição, máx/mín,
  // chuva/umidade/vento) para o dia "i" da semana (0 = hoje).
  // i=0 usa os dados de "agora" de verdade (os únicos com hora exata);
  // i>0 usa o resumo do dia (máx/mín + ícone) e o ponto de meio-dia (13h)
  // como amostra de chuva/umidade/vento daquele dia.
  function _pintarTopoClimaParaDia(i) {
    if (!_climaBruto) return;
    var elTemp = document.getElementById('weather-temp');
    if (!elTemp) return;
    var elIcon  = document.getElementById('weather-icon');
    var elCond  = document.getElementById('weather-cond');
    var elMax   = document.getElementById('weather-max');
    var elMin   = document.getElementById('weather-min');
    var elChuva = document.getElementById('weather-rain-prob');
    var elUmid  = document.getElementById('weather-humidity');
    var elVento = document.getElementById('weather-wind');

    if (i === 0) {
      var infoAgora = _weatherInfo(_climaBruto.code, _climaBruto.isDay !== false);
      if (elIcon) { elIcon.className = 'fa ' + infoAgora.ic + ' weather-icon'; elIcon.style.color = infoAgora.col; }
      elTemp.textContent = (_climaBruto.temp != null ? Math.round(_climaBruto.temp) : '--') + '°';
      if (elCond)  elCond.textContent  = infoAgora.txt;
      if (elMax)   elMax.textContent   = (_climaBruto.max != null ? Math.round(_climaBruto.max) : '--') + '°';
      if (elMin)   elMin.textContent   = (_climaBruto.min != null ? Math.round(_climaBruto.min) : '--') + '°';
      if (elChuva) elChuva.textContent = (_climaBruto.chuva   != null ? Math.round(_climaBruto.chuva)   : '--') + '%';
      if (elUmid)  elUmid.textContent  = (_climaBruto.umidade != null ? Math.round(_climaBruto.umidade) : '--') + '%';
      if (elVento) elVento.textContent = (_climaBruto.vento   != null ? Math.round(_climaBruto.vento)   : '--') + ' km/h';
      _pintarSugestaoDoDia(_climaBruto.code, _climaBruto.temp, _climaBruto.chuva, _climaBruto.isDay !== false);
      return;
    }

    var dia = _climaBruto.semana && _climaBruto.semana[i];
    if (!dia) return;
    var info = _weatherInfo(dia.code, true); // dias futuros: sempre ícone diurno
    if (elIcon) { elIcon.className = 'fa ' + info.ic + ' weather-icon'; elIcon.style.color = info.col; }
    elTemp.textContent = (dia.max != null ? Math.round(dia.max) : '--') + '°';
    if (elCond) elCond.textContent = info.txt;
    if (elMax)  elMax.textContent  = (dia.max != null ? Math.round(dia.max) : '--') + '°';
    if (elMin)  elMin.textContent  = (dia.min != null ? Math.round(dia.min) : '--') + '°';

    var pontos  = (_climaBruto.pontosPorDia && _climaBruto.pontosPorDia[i]) || [];
    var meioDia = pontos[4] || pontos[Math.floor(pontos.length / 2)] || null; // 13h (índice 4 dos 8 pontos)
    if (elChuva) elChuva.textContent = (meioDia && meioDia.chuva   != null ? Math.round(meioDia.chuva)   : '--') + '%';
    if (elUmid)  elUmid.textContent  = (meioDia && meioDia.umidade != null ? Math.round(meioDia.umidade) : '--') + '%';
    if (elVento) elVento.textContent = (meioDia && meioDia.vento  != null ? Math.round(meioDia.vento)   : '--') + ' km/h';
    _pintarSugestaoDoDia(dia.code, dia.max, meioDia && meioDia.chuva, true); // dias futuros: sempre ícone/frase diurna
  }

  // Determina a classe CSS de cor do card baseada na condição do tempo
  function _getWeatherCondClass(code, isDay) {
    if (code === 0 || code === 1 || code === 2) return isDay !== false ? 'weather-cond-sunny' : 'weather-cond-night';
    if (code === 3 || code === 45 || code === 48) return 'weather-cond-cloudy';
    if (code >= 51 && code <= 99) return 'weather-cond-rainy';
    return isDay !== false ? 'weather-cond-sunny' : 'weather-cond-night';
  }

  function _pintarClima(d) {
    if (!document.getElementById('weather-temp')) return;
    _climaBruto = d;
    // Fix: antes zerava sempre, mesmo numa revalidação silenciosa em segundo
    // plano (stale-while-revalidate) — se o usuário tinha acabado de tocar
    // noutro dia da tira, o card saltava sozinho de volta pra "Hoje" assim
    // que a resposta chegasse. Só reseta se o dia escolhido não existir mais.
    var _nDiasNovo = (d.semana && d.semana.length) || 1;
    if (_climaDiaSelecionado >= _nDiasNovo) _climaDiaSelecionado = 0;

    // Hide skeleton, show weather card
    var elSkeleton = document.getElementById('weather-skeleton');
    var elCard = document.getElementById('weather-card');
    if (elSkeleton) elSkeleton.style.display = 'none';
    if (elCard) elCard.style.display = 'block';

    // Apply dynamic weather-reactive class
    if (elCard && d.code !== undefined && d.isDay !== undefined) {
      var weatherClass = _getWeatherCondClass(d.code, d.isDay);
      elCard.classList.remove('weather-cond-sunny', 'weather-cond-rainy', 'weather-cond-cloudy', 'weather-cond-night');
      elCard.classList.add(weatherClass);
    }

    _pintarTopoClimaParaDia(_climaDiaSelecionado);
    _pintarAlertaChuva(d.pontosHoje); // sempre relativo a "agora", não ao dia selecionado na tira
    _renderSemanaClima(d.semana);
    _renderGraficoClima(_climaAbaAtual);
  }

  // Dia selecionado na tira semanal (índice em semana/pontosPorDia; 0 = hoje).
  // Clicar num dia troca o card do topo E o gráfico de baixo pra mostrar a
  // previsão daquele dia, igual ao clima do Google.
  var _climaDiaSelecionado = 0;
  function _selecionarDiaClima(i) {
    // Fix A3.6: antes exigia pontosPorDia[i].length pra sequer trocar de
    // dia — um dia sem dado hora a hora fazia o toque parecer que não
    // registrou (chip nem card do topo mudavam). Card do topo só precisa
    // de semana[i] (máx/mín/código); o gráfico trata a falta de pontos
    // sozinho (ver _renderGraficoClima).
    if (!_climaBruto || !_climaBruto.semana || !_climaBruto.semana[i]) return;
    if (_climaDiaSelecionado === i) return;
    _climaDiaSelecionado = i;
    document.querySelectorAll('#weather-week-strip .weather-week-day').forEach(function (el, idx) {
      el.classList.toggle('selecionado', idx === i);
    });
    _pintarTopoClimaParaDia(i);
    _renderGraficoClima(_climaAbaAtual);
  }
  window._selecionarDiaClima = _selecionarDiaClima;

  function _renderSemanaClima(semana) {
    var box = document.getElementById('weather-week-strip');
    if (!box || !Array.isArray(semana) || !semana.length) return;
    box.innerHTML = semana.map(function (dia, i) {
      var info = _weatherInfo(dia.code, true); // previsão de dias futuros: sempre ícone "diurno"
      var sel  = i === _climaDiaSelecionado;
      return '<div class="weather-week-day' + (i === 0 ? ' hoje' : '') + (sel ? ' selecionado' : '') + '" ' +
        'onclick="_selecionarDiaClima(' + i + ')" role="button" tabindex="0" aria-label="Ver previsão de ' + escHTML(dia.nome) + '" ' +
        'onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();_selecionarDiaClima(' + i + ');}">' +
        '<span class="weather-week-day-nome">' + escHTML(dia.nome) + '</span>' +
        '<i class="fa ' + info.ic + ' weather-week-day-ic" style="color:' + info.col + '" aria-hidden="true"></i>' +
        '<span class="weather-week-day-max">' + (dia.max != null ? Math.round(dia.max) : '--') + '°</span>' +
        '<span class="weather-week-day-min">' + (dia.min != null ? Math.round(dia.min) : '--') + '°</span></div>';
    }).join('');
  }

  // Gráfico de linha/área hora a hora do dia selecionado, estilo "Google
  // Clima" — troca de dado conforme a aba ativa (Temperatura/Chuva/Vento)
  // e conforme o dia escolhido na tira semanal (_climaDiaSelecionado).
  function _renderGraficoClima(aba) {
    // Fix A3.8: valida ANTES de gravar em _climaAbaAtual — como a função é
    // exposta em window, um valor inválido envenenava o estado permanente-
    // mente (cfg undefined derrubava esta e toda repintura futura, inclusive
    // a de _pintarClima).
    if (!WEATHER_TAB_CFG[aba]) aba = _climaAbaAtual;
    _climaAbaAtual = aba;
    document.querySelectorAll('.weather-tab').forEach(function (t) {
      t.classList.toggle('active', t.dataset.tab === aba);
    });
    var svg      = document.getElementById('weather-chart-svg');
    var hoursBox = document.getElementById('weather-chart-hours');
    if (!svg) return;
    var pontos   = (_climaBruto && _climaBruto.pontosPorDia) ? (_climaBruto.pontosPorDia[_climaDiaSelecionado] || []) : [];
    if (!pontos.length) {
      // Fix A3.6: sem dado hora a hora pra esse dia — some só o gráfico
      // (em vez de deixar o do dia anterior na tela, parecendo travado).
      svg.setAttribute('viewBox', '0 0 300 84');
      svg.innerHTML = '<text x="150" y="42" text-anchor="middle" class="weather-chart-label">Sem dados hora a hora pra esse dia</text>';
      if (hoursBox) hoursBox.innerHTML = '';
      return;
    }
    var cfg     = WEATHER_TAB_CFG[aba];
    var valores = pontos.map(function (p) { return p[cfg.campo]; });
    var min = Math.min.apply(null, valores), max = Math.max.apply(null, valores);
    if (min === max) { min -= 1; max += 1; }
    var W = 300, H = 62, PAD_TOP = 22, n = pontos.length;
    // Fix A3.7: com n===1, (i/(n-1)) vira 0/0 = NaN e o path some sem erro
    // no console. Hoje inalcançável (sempre 8 pontos por dia), mas qualquer
    // mudança na consulta reabre o caso — divisor nunca fica em 0.
    var divisorX = n > 1 ? (n - 1) : 1;
    var coords = valores.map(function (v, i) {
      return { x: (i / divisorX) * W, y: PAD_TOP + (1 - (v - min) / (max - min)) * H };
    });
    var linePath = coords.map(function (c, i) {
      if (i === 0) return 'M' + c.x + ' ' + c.y;
      var prev = coords[i - 1], midX = (prev.x + c.x) / 2;
      return 'C' + midX + ' ' + prev.y + ',' + midX + ' ' + c.y + ',' + c.x + ' ' + c.y;
    }).join(' ');
    var areaPath = linePath + ' L' + W + ' ' + (PAD_TOP + H) + ' L0 ' + (PAD_TOP + H) + ' Z';
    var rotulos = coords.map(function (c, i) {
      return '<text x="' + c.x + '" y="' + Math.max(9, c.y - 8) + '" text-anchor="middle" class="weather-chart-label">' + Math.round(valores[i]) + cfg.sufixo + '</text>';
    }).join('');
    var pontinhos = coords.map(function (c) {
      return '<circle cx="' + c.x + '" cy="' + c.y + '" r="2.5" fill="' + cfg.cor + '"></circle>';
    }).join('');
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + (PAD_TOP + H));
    svg.innerHTML =
      '<defs><linearGradient id="weatherGrad" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0%" stop-color="' + cfg.cor + '" stop-opacity="0.35"></stop>' +
        '<stop offset="100%" stop-color="' + cfg.cor + '" stop-opacity="0"></stop>' +
      '</linearGradient></defs>' +
      '<path d="' + areaPath + '" fill="url(#weatherGrad)" stroke="none"></path>' +
      '<path d="' + linePath + '" fill="none" stroke="' + cfg.cor + '" stroke-width="2" stroke-linecap="round"></path>' +
      pontinhos + rotulos;
    if (hoursBox) hoursBox.innerHTML = pontos.map(function (p) { return '<span>' + p.hora + '</span>'; }).join('');
  }
  window._renderGraficoClima = _renderGraficoClima; // usado pelo clique nas abas (ver initHomeCarouselSwipe)

  function _carregarClima() {
    var cache = null, ts = 0;
    try {
      cache = JSON.parse(localStorage.getItem(WEATHER_CACHE_KEY) || 'null');
      ts    = parseInt(localStorage.getItem(WEATHER_CACHE_TS_KEY) || '0');
    } catch (e) {}
    // Fix A3.4: stale-while-revalidate de verdade — pinta o cache (fresco
    // OU vencido) na hora, se existir, e SEMPRE dispara o fetch em seguida
    // pra revalidar em segundo plano, repintando quando chegar. Antes,
    // cache fresco pintava e nunca revalidava, e cache vencido não pintava
    // nada até a rede responder — o card ficava vazio durante a latência.
    var fresco = cache && (Date.now() - ts) < WEATHER_CACHE_MS;
    if (cache) _pintarClima(cache);
    if (fresco) return;
    var url = 'https://api.open-meteo.com/v1/forecast?latitude=' + WEATHER_LAT + '&longitude=' + WEATHER_LON +
      '&current=temperature_2m,weather_code,is_day,relative_humidity_2m,wind_speed_10m' +
      '&hourly=temperature_2m,precipitation_probability,wind_speed_10m,weather_code,relative_humidity_2m' +
      '&daily=temperature_2m_max,temperature_2m_min,weather_code' +
      '&timezone=America%2FSao_Paulo&forecast_days=7';
    // AbortSignal.timeout: era o único fetch do app sem timeout — numa rede
    // que aceita conexão mas não responde, a promise ficava pendente por
    // minutos e nem o fallback abaixo entrava em ação (ver A3.2).
    fetch(url, { signal: AbortSignal.timeout(8000) }).then(function (r) { if (!r.ok) throw new Error('weather http ' + r.status); return r.json(); })
      .then(function (j) {
        var d = _montarDadosClima(j);
        if (!d) throw new Error('weather dados incompletos'); // ver A3.5
        try {
          localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(d));
          localStorage.setItem(WEATHER_CACHE_TS_KEY, String(Date.now()));
        } catch (e) {}
        _pintarClima(d);
      })
      .catch(function () {
        // Sem internet (ou Open-Meteo instável): se já tínhamos cache, ele
        // já foi pintado acima — só atualiza o aviso quando esse cache
        // estava vencido (senão o aviso de "sem conexão" apareceria por
        // cima de um dado que ainda estava fresco, ver A3.1).
        if (cache) {
          if (!fresco) {
            var elCond = document.getElementById('weather-cond');
            if (elCond) {
              var hora = new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
              elCond.textContent = 'Previsão de ' + hora + ' — sem conexão para atualizar';
            }
          }
        } else {
          var elCondVazio = document.getElementById('weather-cond');
          if (elCondVazio) elCondVazio.textContent = 'Não foi possível carregar a previsão.';
        }
      });
  }

  function _alternarPrevisaoDetalhada() {
    var extra = document.getElementById('weather-forecast-extra');
    var btn   = document.getElementById('weather-vermais-btn');
    if (!extra) return;
    var aberto = extra.style.display !== 'none';
    extra.style.display = aberto ? 'none' : 'block';
    if (btn) btn.classList.toggle('aberto', !aberto);
    // Se o gráfico já tem dado carregado, garante que ele existe assim que
    // a seção abre (por ex. se o SVG ainda não tinha sido desenhado).
    if (!aberto && _climaBruto) _renderGraficoClima(_climaAbaAtual);
  }

  // Abas Temperatura / Chuva / Vento do gráfico.
  document.querySelectorAll('.weather-tab').forEach(function (tab) {
    tab.addEventListener('click', function () { _renderGraficoClima(tab.dataset.tab); });
  });
  window._alternarPrevisaoDetalhada = _alternarPrevisaoDetalhada;

  /* ── Página 2: "Hoje em Angatuba" (posts locais: avisos/notícias,
     com foto(s) ou vídeo opcionais) ──
     Mostra o MOCK abaixo instantaneamente (sem tela vazia) e, em seguida,
     _carregarAvisosReal() busca os avisos reais na aba "Avisos" do GAS e
     substitui a lista. Se o GAS falhar/estiver offline, o mock some quando
     a resposta chega vazia — fica só o "nenhum aviso por aqui hoje". */
  var AVISOS_HOJE_MOCK = [
    { emoji: '🎪', titulo: 'Feira Livre no Centro', tipo: 'feira', texto: 'Sábado de manhã, na Praça Rui Barbosa.',
      textoCompleto: 'Sábado de manhã, na Praça Rui Barbosa. Produtos frescos direto do produtor: verduras, frutas, queijos e doces caseiros. Chegue cedo pros melhores produtos!',
      criadoEm: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), likes: 0,
      midias: [ { tipo: 'foto', url: '/img/igreja-dia.jpg' }, { tipo: 'foto', url: '/img/igreja-noite.jpg' } ] },
    { emoji: '💉', titulo: 'Campanha de vacinação', tipo: 'oficial', texto: 'Posto de Saúde Central, das 8h às 16h.',
      criadoEm: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(), likes: 0 },
  ];
  window._avisosAtuais = AVISOS_HOJE_MOCK;

  // ── Tipos de post (badge no card + no modal de detalhe) ──
  // Chave sempre sem acento (ex.: "transito") — _normalizarTipoAviso aceita
  // tanto "trânsito" quanto "transito" vindos do GAS/planilha. tipo vazio ou
  // não reconhecido simplesmente não mostra badge (mais limpo que "Geral").
  var TIPOS_AVISO_CFG = {
    evento:   { label: 'Evento',    cor: '#a78bfa' },
    promocao: { label: 'Promoção',  cor: '#34d399' },
    aviso:    { label: 'Aviso',     cor: '#fbbf24' },
    oficial:  { label: 'Oficial',   cor: '#60a5fa' },
    transito: { label: 'Trânsito',  cor: '#f87171' },
    feira:    { label: 'Feira',     cor: '#fb923c' },
    noticia:  { label: 'Notícia',   cor: '#38bdf8' },
    // posts automáticos do Worker de notícias
    novidade: { label: 'Novidade',  cor: '#00d084' },
    jogos:    { label: 'Jogos',     cor: '#a78bfa' },
    clima:    { label: 'Clima',     cor: '#22d3ee' },
  };
  // tipo gravado pelo Worker → tipo do badge acima
  var TIPO_POST_WORKER = { noticia: 'noticia', loja: 'novidade', jogos: 'jogos', clima: 'clima' };
  function _normalizarTipoAviso(tipo) {
    var s = String(tipo || '').trim().toLowerCase();
    return s.normalize ? s.normalize('NFD').replace(/[\u0300-\u036f]/g, '') : s;
  }
  function _infoTipoAviso(tipo) {
    return TIPOS_AVISO_CFG[_normalizarTipoAviso(tipo)] || null;
  }
  function _badgeTipoAvisoHtml(tipo) {
    var info = _infoTipoAviso(tipo);
    if (!info) return '';
    return '<span class="aviso-badge" style="color:' + info.cor + ';border-color:' + info.cor + '55;background:' + info.cor + '1f;">' +
      _escHtmlAviso(info.label) + '</span>';
  }

  // ── Horário relativo do post ("agora", "há 12 min", "ontem"...) ──
  function _tempoRelativoAviso(dataStr) {
    if (!dataStr) return '';
    var d = new Date(dataStr);
    if (isNaN(d.getTime())) return '';
    var agora = new Date();
    var diffMin = Math.floor((agora - d) / 60000);
    if (diffMin < 0) diffMin = 0;
    if (diffMin < 1) return 'agora';
    if (diffMin < 60) return 'há ' + diffMin + ' min';
    var diffH = Math.floor(diffMin / 60);
    if (diffH <= 6) return 'há ' + diffH + ' h';
    var hojeStr  = _horaLocalStr(agora).slice(0, 10);
    var dataCiv  = _horaLocalStr(d).slice(0, 10);
    if (dataCiv === hojeStr) return 'hoje às ' + d.getHours() + 'h';
    var ontem = new Date(agora); ontem.setDate(ontem.getDate() - 1);
    if (dataCiv === _horaLocalStr(ontem).slice(0, 10)) return 'ontem';
    var diffDias = Math.round((new Date(hojeStr) - new Date(dataCiv)) / 86400000);
    if (diffDias < 7) return 'há ' + diffDias + ' dias';
    return _p2(d.getDate()) + '/' + _p2(d.getMonth() + 1);
  }
  function _dataCompletaAviso(dataStr) {
    if (!dataStr) return '';
    var d = new Date(dataStr);
    if (isNaN(d.getTime())) return '';
    return _p2(d.getDate()) + '/' + _p2(d.getMonth() + 1) + '/' + d.getFullYear() + ' às ' + _p2(d.getHours()) + 'h' + _p2(d.getMinutes());
  }

  // Busca os avisos reais no GAS (aba "Avisos"). Só cai no mock se a busca
  // falhar de verdade (erro/timeout/offline) — não mostra mais o mock como
  // "placeholder" que depois some sozinho, pra não parecer bug pro usuário.
  function _carregarAvisosReal(forcarNoticias) {
    var params = new URLSearchParams();
    params.append('payload', JSON.stringify({ action: 'avisosListar' }));
    var avisosGas = fetch(APPS_SCRIPT_URL, { method: 'POST', body: params, signal: AbortSignal.timeout(10000) })
      .then(function (r) { return r.json(); })
      .then(function (json) { return (json && json.status === 'ok' && Array.isArray(json.data)) ? json.data : null; })
      .catch(function () { return null; });
    // Notícias aprovadas (Worker angatubaon-noticias) — falhar aqui nunca
    // derruba os avisos: no pior caso a lista sai só com os do GAS.
    Promise.all([avisosGas, _carregarNoticiasPublicadas(forcarNoticias === true)]).then(function (res) {
      var avisos = res[0], noticias = res[1];
      if (!avisos && !noticias.length) { _renderAvisosHoje(AVISOS_HOJE_MOCK); return; }
      // Notícias entram na linha do tempo pela data de publicação, misturadas
      // com os avisos (sort estável: a ordem do GAS entre si não muda).
      var lista = (avisos || []).concat(noticias);
      if (noticias.length) {
        lista.sort(function (a, b) {
          return (new Date(b.criadoEm || b.data || 0).getTime() || 0) - (new Date(a.criadoEm || a.data || 0).getTime() || 0);
        });
      }
      _renderAvisosHoje(lista);
    });
  }

  /* Lê as notícias com status "publicado" direto do Firestore pela API
     REST (sem carregar o SDK do Firestore só pra isso). As regras só
     deixam ler o que está publicado; o Worker tira do ar sozinho o que
     passa de 7 dias. Cada notícia vira um "aviso" com a imagem do post
     como mídia — reaproveita card, modal, curtir e compartilhar.
     Cada consulta custa até 10 leituras do Firestore e rodava a cada
     visita à página: agora fica 15 min guardada no aparelho (o
     puxar-pra-atualizar ignora o cache). Saem no máx. 2 posts por dia,
     então 15 min de atraso não fazem diferença. */
  var NOTICIAS_CACHE_KEY = 'angatuba_noticias_cache_v1';
  var NOTICIAS_CACHE_MS = 15 * 60000;
  function _carregarNoticiasPublicadas(forcar) {
    if (!forcar) {
      try {
        var c = JSON.parse(localStorage.getItem(NOTICIAS_CACHE_KEY) || 'null');
        var idade = c ? Date.now() - c.em : Infinity;
        if (c && Array.isArray(c.lista) && idade >= 0 && idade < NOTICIAS_CACHE_MS) {
          return Promise.resolve(c.lista.filter(function (n) { return !n.expiraEm || new Date(n.expiraEm).getTime() >= Date.now(); }));
        }
      } catch (e) {}
    }
    var url = 'https://firestore.googleapis.com/v1/projects/' + _fbConfig.projectId +
      '/databases/(default)/documents:runQuery?key=' + encodeURIComponent(_fbConfig.apiKey);
    var corpo = { structuredQuery: {
      from: [{ collectionId: 'noticias' }],
      where: { fieldFilter: { field: { fieldPath: 'status' }, op: 'EQUAL', value: { stringValue: 'publicado' } } },
      limit: 10,
    } };
    var ok = false;
    return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo), signal: AbortSignal.timeout(6000) })
      .then(function (r) { ok = r.ok; return r.ok ? r.json() : []; })
      .then(function (linhas) {
        var lista = (Array.isArray(linhas) ? linhas : []).filter(function (l) { return l && l.document; }).map(function (l) {
          var f = l.document.fields || {};
          var txt = function (k) { return (f[k] && (f[k].stringValue || f[k].timestampValue)) || ''; };
          var img = txt('imagemUrl');
          // alerta de clima vale só no dia: some sozinho mesmo antes do Worker arquivar
          var expira = txt('expiraEm');
          if (expira && new Date(expira).getTime() < Date.now()) return null;
          return {
            nid: l.document.name.split('/').pop(),
            emoji: txt('emoji') || '📰', tipo: TIPO_POST_WORKER[txt('tipo')] || 'noticia',
            titulo: txt('titulo'), texto: txt('texto'),
            criadoEm: txt('publicadoEm'), likes: 0,
            fonteNome: txt('fonteNome'), fonteUrl: txt('fonteUrl'),
            rodapeCard: txt('rodapeCard'), linkUrl: txt('linkUrl'), linkTexto: txt('linkTexto'),
            midias: /^https:\/\/res\.cloudinary\.com\//.test(img) ? [{ tipo: 'foto', url: img }] : [],
            expiraEm: expira || '',
          };
        }).filter(function (n) { return n && n.titulo; });
        // Só guarda resposta boa (erro/offline tenta de novo na próxima visita).
        if (ok) { try { localStorage.setItem(NOTICIAS_CACHE_KEY, JSON.stringify({ em: Date.now(), lista: lista })); } catch (e) {} }
        return lista;
      })
      .catch(function () { return []; });
  }
  window._carregarAvisosReal = _carregarAvisosReal;

  function _escHtmlAviso(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function _renderAvisosHoje(lista) {
    var box = document.getElementById('avisos-list');
    var skeleton = document.getElementById('avisos-skeleton');
    if (!box) return;

    // Hide skeleton, show avisos list
    if (skeleton) skeleton.style.display = 'none';
    if (box) box.style.display = 'flex';

    var dados = lista || AVISOS_HOJE_MOCK;
    window._avisosAtuais = dados; // referência usada pelo modal de post (_abrirAvisoPost)
    if (!dados || !dados.length) {
      box.innerHTML = '<div class="avisos-empty"><img src="/webp/owl-empty.webp" alt="" class="avisos-empty-owl" onerror="this.style.display=\'none\'">Nenhum aviso por aqui hoje. Volte mais tarde!</div>';
      return;
    }
    var curtidos = _avisosCurtidosGet();
    box.innerHTML = dados.map(function (a, i) {
      var midias = Array.isArray(a.midias) ? a.midias : [];
      var capa = midias.length && midias[0].tipo !== 'video' ? midias[0].url : (midias.length ? null : null);
      var mediaHtml = '';
      if (midias.length) {
        // Foto: toque simples não faz nada (estilo Instagram); vídeo: toca
        // sozinho, mudo, quando entra na tela (ver _avisoInitVideoObserver)
        // — não precisa de toque nenhum pra começar. Duplo toque em
        // qualquer uma das duas sempre curte, nunca descurte (ver
        // _avisoDuploCliqueMedia).
        var primeira = midias[0];
        var ehVideo = primeira.tipo === 'video';
        var capaBg = ehVideo ? '' : ('background-image:url(\'' + primeira.url + '\');');
        mediaHtml = '<div class="aviso-card-media" ondblclick="_avisoDuploCliqueMedia(' + i + ', event)" style="' + capaBg + '">' +
          (ehVideo
            ? '<video class="aviso-card-video" data-aviso-idx="' + i + '" src="' + primeira.url + '" muted playsinline webkit-playsinline loop preload="metadata" style="width:100%;height:100%;object-fit:cover;"></video>' +
              '<button type="button" class="aviso-video-som-btn" data-aviso-idx="' + i + '" aria-label="Ativar som" onclick="event.stopPropagation();_avisoAlternarSom(' + i + ', event)"><i class="ti ti-volume-off" aria-hidden="true"></i></button>'
            : '') +
          (midias.length > 1 ? '<span class="aviso-card-media-count"><i class="fa fa-images" aria-hidden="true"></i> ' + midias.length + '</span>' : '') +
          '</div>';
      }
      // Editar/apagar só existem para avisos reais (com id do GAS) — os do
      // mock inicial não têm id, então não mostram esses botões.
      var adminHtml = a.id
        ? '<div class="aviso-card-admin" onclick="event.stopPropagation()">' +
          '<button type="button" class="aviso-card-admin-btn" onclick="event.stopPropagation();_abrirEditorAviso(\'' + a.id + '\')" aria-label="Editar aviso"><i class="fa fa-pen" aria-hidden="true"></i></button>' +
          '<button type="button" class="aviso-card-admin-btn aviso-card-admin-btn-del" onclick="event.stopPropagation();_apagarAviso(\'' + a.id + '\')" aria-label="Apagar aviso"><i class="fa fa-trash" aria-hidden="true"></i></button>' +
          '</div>'
        : '';
      var tempoRel = _tempoRelativoAviso(a.criadoEm || a.data);
      // Curtir/compartilhar — mesmo índice "i" usado no modal, pra manter os
      // dois em sincronia (ver data-aviso-idx / _avisoAtualizarUiLike).
      var likes = a.likes || 0;
      var curtido = curtidos.indexOf(_avisoChaveCurtida(a, i)) !== -1;
      var acoesHtml = '<div class="aviso-actions" onclick="event.stopPropagation()">' +
        '<button type="button" class="aviso-like-btn' + (curtido ? ' is-liked' : '') + '" data-aviso-idx="' + i + '" aria-pressed="' + (curtido ? 'true' : 'false') + '" aria-label="Curtir" onclick="_avisoToggleLike(' + i + ', event)"><i class="' + (curtido ? 'fa-solid fa-heart' : 'fa-regular fa-heart') + '" aria-hidden="true"></i></button>' +
        '<span class="aviso-like-count" data-aviso-idx="' + i + '">' + (likes > 0 ? likes : '') + '</span>' +
        '<button type="button" class="aviso-share-btn" aria-label="Compartilhar" onclick="_avisoCompartilhar(' + i + ', event)"><i class="fa fa-share-nodes" aria-hidden="true"></i></button>' +
        '</div>';
      // Sem mídia, o card inteiro continua abrindo o detalhe no toque (não
      // tem mídia pra tocar); com mídia, só a própria mídia reage ao toque —
      // ver mediaHtml acima. Isso evita abrir o modal sem querer ao tocar
      // no título/texto do post. Por teclado, os dois casos abrem o post —
      // sem isso, um post com foto/vídeo (toque simples = no-op) não tinha
      // NENHUMA forma de abrir o detalhe sem mouse/toque. O
      // "event.target===event.currentTarget" evita que Enter num botão
      // filho (curtir, compartilhar, editar) borbulhe e abra o modal junto.
      var cardKeydown = 'if((event.key===\'Enter\'||event.key===\' \')&&event.target===event.currentTarget){event.preventDefault();_abrirAvisoPost(' + i + ');}';
      var cardAttrs = midias.length
        ? ' role="button" tabindex="0" aria-label="Abrir publicação" onkeydown="' + cardKeydown + '"'
        : ' onclick="_abrirAvisoPost(' + i + ')" role="button" tabindex="0" onkeydown="' + cardKeydown + '"';
      return '<div class="aviso-card' + (midias.length ? ' aviso-card--com-midia' : '') + '"' + cardAttrs + '>' +
        mediaHtml + adminHtml +
        '<div class="aviso-card-body"><span class="aviso-emoji">' + _escHtmlAviso(a.emoji || '📌') + '</span>' +
        '<div class="aviso-txt"><div class="aviso-txt-head"><strong>' + _escHtmlAviso(a.titulo) + '</strong>' + _badgeTipoAvisoHtml(a.tipo) + '</div>' +
        (tempoRel ? '<span class="aviso-tempo">' + _escHtmlAviso(tempoRel) + '</span>' : '') +
        // Notícia: título e resumo já estão desenhados na imagem — embaixo
        // vai só o crédito, pra não repetir o mesmo texto duas vezes.
        '<span class="aviso-desc">' + _escHtmlAviso(a.nid ? (a.rodapeCard || (a.fonteNome ? 'Fonte: ' + a.fonteNome : a.texto)) : a.texto) + '</span></div></div>' +
        acoesHtml + '</div>';
    }).join('');
    _avisoInitVideoObserver();
    _avisoTentarAbrirDeepLink();
  }
  window._renderAvisosHoje = _renderAvisosHoje; // exposto p/ o futuro fetch no GAS chamar direto

  /* ── Modal de post: abre ao tocar num card de "Hoje em Angatuba".
     Mostra o texto completo e, se houver, um carrossel de fotos/vídeos
     (mesmo padrão de swipe do carrossel da home). ── */
  var _avisoPostIdx = 0;
  var _avisoPostMidias = [];

  function _abrirAvisoPost(idx) {
    var lista = window._avisosAtuais || AVISOS_HOJE_MOCK;
    var aviso = lista[idx];
    var overlay = document.getElementById('aviso-post-overlay');
    if (!aviso || !overlay) return;

    document.getElementById('aviso-post-emoji').textContent  = aviso.emoji || '📌';
    document.getElementById('aviso-post-titulo').textContent = aviso.titulo || '';
    document.getElementById('aviso-post-texto').textContent  = aviso.textoCompleto || aviso.texto || '';

    var elBadge = document.getElementById('aviso-post-badge');
    if (elBadge) {
      var infoTipo = _infoTipoAviso(aviso.tipo);
      if (infoTipo) {
        elBadge.textContent = infoTipo.label;
        elBadge.style.color = infoTipo.cor;
        elBadge.style.borderColor = infoTipo.cor + '55';
        elBadge.style.background = infoTipo.cor + '1f';
        elBadge.style.display = 'inline-flex';
      } else {
        elBadge.style.display = 'none';
      }
    }
    var elData = document.getElementById('aviso-post-data');
    if (elData) {
      var dataCompleta = _dataCompletaAviso(aviso.criadoEm || aviso.data);
      elData.textContent = dataCompleta;
      elData.style.display = dataCompleta ? 'block' : 'none';
    }
    // Notícia: crédito + link pra matéria original
    // Notícia: link pra matéria original. Post automático: link interno
    // (loja nova → abre a loja; campeões → abre os jogos), sem sair do app.
    var elFonte = document.getElementById('aviso-post-fonte');
    if (elFonte) {
      var linkPost = aviso.fonteUrl || aviso.linkUrl || '';
      var temFonte = /^https:\/\//.test(linkPost);
      elFonte.style.display = temFonte ? 'inline-flex' : 'none';
      elFonte.onclick = null;
      if (temFonte) {
        var interno = linkPost.indexOf(location.origin + '/') === 0 || linkPost.indexOf('https://angatubaon.com.br/') === 0;
        elFonte.href = linkPost;
        elFonte.target = interno ? '' : '_blank';
        elFonte.querySelector('span').textContent = aviso.linkTexto || ('Ler na fonte: ' + (aviso.fonteNome || 'notícia original'));
        if (interno) {
          elFonte.onclick = function (e) {
            e.preventDefault();
            var u = new URL(linkPost);
            _fecharAvisoPost();
            // espera o history.back() do fechamento antes de navegar
            setTimeout(function () {
              if (u.hash) location.hash = u.hash;
              else if (typeof _fcmAbrirDestino === 'function') _fcmAbrirDestino(linkPost);
            }, 350);
          };
        }
      }
    }

    var mediaWrap = document.getElementById('aviso-post-media-wrap');
    var track     = document.getElementById('aviso-post-media-track');
    var dotsBox   = document.getElementById('aviso-post-media-dots');
    _avisoPostMidias = Array.isArray(aviso.midias) ? aviso.midias : [];

    if (_avisoPostMidias.length) {
      mediaWrap.style.display = 'block';
      track.innerHTML = _avisoPostMidias.map(function (m) {
        return m.tipo === 'video'
          ? '<div class="aviso-post-slide"><video src="' + m.url + '" controls playsinline></video></div>'
          : '<div class="aviso-post-slide"><img src="' + m.url + '" alt="" /></div>';
      }).join('');
      dotsBox.style.display = _avisoPostMidias.length > 1 ? 'flex' : 'none';
      dotsBox.innerHTML = _avisoPostMidias.length > 1
        ? _avisoPostMidias.map(function (_, i) { return '<span class="aviso-post-dot' + (i === 0 ? ' active' : '') + '" data-idx="' + i + '"></span>'; }).join('')
        : '';
      _avisoPostIdx = 0;
      track.style.transition = 'none';
      track.style.transform  = 'translateX(0%)';
    } else {
      mediaWrap.style.display = 'none';
      track.innerHTML = '';
    }

    var likeBtn   = document.getElementById('aviso-post-like-btn');
    var likeCount = document.getElementById('aviso-post-like-count');
    var shareBtn  = document.getElementById('aviso-post-share-btn');
    var curtidoAtual = _avisosCurtidosGet().indexOf(_avisoChaveCurtida(aviso, idx)) !== -1;
    if (likeBtn) {
      likeBtn.dataset.avisoIdx = idx;
      likeBtn.classList.toggle('is-liked', curtidoAtual);
      likeBtn.setAttribute('aria-pressed', curtidoAtual ? 'true' : 'false');
      var icoLikePost = likeBtn.querySelector('i');
      if (icoLikePost) icoLikePost.className = curtidoAtual ? 'fa-solid fa-heart' : 'fa-regular fa-heart';
      likeBtn.onclick = function (e) { e.stopPropagation(); _avisoToggleLike(idx, e); };
    }
    if (likeCount) {
      likeCount.dataset.avisoIdx = idx;
      likeCount.textContent = aviso.likes > 0 ? String(aviso.likes) : '';
    }
    if (shareBtn) shareBtn.onclick = function (e) { e.stopPropagation(); _avisoCompartilhar(idx, e); };

    // Fix: pausa os vídeos do feed antes de abrir o modal — sem isso, um
    // vídeo do feed tocando (com som) continuava atrás do overlay e tocava
    // junto com o vídeo do modal.
    document.querySelectorAll('.aviso-card-video').forEach(function (v) { v.pause(); });

    overlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    if (history.state?.modal !== 'aviso-post') history.pushState({ modal: 'aviso-post' }, '');
  }
  window._abrirAvisoPost = _abrirAvisoPost;

  function _fecharAvisoPost(viaPopstate) {
    var overlay = document.getElementById('aviso-post-overlay');
    if (overlay) overlay.style.display = 'none';
    // Fix: display:none não pausa <video> — o vídeo do modal continuava
    // tocando (com som) escondido atrás do overlay fechado. Pausa e
    // esvazia o track (libera o buffer) e reobserva o feed pra retomar o
    // que estiver visível (o vídeo do feed foi pausado ao abrir, ver
    // _abrirAvisoPost).
    var track = document.getElementById('aviso-post-media-track');
    if (track) {
      track.querySelectorAll('video').forEach(function (v) { try { v.pause(); } catch (e) {} });
      track.innerHTML = '';
    }
    document.body.style.overflow = '';
    if (!viaPopstate && history.state?.modal === 'aviso-post') { _popstateNosso = true; history.back(); }
    _avisoInitVideoObserver();
  }
  window._fecharAvisoPost = _fecharAvisoPost;

  function _irParaMediaPost(idx) {
    var track = document.getElementById('aviso-post-media-track');
    if (!track || !_avisoPostMidias.length) return;
    idx = Math.max(0, Math.min(idx, _avisoPostMidias.length - 1));
    _avisoPostIdx = idx;
    track.style.transition = 'transform 0.3s cubic-bezier(0.32,0.72,0,1)';
    track.style.transform  = 'translateX(-' + (idx * 100) + '%)';
    document.querySelectorAll('.aviso-post-dot').forEach(function (d, i) {
      d.classList.toggle('active', i === idx);
    });
  }

  (function initAvisoPostSwipe() {
    var wrap = document.getElementById('aviso-post-media-wrap');
    if (!wrap) return;
    var startX = 0, startY = 0, dragging = false, isHoriz = null;
    wrap.addEventListener('touchstart', function (e) {
      startX = e.touches[0].clientX; startY = e.touches[0].clientY;
      dragging = true; isHoriz = null;
    }, { passive: true });
    wrap.addEventListener('touchmove', function (e) {
      if (!dragging) return;
      var dx = e.touches[0].clientX - startX;
      var dy = e.touches[0].clientY - startY;
      if (isHoriz === null) isHoriz = Math.abs(dx) > Math.abs(dy);
      if (isHoriz) e.preventDefault();
    }, { passive: false });
    wrap.addEventListener('touchend', function (e) {
      if (!dragging || !isHoriz) { dragging = false; return; }
      var dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 40) {
        if (dx < 0) _irParaMediaPost(_avisoPostIdx + 1);
        else        _irParaMediaPost(_avisoPostIdx - 1);
      }
      dragging = false;
    });
    wrap.addEventListener('click', function (e) {
      var dot = e.target.closest('.aviso-post-dot');
      if (dot) _irParaMediaPost(+dot.dataset.idx);
    });
  })();

  /* ── Curtidas + compartilhar em "Hoje em Angatuba" ──
     Sem login: 1 curtida por dispositivo, via um deviceId estável salvo no
     localStorage (mesmo padrão do sid de avaliações). Otimista na tela
     (o coração já muda na hora) e confirmado no GAS, que também guarda a
     lista de deviceIds na planilha (não depende só do localStorage do
     cliente pra não deixar curtir várias vezes trocando de navegador).
     Compartilhar usa Web Share API com fallback de copiar link — mesmo
     padrão do detalhesCompartilhar() das lojas. ── */
  function _avisoDeviceId() {
    try {
      var id = localStorage.getItem('angatuba_device_id');
      if (!id) {
        id = 'dev_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
        localStorage.setItem('angatuba_device_id', id);
      }
      return id;
    } catch (e) { return 'dev_temp_' + Math.random().toString(36).slice(2, 10); }
  }
  function _avisosCurtidosGet() {
    try {
      var lista = JSON.parse(localStorage.getItem('angatuba_avisos_curtidos') || '[]');
      return Array.isArray(lista) ? lista : [];
    } catch (e) { return []; }
  }
  function _avisosCurtidosSet(lista) {
    try { localStorage.setItem('angatuba_avisos_curtidos', JSON.stringify(lista)); } catch (e) {}
  }
  // Posts do mock (sem id do GAS) usam o índice como chave local — dá pra
  // curtir na hora (só não persiste no servidor, não tem o que salvar).
  function _avisoChaveCurtida(aviso, idx) {
    if (aviso && aviso.id) return aviso.id;
    if (aviso && aviso.nid) return 'n_' + aviso.nid; // notícia: curtida só local (não há GAS pra persistir)
    return 'm' + idx;
  }

  // Atualiza o coração + contador em todo lugar que o post aparece (card da
  // lista e modal de detalhe), sem precisar re-renderizar a lista inteira.
  function _avisoAtualizarUiLike(idx, likes, curtido, animar) {
    document.querySelectorAll('.aviso-like-btn[data-aviso-idx="' + idx + '"]').forEach(function (btn) {
      btn.classList.toggle('is-liked', curtido);
      btn.setAttribute('aria-pressed', curtido ? 'true' : 'false');
      var ico = btn.querySelector('i');
      if (ico) {
        ico.className = curtido ? 'fa-solid fa-heart' : 'fa-regular fa-heart';
        if (animar) {
          ico.classList.remove('aviso-like-pop');
          void ico.offsetWidth; // força reflow pra reiniciar a animação
          ico.classList.add('aviso-like-pop');
        }
      }
    });
    document.querySelectorAll('.aviso-like-count[data-aviso-idx="' + idx + '"]').forEach(function (el) {
      el.textContent = likes > 0 ? String(likes) : '';
    });
  }

  function _avisoToggleLike(idx, ev) {
    if (ev) { ev.stopPropagation(); ev.preventDefault(); }
    var lista = window._avisosAtuais || AVISOS_HOJE_MOCK;
    var aviso = lista[idx];
    if (!aviso) return;
    var chave       = _avisoChaveCurtida(aviso, idx);
    var curtidos    = _avisosCurtidosGet();
    var jaCurtiu    = curtidos.indexOf(chave) !== -1;
    var novoCurtido = !jaCurtiu;
    var likesAntes  = aviso.likes || 0;
    var likesNovos  = novoCurtido ? likesAntes + 1 : Math.max(0, likesAntes - 1);

    // Otimista: muda na tela e salva local antes de esperar o servidor.
    aviso.likes = likesNovos;
    if (novoCurtido) curtidos.push(chave); else curtidos.splice(curtidos.indexOf(chave), 1);
    _avisosCurtidosSet(curtidos);
    _avisoAtualizarUiLike(idx, likesNovos, novoCurtido, true);

    if (!aviso.id) return; // post do mock (sem id) — nada pra persistir no GAS

    var params = new URLSearchParams();
    params.append('payload', JSON.stringify({ action: 'avisosCurtir', id: aviso.id, deviceId: _avisoDeviceId(), curtir: novoCurtido }));
    fetch(APPS_SCRIPT_URL, { method: 'POST', body: params, signal: AbortSignal.timeout(10000) })
      .then(function (r) { return r.json(); })
      .then(function (json) {
        if (!json || json.status !== 'ok') throw new Error((json && json.msg) || 'Erro ao curtir');
        // Confirma com o valor real do servidor (evita desalinhar se outro
        // dispositivo curtiu no mesmo instante).
        aviso.likes = json.data.likes;
        _avisoAtualizarUiLike(idx, json.data.likes, novoCurtido, false);
      })
      .catch(function () {
        // Falhou: desfaz o otimismo.
        aviso.likes = likesAntes;
        var curtidosAtuais = _avisosCurtidosGet();
        var i2 = curtidosAtuais.indexOf(chave);
        if (novoCurtido && i2 !== -1) curtidosAtuais.splice(i2, 1);
        else if (!novoCurtido && i2 === -1) curtidosAtuais.push(chave);
        _avisosCurtidosSet(curtidosAtuais);
        _avisoAtualizarUiLike(idx, likesAntes, jaCurtiu, false);
        mlToast('Não foi possível curtir agora.', 'erro');
      });
  }
  window._avisoToggleLike = _avisoToggleLike;

  function _avisoCompartilhar(idx, ev) {
    if (ev) { ev.stopPropagation(); ev.preventDefault(); }
    var lista = window._avisosAtuais || AVISOS_HOJE_MOCK;
    var aviso = lista[idx];
    if (!aviso) return;
    var url    = aviso.id ? (location.origin + '/?post=' + encodeURIComponent(aviso.id))
               : aviso.nid ? (location.origin + '/?post=n_' + encodeURIComponent(aviso.nid))
               : (location.origin + '/');
    var titulo = aviso.titulo || 'Hoje em Angatuba';
    var texto  = aviso.texto || aviso.textoCompleto || '';

    if (navigator.share) {
      navigator.share({ title: titulo, text: texto, url: url }).catch(function () {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(function () {
        var t = document.getElementById('toast');
        _setToastOwl('/webp/owl-tada.webp');
        document.getElementById('toast-title').textContent = 'Link copiado!';
        document.getElementById('toast-msg').textContent   = url;
        clearTimeout(toastTimer);
        t.classList.add('show');
        toastTimer = setTimeout(hideToast, 2500);
      }).catch(function () {});
    }
  }
  window._avisoCompartilhar = _avisoCompartilhar;

  /* ── Toque na mídia do card (estilo Instagram) ──
     Foto: toque simples não faz nada. Vídeo toca sozinho (ver
     _avisoInitVideoObserver logo abaixo) — não depende de toque nenhum.
     Duplo toque em qualquer uma das duas sempre curte (nunca descurte —
     descurtir é só pelo botão de coração embaixo), com o coração grande
     "estourando" no meio da mídia. ── */
  function _avisoDuploCliqueMedia(idx, ev) {
    if (ev) { ev.stopPropagation(); ev.preventDefault(); }
    var mediaEl = ev && ev.currentTarget;
    var lista = window._avisosAtuais || AVISOS_HOJE_MOCK;
    var aviso = lista[idx];
    if (!aviso) return;
    if (mediaEl) _avisoMostrarCoracaoBurst(mediaEl);
    var jaCurtiu = _avisosCurtidosGet().indexOf(_avisoChaveCurtida(aviso, idx)) !== -1;
    if (!jaCurtiu) _avisoToggleLike(idx); // duplo toque só curte, nunca descurte
  }
  window._avisoDuploCliqueMedia = _avisoDuploCliqueMedia;

  // Cria e anima o coraçãozão que "estoura" no meio da mídia ao dar duplo
  // toque (some sozinho em seguida) — puramente visual, criado sob demanda
  // pra não precisar de um elemento extra parado em cada card.
  function _avisoMostrarCoracaoBurst(mediaEl) {
    try {
      var burst = document.createElement('i');
      burst.className = 'fa-solid fa-heart aviso-heart-burst';
      burst.setAttribute('aria-hidden', 'true');
      mediaEl.appendChild(burst);
      burst.addEventListener('animationend', function () { burst.remove(); });
      setTimeout(function () { if (burst.parentNode) burst.remove(); }, 900);
    } catch (e) {}
  }

  /* ── Vídeo do feed toca/pausa sozinho conforme entra/sai da tela (estilo
     Instagram — nunca abre modal pra isso) e só 1 vídeo por vez fica com
     som. Reobservado a cada _renderAvisosHoje (os <video> são recriados no
     innerHTML) e ao voltar de uma aba escondida (o pause por
     visibilitychange não é desfeito sozinho — precisa reobservar pra
     retomar o que estiver visível). ── */
  var _avisoVideoObserver = null;

  function _avisoInitVideoObserver() {
    if (_avisoVideoObserver) _avisoVideoObserver.disconnect();
    if (typeof IntersectionObserver === 'undefined') return; // navegador sem suporte: vídeo só fica parado no frame, sem quebrar o resto
    _avisoVideoObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var video = entry.target;
        if (document.hidden) return; // aba escondida: quem cuida é o visibilitychange
        // Fix: em viewport baixa (celular deitado, janela de desktop baixa),
        // a mídia (até 620px de altura) nunca alcança 60% de interseção
        // mesmo ocupando a tela inteira — o limiar cai pra 0.3 quando a
        // mídia é claramente maior que a área visível.
        var alturaRoot = (entry.rootBounds && entry.rootBounds.height) || window.innerHeight;
        var midiaMaiorQueTela = entry.boundingClientRect.height > alturaRoot * 0.8;
        var limiar = midiaMaiorQueTela ? 0.3 : 0.6;
        if (entry.isIntersecting && entry.intersectionRatio >= limiar) {
          video.play().catch(function () {}); // autoplay pode ser recusado silenciosamente — sem problema, fica parado
        } else {
          video.pause();
        }
      });
    }, { threshold: [0, 0.3, 0.6, 1] });
    document.querySelectorAll('.aviso-card-video').forEach(function (v) { _avisoVideoObserver.observe(v); });
  }
  window._avisoInitVideoObserver = _avisoInitVideoObserver;

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      document.querySelectorAll('.aviso-card-video').forEach(function (v) { v.pause(); });
    } else {
      _avisoInitVideoObserver(); // reobserva: retoma o que estiver visível agora
    }
  });

  // Botão de som do vídeo (mesmo ícone/estilo do anúncio de loja). Só um
  // vídeo do feed toca com som por vez — desmutar um muta todos os outros.
  function _avisoAlternarSom(idx, ev) {
    if (ev) { ev.stopPropagation(); ev.preventDefault(); }
    var video = document.querySelector('.aviso-card-video[data-aviso-idx="' + idx + '"]');
    if (!video) return;
    var estavaMudo = video.muted;
    document.querySelectorAll('.aviso-card-video').forEach(function (v) {
      if (v !== video && !v.muted) { v.muted = true; _avisoAtualizarIconeSom(v); }
    });
    video.muted = !estavaMudo;
    _avisoAtualizarIconeSom(video);
    // Fix: desmutar um vídeo fora da tela (pausado) deixava ele mudo=false
    // mas parado — o áudio pegava o usuário de surpresa, em volume total,
    // só quando ele rolasse até o vídeo depois. Retoma junto.
    if (!video.muted && video.paused) video.play().catch(function () {});
  }
  window._avisoAlternarSom = _avisoAlternarSom;

  function _avisoAtualizarIconeSom(video) {
    var btn = document.querySelector('.aviso-video-som-btn[data-aviso-idx="' + video.dataset.avisoIdx + '"]');
    if (!btn) return;
    var ico = btn.querySelector('i');
    if (ico) ico.className = video.muted ? 'ti ti-volume-off' : 'ti ti-volume';
    btn.setAttribute('aria-label', video.muted ? 'Ativar som' : 'Desativar som');
  }

  // ── Deep link do post (?post=ID ou #aviso=ID) — abre o modal do post
  //    automaticamente assim que ele aparecer na lista carregada do GAS.
  //    "Consome" o link uma única vez (não reabre de novo em navegações
  //    seguintes dentro da mesma sessão). ──
  var _avisoDeepLinkId = (function () {
    try {
      var porQuery = new URLSearchParams(location.search).get('post');
      if (porQuery) return porQuery;
      var m = /(?:^|[?&#])aviso=([^&]+)/.exec(location.hash || '');
      return m ? decodeURIComponent(m[1]) : null;
    } catch (e) { return null; }
  })();
  if (_avisoDeepLinkId) _homePaginaAtual = 1; // garante que o carrossel abra no Feed no boot

  function _avisoTentarAbrirDeepLink() {
    if (!_avisoDeepLinkId) return;
    var lista = window._avisosAtuais || AVISOS_HOJE_MOCK;
    var idx = -1;
    for (var i = 0; i < lista.length; i++) {
      if (lista[i] && (lista[i].id === _avisoDeepLinkId || (lista[i].nid && 'n_' + lista[i].nid === _avisoDeepLinkId))) { idx = i; break; }
    }
    if (idx === -1) return; // ainda não achou (pode ser a lista mock) — tenta de novo no próximo render real
    _avisoDeepLinkId = null; // consome uma única vez
    setTimeout(function () { _abrirAvisoPost(idx); }, 50);
  }

  /* ── Postar em "Hoje em Angatuba" — só quem estiver logado (login de
     morador, o mesmo dos jogos) com um e-mail autorizado. Isso aqui é só
     UI (decide se mostra o botão/ícones); quem realmente autoriza é o
     GAS, que confere o idToken do Firebase de novo no servidor a cada
     escrita — então mesmo alterando essa lista no console não dá pra
     postar sem o e-mail estar liberado lá. ── */
  var AVISOS_ADMIN_EMAILS_UI = ['ukbbze@gmail.com'];
  function _avisosSouAdmin() {
    var email = (_cliUser && _cliUser.email) ? String(_cliUser.email).toLowerCase() : '';
    return !!email && AVISOS_ADMIN_EMAILS_UI.indexOf(email) !== -1;
  }
  function _atualizarAdminAvisosUI() {
    try { document.body.classList.toggle('avisos-is-admin', _avisosSouAdmin()); } catch (e) {}
  }
  window._atualizarAdminAvisosUI = _atualizarAdminAvisosUI;

  var _avisoEditorId = null;      // null = criando novo; string = editando esse id
  var _avisoEditorMidias = [];    // [{tipo:'foto'|'video', url}]
  // Mídias enviadas pro Cloudinary NESTA sessão de edição e ainda não
  // confirmadas num aviso salvo — se forem removidas do editor ou o editor
  // for fechado sem salvar, apagamos elas do Cloudinary (evita lixo órfão).
  // Mídia que já pertencia ao aviso ANTES de abrir o editor não entra aqui:
  // essa limpeza continua por conta do diff de avisosEditar, no _salvarAviso.
  var _avisoEditorMidiasNovas = [];
  // Fix: token incrementado toda vez que o editor abre ou fecha. Um upload
  // (foto/vídeo) que ainda está em voo quando isso muda (usuário fechou o
  // editor, ou abriu o de OUTRO post, antes do upload terminar) captura o
  // valor no início e descarta o resultado se ele não bater mais no fim —
  // sem isso, a mídia entrava silenciosamente no post errado.
  var _avisoEditorSessao = 0;

  function _abrirEditorAviso(id) {
    if (!_avisosSouAdmin()) return;
    var overlay = document.getElementById('aviso-editor-overlay');
    if (!overlay) return;
    var aviso = null;
    if (id) {
      var lista = window._avisosAtuais || [];
      for (var i = 0; i < lista.length; i++) { if (lista[i].id === id) { aviso = lista[i]; break; } }
    }
    _avisoEditorSessao++;
    _avisoEditorId = aviso ? (aviso.id || null) : null;
    _avisoEditorMidias = (aviso && Array.isArray(aviso.midias)) ? aviso.midias.slice() : [];
    _avisoEditorMidiasNovas = [];

    document.getElementById('aviso-editor-heading').textContent = _avisoEditorId ? 'Editar aviso' : 'Novo aviso';
    document.getElementById('aviso-editor-emoji').value = aviso ? (aviso.emoji || '') : '';
    var tipoNorm = aviso ? _normalizarTipoAviso(aviso.tipo) : '';
    document.getElementById('aviso-editor-tipo').value = TIPOS_AVISO_CFG[tipoNorm] ? tipoNorm : '';
    document.getElementById('aviso-editor-titulo').value = aviso ? (aviso.titulo || '') : '';
    document.getElementById('aviso-editor-texto').value = aviso ? (aviso.texto || '') : '';
    document.getElementById('aviso-editor-texto-completo').value = aviso ? (aviso.textoCompleto || '') : '';
    document.getElementById('aviso-editor-status').textContent = '';
    document.getElementById('aviso-editor-salvar-btn').textContent = _avisoEditorId ? 'Salvar' : 'Publicar';
    _renderMidiasEditor();

    overlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    if (history.state?.modal !== 'aviso-editor') history.pushState({ modal: 'aviso-editor' }, '');
  }
  window._abrirEditorAviso = _abrirEditorAviso;

  function _fecharEditorAviso(viaPopstate) {
    _avisoEditorSessao++;
    var overlay = document.getElementById('aviso-editor-overlay');
    if (overlay) overlay.style.display = 'none';
    document.body.style.overflow = '';
    if (!viaPopstate && history.state?.modal === 'aviso-editor') { _popstateNosso = true; history.back(); }
    // Fecha sem ter salvo (ou fechou depois de salvar, mas aí a lista já
    // está vazia — ver _salvarAviso): o que sobrou aqui foi enviado e nunca
    // usado em nenhum aviso, então pode apagar do Cloudinary.
    if (_avisoEditorMidiasNovas.length) {
      _avisoEditorMidiasNovas.forEach(function (url) { _avisoCloudinaryApagarUrl(url); });
      _avisoEditorMidiasNovas = [];
    }
  }
  window._fecharEditorAviso = _fecharEditorAviso;

  // Apaga uma mídia órfã do Cloudinary (enviada no editor, nunca publicada) —
  // best-effort, silenciosa: nunca deve travar o editor por causa disso.
  async function _avisoCloudinaryApagarUrl(url) {
    if (!url || !_cliUser) return;
    try {
      var idToken = await _cliUser.getIdToken();
      var params = new URLSearchParams();
      params.append('payload', JSON.stringify({ action: 'avisosCloudinaryApagar', idToken: idToken, url: url }));
      await fetch(APPS_SCRIPT_URL, { method: 'POST', body: params, signal: AbortSignal.timeout(15000) });
    } catch (e) {}
  }

  function _renderMidiasEditor() {
    var box = document.getElementById('aviso-editor-midias-lista');
    if (!box) return;
    box.innerHTML = _avisoEditorMidias.map(function (m, i) {
      return '<div class="aviso-editor-midia-item">' +
        (m.tipo === 'video' ? '<video src="' + m.url + '" muted playsinline></video>' : '<img src="' + m.url + '" alt="" />') +
        '<button type="button" class="aviso-editor-midia-del" onclick="_removerMidiaEditor(' + i + ')" aria-label="Remover mídia"><i class="fa fa-xmark" aria-hidden="true"></i></button>' +
        '</div>';
    }).join('');
  }

  function _removerMidiaEditor(i) {
    var removida = _avisoEditorMidias[i];
    _avisoEditorMidias.splice(i, 1);
    if (removida) {
      var idxNova = _avisoEditorMidiasNovas.indexOf(removida.url);
      if (idxNova !== -1) {
        _avisoEditorMidiasNovas.splice(idxNova, 1);
        _avisoCloudinaryApagarUrl(removida.url); // órfã: nunca chegou a ser salva
      }
    }
    _renderMidiasEditor();
  }
  window._removerMidiaEditor = _removerMidiaEditor;

  // Mesmo fluxo de assinatura+upload direto pro Cloudinary já usado pelas
  // lojas (uploadImagem/uploadVideoAnuncio), só que assinado com o login
  // do morador (idToken do Firebase) em vez do token de loja.
  async function _uploadMidiaAviso(file, tipo) {
    var statusEl = document.getElementById('aviso-editor-status');
    if (!_cliUser) { if (statusEl) statusEl.textContent = 'Faça login para postar.'; return null; }
    try {
      if (tipo === 'foto' && typeof _mlRedimensionarImagem === 'function') file = await _mlRedimensionarImagem(file, 1280, 0.85);
      var limite = tipo === 'video' ? 30 * 1024 * 1024 : 5 * 1024 * 1024;
      if (file.size > limite) {
        if (statusEl) statusEl.textContent = '❌ Arquivo muito grande (' + (tipo === 'video' ? 'máx 30MB' : 'máx 5MB') + ')';
        return null;
      }
      if (statusEl) statusEl.textContent = '⏳ Preparando envio...';
      var idToken = await _cliUser.getIdToken();
      var sigParams = new URLSearchParams();
      sigParams.append('payload', JSON.stringify({ action: 'avisosCloudinaryAssinar', idToken: idToken, tipo: tipo }));
      var sigResp = await fetch(APPS_SCRIPT_URL, { method: 'POST', body: sigParams, signal: AbortSignal.timeout(30000) });
      var sigJson = await sigResp.json();
      if (sigJson.status !== 'ok') throw new Error(sigJson.msg || 'Erro ao assinar upload');
      var d = sigJson.data;

      if (statusEl) statusEl.textContent = '⏳ Enviando ' + (tipo === 'video' ? 'vídeo' : 'foto') + '...';
      var fd = new FormData();
      fd.append('file', file);
      fd.append('api_key', d.apiKey);
      fd.append('timestamp', d.timestamp);
      fd.append('folder', d.folder);
      if (d.allowed_formats) fd.append('allowed_formats', d.allowed_formats);
      fd.append('signature', d.signature);
      // Endpoint do Cloudinary usa o tipo de recurso em inglês (image/video),
      // não o 'foto'/'video' interno do app — por isso o map aqui.
      var resourceType = tipo === 'video' ? 'video' : 'image';
      var upResp = await fetch('https://api.cloudinary.com/v1_1/' + d.cloud + '/' + resourceType + '/upload',
        { method: 'POST', body: fd, signal: AbortSignal.timeout(tipo === 'video' ? 120000 : 60000) });
      var upJson = await upResp.json();
      if (upJson.secure_url) { if (statusEl) statusEl.textContent = ''; return upJson.secure_url; }
      throw new Error((upJson.error && upJson.error.message) || 'Falha no upload');
    } catch (err) {
      if (statusEl) statusEl.textContent = '❌ ' + err.message;
      return null;
    }
  }

  (function initAvisoEditorUploads() {
    var inpFoto = document.getElementById('aviso-editor-input-foto');
    var inpVideo = document.getElementById('aviso-editor-input-video');
    if (inpFoto) inpFoto.addEventListener('change', async function (e) {
      var files = Array.prototype.slice.call(e.target.files || []);
      e.target.value = '';
      var sessaoDoUpload = _avisoEditorSessao;
      for (var i = 0; i < files.length; i++) {
        if (_avisoEditorMidias.length >= 10) break;
        var url = await _uploadMidiaAviso(files[i], 'foto');
        if (!url) continue;
        if (_avisoEditorSessao !== sessaoDoUpload) { _avisoCloudinaryApagarUrl(url); break; } // editor mudou no meio do upload
        _avisoEditorMidias.push({ tipo: 'foto', url: url }); _avisoEditorMidiasNovas.push(url); _renderMidiasEditor();
      }
    });
    if (inpVideo) inpVideo.addEventListener('change', async function (e) {
      var file = e.target.files && e.target.files[0];
      e.target.value = '';
      if (!file || _avisoEditorMidias.length >= 10) return;
      var sessaoDoUpload = _avisoEditorSessao;
      var url = await _uploadMidiaAviso(file, 'video');
      if (!url) return;
      if (_avisoEditorSessao !== sessaoDoUpload) { _avisoCloudinaryApagarUrl(url); return; } // editor mudou no meio do upload
      _avisoEditorMidias.push({ tipo: 'video', url: url }); _avisoEditorMidiasNovas.push(url); _renderMidiasEditor();
    });
  })();

  async function _salvarAviso() {
    if (!_cliUser) { mlToast('Faça login para postar.', 'erro'); return; }
    var titulo = document.getElementById('aviso-editor-titulo').value.trim();
    var texto  = document.getElementById('aviso-editor-texto').value.trim();
    if (!titulo && !texto) { mlToast('Preencha ao menos o título ou o resumo.', 'erro'); return; }
    var btn = document.getElementById('aviso-editor-salvar-btn');
    btn.disabled = true;
    try {
      var idToken = await _cliUser.getIdToken();
      var payload = {
        action: _avisoEditorId ? 'avisosEditar' : 'avisosCriar',
        idToken: idToken,
        id: _avisoEditorId || '',
        emoji: document.getElementById('aviso-editor-emoji').value.trim() || '📰',
        tipo: document.getElementById('aviso-editor-tipo').value.trim(),
        titulo: titulo,
        texto: texto,
        textoCompleto: document.getElementById('aviso-editor-texto-completo').value.trim(),
        midias: _avisoEditorMidias,
      };
      var params = new URLSearchParams();
      params.append('payload', JSON.stringify(payload));
      var resp = await fetch(APPS_SCRIPT_URL, { method: 'POST', body: params, signal: AbortSignal.timeout(15000) });
      var json = await resp.json();
      if (json.status !== 'ok') throw new Error(json.msg || 'Erro ao salvar');
      _avisoEditorMidiasNovas = []; // salvou: essas mídias agora pertencem ao aviso, não são mais "órfãs"
      mlToast(_avisoEditorId ? 'Aviso atualizado!' : 'Aviso publicado!', 'ok');
      _fecharEditorAviso();
      _carregarAvisosReal();
    } catch (err) {
      mlToast('Erro: ' + err.message, 'erro');
    } finally {
      btn.disabled = false;
    }
  }
  window._salvarAviso = _salvarAviso;

  async function _apagarAviso(id) {
    if (!id || !_cliUser) return;
    var ok = await mlConfirmar('Apagar aviso?', 'Essa ação não pode ser desfeita.', { okLabel: 'Apagar' });
    if (!ok) return;
    try {
      var idToken = await _cliUser.getIdToken();
      var params = new URLSearchParams();
      params.append('payload', JSON.stringify({ action: 'avisosApagar', idToken: idToken, id: id }));
      var resp = await fetch(APPS_SCRIPT_URL, { method: 'POST', body: params, signal: AbortSignal.timeout(15000) });
      var json = await resp.json();
      if (json.status !== 'ok') throw new Error(json.msg || 'Erro ao apagar');
      mlToast('Aviso removido.', 'ok');
      _carregarAvisosReal();
    } catch (err) {
      mlToast('Erro: ' + err.message, 'erro');
    }
  }
  window._apagarAviso = _apagarAviso;

  // ── Pull-to-refresh para Page 2 (Utilidades) ──
  var _pullToRefreshState = { y: 0, down: false, loaded: 0, debounce: 0 };
  function _initPullToRefresh() {
    var page = document.getElementById('home-page-1');
    if (!page) return;
    var indicator = document.getElementById('pull-refresh-indicator');

    page.addEventListener('touchstart', function (e) {
      if (e.touches.length === 1) {
        _pullToRefreshState.y = e.touches[0].clientY;
        _pullToRefreshState.down = page.scrollTop === 0;
      }
    }, { passive: true });

    page.addEventListener('touchmove', function (e) {
      if (!_pullToRefreshState.down || e.touches.length !== 1) return;
      var dy = e.touches[0].clientY - _pullToRefreshState.y;
      if (dy > 0 && dy < 100) {
        // Apenas deixar o visual do pull acontecer, sem bloquear scroll natural
        if (indicator && dy > 50) {
          indicator.classList.add('show');
        }
      }
    }, { passive: true });

    page.addEventListener('touchend', function () {
      var dy = 0;
      if (_pullToRefreshState.down) {
        var elTemp = document.getElementById('weather-temp');
        if (elTemp) dy = Math.max(0, _pullToRefreshState.y - (Date.now() - _pullToRefreshState.loaded));
      }
      if (dy > 50 && !_pullToRefreshState.debounce) {
        _pullToRefreshState.debounce = 1;
        if (indicator) indicator.classList.add('show');
        _uiSom('atualizar');
        _carregarClima();
        _carregarAvisosReal(true);
        setTimeout(function () {
          if (indicator) indicator.classList.remove('show');
          _pullToRefreshState.debounce = 0;
        }, 1500);
      } else {
        if (indicator) indicator.classList.remove('show');
      }
      _pullToRefreshState.down = false;
    }, { passive: true });

    _pullToRefreshState.loaded = Date.now();
  }

  function _carregarUtilidadesHome() {
    if (_utilidadesCarregadas) return;
    _utilidadesCarregadas = true;
    _carregarClima();
    _carregarAvisosReal();
    _initPullToRefresh();
  }

  // Fix: este IIFE precisa rodar DEPOIS de todo o bloco acima (WMO_MAP,
  // AVISOS_HOJE_MOCK, WEATHER_LAT/LON etc.) — ele pode disparar
  // _irParaPaginaHome(1,...) → _carregarUtilidadesHome() na hora, se a
  // página preferida salva for "Utilidades". Rodando mais cedo (como
  // antes), esses "var" ainda não tinham sido atribuídos nessa primeira
  // passada (ficavam undefined até o script chegar na linha deles), e a
  // previsão/os avisos apareciam quebrados na primeira abertura.
  (function initHomeCarouselSwipe() {
    var wrap = document.getElementById('home-carousel-wrap');
    if (!wrap) return;
    var startX = 0, startY = 0, dragging = false, isHoriz = null;

    wrap.addEventListener('touchstart', function (e) {
      // Fix: gesto que começa num scroller horizontal (tira semanal do
      // clima, categorias) não deve ser tratado como swipe de página —
      // senão arrastar a tira pra ver sex/sáb trocava de página em vez de
      // rolar a tira (ela ganhou "touch-action: pan-x" própria no CSS, mas
      // só funciona se esse handler não competir pelo gesto).
      if (e.target.closest('.scroll-x')) { dragging = false; return; }
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      dragging = true; isHoriz = null;
    }, { passive: true });

    wrap.addEventListener('touchmove', function (e) {
      if (!dragging) return;
      var dx = e.touches[0].clientX - startX;
      var dy = e.touches[0].clientY - startY;
      // Fix: decidir o eixo já no primeiro touchmove (1-3px de ruído do
      // dedo) fazia um scroll vertical normal virar "swipe horizontal" de
      // vez em quando, travando a rolagem até soltar o dedo. Só decide
      // depois de ~10px acumulados, com viés pro vertical.
      if (isHoriz === null) {
        if (Math.abs(dx) + Math.abs(dy) < 10) return;
        isHoriz = Math.abs(dx) > Math.abs(dy) * 1.3;
      }
      if (isHoriz) e.preventDefault(); // só trava o scroll vertical se o gesto for horizontal
    }, { passive: false });

    wrap.addEventListener('touchend', function (e) {
      if (!dragging || !isHoriz) { dragging = false; return; }
      var dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 40) {
        if (dx < 0) _irParaPaginaHome(_homePaginaAtual + 1);
        else        _irParaPaginaHome(_homePaginaAtual - 1);
      }
      dragging = false;
    });

    document.querySelectorAll('.home-dot').forEach(function (dot) {
      dot.addEventListener('click', function () { _irParaPaginaHome(+dot.dataset.idx); });
    });

    // Sincroniza o estado JS com a posição já aplicada pelo script inline
    // anti-flash (sem reanimar) — e dispara o carregamento do clima se a
    // home já abriu direto na página de Utilidades.
    _irParaPaginaHome(_homePaginaAtual, false);
    _atualizarBotoesPrefHome();
  })();

  // Quiz da Coruja: NÃO carrega no boot. Só quando o usuário abre a aba
  // Joguinhos (lazy) — ver _abrirGamesHub(). Evita fetch desnecessário e
  // tira o quiz do rodapé de todas as categorias.

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
    // #nome--id: acha pelo id (estável a renomeação); empate de id desempata
    // pelo nome. Sem id (ou id que não bate, ex.: WhatsApp trocado) e links
    // antigos #nome: acha pelo nome.
    const sep = slug.lastIndexOf('--');
    const nomeSlug = sep === -1 ? slug : slug.slice(0, sep);
    const id       = sep === -1 ? '' : slug.slice(sep + 2);
    const porId = id ? LOJAS.filter(l => lojaLinkId(l.wpp) === id) : [];
    const loja = porId.find(l => toSlug(l.nome) === nomeSlug) || porId[0]
      || LOJAS.find(l => toSlug(l.nome) === nomeSlug);
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
  // Atualiza o badge do app assim que as lojas estiverem carregadas.
  try { _atualizarBadgeApp(); } catch (e) {}

  // Back button Android no PWA — fecha o modal ativo em vez de sair do app
  // Handler único de popstate (botão voltar Android). Ordem importa:
  // cardápio → detalhes → minha-loja → cadastro. Cada return encerra o handler,
  // então um único "voltar" fecha apenas o modal do topo da pilha.
  window.addEventListener('popstate', function() {
    // Navegação já tratada por quem chamou history.back() manualmente —
    // não interpretar como "voltar" do usuário (ver A1.3/A4.1).
    if (_popstateNosso) { _popstateNosso = false; return; }
    // Tour do painel do lojista: fica acima de tudo e não empilha histórico
    // próprio. Um "voltar" com o tour aberto tem que fechar O TOUR, não o
    // painel debaixo dele — senão o painel some e o tour continua sozinho,
    // com o furo apontando para a tela inicial das lojas.
    if (document.querySelector('#lojista-onb-overlay.open')) {
      const painelSegueAberto = document.getElementById('modal-minha-loja')?.classList.contains('open');
      fecharOnboardingLojista();
      // Este "voltar" consumiu a entrada do painel: devolve, para o próximo
      // "voltar" fechar o painel normalmente.
      if (painelSegueAberto) history.pushState({ modal: 'minha-loja' }, '');
      return;
    }
    // Login do lojista e tela "Aguardando aprovação"
    if (document.getElementById('modal-login-loja')?.classList.contains('open')) {
      closeLoginLoja(true); return;
    }
    if (document.getElementById('modal-aguardando')?.classList.contains('open')) {
      fecharAguardando(false, true); return;
    }
    // Editor de aviso (admin) — fecha antes do modal de post, que fica por baixo
    if (document.getElementById('aviso-editor-overlay')?.style.display === 'flex') {
      if (typeof _fecharEditorAviso === 'function') _fecharEditorAviso(true); return;
    }
    // Modal de post ("Hoje em Angatuba")
    if (document.getElementById('aviso-post-overlay')?.style.display === 'flex') {
      if (typeof _fecharAvisoPost === 'function') _fecharAvisoPost(true); return;
    }
    // Chat 1x1 (Fase 2) — abre por cima do painel de conta e do perfil
    // do amigo (que vive no hub de jogos), então sai antes de todos eles.
    // Conversa aberta a partir da lista desce pra lista (ver cliChatVoltar).
    if (document.getElementById('modal-chat')?.classList.contains('open')) {
      if (typeof cliChatVoltar === 'function') cliChatVoltar(true); return;
    }
    // Tela de ranking (dentro da hub de jogos)
    if (document.getElementById('jogo-ranking')?.classList.contains('rank-open')) {
      if (typeof rankFecharPainel === 'function') rankFecharPainel(true); return;
    }
    // Jogo aberto dentro do hub (não o menu) — volta só ao menu de jogos,
    // em vez de sair do hub inteiro (A1.15).
    var _hubComJogoAtivo = document.getElementById('games-hub');
    if (_hubComJogoAtivo && _hubComJogoAtivo.classList.contains('jogo-ativo')) {
      // 5.3.3 — com o lobby levando o grupo pra dentro de uma sala, a
      // tela do jogo está SUBINDO agora. `_voltarAoMenu` aqui chamaria
      // `parar()` no módulo que acabou de montar e a espera do lobby
      // morreria em "A tela do jogo não abriu". Este back é sobra de
      // algum overlay que fechou no caminho: engole e segue.
      if (_lobIndoPraSala) return;
      if (typeof _voltarAoMenu === 'function') _voltarAoMenu();
      return;
    }
    // Hub de jogos (menu) — volta pra tela inicial em vez de sair do app.
    if (typeof _gamesHubAberto === 'function' && _gamesHubAberto()) {
      if (typeof _sairDosJogos === 'function') _sairDosJogos(true); return;
    }
    // Hub Aprender (qualquer tela dele) — fecha o hub inteiro, igual ao
    // botão de voltar do cabeçalho (ver comentário em _fecharAprender).
    if (typeof _aprenderAberto === 'function' && _aprenderAberto()) {
      if (typeof _fecharAprender === 'function') _fecharAprender(true); return;
    }
    // Biblioteca da Coruja — desce UM nível por "voltar" (folha do
    // leitor → leitor → página do livro → acervo → fecha), ver _bibVoltar.
    // O login do cliente pode abrir por cima dela, por isso o login é
    // conferido antes (ele empilha a própria entrada 'cli-login').
    if (typeof _bibliotecaAberta === 'function' && _bibliotecaAberta()
        && !document.getElementById('modal-cli-login')?.classList.contains('open')) {
      if (typeof _bibVoltar === 'function') _bibVoltar(true); return;
    }
    // Lobby social (5.2) — abre EM CIMA do painel de conta, então sai antes
    if (document.getElementById('modal-lobby')?.classList.contains('open')) {
      if (typeof cliFecharLobby === 'function') cliFecharLobby(true); return;
    }
    // Painel de conta do cliente (pode estar sobre tudo)
    if (document.getElementById('modal-cli-conta')?.classList.contains('open')) {
      if (typeof cliFecharPainelConta === 'function') cliFecharPainelConta(true); return;
    }
    // Login do cliente
    if (document.getElementById('modal-cli-login')?.classList.contains('open')) {
      if (typeof cliFecharLogin === 'function') cliFecharLogin(true); return;
    }
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

  /* (trecho do lojista movido para lojista.js — ver LOJISTA SOB DEMANDA) */

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
      ? `<button onclick="avalSinalizar(${idx},'${escJsArg(idSafe)}','${escJsArg(a.texto||'')}')" title="Sinalizar para revisão" style="font-size:11px;color:var(--muted);background:none;border:none;cursor:pointer;padding:2px 6px;border-radius:5px;border:1px solid var(--border);flex-shrink:0;">🚩</button>`
      : '';
    const responderBtn = (isDono && !a.resposta)
      ? `<button onclick="avalResponder(${idx},'${escJsArg(idSafe)}')" style="font-size:10.5px;color:#f59e0b;background:none;border:none;cursor:pointer;padding:2px 4px;font-weight:700;">Responder</button>`
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
          <button onclick="avalEnviar(${idx},'${escJsArg(nome)}')"
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
            <button onclick="avalEditarAbrir(${idx},'${escJsArg(nome)}')" style="flex:1;padding:9px;border-radius:8px;background:var(--surface);border:1px solid var(--border);color:var(--text);font-family:var(--font-b);font-size:12px;font-weight:700;cursor:pointer;-webkit-tap-highlight-color:transparent;">✏️ Editar</button>
            <button onclick="avalRemover(${idx},'${escJsArg(nome)}')" style="flex:1;padding:9px;border-radius:8px;background:var(--surface);border:1px solid var(--border);color:var(--red);font-family:var(--font-b);font-size:12px;font-weight:700;cursor:pointer;-webkit-tap-highlight-color:transparent;">🗑️ Remover</button>
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
      const resp = await fetch(APPS_SCRIPT_URL, { method:'POST', body:params, signal:AbortSignal.timeout(20000) });
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
      if (txt) txt.textContent = 'Ver ' + n + (n > 1 ? ' avaliações' : ' avaliação');
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
          <button onclick="avalEditarEnviar(${idx},'${escJsArg(nome)}')" style="flex:1;padding:9px;border-radius:8px;background:linear-gradient(135deg,#f59e0b,#d97706);color:#000;font-family:var(--font-h);font-size:12px;font-weight:800;border:none;cursor:pointer;">Salvar</button>
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
         <button onclick="avalResponderEnviar(${lojaIdx},'${escJsArg(avalId)}')" style="flex:1;padding:7px;border-radius:6px;background:linear-gradient(135deg,#f59e0b,#d97706);color:#000;font-family:var(--font-h);font-size:11px;font-weight:800;border:none;cursor:pointer;">Publicar</button>
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
      const resp = await fetch(APPS_SCRIPT_URL, { method:'POST', body:params, signal:AbortSignal.timeout(20000) });
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

  /* (trecho do lojista movido para lojista.js — ver LOJISTA SOB DEMANDA) */

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
  // Quando != null, a personalizacao esta EDITANDO uma linha ja no carrinho
  // (guarda a chave da linha). Ao confirmar, a linha antiga e substituida.
  let _ccPersEditKey = null;

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
      'lava-rapido':'Serviços', 'posto':'Combustíveis',
      'bicicletaria':'Serviços',
      // Casa — Serviços/Produtos
      'vidracaria':'Serviços', 'serralheria':'Serviços',
      'refrigeracao':'Serviços', 'consertos':'Serviços', 'eletricista':'Serviços',
      'encanamento':'Serviços', 'pintura':'Serviços',
      // Tecnologia — Serviços
      'grafica':'Serviços',
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
    if (!viaPopstate && history.state && history.state.modal === 'cardapio') { _popstateNosso = true; history.back(); }
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
          return `<button class="cc-tab-pill${i===0?' active':''}" data-cat-id="${escAttr(cid)}" onclick="ccScrollTocat('${escJsArg(cid)}')">${escHTML(cat)}</button>`;
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
    if (_cardEsgotadoHoje(item)) return _ccItemEsgotadoHTML(item, placeholderEmoji);
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
    // Quando exigePers, o CARD INTEIRO ja abre a personalizacao (ver
    // clickAttr abaixo). O botao roxo aqui e apenas afordancia visual: ele
    // deixa o clique subir para o card em vez de chamar a funcao de novo —
    // chamar duas vezes era o que fazia o sheet 'levantar dois'.
    const btnHTML = exigePers
      ? `<button class="cc-item-add cc-item-personalizar" aria-label="Escolher opções de ${escAttr(item.nome)}" onclick="ccAbrirPersonalizacao('${escJsArg(item.id)}')">+</button>`
      : `<button class="cc-item-add" aria-label="Adicionar ${escAttr(item.nome)}" onclick="event.stopPropagation();ccAdicionarItem('${escJsArg(item.id)}')">+</button>`;
    // Toque no card = adicionar +1 (comportamento de sempre). Item que exige
    // escolha (tamanho) abre a personalizacao, porque nao da pra adicionar sem.
    const clickAttr = exigePers
      ? `onclick="ccAbrirPersonalizacao('${escJsArg(item.id)}')"`
      : `onclick="ccCardClick(event,'${escJsArg(item.id)}')"`;
    // Acrescimos opcionais: um botao proprio, so ele abre a personalizacao.
    // Assim o resto do card continua adicionando +1 com um toque.
    const dicaHTML = (temGrupos && !exigePers)
      ? `<button type="button" class="cc-item-dica" onclick="event.stopPropagation();ccDicaClick(event,'${escJsArg(item.id)}')"><i class="fa fa-sliders"></i> Adicionar acréscimos</button>`
      : '';
    return `
      <div class="cc-item-card cc-item-clickable" id="cc-card-${item.id}" role="button" tabindex="0" ${clickAttr} style="margin-bottom:8px;cursor:pointer;${item.destaque==='SIM'?'border-color:rgba(245,158,11,0.5);background:rgba(245,158,11,0.05);':''}">
        ${temFoto
          ? `<div class="cc-foto-wrap">
               <img loading="lazy" decoding="async" src="${escAttr(item.foto)}" class="cc-item-foto" onerror="this.parentNode.style.display='none'">
               <button class="cc-foto-zoom" aria-label="Ver foto de ${escAttr(item.nome)}" onclick="event.stopPropagation();ccAbrirFoto('${escJsArg(item.id)}')">🔍</button>
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
        <div class="cc-qty-ctrl" id="cc-qty-${item.id}"${exigePers ? '' : ' onclick="event.stopPropagation()"'}>
          ${btnHTML}
        </div>
      </div>`;
  }

  // Item marcado pelo lojista como "Acabou hoje": aparece apagado, sem botão.
  function _ccItemEsgotadoHTML(item, placeholderEmoji) {
    return `
      <div class="cc-item-card" id="cc-card-${item.id}" aria-disabled="true" style="margin-bottom:8px;opacity:.5;">
        ${item.foto
          ? `<div class="cc-foto-wrap"><img loading="lazy" decoding="async" src="${escAttr(item.foto)}" class="cc-item-foto" style="filter:grayscale(1);" onerror="this.parentNode.style.display='none'"></div>`
          : `<div class="cc-item-foto-placeholder">${placeholderEmoji}</div>`}
        <div class="cc-item-info">
          <div class="cc-item-nome">${escHTML(item.nome)}</div>
          ${item.descricao ? `<div class="cc-item-desc">${escHTML(item.descricao)}</div>` : ''}
          <div class="cc-item-preco" style="color:var(--muted);">Esgotado hoje</div>
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
          ? `<img loading="lazy" decoding="async" src="${escAttr(item.foto)}" class="cc-item-foto" onclick="ccAbrirFoto('${escJsArg(item.id)}')" style="cursor:zoom-in;" onerror="this.style.display='none'">`
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
    const zoomAttr = temFoto ? ` onclick="ccAbrirFoto('${escJsArg(item.id)}')" style="cursor:zoom-in;"` : '';
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
    if (_cardEsgotadoHoje(item)) { mlToast('Esse item acabou hoje.', 'erro'); return; }

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
    try { if (navigator.vibrate) navigator.vibrate(15); } catch (e) {}

    // Troca botão "+" por controles de quantidade. Delegado a
    // _ccSincronizarCard para manter uma unica fonte de verdade do card e
    // evitar redesenho desnecessario (causa da piscada).
    _ccSincronizarCard(item);
    ccAtualizarCarrinho();
  };

  /* ─── Tela de personalizacao (item com grupos) ─────────────── */
  // Guarda contra abertura DUPLA. Para item que exige escolha, o card
  // inteiro e o botao roxo apontam para esta mesma funcao; no Android o par
  // touch->click pode disparar os dois caminhos. Sem esta guarda, a segunda
  // chamada reexecuta a animacao de entrada e o sheet parece 'levantar dois'.
  let _ccPersAbrindoEm = 0;
  window.ccAbrirPersonalizacao = function(itemId) {
    const modalJa = document.getElementById('modal-cc-pers');
    // Ja esta aberta/abrindo? Ignora — inclusive para outro item, porque o
    // usuario precisa fechar a atual antes.
    if (modalJa && modalJa.style.display === 'flex') return;
    const agora = Date.now();
    if (agora - _ccPersAbrindoEm < 250) return;   // duplo disparo touch/click
    _ccPersAbrindoEm = agora;
    const loja = LOJAS[_ccLojaIdx];
    const item = loja.cardapio.find(i => i.id === itemId);
    if (!item || !_ccItemTemGrupos(item)) return;
    _ccPersItem = item;
    _ccPersEditKey = null;   // abertura normal = item novo (nao edita linha)
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
    _ccPersAbrindoEm = 0;   // libera a guarda de abertura dupla
    const modal = document.getElementById('modal-cc-pers');
    if (modal) { modal.classList.remove('aberto'); setTimeout(() => { modal.style.display = 'none'; }, 200); }
    _ccPersItem = null; _ccPersEscolhas = {}; _ccPersEditKey = null;
  };

  // Reabre a personalizacao para EDITAR uma linha ja no carrinho. Pre-preenche
  // as escolhas atuais e marca a linha (via _ccPersEditKey) para que confirmar
  // substitua a linha antiga em vez de criar outra.
  window.ccEditarLinhaCarrinho = function(chave) {
    const linha = _ccCarrinho[chave];
    if (!linha || !linha.item) return;
    const item = linha.item;
    if (!_ccItemTemGrupos(item)) return;
    const modalJa = document.getElementById('modal-cc-pers');
    if (modalJa && modalJa.style.display === 'flex') return;
    const agora = Date.now();
    if (agora - _ccPersAbrindoEm < 250) return;
    _ccPersAbrindoEm = agora;
    _ccPersItem = item;
    _ccPersEditKey = chave;
    // Clona as escolhas da linha; grupos sem escolha entram vazios para a UI.
    const base = linha.escolhas ? JSON.parse(JSON.stringify(linha.escolhas)) : {};
    _ccPersEscolhas = {};
    (item.grupos || []).forEach(g => { _ccPersEscolhas[g.id] = Array.isArray(base[g.id]) ? base[g.id].slice() : []; });
    _ccRenderPersonalizacao();
    const modal = document.getElementById('modal-cc-pers');
    if (modal) { modal.style.display = 'flex'; requestAnimationFrame(() => modal.classList.add('aberto')); }
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
      // Ja esta em modo quantidade? So atualiza o numero. Reescrever o
      // innerHTML aqui destruiria o botao que o dedo esta tocando (mata o
      // :active no meio do toque) e forcaria layout/paint => piscada.
      const numExistente = qtyEl.querySelector('.cc-qty-num');
      if (numExistente) {
        if (numExistente.textContent !== String(linha.qty)) {
          numExistente.textContent = linha.qty;
        }
        return;
      }
      // Transicao botao '+' -> controles de quantidade: ai sim redesenha.
      const kEsc = String(chavePadrao).replace(/'/g, "\\'");
      qtyEl.innerHTML = `
        <button class="cc-qty-btn" onclick="event.stopPropagation();ccAlterarQty('${kEsc}',-1)">−</button>
        <span class="cc-qty-num">${linha.qty}</span>
        <button class="cc-qty-btn" onclick="event.stopPropagation();ccAlterarQty('${kEsc}',+1)" style="background:linear-gradient(135deg,#10b981,#059669);color:#fff;border:none;">+</button>
      `;
    } else {
      // Ja esta em modo botao '+'? Nao mexe no DOM.
      if (qtyEl.querySelector('.cc-item-add')) return;
      qtyEl.innerHTML = _ccItemExigePersonalizar(item)
        ? `<button class="cc-item-add cc-item-personalizar" onclick="event.stopPropagation();ccAbrirPersonalizacao('${escJsArg(item.id)}')">+</button>`
        : `<button class="cc-item-add" onclick="event.stopPropagation();ccAdicionarItem('${escJsArg(item.id)}')">+</button>`;
    }
  }

  window.ccPersConfirmar = function() {
    const item = _ccPersItem; if (!item) return;
    const erro = _ccValidarEscolhas(item, _ccPersEscolhas);
    if (erro) { mlToast(erro, 'erro'); return; }
    const escolhas = JSON.parse(JSON.stringify(_ccPersEscolhas));
    const key = _ccLineKey(item, escolhas);
    const precoUnit = _ccPrecoUnitario(item, escolhas);
    // Modo edicao: transfere a quantidade da linha antiga para a nova config e
    // remove a antiga. Se a nova config coincidir com uma linha ja existente,
    // as quantidades somam naturalmente (mesma chave).
    const editKey = _ccPersEditKey;
    let qtdTransferir = 1;
    if (editKey && _ccCarrinho[editKey]) {
      qtdTransferir = _ccCarrinho[editKey].qty || 1;
      if (editKey !== key) delete _ccCarrinho[editKey];
      else qtdTransferir = 0; // mesma chave: nao duplica, so reafirma abaixo
    }
    if (!_ccCarrinho[key]) {
      _ccCarrinho[key] = { item, qty: 0, escolhas, precoUnit };
    }
    _ccCarrinho[key].qty += qtdTransferir;
    if (_ccCarrinho[key].qty <= 0) _ccCarrinho[key].qty = 1;
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
    }
    // Fonte unica de verdade do card: _ccSincronizarCard decide sozinha se
    // troca o innerHTML (mudanca de estado) ou so atualiza o numero. Antes
    // havia atualizacao duplicada aqui, imediatamente desfeita abaixo.
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
    // Object.entries para cada linha carregar sua CHAVE (necessaria p/ os
    // controles de +/-/editar por linha). itens = [ [chave, linha], ... ].
    const itens  = Object.entries(_ccCarrinho);

    if (itens.length === 0) {
      if (bar) bar.style.display = 'none';
      _ccCartExpanded = false;
      ccAplicarEstadoCarrinho(false);
      return;
    }

    // Pulse de atenção quando o carrinho aparece (estava oculto e agora tem itens)
    const estavaOculto = bar && (bar.style.display === 'none' || bar.style.display === '');
    if (bar) bar.style.display = '';
    if (estavaOculto && bar && !_ccCartExpanded) {
      bar.classList.remove('cc-cart-pulse');
      // Reinicia a animacao no proximo frame. Antes usava `void
      // bar.offsetWidth`, que forca um reflow SINCRONO da pagina inteira —
      // caro com o cardapio todo no DOM.
      requestAnimationFrame(function () {
        bar.classList.add('cc-cart-pulse');
        setTimeout(function () { bar.classList.remove('cc-cart-pulse'); }, 600);
      });
    }

    let subtotal = 0, totalQty = 0;
    // Preco por linha = precoUnit (ja inclui modificadores) * qty. Itens antigos
    // sem precoUnit caem no preco base do item (retrocompat).
    const _precoLinha = (linha) => {
      const unit = (linha.precoUnit != null) ? linha.precoUnit : (parseFloat(linha.item.preco) || 0);
      return unit * linha.qty;
    };
    if (lista) {
      lista.innerHTML = itens.map(([chave, linha]) => {
        const { item, qty, escolhas } = linha;
        const sub = _precoLinha(linha);
        subtotal += sub; totalQty += qty;
        const extras = escolhas ? _ccResumoEscolhas(item, escolhas) : [];
        const extrasHTML = extras.length
          ? `<div style="font-size:10px;color:var(--muted);line-height:1.4;margin-top:2px;">${extras.map(e => '+ ' + escHTML(e)).join('<br>')}</div>`
          : '';
        const kEsc = escAttr(String(chave));
        // Item com escolhas ganha um botao 'editar' que reabre a personalizacao
        // ja preenchida; itens simples nao precisam (o +/- basta).
        const temEscolhas = !!(escolhas && Object.keys(escolhas).some(gid => (escolhas[gid] || []).length));
        const editarBtn = temEscolhas
          ? `<button type="button" class="cc-cl-edit" aria-label="Editar ${escAttr(item.nome)}" onclick="ccEditarLinhaCarrinho('${kEsc}')"><i class="fa fa-pen"></i></button>`
          : '';
        return `<div class="cc-cart-linha">
          <div class="cc-cl-info">
            <div class="cc-cl-nome">${escHTML(item.nome)}${editarBtn}</div>
            ${extrasHTML}
          </div>
          <div class="cc-cl-dir">
            <div class="cc-cl-stepper">
              <button type="button" class="cc-cl-btn" aria-label="Menos um" onclick="ccAlterarQty('${kEsc}',-1)">−</button>
              <span class="cc-cl-qty">${qty}</span>
              <button type="button" class="cc-cl-btn mais" aria-label="Mais um" onclick="ccAlterarQty('${kEsc}',1)">+</button>
            </div>
            <span class="cc-cl-preco">R$ ${sub.toFixed(2).replace('.',',')}</span>
          </div>
        </div>`;
      }).join('');
    } else {
      itens.forEach(([, linha]) => { subtotal += _precoLinha(linha); totalQty += linha.qty; });
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

    // Se o carrinho está aberto, recalcula a altura (conteúdo mudou).
    // Sem animacao (o usuario nao pediu toggle) e no proximo frame, para nao
    // ler geometria logo apos a escrita do innerHTML acima (layout thrashing).
    if (_ccCartExpanded) {
      requestAnimationFrame(function () { ccAplicarEstadoCarrinho(false); });
    }
  }

  // Estado de expansão do carrinho colapsável

  // `animar`: true quando o proprio usuario abriu/fechou o carrinho (queremos
  // a transicao). false quando so o CONTEUDO mudou (clique em +/-): nesse caso
  // a transition e desligada durante a escrita, senao cada clique reinicia uma
  // animacao de max-height de 280ms — que forca relayout a cada frame e e a
  // causa da piscada no cardapio.
  function ccAplicarEstadoCarrinho(animar) {
    const body    = document.getElementById('cc-cart-body');
    const head    = document.getElementById('cc-cart-head');
    const chevron = document.getElementById('cc-cart-chevron');
    const action  = document.getElementById('cc-cart-action-text');
    if (!body) return;
    const semAnimacao = (animar === false);
    let transicaoAnterior = null;
    if (semAnimacao) {
      transicaoAnterior = body.style.transition;
      body.style.transition = 'none';
    }
    if (_ccCartExpanded) {
      // limita a metade da altura do sheet para nunca cobrir a lista toda
      const max = Math.round(window.innerHeight * 0.5);
      // Le a geometria UMA vez so (antes eram duas leituras = dois reflows).
      const alturaConteudo = body.scrollHeight;
      const alvo = Math.min(alturaConteudo, max) + 'px';
      // So escreve se mudou de verdade — escrever o mesmo valor ainda assim
      // invalida o layout no Chrome/Android.
      if (body.style.maxHeight !== alvo) body.style.maxHeight = alvo;
      const ovf = alturaConteudo > max ? 'auto' : 'hidden';
      if (body.style.overflowY !== ovf) body.style.overflowY = ovf;
      if (chevron) chevron.style.transform = 'rotate(180deg)';
      if (action)  action.textContent = 'Recolher pedido';
      if (head) head.setAttribute('aria-expanded', 'true');
    } else {
      if (body.style.maxHeight !== '0px') body.style.maxHeight = '0px';
      if (body.style.overflowY !== 'hidden') body.style.overflowY = 'hidden';
      if (chevron) chevron.style.transform = '';
      if (action)  action.textContent = 'Ver pedido e finalizar';
      if (head) head.setAttribute('aria-expanded', 'false');
    }
    if (semAnimacao) {
      // Restaura a transition no proximo frame, para que o toggle manual do
      // usuario continue animando normalmente.
      requestAnimationFrame(function () {
        body.style.transition = transicaoAnterior || '';
      });
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

    // Nº curto do pedido: aparece na mensagem e no histórico do lojista.
    const pedidoId = (Date.now().toString(36).slice(-4) + Math.random().toString(36).slice(2, 4)).toUpperCase();
    const msg = `Olá! Fiz um pedido pelo AngatubaON 🛒\n🧾 *Pedido #${pedidoId}*\n\n${linhas.join('\n')}\n\n${valoresBloco}${entregaLine}${obsLine}\n\nPoderia confirmar?`;
    const url = `https://wa.me/${loja.wpp}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank', 'noopener');
    // Métrica de pedido (o dado que prova resultado pro lojista).
    try {
      const resumo = itens.map(l => l.qty + '× ' + l.item.nome).join(', ').slice(0, 200);
      registrarClique(loja.nome, 'pedido', loja.plano || 'GRATIS', loja.categoria || '', pedidoId, total, resumo);
    } catch (e) {}

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

  /* ══════════════════════════════════════════════════════════════
     AUTENTICAÇÃO DE CLIENTE (Firebase Auth)
     — Camada 1 (Forma A): login/cadastro + estado logado no header.
     — NÃO envia nada ao GAS ainda. Rank e porteiro virão nas próximas
       camadas. Identidade fica 100% no Firebase; aqui só refletimos o
       estado de sessão na UI.
     — Isolado de propósito: o sistema de LOJISTA (WhatsApp+código) é
       intocado. Este módulo só cuida do CLIENTE (morador).
  ══════════════════════════════════════════════════════════════ */

  /* ── IDENTIDADE: dois níveis, de propósito ─────────────────────
     O Firebase Auth deste app tem DOIS tipos de sessão:

     1. ANÔNIMA — criada sozinha por multiplayer.js / party.js /
        baralho.js só pra ter permissão de escrever na sala do
        Realtime Database. Entrar numa sala por código NUNCA exige
        conta; essa sessão é descartável e não é "eu".
     2. CONTA NOMEADA — Google ou e-mail/senha, feita pela pessoa.
        É esta que vale como identidade: ranking, recordes, foto,
        favoritos, progresso do Aprender e (a partir da 4.2) a
        camada social.

     `_cliUser` guarda SOMENTE o nível 2. Sessão anônima entra aqui
     como null — senão o app trataria um convidado de sala como
     logado: avatar "?" no header, painel de conta vazio e, pior,
     o ranking da cidade recebendo docs "Jogador" de uids
     descartáveis (as regras do Firestore só exigem auth != null,
     então quem barra isso é o cliente).
     Quem precisa da sessão crua (inclusive anônima) usa
     firebase.auth().currentUser direto, como o multiplayer faz. */
  var _cliUser = null;              // conta NOMEADA logada, ou null
  var _cliApelido = null;          // nome/apelido de exibição escolhido

  // Chave local só para lembrar o apelido preferido entre reloads antes
  // de o Firebase reidratar o usuário (evita "piscar" sem nome).
  var CLI_APELIDO_KEY = 'angatuba_cli_apelido';

  // Limite do nome de exibição. Igual ao das regras do Firestore
  // (nome.size() <= 20 em scoreValido) e ao slice(0,20) que
  // multiplayer/party/baralho aplicam — um número só, um lugar só.
  var CLI_NOME_MAX = 20;

  // Uma sessão só conta como identidade se for conta nomeada.
  function _cliContaReal(u) { return !!u && !u.isAnonymous; }

  /* Fonte única do "quem sou eu" visível: o apelido escolhido, senão
     o displayName do provedor, sempre trimado e truncado igual em
     todo lugar (header, painel, ranking, salas de multiplayer).
     Retorna null quando não há conta nomeada — inclusive quando
     sobrou apelido no localStorage de um login anterior, pra esse
     nome antigo nunca vazar pra uma sessão anônima. */
  function cliNomeExibicao() {
    if (!_cliContaReal(_cliUser)) return null;
    var nome = String(_cliApelido || _cliUser.displayName || '')
      .trim().slice(0, CLI_NOME_MAX).trim();
    return nome || null;
  }

  /* ── Inicialização do Firebase ──────────────────────────────
     firebase (namespace compat) é injetado sob demanda por
     _carregarFirebaseAuthCore() (ver acima, perto de _jogoLoader), em
     paralelo ao boot — pode ainda não existir no exato instante em que
     este arquivo roda. Guardamos referência ao auth uma vez carregado.
     Se por algum motivo o SDK não carregar (offline no primeiro load,
     bloqueio de rede), degradamos com elegância: o app inteiro continua
     funcionando, só o login fica indisponível. */
  var _fbAuth = null;
  function _cliFirebaseAuth() {
    if (_fbAuth) return _fbAuth;
    if (typeof firebase === 'undefined' || !firebase.auth) return null;
    try { _fbAuth = firebase.auth(); } catch (e) { _fbAuth = null; }
    return _fbAuth;
  }

  // Chamado no boot. Liga o "ouvinte" de estado de auth do Firebase:
  // sempre que alguém loga/desloga (inclusive reidratação silenciosa ao
  // reabrir o app), este callback roda e sincroniza a UI.
  function cliAuthInit() {
    const auth = _cliFirebaseAuth();
    // Trunca na leitura também: valores salvos por versões antigas (antes
    // do limite ser aplicado na entrada) podem passar de 20 caracteres.
    _cliApelido = String(localStorage.getItem(CLI_APELIDO_KEY) || '')
      .trim().slice(0, CLI_NOME_MAX).trim() || null;
    if (!auth) {
      // SDK indisponível: mantém UI deslogada, sem quebrar nada.
      cliAtualizarHeader();
      return;
    }
    // Persistência local: mantém o cliente logado entre sessões (é o
    // padrão do Firebase web, mas deixamos explícito).
    try { auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL); } catch (e) {}

    auth.onAuthStateChanged(function (user) {
      var estavaDeslogado = !_cliUser;
      // Sessão anônima (sala de multiplayer) NÃO é identidade: entra
      // aqui como deslogado. Ver o bloco de comentário lá em cima.
      _cliUser = _cliContaReal(user) ? user : null;
      // Biblioteca: troca listas/progresso pro dono certo (só age se ela
      // já foi aberta nesta sessão — ver _bibAoMudarConta em Biblioteca/hub.js).
      if (typeof _bibAoMudarConta === 'function') { try { _bibAoMudarConta(); } catch (e) {} }
      // Lojas favoritas (Fase 2): troca pra lista da conta que entrou (e
      // sincroniza) ou volta pra do visitante ao sair.
      try { _favAoMudarConta(); } catch (e) {}
      // Aprender: mescla o progresso com o lang_progress da conta que entrou
      // (só age se o módulo já foi aberto nesta sessão — ver _aprAoMudarConta
      // em Aprender/hub.js; senão a 1ª abertura sincroniza sozinha).
      if (typeof _aprAoMudarConta === 'function') { try { _aprAoMudarConta(); } catch (e) {} }
      if (_cliUser) {
        // Preferimos o displayName do Firebase; se não houver (ex.: e-mail
        // sem nome ainda), caímos no apelido salvo localmente.
        _cliApelido = (user.displayName || _cliApelido || '').trim().slice(0, CLI_NOME_MAX) || null;
        if (_cliApelido) localStorage.setItem(CLI_APELIDO_KEY, _cliApelido);
        // Celular compartilhado (decisão A): progresso local dos jogos é de
        // uma conta por vez — outra conta entrando isola o da anterior (ver
        // _progressoGarantirDono em Jogos/hub.js). Antes do _rankPendente
        // abaixo, pra ele não subir recorde local de outra pessoa. Hub
        // ainda não carregado: ele mesmo confere ao carregar.
        if (typeof _progressoGarantirDono === 'function') _progressoGarantirDono();
        // Acabou de logar e havia uma pontuação feita deslogado? Submete
        // agora. O rankSubmeter já reconcilia com o recorde local do
        // dispositivo (sobe o maior entre a partida e o recorde salvo),
        // então o recorde histórico feito deslogado sobe aqui. O Firestore
        // aplica recorde/teto.
        // _rankPendente só existe depois que o Jogos/hub.js carrega (ver
        // rankFimDeJogo) — typeof evita ReferenceError em quem logou sem
        // nunca ter aberto o hub nesta sessão (ex.: só postar um aviso).
        if (estavaDeslogado && typeof _rankPendente !== 'undefined' && _rankPendente) {
          var pend = _rankPendente;
          _rankPendente = null;
          if (typeof rankSubmeter === 'function') rankSubmeter(pend.jogo, pend.score);
          // Relê o ranking após a escrita propagar e atualiza a tela de fim.
          if (typeof _rankAtualizarSlotAposLogin === 'function') {
            setTimeout(function () { _rankAtualizarSlotAposLogin(pend.jogo, pend.score); }, 1100);
          }
        }
        // Presença (4.2): só conta nomeada entra. Adiado pra depois do
        // boot assentar — baixa o SDK do Realtime Database, e isso não
        // pode competir com a primeira pintura da tela.
        setTimeout(_presencaIniciar, 2000);
        // Convites pra jogar (4.4): a caixa fica ouvindo enquanto a
        // conta estiver logada, não só com o painel aberto — é o que
        // faz o aviso chegar em quem está na home. Entra depois da
        // presença pelo mesmo motivo (não disputar a primeira
        // pintura); o SDK já vem carregado por ela.
        setTimeout(_convObservarCaixa, 2600);
        // Pedidos de amizade (P1): escuta global irmã da caixa de
        // convites, pra o aviso no topo chegar sem abrir o painel.
        // Logo depois dela — o SDK já veio com a presença.
        setTimeout(_pedObservarGlobal, 2700);
        // Lobby social (5.2): a escuta vive com a conta logada, não com a
        // tela aberta — é ela que põe o chip do lobby na faixa de avisos
        // pra quem está na home.
        setTimeout(_lobUiObservar, 2800);
        // Convites de LOBBY (L1): irmã da caixa de convites de jogo.
        // Nó diferente (lobbyInvites), assunto diferente — ver o bloco
        // "CONVIDAR AMIGO PRO LOBBY".
        setTimeout(_lobConvObservar, 2900);
        // Chat 1x1 (Fase 2): caixa de conversas — contadores e aviso de
        // mensagem nova, mesmo esquema das escutas acima.
        setTimeout(_chatObservarCaixa, 2950);
        // Push (FCM, preparação): por último — pede permissão (se ainda
        // não decidida) e guarda o token. Só depois de todo o resto do
        // social ter assentado, pelo mesmo motivo dos timers acima.
        setTimeout(_fcmIniciar, 3000);
      } else {
        // Deslogou (ou é sessão anônima de sala): tira do ar.
        _presencaParar();
        _convPararCaixa();
        _pedPararGlobal();
        // Chat 1x1: nada da conta anterior fica na tela.
        if (_chatAberto()) cliFecharChat();
        _chatPararCaixa();
        // Lobby social (5.1): sai do lobby ANTES de o token morrer —
        // depois do signOut as regras recusam a escrita e a entrada só
        // sumiria quando a conexão caísse. A UI (5.2) solta primeiro: o
        // null do sair não pode virar "o lobby foi encerrado" na tela de
        // quem só deslogou.
        _lobUiSoltar();
        _lobConvParar();
        _lobSair();
        _avisoLimpar();
        // Código curto (P2) é por conta: o da conta que saiu não pode
        // sobrar em cache pra próxima pessoa deste aparelho.
        _amCodigoLimpar();
        // Push (FCM): apaga o token desta conta (best-effort — se já
        // não há mais auth válido, a escrita falha em silêncio e só o
        // cache local sai) e limpa o cache, pro próximo login decidir
        // de novo.
        _fcmParar();
      }
      cliAtualizarHeader();
    });

    // Fix A1.21: sem isto, a volta do signInWithRedirect (fallback de
    // cliEntrarGoogle quando o popup é bloqueado) nunca era processada
    // explicitamente — o onAuthStateChanged acima acaba resolvendo o login
    // na maioria dos navegadores, mas o toast de boas-vindas nunca aparecia,
    // e em navegadores com bloqueio mais estrito de cookies de terceiros o
    // fluxo podia falhar em silêncio.
    auth.getRedirectResult().then(function (result) {
      var u = result && result.user;
      if (u && typeof showToastSimples === 'function') {
        showToastSimples('Bem-vindo, ' + (u.displayName || 'você') + '!', '/webp/owl-wave.webp');
      }
    }).catch(function () { /* sem redirect pendente, ou falhou — onAuthStateChanged já cobre o caso comum */ });
  }

  /* ── Header: avatar quando logado, nada quando deslogado ────
     Regra de produto (login sob demanda): deslogado → header limpo
     (logo + botão de tema). Logado → avatar do cliente aparece; o
     controle de tema migra para DENTRO do painel do avatar. */
  function cliAtualizarHeader() {
    if (typeof _atualizarAdminAvisosUI === 'function') _atualizarAdminAvisosUI();
    const slot = document.getElementById('cli-account-slot');
    const themeBtn = document.getElementById('theme-toggle-btn');
    if (!slot) return;

    if (_cliUser) {
      // Logado: monta/mostra o avatar; esconde o botão de tema do header
      // (ele reaparece dentro do painel).
      const nome = cliNomeExibicao() || 'Você';
      const inicial = (nome.trim()[0] || '?').toUpperCase();
      const foto = _cliUser.photoURL || '';

      slot.innerHTML =
        '<button class="cli-avatar-btn" id="cli-avatar-btn" ' +
        'onclick="cliAbrirPainelConta()" aria-label="Minha conta" title="Minha conta">' +
        (foto
          ? '<img src="' + escAttr(foto) + '" alt="" class="cli-avatar-img" ' +
            'onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'"/>' +
            '<span class="cli-avatar-ini" style="display:none">' + escHTML(inicial) + '</span>'
          : '<span class="cli-avatar-ini">' + escHTML(inicial) + '</span>') +
        '</button>';
      slot.style.display = 'flex';
      if (themeBtn) themeBtn.style.display = 'none';
      // Contador de mensagens do chat 1x1 (o avatar acabou de ser refeito).
      _chatPintarBadges();
    } else {
      // Deslogado: sem avatar; botão de tema volta ao header.
      slot.innerHTML = '';
      slot.style.display = 'none';
      if (themeBtn) themeBtn.style.display = '';
    }
  }

  /* ── Abrir a tela de login/cadastro do cliente ──────────────
     ponto de entrada único. `motivo` é um texto opcional para explicar
     por que o login está sendo pedido (ex.: vindo do rank no futuro). */
  function cliAbrirLogin(motivo) {
    const overlay = document.getElementById('modal-cli-login');
    if (!overlay) return;
    cliLoginStep('escolha');
    // Mensagem contextual (só aparece quando há motivo).
    const sub = document.getElementById('cli-login-sub');
    if (sub) {
      sub.textContent = motivo ||
        'Entre para salvar sua pontuação e aparecer no ranking da cidade.';
    }
    // Limpa campos de sessões anteriores.
    ['cli-email', 'cli-senha', 'cli-apelido', 'cli-email-cad', 'cli-senha-cad']
      .forEach(function (id) { const el = document.getElementById(id); if (el) el.value = ''; });
    _cliLimparErros();
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    if (history.state?.modal !== 'cli-login') history.pushState({ modal: 'cli-login' }, '');
  }

  function cliFecharLogin(viaPopstate) {
    const overlay = document.getElementById('modal-cli-login');
    if (!overlay) return;
    overlay.classList.remove('open');
    document.body.style.overflow = '';
    if (!viaPopstate && history.state?.modal === 'cli-login') { _popstateNosso = true; history.back(); }
  }

  // Alterna entre as três telas do modal: escolha inicial, form de
  // login por e-mail, e form de cadastro por e-mail.
  function cliLoginStep(step) {
    const mapa = {
      escolha: 'cli-step-escolha',
      login: 'cli-step-login',
      cadastro: 'cli-step-cadastro'
    };
    Object.keys(mapa).forEach(function (k) {
      const el = document.getElementById(mapa[k]);
      if (el) el.style.display = (k === step) ? 'flex' : 'none';
    });
    _cliLimparErros();
  }

  function _cliLimparErros() {
    document.querySelectorAll('.cli-field-err').forEach(function (e) {
      e.textContent = ''; e.classList.remove('show');
    });
  }

  function _cliMostrarErro(id, msg) {
    const el = document.getElementById(id);
    if (el) { el.textContent = msg; el.classList.add('show'); }
  }

  // Traduz os códigos de erro do Firebase para PT-BR amigável.
  // Mensagens no registro da interface: dizem o que houve e o que fazer,
  // sem jargão técnico.
  function _cliErroFirebasePt(code) {
    switch (code) {
      case 'auth/invalid-email':          return 'E-mail inválido. Confira e tente de novo.';
      case 'auth/user-disabled':          return 'Esta conta foi desativada.';
      case 'auth/user-not-found':         return 'Não achamos uma conta com esse e-mail.';
      case 'auth/wrong-password':
      case 'auth/invalid-credential':     return 'E-mail ou senha incorretos.';
      case 'auth/email-already-in-use':   return 'Este e-mail já tem conta. Tente entrar.';
      case 'auth/weak-password':          return 'A senha precisa de pelo menos 6 caracteres.';
      case 'auth/too-many-requests':      return 'Muitas tentativas. Espere um pouco e tente de novo.';
      case 'auth/network-request-failed': return 'Sem conexão. Verifique a internet e tente de novo.';
      case 'auth/popup-closed-by-user':   return 'Janela do Google fechada antes de concluir.';
      case 'auth/popup-blocked':          return 'O navegador bloqueou a janela do Google.';
      case 'auth/account-exists-with-different-credential':
        return 'Este e-mail já tem conta por outro método. Tente entrar com e-mail e senha.';
      default:                            return 'Algo deu errado. Tente de novo em instantes.';
    }
  }

  /* ── Entrar com Google ──────────────────────────────────────
     Usa popup no desktop; em alguns WebViews de celular o popup falha,
     então caímos para redirect automaticamente. */
  function cliEntrarGoogle() {
    const auth = _cliFirebaseAuth();
    if (!auth) { _cliMostrarErro('cli-erro-escolha', 'Login indisponível agora. Tente recarregar o app.'); return; }
    const provider = new firebase.auth.GoogleAuthProvider();
    const btn = document.getElementById('cli-btn-google');
    if (btn) { btn.disabled = true; btn.classList.add('is-loading'); }

    auth.signInWithPopup(provider)
      .then(function (result) {
        // displayName do Google já vira o apelido inicial (a pessoa pode
        // trocar depois no painel da conta).
        const u = result.user;
        if (u && u.displayName) {
          // Trunca já na entrada: nome do Google costuma passar de 20
          // caracteres e o ranking/multiplayer trabalham com esse limite.
          _cliApelido = u.displayName.trim().slice(0, CLI_NOME_MAX).trim();
          if (_cliApelido) localStorage.setItem(CLI_APELIDO_KEY, _cliApelido);
        }
        cliFecharLogin();
        if (typeof showToastSimples === 'function') {
          showToastSimples('Bem-vindo, ' + (u.displayName || 'você') + '!', '/webp/owl-wave.webp');
        }
      })
      .catch(function (err) {
        // Popup bloqueado/fechado → tenta redirect como plano B.
        if (err && (err.code === 'auth/popup-blocked')) {
          try { auth.signInWithRedirect(provider); return; } catch (e) {}
        }
        _cliMostrarErro('cli-erro-escolha', _cliErroFirebasePt(err && err.code));
      })
      .finally(function () {
        if (btn) { btn.disabled = false; btn.classList.remove('is-loading'); }
      });
  }

  /* ── Entrar com e-mail + senha ──────────────────────────────*/
  function cliEntrarEmail() {
    const auth = _cliFirebaseAuth();
    if (!auth) { _cliMostrarErro('cli-erro-login', 'Login indisponível agora. Tente recarregar o app.'); return; }
    const email = (document.getElementById('cli-email').value || '').trim();
    const senha = document.getElementById('cli-senha').value || '';
    _cliLimparErros();
    if (!email) { _cliMostrarErro('cli-erro-login', 'Digite seu e-mail.'); return; }
    if (!senha) { _cliMostrarErro('cli-erro-login', 'Digite sua senha.'); return; }

    const btn = document.getElementById('cli-btn-entrar-email');
    if (btn) { btn.disabled = true; btn.classList.add('is-loading'); }

    auth.signInWithEmailAndPassword(email, senha)
      .then(function () {
        cliFecharLogin();
        if (typeof showToastSimples === 'function') {
          showToastSimples('Bem-vindo de volta!', '/webp/owl-wave.webp');
        }
      })
      .catch(function (err) {
        _cliMostrarErro('cli-erro-login', _cliErroFirebasePt(err && err.code));
      })
      .finally(function () {
        if (btn) { btn.disabled = false; btn.classList.remove('is-loading'); }
      });
  }

  /* ── Criar conta com e-mail + senha + apelido ───────────────
     Depois de criar, gravamos o apelido como displayName no perfil
     Firebase (updateProfile), para o rank futuro já ter nome pronto. */
  function cliCriarConta() {
    const auth = _cliFirebaseAuth();
    if (!auth) { _cliMostrarErro('cli-erro-cadastro', 'Cadastro indisponível agora. Tente recarregar o app.'); return; }
    const apelido = (document.getElementById('cli-apelido').value || '').trim();
    const email   = (document.getElementById('cli-email-cad').value || '').trim();
    const senha   = document.getElementById('cli-senha-cad').value || '';
    _cliLimparErros();

    if (!apelido)             { _cliMostrarErro('cli-erro-cadastro', 'Escolha um nome ou apelido para aparecer no ranking.'); return; }
    if (apelido.length < 2)   { _cliMostrarErro('cli-erro-cadastro', 'O nome precisa de pelo menos 2 letras.'); return; }
    if (apelido.length > 20)  { _cliMostrarErro('cli-erro-cadastro', 'O nome pode ter no máximo 20 caracteres.'); return; }
    if (!email)               { _cliMostrarErro('cli-erro-cadastro', 'Digite seu e-mail.'); return; }
    if (senha.length < 6)     { _cliMostrarErro('cli-erro-cadastro', 'A senha precisa de pelo menos 6 caracteres.'); return; }

    const btn = document.getElementById('cli-btn-criar');
    if (btn) { btn.disabled = true; btn.classList.add('is-loading'); }

    auth.createUserWithEmailAndPassword(email, senha)
      .then(function (cred) {
        _cliApelido = apelido;
        localStorage.setItem(CLI_APELIDO_KEY, apelido);
        // Grava o apelido no perfil Firebase (não bloqueia o sucesso se falhar).
        if (cred.user && cred.user.updateProfile) {
          cred.user.updateProfile({ displayName: apelido }).catch(function () {});
        }
        cliFecharLogin();
        if (typeof showToastSimples === 'function') {
          showToastSimples('Conta criada! Bem-vindo, ' + apelido + '!', '/webp/owl-celebrate-gratis.webp');
        }
      })
      .catch(function (err) {
        _cliMostrarErro('cli-erro-cadastro', _cliErroFirebasePt(err && err.code));
      })
      .finally(function () {
        if (btn) { btn.disabled = false; btn.classList.remove('is-loading'); }
      });
  }

  /* ── Painel da conta (abre ao tocar no avatar) ──────────────
     Contém: saudação, controle de TEMA (migrado do header) e sair.
     Reusa o modal-overlay padrão para consistência visual. */
  function cliAbrirPainelConta() {
    const overlay = document.getElementById('modal-cli-conta');
    if (!overlay) return;
    const nome = cliNomeExibicao() || 'Você';
    const email = (_cliUser && _cliUser.email) || '';
    const nomeEl = document.getElementById('cli-conta-nome');
    const emailEl = document.getElementById('cli-conta-email');
    if (nomeEl) nomeEl.textContent = nome;
    if (emailEl) emailEl.textContent = email;
    // Avatar do painel: foto do usuário se houver, senão a inicial.
    cliPintarAvatarPainel(nome);
    // Sincroniza o rótulo do botão de tema dentro do painel com o estado atual.
    if (typeof cliSincronizarTemaLabel === 'function') cliSincronizarTemaLabel();
    if (typeof cliSincronizarSonsLabel === 'function') cliSincronizarSonsLabel();
    // Preenche recordes dos jogos e lojas favoritas (assíncrono, sem travar a abertura).
    // cliRenderRecordes vive no Jogos/hub.js (lazy) — quem abre a conta sem
    // nunca ter aberto os jogos nesta sessão ainda não tem essa função;
    // carrega o hub em paralelo e preenche assim que estiver pronto.
    // Junto com os recordes vêm os cosméticos do banner (fundo, moldura e
    // títulos equipados), que também moram no hub.
    _cliContaResumo = { amigos: null, recordes: null, lojas: null, livros: null };
    _cliContaGradePintar();
    _cliContaHeroCosmeticos();
    if (typeof cliRenderRecordes === 'function') {
      cliRenderRecordes();
    } else if (typeof _carregarHubJogos === 'function') {
      _carregarHubJogos().then(function () {
        if (typeof cliRenderRecordes === 'function') cliRenderRecordes();
        _cliContaHeroCosmeticos();
      }).catch(function () {});
    }
    cliRenderFavoritos();
    cliRenderBiblioteca();
    // Amigos (4.3): liga os listeners só enquanto o painel está aberto.
    cliAmigosRender();
    // Garante o binding do seletor de foto (idempotente).
    cliBindFotoInput();
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    if (history.state?.modal !== 'cli-conta') history.pushState({ modal: 'cli-conta' }, '');
  }

  /* ── Avatar do painel (foto ou inicial) ───────────────
     Preenche o bloco de avatar grande do painel. Se o Firebase user tem
     photoURL, mostra a imagem (com fallback pra inicial em caso de erro).
     Senão, mostra a inicial. */
  function cliPintarAvatarPainel(nome) {
    const wrap = document.getElementById('cli-conta-avatar');
    if (!wrap) return;
    const inicial = ((nome || '').trim()[0] || '?').toUpperCase();
    const foto = (_cliUser && _cliUser.photoURL) || '';
    if (foto) {
      wrap.innerHTML =
        '<img src="' + foto + '" alt="" class="cli-conta-avatar-img" ' +
        'onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'"/>' +
        '<span class="cli-conta-avatar-ini2" style="display:none">' + inicial + '</span>';
    } else {
      wrap.innerHTML = '<span class="cli-conta-avatar-ini2">' + inicial + '</span>';
    }
    // Badge de câmera sempre por cima (troca de foto).
    wrap.innerHTML +=
      '<button type="button" class="cli-conta-avatar-cam" onclick="cliEscolherFoto()" ' +
      'aria-label="Trocar foto" title="Trocar foto"><i class="fa fa-camera"></i></button>';
    // Pontinho de presença (4.2), canto oposto ao da câmera. Estilo
    // inline de propósito: são 6 propriedades num elemento só, não vale
    // uma regra nova no styles.css (e evita subir o CSS por causa disto).
    wrap.innerHTML +=
      '<span id="cli-conta-presenca" style="position:absolute;top:2px;right:2px;' +
      'width:12px;height:12px;border-radius:50%;border:2px solid var(--card,#fff);' +
      'background:#94a3b8;pointer-events:none;"></span>';
    _presPintarIndicador();
  }

  /* ── Trocar apelido/nome ──────────────────────
     Abre um prompt inline simples (reusa o campo do painel). Atualiza o
     displayName no Firebase e o espelho local. Client-side puro. */
  function cliEditarApelido() {
    const row = document.getElementById('cli-conta-apelido-edit');
    const view = document.getElementById('cli-conta-apelido-view');
    const inp = document.getElementById('cli-conta-apelido-input');
    if (!row || !view || !inp) return;
    view.style.display = 'none';
    row.style.display = 'flex';
    inp.value = cliNomeExibicao() || '';
    try { inp.focus(); inp.select(); } catch (e) {}
  }

  function cliCancelarApelido() {
    const row = document.getElementById('cli-conta-apelido-edit');
    const view = document.getElementById('cli-conta-apelido-view');
    if (row) row.style.display = 'none';
    if (view) view.style.display = 'flex';
  }

  /* ── Espelhar apelido/foto novos no ranking (gap 4.2) ──────────────
     rankAtualizarIdentidade (Jogos/hub.js) corrige nome/foto nos docs
     de ranking que a pessoa já tem, sem mexer no score. Se o hub ainda
     não foi carregado (quem nunca abriu Joguinhos), carrega ele e o
     Firestore sob demanda só pra isso — silencioso: uma falha aqui não
     pode atrapalhar o painel de conta, e quem não tem doc de ranking
     nenhum simplesmente não faz nada (ver rankAtualizarIdentidade). */
  function _cliEspelharIdentidadeNoRanking() {
    try {
      if (typeof rankAtualizarIdentidade === 'function') {
        rankAtualizarIdentidade();
        return;
      }
      _carregarHubJogos().then(function () {
        try {
          if (typeof _carregarFirebaseJogos !== 'function') return;
          _carregarFirebaseJogos().then(function () {
            try {
              if (typeof rankAtualizarIdentidade === 'function') rankAtualizarIdentidade();
            } catch (e) {}
          }).catch(function () {});
        } catch (e) {}
      }).catch(function () {});
    } catch (e) {}
  }

  function cliSalvarApelido() {
    const inp = document.getElementById('cli-conta-apelido-input');
    if (!inp) return;
    const novo = String(inp.value || '').trim().slice(0, CLI_NOME_MAX).trim();
    if (!novo) {
      if (typeof showToastSimples === 'function') showToastSimples('Escolha um apelido.', '/webp/owl-idea.webp');
      return;
    }
    // Mesma mínima do cadastro e das regras do Firestore (nome >= 2):
    // sem isto, um apelido de 1 letra era aceito aqui e depois virava
    // "Jogador" na hora de gravar o ranking — a pessoa via um nome no
    // painel e outro na lista.
    if (novo.length < 2) {
      if (typeof showToastSimples === 'function') showToastSimples('O apelido precisa de pelo menos 2 letras.', '/webp/owl-idea.webp');
      return;
    }
    const btn = document.getElementById('cli-conta-apelido-salvar');
    if (btn) btn.disabled = true;
    const finalizar = function () {
      _cliApelido = novo;
      try { localStorage.setItem(CLI_APELIDO_KEY, novo); } catch (e) {}
      const nomeEl = document.getElementById('cli-conta-nome');
      if (nomeEl) nomeEl.textContent = novo;
      cliPintarAvatarPainel(novo);
      cliAtualizarHeader();
      // Presença guarda o nome junto do state — reescreve pra 4.3 não
      // mostrar o apelido antigo na lista de amigos.
      try { window.AngatubaPresenca.atualizarNome(); } catch (e) {}
      _cliEspelharIdentidadeNoRanking();
      cliCancelarApelido();
      if (btn) btn.disabled = false;
      if (typeof showToastSimples === 'function') showToastSimples('Apelido atualizado!', '/webp/owl-thumbsup.webp');
    };
    const user = _cliUser;
    if (user && typeof user.updateProfile === 'function') {
      user.updateProfile({ displayName: novo }).then(finalizar).catch(function () {
        // Mesmo se o Firebase falhar, guardamos localmente para não perder.
        finalizar();
      });
    } else {
      finalizar();
    }
  }

  /* ── Foto de perfil (Cloudinary unsigned → photoURL do Firebase) ─
     Fluxo (mesma filosofia da Opção D: sem GAS):
       1. usuário escolhe imagem (input file)
       2. comprime no browser (reusa _mlRedimensionarImagem se existir)
       3. sobe direto pro Cloudinary com preset unsigned 'perfil_cliente'
       4. grava secure_url no photoURL via updateProfile
     Segurança fica nas travas do preset no painel do Cloudinary. */
  var CLI_CLOUD_NAME = 'dpzhxyfsh';
  var CLI_UPLOAD_PRESET = 'perfil_cliente';
  var _cliFotoBindOk = false;

  function cliBindFotoInput() {
    if (_cliFotoBindOk) return;
    const inp = document.getElementById('cli-conta-foto-input');
    if (!inp) return;
    inp.addEventListener('change', function () {
      const file = inp.files && inp.files[0];
      if (file) cliUploadFoto(file);
      inp.value = '';
    });
    _cliFotoBindOk = true;
  }

  function cliEscolherFoto() {
    cliBindFotoInput();
    const inp = document.getElementById('cli-conta-foto-input');
    if (inp) inp.click();
  }

  function _cliSetStatusFoto(txt, cor) {
    const el = document.getElementById('cli-conta-foto-status');
    if (!el) return;
    el.textContent = txt || '';
    el.style.color = cor || 'var(--muted)';
    el.style.display = txt ? 'block' : 'none';
  }

  async function cliUploadFoto(file) {
    if (!file || !/^image\//.test(file.type)) {
      _cliSetStatusFoto('Escolha uma imagem.', 'var(--red)');
      return;
    }
    _cliSetStatusFoto('⏳ Otimizando...', 'var(--muted)');
    try {
      // Reusa a compressão do fluxo de loja se disponível (avatar ~512px basta).
      if (typeof _mlRedimensionarImagem === 'function') {
        file = await _mlRedimensionarImagem(file, 512, 0.85);
      }
      if (file.size > 5 * 1024 * 1024) {
        _cliSetStatusFoto('Imagem muito grande (máx 5MB).', 'var(--red)');
        return;
      }
      _cliSetStatusFoto('⏳ Enviando...', 'var(--muted)');
      const fd = new FormData();
      fd.append('file', file);
      fd.append('upload_preset', CLI_UPLOAD_PRESET);
      const resp = await fetch(
        'https://api.cloudinary.com/v1_1/' + CLI_CLOUD_NAME + '/image/upload',
        { method: 'POST', body: fd, signal: AbortSignal.timeout(60000) }
      );
      const json = await resp.json();
      if (!json || !json.secure_url) {
        throw new Error((json && json.error && json.error.message) || 'Falha no upload');
      }
      const url = json.secure_url;
      const finalizar = function () {
        // Atualiza a UI imediatamente (o photoURL local do objeto também).
        try { if (_cliUser) _cliUser.photoURL = url; } catch (e) {}
        cliPintarAvatarPainel(cliNomeExibicao() || 'Você');
        cliAtualizarHeader();
        // Espelha a foto nova na lista dos amigos (P3). Silencioso e
        // sem await: se falhar, a foto antiga só continua lá até o
        // próximo aceite — nada na troca de foto depende disto.
        try {
          if (window.AngatubaAmigos && window.AngatubaAmigos.atualizarFoto) {
            window.AngatubaAmigos.atualizarFoto();
          }
        } catch (e) {}
        _cliEspelharIdentidadeNoRanking();
        _cliSetStatusFoto('', null);
        if (typeof showToastSimples === 'function') showToastSimples('Foto atualizada!', '/webp/owl-celebrate-gratis.webp');
      };
      const user = _cliUser;
      if (user && typeof user.updateProfile === 'function') {
        user.updateProfile({ photoURL: url }).then(finalizar).catch(finalizar);
      } else {
        finalizar();
      }
    } catch (err) {
      _cliSetStatusFoto('Erro: ' + (err && err.message ? err.message : 'tente de novo'), 'var(--red)');
    }
  }



  /* ── Lojas favoritas ───────────────────────
     Lista as lojas favoritadas (localStorage). Casa cada id favorito com
     a loja em LOJAS para exibir nome/logo e abrir o modal ao tocar. */
  function cliRenderFavoritos() {
    var wrap = document.getElementById('cli-conta-favoritos');
    var vazio = document.getElementById('cli-conta-favoritos-vazio');
    if (!wrap) return;
    var ids = (typeof _favoritos !== 'undefined' && Array.isArray(_favoritos)) ? _favoritos : [];
    var lojas = (typeof LOJAS !== 'undefined' && Array.isArray(LOJAS)) ? LOJAS : [];
    var itens = [];
    ids.forEach(function (idFav) {
      var idx = -1, loja = null;
      for (var i = 0; i < lojas.length; i++) {
        var l = lojas[i];
        var lid = (typeof favIdDeLoja === 'function') ? favIdDeLoja(l)
                 : String((l && (l.id || l.wpp || l.nome)) || '').trim().toLowerCase();
        var lnome = String((l && l.nome) || '').trim().toLowerCase();
        if (lid === idFav || lnome === idFav) { idx = i; loja = l; break; }
      }
      if (loja) itens.push({ idx: idx, loja: loja });
    });
    cliContaResumoSet('lojas', itens.length);
    if (!itens.length) {
      wrap.innerHTML = '';
      if (vazio) vazio.style.display = 'block';
      return;
    }
    if (vazio) vazio.style.display = 'none';
    wrap.innerHTML = itens.map(function (it) {
      var l = it.loja;
      var nome = String(l.nome || 'Loja');
      var logo = (l.logo && String(l.logo).trim()) ? String(l.logo).trim() : '';
      var ini = (nome.trim()[0] || '?').toUpperCase();
      var thumb = logo
        ? '<img src="' + escAttr(logo) + '" alt="" class="cli-fav-logo" loading="lazy" ' +
          'onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'"/>' +
          '<span class="cli-fav-ini" style="display:none">' + escHTML(ini) + '</span>'
        : '<span class="cli-fav-ini">' + escHTML(ini) + '</span>';
      var onclick = (it.idx >= 0)
        ? ' onclick="cliAbrirLojaFav(' + it.idx + ')" role="button" tabindex="0"'
        : '';
      return '<div class="cli-fav-item"' + onclick + '>' +
        '<span class="cli-fav-thumb">' + thumb + '</span>' +
        '<span class="cli-fav-nome">' + escHTML(nome) + '</span>' +
        '<i class="fa fa-chevron-right cli-fav-seta"></i></div>';
    }).join('');
  }

  /* ── Resumo 2×2 do painel (mesma grade do "Meu perfil" dos jogos) ──
     Cada seção do painel avisa a sua contagem via cliContaResumoSet
     quando termina de carregar; enquanto não chega, o card mostra "—".
     Mesmo HTML/classes de _perfilGradeHtml (Jogos/hub.js), mas montado
     aqui porque o painel não depende do hub de jogos estar carregado. */
  var _cliContaResumo = { amigos: null, recordes: null, lojas: null, livros: null };
  var CLI_CONTA_GRADE = [
    ['amigos', 'Amigos'], ['recordes', 'Recordes'], ['lojas', 'Lojas'], ['livros', 'Livros']
  ];
  function cliContaResumoSet(chave, valor) {
    if (_cliContaResumo[chave] === valor) return;
    _cliContaResumo[chave] = valor;
    _cliContaGradePintar();
  }
  function _cliContaGradePintar() {
    var el = document.getElementById('cli-conta-grade');
    if (!el) return;
    el.innerHTML = CLI_CONTA_GRADE.map(function (g) {
      var v = _cliContaResumo[g[0]];
      var txt = (v == null) ? '—' : String(v);
      var vazio = (v == null || v === 0);
      return '<div class="perfil-grade-item' + (vazio ? ' perfil-grade-item-vazio' : '') + '">' +
        '<div class="perfil-grade-num">' + txt + '</div>' +
        '<div class="perfil-grade-label">' + g[1] + '</div></div>';
    }).join('');
  }

  /* ── Banner do painel com os cosméticos dos jogos ──
     Reaproveita as funções do "Meu perfil" (Jogos/hub.js) pra o banner
     ficar idêntico ao de lá: fundo (_perfilBgEstilo), moldura do card
     (_perfilCardClasse), badge em texto (_perfilTituloHtml) e títulos de
     conquista (_perfilTitulosConquistaHtml). Sem o hub carregado ainda,
     fica o gradiente padrão do .perfil-hero — e é chamada de novo assim
     que ele chega (ver cliAbrirPainelConta). */
  function _cliContaHeroCosmeticos() {
    if (typeof _equipadoLer !== 'function') return;
    var hero = document.getElementById('cli-conta-hero');
    var ident = document.getElementById('cli-conta-identidade');
    var tits = document.getElementById('cli-conta-titulos');
    try {
      var eq = _equipadoLer() || {};
      if (hero && typeof _perfilBgEstilo === 'function') hero.setAttribute('style', _perfilBgEstilo(eq.bg) || '');
      if (ident && typeof _perfilCardClasse === 'function') ident.className = ('perfil-identidade ' + _perfilCardClasse(eq.card)).trim();
      if (tits) {
        tits.innerHTML =
          (typeof _perfilTituloHtml === 'function' ? _perfilTituloHtml(eq) : '') +
          // Fase 2: destaque + chips (sem repetir) — ver _perfilTitulosHeroHtml.
          ((typeof _perfilTitulosHeroHtml === 'function' && typeof _titulosEquipadosLer === 'function')
            ? _perfilTitulosHeroHtml(_titulosDestaqueLer(), _titulosEquipadosLer()) : '');
      }
    } catch (e) {}
  }

  /* ── Minha biblioteca (Biblioteca da Coruja) ───────────────
     Lendo agora / Favoritos / Quero ler, em prateleiras horizontais de
     capas. Os dados (e o HTML da capa) vêm de bibContaDados, em
     Biblioteca/hub.js — carregado sob demanda aqui, igual aos recordes
     com o hub de jogos. Biblioteca/hub.js chama esta função de novo
     quando o estado muda (ex.: terminou de ler a cópia do Firestore). */
  var CLI_BIB_GRUPOS = [
    { k: 'lendo', tit: 'Lendo agora', ico: 'fa-book-open-reader' },
    { k: 'fav',   tit: 'Favoritos',   ico: 'fa-heart' },
    { k: 'quero', tit: 'Quero ler',   ico: 'fa-bookmark' }
  ];
  function cliRenderBiblioteca() {
    var wrap = document.getElementById('cli-conta-bib');
    if (!wrap) return;
    if (typeof window.bibContaDados !== 'function') {
      if (!wrap.innerHTML) wrap.innerHTML = '<div class="cli-bib-carregando">Carregando…</div>';
      _carregarBiblioteca().then(function () {
        if (typeof window.bibContaDados === 'function') cliRenderBiblioteca();
      }).catch(function () {
        wrap.innerHTML = '<div class="cli-bib-carregando">Não deu pra carregar sua biblioteca agora.</div>';
      });
      return;
    }
    var d;
    try { d = window.bibContaDados(); } catch (e) { return; }
    cliContaResumoSet('livros', d.total);
    var html = '';
    CLI_BIB_GRUPOS.forEach(function (g) {
      var itens = d[g.k] || [];
      if (!itens.length) return;
      html += '<div class="cli-bib-grupo">' +
        '<div class="cli-bib-grupo-tit"><i class="fa ' + g.ico + '" aria-hidden="true"></i> ' + g.tit +
          ' <span class="cli-bib-n">' + itens.length + '</span></div>' +
        '<div class="cli-bib-prateleira">' +
        itens.map(function (l) {
          var pct = Math.round((l.pct || 0) * 100);
          var prog = (g.k === 'lendo')
            ? '<span class="cli-bib-prog"><span style="width:' + pct + '%"></span></span>' +
              '<span class="cli-bib-pct">' + pct + '%</span>'
            : '<span class="cli-bib-autor">' + escHTML(l.autor) + '</span>';
          return '<button type="button" class="cli-bib-livro" onclick="cliAbrirLivroConta(\'' + escHTML(l.id) + '\')" ' +
            'aria-label="' + escHTML(l.titulo) + '">' +
            '<span class="cli-bib-capa">' + l.capa + '</span>' +
            '<span class="cli-bib-tit">' + escHTML(l.titulo) + '</span>' + prog +
          '</button>';
        }).join('') +
        '</div></div>';
    });
    if (!html) {
      wrap.innerHTML =
        '<div class="cli-conta-fav-vazio">' +
          '<i class="fa fa-book-open cli-conta-fav-vazio-ico" aria-hidden="true"></i>' +
          '<p>Nenhum livro nas suas listas ainda.<br>Favorite um clássico ou comece a ler.</p>' +
          '<button type="button" class="empty-action" onclick="cliAbrirLivroConta()">' +
            '<i class="fa fa-book" aria-hidden="true"></i> Abrir biblioteca</button>' +
        '</div>';
      return;
    }
    if (d.lidos > 0) {
      html += '<button type="button" class="cli-bib-lidos" onclick="cliAbrirLivroConta()">' +
        '<i class="fa fa-circle-check" aria-hidden="true"></i> ' + d.lidos +
        (d.lidos === 1 ? ' livro lido' : ' livros lidos') + '<i class="fa fa-chevron-right"></i></button>';
    }
    wrap.innerHTML = html;
  }

  // Abre a biblioteca (e o livro, se veio id) a partir do painel. Fecha
  // o painel antes e espera o history.back() dele assentar — mesmo
  // intervalo de cliAbrirLojaFav.
  function cliAbrirLivroConta(id) {
    cliFecharPainelConta();
    setTimeout(function () {
      _carregarBiblioteca().then(function () {
        if (typeof window._abrirBiblioteca === 'function') window._abrirBiblioteca();
        if (id && typeof window._bibAbrirLivro === 'function') window._bibAbrirLivro(id);
      }).catch(function () {
        if (typeof showToastSimples === 'function') showToastSimples('Não foi possível abrir a biblioteca. Verifique a conexão.', '/webp/owl-sign.webp');
      });
    }, 220);
  }

  // "Ver jogos" do vazio de recordes: fecha o painel e abre o hub.
  function cliAbrirJogosConta() {
    cliFecharPainelConta();
    setTimeout(function () {
      if (typeof window._abrirGamesHub === 'function') window._abrirGamesHub();
    }, 220);
  }

  function cliAbrirLojaFav(idx) {
    cliFecharPainelConta();
    if (typeof abrirDetalhes === 'function') {
      setTimeout(function () { try { abrirDetalhes(idx); } catch (e) {} }, 220);
    }
  }

  function cliFecharPainelConta(viaPopstate) {
    const overlay = document.getElementById('modal-cli-conta');
    if (!overlay) return;
    // Solta os listeners de amigos/presença: painel fechado não
    // precisa continuar recebendo atualização do RTDB.
    cliAmigosSoltar();
    overlay.classList.remove('open');
    document.body.style.overflow = '';
    if (!viaPopstate && history.state?.modal === 'cli-conta') { _popstateNosso = true; history.back(); }
  }

  // Botão de tema DENTRO do painel: chama o mesmo toggleTheme() de sempre
  // e reflete o novo estado no rótulo, sem duplicar lógica de tema.
  function cliTrocarTema() {
    _uiSom('interruptor');
    if (typeof toggleTheme === 'function') toggleTheme();
    if (typeof cliSincronizarTemaLabel === 'function') cliSincronizarTemaLabel();
  }

  // "Sons do app" no painel: liga/desliga os sons da interface (ver SONS DO APP).
  function cliTrocarSons() {
    var ligar = !_uiSonsLigados();
    try { localStorage.setItem(SONS_APP_KEY, ligar ? '1' : '0'); } catch (e) {}
    if (ligar) _uiSom('interruptor');
    cliSincronizarSonsLabel();
  }
  function cliSincronizarSonsLabel() {
    var el = document.getElementById('cli-conta-sons-label');
    if (el) el.textContent = _uiSonsLigados() ? 'Ligados' : 'Desligados';
  }

  // Atualiza o texto do botão de tema no painel (Dia / Noite / Automático).
  function cliSincronizarTemaLabel() {
    const el = document.getElementById('cli-conta-tema-label');
    if (!el) return;
    let modo = 'auto';
    try { modo = (typeof _lerModoTema === 'function') ? _lerModoTema() : 'auto'; } catch (e) {}
    const isLight = document.body.classList.contains('light-mode');
    el.textContent = (modo === 'auto')
      ? (isLight ? 'Automático (dia)' : 'Automático (noite)')
      : (isLight ? 'Tema dia' : 'Tema noite');
  }

  /* ── Sair da conta ──────────────────────────────────────────*/
  function cliSair() {
    const auth = _cliFirebaseAuth();
    cliFecharPainelConta();
    // Presença sai do ar ANTES do signOut: depois dele o token já não
    // vale e as regras do RTDB recusam a escrita no próprio nó.
    _presencaParar();
    // Convites: solta a escuta da caixa e limpa o cache — sem isso a
    // próxima conta deste aparelho abriria o painel com os convites
    // de quem saiu.
    _convPararCaixa();
    // Pedidos de amizade e a pilha de avisos do topo (P1) saem pelo
    // mesmo motivo: nada da conta anterior pode sobrar na tela.
    _pedPararGlobal();
    // Chat 1x1 (Fase 2): idem.
    if (_chatAberto()) cliFecharChat();
    _chatPararCaixa();
    // Lobby social (5.1/5.2): pelo mesmo motivo da presença acima, e a
    // UI solta antes do sair (ver o onAuthStateChanged).
    _lobUiSoltar();
    // Convites de lobby (L1): a caixa e o cache de "Convidado" são da
    // conta que está saindo — nada disso pode sobrar pra próxima.
    _lobConvParar();
    _lobSair();
    _avisoLimpar();
    // Push (FCM): apaga o token ANTES do signOut, mesmo motivo da
    // presença acima — depois dele as regras recusam a escrita.
    _fcmParar();
    // Limpa também o apelido espelhado: sem isto ele sobrevivia no
    // localStorage e a próxima sala de multiplayer entrada sem conta
    // (sessão anônima) reaparecia com o nome de quem tinha saído.
    const limpar = function () {
      _cliUser = null;
      _cliApelido = null;
      _amNomeVivo = {};   // cache de nomes de amigos da conta que saiu
      _amCodigoLimpar();  // e o código curto (P2) da conta que saiu
      try { localStorage.removeItem(CLI_APELIDO_KEY); } catch (e) {}
    };
    if (!auth) { limpar(); cliAtualizarHeader(); return; }
    auth.signOut()
      .then(function () {
        limpar();
        if (typeof showToastSimples === 'function') {
          showToastSimples('Você saiu da conta.', '/webp/owl-wave.webp');
        }
      })
      .catch(function () {
        // Mesmo se falhar remotamente, refletimos deslogado na UI.
        limpar(); cliAtualizarHeader();
      });
  }

  // Expor no window as funções usadas por onclick no HTML dinâmico/estático.
  // (Em script clássico as declarações já viram window.*, mas deixamos
  //  explícito as que são chamadas de fora para robustez pós-minify.)
  window.cliAbrirLogin        = cliAbrirLogin;
  window.cliFecharLogin       = cliFecharLogin;
  window.cliLoginStep         = cliLoginStep;
  window.cliEntrarGoogle      = cliEntrarGoogle;
  window.cliEntrarEmail       = cliEntrarEmail;
  window.cliCriarConta        = cliCriarConta;
  window.cliAbrirPainelConta  = cliAbrirPainelConta;
  window.cliFecharPainelConta = cliFecharPainelConta;
  window.cliTrocarTema        = cliTrocarTema;
  window.cliTrocarSons        = cliTrocarSons;
  window.cliSair              = cliSair;
  window.cliEditarApelido     = cliEditarApelido;
  window.cliCancelarApelido   = cliCancelarApelido;
  window.cliSalvarApelido     = cliSalvarApelido;
  window.cliEscolherFoto      = cliEscolherFoto;
  window.cliAbrirLojaFav      = cliAbrirLojaFav;
  // Fonte única do nome visível. Exportada porque multiplayer.js,
  // party.js e baralho.js são IIFEs em arquivos separados e só
  // enxergam o app por window.* (hub.js roda no mesmo escopo global
  // e poderia chamar direto, mas usa o mesmo caminho por clareza).
  window.cliNomeExibicao      = cliNomeExibicao;

  /* ══════════════════════════════════════════════════════════════
     SOCIAL SOB DEMANDA — presença, amigos, convites, chat 1x1, avisos
     do topo, lobby e push (FCM) moram em social.js (~300 KB de fonte).
     ------------------------------------------------------------
     Quem só procura loja nunca baixa nem processa esse código. Ele
     carrega: (1) no login de conta nomeada (os setTimeout do
     onAuthStateChanged chamam _presencaIniciar etc.), (2) junto com o
     hub de jogos (perfil/amigos usam window.AngatubaAmigos) e (3) no
     primeiro toque em qualquer função social (lobby, chat, amigos).

     Cada função abaixo é um stub com o MESMO nome da real. São
     declarações de função (sobem pro topo), então o boot pode chamá-las
     antes desta linha. Quando social.min.js roda, as declarações dele
     substituem estas no escopo global e as chamadas seguintes já vão
     direto pra real. Modos:
       (padrão)   carrega o módulo e chama a real (devolve uma Promise)
       'parar'    parar/limpar/pintar: se o módulo nunca foi pedido, não
                  há nada a parar — não faz nada e NÃO baixa o módulo
       'consulta' responde na hora (sem módulo = false)
     Função nova do social.js chamada daqui de fora (ou por onclick)?
     Ganha um stub aqui, senão dá ReferenceError antes do módulo carregar.
  ══════════════════════════════════════════════════════════════ */
  var _amNomeVivo = {};         // uid -> nome que veio da presença (social.js)
  var _lobIndoPraSala = false;  // 5.3: entrada em voo (social.js; lida no popstate)
  var _socialCarregado = null, _socialOk = false;
  function _carregarSocial() {
    if (_socialCarregado) return _socialCarregado;
    _socialCarregado = _injetarScript('/social.min.js').then(function () {
      _socialOk = true;
    }).catch(function (err) {
      _socialCarregado = null; // permite tentar de novo no próximo pedido
      throw err;
    });
    return _socialCarregado;
  }
  function _socialChamar(nome, args, modo) {
    if (!_socialOk) {
      if (modo === 'consulta') return false;
      if (modo === 'parar' && !_socialCarregado) return;
    }
    var real = function () {
      var f = window[nome];
      if (typeof f !== 'function' || f._socialStub) {
        if (typeof DEBUG !== 'undefined' && DEBUG) console.log('[social] sem a função real:', nome);
        return;
      }
      return f.apply(null, args);
    };
    if (_socialOk) return real();
    return _carregarSocial().then(real).catch(function (err) {
      if (typeof DEBUG !== 'undefined' && DEBUG) console.log('[social] falha ao carregar social.min.js:', err && err.message);
      // Toque do usuário (cli*, aon*) avisa; as escutas de fundo (_*) não.
      if (nome.charAt(0) !== '_' && typeof showToastSimples === 'function') {
        showToastSimples('Não foi possível abrir. Verifique a conexão.', '/webp/owl-sign.webp');
      }
    });
  }
  function _amCodigoLimpar() { return _socialChamar('_amCodigoLimpar', arguments, 'parar'); }
  function _avisoLimpar() { return _socialChamar('_avisoLimpar', arguments, 'parar'); }
  function _chatAberto() { return _socialChamar('_chatAberto', arguments, 'consulta'); }
  function _chatObservarCaixa() { return _socialChamar('_chatObservarCaixa', arguments); }
  function _chatPararCaixa() { return _socialChamar('_chatPararCaixa', arguments, 'parar'); }
  function _chatPintarBadges() { return _socialChamar('_chatPintarBadges', arguments, 'parar'); }
  function _convObservarCaixa() { return _socialChamar('_convObservarCaixa', arguments); }
  function _convPararCaixa() { return _socialChamar('_convPararCaixa', arguments, 'parar'); }
  function _fcmIniciar() { return _socialChamar('_fcmIniciar', arguments); }
  function _fcmParar() { return _socialChamar('_fcmParar', arguments, 'parar'); }
  function _lobConvObservar() { return _socialChamar('_lobConvObservar', arguments); }
  function _lobConvParar() { return _socialChamar('_lobConvParar', arguments, 'parar'); }
  function _lobSair() { return _socialChamar('_lobSair', arguments, 'parar'); }
  function _lobUiObservar() { return _socialChamar('_lobUiObservar', arguments); }
  function _lobUiSoltar() { return _socialChamar('_lobUiSoltar', arguments, 'parar'); }
  function _pedObservarGlobal() { return _socialChamar('_pedObservarGlobal', arguments); }
  function _pedPararGlobal() { return _socialChamar('_pedPararGlobal', arguments, 'parar'); }
  function _presPintarIndicador() { return _socialChamar('_presPintarIndicador', arguments, 'parar'); }
  function _presencaIniciar() { return _socialChamar('_presencaIniciar', arguments); }
  function _presencaParar() { return _socialChamar('_presencaParar', arguments, 'parar'); }
  function aonAvisoAcao() { return _socialChamar('aonAvisoAcao', arguments); }
  function cliAbrirChat() { return _socialChamar('cliAbrirChat', arguments); }
  function cliAbrirLobby() { return _socialChamar('cliAbrirLobby', arguments); }
  function cliAbrirPerfilAmigo() { return _socialChamar('cliAbrirPerfilAmigo', arguments); }
  function cliAmigosAceitar() { return _socialChamar('cliAmigosAceitar', arguments); }
  function cliAmigosCopiarCodigo() { return _socialChamar('cliAmigosCopiarCodigo', arguments); }
  function cliAmigosJogar() { return _socialChamar('cliAmigosJogar', arguments); }
  function cliAmigosPedir() { return _socialChamar('cliAmigosPedir', arguments); }
  function cliAmigosRecusar() { return _socialChamar('cliAmigosRecusar', arguments); }
  function cliAmigosRemover() { return _socialChamar('cliAmigosRemover', arguments); }
  function cliAmigosRender() { return _socialChamar('cliAmigosRender', arguments); }
  function cliAmigosSoltar() { return _socialChamar('cliAmigosSoltar', arguments, 'parar'); }
  function cliChatAbrirConversa() { return _socialChamar('cliChatAbrirConversa', arguments); }
  function cliChatDigitou() { return _socialChamar('cliChatDigitou', arguments); }
  function cliChatEnviar() { return _socialChamar('cliChatEnviar', arguments); }
  function cliChatFundoAbrir() { return _socialChamar('cliChatFundoAbrir', arguments); }
  function cliChatFundoEscolherFoto() { return _socialChamar('cliChatFundoEscolherFoto', arguments); }
  function cliChatFundoFechar() { return _socialChamar('cliChatFundoFechar', arguments); }
  function cliChatFundoRemoverFoto() { return _socialChamar('cliChatFundoRemoverFoto', arguments); }
  function cliChatFundoTema() { return _socialChamar('cliChatFundoTema', arguments); }
  function cliChatTecla() { return _socialChamar('cliChatTecla', arguments); }
  function cliChatVoltar() { return _socialChamar('cliChatVoltar', arguments); }
  function cliConviteEntrar() { return _socialChamar('cliConviteEntrar', arguments); }
  function cliConviteEnviar() { return _socialChamar('cliConviteEnviar', arguments); }
  function cliConviteRecusar() { return _socialChamar('cliConviteRecusar', arguments); }
  function cliFecharChat() { return _socialChamar('cliFecharChat', arguments); }
  function cliFecharLobby() { return _socialChamar('cliFecharLobby', arguments); }
  function cliLobbyChamar() { return _socialChamar('cliLobbyChamar', arguments); }
  function cliLobbyChamarAberto() { return _socialChamar('cliLobbyChamarAberto', arguments); }
  function cliLobbyChatEnviar() { return _socialChamar('cliLobbyChatEnviar', arguments); }
  function cliLobbyChatRascunho() { return _socialChamar('cliLobbyChatRascunho', arguments); }
  function cliLobbyComecar() { return _socialChamar('cliLobbyComecar', arguments); }
  function cliLobbyConvidar() { return _socialChamar('cliLobbyConvidar', arguments); }
  function cliLobbyConviteAceitar() { return _socialChamar('cliLobbyConviteAceitar', arguments); }
  function cliLobbyConviteCancelar() { return _socialChamar('cliLobbyConviteCancelar', arguments); }
  function cliLobbyConviteRecusar() { return _socialChamar('cliLobbyConviteRecusar', arguments); }
  function cliLobbyCopiar() { return _socialChamar('cliLobbyCopiar', arguments); }
  function cliLobbyCriar() { return _socialChamar('cliLobbyCriar', arguments); }
  function cliLobbyEncerrarPartida() { return _socialChamar('cliLobbyEncerrarPartida', arguments); }
  function cliLobbyEntrar() { return _socialChamar('cliLobbyEntrar', arguments); }
  function cliLobbyEntrarPartida() { return _socialChamar('cliLobbyEntrarPartida', arguments); }
  function cliLobbyPronto() { return _socialChamar('cliLobbyPronto', arguments); }
  function cliLobbySair() { return _socialChamar('cliLobbySair', arguments); }
  function cliLobbySugerir() { return _socialChamar('cliLobbySugerir', arguments); }
  ['_amCodigoLimpar', '_avisoLimpar', '_chatAberto', '_chatObservarCaixa', '_chatPararCaixa', '_chatPintarBadges', '_convObservarCaixa', '_convPararCaixa', '_fcmIniciar', '_fcmParar', '_lobConvObservar', '_lobConvParar', '_lobSair', '_lobUiObservar', '_lobUiSoltar', '_pedObservarGlobal', '_pedPararGlobal', '_presPintarIndicador', '_presencaIniciar', '_presencaParar', 'aonAvisoAcao', 'cliAbrirChat', 'cliAbrirLobby', 'cliAbrirPerfilAmigo', 'cliAmigosAceitar', 'cliAmigosCopiarCodigo', 'cliAmigosJogar', 'cliAmigosPedir', 'cliAmigosRecusar', 'cliAmigosRemover', 'cliAmigosRender', 'cliAmigosSoltar', 'cliChatAbrirConversa', 'cliChatDigitou', 'cliChatEnviar', 'cliChatFundoAbrir', 'cliChatFundoEscolherFoto', 'cliChatFundoFechar', 'cliChatFundoRemoverFoto', 'cliChatFundoTema', 'cliChatTecla', 'cliChatVoltar', 'cliConviteEntrar', 'cliConviteEnviar', 'cliConviteRecusar', 'cliFecharChat', 'cliFecharLobby', 'cliLobbyChamar', 'cliLobbyChamarAberto', 'cliLobbyChatEnviar', 'cliLobbyChatRascunho', 'cliLobbyComecar', 'cliLobbyConvidar', 'cliLobbyConviteAceitar', 'cliLobbyConviteCancelar', 'cliLobbyConviteRecusar', 'cliLobbyCopiar', 'cliLobbyCriar', 'cliLobbyEncerrarPartida', 'cliLobbyEntrar', 'cliLobbyEntrarPartida', 'cliLobbyPronto', 'cliLobbySair', 'cliLobbySugerir'].forEach(function (n) {
    if (typeof window[n] === 'function') window[n]._socialStub = true;
  });

  /* ── Clique numa notificação em segundo plano ───────────────────
     O service-worker.js foca uma aba já aberta (e manda ela pra cá
     por postMessage) ou abre uma nova direto na URL do payload — ver
     o notificationclick de lá. Convenção do "lugar certo": a URL do
     payload leva "?abrir=lobby|amigos|jogos"; sem Cloud Function
     ainda, ninguém escreve esse payload de verdade — o handler aqui
     só espera que, quando escrever, seja assim. */
  function _fcmAbrirDestino(urlStr) {
    try {
      var u = new URL(urlStr, location.origin);
      var alvo = u.searchParams.get('abrir');
      if (!alvo) return;
      if (alvo === 'lobby' && typeof cliAbrirLobby === 'function') { cliAbrirLobby(); return; }
      if (alvo === 'amigos' && typeof cliAbrirPainelConta === 'function') { cliAbrirPainelConta(); return; }
      if (alvo === 'jogos' && typeof _abrirGamesHub === 'function') { _abrirGamesHub(); return; }
    } catch (e) {}
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', function (event) {
      if (event.data && event.data.tipo === 'FCM_CLIQUE') _fcmAbrirDestino(event.data.url);
    });
  }

  // Abriu o app do zero a partir do clique (clients.openWindow, sem
  // aba já aberta pra focar) — mesmo destino, lido da própria URL.
  // Espera o boot/login assentar antes de agir, e limpa a query pra
  // um F5 não reabrir a mesma tela sozinho.
  (function _fcmDestinoNoBoot() {
    if (location.search.indexOf('abrir=') === -1) return;
    setTimeout(function () {
      _fcmAbrirDestino(location.href);
      try { history.replaceState(null, '', location.pathname); } catch (e) {}
    }, 1500);
  })();

  // Atalhos do manifest.json → shortcuts, todos no mesmo dispatcher:
  //   ?atalho=painel    → "Meu painel" (A3, comportamento inalterado)
  //   ?atalho=busca     → home na aba Lojas com a busca focada
  //   ?atalho=favoritos → home na aba Lojas com o filtro Favoritos ativo
  //   ?atalho=stories   → abre o 1º story não visto (ou rola até o 1º
  //                       anel de anúncio, se nenhum estiver pronto ainda)
  // Qualquer outro valor de ?atalho= é ignorado. Mesma folga de 1500ms do
  // atalho de push acima pro boot/login assentar antes de agir, e limpa a
  // query depois (preservando #slug) pra um F5 não repetir a ação sozinho.
  //
  // "painel" reaproveita o mesmo roteamento do nav "Minha Loja" — entra
  // direto se já logado, retoma "aguardando" se há cadastro pendente, ou
  // pede login (que já abre o painel sozinho ao concluir, ver
  // lojaVerificarCodigo). Os outros nunca abrem o painel nem o tour do
  // lojista — só mexem na home de lojas.

  // Primeiro story não visto entre as lojas PRO com anúncio-foto, na ordem
  // de LOJAS (mesmo critério do anel "aceso" no card). Retorna true se
  // achou e abriu; false se não há nenhum pronto ainda.
  function _abrirPrimeiraStoryNaoVista() {
    if (!Array.isArray(LOJAS) || typeof abrirStories !== 'function') return false;
    for (var i = 0; i < LOJAS.length; i++) {
      var loja = LOJAS[i];
      if (!loja || (loja.plano || '').toUpperCase() !== 'PRO') continue;
      var stories = _normalizarStories(loja);
      if (!stories.length || !stories.some(function (st) { return st.imagemUrl; })) continue;
      if (!_lojaTemStoryNaoVisto(stories)) continue;
      var lojaId = loja.id || loja.wpp || loja.nome;
      abrirStories(stories, loja.nome, lojaId, _assinaturaAnuncio(loja), loja.plano, loja.categoria);
      return true;
    }
    return false;
  }

  function _atalhoBusca() {
    if (typeof _irParaPaginaHome === 'function') _irParaPaginaHome(0, false);
    var input = document.getElementById('main-search');
    if (input) { try { input.focus(); } catch (e) {} }
  }

  function _atalhoFavoritos() {
    if (typeof _irParaPaginaHome === 'function') _irParaPaginaHome(0, false);
    var btn = document.querySelector('.pill-btn[data-filter="favoritos"]');
    // Só clica se ainda não está no filtro Favoritos — clicar de novo numa
    // pill já ativa desliga ela (toggle-off), o que desfaria o atalho.
    if (btn && !(btn.classList.contains('active') && activePillFilter === 'favoritos')) {
      btn.click(); // mesmo caminho do clique do usuário: active + activePillFilter + renderLojas
    }
    // Zero favoritos: o empty state que a lista já mostra basta.
  }

  function _atalhoStories(_semRetry) {
    if (typeof _irParaPaginaHome === 'function') _irParaPaginaHome(0, false);
    if (_abrirPrimeiraStoryNaoVista()) return;
    // LOJAS ainda vazio (raro — já nasce com o fallback fixo): 1 retry
    // curto, sem loop infinito.
    if (!_semRetry && (!Array.isArray(LOJAS) || LOJAS.length === 0)) {
      setTimeout(function () { _atalhoStories(true); }, 1500);
      return;
    }
    // Fallback: rola até o primeiro anel de anúncio visível na lista.
    var ring = document.querySelector('.anuncio-ring');
    if (ring && ring.scrollIntoView) {
      try { ring.scrollIntoView({ block: 'center', behavior: 'auto' }); } catch (e) {}
    }
    // Nenhum story disponível: no-op silencioso.
  }

  (function _atalhosNoBoot() {
    const atalho = new URLSearchParams(location.search).get('atalho');
    if (['painel', 'busca', 'favoritos', 'stories'].indexOf(atalho) === -1) return;
    setTimeout(function () {
      if (atalho === 'painel') {
        if (typeof _abrirPainelOuLogin === 'function') _abrirPainelOuLogin();
      } else if (atalho === 'busca') {
        _atalhoBusca();
      } else if (atalho === 'favoritos') {
        _atalhoFavoritos();
      } else if (atalho === 'stories') {
        _atalhoStories();
      }
      try {
        const p = new URLSearchParams(location.search);
        p.delete('atalho');
        history.replaceState(null, '', location.pathname + (p.toString() ? '?' + p.toString() : '') + location.hash);
      } catch (e) {}
    }, 1500);
  })();
