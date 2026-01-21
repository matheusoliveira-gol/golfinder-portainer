# Define a imagem base com Node.js
FROM node:20-alpine

# Define o diretório de trabalho dentro do contêiner
WORKDIR /usr/src/app

# Copia os arquivos de pacote do servidor
COPY server/package*.json ./

# Instala as dependências do servidor
RUN npm install

COPY server/start.sh /app/server/start.sh
# Copia todo o código do servidor para o diretório de trabalho. 
# O .dockerignore irá excluir a pasta node_modules local.
COPY server/ .

# Torna o script de inicialização executável
RUN chmod +x ./start.sh

# Expõe a porta que o servidor usa
EXPOSE 3001

# Comando para iniciar o servidor
CMD [ "./start.sh" ]