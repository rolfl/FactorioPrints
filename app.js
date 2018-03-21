/* eslint-env node */

'use strict';

//------------------------------------------------------------------------------
// node.js starter application for Bluemix
//------------------------------------------------------------------------------

const path = require('path');
const zlib = require('zlib');

// This application uses express as its web server
// for more info, see: http://expressjs.com
const express = require('express');

// cfenv provides access to your Cloud Foundry environment
// for more info, see: https://www.npmjs.com/package/cfenv
const cfenv = require('cfenv');

// get the app environment from Cloud Foundry
const appEnv = cfenv.getAppEnv();

// create a new express server
const app = express();

// 5 Meg upload limit.
const sizeLimit = 1024 * 1024 * 5;

function logSource(request) {
  return ` ${request.method} ${request.url} from ${request.ip} - ${request.socket.remoteAddress}:${request.socket.remotePort}`;
}

function memory() {
  return JSON.stringify(process.memoryUsage());
}

function getBody(request, response) {
  return new Promise((resolve, reject) => {
    const cl = request.get('Content-Length') || 0;
    if (cl > sizeLimit) {
      reject(new Error(`Uploaded content limited to ${sizeLimit} bytes and not ${cl}`));
      return;
    }

    let body = '';
    let sofar = 0;

    request.on('data', (data) => {
      sofar += data.length;
      if (sofar > sizeLimit) {
        reject(new Error(`Uploaded content limited to ${sizeLimit} bytes and that has been exceeded`));
        return;
      }
      body += data;
    });

    request.on('end', () => {
      resolve(body);
    });
  }).catch((err) => {
    response.status(413).json({ error: err.message });
    response.end(null, null, () => request.destroy());
    console.warn(`${err.message} ${logSource(request)}`);
  });
}

function extract(data) {
  if (!data || data.length < 3) {
    throw new Error('Input needs to be at least 3 characters long.');
  }
  const src = new Buffer(data.substring(1), 'base64');
  const def = zlib.unzipSync(src);
  return JSON.parse(`${def}`);
}

function intract(data) {
  const def = JSON.stringify(data);
  const zip = zlib.deflateSync(def);
  const src = zip.toString('base64');
  return `0${src}`;
}

function faultLog(response, status, message) {
  console.warn(`Fault Status ${status}: ${message}`);
  response.status(status).json({ error: message });
}

function decode(request, response) {
  const src = logSource(request);
  console.info(`Decode ${src}`);
  getBody(request, response)
    .then((body) => {
      if (body == null) {
        // payload problem already dealt with.
        return;
      }
      const result = extract(body);
      response.status(200)
        .set('Content-type', 'application/json')
        .send(`${JSON.stringify(result, null, 2)}\n`);
      console.info(`Complete ${src} ${memory()}`);
    })
    .catch(err => faultLog(response, 400, err.message));
}

function encode(request, response) {
  const src = logSource(request);
  console.info(`Encode ${src}`);
  getBody(request, response)
    .then((body) => {
      if (body == null) {
        // payload problem already dealt with.
        return;
      }
      const json = JSON.parse(body);
      const result = intract(json);
      response.status(200)
        .set('Content-type', 'text/plain')
        .send(`${result}\n`);
      console.info(`Complete ${src} ${memory()}`);
    })
    .catch(err => faultLog(response, 400, err.message));
}

app.post('/decode', decode);
app.post('/encode', encode);

// serve the files out of ./public as our main files
app.use(express.static(path.join(__dirname, 'public')));

// start server on the specified port and binding host
app.listen(appEnv.port, '0.0.0.0', () => console.info(`server starting on ${appEnv.url}`));
