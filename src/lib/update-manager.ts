// import _fs from 'fs';

import { argValidator as _argValidator } from '@vamship/arg-utils';
import _configProvider from '@vamship/config';
import _loggerProvider from '@vamship/logger';

import License from './license';
import Lock from './lock';
import SoftwareUpdaterJob from './software-updater-job';
import { IJobMessage, ILicense, ILogger } from './types';

import { Promise } from 'bluebird';
import _fetch from 'isomorphic-fetch';

const _logger: ILogger = _loggerProvider.getLogger('update-manager');

let _lock: Lock | undefined;
let _createPromise: Promise<any> = Promise.resolve();
let _notifyPromise: Promise<any> = Promise.resolve();

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
        if (_lock) {
            throw new Error('Cannot create lock. A lock already exists');
        }
        _argValidator.checkObject(licenseData, 'Invalid licenseData (arg #1)');

        const config = _configProvider.getConfig();
        const logger = _logger.child({ method: 'launchUpdate' });

        // Will be initialized during the flow
        let license;

        const lockDir = config.get('app.lockDir');

        logger.trace('Creating new lock object.', { lockDir });
        _lock = new Lock(lockDir);

        let resolveRef;
        _createPromise = new Promise((resolve, reject) => {
            resolveRef = resolve;
        });

        logger.trace('Creating lock on file system');
        let lockCreated = false;
        return _lock
            .create(licenseData)
            .then(() => {
                logger.trace('Initializing lock from file system');
                lockCreated = true;
                return _lock!.init();
            })
            .then(() => {
                const licenseDir = config.get('app.licenseDir');

                logger.trace('Initializing license object', { licenseDir });
                license = new License(licenseDir);

                return license.load();
            })
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
                logger.trace('Parsing sts token');
                return response.json().then(
                    (stsResponse) => stsResponse.token,
                    (ex) => {
                        const message = 'Error parsing software update token';
                        logger.error(ex, message);
                        throw new Error(message);
                    }
                );
            })
            .then((token) => {
                logger.trace('Initializing software update job');
                const manifest = license.generateUpdateManifest(licenseData);
                const callbackEndpoint = config.get('app.callbackEndpoint');
                const credentialProviderEndpoint = config.get(
                    'app.credentialProviderEndpoint'
                );
                const lockId = _lock!.lockId;

                const jobDescriptor = {
                    callbackEndpoint: `${callbackEndpoint}/${lockId}`,
                    credentialProviderEndpoint,
                    credentialProviderAuthToken: token,
                    manifest
                };

                logger.trace('Creating software update job object', { lockId });
                const updateJob = new SoftwareUpdaterJob(lockId);

                logger.trace('Launching software update job', jobDescriptor);
                return updateJob.start(jobDescriptor);
            })
            .then(() => {
                return {
                    lockId: _lock!.lockId,
                    state: _lock!.state
                };
            })
            .catch((ex) => {
                logger.trace('Cleaning up lock references');
                return Promise.try(() => {
                    if (lockCreated) {
                        logger.trace('Cleaning up lock from file system');
                        return _lock!.cleanup();
                    } else {
                        logger.trace(
                            'Lock file not created. No clean up required'
                        );
                    }
                })
                    .then(() => {
                        logger.trace('Reseting lock reference');
                        _lock = undefined;
                    })
                    .finally(() => {
                        logger.trace('Rethrowing exception after cleanup');
                        throw ex;
                    });
            })
            .finally(() => {
                logger.trace('Resolve create promise');
                resolveRef();
            });
    },

    /**
     * Notifies the update process of messages from the update job.
     *
     * @param lockId The id of the lock for which the message is intended
     * @param messages A list of messages from the update job.
     * @return A promise that is rejected or resolved based on the outcome of
     *         this operation.
     */
    notify: (lockId: string, messages: IJobMessage[]): Promise<any> => {
        _argValidator.checkString(lockId, 1, 'Invalid lockId (arg #1)');
        _argValidator.checkArray(messages, 'Invalid messages (arg #2)');
        messages.forEach((messageRecord) => {
            _argValidator.checkObject(
                messageRecord,
                'Messages contain invalid values'
            );
            const { kind, timestamp, message } = messageRecord;
            _argValidator.checkEnum(
                kind,
                VALID_KINDS,
                'Invalid kind (message.kind)'
            );
            _argValidator.checkNumber(
                timestamp,
                1,
                'Invalid timestamp (message.timestamp)'
            );
            _argValidator.checkString(
                message,
                1,
                'Invalid message (message.message)'
            );
        });

        const config = _configProvider.getConfig();
        const logger = _logger.child({ method: 'notify' });

        // Will be initialized during the flow
        let resolveRef;

        return Promise.all([_createPromise, _notifyPromise])
            .then(() => {
                _notifyPromise = new Promise((resolve, reject) => {
                    resolveRef = resolve;
                });

                if (!_lock) {
                    const lockDir = config.get('app.lockDir');
                    logger.warn('Creating new lock object.', { lockDir });
                    _lock = new Lock(lockDir);
                } else {
                    logger.trace('Lock reference already exists');
                }

                logger.trace('Initializing lock');
                return _lock!.init();
            })
            .then(() => {
                if (_lock!.state !== 'ACTIVE') {
                    throw new Error(
                        `Lock is not ACTIVE. Current state: [${_lock!.state}]`
                    );
                }
                if (_lock!.lockId !== lockId) {
                    logger.warn('Messages do not apply to current lock', {
                        currentLockId: _lock!.lockId,
                        messageLockId: lockId
                    });
                    logger.debug('Mismatched message', { messages });
                    throw new Error(
                        'Lock id mismatch. Messages do not apply to current lock'
                    );
                }

                messages.forEach((message) => {
                    logger.trace('Writing log message');
                    _lock!.addLog(message);

                    if (message.kind === 'success') {
                        logger.trace('Processing success message');
                        _lock!.updateState('DONE');
                    }
                    if (message.kind === 'fail') {
                        logger.trace('Processing fail message');
                        _lock!.updateState('ERROR');
                    }
                });
                return _lock!.save();
            })
            .then(() => {
                if (_lock!.state === 'DONE') {
                    const licenseDir = config.get('app.licenseDir');
                    logger.trace('Initializing license object', {
                        licenseDir
                    });
                    const license = new License(licenseDir);
                    license.setData(_lock!.license);
                    logger.trace('Saving updated license data', {
                        licenseData: _lock!.license
                    });
                    return license.save();
                }
            })
            .finally(() => {
                return Promise.try(() => {
                    if (_lock!.isReady && _lock!.state !== 'ACTIVE') {
                        logger.trace('Creating software update job object', {
                            lockId: _lock!.lockId
                        });
                        const updateJob = new SoftwareUpdaterJob(_lock!.lockId);

                        logger.trace('Cleaning up update job');
                        const cleanupJobPromise = updateJob
                            .cleanup()
                            .catch((ex) => {
                                logger.error(ex, 'Error cleaning up job');
                            });

                        logger.trace('Cleaning up lock file');
                        const cleanupLockPromise = _lock!
                            .cleanup()
                            .catch((ex) => {
                                logger.error(ex, 'Error cleaning up lock');
                            });

                        return Promise.all([
                            cleanupJobPromise,
                            cleanupLockPromise
                        ]).finally(() => {
                            _lock = undefined;
                        });
                    } else {
                        logger.trace(
                            'Lock file still active. No clean up required'
                        );
                    }
                })
                    .catch((ex) => {
                        logger.fatal(ex, 'Error cleaning up lock file');
                    })
                    .finally(() => {
                        logger.trace('Resolve create promise');
                        resolveRef();
                    });
            });
    }
};

_logger.trace('Module [updateManager] initialized');
