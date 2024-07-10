/**
 * https://github.com/parro-it/open-ssh-tunnel
 *
 * The MIT License (MIT)
 * Copyright (c) 2015 parro-it
 *
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
 * DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
 * OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE
 * OR OTHER DEALINGS IN THE SOFTWARE.
 * The implementation has been refactored
 */

const net = require('net');
const ssh2 = require('ssh2');
// const debug = require('debug')('open-ssh-tunnel');
const co = require('co');

function openTunnel(options) {
  const tunnel = new ssh2.Client();
  tunnel.on('end', () => {
    // debug('ssh tunnel is closed.');
  });

  return new Promise((resolve, reject) => {
    tunnel.on('end', () => {
      // debug('ssh tunnel is disconnected.');
    });

    tunnel.on('close', hadError => {
      if (hadError) {
        // debug('ssh tunnel is closed due to errors.');
      } else {
        // debug('ssh tunnel is closed.');
      }
      tunnel.end();
    });

    tunnel.on('error', err => {
      reject(err);
    });

    tunnel.on('ready', () => {
      // debug('ssh tunnel is ready.');
      resolve(tunnel);
    });
    tunnel.connect(options);
  });
}

function forwardConnection(tunnel, options) {
  return new Promise((resolve, reject) => {
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      tunnel.end();
      reject(new Error('Timed out while waiting for forwardOut'));
    }, options.forwardTimeout);

    tunnel.forwardOut(
      options.srcAddr,
      options.srcPort,
      options.dstAddr,
      options.dstPort,
      (err, stream) => {
        if (timedOut) {
          // debug('port forward timed out.');
          return null;
        }

        clearTimeout(timeout);

        if (err) {
          tunnel.end();
          return reject(err);
        }

        // debug('port forward stream is ready.');
        stream.on('close', () => {
          // debug('port forward stream is closed.');
        });

        resolve(stream);
      }
    );
  });
}

function* createClientServer(options) {
  const tunnel = yield openTunnel(options);
  yield forwardConnection(tunnel, options);

  return new Promise((resolve, reject) => {
    const server = net.createServer(co.wrap(function*(connection) {
      const stream = yield forwardConnection(tunnel, options);
      connection.pipe(stream).pipe(connection);
      // debug('tunnel pipeline created.');
    }));
    server.on('error', err => {
      reject(err);
      tunnel.end();
    });
    server.on('close', () => tunnel.end());
    server.listen(options.localPort, options.localAddr, () => {
      // debug('local tcp server listening.');
      resolve(server);
    });
  });
}

module.exports = co.wrap(createClientServer);
module.exports.openTunnel = openTunnel;
