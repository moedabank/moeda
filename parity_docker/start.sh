#!/bin/bash
ACCOUNTS=`parity --chain dev account list | tr '\n' ',' | sed 's/,$//'`
parity \
  --chain dev \
  --jsonrpc-hosts all \
  --jsonrpc-interface all \
  --rpcport 8945 \
  --geth \
  --unlock ${ACCOUNTS} \
  --password <(echo "")
