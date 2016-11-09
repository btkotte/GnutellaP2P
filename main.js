/**
 * Created by debopam on 2015-10-25.
 */
var net = require('net');
var every = require('every-moment');
var fs = require('fs');
var clientInit = require('./client.js');
var Constants = require('./constants');
var Data = require('./data.js');
var Logger = require("./logger.js");

//Array of peers
//peer[0] is the one with which the node is first connected
//The node connects to each subsequent peer every 5 seconds
//New nodes are added to the array as and when identified
var peers = new Array();
peers[0] = {
    ip: Constants.BOOTSTRAP_IP1,
    port: Constants.BOOTSTRAP_PORT,
    client: null
};
peers[1] = {
    ip: Constants.BOOTSTRAP_IP2,
    port: Constants.BOOTSTRAP_PORT,
    client: null
};
peers[2] = {
    ip: Constants.BOOTSTRAP_IP3,
    port: Constants.BOOTSTRAP_PORT,
    client: null
};

// Array of keys to be searched in the P2P network
// A key is searched every 20 seconds
var keys = new Array();
keys[0] = Constants.SEARCH_KEY1;
keys[1] = Constants.SEARCH_KEY2;
keys[2] = Constants.SEARCH_KEY3;
keys[3] = Constants.SEARCH_KEY4;

fs.mkdirSync('logs', 0777, function(err) {});//Create logs folder for holding log files

//A server is created which listens on port 6346 for JOIN REQUESTS
//All other messages are already bound to respective sockets
net.createServer(function(sock) {
    sock.on('data', function(data) {
        var peerNotFound = true;
        for(var j=0; j< peers.length; j++){//Check if node present in array of peer nodes
            if(peers[j].ip == sock.remoteAddress && peers[j].port == sock.remotePort){
                peerNotFound = false;
                break;
            }
        }
        if(peerNotFound){//If not present already
            //Add the node sending JOIN REQUEST to the array of peers
            peers[peers.length] = {
                ip: sock.remoteAddress,
                port: sock.remotePort,
                client: sock
            };
            //Act on the data and send JOIN RESPONSE if required
            Data.actOnData(sock, data.toString('hex'), peers.length - 1, peers);
        }
    });
    sock.on('close', function(data) {
        Logger.log('info', 'A socket has been closed');
    });
    sock.on('error', function(err) {
    });
}).listen(Constants.LISTEN_PORT, Constants.MY_IP);

//Initialize connection with the bootstrap peer
clientInit(new net.Socket(), 0, peers);
//Set a counter to loop through the array of peers
var counter = 1;
every(5, 'seconds', function() {
    //If there is more peers to be connected with
    if (counter < peers.length) {
        //Try to make the peer a neighbour
        clientInit(new net.Socket(), counter, peers);
        counter++;
    }
});

var keyCounter = 0;
//Query the network with a new key every 20 seconds
every(20, 'seconds', function() {
    if(keyCounter < keys.length){
        Logger.log('debug', '============QUERYING THE NETWORK NOW WITH KEY: '+keys[keyCounter]+'============');

        //Try to find a neighbour which is connected already
        var client = null;
        var clientCounter = 0
        while(client == null){
            client = peers[clientCounter].client;
            clientCounter++
        }
        //Send the key as a query
        var data = new Buffer(keys[keyCounter], "ascii");
        Data.sendQuery(client, data.toString('hex'));
        keyCounter++;
    }
});

//Send BYE message to every peer after 120 seconds
every(120, 'seconds', function() {
    for(var i=0; i<peers.length; i++){
        if(peers[i].client && peers[i].client.readyState == 'open'){
            Data.sendBye(peers[i].client);
            peers[i].client = null;
        }
    }
});
