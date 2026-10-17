# Blue Chip Poker

Site público e painel de gerenciamento com backend Python/FastAPI e SQLite.

## Executar localmente

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --reload
```

Acesse o endereço exibido pelo `iniciar.bat`. Normalmente é `http://127.0.0.1:8000` para o site e `http://127.0.0.1:8000/admin` para o painel; se essa porta já estiver em uso, o script escolhe automaticamente uma porta entre 8001 e 8005.

Também é possível iniciar diretamente com `./iniciar.sh` no Linux/WSL ou com duplo clique em `iniciar.bat` no Windows. Mantenha o terminal aberto enquanto estiver usando o site. Não abra os arquivos HTML diretamente e não utilize a porta do Live Server, pois o login depende das rotas `/api` do FastAPI.

## Publicação

O GitHub Pages publica apenas os arquivos estáticos deste repositório. Ele consegue exibir a landing page, mas não executa o FastAPI, o login, as rotas `/api` ou o SQLite. Por isso, a interação entre admin e landing só funciona quando ambos acessam a mesma instância do backend.

Para colocar o sistema em produção, hospede o FastAPI em um serviço com Python e armazenamento persistente, configure `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `SECRET_KEY` e `COOKIE_SECURE=1`, e faça a landing apontar para o domínio da API. O GitHub Pages pode continuar servindo a interface pública, mas o admin deve ser acessado pelo domínio do backend e o CORS/URLs da aplicação precisam permitir esse domínio. Para desenvolvimento local, use o `iniciar.bat` ou `iniciar.sh`.

Antes de iniciar uma instância com painel administrativo, defina as credenciais por variáveis de ambiente:

```bash
export ADMIN_USERNAME="seu-usuario"
export ADMIN_PASSWORD="uma-senha-forte"
export SECRET_KEY="uma-chave-longa-e-aleatoria"
export COOKIE_SECURE=1
```

Os dados ficam em `data/bluechip.db` e as imagens enviadas em `uploads/`; inclua ambos no backup da aplicação.

## Supabase

Quando `DATABASE_URL` estiver definida, o backend usa PostgreSQL em vez do SQLite local. Para a publicação, configure também `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` e `SUPABASE_BUCKET=club-media`. A chave `service_role` deve ficar somente nas variáveis privadas do backend; nunca a publique no frontend ou no GitHub. O esquema inicial está em `supabase/schema.sql`.

Para executar os testes após instalar as dependências:

```bash
python -m unittest discover -s tests -v
```
# Acompanhamento do torneio

Em `/admin`, abra **Torneio ao vivo** e configure a estrutura uma vez: duração de cada nível, blinds iniciais, aumento por multiplicador ou acréscimo fixo, ante proporcional e regra de intervalo. Ao iniciar, o sistema avança níveis, recalcula blinds e ante, alterna para o intervalo e mantém o relógio sincronizado com o servidor.

- A prévia mostra os primeiros seis níveis antes do início. Iniciar novamente substitui a estrutura atual e reinicia no nível 1.
- Durante o torneio, use **Pausar relógio**, **Retomar relógio** e **Encerrar torneio** conforme necessário. A pausa preserva exatamente o tempo e o nível atuais.
- Em **Atualizações da mesa**, informe jogadores, entradas, stack médio e avisos sem interferir na estrutura automática.
- O site público consulta os dados a cada 5 segundos e também faz sua própria contagem regressiva entre uma consulta e outra.
- Em caso de conflito entre operadores, recarregue os dados antes de salvar novamente.

Os dados são persistidos no SQLite. Não há integração com software externo de torneios. Nenhum torneio é criado automaticamente; valores demonstrativos usados na validação ficam somente na cópia temporária de testes.
