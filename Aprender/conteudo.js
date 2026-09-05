'use strict';

/* ══════════════════════════════════════════════════════════════
   APRENDER — banco de conteúdo (Inglês) — Aprender/conteudo.js
   Fácil de editar: cada unidade tem um id, título, ícone e uma lista
   de lições; cada lição segue o formato "híbrido" abaixo — o motor
   (Aprender/hub.js) monta sozinho a ordem das telas/exercícios a
   partir disso, nunca edite "exercicios" soltos aqui.

   FORMATO DE CADA LIÇÃO:
     {
       id: 'l1',
       titulo: '...',
       blocos: [                      // SEMPRE 2 blocos = 4 palavras no total
         {
           tipo: 'par',
           palavras: [{en,pt}, {en,pt}],   // SEMPRE 2 palavras
           exemplo: { en: '...', pt: '...' } // 1 frase curta usando o par
         },
         { tipo: 'par', palavras: [...], exemplo: {...} }
       ],
       fraseFinal: {                   // frase de produção (exercício "formar")
         en: '...',
         pt: ['Palavra', 'por', 'palavra!'],  // a tradução, token por token
         distratores: ['minusculo', 'minusculo']  // palavras erradas pro banco
       }
     }

   O motor monta automaticamente, nessa ordem (ver _aprMontarRoteiro em
   Aprender/hub.js):
     1) ensina bloco 1 (2 palavras + exemplo) → 1 exercício de múltipla
        escolha só sobre esse par (o motor sorteia qual das 2 palavras
        pergunta e gera as opções erradas sozinho, usando um banco global
        com as palavras de TODAS as lições)
     2) ensina bloco 2 → 1 exercício de múltipla escolha desse par
     3) consolidação: "parear" com as 4 palavras dos dois blocos
     4) produção: "formar frase" com a fraseFinal
     5) reforço (condicional): se a pessoa errou alguma palavra em
        qualquer um dos passos acima, entra 1 exercício extra de múltipla
        escolha só dessa palavra antes da tela de resultado — se acertou
        tudo, pula direto pro resultado.

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
          blocos: [
            {
              tipo: 'par',
              palavras: [{ en: 'Hello', pt: 'Olá' }, { en: 'Goodbye', pt: 'Tchau' }],
              exemplo: { en: 'Hello! Goodbye!', pt: 'Olá! Tchau!' }
            },
            {
              tipo: 'par',
              palavras: [{ en: 'Good morning', pt: 'Bom dia' }, { en: 'Good night', pt: 'Boa noite' }],
              exemplo: { en: 'Good morning!', pt: 'Bom dia!' }
            }
          ],
          fraseFinal: { en: 'Hello, good morning!', pt: ['Olá,', 'bom', 'dia!'], distratores: ['tchau', 'noite'] }
        },
        {
          id: 'l2',
          titulo: 'Como você está',
          blocos: [
            {
              tipo: 'par',
              palavras: [{ en: 'Please', pt: 'Por favor' }, { en: 'Thank you', pt: 'Obrigado' }],
              exemplo: { en: 'Coffee, please! Thank you!', pt: 'Café, por favor! Obrigado!' }
            },
            {
              tipo: 'par',
              palavras: [{ en: 'How are you?', pt: 'Como você está?' }, { en: "You're welcome", pt: 'De nada' }],
              exemplo: { en: 'How are you today?', pt: 'Como você está hoje?' }
            }
          ],
          fraseFinal: { en: 'Thank you very much!', pt: ['Muito', 'obrigado!'], distratores: ['nada', 'favor'] }
        },
        {
          id: 'l3',
          titulo: 'Apresentações',
          blocos: [
            {
              tipo: 'par',
              palavras: [{ en: "What's your name?", pt: 'Qual é o seu nome?' }, { en: 'Where are you from?', pt: 'De onde você é?' }],
              exemplo: { en: "What's your name? Where are you from?", pt: 'Qual é o seu nome? De onde você é?' }
            },
            {
              tipo: 'par',
              palavras: [{ en: "I'm from Angatuba", pt: 'Eu sou de Angatuba' }, { en: 'This is my friend', pt: 'Este é meu amigo' }],
              exemplo: { en: "I'm from Angatuba. This is my friend.", pt: 'Eu sou de Angatuba. Este é meu amigo.' }
            }
          ],
          fraseFinal: { en: "What's your name?", pt: ['Qual', 'é', 'o', 'seu', 'nome?'], distratores: ['onde', 'amigo'] }
        },
        {
          id: 'l4',
          titulo: 'Perguntas educadas',
          blocos: [
            {
              tipo: 'par',
              palavras: [{ en: 'Can you help me?', pt: 'Você pode me ajudar?' }, { en: 'No problem', pt: 'Sem problema' }],
              exemplo: { en: 'Can you help me? No problem!', pt: 'Você pode me ajudar? Sem problema!' }
            },
            {
              tipo: 'par',
              palavras: [{ en: "I don't understand", pt: 'Eu não entendo' }, { en: 'Could you repeat, please?', pt: 'Você pode repetir, por favor?' }],
              exemplo: { en: "I don't understand. Could you repeat, please?", pt: 'Eu não entendo. Você pode repetir, por favor?' }
            }
          ],
          fraseFinal: { en: 'Could you repeat, please?', pt: ['Você', 'pode', 'repetir,', 'por', 'favor?'], distratores: ['ajudar', 'entendo'] }
        },
        {
          id: 'l5',
          titulo: 'Fechando a conversa',
          blocos: [
            {
              tipo: 'par',
              palavras: [{ en: 'See you tomorrow', pt: 'Até amanhã' }, { en: 'Take care', pt: 'Se cuida' }],
              exemplo: { en: 'Take care! See you tomorrow!', pt: 'Se cuida! Até amanhã!' }
            },
            {
              tipo: 'par',
              palavras: [{ en: 'Have a nice day', pt: 'Tenha um bom dia' }, { en: 'Have a good trip', pt: 'Tenha uma boa viagem' }],
              exemplo: { en: 'Have a nice day and a good trip!', pt: 'Tenha um bom dia e uma boa viagem!' }
            }
          ],
          fraseFinal: { en: 'See you tomorrow!', pt: ['Até', 'amanhã!'], distratores: ['viagem', 'cuida'] }
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
          blocos: [
            {
              tipo: 'par',
              palavras: [{ en: 'One', pt: 'Um' }, { en: 'Three', pt: 'Três' }],
              exemplo: { en: 'I have one apple and three bananas.', pt: 'Eu tenho uma maçã e três bananas.' }
            },
            {
              tipo: 'par',
              palavras: [{ en: 'Four', pt: 'Quatro' }, { en: 'Five', pt: 'Cinco' }],
              exemplo: { en: 'I need four or five.', pt: 'Eu preciso de quatro ou cinco.' }
            }
          ],
          fraseFinal: { en: 'Four or five, please!', pt: ['Quatro', 'ou', 'cinco,', 'por', 'favor!'], distratores: ['três', 'um'] }
        },
        {
          id: 'l2',
          titulo: 'Números 6 a 10',
          blocos: [
            {
              tipo: 'par',
              palavras: [{ en: 'Seven', pt: 'Sete' }, { en: 'Eight', pt: 'Oito' }],
              exemplo: { en: 'Seven or eight?', pt: 'Sete ou oito?' }
            },
            {
              tipo: 'par',
              palavras: [{ en: 'Nine', pt: 'Nove' }, { en: 'Ten', pt: 'Dez' }],
              exemplo: { en: 'Nine or ten?', pt: 'Nove ou dez?' }
            }
          ],
          fraseFinal: { en: 'Ten, please!', pt: ['Dez,', 'por', 'favor!'], distratores: ['nove', 'oito'] }
        },
        {
          id: 'l3',
          titulo: 'Contando objetos',
          blocos: [
            {
              tipo: 'par',
              palavras: [{ en: 'One apple', pt: 'Uma maçã' }, { en: 'Just one', pt: 'Só um' }],
              exemplo: { en: 'Just one apple, please.', pt: 'Só uma maçã, por favor.' }
            },
            {
              tipo: 'par',
              palavras: [{ en: 'How many?', pt: 'Quantos?' }, { en: 'A few', pt: 'Alguns' }],
              exemplo: { en: 'How many? Just a few.', pt: 'Quantos? Só alguns.' }
            }
          ],
          fraseFinal: { en: 'Just one, please!', pt: ['Só', 'um,', 'por', 'favor!'], distratores: ['alguns', 'quantos'] }
        },
        {
          id: 'l4',
          titulo: 'Perguntando quantidade',
          blocos: [
            {
              tipo: 'par',
              palavras: [{ en: 'How many do you want?', pt: 'Quantos você quer?' }, { en: 'One more, please', pt: 'Mais um, por favor' }],
              exemplo: { en: 'How many do you want? One more, please!', pt: 'Quantos você quer? Mais um, por favor!' }
            },
            {
              tipo: 'par',
              palavras: [{ en: 'Half a kilo, please', pt: 'Meio quilo, por favor' }, { en: 'A dozen, please', pt: 'Uma dúzia, por favor' }],
              exemplo: { en: 'A dozen, please!', pt: 'Uma dúzia, por favor!' }
            }
          ],
          fraseFinal: { en: 'How many do you want?', pt: ['Quantos', 'você', 'quer?'], distratores: ['muitos', 'poucos'] }
        },
        {
          id: 'l5',
          titulo: 'Números no dia a dia',
          blocos: [
            {
              tipo: 'par',
              palavras: [{ en: 'Table one', pt: 'Mesa um' }, { en: 'Order number three', pt: 'Pedido número três' }],
              exemplo: { en: 'Table one, order number three.', pt: 'Mesa um, pedido número três.' }
            },
            {
              tipo: 'par',
              palavras: [{ en: 'Room four', pt: 'Quarto quatro' }, { en: 'Aisle six', pt: 'Corredor seis' }],
              exemplo: { en: 'Room four, aisle six.', pt: 'Quarto quatro, corredor seis.' }
            }
          ],
          fraseFinal: { en: 'Table one, please!', pt: ['Mesa', 'um,', 'por', 'favor!'], distratores: ['quatro', 'seis'] }
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
          blocos: [
            {
              tipo: 'par',
              palavras: [{ en: 'Bread', pt: 'Pão' }, { en: 'Water', pt: 'Água' }],
              exemplo: { en: 'Bread and water, please.', pt: 'Pão e água, por favor.' }
            },
            {
              tipo: 'par',
              palavras: [{ en: 'Chicken', pt: 'Frango' }, { en: 'Fruit', pt: 'Fruta' }],
              exemplo: { en: 'Chicken and fruit, please.', pt: 'Frango e fruta, por favor.' }
            }
          ],
          fraseFinal: { en: 'Bread and water, please.', pt: ['Pão', 'e', 'água,', 'por', 'favor.'], distratores: ['frango', 'fruta'] }
        },
        {
          id: 'l2',
          titulo: 'No restaurante',
          blocos: [
            {
              tipo: 'par',
              palavras: [{ en: 'The bill, please', pt: 'A conta, por favor' }, { en: "That's enough", pt: 'Já chega' }],
              exemplo: { en: "That's enough, the bill please!", pt: 'Já chega, a conta por favor!' }
            },
            {
              tipo: 'par',
              palavras: [{ en: 'Delicious', pt: 'Delicioso' }, { en: 'I would like', pt: 'Eu gostaria' }],
              exemplo: { en: 'I would like something delicious.', pt: 'Eu gostaria de algo delicioso.' }
            }
          ],
          fraseFinal: { en: 'The bill, please', pt: ['A', 'conta,', 'por', 'favor'], distratores: ['rápido', 'devagar'] }
        },
        {
          id: 'l3',
          titulo: 'Bebidas',
          blocos: [
            {
              tipo: 'par',
              palavras: [{ en: 'Juice', pt: 'Suco' }, { en: 'Beer', pt: 'Cerveja' }],
              exemplo: { en: 'Juice or beer?', pt: 'Suco ou cerveja?' }
            },
            {
              tipo: 'par',
              palavras: [{ en: 'Cold', pt: 'Gelado' }, { en: 'Hot', pt: 'Quente' }],
              exemplo: { en: 'Hot or cold?', pt: 'Quente ou gelado?' }
            }
          ],
          fraseFinal: { en: 'A cold juice, please!', pt: ['Um', 'suco', 'gelado,', 'por', 'favor!'], distratores: ['cerveja', 'quente'] }
        },
        {
          id: 'l4',
          titulo: 'Frutas e verduras',
          blocos: [
            {
              tipo: 'par',
              palavras: [{ en: 'Onion', pt: 'Cebola' }, { en: 'Potato', pt: 'Batata' }],
              exemplo: { en: 'Onion and potato, please.', pt: 'Cebola e batata, por favor.' }
            },
            {
              tipo: 'par',
              palavras: [{ en: 'Orange', pt: 'Laranja' }, { en: 'Lettuce', pt: 'Alface' }],
              exemplo: { en: 'Orange and lettuce, please.', pt: 'Laranja e alface, por favor.' }
            }
          ],
          fraseFinal: { en: 'One onion, please!', pt: ['Uma', 'cebola,', 'por', 'favor!'], distratores: ['batata', 'alface'] }
        },
        {
          id: 'l5',
          titulo: 'Pedindo comida',
          blocos: [
            {
              tipo: 'par',
              palavras: [{ en: 'To go', pt: 'Para viagem' }, { en: 'For here', pt: 'Para comer aqui' }],
              exemplo: { en: 'For here or to go?', pt: 'Para comer aqui ou para viagem?' }
            },
            {
              tipo: 'par',
              palavras: [{ en: 'No onions, please', pt: 'Sem cebola, por favor' }, { en: "I'll have the chicken", pt: 'Eu vou querer o frango' }],
              exemplo: { en: "I'll have the chicken, no onions please.", pt: 'Eu vou querer o frango, sem cebola por favor.' }
            }
          ],
          fraseFinal: { en: 'For here or to go?', pt: ['Para', 'comer', 'aqui', 'ou', 'para', 'viagem?'], distratores: ['frango', 'cebola'] }
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
          blocos: [
            {
              tipo: 'par',
              palavras: [{ en: 'How much is it?', pt: 'Quanto custa?' }, { en: "It's cheap", pt: 'É barato' }],
              exemplo: { en: "How much is it? It's cheap!", pt: 'Quanto custa? É barato!' }
            },
            {
              tipo: 'par',
              palavras: [{ en: 'Discount', pt: 'Desconto' }, { en: 'Cash', pt: 'Dinheiro' }],
              exemplo: { en: 'Discount for cash!', pt: 'Desconto para dinheiro!' }
            }
          ],
          fraseFinal: { en: 'How much is it?', pt: ['Quanto', 'custa?'], distratores: ['barato', 'desconto'] }
        },
        {
          id: 'l2',
          titulo: 'Atendendo o cliente',
          blocos: [
            {
              tipo: 'par',
              palavras: [{ en: 'Can I help you?', pt: 'Posso ajudar?' }, { en: 'Welcome!', pt: 'Bem-vindo!' }],
              exemplo: { en: 'Welcome! Can I help you?', pt: 'Bem-vindo! Posso ajudar?' }
            },
            {
              tipo: 'par',
              palavras: [{ en: 'Closed', pt: 'Fechado' }, { en: 'Come again!', pt: 'Volte sempre!' }],
              exemplo: { en: "We're closed. Come again!", pt: 'Estamos fechados. Volte sempre!' }
            }
          ],
          fraseFinal: { en: 'Welcome! Come again!', pt: ['Bem-vindo!', 'Volte', 'sempre!'], distratores: ['fechado', 'ajudar'] }
        },
        {
          id: 'l3',
          titulo: 'Horário de funcionamento',
          blocos: [
            {
              tipo: 'par',
              palavras: [{ en: 'We open at nine', pt: 'Nós abrimos às nove' }, { en: 'Closed on Sundays', pt: 'Fechado aos domingos' }],
              exemplo: { en: 'We open at nine, closed on Sundays.', pt: 'Nós abrimos às nove, fechado aos domingos.' }
            },
            {
              tipo: 'par',
              palavras: [{ en: 'Lunch break', pt: 'Horário de almoço' }, { en: 'Back in 10 minutes', pt: 'Voltamos em 10 minutos' }],
              exemplo: { en: 'Lunch break — back in 10 minutes!', pt: 'Horário de almoço — voltamos em 10 minutos!' }
            }
          ],
          fraseFinal: { en: 'We open at nine', pt: ['Nós', 'abrimos', 'às', 'nove'], distratores: ['fechamos', 'hoje'] }
        },
        {
          id: 'l4',
          titulo: 'Formas de pagamento',
          blocos: [
            {
              tipo: 'par',
              palavras: [{ en: 'Credit card', pt: 'Cartão de crédito' }, { en: 'Installments', pt: 'Parcelas' }],
              exemplo: { en: 'Credit card, in installments?', pt: 'Cartão de crédito, em parcelas?' }
            },
            {
              tipo: 'par',
              palavras: [{ en: 'Free delivery', pt: 'Entrega grátis' }, { en: 'Do you deliver?', pt: 'Vocês entregam?' }],
              exemplo: { en: 'Free delivery! Do you deliver?', pt: 'Entrega grátis! Vocês entregam?' }
            }
          ],
          fraseFinal: { en: 'Do you deliver?', pt: ['Vocês', 'entregam?'], distratores: ['parcelas', 'cartão'] }
        },
        {
          id: 'l5',
          titulo: 'Resolvendo problemas',
          blocos: [
            {
              tipo: 'par',
              palavras: [{ en: 'One moment, please', pt: 'Um momento, por favor' }, { en: 'Let me check', pt: 'Deixa eu verificar' }],
              exemplo: { en: 'One moment, please. Let me check.', pt: 'Um momento, por favor. Deixa eu verificar.' }
            },
            {
              tipo: 'par',
              palavras: [{ en: "It's out of stock", pt: 'Está sem estoque' }, { en: 'Anything else?', pt: 'Mais alguma coisa?' }],
              exemplo: { en: "It's out of stock. Anything else?", pt: 'Está sem estoque. Mais alguma coisa?' }
            }
          ],
          fraseFinal: { en: 'Let me check!', pt: ['Deixa', 'eu', 'verificar!'], distratores: ['estoque', 'momento'] }
        }
      ]
    }
  ]
};

// Roda em script clássico — var de topo já vira window.APRENDER_CONTEUDO,
// mas deixamos explícito por robustez pós-minify (mesmo padrão do resto do app).
window.APRENDER_CONTEUDO = APRENDER_CONTEUDO;
