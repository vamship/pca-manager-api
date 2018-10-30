/**
 * @module app
 */
import configProvider from '@vamship/config';
import loggerProvider from '@vamship/logger';
import express from 'express';

const config = configProvider
    .configure('pcaServerManagerApi')
    .setApplicationScope(process.env.NODE_ENV)
    .getConfig();

const logger = loggerProvider
    .configure('pcaManagerApi', {
        extreme: config.get('app.extremeLogging'),
        level: config.get('app.logLevel')
    })
    .getLogger('main');

logger.trace('Logger initialized');
logger.trace('Application configuration', {
    app: config.get('app')
});

// ---------- Application Initialization ----------
import routes from './routes';

logger.trace('Initializing application');
const app = express();

logger.trace('Registering routes and handlers');
routes.setup(app);

// ---------- Start web server ----------
logger.trace('Extracting port from environment');
let port = process.env.PORT;

if (!port) {
    port = config.get('app.defaultPort');
    logger.info('Using default port from config', {
        port
    });
} else {
    logger.info('Using port from environment', {
        port
    });
}

logger.trace('Launching web server');
app.listen(port, () => {
    logger.info('Server listening on port', {
        port
    });
});
