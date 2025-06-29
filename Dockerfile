# Usar Node.js 20 como base
FROM node:20-alpine

# Definir diretório de trabalho
WORKDIR /app

# Copiar package.json e package-lock.json primeiro (para cache de dependências)
COPY package*.json ./

# Instalar dependências
RUN npm ci --only=production

# Copiar código da aplicação
COPY . .

# Criar diretório para autenticação do WhatsApp
RUN mkdir -p auth

# Expor porta (será definida via variável de ambiente)
EXPOSE 3000

# Comando para iniciar a aplicação
CMD ["npm","-u", "start"] 