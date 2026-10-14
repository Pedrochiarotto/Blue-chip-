# Blue Chip Poker Club

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

O público principal são jogadores recreativos e competitivos interessados em visitar o Blue Chip Poker Club. Eles consultam a programação, procuram informações da casa e entram em contato com a equipe.

A equipe do clube é o público do painel de gerenciamento de conteúdo.

## Product Purpose

Oferecer uma landing page que permita ao visitante consultar agendas, conhecer a casa e encontrar os meios de contato. O objetivo é facilitar o planejamento da visita e o contato pelo WhatsApp.

O painel permite à equipe manter as informações da página pública atualizadas.

## Operating Context

A página pública reúne informações sobre torneios, cash games, eventos, restaurante, localização e contato. A consulta é aberta; o gerenciamento exige autenticação.

Na implementação atual, a equipe acessa `/admin` para editar textos e contatos e gerenciar os cards de programação e restaurante. As alterações salvas ficam disponíveis na página pública.

## Capabilities and Constraints

Capacidades observadas no repositório:

- Frontend em HTML, CSS e JavaScript, servido pelo backend Python/FastAPI.
- Persistência de conteúdo em SQLite e armazenamento local de imagens enviadas.
- Edição de textos e informações de contato pelo painel.
- Criação, edição, ordenação e controle de visibilidade de cards, com imagens.
- Navegação pública entre programação, restaurante e localização, com acesso aos meios de contato.
- Acompanhamento público do torneio com relógio sincronizado e consulta automática a cada 5 segundos. A equipe publica os dados na aba “Torneio ao vivo”, incluindo pausa, intervalo e encerramento; níveis e blinds mudam mediante atualização manual. Não há integração com sistema externo de torneios.

O site deve funcionar pelo servidor FastAPI: abrir o HTML diretamente ou usar somente um servidor estático não atende aos fluxos dependentes da API. O comando de desenvolvimento documentado é `uvicorn app:app --reload`.

Decisões e informações ainda não confirmadas:

- Diferencial comercial específico do clube.
- Validade dos endereços, contatos, horários, valores e demais dados comerciais presentes no código.
- Requisitos específicos de acessibilidade e compromissos obrigatórios de marca.

## Evidence on Hand

- Objetivo e públicos confirmados pelo responsável pelo projeto nesta conversa.
- `README.md`: instruções de execução e descrição do site e do painel.
- `index.html`: conteúdo e estrutura da landing page existente.
- `admin.html`, `app.py` e `js/admin.js`: implementação do gerenciamento de conteúdo.
- `image/LogoBlue.jpeg`, `image/logoBlue2.png` e `image/Fundo.png`: arquivos visuais existentes; sua presença não estabelece uma restrição definitiva de identidade.

O código contém conteúdo inicial e valores de exemplo, incluindo horários e valores zerados. Esses itens não comprovam a programação real nem devem ser tratados como informações comerciais confirmadas. Não inventar eventos, preços, depoimentos, premiações ou diferenciais para preencher lacunas.

## Product Principles

- Facilitar a consulta da programação e das informações necessárias para visitar a casa.
- Tornar os meios de contato fáceis de encontrar e utilizar.
- Permitir que a equipe mantenha o conteúdo público atualizado pelo painel.
- Distinguir informações confirmadas de conteúdo de exemplo ou ainda pendente.
