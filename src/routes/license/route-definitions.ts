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
            properties: {},
            required: []
        }
    }
];

export default routeDefinitions;
