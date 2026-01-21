### ESTÁGIO 1: Construir a Aplicação React ###
FROM node:20-alpine as builder

WORKDIR /app

# Copia os arquivos de pacote e instala as dependências
COPY package*.json ./
RUN npm install

# Copia o restante do código da aplicação
COPY . .

# Executa o build de produção
RUN npm run build

### ESTÁGIO 2: Servir com Nginx ###
FROM nginx:stable-alpine

# Copia os arquivos estáticos gerados no estágio anterior
COPY --from=builder /app/dist /usr/share/nginx/html

# Copia a configuração do Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expõe a porta 80
EXPOSE 80

# Inicia o Nginx
CMD ["nginx", "-g", "daemon off;"]