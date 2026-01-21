#!/bin/sh
# Este script garante que o contêiner pare se algum comando falhar.
set -e

# Roda as migrações do banco de dados para garantir que a estrutura esteja atualizada.
echo "Running database migrations..."
npm run knex:migrate:latest

# Inicia a aplicação principal.
echo "Starting the server..."
npm start