'use strict';

/**
 * Specialized error type intended to be used when an error occurs during lock
 * read operations.
 *
 * @extends {Error}
 */
export default class LockReadError extends Error {
    /**
     * @param {String} message The error message associated with the error.
     */
    constructor(message) {
        super(message);
        if (typeof message !== 'string') {
            message = 'Error reading lock file';
        }
        this.name = 'LockReadError';
        this.message = `[${this.name}] ${message}`;
    }
}
