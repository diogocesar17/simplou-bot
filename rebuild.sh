#!/bin/bash

set -e

GREEN='\033[0;32m'
NC='\033[0m' # No Color

printf "${GREEN}🔄 Iniciando rebuild do simplou...${NC}\n\n"

printf "📦 Parando containers...\n"
docker compose down

printf "\n🔨 Fazendo rebuild sem cache...\n"
docker compose build --no-cache simplou

printf "\n🚀 Subindo containers...\n"
docker compose up -d

printf "⏳ Aguardando inicialização...\n"
sleep 3

printf "📋 Mostrando logs do simplou...\n"
docker compose logs -f simplou 