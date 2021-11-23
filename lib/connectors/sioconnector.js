"use strict";


const EventEmitter = require('events').EventEmitter;
const sio = require('socket.io')();
//const server = require('http').createServer();
// const sio = require('socket.io')(server,{
//   cors: {
//     origin: ["http://127.0.0.1:3001",],
//     methods: ["GET", "POST"],
//     credentials: false
//   }
// });
const SioSocket = require('./siosocket');

const PKG_ID_BYTES = 4;
const PKG_ROUTE_LENGTH_BYTES = 1;
const PKG_HEAD_BYTES = PKG_ID_BYTES + PKG_ROUTE_LENGTH_BYTES;

let curId = 1;
let gConn = null;

/**
 * @namespace SioConnector
 */

/**
 * Connector that manager low level connection and protocol bewteen server and client.
 * Develper can provide their own connector to switch the low level prototol, such as tcp or probuf.
 * 
 * @class
 * @constructor
 * @memberof SioConnector
 */
class Connector extends EventEmitter
{
  constructor(port, host, opts) {
    super();

    this.port = port;
    this.host = host;
    this.opts = opts;
    this.heartbeats = opts.heartbeats || true;
    this.closeTimeout = opts.closeTimeout || 60;
    this.heartbeatTimeout = opts.heartbeatTimeout || 60;
    this.heartbeatInterval = opts.heartbeatInterval || 25;
  }

  /**
   * Start connector to listen the specified port
   */
  start(cb) {
    let self = this;
    
    sio.on('connection', function(socket) {
      let siosocket = new SioSocket(curId++, socket);
      
      self.emit('connection', siosocket);
      siosocket.on('closing', function(reason) {
        siosocket.send({
          route: 'onKick',
          reason: reason
        });
      });
    });

    // issue https://github.com/NetEase/pomelo-cn/issues/174
    if(!!this.opts) {
      this.wsocket = sio.listen(this.port, this.opts);
    } else {
      this.wsocket = sio.listen(this.port, {
        transports: [
          'websocket', 'htmlfile', 'xhr-polling', 'jsonp-polling', 'flashsocket'
        ],
        pingTimeout: this.heartbeatTimeout,
        pingInterval: this.heartbeatInterval
      });
    }

    process.nextTick(cb);
  }

  /**
   * Stop connector
   */
  stop (force, cb) {
    this.wsocket.server.close();
    process.nextTick(cb);
  }

  encode(reqId, route, msg) {
    if(reqId) {
      return composeResponse(reqId, route, msg);
    } else {
      return composePush(route, msg);
    }
  }

  /**
   * Decode client message package.
   *
   * Package format:
   *   message id: 4bytes big-endian integer
   *   route length: 1byte
   *   route: route length bytes
   *   body: the rest bytes
   *
   * @param  {String} data socket.io package from client
   * @return {Object}      message object
   */
  decode (msg) {
    let index = 0;

    let id = parseIntField(msg, index, PKG_ID_BYTES);
    index += PKG_ID_BYTES;

    let routeLen = parseIntField(msg, index, PKG_ROUTE_LENGTH_BYTES);

    let route = msg.substr(PKG_HEAD_BYTES, routeLen);
    let body = msg.substr(PKG_HEAD_BYTES + routeLen);

    return {
      id: id,
      route: route,
      body: JSON.parse(body)
    };
  }
}



module.exports = function(port, host, opts) {
  if (gConn === null) {
    gConn = new Connector(port, host, opts);
  }

  return gConn;
};


let composeResponse = function(msgId, route, msgBody) {
  return {
    id: msgId,
    body: msgBody
  };
};

let composePush = function(route, msgBody) {
  return JSON.stringify({route: route, body: msgBody});
};

let parseIntField = function(str, offset, len) {
  let res = 0;
  for(let i=0; i<len; i++) {
    if(i > 0) {
      res <<= 8;
    }
    res |= str.charCodeAt(offset + i) & 0xff;
  }

  return res;
};