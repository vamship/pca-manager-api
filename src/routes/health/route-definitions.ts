import { IRouteDefinition } from '@vamship/expressjs-routes';

const routeDefinitions: IRouteDefinition[] = [
    {
        method: 'GET',
        path: '/',
        handler: () => ({ status: 'ok' }),
        inputMapper: () => ({})
    },
    {
        method: 'GET',
        path: '/ready',
        handler: () => ({ status: 'ok' }),
        inputMapper: () => ({})
    }
];

export default routeDefinitions;
