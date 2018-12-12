import _chai from 'chai';
import _chaiAsPromised from 'chai-as-promised';
import 'mocha';
import _sinon from 'sinon';
import _sinonChai from 'sinon-chai';

_chai.use(_chaiAsPromised);
_chai.use(_sinonChai);
const expect = _chai.expect;

import _path from 'path';
import _rewire from 'rewire';

import {
    asyncHelper as _asyncHelper,
    ObjectMock,
    testValues as _testValues
} from '@vamship/test-utils';

import CorruptLockError from '../../../src/lib/corrupt-lock-error';
import LockReadError from '../../../src/lib/lock-read-error';
import LockWriteError from '../../../src/lib/lock-write-error';

const _lockModule = _rewire('../../../src/lib/lock');
const Lock = _lockModule.default;
const LOCK_FILE_NAME = '_lock';

describe('Lock', () => {
    function _createLock(lockDir?: string) {
        lockDir = lockDir || _testValues.getString('lockDir');
        return new Lock(lockDir);
    }

    function _initLock(lockDir?: string, payload?: any): Promise<any> {
        const readFileMethod = _fsMock.mocks.readFile;
        readFileMethod.reset();

        const lock = _createLock(lockDir);
        const ret = lock.init();

        payload = Object.assign(
            {
                lockId: _testValues.getString('lockId'),
                state: _testValues.getString('state'),
                license: {
                    foo: _testValues.getString('foo')
                },
                logs: [
                    {
                        kind: 'log',
                        timestamp: _testValues.getTimestamp(),
                        message: 'Lock created'
                    }
                ]
            },
            payload
        );
        const readCallback = readFileMethod.stub.args[0][1];
        readCallback(null, JSON.stringify(payload));

        return ret.then(() => ({
            lock
        }));
    }

    let _fsMock;

    beforeEach(() => {
        _fsMock = new ObjectMock()
            .addMock('readFile')
            .addMock('writeFile')
            .addMock('rename');

        _lockModule.__set__('fs_1', {
            default: _fsMock.instance
        });
    });

    describe('ctor()', () => {
        it('should throw an error if invoked without a valid lockDir', () => {
            const inputs = _testValues.allButString('');
            const error = 'Invalid lockDir (arg #1)';

            inputs.forEach((lockDir) => {
                const wrapper = () => {
                    return new Lock(lockDir);
                };
                expect(wrapper).to.throw(error);
            });
        });

        it('should expose the expected properties and methods', () => {
            const lock = new Lock(_testValues.getString('lockDir'));

            expect(lock).to.be.an('object');

            expect(lock.create).to.be.a('function');
            expect(lock.init).to.be.a('function');
            expect(lock.addLog).to.be.a('function');
            expect(lock.updateState).to.be.a('function');
            expect(lock.save).to.be.a('function');
            expect(lock.cleanup).to.be.a('function');
        });
    });

    describe('init()', () => {
        it('should return a promise when invoked', () => {
            const lock = _createLock();

            const ret = lock.init();

            expect(ret).to.be.an('object');
            expect(ret.then).to.be.a('function');
        });

        it('should resolve the promise if the lock is already initialized', () => {
            const lock = _createLock();
            lock._isInitialized = true;
            const ret = lock.init();

            return expect(ret).to.be.fulfilled;
        });

        it('should load the lock file from the filesystem when invoked', () => {
            const lockDir = _testValues.getString('lockDir');
            const lockFile = _path.join(lockDir, LOCK_FILE_NAME);
            const lock = _createLock(lockDir);
            const readFileMethod = _fsMock.mocks.readFile;

            expect(readFileMethod.stub).to.not.have.been.called;
            lock.init();

            expect(readFileMethod.stub).to.have.been.calledOnce;
            expect(readFileMethod.stub.args[0]).to.have.length(2);
            expect(readFileMethod.stub.args[0][0]).to.equal(lockFile);
            expect(readFileMethod.stub.args[0][1]).to.be.a('function');
        });

        it('should reject the promise if the lock file read operation fails', () => {
            const error = 'Error reading lock file';
            const lock = _createLock();
            const readFileMethod = _fsMock.mocks.readFile;

            const ret = lock.init();
            const callback = readFileMethod.stub.args[0][1];
            callback({
                code: 'ESOMETHINGWENTWRONG'
            });

            return expect(ret).to.be.rejectedWith(LockReadError, error);
        });

        it('should reject the promise if the lockfile contents cannot be parsed', () => {
            const error = 'Error parsing lock file';
            const lock = _createLock();
            const readFileMethod = _fsMock.mocks.readFile;

            const ret = lock.init();
            const callback = readFileMethod.stub.args[0][1];
            callback(null, 'bad payload');

            return expect(ret).to.be.rejectedWith(CorruptLockError, error);
        });

        it('should throw an error if the lockfile does not define a valid lockId', () => {
            const error = 'Lock file does not define a valid lockId';
            const inputs = _testValues.allButString('');

            const promises = inputs.map((lockId, index) => {
                const lock = _createLock();
                const readFileMethod = _fsMock.mocks.readFile;

                const ret = lock.init();
                const callback = readFileMethod.stub.args[index][1];
                const payload = {
                    lockId
                };
                callback(null, JSON.stringify(payload));

                return expect(ret).to.be.rejectedWith(CorruptLockError, error);
            });

            return expect(Promise.all(promises)).to.be.fulfilled;
        });

        it('should throw an error if the lockfile does not define a valid state', () => {
            const error = 'Lock file does not define a valid state';
            const inputs = _testValues.allButString('');

            const promises = inputs.map((state, index) => {
                const lock = _createLock();
                const readFileMethod = _fsMock.mocks.readFile;

                const ret = lock.init();
                const callback = readFileMethod.stub.args[index][1];
                const payload = {
                    lockId: _testValues.getString('lockId'),
                    state
                };
                callback(null, JSON.stringify(payload));

                return expect(ret).to.be.rejectedWith(CorruptLockError, error);
            });

            return expect(Promise.all(promises)).to.be.fulfilled;
        });

        it('should throw an error if the lockfile does not define valid license data', () => {
            const error = 'Lock file does not define a valid license';
            const inputs = _testValues.allButObject();

            const promises = inputs.map((license, index) => {
                const lock = _createLock();
                const readFileMethod = _fsMock.mocks.readFile;

                const ret = lock.init();
                const callback = readFileMethod.stub.args[index][1];
                const payload = {
                    lockId: _testValues.getString('lockId'),
                    state: _testValues.getString('state'),
                    license
                };
                callback(null, JSON.stringify(payload));

                return expect(ret).to.be.rejectedWith(CorruptLockError, error);
            });

            return expect(Promise.all(promises)).to.be.fulfilled;
        });

        it('should throw an error if the lockfile does not define valid logs', () => {
            const error = 'Lock file does not define valid logs';
            const inputs = _testValues.allButArray();

            const promises = inputs.map((logs, index) => {
                const lock = _createLock();
                const readFileMethod = _fsMock.mocks.readFile;

                const ret = lock.init();
                const callback = readFileMethod.stub.args[index][1];
                const payload = {
                    lockId: _testValues.getString('lockId'),
                    state: _testValues.getString('state'),
                    license: {
                        foo: _testValues.getString('foo')
                    },
                    logs
                };
                callback(null, JSON.stringify(payload));

                return expect(ret).to.be.rejectedWith(CorruptLockError, error);
            });

            return expect(Promise.all(promises)).to.be.fulfilled;
        });

        it('should update instance properties with values from the lock file if validation succeeds', () => {
            const lock = _createLock();
            const readFileMethod = _fsMock.mocks.readFile;

            expect(lock._lockId).to.equal('NA');
            expect(lock._state).to.equal('NA');
            expect(lock._license).to.deep.equal({});
            expect(lock._isInitialized).to.be.false;

            const ret = lock.init();
            const callback = readFileMethod.stub.args[0][1];
            const payload = {
                lockId: _testValues.getString('lockId'),
                state: _testValues.getString('state'),
                license: {
                    foo: _testValues.getString('foo')
                },
                logs: [
                    {
                        kind: 'log',
                        timestamp: _testValues.getTimestamp(),
                        message: 'Lock created'
                    }
                ]
            };
            callback(null, JSON.stringify(payload));

            return expect(ret).to.be.fulfilled.then(() => {
                expect(lock._lockId).to.equal(payload.lockId);
                expect(lock._state).to.equal(payload.state);
                expect(lock._license).to.deep.equal(payload.license);
                expect(lock._logs).to.deep.equal(payload.logs);
                expect(lock._isInitialized).to.be.true;
            });
        });
    });

    describe('isReady', () => {
        it('should return false if the lock has not been initialized', () => {
            [false, true].forEach((isCleanedUp) => {
                const lock = _createLock();
                lock._isCleanedUp = isCleanedUp;
                lock._isInitialized = false;

                expect(lock.isReady).to.be.false;
            });
        });

        it('should return false if the lock has been cleaned up', () => {
            [false, true].forEach((isInitialized) => {
                const lock = _createLock();
                lock._isInitialized = isInitialized;
                lock._isCleanedUp = true;

                expect(lock.isReady).to.be.false;
            });
        });

        it('should return true if the lock has been initialized but not cleaned up', () => {
            const lock = _createLock();
            lock._isInitialized = true;
            lock._isCleanedUp = false;

            expect(lock.isReady).to.be.true;
        });
    });

    describe('lockId', () => {
        it('should throw an error if property is accessed prior to initialization', () => {
            const error = 'Lock not initialized';

            const wrapper = () => {
                const lock = _createLock();
                return lock.lockId;
            };

            expect(wrapper).to.throw(error);
        });

        it('should return the lockId if the lock has been initialized', () => {
            const lockId = _testValues.getString('lockId');

            return _initLock(undefined, { lockId }).then(({ lock }) => {
                expect(lock.lockId).to.equal(lockId);
            });
        });
    });

    describe('state', () => {
        it('should throw an error if property is accessed prior to initialization', () => {
            const error = 'Lock not initialized';

            const wrapper = () => {
                const lock = _createLock();
                return lock.state;
            };

            expect(wrapper).to.throw(error);
        });

        it('should return the state if the lock has been initialized', () => {
            const state = _testValues.getString('state');

            return _initLock(undefined, { state }).then(({ lock }) => {
                expect(lock.state).to.equal(state);
            });
        });
    });

    describe('license', () => {
        it('should throw an error if property is accessed prior to initialization', () => {
            const error = 'Lock not initialized';

            const wrapper = () => {
                const lock = _createLock();
                return lock.license;
            };

            expect(wrapper).to.throw(error);
        });

        it('should return the license if the lock has been initialized', () => {
            const license = {
                foo: _testValues.getString('foo')
            };

            return _initLock(undefined, { license }).then(({ lock }) => {
                expect(lock.license).to.deep.equal(license);
            });
        });
    });

    describe('logs', () => {
        it('should throw an error if property is accessed prior to initialization', () => {
            const error = 'Lock not initialized';

            const wrapper = () => {
                const lock = _createLock();
                return lock.logs;
            };

            expect(wrapper).to.throw(error);
        });

        it('should return the logs if the lock has been initialized', () => {
            const logs = [
                {
                    kind: 'log',
                    timestamp: _testValues.getTimestamp(),
                    message: 'Lock created'
                }
            ];

            return _initLock(undefined, { logs }).then(({ lock }) => {
                expect(lock.logs).to.deep.equal(logs);
            });
        });
    });

    describe('addLog()', () => {
        it('should throw an error if the lock is not initialized', () => {
            const error = 'Lock not initialized';
            const wrapper = () => {
                const lock = _createLock();
                return lock.addLog({});
            };

            expect(wrapper).to.throw(error);
        });

        it('should throw an error if the lock has been cleaned up', () => {
            const error = 'Lock is no longer available';
            return _initLock().then(({ lock }) => {
                const wrapper = () => {
                    lock._isCleanedUp = true;
                    return lock.addLog({});
                };

                expect(wrapper).to.throw(error);
            });
        });

        it('should throw an error if the logRecord is invalid', () => {
            const error = 'Invalid logRecord (arg #1)';
            const inputs = _testValues.allButObject();

            inputs.forEach((logRecord) => {
                return _initLock().then(({ lock }) => {
                    const wrapper = () => {
                        return lock.addLog(logRecord);
                    };

                    expect(wrapper).to.throw(error);
                });
            });
        });

        it('should add the log record to the internal log array', () => {
            return _initLock().then(({ lock }) => {
                lock._logs = [];
                const log = {
                    kind: 'log',
                    timestamp: _testValues.getTimestamp(),
                    message: 'Lock created'
                };
                lock.addLog(log);

                expect(lock._logs).to.have.length(1);
                expect(lock._logs[0]).to.deep.equal(log);
                expect(lock._logs[0]).to.not.equal(log);
            });
        });
    });

    describe('updateState()', () => {
        it('should throw an error if the lock is not initialized', () => {
            const error = 'Lock not initialized';
            const wrapper = () => {
                const lock = _createLock();
                return lock.updateState(_testValues.getString('newState'));
            };

            expect(wrapper).to.throw(error);
        });

        it('should throw an error if the lock has been cleaned up', () => {
            const error = 'Lock is no longer available';
            return _initLock().then(({ lock }) => {
                const wrapper = () => {
                    lock._isCleanedUp = true;
                    return lock.updateState(_testValues.getString('newState'));
                };

                expect(wrapper).to.throw(error);
            });
        });

        it('should throw an error if newState is invalid', () => {
            const error = 'Invalid newState (arg #1)';
            const inputs = _testValues.allButString('');

            const promises = inputs.map((newState) => {
                return _initLock().then(({ lock }) => {
                    const wrapper = () => {
                        return lock.updateState(newState);
                    };

                    expect(wrapper).to.throw(error);
                });
            });

            return expect(Promise.all(promises)).to.be.fulfilled;
        });

        it('should update the internal state with the new value', () => {
            return _initLock().then(({ lock }) => {
                lock._state = _testValues.getString('oldState');

                const newState = _testValues.getString('newState');
                lock.updateState(newState);

                expect(lock._state).to.equal(newState);
            });
        });
    });

    describe('save()', () => {
        it('should throw an error if the lock is not initialized', () => {
            const error = 'Lock not initialized';
            const wrapper = () => {
                const lock = _createLock();
                return lock.save();
            };

            expect(wrapper).to.throw(error);
        });

        it('should throw an error if the lock has been cleaned up', () => {
            const error = 'Lock is no longer available';
            return _initLock().then(({ lock }) => {
                const wrapper = () => {
                    lock._isCleanedUp = true;
                    return lock.save();
                };

                expect(wrapper).to.throw(error);
            });
        });

        it('should return a promise when invoked', () => {
            return _initLock().then(({ lock }) => {
                const ret = lock.save();

                expect(ret).to.be.an('object');
                expect(ret.then).to.be.a('function');
            });
        });

        it('should write the new state to the lock file', () => {
            const lockDir = _testValues.getString('lockfile');
            const lockFile = _path.join(lockDir, LOCK_FILE_NAME);
            const lockId = _testValues.getString('lockId');
            const state = _testValues.getString('state');
            const license = {
                bar: _testValues.getString('bar')
            };
            const logs = [
                {
                    kind: 'log',
                    timestamp: _testValues.getTimestamp(),
                    message: 'Lock created'
                }
            ];

            const props = { lockId, state, license, logs };

            return _initLock(lockDir, props).then(({ lock }) => {
                const writeFileMethod = _fsMock.mocks.writeFile;

                expect(writeFileMethod.stub).to.not.have.been.called;

                lock.save();

                expect(writeFileMethod.stub).to.have.been.calledOnce;
                expect(writeFileMethod.stub.args[0]).to.have.length(4);

                expect(writeFileMethod.stub.args[0][0]).to.equal(lockFile);

                const payload = JSON.parse(writeFileMethod.stub.args[0][1]);
                expect(payload).to.be.an('object');
                expect(payload).to.have.all.keys([
                    'lockId',
                    'state',
                    'license',
                    'logs'
                ]);
                expect(payload.lockId).to.equal(lockId);
                expect(payload.state).to.equal(state);
                expect(payload.license).to.deep.equal(license);

                expect(writeFileMethod.stub.args[0][2]).to.deep.equal({
                    flag: 'w'
                });
                expect(writeFileMethod.stub.args[0][3]).to.be.a('function');
            });
        });

        it('should reject the promise if lock file write fails', () => {
            const error = 'Error writing to lock file';

            return _initLock().then(({ lock }) => {
                const writeFileMethod = _fsMock.mocks.writeFile;

                const ret = lock.save();
                const writeCallback = writeFileMethod.stub.args[0][3];

                writeCallback('something went wrong');

                return expect(ret).to.have.been.rejectedWith(
                    LockWriteError,
                    error
                );
            });
        });

        it('should resolve the promise if lock file write succeeds', () => {
            return _initLock().then(({ lock }) => {
                const writeFileMethod = _fsMock.mocks.writeFile;

                const ret = lock.save();
                const writeCallback = writeFileMethod.stub.args[0][3];

                writeCallback();

                return expect(ret).to.be.fulfilled;
            });
        });
    });

    describe('cleanup()', () => {
        it('should throw an error if the lock is not initialized', () => {
            const error = 'Lock not initialized';
            const wrapper = () => {
                const lock = _createLock();
                return lock.cleanup();
            };

            expect(wrapper).to.throw(error);
        });

        it('should throw an error if the lock has been cleaned up', () => {
            const error = 'Lock is no longer available';
            return _initLock().then(({ lock }) => {
                const wrapper = () => {
                    lock._isCleanedUp = true;
                    return lock.cleanup();
                };

                expect(wrapper).to.throw(error);
            });
        });

        it('should return a promise when invoked', () => {
            return _initLock().then(({ lock }) => {
                const ret = lock.cleanup();

                expect(ret).to.be.an('object');
                expect(ret.then).to.be.a('function');
            });
        });

        it('should cleanup the lock file by renaming it', () => {
            const lockDir = _testValues.getString('lockfile');
            const lockFile = _path.join(lockDir, LOCK_FILE_NAME);
            const lockId = _testValues.getString('lockId');
            const archivedLockFile = _path.join(lockDir, lockId);

            return _initLock(lockDir, { lockId }).then(({ lock }) => {
                const renameMethod = _fsMock.mocks.rename;

                expect(renameMethod.stub).to.not.have.been.called;

                lock.cleanup();

                expect(renameMethod.stub).to.have.been.calledOnce;
                expect(renameMethod.stub.args[0]).to.have.length(3);

                expect(renameMethod.stub.args[0][0]).to.equal(lockFile);
                expect(renameMethod.stub.args[0][1]).to.equal(archivedLockFile);
                expect(renameMethod.stub.args[0][2]).to.be.a('function');
            });
        });

        it('should reject the promise if lock file rename fails', () => {
            const error = 'Error cleaning up lock file';

            return _initLock().then(({ lock }) => {
                const renameMethod = _fsMock.mocks.rename;

                const ret = lock.cleanup();
                const renameCallback = renameMethod.stub.args[0][2];

                renameCallback('something went wrong');

                return expect(ret).to.have.been.rejectedWith(
                    LockWriteError,
                    error
                );
            });
        });

        it('should resolve the promise if lock file rename succeeds', () => {
            return _initLock().then(({ lock }) => {
                const renameMethod = _fsMock.mocks.rename;

                expect(lock._isCleanedUp).to.be.false;

                const ret = lock.cleanup();
                const renameCallback = renameMethod.stub.args[0][2];

                renameCallback();

                return expect(ret).to.have.been.fulfilled.then(() => {
                    expect(lock._isCleanedUp).to.be.true;
                });
            });
        });
    });

    describe('create()', () => {
        it('should throw an error if the lock is already initialized', () => {
            const error = 'Lock already initialized';
            const wrapper = () => {
                const lock = _createLock();
                lock._isInitialized = true;
                return lock.create();
            };

            expect(wrapper).to.throw(error);
        });

        it('should return a promise when invoked', () => {
            const lock = _createLock();

            const ret = lock.create();

            expect(ret).to.be.an('object');
            expect(ret.then).to.be.a('function');
        });

        it('should create a new lock file with default values', () => {
            const lockDir = _testValues.getString('lockDir');
            const lockFile = _path.join(lockDir, LOCK_FILE_NAME);
            const lock = _createLock(lockDir);
            const writeFileMethod = _fsMock.mocks.writeFile;
            const license = {
                components: new Array(10).fill(0).map(() => ({
                    releaseName: _testValues.getString('releaseName'),
                    chartName: _testValues.getString('chartName'),
                    namespace: _testValues.getString('namespace'),
                    repoUriList: new Array(3)
                        .fill(0)
                        .map((item, index) =>
                            _testValues.getString(`repo_${index}`)
                        ),
                    setOptions: new Array(3).fill(0).map((item, index) => ({
                        key: _testValues.getString(`key_${index}`),
                        value: _testValues.getString(`value_${index}`)
                    }))
                }))
            };
            const startTime = Date.now();

            expect(writeFileMethod.stub).to.not.have.been.called;

            lock.create(license);

            expect(writeFileMethod.stub).to.have.been.calledOnce;
            expect(writeFileMethod.stub.args[0]).to.have.length(4);

            expect(writeFileMethod.stub.args[0][0]).to.equal(lockFile);

            const payload = JSON.parse(writeFileMethod.stub.args[0][1]);
            expect(payload).to.be.an('object');
            expect(payload).to.have.all.keys([
                'lockId',
                'state',
                'license',
                'logs'
            ]);
            expect(payload.lockId).to.be.a('string').and.to.not.be.empty;
            expect(payload.state).to.equal('ACTIVE');
            expect(payload.license).to.deep.equal(license);

            const logs = payload.logs;
            expect(logs).to.be.an('array');
            expect(logs).to.have.length(1);
            expect(logs[0]).to.be.an('object');
            expect(logs[0].kind).to.equal('log');
            expect(logs[0].message).to.equal('Lock created');
            expect(logs[0].timestamp).to.be.within(startTime, Date.now());

            expect(writeFileMethod.stub.args[0][2]).to.deep.equal({
                flag: 'wx'
            });

            expect(writeFileMethod.stub.args[0][3]).to.be.a('function');
        });

        it('should reject the promise if the lock file creation fails', () => {
            const error = 'Error writing to lock file';
            const lock = _createLock();
            const writeFileMethod = _fsMock.mocks.writeFile;

            const ret = lock.create({});
            const callback = writeFileMethod.stub.args[0][3];
            callback({
                code: 'ESOMETHINGWENTWRONG'
            });

            return expect(ret).to.be.rejectedWith(LockWriteError, error);
        });

        it('should resolve the promise if the lock file creation succeeds', () => {
            const lock = _createLock();
            const writeFileMethod = _fsMock.mocks.writeFile;

            const ret = lock.create({});
            const callback = writeFileMethod.stub.args[0][3];
            callback();

            return expect(ret).to.be.fulfilled;
        });
    });
});
