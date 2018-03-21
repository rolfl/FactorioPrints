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

function decode(request, response) {
  let body = '';

  request.on('data', (data) => {
    body += data;
  });

  request.on('end', () => {
    let result = '';
    let ok = false;
    try {
      result = extract(body);
      ok = true;
    } catch (err) {
      result = {
        error: err.message
      };
    }
    response.status(ok ? 200 : 400).send(`${JSON.stringify(result, 0, 2)}\n\n`);
  });

  return null;
}

function encode(request, response) {
  let body = '';

  request.on('data', (data) => {
    body += data;
  });

  request.on('end', () => {
    let result = '';
    let ok = false;
    try {
      const json = JSON.parse(body);
      result = intract(json);
      ok = true;
    } catch (err) {
      result = err.message;
    }
    response.status(ok ? 200 : 400).send(`${result}\n`);
  });

  return null;
}

app.post('/decode', decode);
app.post('/encode', encode);

// serve the files out of ./public as our main files
app.use(express.static(path.join(__dirname, 'public')));

// start server on the specified port and binding host
app.listen(appEnv.port, '0.0.0.0', () => console.info(`server starting on ${appEnv.url}`));
