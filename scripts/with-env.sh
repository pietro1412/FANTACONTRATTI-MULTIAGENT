#!/bin/bash
# Esegue un comando con un file .env specifico, bypassando il .env di default di Prisma.
# Uso: ./scripts/with-env.sh .env.test npx prisma db push ...
#
# Funziona rinominando temporaneamente .env durante l'esecuzione del comando.

set -e

ENV_FILE="$1"
shift

if [ ! -f "$ENV_FILE" ]; then
  echo "Errore: file $ENV_FILE non trovato"
  exit 1
fi

# Carica le variabili dal file env
set -a
source "$ENV_FILE"
set +a

# Rinomina .env se esiste (Prisma lo carica sempre)
if [ -f .env ]; then
  mv .env .env._backup
  trap 'mv .env._backup .env' EXIT
fi

# Esegui il comando
"$@"
