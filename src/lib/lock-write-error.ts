'use strict';

/**
 * Specialized error type intended to be used when an error occurs during lock
 * write operations.
 *
 * @extends {Error}
 */
export default class LockWriteError extends Error {
    /**
     * @param {String} message The error message associated with the error.
     */
    constructor(message) {
        super(message);
        if (typeof message !== 'string') {
            message = 'Error writing lock file';
        }
        this.name = 'LockWriteError';
        this.message = `[${this.name}] ${message}`;
    }
}
