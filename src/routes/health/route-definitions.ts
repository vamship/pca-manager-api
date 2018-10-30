import { IRouteDefinition } from '@vamship/expressjs-routes';

const routeDefinitions: IRouteDefinition[] = [
    {
        method: 'GET',
        path: '/',
        handler: () => ({ status: 'ok' }),
        inputMapper: () => ({})
    }
];

export default routeDefinitions;
