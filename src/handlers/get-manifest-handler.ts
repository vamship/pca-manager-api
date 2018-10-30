import { argValidator as _argValidator } from '@vamship/arg-utils';
import {
    IContext,
    IExtendedProperties,
    IInput,
    RequestHandler
} from '@vamship/expressjs-routes';

const GREETINGS = {
    en: 'Hello',
    fr: 'Bonjour'
};

/**
 * Handler that greets the end user.
 *
 * @param input The input to the handler.
 * @param context The execution context for the handler.
 * @param ext Extended properties for the handler.
 */
const greetingHandler: RequestHandler = (
    input: IInput,
    context: IContext,
    ext: IExtendedProperties
) => {
    const { name, language } = input;
    const greeting = GREETINGS[language] || 'Hello';

    let messageName = name;
    if (!_argValidator.checkString(name, 1)) {
        messageName = 'there';
    }

    return {
        message: `${greeting}, ${messageName}`
    };
};

export default greetingHandler;
