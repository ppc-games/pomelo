"use strict";

const Package = require('@sex-pomelo/sex-pomelo-protocol').Package;

module.exports.handle = function(socket, reason) {
// websocket close code 1000 would emit when client close the connection
  if(typeof reason === 'string') {
    let res = {
      reason: reason
    };
    socket.sendRaw(Package.encode(Package.TYPE_KICK, Buffer.from(JSON.stringify(res))));
  }
};
