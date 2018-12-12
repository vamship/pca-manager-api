'use strict';

/**
 * Specialized error type intended to be used when an error occurs during
 * license write operations.
 *
 * @extends {Error}
 */
export default class LicenseWriteError extends Error {
    /**
     * @param {String} message The error message associated with the error.
     */
    constructor(message) {
        super(message);
        if (typeof message !== 'string') {
            message = 'Error writing license file';
        }
        this.name = 'LicenseWriteError';
        this.message = `[${this.name}] ${message}`;
    }
}
