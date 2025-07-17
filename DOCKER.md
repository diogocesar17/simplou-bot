# 🐳 Simplou com Docker

Este guia mostra como rodar o Simplou usando Docker para garantir que fique online 24h por dia.

## Comandos principais

| Comando | Descrição |
|---------|-----------|
| `./docker-run.sh start` | Inicia o Simplou |
| `./docker-run.sh stop` | Para o Simplou |
| `./docker-run.sh restart` | Reinicia o Simplou |
| `./docker-run.sh logs` | Mostra logs em tempo real |

## Subindo o serviço

```bash
docker-compose up -d
```

## Parando o serviço

```bash
docker-compose down
```

## Logs

```bash
docker-compose logs -f simplou
```

## Build manual

```bash
docker-compose build --no-cache
```

## Shell no container

```bash
docker-compose exec simplou sh
```

## Shell no banco

```bash
docker-compose exec postgres psql -U simplou -d simplou
``` 