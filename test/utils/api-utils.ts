import _configProvider from '@vamship/config';

const _config = _configProvider
    .configure('pcaServerManagerApi')
    .setApplicationScope('test')
    .getConfig();

/**
 * The endpoint of the test server.
 */
export const endpoint = `http://localhost:${_config.get('app.defaultPort')}`;

/**
 * Returns a route builder function prefixes any path with a mount point. The
 * mount point can be thought of as a base path that is prefixed to a relative
 * path, resulting in a "true" path on the server.
 *
 * @param mountPath The mount point for the path
 *
 * @returns A function that accepts a relative url, and returns a full path to
 *          a resource on the server.
 */
export function getRouteBuilder(mountPath: string): (path?: string) => string {
    const baseTokens = mountPath.split('/').filter((token) => !!token);

    /**
     * Returns a path prefixed with the mount path.
     *
     * @param path An optional string that defaults to an empty string.
     *
     * @returns A full path to a resource.
     */
    return (path = ''): string => {
        const pathTokens = path.split('/').filter((token) => !!token);
        return `/${baseTokens.concat(pathTokens).join('/')}`;
    };
}
