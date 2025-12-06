#!/bin/bash

set -e

GREEN='\033[0;32m'
NC='\033[0m' # No Color

printf "${GREEN}🔄 Iniciando rebuild do simplou...${NC}\n\n"

printf "📦 Parando containers...\n"
docker compose down

NO_CACHE=false
for arg in "$@"; do
  if [ "$arg" = "--no-cache" ]; then
    NO_CACHE=true
  fi
done

if [ "$NO_CACHE" = true ]; then
  printf "\n🔨 Fazendo rebuild sem cache...\n"
  docker compose build --no-cache simplou
else
  printf "\n🔨 Fazendo rebuild com cache...\n"
  docker compose build simplou
fi

printf "\n🚀 Subindo containers...\n"
docker compose up -d

printf "⏳ Aguardando inicialização...\n"
sleep 3

printf "📋 Mostrando logs do simplou...\n"
docker compose logs -f simplou 
