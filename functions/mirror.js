'use strict';

const _ = require('lodash'),
    bunyan = require('bunyan'),
    bodyParser = require('body-parser'),
    pckg = require(__dirname + '/package.json'),
    logger = bunyan.createLogger({ name: pckg.name }),
    express = require('express'),
    app = express();

app.enable('trust proxy');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Intercepts all HTTP verbs requests
app.all('*', function (req, res, next) {
    // Returned response headers
    const responseHeaders = {};

    // Parses the wanted response code
    const mirrorCode = parseInt(req.get('X-Mirror-Code')) || 200;

    const delay = req.get('X-Mirror-Delay') || 0;

    // Finds out if the request should be returned as the response
    const mirrorRequest = (req.get('X-Mirror-Request')
        && req.get('X-Mirror-Request').toLowerCase() == 'true')
        || false;

    // Finds out if the response should be returned
    const mirrorBody = (req.get('X-Mirror-Body')
        && req.get('X-Mirror-Body').toLowerCase() == 'true')
        || false;

    // Parses X-Mirror-* headers, skips app specific headers
    const reqHeaders = _.without(
        _.filter(
            Object.keys(req.headers), (name) => _.startsWith(name, 'x-mirror-')
        ), 'x-mirror-code', 'x-mirror-request', 'x-mirror-body', 'x-mirror-delay'
    );

    // Injects X-Mirror-* headers to response headers
    reqHeaders.forEach(function (name) {
        const resHeader = _.startCase(_.trimStart(name, 'x-mirror-')).replaceAll(' ', '-');
        responseHeaders[resHeader] = req.headers[name];
    });

    // Builds the request object
    const request = {
        request: {
            ip: req.ip,
            ips: req.ips,
            method: req.method,
            url: req.originalUrl,
            headers: req.headers,
            body: req.body
        }
    };

    logger.info(request);

    // Prepares the response
    res.status(mirrorCode).set(responseHeaders);

    if (process.env.APP_VERSION) {
        req.body = "Version: " + process.env.APP_VERSION + "\n" + req.body
    }

    // Appends the full request or only the request body if wanted
    if (mirrorRequest) {
        res.json(request);
    } else if (mirrorBody) {
        res.send(req.body);
    }
    if (process.env.APP_VERSION) {
        res.send("Version: " + process.env.APP_VERSION);
    }
    

    // Flushes!
    return setTimeout(() => res.end(), delay);
});

// Basic error handler
app.use(function (err, req, res, next) {
    logger.fatal(err);
    res.status(500).json(err);
});

module.exports = {
    app: app,
    logger: logger,
};
