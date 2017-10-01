var readline = require('readline');
var QWebChannel = require('./qwebchannel.js').QWebChannel;
var websocket = require('faye-websocket');

var address = 'ws://127.0.0.1:12345';
var socket = new websocket.Client(address);
var loginName = 'userClient1'
console.log('Chat client connecting to ' + address + ' (Ctrl-D to quit)');

var createReadlineInterface = function() {
    var bye = function() {
        console.log('Bye...');
        process.exit(0);
    }

    var rlif = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    rlif.setPrompt('chat: ');

    // Handle Ctrl-D and Ctrl-C
    rlif.on('close', bye);
    rlif.on('SIGINT', bye);

    return rlif;
}

var createWebChannel = function(transport, rlif) {
    return new QWebChannel(transport, function(channel) {
        channel.objects.chatserver.login(loginName, function(arg) {
                                //check the return value for success
                                if (arg === true) {
                                    console.log("Logueado as "+loginName)
                                    process.stdout.cursorTo(0);
                                    process.stdout.clearLine(0);

                                    rlif.prompt();
                                    // Go to end of existing input if any
                                    rlif.write(null, {ctrl: true, name: 'e'})
                                } else {
                                    console.log("No Logueado")
                                }
                            });
        // We connect to the 'newMessage' signal of the remote QObject
        // Be aware, that the signal is named for the remote side,
        // i.e. the server wants to 'send text'.
        // This can be confusing, as we connect to the signal
        // to receive incoming messages on our side
        channel.objects.chatserver.newMessage.connect( function(time, user, message) {
            process.stdout.cursorTo(0);
            process.stdout.clearLine(0);
            var newmsg = "[" + time + "] " + user + ": " + message;
            console.log(' <<   ' + newmsg);
            rlif.prompt();
            // Go to end of existing input if any
            rlif.write(null, {ctrl: true, name: 'e'})
        });
        channel.objects.chatserver.keepAlive.connect(function(args) {
            if (loginName !== '')
                //and call the keep alive response method as an answer
                channel.objects.chatserver.keepAliveResponse(loginName);
        });

        rlif.on('line', function(line) {
            var l = line.trim();
            if (l !== '') {
                process.stdout.moveCursor(0, -1);
                process.stdout.cursorTo(0);
                process.stdout.clearLine(0);
                // The 'sendMessage' slot of the remote QObject
                // is called with our message.
                // Again the naming is for the server side,
                // i.e. the slot is used _by the server_ to receive text.
                channel.objects.chatserver.sendMessage(loginName,
                                                                                l);
                console.log('   >> ' + l);
            }
            rlif.prompt();
        });
        rlif.prompt();
    });
}

socket.on('open', function(event) {
    console.log("info: Client connected");
    var transport = {
        // We cant't do 'send: socket.send' here
        // because 'send' wouldn't be bound to 'socket'
        send: function(data) {socket.send(data)}
    };

    createWebChannel(transport, createReadlineInterface());



    // QWebChannel has set up its onmessage handler
    // on the transport in the constructor.
    // Now we connect it to the websocket event.
    socket.on('message', function(event) {
        transport.onmessage(event);
    });
});

socket.on('error', function (error) {
    console.log('Connection error: ' + error.message);
    process.exit(1);
});

socket.on('close', function () {
    console.log('Connection closed.');
    process.exit(1);
});
