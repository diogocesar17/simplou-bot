#!/bin/bash

echo "🔄 Iniciando rebuild do financebot..."
echo ""

# Parar os containers
echo "📦 Parando containers..."
docker-compose down

# Rebuild sem cache
echo "🔨 Fazendo rebuild sem cache..."
docker-compose build --no-cache financebot

# Subir containers em background
echo "🚀 Subindo containers..."
docker-compose up -d

# Aguardar um pouco para o container inicializar
echo "⏳ Aguardando inicialização..."
sleep 3

# Mostrar logs
echo "📋 Mostrando logs do financebot..."
echo "Pressione Ctrl+C para parar de acompanhar os logs"
echo ""
docker-compose logs -f financebot 