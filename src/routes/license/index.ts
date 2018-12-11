import { buildRoutes } from '@vamship/expressjs-routes';
import { Router } from 'express';
import routeDefinitions from './route-definitions';

/**
 * Configures and returns a set of routes based on a list of declarative route
 * definitions.
 *
 * @module routes
 */
const router: Router = buildRoutes(routeDefinitions);

export default router;
