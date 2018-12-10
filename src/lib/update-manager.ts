// import _fs from 'fs';

import { argValidator as _argValidator } from '@vamship/arg-utils';
import _configProvider from '@vamship/config';
import _loggerProvider from '@vamship/logger';

import License from './license';
import Lock from './lock';
import SoftwareUpdaterJob from './software-updater-job';
import { ILicense, ILogger } from './types';

import { Promise } from 'bluebird';
import _fetch from 'isomorphic-fetch';

const _logger: ILogger = _loggerProvider.getLogger('update-manager');
let _lock: Lock;

const VALID_KINDS = ['log', 'success', 'fail'];

/**
 * @module updateManager
 *
 * Module that provides utility functions to launch and manage software update
 * processes.
 */
export default {
    /**
     * Launches a software update process using the provided list of software
     * component definitions.
     *
     * @param licenseData License data that also defines a list of software
     *        components that need to be installed.
     * @return A promise that is rejected or resolved based on the outcome of
     *         the launch operation.
     */
    launchUpdate: (licenseData: ILicense): Promise<any> => {
        _argValidator.checkObject(licenseData, 'Invalid licenseData (arg #1)');

        const config = _configProvider.getConfig();
        const logger = _logger.child({ method: 'launchUpdate' });
        const licenseDir = config.get('app.licenseDir');

        logger.trace('Initializing license object', { licenseDir });
        const license = new License(licenseDir);

        // Will be initialized once the token is fetched.
        let credentialProviderAuthToken;

        logger.trace('Loading license file from disk');
        return license
            .load()
            .then(() => {
                const stsEndpoint = config.get('app.stsEndpoint');
                const serverApiKey = config.get('app.serverApiKey');

                logger.trace('Fetching software update token from sts', {
                    stsEndpoint
                });
                return _fetch(stsEndpoint, {
                    method: 'GET',
                    headers: {
                        'content-type': 'application/json',
                        authorization: serverApiKey
                    }
                }).catch((ex) => {
                    const message = 'Error fetching software update token';
                    logger.error(ex, message);
                    throw new Error(message);
                });
            })
            .then((response) => {
                return response.json().then(
                    (stsResponse) => {
                        credentialProviderAuthToken = stsResponse.token;
                    },
                    (ex) => {
                        const message = 'Error parsing software update token';
                        logger.error(ex, message);
                        throw new Error(message);
                    }
                );
            })
            .then(() => {
                logger.trace('Looking for lock reference');
                if (typeof _lock === 'undefined') {
                    logger.trace(
                        'Lock reference not found. Creating new lock object.'
                    );

                    const lockDir = config.get('app.lockDir');
                    _lock = new Lock(lockDir);
                } else {
                    logger.warn('Lock reference exists.');
                }

                logger.trace('Creating lock on file system');
                return _lock.create(licenseData);
            })
            .then(() => {
                logger.trace('Initializing lock from file system');
                return _lock.init();
            })
            .then(() => {
                /// TODO: Check lock here.

                const manifest = license.generateUpdateManifest(licenseData);
                const callbackEndpoint = config.get('app.job.callbackEndpoint');
                const credentialProviderEndpoint = config.get(
                    'app.job.credentialProviderEndpoint'
                );

                const jobDescriptor = {
                    callbackEndpoint: `${callbackEndpoint}/${_lock.lockId}`,
                    credentialProviderEndpoint,
                    credentialProviderAuthToken,
                    manifest
                };

                logger.trace('Creating software update job', jobDescriptor);
                const updateJob = new SoftwareUpdaterJob(jobDescriptor);

                return updateJob.start();
            })
            .then(() => {
                logger.trace('Updating state of lock to indicate job start');
                return _lock.updateState('RUNNING');
            });
    },

    /**
     * Notifies the update process of a message from the update job.
     *
     * @param kind The type of message that is being sent. This can be one of
     *        'log', 'success' or 'fail'.
     * @param timestamp The timestamp linked to the message.
     * @param message The message text
     * @return A promise that is rejected or resolved based on the outcome of
     *         this operation.
     */
    notify: (
        kind: string,
        timestamp: number,
        message: string
    ): Promise<any> => {
        _argValidator.checkEnum(kind, VALID_KINDS, 'Invalid kind (arg #1)');
        _argValidator.checkNumber(timestamp, 1, 'Invalid timestamp (arg #2)');
        _argValidator.checkString(message, 1, 'Invalid message (arg #3)');

        const config = _configProvider.getConfig();
        const logger = _logger.child({ method: 'launchUpdate' });

        logger.trace('Received message', { kind, message, timestamp });

        if (kind === 'log') {
            logger.info('Log message received', {
                kind,
                message,
                timestamp
            });
            return Promise.resolve();
        }

        return Promise.try(() => {
            logger.trace('Looking for lock reference');
            if (typeof _lock === 'undefined') {
                logger.trace(
                    'Lock reference not found. Creating new lock object.'
                );

                const lockDir = config.get('app.lockDir');
                _lock = new Lock(lockDir);
            } else {
                logger.warn('Lock reference exists.');
            }

            if (!_lock.isReady) {
                return _lock.init();
            }
        })
            .then(() => {
                if (_lock.state !== 'RUNNING') {
                    const error = `Lock is not in RUNNING state. Current state: [${
                        _lock.state
                    }]`;
                    logger.error(error);
                    throw new Error(error);
                }

                if (kind === 'fail') {
                    logger.trace('Processing fail message');

                    return _lock.updateState('ERROR');
                } else {
                    logger.trace('Processing success message');

                    const licenseDir = config.get('app.licenseDir');

                    logger.trace('Initializing license object', { licenseDir });
                    const license = new License(licenseDir);
                    license.setData(_lock.license);

                    logger.trace('Saving updated license data', {
                        licenseData: _lock.license
                    });

                    return license.save().then(() => {
                        logger.trace('License data updated and saved');
                        return _lock.updateState('DONE');
                    });
                }
            })
            .then(() => {
                return _lock.cleanup();
            });
    }
};

_logger.trace('Module [updateManager] initialized');
