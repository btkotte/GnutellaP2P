/**
 * Created by debopam on 2015-10-25.
 */
var crypto = require('crypto');
var every = require('every-moment');
var Constants = require('./constants');
var Logger = require("./logger.js");

//This array is used for storing QUERY MSGs forwarded by this node
var queryMsgs = new Array();

/**
 * This function checks if a QUERY MSG is a repeat of an earlier one
 * @param messageId
 * @returns {boolean}
 */
function isRepeatMessage(messageId){
    for(var i=0; i<queryMsgs.length; i++){
        if(queryMsgs[i].messageId == messageId){
            return true;
        }
    }
    return false;
}

/**
 * This function converts an integer formatted IP address to dot-decimal notation
 * @param int
 * @returns {string}
 */
function intToIP(int) {
    var part1 = int & 255;
    var part2 = ((int >> 8) & 255);
    var part3 = ((int >> 16) & 255);
    var part4 = ((int >> 24) & 255);
    return part4 + "." + part3 + "." + part2 + "." + part1;
}

/**
 * This function converts IP in dot-decimal notation to integer
 * @param ip
 * @returns {number}
 */
function IPToInt(ip)
{
    var d = ip.split('.');
    return ((((((+d[0])*256)+(+d[1]))*256)+(+d[2]))*256)+(+d[3]);
}

/**
 * This function converts a HEX string to corresponding string
 * @param val
 * @returns {string}
 */
function hexToString(val) {
    var str = '';
    for (var i = 0; i < val.length; i += 2)
        str += String.fromCharCode(parseInt(val.substr(i, 2), 16));
    return str;
}

