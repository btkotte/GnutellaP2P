/**
 * Created by debopam on 2015-10-25.
 */
var every = require('every-moment');
var Data = require('./data.js');
var Logger = require("./logger.js");

module.exports = function(client, counter, peers) {
    //Connect to a specific port and IP
    //client object is the corresponding socket
    client.connect(peers[counter].port, peers[counter].ip, function() {

        Logger.log('info', 'CONNECTED TO: ' + peers[counter].ip + ':' + peers[counter].port);

        //Send JOIN REQUEST when the peer is connected
        Data.sendJoinRequest(client);

        //Send PING MSGs every 5 seconds
        //Also check if there is some QUERY or QHIT MSG to be forwarded
        every(5, 'seconds', function() {
            if(client.readyState == 'open'){
                Data.checkQueryMsgs(client);
                Data.sendPingA(client);
                Data.sendPingB(client);
            }
        });

    });

    client.on('error', function(err) {
    });

    //Whenever there is more data from the peer, the following callback function is called
    client.on('data', function(data) {

        //Act on the data and send respons back if required
        Data.actOnData(client, data.toString('hex'), counter, peers);

    });

    client.on('close', function() {
        Logger.log('info', 'A socket has been closed');
    });
}