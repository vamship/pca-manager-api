import { IRouteDefinition } from '@vamship/expressjs-routes';
import updateSystemHandler from '../../handlers/refresh-license-handler';

const routeDefinitions: IRouteDefinition[] = [
    {
        method: 'POST',
        path: '/refresh',
        handler: updateSystemHandler,
        inputMapper: {},
        schema: {
            $schema: 'http://json-schema.org/draft-07/schema#',
            description: 'Schema for refresh license API',
            type: 'object',
            properties: {},
            required: []
        }
    },
    {
        method: 'POST',
        path: '/notify/:lockId',
        handler: updateSystemHandler,
        inputMapper: {
            lockId: 'params.lockId',
            messages: 'body.messages'
        },
        schema: {
            $schema: 'http://json-schema.org/draft-07/schema#',
            description: 'Schema for refresh license API',
            type: 'object',
            required: ['lockId', 'messages'],
            properties: {
                lockId: {
                    type: 'string',
                    minLength: 1,
                    pattern: '^(.+)$'
                },
                messages: {
                    type: 'array',
                    items: {
                        type: 'object',
                        required: ['kind', 'timestamp', 'message'],
                        properties: {
                            kind: {
                                type: 'string',
                                minLength: 1,
                                pattern: '^(.+)$'
                            },
                            timestamp: {
                                type: 'number',
                                minimum: 0
                            },
                            message: {
                                type: 'string',
                                minLength: 1,
                                pattern: '^(.+)$'
                            }
                        }
                    }
                }
            }
        }
    }
];

export default routeDefinitions;
