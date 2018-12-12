'use strict';

/**
 * Specialized error type intended to be used when an error occurs during
 * license read operations.
 *
 * @extends {Error}
 */
export default class CorruptLicenseError extends Error {
    /**
     * @param {String} message The error message associated with the error.
     */
    constructor(message) {
        super(message);
        if (typeof message !== 'string') {
            message = 'License data is corrupt';
        }
        this.name = 'CorruptLicenseError';
        this.message = `[${this.name}] ${message}`;
    }
}
