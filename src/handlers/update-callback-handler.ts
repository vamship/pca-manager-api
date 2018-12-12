import { argValidator as _argValidator } from '@vamship/arg-utils';
import {
    IContext,
    IExtendedProperties,
    IInput,
    RequestHandler
} from '@vamship/expressjs-routes';

import _updateManager from '../lib/update-manager';

/**
 * Handler that launches a refresh license task.
 *
 * @param input The input to the handler.
 * @param context The execution context for the handler.
 * @param ext Extended properties for the handler.
 */
const updateCallbackHandler: RequestHandler = (
    input: IInput,
    context: IContext,
    ext: IExtendedProperties
) => {
    const { logger } = ext;

    const { lockId, messages } = input;
    logger.trace('Notifying update manager', {
        lockId,
        messageCount: messages.length
    });

    return _updateManager.notify(lockId, messages).then(() => ({}));
};

export default updateCallbackHandler;
