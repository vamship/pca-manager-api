'use strict';

/**
 * Specialized error type intended to be used when an error occurs during lock
 * read operations.
 *
 * @extends {Error}
 */
export default class CorruptLockError extends Error {
    /**
     * @param {String} message The error message associated with the error.
     */
    constructor(message) {
        super(message);
        if (typeof message !== 'string') {
            message = 'Lock file is corrupt';
        }
        this.name = 'CorruptLockError';
        this.message = `[${this.name}] ${message}`;
    }
}
