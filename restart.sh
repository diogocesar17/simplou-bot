#!/bin/bash

echo "🔄 Iniciando restart do simplou..."

# Parar containers
echo "📦 Parando containers..."
docker compose down

# Subir containers
echo "🚀 Subindo containers..."
docker compose up -d

# Aguardar inicialização
echo "⏳ Aguardando inicialização..."
sleep 5

# Mostrar logs
echo "📋 Mostrando logs do simplou..."
docker compose logs -f simplou 