module.exports = {

    /**
     * This function handles received packets
     * @param client
     * @param data
     * @param counter
     * @param peers
     */
    actOnData : function(client, data, counter, peers){
        var buffer = new Buffer(data, 'utf8');

        //If JOIN RESPONSE MSG, then Payload length is non-zero
        if(buffer.slice(4,6) == Constants.MSG_JOIN && parseInt(buffer.slice(12,16)) != 0){
            Logger.log('info', '\t\t\t\tFROM '+client.remoteAddress+': JOIN RESPONSE RECEIVED.');
            peers[counter].client = client;//Add socket to peer list
        }else if(buffer.slice(4,6) == Constants.MSG_JOIN && parseInt(buffer.slice(12,16)) == 0){//Payload length = 0 for JOIN REQ
            Logger.log('info', '\t\t\t\tFROM '+client.remoteAddress+': JOIN REQUEST RECEIVED.');
            var messageId = buffer.slice(24, 32);
            //Send JOIN RESP MSG with the same message ID
            this.sendJoinResponse(client, messageId);
            //Send PING MSGs every 5 seconds
            //Also check if there is some QUERY or QHIT MSG to be forwarded
            every(5, 'seconds', function() {
                if(client.readyState == 'open'){
                    var Data = require('./data.js');
                    Data.checkQueryMsgs(client);
                    Data.sendPingA(client);
                    Data.sendPingB(client);
                }
            });
        }else if(buffer.slice(4,6) == Constants.MSG_PING) {//If PING MSG received
            var messageId = buffer.slice(24, 32);
            if (buffer.slice(2, 4) == Constants.MIN_TTL) {//TTL set to 1 if PING A
                Logger.log('info', '\t\t\t\tFROM '+client.remoteAddress+': PING A RECEIVED.');
                //Send back PONG A MSG with same message ID
                this.sendPongA(client, messageId);
            } else {//TTL > 1 for PING B
                Logger.log('info', '\t\t\t\tFROM '+client.remoteAddress+': PING B RECEIVED.');
                //Send back PONG B MSG with same message ID
                this.sendPongB(client, peers, messageId);
            }
        }else if(buffer.slice(4,6) == Constants.MSG_PONG) { //If PONG MSG received
            if (buffer.slice(12, 16) == Constants.NO_PAYLOAD_LEN) {//No payload in case of PONG A
                Logger.log('info', '\t\t\t\tFROM '+client.remoteAddress+': PONG A RECEIVED.');
            }else{//Payload present in case of PONG B
                Logger.log('info', '\t\t\t\tFROM '+client.remoteAddress+': PONG B RECEIVED.');
                var payloadLength = parseInt(buffer.slice(12, 16), 16);
                if(payloadLength > 0){
                    var payload = buffer.slice(32, 32+(payloadLength*2));
                    var counter = parseInt(payload.slice(0, 4));//Get the number of records
                    var offset = 8;//Move offset over first SBZ field
                    for(var i=0; i<counter; i++){
                        var ip = intToIP(parseInt(payload.slice(offset, offset+8), 16));//Get IP address of neighbour
                        var port = parseInt(payload.slice(offset+8, offset+12), 16);//Get port of neighbour
                        var peerNotFound = true;
                        for(var j=0; j< peers.length; j++){//Check if node present in array of peer nodes
                            if(peers[j].ip == ip && peers[j].port == port){
                                peerNotFound = false;
                                break;
                            }
                        }
                        if(peerNotFound){//If peer not found in the array of peers
                            peers[peers.length] = {//Create peer with the IP and port
                                ip: ip,
                                port: port,
                                client: null
                            };
                        }
                        offset += 16;
                    }
                }
            }
        }else if(buffer.slice(4,6) == Constants.MSG_QHIT) { //If QHIT MSG received
            Logger.log('info', '\t\t\t\tFROM '+client.remoteAddress+': QUERY HIT RECEIVED.');
            var payloadLength = parseInt(buffer.slice(12, 16), 16);
            if(payloadLength > 0){
                var payload = buffer.slice(32, 32+(payloadLength*2));//Get the payload to find value of key
                var counter = parseInt(payload.slice(0, 4));
                var offset = 8;//Move offset over first SBZ field
                for(var i=0; i<counter; i++){//For each record
                    var resourceID = payload.slice(offset, offset+4);
                    var id = new Buffer(resourceID, 'hex').toString('utf8');//Get ID of the resource
                    var resourceValue = payload.slice(offset+8, offset+16);
                    var value = new Buffer(resourceValue, 'hex').toString('utf8');//Get value of the key queried
                    Logger.log('debug', '================KEY ID: '+id+',Value: '+value);
                    offset += 16;
                }
                var messageId = buffer.slice(24, 32);
                //Check if QUERY HIT MSG has to be forwarded
                for(var i=0; i<queryMsgs.length; i++){
                    if(queryMsgs[i].handledBy != 'NA'
                        && queryMsgs[i].messageId.toString() == messageId.toString()
                        && queryMsgs[i].queryHitReceived == false){
                        //Set flag and data
                        queryMsgs[i].queryHitReceived = true;
                        queryMsgs[i].buffer = buffer.toString('hex');
                    }
                }

            }
        }else if(buffer.slice(4,6) == Constants.MSG_QUERY) { //If QUERY MSG received
            Logger.log('info', '\t\t\t\tFROM '+client.remoteAddress+': QUERY MSG RECEIVED.');
            var payloadLength = parseInt(buffer.slice(12, 16), 16);
            if(payloadLength > 0){
                var payload = buffer.slice(32, 32+(payloadLength*2));
                var key = hexToString(payload.toString('utf8'));//Get the key from payload
                Logger.log('debug', '==================KEY: '+key);
                var messageId = buffer.slice(24, 32);
                if(key == Constants.PUB_KEY){//If key found locally
                    Logger.log('debug', '==================KEY IS LOCALLY FOUND: '+key);
                    //Send QUERY HIT MSG with same message ID AND TTL = 5
                    this.sendQueryHit(client, messageId);
                }else{
                    //If key not found locally, QUERY MSG has to be forwarded
                    //only if it is not a repeat message and the TTL has not expired
                    if(!isRepeatMessage(messageId) && buffer.slice(2,4) != Constants.MIN_TTL){
                        //Add to queryMsgs in order to be forwarded to other nodes
                        queryMsgs[queryMsgs.length] = {
                            buffer: buffer.toString('hex'),
                            messageId : messageId,
                            client : client,
                            handledBy : '',
                            queryHitReceived : false,
                            queryHitSent : false
                        };
                    }else{
                        Logger.log('info', 'REPEAT QUERY MSG FOUND OR TTL EXPIRED. DROPPING PACKET!');
                    }
                }
            }
        }else if(buffer.slice(4,6) == Constants.MSG_BYE) { //If BYE MSG received
            //Close connection immediately
            Logger.log('info', '\t\t\t\tFROM '+client.remoteAddress+': BYE MSG RECEIVED.');
            client.destroy();
        }
    },

    /**
     * This function sends JOIN REQUEST MSG
     * @param client
     */
    sendJoinRequest : function(client){
        var header = "";
        header += Constants.P_VERSION;
        header += Constants.MIN_TTL;
        header += Constants.MSG_JOIN;
        header += Constants.RESERVED;
        header += Constants.LISTEN_PORT.toString(16);
        header += Constants.NO_PAYLOAD_LEN;
        header += Constants.MY_IP_HEX;
        header += crypto.randomBytes(4).toString('hex');//Generate random message ID

        Logger.log('info', "TO "+client.remoteAddress+": JOIN REQ");
        var data = new Buffer(header, "hex");
        if(client && client.readyState == 'open') {
            client.write(data);//Send data
        }
    },

    /**
     * This function sends JOIN RESPONSE MSG
     * with the same message ID
     * @param client
     * @param messageId
     */
    sendJoinResponse : function(client, messageId){
        var header = "";
        header += Constants.P_VERSION;
        header += Constants.MIN_TTL;
        header += Constants.MSG_JOIN;
        header += Constants.RESERVED;
        header += Constants.LISTEN_PORT.toString(16);
        header += '0002';//Fixed payload length
        header += Constants.MY_IP_HEX;
        header += messageId;
        header += Constants.JOIN_ACC;

        Logger.log('info', "TO "+client.remoteAddress+": JOIN RESP");
        var data = new Buffer(header, "hex");
        if(client && client.readyState == 'open') {
            client.write(data);//Send data
        }
    },

    /**
     * This function sends PING A MSG
     * @param client
     */
    sendPingA : function(client){
        var header = "";
        header += Constants.P_VERSION;
        header += Constants.MIN_TTL;//TTL=1 for PING A
        header += Constants.MSG_PING;
        header += Constants.RESERVED;
        header += Constants.LISTEN_PORT.toString(16);
        header += Constants.NO_PAYLOAD_LEN;
        header += Constants.MY_IP_HEX;
        header += crypto.randomBytes(4).toString('hex');//Generate random message ID

        Logger.log('info', "TO "+client.remoteAddress+": PING A");
        var data = new Buffer(header, "hex");
        if(client && client.readyState == 'open') {
            client.write(data);//Send data
        }
    },

    /**
     * This function sends PONG A MSG
     * with the same message ID
     * @param client
     * @param messageId
     */
    sendPongA : function(client, messageId){
        var header = "";
        header += Constants.P_VERSION;
        header += Constants.MIN_TTL;
        header += Constants.MSG_PONG;
        header += Constants.RESERVED;
        header += Constants.LISTEN_PORT.toString(16);
        header += Constants.NO_PAYLOAD_LEN;
        header += Constants.MY_IP_HEX;
        header += messageId;//Same message ID
        Logger.log('info', "TO "+client.remoteAddress+": PONG A");
        var data = new Buffer(header, "hex");
        if(client && client.readyState == 'open') {
            client.write(data);//Send data
        }
    },

    /**
     * This function sends PING B MSG
     * @param client
     */
    sendPingB : function(client){
        var header = "";
        header += Constants.P_VERSION;
        header += Constants.MAX_TTL;//TTL > 1 for PING B
        header += Constants.MSG_PING;
        header += Constants.RESERVED;
        header += Constants.LISTEN_PORT.toString(16);
        header += Constants.NO_PAYLOAD_LEN;
        header += Constants.MY_IP_HEX;
        header += crypto.randomBytes(4).toString('hex');//Generate random message ID
        Logger.log('info', "TO "+client.remoteAddress+": PING B");
        var data = new Buffer(header, "hex");
        if(client && client.readyState == 'open') {
            client.write(data);//Send data
        }
    },

    /**
     * This function sends PONG B MSG
     * with the same message ID
     * @param client
     * @param peers
     * @param messageId
     */
    sendPongB : function(client,peers, messageId){
        var payload = '';
        var counter = 0;
        //Create the payload with info of Max. 5 peers
        for(var i=0; i<peers.length; i++){
            if(counter < 5)
            //Do not send info about the same peer which sent the PONG B MSG
            if(client.remoteAddress != peers[i].ip && peers[i].client != null){
                counter++;
                payload += (IPToInt(peers[i].ip)).toString(16);//IP address of the peer
                payload += (peers[i].port).toString(16);//Port of the peer
                payload += '0000';//SBZ field
            }
        }
        //Counter should be 5 at max followed by SBZ field and the records
        payload = '000'+counter+'0000'+payload;
        var payloadLength = (payload.length/2).toString(16);//Calculate the payload length
        var header = "";
        header += Constants.P_VERSION;
        header += Constants.MAX_TTL;
        header += Constants.MSG_PONG;
        header += Constants.RESERVED;
        header += Constants.LISTEN_PORT.toString(16);
        if(payloadLength.length == 2){//If payload length is 2 HEX characters long
            header += '00'+payloadLength;
        }else{
            header += '000'+payloadLength;
        }
        header += Constants.MY_IP_HEX;
        header += messageId;//Same message ID
        header += payload;//Append payload
        Logger.log('info', "TO "+client.remoteAddress+": PONG B");
        var data = new Buffer(header, "hex");
        if(client && client.readyState == 'open') {
            client.write(data);//Send data
        }
    },

    /**
     * This function sends QUERY MSG
     * @param client
     * @param query
     */
    sendQuery : function(client, query){
        var header = "";
        header += Constants.P_VERSION;
        header += Constants.MAX_TTL;
        header += Constants.MSG_QUERY;
        header += Constants.RESERVED;
        header += Constants.LISTEN_PORT.toString(16);
        var payloadLength = (query.length/2).toString(16);//Calculate the payload length
        if(payloadLength.length == 2){//If payload length is 2 HEX characters long
            header += '00'+payloadLength;
        }else{
            header += '000'+payloadLength;
        }
        header += Constants.MY_IP_HEX;
        var messageId = crypto.randomBytes(4).toString('hex');//Generate random message ID
        header += messageId;
        header += query;
        Logger.log('info', "TO "+client.remoteAddress+": QUERY "+query);
        var data = new Buffer(header, "hex");
        if(client && client.readyState == 'open') {
            client.write(data);//Send data
            queryMsgs[queryMsgs.length] = {//Write to queryMsgs so that loop can be prevented
                buffer: data.toString('hex'),
                messageId: messageId,
                client: client,
                handledBy: 'NA',
                queryHitReceived: false,
                queryHitSent: false
            };
        }
    },

    /**
     * This function sends QUERY HIT MSG
     * with the same message ID
     * @param client
     * @param messageId
     */
    sendQueryHit : function(client, messageId){
        var payload = '00010000';//Entry Size = 1 for this node (since 1 key published)
        payload += '00010000';//Resource ID = 1 for this node (since 1 key-value pair)
        payload += (Constants.PUB_VAL).toString(16);//Value for the key matched

        var header = "";
        header += Constants.P_VERSION;
        header += Constants.MAX_TTL;
        header += Constants.MSG_QHIT;
        header += Constants.RESERVED;
        header += Constants.LISTEN_PORT.toString(16);
        var payloadLength = (payload.length/2).toString(16);//Calculate the payload length
        if(payloadLength.length == 2){//If payload length is 2 HEX characters long
            header += '00'+payloadLength;
        }else{
            header += '000'+payloadLength;
        }
        header += Constants.MY_IP_HEX;
        header += messageId;
        header += payload;//Append payload
        Logger.log('info', "TO "+client.remoteAddress+": QUERY HIT "+payload);
        var data = new Buffer(header, "hex");
        if(client && client.readyState == 'open') {
            client.write(data);//Send data
        }
    },

    /**
     * This function forwards QUERY and QUERY HIT MSGs
     * @param client
     */
    checkQueryMsgs : function(client){
        for(var i=0; i<queryMsgs.length; i++){
            if(queryMsgs[i].handledBy != 'NA'){ //If QUERY MSG not generated by this node
                if(queryMsgs[i].queryHitReceived == false){ //If QUERY HIT not received already

                    //If the recipient peer is not the node which sent the QUERY MSG
                    if(queryMsgs[i].client && (queryMsgs[i].client.remoteAddress != client.remoteAddress
                        || queryMsgs[i].client.remotePort != client.remotePort)){

                        //Check if the QUERY MSG has been forwarded to this node already
                        var handledBy = queryMsgs[i].handledBy.split('#');
                        var isHandled = false;
                        for(var j=0; j<handledBy.length; j++){
                            if(handledBy[j] == client.remoteAddress+':'+client.remotePort){
                                isHandled = true;
                                break;
                            }
                        }
                        if(!isHandled){//If QUERY MSG not already forwarded to this peer
                            //Forward QUERY MSG
                            var buffer = new Buffer(queryMsgs[i].buffer, 'hex');

                            //Decrease TTL by 1
                            var currentTtl = parseInt(buffer.slice(2,4));
                            buffer.write('0'+(currentTtl-1),2,'utf8');
                            var buffData = buffer.toString();
                            var data = new Buffer(buffData, "hex");
                            client.write(data);//Send data

                            //Update handledBy to mark that QUERY MSG has been forwarded to this node
                            queryMsgs[i].handledBy += client.remoteAddress+':'+client.remotePort+'#';
                            Logger.log('info', "TO "+client.remoteAddress+": QUERY FORWARDED ");
                        }
                    }
                }else{//If QUERY HIT received for the QUERY MSG
                    if(queryMsgs[i].queryHitSent == false){//If QUERY HIT MSG not already sent back

                        //If recipient peer is the node that actually sent the QUERY MSG
                        if(queryMsgs[i].client && queryMsgs[i].client.remoteAddress == client.remoteAddress
                            && queryMsgs[i].client.remotePort == client.remotePort){
                            var buffer = new Buffer(queryMsgs[i].buffer, 'hex');

                            //Decrease TTL by 1
                            var currentTtl = parseInt(buffer.slice(2,4));
                            buffer.write('0'+(currentTtl-1),2,'utf8');
                            var buffData = buffer.toString();
                            var data = new Buffer(buffData, "hex");
                            client.write(data);//Send data
                            Logger.log('info', "TO "+client.remoteAddress+": QUERY HIT FORWARDED ");
                            queryMsgs[i].queryHitSent = true;//Mark that QUERY HIT has been forwarded
                        }
                    }
                }

            }

        }
    },

    /**
     * This function sends BYE MSG
     * @param client
     */
    sendBye : function(client){
        var header = "";
        header += Constants.P_VERSION;
        header += Constants.MIN_TTL;
        header += Constants.MSG_BYE;
        header += Constants.RESERVED;
        header += Constants.LISTEN_PORT.toString(16);
        header += Constants.NO_PAYLOAD_LEN;
        header += Constants.MY_IP_HEX;
        header += crypto.randomBytes(4).toString('hex');//Generate random message ID

        Logger.log('info', "TO "+client.remoteAddress+": BYE");
        var data = new Buffer(header, "hex");
        if(client && client.readyState == 'open') {
            client.write(data);//Send data
        }
    }
}