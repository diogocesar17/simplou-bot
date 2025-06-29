#!/bin/bash

# Script para gerenciar o FinanceBot com Docker
# Uso: ./docker-run.sh [comando]

case "$1" in
    "start")
        echo "🚀 Iniciando FinanceBot..."
        docker-compose up -d
        echo "✅ FinanceBot iniciado! Verifique os logs com: ./docker-run.sh logs"
        ;;
    "stop")
        echo "🛑 Parando FinanceBot..."
        docker-compose down
        echo "✅ FinanceBot parado!"
        ;;
    "restart")
        echo "🔄 Reiniciando FinanceBot..."
        docker-compose restart
        echo "✅ FinanceBot reiniciado!"
        ;;
    "logs")
        echo "📋 Mostrando logs do FinanceBot..."
        docker-compose logs -f financebot
        ;;
    "build")
        echo "🔨 Construindo imagem do FinanceBot..."
        docker-compose build
        echo "✅ Imagem construída!"
        ;;
    "status")
        echo "📊 Status dos containers:"
        docker-compose ps
        ;;
    "clean")
        echo "🧹 Limpando containers e volumes..."
        docker-compose down -v
        docker system prune -f
        echo "✅ Limpeza concluída!"
        ;;
    *)
        echo "🤖 FinanceBot Docker Manager"
        echo ""
        echo "Comandos disponíveis:"
        echo "  start   - Inicia o FinanceBot"
        echo "  stop    - Para o FinanceBot"
        echo "  restart - Reinicia o FinanceBot"
        echo "  logs    - Mostra os logs em tempo real"
        echo "  build   - Reconstrói a imagem"
        echo "  status  - Mostra status dos containers"
        echo "  clean   - Limpa containers e volumes"
        echo ""
        echo "Exemplo: ./docker-run.sh start"
        ;;
esac 