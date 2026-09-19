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

   REGRAS DE CONTEÚDO (o motor CONFIA nelas — quebrar aqui quebra o jogo):
     • Todo texto "en" é único no arquivo inteiro, e todo texto "pt"
       também. O banco de distratores das múltiplas escolhas é global
       (todas as palavras de todas as unidades): dois textos iguais em
       campos iguais fariam aparecer DUAS opções certas na mesma tela.
     • Dentro de UMA fraseFinal, os tokens de "pt" mais os "distratores"
       nunca se repetem — o exercício "formar" compara chip por texto
       (ver _aprRenderFormar em hub.js).
     • Os "distratores" são palavras em PORTUGUÊS (a montagem é em pt) e
       do mesmo campo semântico da frase — erradas, mas plausíveis.
     • Sem "<", ">" ou "&": tudo isto entra na tela via innerHTML.

   PROGRESSÃO (estilo Duolingo, 3 faixas):
     Faixa A — zero absoluto ......... u1  u2  u3  u4
     Faixa B — já sabe uma coisa e outra u5  u6  u7  u8
     Faixa C — se vira no idioma ..... u9  u10
   Uma ideia por lição, reuso espaçado (palavra ensinada numa unidade
   volta nos exemplos e frases das seguintes) e vocabulário de vida real
   em Angatuba: comércio, rua, família, trabalho, WhatsApp.

   COMPATIBILIDADE: u1–u4 mantêm os MESMOS ids de lição (l1–l5) de antes —
   quem já concluiu essas unidades continua com elas concluídas e não é
   "re-travado" por conteúdo novo. Unidades novas (u5–u10) entram
   bloqueadas e liberam na sequência normal.

   TESTE DE NIVELAMENTO (placement): o array "placement" no fim deste
   arquivo é independente do formato das lições — 2 perguntas por unidade
   (20 no total), na ordem das unidades. O motor usa só pra decidir quais
   unidades iniciais a pessoa já domina (ver a seção "Tela 0" em
   Aprender/hub.js); ele embaralha as opções na hora de mostrar, então a
   posição da resposta certa aqui não importa pro jogo — "correta" é o
   ÍNDICE da opção certa dentro de "opcoes".

   Roda no MESMO escopo global do app.js/hub.js (script clássico, sem
   módulo/IIFE) — carregado sob demanda junto com Aprender/hub.js (ver
   _carregarHubAprender em app.js). Só declara UMA variável global:
   APRENDER_CONTEUDO.
══════════════════════════════════════════════════════════════ */

