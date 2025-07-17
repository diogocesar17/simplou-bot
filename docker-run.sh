#!/bin/bash

# Script para gerenciar o Simplou com Docker

case "$1" in
    start)
        echo "🚀 Iniciando Simplou..."
        docker-compose up -d
        echo "✅ Simplou iniciado! Verifique os logs com: ./docker-run.sh logs"
        ;;
    stop)
        echo "🛑 Parando Simplou..."
        docker-compose down
        echo "✅ Simplou parado!"
        ;;
    restart)
        echo "🔄 Reiniciando Simplou..."
        docker-compose restart
        echo "✅ Simplou reiniciado!"
        ;;
    logs)
        echo "📋 Mostrando logs do Simplou..."
        docker-compose logs -f simplou
        ;;
    build)
        echo "🔨 Construindo imagem do Simplou..."
        docker-compose build --no-cache
        echo "✅ Imagem construída!"
        ;;
    status)
        echo "📊 Status dos containers:"
        docker-compose ps
        ;;
    shell)
        echo "🐚 Abrindo shell do Simplou..."
        docker-compose exec simplou sh
        ;;
    db)
        echo "🗄️ Abrindo shell do PostgreSQL..."
        docker-compose exec postgres psql -U simplou -d simplou
        ;;
    *)
        echo "🤖 Simplou Docker Manager"
        echo ""
        echo "Uso: $0 {start|stop|restart|logs|build|status|shell|db}"
        echo ""
        echo "Comandos:"
        echo "  start   - Inicia o Simplou"
        echo "  stop    - Para o Simplou"
        echo "  restart - Reinicia o Simplou"
        echo "  logs    - Mostra logs em tempo real"
        echo "  build   - Reconstrói a imagem"
        echo "  status  - Mostra status dos containers"
        echo "  shell   - Abre shell no container"
        echo "  db      - Abre shell no PostgreSQL"
        ;;
esac 