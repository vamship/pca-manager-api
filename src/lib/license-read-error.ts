'use strict';

/**
 * Specialized error type intended to be used when an error occurs during
 * license write operations.
 *
 * @extends {Error}
 */
export default class LicenseReadError extends Error {
    /**
     * @param {String} message The error message associated with the error.
     */
    constructor(message) {
        super(message);
        if (typeof message !== 'string') {
            message = 'Error reading license file';
        }
        this.name = 'LicenseReadError';
        this.message = `[${this.name}] ${message}`;
    }
}
