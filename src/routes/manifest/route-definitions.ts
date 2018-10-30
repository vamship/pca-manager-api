import { IRouteDefinition } from '@vamship/expressjs-routes';
import getManifestHandler from '../../handlers/get-manifest-handler';

const routeDefinitions: IRouteDefinition[] = [
    {
        method: 'GET',
        path: '/',
        handler: getManifestHandler,
        inputMapper: {},
        schema: {
            $schema: 'http://json-schema.org/draft-07/schema#',
            description: 'Schema for get manifest API',
            properties: {},
            required: []
        }
    }
];

export default routeDefinitions;
