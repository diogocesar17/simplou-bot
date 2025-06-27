FROM node:18-alpine

WORKDIR /app

# Copiar arquivos de dependências
COPY package*.json ./

# Instalar dependências
RUN npm ci --only=production

# Copiar código fonte
COPY . .

# Expor porta
EXPOSE 8080

# Comando para iniciar
CMD ["npm", "start"] 