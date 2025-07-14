#!/bin/bash

echo "🔄 Iniciando restart do financebot..."
echo ""

# Parar e subir containers
echo "📦 Restartando containers..."
docker-compose restart

# Aguardar um pouco para o container inicializar
echo "⏳ Aguardando inicialização..."
sleep 2

# Mostrar logs
echo "📋 Mostrando logs do financebot..."
echo "Pressione Ctrl+C para parar de acompanhar os logs"
echo ""
docker-compose logs -f financebot 