'use strict';

/* ══════════════════════════════════════════════════════════════
   APRENDER — banco de conteúdo (Inglês) — Aprender/conteudo.js
   Fácil de editar: cada unidade tem um id, título, ícone e uma lista
   de lições; cada lição tem um id, título e uma lista de exercícios.

   Tipos de exercício suportados (ver Aprender/hub.js):
     - escolha:   { tipo:'escolha', direcao:'pt-en'|'en-pt', pergunta, opcoes:[4], correta }
     - parear:    { tipo:'parear', pares:[[pt,en], ...] }               (4 pares)
     - completar: { tipo:'completar', frase:'... ___ ...', opcoes:[3], correta }

   Roda no MESMO escopo global do app.js/hub.js (script clássico, sem
   módulo/IIFE) — carregado sob demanda junto com Aprender/hub.js (ver
   _carregarHubAprender em app.js). Só declara UMA variável global:
   APRENDER_CONTEUDO.
══════════════════════════════════════════════════════════════ */

var APRENDER_CONTEUDO = {
  idioma: 'en',
  unidades: [
    {
      id: 'u1',
      titulo: 'Cumprimentos',
      icone: '👋',
      licoes: [
        {
          id: 'l1',
          titulo: 'Olá e tchau',
          vocabulario: [{ en: 'Hello', pt: 'Olá' }, { en: 'Good morning', pt: 'Bom dia' }, { en: 'Goodbye', pt: 'Tchau' }, { en: 'Good night', pt: 'Boa noite' }],
          exercicios: [
            { tipo: 'escolha', direcao: 'pt-en', pergunta: 'Olá', opcoes: ['Hello', 'Goodbye', 'Please', 'Sorry'], correta: 'Hello' },
            { tipo: 'escolha', direcao: 'pt-en', pergunta: 'Bom dia', opcoes: ['Good morning', 'Good night', 'Good afternoon', 'Goodbye'], correta: 'Good morning' },
            { tipo: 'escolha', direcao: 'en-pt', pergunta: 'Goodbye', opcoes: ['Olá', 'Tchau', 'Obrigado', 'Desculpa'], correta: 'Tchau' },
            { tipo: 'escolha', direcao: 'en-pt', pergunta: 'Good night', opcoes: ['Bom dia', 'Boa tarde', 'Boa noite', 'Até mais'], correta: 'Boa noite' },
            { tipo: 'parear', pares: [['Olá', 'Hello'], ['Tchau', 'Goodbye'], ['Bom dia', 'Good morning'], ['Boa noite', 'Good night']] },
            { tipo: 'completar', frase: 'Good ___, see you tomorrow!', opcoes: ['morning', 'night', 'please'], correta: 'night' }
          ]
        },
        {
          id: 'l2',
          titulo: 'Como você está',
          vocabulario: [{ en: 'Please', pt: 'Por favor' }, { en: 'Thank you', pt: 'Obrigado' }, { en: 'How are you?', pt: 'Como você está?' }, { en: 'You\'re welcome', pt: 'De nada' }],
          exercicios: [
            { tipo: 'escolha', direcao: 'pt-en', pergunta: 'Por favor', opcoes: ['Please', 'Thanks', 'Sorry', 'Welcome'], correta: 'Please' },
            { tipo: 'escolha', direcao: 'pt-en', pergunta: 'Obrigado', opcoes: ['Thank you', "You're welcome", 'Excuse me', 'Please'], correta: 'Thank you' },
            { tipo: 'escolha', direcao: 'en-pt', pergunta: 'How are you?', opcoes: ['Qual é seu nome?', 'Como você está?', 'De onde você é?', 'Quantos anos você tem?'], correta: 'Como você está?' },
            { tipo: 'escolha', direcao: 'en-pt', pergunta: "You're welcome", opcoes: ['Por favor', 'Com licença', 'De nada', 'Prazer'], correta: 'De nada' },
            { tipo: 'parear', pares: [['Por favor', 'Please'], ['Obrigado', 'Thank you'], ['De nada', "You're welcome"], ['Com licença', 'Excuse me']] },
            { tipo: 'completar', frase: 'Nice to ___ you!', opcoes: ['meet', 'eat', 'see'], correta: 'meet' }
          ]
        },
        {
          id: 'l3',
          titulo: 'Apresentações',
          vocabulario: [{ en: 'What\'s your name?', pt: 'Qual é o seu nome?' }, { en: 'I\'m from Angatuba', pt: 'Eu sou de Angatuba' }, { en: 'Where are you from?', pt: 'De onde você é?' }, { en: 'This is my friend', pt: 'Este é meu amigo' }],
          exercicios: [
            { tipo: 'escolha', direcao: 'pt-en', pergunta: 'Qual é o seu nome?', opcoes: ["What's your name?", 'Where are you from?', 'How are you?', 'Nice to meet you'], correta: "What's your name?" },
            { tipo: 'escolha', direcao: 'pt-en', pergunta: 'Eu sou de Angatuba', opcoes: ["I'm from Angatuba", 'My name is Angatuba', 'I live here', 'This is Angatuba'], correta: "I'm from Angatuba" },
            { tipo: 'escolha', direcao: 'en-pt', pergunta: 'Where are you from?', opcoes: ['De onde você é?', 'Qual é o seu nome?', 'Como você está?', 'Quantos anos você tem?'], correta: 'De onde você é?' },
            { tipo: 'escolha', direcao: 'en-pt', pergunta: 'This is my friend', opcoes: ['Este é meu amigo', 'Eu sou seu amigo', 'Prazer em conhecê-lo', 'Esta é minha casa'], correta: 'Este é meu amigo' },
            { tipo: 'parear', pares: [['Meu nome é...', 'My name is...'], ['Qual é o seu nome?', "What's your name?"], ['De onde você é?', 'Where are you from?'], ['Prazer em conhecê-lo', 'Nice to meet you']] },
            { tipo: 'completar', frase: 'My ___ is Maria.', opcoes: ['name', 'friend', 'home'], correta: 'name' }
          ]
        },
        {
          id: 'l4',
          titulo: 'Perguntas educadas',
          vocabulario: [{ en: 'Can you help me?', pt: 'Você pode me ajudar?' }, { en: 'I don\'t understand', pt: 'Eu não entendo' }, { en: 'Could you repeat, please?', pt: 'Você pode repetir, por favor?' }, { en: 'No problem', pt: 'Sem problema' }],
          exercicios: [
            { tipo: 'escolha', direcao: 'pt-en', pergunta: 'Você pode me ajudar?', opcoes: ['Can you help me?', 'Do you speak English?', "I don't understand", 'No problem'], correta: 'Can you help me?' },
            { tipo: 'escolha', direcao: 'pt-en', pergunta: 'Eu não entendo', opcoes: ["I don't understand", "I don't know", 'Can you help me?', 'No problem'], correta: "I don't understand" },
            { tipo: 'escolha', direcao: 'en-pt', pergunta: 'Could you repeat, please?', opcoes: ['Você pode repetir, por favor?', 'Você pode me ajudar?', 'Você fala inglês?', 'Desculpe, eu não sei'], correta: 'Você pode repetir, por favor?' },
            { tipo: 'escolha', direcao: 'en-pt', pergunta: 'No problem', opcoes: ['Sem problema', 'Sem dúvida', 'Com certeza', 'De nada'], correta: 'Sem problema' },
            { tipo: 'parear', pares: [['Você pode me ajudar?', 'Can you help me?'], ['Você fala inglês?', 'Do you speak English?'], ['Eu não entendo', "I don't understand"], ['Sem problema', 'No problem']] },
            { tipo: 'completar', frase: "Sorry, I don't ___.", opcoes: ['know', 'help', 'speak'], correta: 'know' }
          ]
        },
        {
          id: 'l5',
          titulo: 'Fechando a conversa',
          vocabulario: [{ en: 'See you tomorrow', pt: 'Até amanhã' }, { en: 'Have a nice day', pt: 'Tenha um bom dia' }, { en: 'Take care', pt: 'Se cuida' }, { en: 'Have a good trip', pt: 'Tenha uma boa viagem' }],
          exercicios: [
            { tipo: 'escolha', direcao: 'pt-en', pergunta: 'Até amanhã', opcoes: ['See you tomorrow', 'See you later', 'Take care', 'Until next time'], correta: 'See you tomorrow' },
            { tipo: 'escolha', direcao: 'pt-en', pergunta: 'Tenha um bom dia', opcoes: ['Have a nice day', 'Have a good trip', 'Take care', 'See you later'], correta: 'Have a nice day' },
            { tipo: 'escolha', direcao: 'en-pt', pergunta: 'Take care', opcoes: ['Se cuida', 'Até mais', 'Tenha um bom dia', 'Até a próxima'], correta: 'Se cuida' },
            { tipo: 'escolha', direcao: 'en-pt', pergunta: 'Have a good trip', opcoes: ['Tenha uma boa viagem', 'Tenha um bom dia', 'Até amanhã', 'Se cuida'], correta: 'Tenha uma boa viagem' },
            { tipo: 'parear', pares: [['Até mais', 'See you later'], ['Se cuida', 'Take care'], ['Tenha um bom dia', 'Have a nice day'], ['Até a próxima', 'Until next time']] },
            { tipo: 'completar', frase: 'Have a nice ___!', opcoes: ['day', 'trip', 'name'], correta: 'day' }
          ]
        }
      ]
    },
    {
      id: 'u2',
      titulo: 'Números 1-10',
      icone: '🔢',
      licoes: [
        {
          id: 'l1',
          titulo: 'Números 1 a 5',
          vocabulario: [{ en: 'Three', pt: 'Três' }, { en: 'One', pt: 'Um' }, { en: 'Four', pt: 'Quatro' }, { en: 'Five', pt: 'Cinco' }],
          exercicios: [
            { tipo: 'escolha', direcao: 'pt-en', pergunta: 'Três', opcoes: ['three', 'two', 'four', 'five'], correta: 'three' },
            { tipo: 'escolha', direcao: 'pt-en', pergunta: 'Um', opcoes: ['one', 'two', 'three', 'four'], correta: 'one' },
            { tipo: 'escolha', direcao: 'en-pt', pergunta: 'Four', opcoes: ['Dois', 'Três', 'Quatro', 'Cinco'], correta: 'Quatro' },
            { tipo: 'escolha', direcao: 'en-pt', pergunta: 'Five', opcoes: ['Três', 'Quatro', 'Cinco', 'Um'], correta: 'Cinco' },
            { tipo: 'parear', pares: [['Um', 'One'], ['Dois', 'Two'], ['Três', 'Three'], ['Quatro', 'Four']] },
            { tipo: 'completar', frase: 'I have ___ apples.', opcoes: ['five', 'four', 'two'], correta: 'five' }
          ]
        },
        {
          id: 'l2',
          titulo: 'Números 6 a 10',
          vocabulario: [{ en: 'Seven', pt: 'Sete' }, { en: 'Ten', pt: 'Dez' }, { en: 'Eight', pt: 'Oito' }, { en: 'Nine', pt: 'Nove' }],
          exercicios: [
            { tipo: 'escolha', direcao: 'pt-en', pergunta: 'Sete', opcoes: ['six', 'seven', 'eight', 'nine'], correta: 'seven' },
            { tipo: 'escolha', direcao: 'pt-en', pergunta: 'Dez', opcoes: ['eight', 'nine', 'ten', 'seven'], correta: 'ten' },
            { tipo: 'escolha', direcao: 'en-pt', pergunta: 'Eight', opcoes: ['Seis', 'Sete', 'Oito', 'Nove'], correta: 'Oito' },
            { tipo: 'escolha', direcao: 'en-pt', pergunta: 'Nine', opcoes: ['Sete', 'Oito', 'Nove', 'Dez'], correta: 'Nove' },
            { tipo: 'parear', pares: [['Seis', 'Six'], ['Sete', 'Seven'], ['Oito', 'Eight'], ['Nove', 'Nine']] },
            { tipo: 'completar', frase: 'The store closes at ___ o’clock.', opcoes: ['ten', 'six', 'eight'], correta: 'ten' }
          ]
        },
        {
          id: 'l3',
          titulo: 'Contando objetos',
          vocabulario: [{ en: 'One apple', pt: 'Uma maçã' }, { en: 'Just one', pt: 'Só um' }, { en: 'How many?', pt: 'Quantos?' }, { en: 'A few', pt: 'Alguns' }],
          exercicios: [
            { tipo: 'escolha', direcao: 'pt-en', pergunta: 'Uma maçã', opcoes: ['one apple', 'two apples', 'three breads', 'a few'], correta: 'one apple' },
            { tipo: 'escolha', direcao: 'pt-en', pergunta: 'Só um', opcoes: ['just one', 'how many?', 'a few', 'two apples'], correta: 'just one' },
            { tipo: 'escolha', direcao: 'en-pt', pergunta: 'How many?', opcoes: ['Quantos?', 'Quanto custa?', 'Só um', 'Alguns'], correta: 'Quantos?' },
            { tipo: 'escolha', direcao: 'en-pt', pergunta: 'A few', opcoes: ['Alguns', 'Muitos', 'Só um', 'Nenhum'], correta: 'Alguns' },
            { tipo: 'parear', pares: [['Uma maçã', 'One apple'], ['Duas maçãs', 'Two apples'], ['Três pães', 'Three breads'], ['Quantos?', 'How many?']] },
            { tipo: 'completar', frase: 'I have ___ apples and one bread.', opcoes: ['two', 'one', 'few'], correta: 'two' }
          ]
        },
        {
          id: 'l4',
          titulo: 'Perguntando quantidade',
          vocabulario: [{ en: 'How many do you want?', pt: 'Quantos você quer?' }, { en: 'Half a kilo, please', pt: 'Meio quilo, por favor' }, { en: 'One more, please', pt: 'Mais um, por favor' }, { en: 'A dozen, please', pt: 'Uma dúzia, por favor' }],
          exercicios: [
            { tipo: 'escolha', direcao: 'pt-en', pergunta: 'Quantos você quer?', opcoes: ['How many do you want?', 'Just one, please', 'One more, please', 'A dozen, please'], correta: 'How many do you want?' },
            { tipo: 'escolha', direcao: 'pt-en', pergunta: 'Meio quilo, por favor', opcoes: ['Half a kilo, please', 'A dozen, please', 'Two, please', 'One more, please'], correta: 'Half a kilo, please' },
            { tipo: 'escolha', direcao: 'en-pt', pergunta: 'One more, please', opcoes: ['Mais um, por favor', 'Só um, por favor', 'Dois, por favor', 'Uma dúzia, por favor'], correta: 'Mais um, por favor' },
            { tipo: 'escolha', direcao: 'en-pt', pergunta: 'A dozen, please', opcoes: ['Uma dúzia, por favor', 'Meio quilo, por favor', 'Quantos você quer?', 'Só um, por favor'], correta: 'Uma dúzia, por favor' },
            { tipo: 'parear', pares: [['Quantos você quer?', 'How many do you want?'], ['Só um, por favor', 'Just one, please'], ['Uma dúzia, por favor', 'A dozen, please'], ['Meio quilo, por favor', 'Half a kilo, please']] },
            { tipo: 'completar', frase: '___ do you want?', opcoes: ['How many', 'How much', 'How often'], correta: 'How many' }
          ]
        },
        {
          id: 'l5',
          titulo: 'Números no dia a dia',
          vocabulario: [{ en: 'Table one', pt: 'Mesa um' }, { en: 'Order number three', pt: 'Pedido número três' }, { en: 'Room four', pt: 'Quarto quatro' }, { en: 'Aisle six', pt: 'Corredor seis' }],
          exercicios: [
            { tipo: 'escolha', direcao: 'pt-en', pergunta: 'Mesa um', opcoes: ['table one', 'table two', 'room four', 'order number three'], correta: 'table one' },
            { tipo: 'escolha', direcao: 'pt-en', pergunta: 'Pedido número três', opcoes: ['order number three', 'table two', 'line five', 'aisle six'], correta: 'order number three' },
            { tipo: 'escolha', direcao: 'en-pt', pergunta: 'Room four', opcoes: ['Quarto quatro', 'Mesa quatro', 'Fila quatro', 'Corredor quatro'], correta: 'Quarto quatro' },
            { tipo: 'escolha', direcao: 'en-pt', pergunta: 'Aisle six', opcoes: ['Corredor seis', 'Fila seis', 'Mesa seis', 'Quarto seis'], correta: 'Corredor seis' },
            { tipo: 'parear', pares: [['Mesa um', 'Table one'], ['Pedido número três', 'Order number three'], ['Quarto quatro', 'Room four'], ['Fila cinco', 'Line five']] },
            { tipo: 'completar', frase: '___ two, please.', opcoes: ['Table', 'Room', 'Order'], correta: 'Table' }
          ]
        }
      ]
    },
    {
      id: 'u3',
      titulo: 'Comida',
      icone: '🍽️',
      licoes: [
        {
          id: 'l1',
          titulo: 'Comidas do dia a dia',
          vocabulario: [{ en: 'Bread', pt: 'Pão' }, { en: 'Water', pt: 'Água' }, { en: 'Chicken', pt: 'Frango' }, { en: 'Fruit', pt: 'Fruta' }],
          exercicios: [
            { tipo: 'escolha', direcao: 'pt-en', pergunta: 'Pão', opcoes: ['bread', 'rice', 'beans', 'meat'], correta: 'bread' },
            { tipo: 'escolha', direcao: 'pt-en', pergunta: 'Água', opcoes: ['coffee', 'water', 'juice', 'milk'], correta: 'water' },
            { tipo: 'escolha', direcao: 'en-pt', pergunta: 'Chicken', opcoes: ['Carne', 'Frango', 'Peixe', 'Arroz'], correta: 'Frango' },
            { tipo: 'escolha', direcao: 'en-pt', pergunta: 'Fruit', opcoes: ['Verdura', 'Fruta', 'Doce', 'Pão'], correta: 'Fruta' },
            { tipo: 'parear', pares: [['Pão', 'Bread'], ['Café', 'Coffee'], ['Arroz', 'Rice'], ['Feijão', 'Beans']] },
            { tipo: 'completar', frase: 'I would like some ___ and rice.', opcoes: ['beans', 'water', 'bread'], correta: 'beans' }
          ]
        },
        {
          id: 'l2',
          titulo: 'No restaurante',
          vocabulario: [{ en: 'The bill, please', pt: 'A conta, por favor' }, { en: 'Delicious', pt: 'Delicioso' }, { en: 'I would like', pt: 'Eu gostaria' }, { en: 'That\'s enough', pt: 'Já chega' }],
          exercicios: [
            { tipo: 'escolha', direcao: 'pt-en', pergunta: 'A conta, por favor', opcoes: ['The bill, please', 'More, please', 'Water, please', "That's enough"], correta: 'The bill, please' },
            { tipo: 'escolha', direcao: 'pt-en', pergunta: 'Delicioso', opcoes: ['Delicious', 'Expensive', 'Cheap', 'Fresh'], correta: 'Delicious' },
            { tipo: 'escolha', direcao: 'en-pt', pergunta: 'I would like', opcoes: ['Eu quero', 'Eu gostaria', 'Eu preciso', 'Eu tenho'], correta: 'Eu gostaria' },
            { tipo: 'escolha', direcao: 'en-pt', pergunta: "That's enough", opcoes: ['Mais um pouco', 'Já chega', 'Está ótimo', 'Muito obrigado'], correta: 'Já chega' },
            { tipo: 'parear', pares: [['A conta, por favor', 'The bill, please'], ['Delicioso', 'Delicious'], ['Mais, por favor', 'More, please'], ['Água, por favor', 'Water, please']] },
            { tipo: 'completar', frase: 'This soup is really ___!', opcoes: ['delicious', 'expensive', 'empty'], correta: 'delicious' }
          ]
        },
        {
          id: 'l3',
          titulo: 'Bebidas',
          vocabulario: [{ en: 'Juice', pt: 'Suco' }, { en: 'Cold', pt: 'Gelado' }, { en: 'Beer', pt: 'Cerveja' }, { en: 'Hot', pt: 'Quente' }],
          exercicios: [
            { tipo: 'escolha', direcao: 'pt-en', pergunta: 'Suco', opcoes: ['juice', 'soda', 'beer', 'tea'], correta: 'juice' },
            { tipo: 'escolha', direcao: 'pt-en', pergunta: 'Gelado', opcoes: ['cold', 'hot', 'fresh', 'sweet'], correta: 'cold' },
            { tipo: 'escolha', direcao: 'en-pt', pergunta: 'Beer', opcoes: ['Cerveja', 'Chá', 'Suco', 'Refrigerante'], correta: 'Cerveja' },
            { tipo: 'escolha', direcao: 'en-pt', pergunta: 'Hot', opcoes: ['Quente', 'Gelado', 'Doce', 'Forte'], correta: 'Quente' },
            { tipo: 'parear', pares: [['Água', 'Water'], ['Café', 'Coffee'], ['Suco', 'Juice'], ['Chá', 'Tea']] },
            { tipo: 'completar', frase: "I'd like a cold ___, please.", opcoes: ['soda', 'coffee', 'tea'], correta: 'soda' }
          ]
        },
        {
          id: 'l4',
          titulo: 'Frutas e verduras',
          vocabulario: [{ en: 'Orange', pt: 'Laranja' }, { en: 'Onion', pt: 'Cebola' }, { en: 'Potato', pt: 'Batata' }, { en: 'Lettuce', pt: 'Alface' }],
          exercicios: [
            { tipo: 'escolha', direcao: 'pt-en', pergunta: 'Laranja', opcoes: ['orange', 'apple', 'banana', 'tomato'], correta: 'orange' },
            { tipo: 'escolha', direcao: 'pt-en', pergunta: 'Cebola', opcoes: ['onion', 'potato', 'lettuce', 'tomato'], correta: 'onion' },
            { tipo: 'escolha', direcao: 'en-pt', pergunta: 'Potato', opcoes: ['Batata', 'Cebola', 'Alface', 'Tomate'], correta: 'Batata' },
            { tipo: 'escolha', direcao: 'en-pt', pergunta: 'Lettuce', opcoes: ['Alface', 'Batata', 'Tomate', 'Cebola'], correta: 'Alface' },
            { tipo: 'parear', pares: [['Maçã', 'Apple'], ['Banana', 'Banana'], ['Tomate', 'Tomato'], ['Batata', 'Potato']] },
            { tipo: 'completar', frase: 'I need one ___ and two potatoes.', opcoes: ['onion', 'apple', 'lettuce'], correta: 'onion' }
          ]
        },
        {
          id: 'l5',
          titulo: 'Pedindo comida',
          vocabulario: [{ en: 'To go', pt: 'Para viagem' }, { en: 'No onions, please', pt: 'Sem cebola, por favor' }, { en: 'I\'ll have the chicken', pt: 'Eu vou querer o frango' }, { en: 'For here', pt: 'Para comer aqui' }],
          exercicios: [
            { tipo: 'escolha', direcao: 'pt-en', pergunta: 'Para viagem', opcoes: ['To go', 'For here', 'No onions, please', 'With rice and beans'], correta: 'To go' },
            { tipo: 'escolha', direcao: 'pt-en', pergunta: 'Sem cebola, por favor', opcoes: ['No onions, please', 'To go', 'For here', 'Can I get a bag?'], correta: 'No onions, please' },
            { tipo: 'escolha', direcao: 'en-pt', pergunta: "I'll have the chicken", opcoes: ['Eu vou querer o frango', 'Eu não gosto de frango', 'Tem frango?', 'Frango, por favor'], correta: 'Eu vou querer o frango' },
            { tipo: 'escolha', direcao: 'en-pt', pergunta: 'For here', opcoes: ['Para comer aqui', 'Para viagem', 'Aqui está', 'Para você'], correta: 'Para comer aqui' },
            { tipo: 'parear', pares: [['Para viagem', 'To go'], ['Para comer aqui', 'For here'], ['Sem cebola, por favor', 'No onions, please'], ['Posso levar uma sacola?', 'Can I get a bag?']] },
            { tipo: 'completar', frase: 'Is it for here or to ___?', opcoes: ['go', 'eat', 'stay'], correta: 'go' }
          ]
        }
      ]
    },
    {
      id: 'u4',
      titulo: 'No comércio',
      icone: '🏪',
      licoes: [
        {
          id: 'l1',
          titulo: 'Perguntando preço',
          vocabulario: [{ en: 'How much is it?', pt: 'Quanto custa?' }, { en: 'Discount', pt: 'Desconto' }, { en: 'It\'s cheap', pt: 'É barato' }, { en: 'Cash', pt: 'Dinheiro' }],
          exercicios: [
            { tipo: 'escolha', direcao: 'pt-en', pergunta: 'Quanto custa?', opcoes: ['How much is it?', 'Do you accept card?', "It's expensive", 'Is it open?'], correta: 'How much is it?' },
            { tipo: 'escolha', direcao: 'pt-en', pergunta: 'Desconto', opcoes: ['Discount', 'Cash', 'Price', 'Change'], correta: 'Discount' },
            { tipo: 'escolha', direcao: 'en-pt', pergunta: "It's cheap", opcoes: ['É caro', 'É barato', 'É grátis', 'É novo'], correta: 'É barato' },
            { tipo: 'escolha', direcao: 'en-pt', pergunta: 'Cash', opcoes: ['Cartão', 'Dinheiro', 'Troco', 'Preço'], correta: 'Dinheiro' },
            { tipo: 'parear', pares: [['Quanto custa?', 'How much is it?'], ["É caro", "It's expensive"], ['Desconto', 'Discount'], ['Dinheiro', 'Cash']] },
            { tipo: 'completar', frase: 'Do you accept ___?', opcoes: ['card', 'bread', 'discount'], correta: 'card' }
          ]
        },
        {
          id: 'l2',
          titulo: 'Atendendo o cliente',
          vocabulario: [{ en: 'Can I help you?', pt: 'Posso ajudar?' }, { en: 'Closed', pt: 'Fechado' }, { en: 'Welcome!', pt: 'Bem-vindo!' }, { en: 'Come again!', pt: 'Volte sempre!' }],
          exercicios: [
            { tipo: 'escolha', direcao: 'pt-en', pergunta: 'Posso ajudar?', opcoes: ['Can I help you?', 'Come again!', "It's closed", 'Welcome!'], correta: 'Can I help you?' },
            { tipo: 'escolha', direcao: 'pt-en', pergunta: 'Fechado', opcoes: ['Open', 'Closed', 'Cheap', 'Expensive'], correta: 'Closed' },
            { tipo: 'escolha', direcao: 'en-pt', pergunta: 'Welcome!', opcoes: ['Volte sempre!', 'Bem-vindo!', 'Obrigado!', 'Com licença!'], correta: 'Bem-vindo!' },
            { tipo: 'escolha', direcao: 'en-pt', pergunta: 'Come again!', opcoes: ['Volte sempre!', 'Vá embora!', 'Fechado!', 'Aberto!'], correta: 'Volte sempre!' },
            { tipo: 'parear', pares: [['Posso ajudar?', 'Can I help you?'], ['Bem-vindo!', 'Welcome!'], ['Aberto', 'Open'], ['Volte sempre!', 'Come again!']] },
            { tipo: 'completar', frase: 'We are ___ every day from 8 to 6.', opcoes: ['open', 'closed', 'expensive'], correta: 'open' }
          ]
        },
        {
          id: 'l3',
          titulo: 'Horário de funcionamento',
          vocabulario: [{ en: 'We open at nine', pt: 'Nós abrimos às nove' }, { en: 'Closed on Sundays', pt: 'Fechado aos domingos' }, { en: 'Lunch break', pt: 'Horário de almoço' }, { en: 'Back in 10 minutes', pt: 'Voltamos em 10 minutos' }],
          exercicios: [
            { tipo: 'escolha', direcao: 'pt-en', pergunta: 'Nós abrimos às nove', opcoes: ['We open at nine', 'We close at six', 'Closed on Sundays', 'Business hours'], correta: 'We open at nine' },
            { tipo: 'escolha', direcao: 'pt-en', pergunta: 'Fechado aos domingos', opcoes: ['Closed on Sundays', 'We close at six', 'Lunch break', 'Back in 10 minutes'], correta: 'Closed on Sundays' },
            { tipo: 'escolha', direcao: 'en-pt', pergunta: 'Lunch break', opcoes: ['Horário de almoço', 'Horário de funcionamento', 'Voltamos em 10 minutos', 'Fechado aos domingos'], correta: 'Horário de almoço' },
            { tipo: 'escolha', direcao: 'en-pt', pergunta: 'Back in 10 minutes', opcoes: ['Voltamos em 10 minutos', 'Nós fechamos às seis', 'Horário de almoço', 'Nós abrimos às nove'], correta: 'Voltamos em 10 minutos' },
            { tipo: 'parear', pares: [['Nós abrimos às nove', 'We open at nine'], ['Nós fechamos às seis', 'We close at six'], ['Horário de almoço', 'Lunch break'], ['Horário de funcionamento', 'Business hours']] },
            { tipo: 'completar', frase: 'We ___ at six.', opcoes: ['close', 'open', 'break'], correta: 'close' }
          ]
        },
        {
          id: 'l4',
          titulo: 'Formas de pagamento',
          vocabulario: [{ en: 'Credit card', pt: 'Cartão de crédito' }, { en: 'Free delivery', pt: 'Entrega grátis' }, { en: 'Installments', pt: 'Parcelas' }, { en: 'Do you deliver?', pt: 'Vocês entregam?' }],
          exercicios: [
            { tipo: 'escolha', direcao: 'pt-en', pergunta: 'Cartão de crédito', opcoes: ['Credit card', 'Debit card', 'Cash', 'Installments'], correta: 'Credit card' },
            { tipo: 'escolha', direcao: 'pt-en', pergunta: 'Entrega grátis', opcoes: ['Free delivery', 'Do you deliver?', 'Cash', 'Installments'], correta: 'Free delivery' },
            { tipo: 'escolha', direcao: 'en-pt', pergunta: 'Installments', opcoes: ['Parcelas', 'Dinheiro', 'Entrega grátis', 'Cartão de débito'], correta: 'Parcelas' },
            { tipo: 'escolha', direcao: 'en-pt', pergunta: 'Do you deliver?', opcoes: ['Vocês entregam?', 'Entrega grátis', 'Vocês aceitam cartão?', 'Quanto custa?'], correta: 'Vocês entregam?' },
            { tipo: 'parear', pares: [['Cartão de crédito', 'Credit card'], ['Cartão de débito', 'Debit card'], ['Parcelas', 'Installments'], ['Entrega grátis', 'Free delivery']] },
            { tipo: 'completar', frase: 'Can I pay in three ___?', opcoes: ['installments', 'cash', 'card'], correta: 'installments' }
          ]
        },
        {
          id: 'l5',
          titulo: 'Resolvendo problemas',
          vocabulario: [{ en: 'One moment, please', pt: 'Um momento, por favor' }, { en: 'It\'s out of stock', pt: 'Está sem estoque' }, { en: 'Let me check', pt: 'Deixa eu verificar' }, { en: 'Anything else?', pt: 'Mais alguma coisa?' }],
          exercicios: [
            { tipo: 'escolha', direcao: 'pt-en', pergunta: 'Um momento, por favor', opcoes: ['One moment, please', "I'll be right back", 'Let me check', 'Anything else?'], correta: 'One moment, please' },
            { tipo: 'escolha', direcao: 'pt-en', pergunta: 'Está sem estoque', opcoes: ["It's out of stock", "I'm sorry", 'Let me check', 'Anything else?'], correta: "It's out of stock" },
            { tipo: 'escolha', direcao: 'en-pt', pergunta: 'Let me check', opcoes: ['Deixa eu verificar', 'Um momento, por favor', 'Já volto', 'Sinto muito'], correta: 'Deixa eu verificar' },
            { tipo: 'escolha', direcao: 'en-pt', pergunta: 'Anything else?', opcoes: ['Mais alguma coisa?', 'Está sem estoque', 'Já volto', 'Um momento, por favor'], correta: 'Mais alguma coisa?' },
            { tipo: 'parear', pares: [['Sinto muito', "I'm sorry"], ['Deixa eu verificar', 'Let me check'], ['Já volto', "I'll be right back"], ['Mais alguma coisa?', 'Anything else?']] },
            { tipo: 'completar', frase: "I'll be right ___.", opcoes: ['back', 'here', 'sorry'], correta: 'back' }
          ]
        }
      ]
    }
  ]
};

// Roda em script clássico — var de topo já vira window.APRENDER_CONTEUDO,
// mas deixamos explícito por robustez pós-minify (mesmo padrão do resto do app).
window.APRENDER_CONTEUDO = APRENDER_CONTEUDO;
