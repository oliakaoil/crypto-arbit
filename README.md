## Overview

Crypto Arbit is a set of tools and services for automating various tasks related to buying and selling cryptocurrenices at centralized exchanges. The main Typescript application is located in the `arbit` folder, and is designed to be run from the CLI, and as a PM2-managed process on a Debian host. The `webapp` is a very-much work-in-progress front-end designed to help monitor and manage the arbit tool.


## Arbit tool

The arbit tool is a Node.js/Typescript application designed to be run from the CLI. In production, PM2 process manager is used to keep various invocations of the application alive indefinitely. For development and testing, you can invoke the application from the console, see output and exit the process.

#### Installation

Required global dependencies for the tool include Node.js v12.0.0 or later, an available MySQL server instance, and a Memcache service instance available. Once these are configuration, start by installing modules:

````
$ cd arbit
$ npm install
````

 Next, create an environment configuration file and add connection information for these 2 services (ask me for a copy of this file) and place it in the application root (i.e. `arbit/.env`). You should now be able to start the Typescript watcher:
 
 ````
 $ npm run watch
 ````
 
Starting the watcher will output a compiled version of the application in `arbit/dist` and any file changes should trigger a re-compile. Next, migrate required database schema by running the migration action:

````
$ cd arbit/dist
$ node index.js --mode=db-migrate
````

If the above executes successfully you should now be able to run the various different modes of the tool.


#### Development and Testing

The various controller modules within the application are used to logically group together high-level operations, much in the same way that a Web API controller class groups together related endpoints, performing various business operations and forming a respone for the user. There is a single controller named `UtilController` which is a testbed for all other controllers, services, etc. in the application. An easy way to develop and then test application functionality is to use the following command:


````
$ cd arbit/dist
$ node index.js --mode=test
````

This will trigger the index method of UtilController, and you can place arbitrary code in this space for testing. Taking a look at that method, you will see *a lot* of tested functionality commented out from previous tests.


#### Adding a new WebSocket Client

- Create new class and update constructor with exchange Id, exchange Service, and wsUrl
- Add class to exchange container module and IoT loading in index.ts
- Ensure that BaseWebSocketService::initProducts is returning the proper list of exchange products
- Ensure that orderbooks have sequence numbers. If they don't, that will need to be pulled from the WebSocket
- Complete the subscription to market depth messages process, overridding methods onMessage, subscribeDiffOrders, etc.


#### Websocket Lifecycle

````
connect()

    - onBeforeConnect()

    - init websocket client, register listeners, open connection

onOpen()

 - onBeforeInitProducts()

 - initProducts()

 - iterate through product list, for each product:
    
    - intialize orderbookQueue set

    - call `subscribeDiffOrders()`, which should subscribe to order diffs for the given currency

    - call `initOrderbook()`, which should create a new, unprimed orderbook in the map, an empty array entry in the orderbookQueue map, and start flushing the diff queue (which does nothing immediately because the orderbook is not yet primed)
   
initOrderbook()

 - prime orderbook for given product via REST API call

 - call initOrderbookQueueFlush() for given product, this starts the main update loop for the orderbook
````

#### Enabling tarbit execution

 - Ensure that exchange account is able to spot trade

 - Transfer funds to the exchange and convert to required quote currency or currencies

 - Ensure exchange has limit order placement and completion available via exchange service

 - Enabling tarbit execution in exchange config


