# Usar Node.js 20 como base
FROM node:20-alpine

# pg_dump para backups automáticos do banco
RUN apk add --no-cache postgresql-client

# Definir diretório de trabalho
WORKDIR /app

# Copiar package.json e package-lock.json primeiro (para cache de dependências)
COPY package*.json ./

# Instalar TODAS as dependências (incluindo devDependencies para compilar TypeScript)
RUN npm ci

# Copiar código da aplicação
COPY . .

# Compilar TypeScript para JavaScript
RUN npm run build

# Remover devDependencies após compilação (para reduzir tamanho da imagem)
RUN npm prune --production

# Criar diretório para autenticação do WhatsApp
RUN mkdir -p auth

# Expor porta (será definida via variável de ambiente)
EXPOSE 3000

# Comando para iniciar a aplicação (usando JavaScript compilado)
CMD ["npm", "run", "build:start"] 