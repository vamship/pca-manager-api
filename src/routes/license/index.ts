import { buildRoutes } from '@vamship/expressjs-routes';
import bodyParser from 'body-parser';
import { Router } from 'express';

import routeDefinitions from './route-definitions';

/**
 * Configures and returns a set of routes based on a list of declarative route
 * definitions.
 *
 * @module routes
 */
const router: Router = Router();

router.use(bodyParser.json());

buildRoutes(routeDefinitions, router);

export default router;
