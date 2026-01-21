# Backup e Restauração do Banco de Dados PostgreSQL com Docker

Este documento descreve o processo para criar um backup seguro do banco de dados PostgreSQL e como restaurá-lo.

## 1. Fazendo o Backup

Este processo cria um arquivo de backup em formato SQL chamado `golfind_pg_backup.sql` no seu diretório atual.

**Passo 1:** Com os contêineres em execução, execute o comando abaixo no terminal, na raiz do projeto.

```bash
docker-compose exec -T postgres pg_dump -U postgres -d golfind > golfind_pg_backup.sql
```

**Passo 2:** Execute o comando abaixo no terminal, na raiz do projeto (mesmo local do `docker-compose.yml`).

```bash
docker run --rm --volumes-from golfind_backend -v $(pwd):/backup alpine tar cvf /backup/golfind_db_backup.tar /usr/src/app
```

**Passo 3:** Se você parou o contêiner, inicie-o novamente.

```bash
docker-compose start backend
```

## 2. Restaurando o Backup

Este processo substitui o conteúdo do volume do banco de dados com os dados do seu arquivo de backup.

**Passo 1: (Obrigatório)** Pare o contêiner do backend para evitar corrupção de dados.

```bash
docker-compose stop backend
```

**Passo 2:** Execute o comando abaixo no terminal, no diretório onde o seu arquivo `golfind_db_backup.tar` está localizado.

```bash
docker run --rm --volumes-from golfind_backend -v $(pwd):/backup alpine tar xvf /backup/golfind_db_backup.tar -C /
```

**Passo 3:** Inicie o contêiner novamente.

```bash
docker-compose start backend
```