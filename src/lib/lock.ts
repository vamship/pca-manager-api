import _fs from 'fs';
import _path from 'path';

import { argValidator as _argValidator } from '@vamship/arg-utils';
import _loggerProvider from '@vamship/logger';
import { Promise } from 'bluebird';
import { ILogger } from './types';

import CorruptLockError from './corrupt-lock-error';
import LockReadError from './lock-read-error';
import LockWriteError from './lock-write-error';

const LOCK_FILE_NAME = '_lock';

/**
 * Abstract representation of a lock file, providing utility methods for the
 * initializing, updating and deleting the lock file.
 */
export default class Lock {
    private _logger: ILogger;
    private _lockDir: string;
    private _lockId: string;
    private _state: string;
    private _license: any;
    private _logs: object[];
    private _isInitialized: boolean;
    private _isCleanedUp: boolean;
    private _readFileMethod: (fileName: string) => Promise<string>;
    private _writeFileMethod: (
        fileName: string,
        license: string,
        options: any
    ) => Promise<string>;
    private _renameMethod: (
        oldFileName: string,
        newFileName: string
    ) => Promise<string>;

    /**
     * @param lockDir The path to the directory containing the lock file.
     */
    constructor(lockDir: string) {
        _argValidator.checkString(lockDir, 1, 'Invalid lockDir (arg #1)');

        this._lockDir = lockDir;
        this._isInitialized = false;
        this._isCleanedUp = false;
        this._lockId = 'NA';
        this._state = 'NA';
        this._license = {};
        this._logs = [];

        this._logger = _loggerProvider.getLogger('lock', {
            lockDir
        });
        this._logger.trace('Lock initialized');

        this._readFileMethod = Promise.promisify(_fs.readFile.bind(_fs));
        this._writeFileMethod = Promise.promisify(_fs.writeFile.bind(_fs));
        this._renameMethod = Promise.promisify(_fs.rename.bind(_fs));
    }

    /**
     * Determines whether or not the lock object is ready for use, based on its
     * internal state.
     */
    get isReady(): boolean {
        return this._isInitialized && !this._isCleanedUp;
    }
    /**
     * Gets the id associated with the lock. If the lock has not been
     * initialized, this method will throw an error.
     */
    get lockId(): string {
        this._checkInitialized();
        return this._lockId;
    }

    /**
     * Gets the state associated with the lock. If the lock has not been
     * initialized, this method will throw an error.
     */
    get state(): string {
        this._checkInitialized();
        return this._state;
    }

    /**
     * Gets the license data associated with the lock. If the lock has not been
     * initialized, this method will throw an error.
     */
    get license(): any {
        this._checkInitialized();
        return this._license;
    }

    /**
     * Gets a list of messages associated with the job.
     */
    get logs(): object[] {
        this._checkInitialized();
        return this._logs;
    }

    /**
     * Create a new lock file, initializing it with default values for
     * properties.
     *
     * @param licenseData License data that will be stored in the lock file.
     *        This is an optional parameter that will be defaulted to an empty
     *        object.
     * @return A promise that is resolved or rejected based on the outcome of
     *         create operation. If successful, lockId and state properties
     *         will be overwritten.
     */
    public create(license: any = {}): Promise<any> {
        if (this._isInitialized) {
            throw new Error('Lock already initialized');
        }
        const lockId = Date.now().toString();
        const state = 'ACTIVE';
        return this._writeLockFile(
            lockId,
            state,
            license,
            [
                {
                    kind: 'log',
                    message: 'Lock created',
                    timestamp: Date.now()
                }
            ],
            false
        );
    }

