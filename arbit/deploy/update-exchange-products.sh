#!/bin/bash
NODE_BIN=/cryptomac/.nvm/versions/node/v12.0.0/bin/node
PM2_BIN=/cryptomac/.nvm/versions/node/v12.0.0/bin/pm2

$PM2_BIN save
$PM2_BIN stop all
cd /cryptomac/orderbook-localize/current && $NODE_BIN index.js --mode=update-exchange-products
$PM2_BIN restart all
