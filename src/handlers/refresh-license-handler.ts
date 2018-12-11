import { argValidator as _argValidator } from '@vamship/arg-utils';
import {
    IContext,
    IExtendedProperties,
    IInput,
    RequestHandler
} from '@vamship/expressjs-routes';

import { Promise } from 'bluebird';
import _fetch from 'isomorphic-fetch';

import _updateManager from '../lib/update-manager';

/**
 * Handler that launches a refresh license task.
 *
 * @param input The input to the handler.
 * @param context The execution context for the handler.
 * @param ext Extended properties for the handler.
 */
const refreshLicenseHandler: RequestHandler = (
    input: IInput,
    context: IContext,
    ext: IExtendedProperties
) => {
    const { logger, config } = ext;

    const serverId = config.get('app.serverId');
    const serverApiKey = config.get('app.serverApiKey');
    const url = config
        .get('app.licenseServerEndpoint')
        .replace(/:serverId/, serverId);

    return Promise.resolve()
        .then(() => {
            logger.trace('Fetching license from server', { url });

            return _fetch(url, {
                method: 'GET',
                headers: {
                    'content-type': 'application/json',
                    authorization: serverApiKey
                }
            }).catch((ex) => {
                const message = 'Error fetching server license';
                logger.error(ex, message);
                throw new Error(message);
            });
        })
        .then((response) => {
            logger.trace('Parsing license data');

            return response.json().catch((ex) => {
                const message = 'Error parsing server license';
                logger.error(ex, message);
                throw new Error(message);
            });
        })
        .then((data) => {
            logger.trace('Launching software update job');

            return _updateManager.launchUpdate(data);
        });
};

export default refreshLicenseHandler;
