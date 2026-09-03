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
          exercicios: [
            { tipo: 'escolha', direcao: 'pt-en', pergunta: 'Por favor', opcoes: ['Please', 'Thanks', 'Sorry', 'Welcome'], correta: 'Please' },
            { tipo: 'escolha', direcao: 'pt-en', pergunta: 'Obrigado', opcoes: ['Thank you', "You're welcome", 'Excuse me', 'Please'], correta: 'Thank you' },
            { tipo: 'escolha', direcao: 'en-pt', pergunta: 'How are you?', opcoes: ['Qual é seu nome?', 'Como você está?', 'De onde você é?', 'Quantos anos você tem?'], correta: 'Como você está?' },
            { tipo: 'escolha', direcao: 'en-pt', pergunta: "You're welcome", opcoes: ['Por favor', 'Com licença', 'De nada', 'Prazer'], correta: 'De nada' },
            { tipo: 'parear', pares: [['Por favor', 'Please'], ['Obrigado', 'Thank you'], ['De nada', "You're welcome"], ['Com licença', 'Excuse me']] },
            { tipo: 'completar', frase: 'Nice to ___ you!', opcoes: ['meet', 'eat', 'see'], correta: 'meet' }
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
          exercicios: [
            { tipo: 'escolha', direcao: 'pt-en', pergunta: 'Sete', opcoes: ['six', 'seven', 'eight', 'nine'], correta: 'seven' },
            { tipo: 'escolha', direcao: 'pt-en', pergunta: 'Dez', opcoes: ['eight', 'nine', 'ten', 'seven'], correta: 'ten' },
            { tipo: 'escolha', direcao: 'en-pt', pergunta: 'Eight', opcoes: ['Seis', 'Sete', 'Oito', 'Nove'], correta: 'Oito' },
            { tipo: 'escolha', direcao: 'en-pt', pergunta: 'Nine', opcoes: ['Sete', 'Oito', 'Nove', 'Dez'], correta: 'Nove' },
            { tipo: 'parear', pares: [['Seis', 'Six'], ['Sete', 'Seven'], ['Oito', 'Eight'], ['Nove', 'Nine']] },
            { tipo: 'completar', frase: 'The store closes at ___ o’clock.', opcoes: ['ten', 'six', 'eight'], correta: 'ten' }
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
          exercicios: [
            { tipo: 'escolha', direcao: 'pt-en', pergunta: 'A conta, por favor', opcoes: ['The bill, please', 'More, please', 'Water, please', "That's enough"], correta: 'The bill, please' },
            { tipo: 'escolha', direcao: 'pt-en', pergunta: 'Delicioso', opcoes: ['Delicious', 'Expensive', 'Cheap', 'Fresh'], correta: 'Delicious' },
            { tipo: 'escolha', direcao: 'en-pt', pergunta: 'I would like', opcoes: ['Eu quero', 'Eu gostaria', 'Eu preciso', 'Eu tenho'], correta: 'Eu gostaria' },
            { tipo: 'escolha', direcao: 'en-pt', pergunta: "That's enough", opcoes: ['Mais um pouco', 'Já chega', 'Está ótimo', 'Muito obrigado'], correta: 'Já chega' },
            { tipo: 'parear', pares: [['A conta, por favor', 'The bill, please'], ['Delicioso', 'Delicious'], ['Mais, por favor', 'More, please'], ['Água, por favor', 'Water, please']] },
            { tipo: 'completar', frase: 'This soup is really ___!', opcoes: ['delicious', 'expensive', 'empty'], correta: 'delicious' }
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
          exercicios: [
            { tipo: 'escolha', direcao: 'pt-en', pergunta: 'Posso ajudar?', opcoes: ['Can I help you?', 'Come again!', "It's closed", 'Welcome!'], correta: 'Can I help you?' },
            { tipo: 'escolha', direcao: 'pt-en', pergunta: 'Fechado', opcoes: ['Open', 'Closed', 'Cheap', 'Expensive'], correta: 'Closed' },
            { tipo: 'escolha', direcao: 'en-pt', pergunta: 'Welcome!', opcoes: ['Volte sempre!', 'Bem-vindo!', 'Obrigado!', 'Com licença!'], correta: 'Bem-vindo!' },
            { tipo: 'escolha', direcao: 'en-pt', pergunta: 'Come again!', opcoes: ['Volte sempre!', 'Vá embora!', 'Fechado!', 'Aberto!'], correta: 'Volte sempre!' },
            { tipo: 'parear', pares: [['Posso ajudar?', 'Can I help you?'], ['Bem-vindo!', 'Welcome!'], ['Aberto', 'Open'], ['Volte sempre!', 'Come again!']] },
            { tipo: 'completar', frase: 'We are ___ every day from 8 to 6.', opcoes: ['open', 'closed', 'expensive'], correta: 'open' }
          ]
        }
      ]
    }
  ]
};

// Roda em script clássico — var de topo já vira window.APRENDER_CONTEUDO,
// mas deixamos explícito por robustez pós-minify (mesmo padrão do resto do app).
window.APRENDER_CONTEUDO = APRENDER_CONTEUDO;