var APRENDER_CONTEUDO = {
  idioma: 'en',
  unidades: [
    /* ══════════ FAIXA A — do zero ══════════ */
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
      titulo: 'Números e quantidade',
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
      titulo: 'Comida e bebida',
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
              palavras: [{ en: 'The menu, please', pt: 'O cardápio, por favor' }, { en: 'I would like', pt: 'Eu gostaria' }],
              exemplo: { en: 'The menu, please. I would like a coffee.', pt: 'O cardápio, por favor. Eu gostaria de um café.' }
            },
            {
              tipo: 'par',
              palavras: [{ en: 'Delicious', pt: 'Delicioso' }, { en: 'The bill, please', pt: 'A conta, por favor' }],
              exemplo: { en: 'It was delicious! The bill, please.', pt: 'Estava delicioso! A conta, por favor.' }
            }
          ],
          fraseFinal: { en: 'The bill, please', pt: ['A', 'conta,', 'por', 'favor'], distratores: ['cardápio', 'delicioso'] }
        },
        {
          id: 'l3',
          titulo: 'Bebidas',
          blocos: [
            {
              tipo: 'par',
              palavras: [{ en: 'Coffee', pt: 'Café' }, { en: 'Juice', pt: 'Suco' }],
              exemplo: { en: 'Coffee or juice?', pt: 'Café ou suco?' }
            },
            {
              tipo: 'par',
              palavras: [{ en: 'Cold', pt: 'Gelado' }, { en: 'Hot', pt: 'Quente' }],
              exemplo: { en: 'Hot or cold?', pt: 'Quente ou gelado?' }
            }
          ],
          fraseFinal: { en: 'A cold juice, please!', pt: ['Um', 'suco', 'gelado,', 'por', 'favor!'], distratores: ['café', 'quente'] }
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
    },

    /* ══════════ FAIXA B — já sabe uma coisa e outra ══════════ */
    {
      id: 'u5',
      titulo: 'Lugares na cidade',
      icone: '🗺️',
      licoes: [
        {
          id: 'l1',
          titulo: 'Onde fica?',
          blocos: [
            {
              tipo: 'par',
              palavras: [{ en: 'Where is it?', pt: 'Onde fica?' }, { en: 'Over there', pt: 'Ali' }],
              exemplo: { en: 'Where is it? Over there!', pt: 'Onde fica? Ali!' }
            },
            {
              tipo: 'par',
              palavras: [{ en: 'The street', pt: 'A rua' }, { en: 'The square', pt: 'A praça' }],
              exemplo: { en: 'The street and the square are here.', pt: 'A rua e a praça ficam aqui.' }
            }
          ],
          fraseFinal: { en: 'Where is the square?', pt: ['Onde', 'fica', 'a', 'praça?'], distratores: ['rua', 'ali'] }
        },
        {
          id: 'l2',
          titulo: 'Lugares do centro',
          blocos: [
            {
              tipo: 'par',
              palavras: [{ en: 'The market', pt: 'O mercado' }, { en: 'The pharmacy', pt: 'A farmácia' }],
              exemplo: { en: 'The pharmacy and the market are open.', pt: 'A farmácia e o mercado estão abertos.' }
            },
            {
              tipo: 'par',
              palavras: [{ en: 'The bank', pt: 'O banco' }, { en: 'The bakery', pt: 'A padaria' }],
              exemplo: { en: 'The bakery is near the bank.', pt: 'A padaria fica perto do banco.' }
            }
          ],
          fraseFinal: { en: 'Where is the pharmacy?', pt: ['Onde', 'fica', 'a', 'farmácia?'], distratores: ['padaria', 'banco'] }
        },
        {
          id: 'l3',
          titulo: 'Perto e longe',
          blocos: [
            {
              tipo: 'par',
              palavras: [{ en: 'Near', pt: 'Perto' }, { en: 'Far', pt: 'Longe' }],
              exemplo: { en: 'Is it near or far?', pt: 'É perto ou longe?' }
            },
            {
              tipo: 'par',
              palavras: [{ en: 'Next to', pt: 'Ao lado de' }, { en: 'In front of', pt: 'Em frente a' }],
              exemplo: { en: "It's next to the bank, in front of the square.", pt: 'Fica ao lado do banco, em frente à praça.' }
            }
          ],
          fraseFinal: { en: 'The market is near here.', pt: ['O', 'mercado', 'fica', 'perto', 'daqui.'], distratores: ['longe', 'praça'] }
        },
        {
          id: 'l4',
          titulo: 'Direita e esquerda',
          blocos: [
            {
              tipo: 'par',
              palavras: [{ en: 'Left', pt: 'Esquerda' }, { en: 'Right', pt: 'Direita' }],
              exemplo: { en: 'Left or right?', pt: 'Esquerda ou direita?' }
            },
            {
              tipo: 'par',
              palavras: [{ en: 'Straight ahead', pt: 'Sempre em frente' }, { en: 'On the corner', pt: 'Na esquina' }],
              exemplo: { en: "Straight ahead — it's on the corner.", pt: 'Sempre em frente — fica na esquina.' }
            }
          ],
          fraseFinal: { en: "It's on the corner, on the right.", pt: ['Fica', 'na', 'esquina,', 'à', 'direita.'], distratores: ['esquerda', 'frente'] }
        },
        {
          id: 'l5',
          titulo: 'Como chegar',
          blocos: [
            {
              tipo: 'par',
              palavras: [{ en: 'How do I get there?', pt: 'Como eu chego lá?' }, { en: 'Turn left', pt: 'Vire à esquerda' }],
              exemplo: { en: 'How do I get there? Turn left.', pt: 'Como eu chego lá? Vire à esquerda.' }
            },
            {
              tipo: 'par',
              palavras: [{ en: 'Cross the street', pt: 'Atravesse a rua' }, { en: "It's five minutes away", pt: 'Fica a cinco minutos' }],
              exemplo: { en: "Cross the street — it's five minutes away.", pt: 'Atravesse a rua — fica a cinco minutos.' }
            }
          ],
          fraseFinal: { en: 'How do I get there?', pt: ['Como', 'eu', 'chego', 'lá?'], distratores: ['rua', 'minutos'] }
        },
        {
          id: 'l6',
          titulo: 'Na rua',
          blocos: [
            {
              tipo: 'par',
              palavras: [{ en: 'The bus stop', pt: 'O ponto de ônibus' }, { en: 'The gas station', pt: 'O posto de gasolina' }],
              exemplo: { en: 'The bus stop is at the gas station.', pt: 'O ponto de ônibus fica no posto de gasolina.' }
            },
            {
              tipo: 'par',
              palavras: [{ en: 'Downtown', pt: 'No centro' }, { en: 'The parking lot', pt: 'O estacionamento' }],
              exemplo: { en: 'The parking lot is downtown.', pt: 'O estacionamento fica no centro.' }
            }
          ],
          fraseFinal: { en: 'Is the bus stop far?', pt: ['O', 'ponto', 'de', 'ônibus', 'é', 'longe?'], distratores: ['centro', 'perto'] }
        }
      ]
    },
    {
      id: 'u6',
      titulo: 'Família e pessoas',
      icone: '👪',
      licoes: [
        {
          id: 'l1',
          titulo: 'Minha família',
          blocos: [
            {
              tipo: 'par',
              palavras: [{ en: 'My mother', pt: 'Minha mãe' }, { en: 'My father', pt: 'Meu pai' }],
              exemplo: { en: 'My mother and my father are here.', pt: 'Minha mãe e meu pai estão aqui.' }
            },
            {
              tipo: 'par',
              palavras: [{ en: 'My son', pt: 'Meu filho' }, { en: 'My daughter', pt: 'Minha filha' }],
              exemplo: { en: 'My son and my daughter are at home.', pt: 'Meu filho e minha filha estão em casa.' }
            }
          ],
          fraseFinal: { en: 'This is my mother.', pt: ['Esta', 'é', 'minha', 'mãe.'], distratores: ['filha', 'pai'] }
        },
        {
          id: 'l2',
          titulo: 'Irmãos e avós',
          blocos: [
            {
              tipo: 'par',
              palavras: [{ en: 'My brother', pt: 'Meu irmão' }, { en: 'My sister', pt: 'Minha irmã' }],
              exemplo: { en: 'My brother and my sister work here.', pt: 'Meu irmão e minha irmã trabalham aqui.' }
            },
            {
              tipo: 'par',
              palavras: [{ en: 'My grandmother', pt: 'Minha avó' }, { en: 'My grandfather', pt: 'Meu avô' }],
              exemplo: { en: 'My grandmother and my grandfather live in Angatuba.', pt: 'Minha avó e meu avô moram em Angatuba.' }
            }
          ],
          fraseFinal: { en: 'My sister lives in Angatuba.', pt: ['Minha', 'irmã', 'mora', 'em', 'Angatuba.'], distratores: ['irmão', 'avó'] }
        },
        {
          id: 'l3',
          titulo: 'Ele, ela, nós',
          blocos: [
            {
              tipo: 'par',
              palavras: [{ en: 'He', pt: 'Ele' }, { en: 'She', pt: 'Ela' }],
              exemplo: { en: 'He is my son and she is my daughter.', pt: 'Ele é meu filho e ela é minha filha.' }
            },
            {
              tipo: 'par',
              palavras: [{ en: 'We', pt: 'Nós' }, { en: 'They', pt: 'Eles' }],
              exemplo: { en: 'We are here and they are at the market.', pt: 'Nós estamos aqui e eles estão no mercado.' }
            }
          ],
          fraseFinal: { en: 'She is my sister.', pt: ['Ela', 'é', 'minha', 'irmã.'], distratores: ['ele', 'mãe'] }
        },
        {
          id: 'l4',
          titulo: 'Dele, dela, nosso',
          blocos: [
            {
              tipo: 'par',
              palavras: [{ en: 'His name', pt: 'O nome dele' }, { en: 'Her name', pt: 'O nome dela' }],
              exemplo: { en: 'His name is Paulo and her name is Ana.', pt: 'O nome dele é Paulo e o nome dela é Ana.' }
            },
            {
              tipo: 'par',
              palavras: [{ en: 'Our house', pt: 'Nossa casa' }, { en: 'Their car', pt: 'O carro deles' }],
              exemplo: { en: 'This is our house and that is their car.', pt: 'Esta é nossa casa e aquele é o carro deles.' }
            }
          ],
          fraseFinal: { en: 'Her name is Ana.', pt: ['O', 'nome', 'dela', 'é', 'Ana.'], distratores: ['dele', 'nossa'] }
        },
        {
          id: 'l5',
          titulo: 'Apresentando alguém',
          blocos: [
            {
              tipo: 'par',
              palavras: [{ en: 'This is my wife', pt: 'Esta é minha esposa' }, { en: 'Nice to meet you', pt: 'Prazer em conhecer' }],
              exemplo: { en: 'This is my wife. Nice to meet you!', pt: 'Esta é minha esposa. Prazer em conhecer!' }
            },
            {
              tipo: 'par',
              palavras: [{ en: 'My husband', pt: 'Meu marido' }, { en: 'My neighbor', pt: 'Meu vizinho' }],
              exemplo: { en: 'My husband knows my neighbor.', pt: 'Meu marido conhece meu vizinho.' }
            }
          ],
          fraseFinal: { en: 'Nice to meet you!', pt: ['Prazer', 'em', 'conhecer!'], distratores: ['esposa', 'vizinho'] }
        },
        {
          id: 'l6',
          titulo: 'As pessoas ao redor',
          blocos: [
            {
              tipo: 'par',
              palavras: [{ en: 'My boss', pt: 'Meu chefe' }, { en: 'My co-worker', pt: 'Meu colega de trabalho' }],
              exemplo: { en: 'My boss talks to my co-worker.', pt: 'Meu chefe fala com meu colega de trabalho.' }
            },
            {
              tipo: 'par',
              palavras: [{ en: 'My teacher', pt: 'Meu professor' }, { en: 'The kids', pt: 'As crianças' }],
              exemplo: { en: 'My teacher likes the kids.', pt: 'Meu professor gosta das crianças.' }
            }
          ],
          fraseFinal: { en: 'My boss is a good person.', pt: ['Meu', 'chefe', 'é', 'uma', 'boa', 'pessoa.'], distratores: ['professor', 'colega'] }
        }
      ]
    },
    {
      id: 'u7',
      titulo: 'Rotina e tempo',
      icone: '⏰',
      licoes: [
        {
          id: 'l1',
          titulo: 'Hoje e amanhã',
          blocos: [
            {
              tipo: 'par',
              palavras: [{ en: 'Today', pt: 'Hoje' }, { en: 'Tomorrow', pt: 'Amanhã' }],
              exemplo: { en: 'Today or tomorrow?', pt: 'Hoje ou amanhã?' }
            },
            {
              tipo: 'par',
              palavras: [{ en: 'Yesterday', pt: 'Ontem' }, { en: 'Now', pt: 'Agora' }],
              exemplo: { en: 'Not yesterday — now!', pt: 'Ontem não — agora!' }
            }
          ],
          fraseFinal: { en: 'Tomorrow, not today!', pt: ['Amanhã,', 'não', 'hoje!'], distratores: ['ontem', 'agora'] }
        },
        {
          id: 'l2',
          titulo: 'Partes do dia',
          blocos: [
            {
              tipo: 'par',
              palavras: [{ en: 'In the morning', pt: 'De manhã' }, { en: 'In the afternoon', pt: 'À tarde' }],
              exemplo: { en: 'I work in the morning and in the afternoon.', pt: 'Eu trabalho de manhã e à tarde.' }
            },
            {
              tipo: 'par',
              palavras: [{ en: 'At night', pt: 'À noite' }, { en: 'Every day', pt: 'Todo dia' }],
              exemplo: { en: 'Every day at night.', pt: 'Todo dia à noite.' }
            }
          ],
          fraseFinal: { en: 'We open in the morning.', pt: ['Nós', 'abrimos', 'de', 'manhã.'], distratores: ['tarde', 'noite'] }
        },
        {
          id: 'l3',
          titulo: 'Dias da semana',
          blocos: [
            {
              tipo: 'par',
              palavras: [{ en: 'Monday', pt: 'Segunda-feira' }, { en: 'Friday', pt: 'Sexta-feira' }],
              exemplo: { en: 'From Monday to Friday.', pt: 'De segunda-feira a sexta-feira.' }
            },
            {
              tipo: 'par',
              palavras: [{ en: 'Saturday', pt: 'Sábado' }, { en: 'Sunday', pt: 'Domingo' }],
              exemplo: { en: 'Saturday and Sunday.', pt: 'Sábado e domingo.' }
            }
          ],
          fraseFinal: { en: 'We are open on Saturday.', pt: ['Estamos', 'abertos', 'no', 'sábado.'], distratores: ['domingo', 'fechados'] }
        },
        {
          id: 'l4',
          titulo: 'Que horas são',
          blocos: [
            {
              tipo: 'par',
              palavras: [{ en: 'What time is it?', pt: 'Que horas são?' }, { en: "It's eight o'clock", pt: 'São oito horas' }],
              exemplo: { en: "What time is it? It's eight o'clock.", pt: 'Que horas são? São oito horas.' }
            },
            {
              tipo: 'par',
              palavras: [{ en: 'Early', pt: 'Cedo' }, { en: "It's late", pt: 'Está tarde' }],
              exemplo: { en: "It's late — I open early tomorrow.", pt: 'Está tarde — eu abro cedo amanhã.' }
            }
          ],
          fraseFinal: { en: 'What time is it?', pt: ['Que', 'horas', 'são?'], distratores: ['cedo', 'tarde'] }
        },
        {
          id: 'l5',
          titulo: 'Eu trabalho, eu moro',
          blocos: [
            {
              tipo: 'par',
              palavras: [{ en: 'I work', pt: 'Eu trabalho' }, { en: 'I live', pt: 'Eu moro' }],
              exemplo: { en: 'I work and I live in Angatuba.', pt: 'Eu trabalho e eu moro em Angatuba.' }
            },
            {
              tipo: 'par',
              palavras: [{ en: 'I start at eight', pt: 'Eu começo às oito' }, { en: 'I finish at six', pt: 'Eu termino às seis' }],
              exemplo: { en: 'I start at eight and I finish at six.', pt: 'Eu começo às oito e eu termino às seis.' }
            }
          ],
          fraseFinal: { en: 'I live and work here.', pt: ['Eu', 'moro', 'e', 'trabalho', 'aqui.'], distratores: ['começo', 'termino'] }
        },
        {
          id: 'l6',
          titulo: 'Combinando horário',
          blocos: [
            {
              tipo: 'par',
              palavras: [{ en: 'See you at seven', pt: 'Até às sete' }, { en: "I'm free tomorrow", pt: 'Estou livre amanhã' }],
              exemplo: { en: "I'm free tomorrow. See you at seven!", pt: 'Estou livre amanhã. Até às sete!' }
            },
            {
              tipo: 'par',
              palavras: [{ en: 'Next week', pt: 'Semana que vem' }, { en: 'This weekend', pt: 'Neste fim de semana' }],
              exemplo: { en: 'Next week or this weekend?', pt: 'Semana que vem ou neste fim de semana?' }
            }
          ],
          fraseFinal: { en: "I'm free next week.", pt: ['Estou', 'livre', 'semana', 'que', 'vem.'], distratores: ['amanhã', 'sábado'] }
        }
      ]
    },
    {
      id: 'u8',
      titulo: 'Compras e serviços',
      icone: '🛍️',
      licoes: [
        {
          id: 'l1',
          titulo: 'Tamanho e cor',
          blocos: [
            {
              tipo: 'par',
              palavras: [{ en: 'The size', pt: 'O tamanho' }, { en: 'The color', pt: 'A cor' }],
              exemplo: { en: 'The size and the color are good.', pt: 'O tamanho e a cor estão bons.' }
            },
            {
              tipo: 'par',
              palavras: [{ en: 'Small', pt: 'Pequeno' }, { en: 'Large', pt: 'Grande' }],
              exemplo: { en: 'Small or large?', pt: 'Pequeno ou grande?' }
            }
          ],
          fraseFinal: { en: 'Do you have a large size?', pt: ['Vocês', 'têm', 'um', 'tamanho', 'grande?'], distratores: ['pequeno', 'cor'] }
        },
        {
          id: 'l2',
          titulo: 'Provando a roupa',
          blocos: [
            {
              tipo: 'par',
              palavras: [{ en: 'Can I try it on?', pt: 'Posso experimentar?' }, { en: 'The fitting room', pt: 'O provador' }],
              exemplo: { en: 'Can I try it on? The fitting room is over there.', pt: 'Posso experimentar? O provador fica ali.' }
            },
            {
              tipo: 'par',
              palavras: [{ en: 'It fits', pt: 'Serviu' }, { en: "It's too big", pt: 'Está muito grande' }],
              exemplo: { en: "It's too big, but it fits.", pt: 'Está muito grande, mas serviu.' }
            }
          ],
          fraseFinal: { en: "It's too big for me.", pt: ['Está', 'muito', 'grande', 'para', 'mim.'], distratores: ['pequeno', 'serviu'] }
        },
        {
          id: 'l3',
          titulo: 'Do que eu preciso',
          blocos: [
            {
              tipo: 'par',
              palavras: [{ en: 'I need', pt: 'Eu preciso' }, { en: "I'm looking for", pt: 'Estou procurando' }],
              exemplo: { en: "I need help. I'm looking for a pharmacy.", pt: 'Eu preciso de ajuda. Estou procurando uma farmácia.' }
            },
            {
              tipo: 'par',
              palavras: [{ en: 'Do you have it?', pt: 'Vocês têm?' }, { en: 'We have it', pt: 'Nós temos' }],
              exemplo: { en: 'Do you have it? Yes, we have it.', pt: 'Vocês têm? Sim, nós temos.' }
            }
          ],
          fraseFinal: { en: "I'm looking for a gift.", pt: ['Estou', 'procurando', 'um', 'presente.'], distratores: ['preciso', 'tamanho'] }
        },
        {
          id: 'l4',
          titulo: 'Trocas e problemas',
          blocos: [
            {
              tipo: 'par',
              palavras: [{ en: 'Can I exchange it?', pt: 'Posso trocar?' }, { en: 'The receipt', pt: 'O recibo' }],
              exemplo: { en: 'Can I exchange it? Here is the receipt.', pt: 'Posso trocar? Aqui está o recibo.' }
            },
            {
              tipo: 'par',
              palavras: [{ en: "It's broken", pt: 'Está quebrado' }, { en: 'The warranty', pt: 'A garantia' }],
              exemplo: { en: "It's broken — the warranty is here.", pt: 'Está quebrado — a garantia está aqui.' }
            }
          ],
          fraseFinal: { en: 'It is broken. Can I exchange it?', pt: ['Está', 'quebrado.', 'Posso', 'trocar?'], distratores: ['recibo', 'garantia'] }
        },
        {
          id: 'l5',
          titulo: 'Marcando um horário',
          blocos: [
            {
              tipo: 'par',
              palavras: [{ en: 'An appointment', pt: 'Um agendamento' }, { en: 'Can I book?', pt: 'Posso marcar?' }],
              exemplo: { en: 'Can I book an appointment?', pt: 'Posso marcar um agendamento?' }
            },
            {
              tipo: 'par',
              palavras: [{ en: 'What time can you?', pt: 'Que horas você pode?' }, { en: "It's ready", pt: 'Está pronto' }],
              exemplo: { en: "What time can you? It's ready at five.", pt: 'Que horas você pode? Está pronto às cinco.' }
            }
          ],
          fraseFinal: { en: 'Your order is ready.', pt: ['Seu', 'pedido', 'está', 'pronto.'], distratores: ['agendamento', 'horário'] }
        },
        {
          id: 'l6',
          titulo: 'Entrega e retirada',
          blocos: [
            {
              tipo: 'par',
              palavras: [{ en: 'The delivery', pt: 'A entrega' }, { en: 'The address', pt: 'O endereço' }],
              exemplo: { en: 'The delivery and the address are correct.', pt: 'A entrega e o endereço estão corretos.' }
            },
            {
              tipo: 'par',
              palavras: [{ en: 'It arrives tomorrow', pt: 'Chega amanhã' }, { en: "I'll pick it up", pt: 'Eu vou buscar' }],
              exemplo: { en: "It arrives tomorrow and I'll pick it up.", pt: 'Chega amanhã e eu vou buscar.' }
            }
          ],
          fraseFinal: { en: 'It arrives tomorrow at my address.', pt: ['Chega', 'amanhã', 'no', 'meu', 'endereço.'], distratores: ['entrega', 'buscar'] }
        }
      ]
    },

    /* ══════════ FAIXA C — se vira no idioma ══════════ */
    {
      id: 'u9',
      titulo: 'No trabalho e no dia a dia',
      icone: '💼',
      licoes: [
        {
          id: 'l1',
          titulo: 'No trabalho',
          blocos: [
            {
              tipo: 'par',
              palavras: [{ en: 'The meeting', pt: 'A reunião' }, { en: 'The team', pt: 'A equipe' }],
              exemplo: { en: 'The meeting with the team is today.', pt: 'A reunião com a equipe é hoje.' }
            },
            {
              tipo: 'par',
              palavras: [{ en: "I'm busy", pt: 'Estou ocupado' }, { en: 'Later', pt: 'Mais tarde' }],
              exemplo: { en: "I'm busy — later, please.", pt: 'Estou ocupado — mais tarde, por favor.' }
            }
          ],
          fraseFinal: { en: 'The meeting is later.', pt: ['A', 'reunião', 'é', 'mais', 'tarde.'], distratores: ['equipe', 'ocupado'] }
        },
        {
          id: 'l2',
          titulo: 'Pedindo com jeito',
          blocos: [
            {
              tipo: 'par',
              palavras: [{ en: 'Could you call me?', pt: 'Você poderia me ligar?' }, { en: 'Can you send it?', pt: 'Você pode enviar?' }],
              exemplo: { en: 'Could you call me or can you send it?', pt: 'Você poderia me ligar ou você pode enviar?' }
            },
            {
              tipo: 'par',
              palavras: [{ en: 'Of course', pt: 'Claro' }, { en: 'Not now', pt: 'Agora não' }],
              exemplo: { en: 'Of course! But not now.', pt: 'Claro! Mas agora não.' }
            }
          ],
          fraseFinal: { en: 'Could you call me later?', pt: ['Você', 'poderia', 'me', 'ligar', 'mais', 'tarde?'], distratores: ['enviar', 'claro'] }
        },
        {
          id: 'l3',
          titulo: 'No telefone e no WhatsApp',
          blocos: [
            {
              tipo: 'par',
              palavras: [{ en: "I'll call you back", pt: 'Eu ligo de volta' }, { en: 'Send me a message', pt: 'Me manda uma mensagem' }],
              exemplo: { en: "Send me a message and I'll call you back.", pt: 'Me manda uma mensagem e eu ligo de volta.' }
            },
            {
              tipo: 'par',
              palavras: [{ en: 'Can you hear me?', pt: 'Você está me ouvindo?' }, { en: 'The signal is bad', pt: 'O sinal está ruim' }],
              exemplo: { en: 'Can you hear me? The signal is bad.', pt: 'Você está me ouvindo? O sinal está ruim.' }
            }
          ],
          fraseFinal: { en: 'Send me a message tomorrow.', pt: ['Me', 'manda', 'uma', 'mensagem', 'amanhã.'], distratores: ['ligo', 'sinal'] }
        },
        {
          id: 'l4',
          titulo: 'Resolvendo um problema',
          blocos: [
            {
              tipo: 'par',
              palavras: [{ en: "There's a problem", pt: 'Tem um problema' }, { en: "It doesn't work", pt: 'Não funciona' }],
              exemplo: { en: "There's a problem: it doesn't work.", pt: 'Tem um problema: não funciona.' }
            },
            {
              tipo: 'par',
              palavras: [{ en: "I'll fix it", pt: 'Eu vou consertar' }, { en: "Don't worry", pt: 'Não se preocupe' }],
              exemplo: { en: "Don't worry, I'll fix it.", pt: 'Não se preocupe, eu vou consertar.' }
            }
          ],
          fraseFinal: { en: "Don't worry, I'll fix it today.", pt: ['Não', 'se', 'preocupe,', 'eu', 'vou', 'consertar', 'hoje.'], distratores: ['problema', 'amanhã'] }
        },
        {
          id: 'l5',
          titulo: 'Combinando e confirmando',
          blocos: [
            {
              tipo: 'par',
              palavras: [{ en: 'Let me know', pt: 'Me avise' }, { en: "I'll confirm", pt: 'Eu confirmo' }],
              exemplo: { en: "Let me know and I'll confirm.", pt: 'Me avise e eu confirmo.' }
            },
            {
              tipo: 'par',
              palavras: [{ en: "I'm on my way", pt: 'Estou a caminho' }, { en: "I'll be there at five", pt: 'Estarei lá às cinco' }],
              exemplo: { en: "I'm on my way — I'll be there at five.", pt: 'Estou a caminho — estarei lá às cinco.' }
            }
          ],
          fraseFinal: { en: "Let me know. I'm on my way.", pt: ['Me', 'avise.', 'Estou', 'a', 'caminho.'], distratores: ['confirmo', 'cinco'] }
        },
        {
          id: 'l6',
          titulo: 'Dando sua opinião',
          blocos: [
            {
              tipo: 'par',
              palavras: [{ en: 'I think so', pt: 'Eu acho que sim' }, { en: 'I agree', pt: 'Eu concordo' }],
              exemplo: { en: 'I think so. I agree!', pt: 'Eu acho que sim. Eu concordo!' }
            },
            {
              tipo: 'par',
              palavras: [{ en: 'In my opinion', pt: 'Na minha opinião' }, { en: "I'm not sure", pt: 'Não tenho certeza' }],
              exemplo: { en: "In my opinion it's good, but I'm not sure.", pt: 'Na minha opinião é bom, mas não tenho certeza.' }
            }
          ],
          fraseFinal: { en: 'In my opinion, the price is good.', pt: ['Na', 'minha', 'opinião,', 'o', 'preço', 'é', 'bom.'], distratores: ['concordo', 'certeza'] }
        }
      ]
    },
    {
      id: 'u10',
      titulo: 'Conversas reais',
      icone: '💬',
      licoes: [
        {
          id: 'l1',
          titulo: 'Ontem eu fui',
          blocos: [
            {
              tipo: 'par',
              palavras: [{ en: 'I went', pt: 'Eu fui' }, { en: 'I bought', pt: 'Eu comprei' }],
              exemplo: { en: 'Yesterday I went to the market and I bought bread.', pt: 'Ontem eu fui ao mercado e eu comprei pão.' }
            },
            {
              tipo: 'par',
              palavras: [{ en: 'It was great', pt: 'Foi ótimo' }, { en: 'I liked it', pt: 'Eu gostei' }],
              exemplo: { en: 'It was great — I liked it!', pt: 'Foi ótimo — eu gostei!' }
            }
          ],
          fraseFinal: { en: 'I went there yesterday and I liked it.', pt: ['Eu', 'fui', 'lá', 'ontem', 'e', 'gostei.'], distratores: ['comprei', 'hoje'] }
        },
        {
          id: 'l2',
          titulo: 'Contando o que aconteceu',
          blocos: [
            {
              tipo: 'par',
              palavras: [{ en: "I didn't go", pt: 'Eu não fui' }, { en: 'Did you like it?', pt: 'Você gostou?' }],
              exemplo: { en: "I didn't go. Did you like it?", pt: 'Eu não fui. Você gostou?' }
            },
            {
              tipo: 'par',
              palavras: [{ en: 'We had lunch', pt: 'Nós almoçamos' }, { en: 'She called me', pt: 'Ela me ligou' }],
              exemplo: { en: 'She called me and we had lunch.', pt: 'Ela me ligou e nós almoçamos.' }
            }
          ],
          fraseFinal: { en: 'We had lunch downtown yesterday.', pt: ['Nós', 'almoçamos', 'no', 'centro', 'ontem.'], distratores: ['ligou', 'hoje'] }
        },
        {
          id: 'l3',
          titulo: 'Amanhã eu vou',
          blocos: [
            {
              tipo: 'par',
              palavras: [{ en: "I'll go", pt: 'Eu vou' }, { en: "I'll be back", pt: 'Eu volto' }],
              exemplo: { en: "I'll go now and I'll be back later.", pt: 'Eu vou agora e eu volto mais tarde.' }
            },
            {
              tipo: 'par',
              palavras: [{ en: "I'm going to travel", pt: 'Eu vou viajar' }, { en: "We'll see", pt: 'A gente vê' }],
              exemplo: { en: "I'm going to travel — we'll see.", pt: 'Eu vou viajar — a gente vê.' }
            }
          ],
          fraseFinal: { en: "I'll be back on Monday.", pt: ['Eu', 'volto', 'na', 'segunda-feira.'], distratores: ['viajar', 'sábado'] }
        },
        {
          id: 'l4',
          titulo: 'Desculpas e educação',
          blocos: [
            {
              tipo: 'par',
              palavras: [{ en: 'Excuse me', pt: 'Com licença' }, { en: "I'm sorry", pt: 'Desculpe' }],
              exemplo: { en: "Excuse me. I'm sorry!", pt: 'Com licença. Desculpe!' }
            },
            {
              tipo: 'par',
              palavras: [{ en: "It's my fault", pt: 'É culpa minha' }, { en: 'No worries', pt: 'Tranquilo' }],
              exemplo: { en: "It's my fault. No worries!", pt: 'É culpa minha. Tranquilo!' }
            }
          ],
          fraseFinal: { en: "I'm sorry, it's my fault.", pt: ['Desculpe,', 'é', 'culpa', 'minha.'], distratores: ['licença', 'tranquilo'] }
        },
        {
          id: 'l5',
          titulo: 'Conversa e opinião',
          blocos: [
            {
              tipo: 'par',
              palavras: [{ en: 'What do you think?', pt: 'O que você acha?' }, { en: 'I love it', pt: 'Eu amei' }],
              exemplo: { en: 'What do you think? I love it!', pt: 'O que você acha? Eu amei!' }
            },
            {
              tipo: 'par',
              palavras: [{ en: 'Me too', pt: 'Eu também' }, { en: "That's true", pt: 'É verdade' }],
              exemplo: { en: "Me too! That's true.", pt: 'Eu também! É verdade.' }
            }
          ],
          fraseFinal: { en: 'What do you think? I love it!', pt: ['O', 'que', 'você', 'acha?', 'Eu', 'amei!'], distratores: ['também', 'verdade'] }
        },
        {
          id: 'l6',
          titulo: 'Contando uma história',
          blocos: [
            {
              tipo: 'par',
              palavras: [{ en: 'Last weekend', pt: 'No fim de semana passado' }, { en: 'The next day', pt: 'No dia seguinte' }],
              exemplo: { en: 'Last weekend I worked, and the next day I traveled.', pt: 'No fim de semana passado eu trabalhei, e no dia seguinte eu viajei.' }
            },
            {
              tipo: 'par',
              palavras: [{ en: 'At the end', pt: 'No final' }, { en: 'It was fun', pt: 'Foi divertido' }],
              exemplo: { en: 'At the end, it was fun!', pt: 'No final, foi divertido!' }
            }
          ],
          fraseFinal: { en: 'Last weekend was fun.', pt: ['O', 'fim', 'de', 'semana', 'passado', 'foi', 'divertido.'], distratores: ['seguinte', 'final'] }
        }
      ]
    }
  ],

  /* ── Teste de nivelamento (placement) ────────────────────────────
     2 perguntas por unidade, na ordem das unidades acima, usando só
     vocabulário que a unidade correspondente realmente ensina. Acertar
     as DUAS de uma unidade libera pular aquela unidade; o motor para na
     primeira unidade em que a pessoa errar alguma (ver
     _aprCalcularNivelPlacement em Aprender/hub.js).

     A dificuldade sobe junto com as unidades: u1–u4 são palavras soltas
     e perguntas curtas; u5–u8 já são expressões inteiras; u9–u10 são
     frases de conversa. As opções erradas vêm sempre do mesmo campo
     semântico (nunca absurdas, nunca sinônimo da certa).

     Pra ajustar o teste depois: mantenha sempre 2 perguntas por unidade
     e o campo "unidade" batendo com o id da unidade lá em cima — o motor
     ignora unidades sem pergunta (para o nivelamento nelas, por
     segurança, em vez de liberar de graça). ───────────────────────── */
  placement: [
    // u1 — Cumprimentos
    { id: 'p1', unidade: 'u1', pergunta: 'Olá', opcoes: ['Hello', 'Goodbye', 'Please', 'Good night'], correta: 0 },
    { id: 'p2', unidade: 'u1', pergunta: 'Obrigado', opcoes: ['How are you?', 'Thank you', "You're welcome", 'Take care'], correta: 1 },
    // u2 — Números e quantidade
    { id: 'p3', unidade: 'u2', pergunta: 'Cinco', opcoes: ['Nine', 'Three', 'Five', 'Four'], correta: 2 },
    { id: 'p4', unidade: 'u2', pergunta: 'Dez', opcoes: ['Ten', 'Seven', 'Eight', 'One'], correta: 0 },
    // u3 — Comida e bebida
    { id: 'p5', unidade: 'u3', pergunta: 'Água', opcoes: ['Juice', 'Coffee', 'Fruit', 'Water'], correta: 3 },
    { id: 'p6', unidade: 'u3', pergunta: 'Pão', opcoes: ['Bread', 'Chicken', 'Potato', 'Orange'], correta: 0 },
    // u4 — No comércio
    { id: 'p7', unidade: 'u4', pergunta: 'Quanto custa?', opcoes: ['Can I help you?', 'How much is it?', 'Anything else?', 'Let me check'], correta: 1 },
    { id: 'p8', unidade: 'u4', pergunta: 'Vocês entregam?', opcoes: ['Free delivery', 'Credit card', 'Do you deliver?', "It's out of stock"], correta: 2 },
    // u5 — Lugares na cidade
    { id: 'p9', unidade: 'u5', pergunta: 'A farmácia', opcoes: ['The bakery', 'The pharmacy', 'The market', 'The bank'], correta: 1 },
    { id: 'p10', unidade: 'u5', pergunta: 'Vire à esquerda', opcoes: ['Turn left', 'Cross the street', 'Straight ahead', 'On the corner'], correta: 0 },
    // u6 — Família e pessoas
    { id: 'p11', unidade: 'u6', pergunta: 'Minha irmã', opcoes: ['My brother', 'My mother', 'My sister', 'My daughter'], correta: 2 },
    { id: 'p12', unidade: 'u6', pergunta: 'Meu chefe', opcoes: ['My neighbor', 'My teacher', 'My co-worker', 'My boss'], correta: 3 },
    // u7 — Rotina e tempo
    { id: 'p13', unidade: 'u7', pergunta: 'Amanhã', opcoes: ['Today', 'Tomorrow', 'Yesterday', 'Every day'], correta: 1 },
    { id: 'p14', unidade: 'u7', pergunta: 'Que horas são?', opcoes: ['What time is it?', 'What do you think?', 'How many do you want?', 'Where is it?'], correta: 0 },
    // u8 — Compras e serviços
    { id: 'p15', unidade: 'u8', pergunta: 'Posso experimentar?', opcoes: ['Can I exchange it?', 'Can I try it on?', 'Can I help you?', 'Can you send it?'], correta: 1 },
    { id: 'p16', unidade: 'u8', pergunta: 'Estou procurando', opcoes: ["I'm looking for", 'I need', 'I would like', "I'm on my way"], correta: 0 },
    // u9 — No trabalho e no dia a dia
    { id: 'p17', unidade: 'u9', pergunta: 'Estou ocupado', opcoes: ["I'm busy", 'Not now', 'Later', "I'm not sure"], correta: 0 },
    { id: 'p18', unidade: 'u9', pergunta: 'Não se preocupe', opcoes: ["It doesn't work", 'Let me know', "Don't worry", 'Of course'], correta: 2 },
    // u10 — Conversas reais
    { id: 'p19', unidade: 'u10', pergunta: 'Eu comprei', opcoes: ['I went', 'I bought', 'I liked it', "I'll go"], correta: 1 },
    { id: 'p20', unidade: 'u10', pergunta: 'Com licença', opcoes: ["I'm sorry", 'Excuse me', "It's my fault", 'No worries'], correta: 1 }
  ]
};

// Roda em script clássico — var de topo já vira window.APRENDER_CONTEUDO,
// mas deixamos explícito por robustez pós-minify (mesmo padrão do resto do app).
window.APRENDER_CONTEUDO = APRENDER_CONTEUDO;