    /**
     * Initialize the lock by loading the file from the file system.
     *
     * @return A promise that is resolved or rejected based on the outcome of
     *         init operation. If successful, internal properties will be
     *         overwritten.
     */
    public init(): Promise<any> {
        if (this._isInitialized) {
            return Promise.resolve();
        }

        const lockFile = _path.join(this._lockDir, LOCK_FILE_NAME);
        this._logger.trace('Reading lock file', { lockFile });
        return this._readFileMethod(lockFile)
            .catch((ex) => {
                const message = 'Error reading lock file';
                this._logger.error(ex, message);
                throw new LockReadError(message);
            })
            .then((data) => {
                try {
                    this._logger.trace('Parsing lock file contents');
                    data = JSON.parse(data);
                } catch (ex) {
                    this._logger.error(ex, 'Error parsing lock file');
                    throw new CorruptLockError('Error parsing lock file');
                }

                try {
                    this._logger.trace('Validating lock file contents');
                    _argValidator.checkString(
                        data.lockId,
                        1,
                        'Lock file does not define a valid lockId'
                    );
                    _argValidator.checkString(
                        data.state,
                        1,
                        'Lock file does not define a valid state'
                    );
                    _argValidator.checkObject(
                        data.license,
                        'Lock file does not define a valid license'
                    );
                    _argValidator.checkArray(
                        data.logs,
                        'Lock file does not define valid logs'
                    );
                } catch (ex) {
                    this._logger.error(
                        ex,
                        'Error processing lock file contents'
                    );
                    throw new CorruptLockError(ex.message);
                }

                this._logger.trace('Setting lock properties from lockfile');
                this._lockId = data.lockId;
                this._state = data.state;
                this._license = data.license;
                this._logs = data.logs;
                this._isInitialized = true;
            });
    }

    /**
     * Adds a log message to the internal buffer. The data will not be written
     * to disk until the `save()` method is called.
     *
     * @param logRecord The log data to write to disk.
     */
    public addLog(logRecord: object): void {
        this._checkInitialized();
        this._checkCleanedUp();
        _argValidator.checkObject(logRecord, 'Invalid logRecord (arg #1)');

        this._logger.trace('Adding log record');
        this._logs.push(Object.assign({}, logRecord));
    }

    /**
     * Updates the state of the lock file. The updated state will not be written
     * to disk until the `save()` method is called.
     *
     * @param newState The new state to assign to the lock.
     */
    public updateState(newState: string): Promise<any> {
        this._checkInitialized();
        this._checkCleanedUp();
        _argValidator.checkString(newState, 1, 'Invalid newState (arg #1)');

        this._logger.trace('Updating lock state');
        this._state = newState;
    }

    /**
     * Saves current lock data to disk.
     *
     * @return A promise that is resolved or rejected based on the outcome of
     *         save operation.
     */
    public save(): Promise<any> {
        this._checkInitialized();
        this._checkCleanedUp();

        this._logger.trace('Saving lock file');
        return this._writeLockFile(
            this._lockId,
            this._state,
            this._license,
            this._logs
        ).then(() => {
            this._logger.trace('Save successful');
        });
    }

    /**
     * Cleans up the lock file from the file system, by renaming it. This object
     * will be unusable after this operation is completed.
     *
     * @return A promise that is resolved or rejected based on the outcome of
     *         cleanup operation. This object will no longer be usable after
     *         cleanup.
     */
    public cleanup(): Promise<any> {
        this._checkInitialized();
        this._checkCleanedUp();
        const lockFile = _path.join(this._lockDir, LOCK_FILE_NAME);
        const archiveFile = _path.join(this._lockDir, this._lockId);

        this._logger.trace('Cleaning up lock file');
        return this._renameMethod(lockFile, archiveFile)
            .then(() => {
                this._logger.trace('Cleaned up. Setting internal properties');
                this._isCleanedUp = true;
            })
            .catch((ex) => {
                const message = 'Error cleaning up lock file';
                this._logger.error(ex, message);
                throw new LockWriteError(message);
            });
    }

    /**
     * Checks if the lock is initialized, and throws an error if it is not.
     *
     * @private
     */
    private _checkInitialized() {
        if (!this._isInitialized) {
            throw new Error('Lock not initialized');
        }
    }

    /**
     * Checks if the lock has been cleaned up, and throws an error if it has
     * been.
     *
     * @private
     */
    private _checkCleanedUp() {
        if (this._isCleanedUp) {
            throw new Error('Lock is no longer available');
        }
    }

    /**
     * Writes data to the lock file on the file system.
     *
     * @private
     * @param lockId The update id for the current update.
     * @param state The state of the update job
     */
    private _writeLockFile(
        lockId: string,
        state: string,
        license: any,
        logs: object[],
        overwrite: boolean = true
    ): Promise<any> {
        const flag = overwrite ? 'w' : 'wx';
        const lockFile = _path.join(this._lockDir, LOCK_FILE_NAME);
        return this._writeFileMethod(
            lockFile,
            JSON.stringify({
                lockId,
                state,
                license,
                logs
            }),
            {
                flag
            }
        ).catch((ex) => {
            const message = 'Error writing to lock file';
            this._logger.error(ex, message);
            throw new LockWriteError(message);
        });
    }
}
