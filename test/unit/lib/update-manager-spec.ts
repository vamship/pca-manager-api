import _chai from 'chai';
import _chaiAsPromised from 'chai-as-promised';
import 'mocha';
import _sinon from 'sinon';
import _sinonChai from 'sinon-chai';

_chai.use(_chaiAsPromised);
_chai.use(_sinonChai);
const expect = _chai.expect;

import _rewire from 'rewire';

import {
    asyncHelper as _asyncHelper,
    ObjectMock,
    testValues as _testValues
} from '@vamship/test-utils';

import { Promise } from 'bluebird';
import _dotProp from 'dot-prop';

const _updateManagerModule = _rewire('../../../src/lib/update-manager');
const _updateManager = _updateManagerModule.default;

describe('[updateManager]', () => {
    let _configMock;
    let _isomorphicFetchMock;
    let _licenseMock;
    let _lockMock;
    let _softwareUpdaterJobMock;

    beforeEach(() => {
        _configMock = new ObjectMock().addMock('get', (key) =>
            _dotProp.get(_configMock.__data, key)
        );
        _configMock.__data = {
            app: {
                lockDir: _testValues.getString('lockDir'),
                licenseDir: _testValues.getString('licenseDir'),
                stsEndpoint: _testValues.getString('stsEndpoint'),
                serverApiKey: _testValues.getString('serverApiKey'),
                job: {
                    callbackEndpoint: _testValues.getString('callbackEndpoint'),
                    credentialProviderEndpoint: _testValues.getString(
                        'credentialProviderEndpoint'
                    )
                }
            }
        };

        _isomorphicFetchMock = new ObjectMock()
            .addPromiseMock('fetch')
            .addPromiseMock('json');
        _isomorphicFetchMock.__data = {
            stsResponse: {
                token: _testValues.getString('token')
            }
        };

        _licenseMock = new ObjectMock()
            .addPromiseMock('load')
            .addPromiseMock('save')
            .addMock('setData')
            .addMock('generateUpdateManifest', () => {
                return _licenseMock.__updateManifest;
            });
        _licenseMock.__updateManifest = {
            foo: _testValues.getString('foo')
        };

        _lockMock = new ObjectMock()
            .addPromiseMock('create')
            .addPromiseMock('init')
            .addPromiseMock('updateState')
            .addPromiseMock('cleanup');
        _lockMock.instance.lockId = _testValues.getString('lockId');

        _softwareUpdaterJobMock = new ObjectMock()
            .addPromiseMock('start')
            .addPromiseMock('cleanup');

        _updateManagerModule.__set__('_lock', undefined);

        _updateManagerModule.__set__('isomorphic_fetch_1', {
            default: _isomorphicFetchMock.instance.fetch
        });

        _updateManagerModule.__set__('config_1', {
            default: {
                getConfig: () => _configMock.instance
            }
        });

        _updateManagerModule.__set__('lock_1', {
            default: _lockMock.ctor
        });

        _updateManagerModule.__set__('license_1', {
            default: _licenseMock.ctor
        });

        _updateManagerModule.__set__('software_updater_job_1', {
            default: _softwareUpdaterJobMock.ctor
        });
    });

    describe('[init]', () => {
        it('should expose the expected properties and methods', () => {
            expect(_updateManager).to.be.an('object');
            expect(_updateManager.launchUpdate).to.be.a('function');
            expect(_updateManager.notify).to.be.a('function');
        });
    });

    describe('launchUpdate()', () => {
        enum Tasks {
            LOAD_LICENSE = 1,
            FETCH_CREDS = 2,
            PARSE_CREDS = 3,
            CREATE_LOCK = 4,
            INIT_LOCK = 5,
            START_JOB = 6,
            UPDATE_STATE = 7
        }

        function _runUntilTask(depth: Tasks): Promise<any> {
            const loadMethod = _licenseMock.mocks.load;
            const fetchMethod = _isomorphicFetchMock.mocks.fetch;
            const jsonMethod = _isomorphicFetchMock.mocks.json;
            const createMethod = _lockMock.mocks.create;
            const initMethod = _lockMock.mocks.init;
            const updateStateMethod = _lockMock.mocks.updateState;
            const startJobMethod = _softwareUpdaterJobMock.mocks.start;

            const fetchResponse = { json: _isomorphicFetchMock.instance.json };
            const softwareUpdaterToken =
                _isomorphicFetchMock.__data.stsResponse;

            const actions = [
                () => loadMethod.resolve(),
                () =>
                    loadMethod
                        .promise()
                        .then(() => fetchMethod.resolve(fetchResponse)),
                () =>
                    fetchMethod
                        .promise()
                        .then(() => jsonMethod.resolve(softwareUpdaterToken)),
                () => jsonMethod.promise().then(() => createMethod.resolve()),
                () => createMethod.promise().then(() => initMethod.resolve()),
                () => initMethod.promise().then(() => startJobMethod.resolve()),
                () =>
                    startJobMethod
                        .promise()
                        .then(() => updateStateMethod.resolve())
            ];

            return actions
                .reduce((result, action, index) => {
                    if (index < depth) {
                        return action();
                    } else {
                        return result;
                    }
                }, Promise.resolve())
                .then(_asyncHelper.wait(1));
        }

        it('should throw an error if invoked without valid licenseData', () => {
            const inputs = _testValues.allButObject();
            const error = 'Invalid licenseData (arg #1)';

            inputs.forEach((licenseData) => {
                const wrapper = () => {
                    return _updateManager.launchUpdate(licenseData);
                };

                expect(wrapper).to.throw(error);
            });
        });

        it('should return a promise when invoked', () => {
            const ret = _updateManager.launchUpdate({});

            expect(ret).to.be.an('object');
            expect(ret.then).to.be.a('function');
        });

        it('should instantiate a new license object with the specified license data', () => {
            const licenseCtor = _licenseMock.ctor;
            const licenseDir = _testValues.getString('licenseDir');
            _configMock.__data.app.licenseDir = licenseDir;

            expect(licenseCtor).to.not.have.been.called;

            _updateManager.launchUpdate({});

            expect(licenseCtor).to.have.been.calledOnce;
            expect(licenseCtor).to.have.been.calledWithNew;
            expect(licenseCtor).to.have.been.calledWithExactly(licenseDir);
        });

        it('should load license data from the file system', () => {
            const loadMethod = _licenseMock.mocks.load;

            expect(loadMethod.stub).to.not.have.been.called;

            _updateManager.launchUpdate({});

            expect(loadMethod.stub).to.have.been.calledOnce;
            expect(loadMethod.stub).to.have.been.calledWithExactly();
        });

        it('should reject the promise if the load method fails', () => {
            const loadMethod = _licenseMock.mocks.load;
            const ret = _updateManager.launchUpdate({});
            const error = 'something went wrong!';

            loadMethod.reject(error);

            return expect(ret).to.be.rejectedWith(error);
        });

        it('should make an HTTP request to obtain the software update token', () => {
            const fetchMethod = _isomorphicFetchMock.mocks.fetch;

            const stsEndpoint = _testValues.getString('stsEndpoint');
            const serverApiKey = _testValues.getString('serverApiKey');

            _configMock.__data.app.stsEndpoint = stsEndpoint;
            _configMock.__data.app.serverApiKey = serverApiKey;

            expect(fetchMethod.stub).to.not.have.been.called;

            _updateManager.launchUpdate({});

            return _runUntilTask(Tasks.LOAD_LICENSE).then(() => {
                expect(fetchMethod.stub).to.have.been.calledOnce;
                expect(fetchMethod.stub.args[0][0]).to.equal(stsEndpoint);
                expect(fetchMethod.stub.args[0][1]).to.deep.equal({
                    method: 'GET',
                    headers: {
                        'content-type': 'application/json',
                        authorization: serverApiKey
                    }
                });
            });
        });

        it('should reject the promise if the fetch fails', () => {
            const fetchMethod = _isomorphicFetchMock.mocks.fetch;
            const error = 'Error fetching software update token';

            const ret = _updateManager.launchUpdate({});

            _runUntilTask(Tasks.LOAD_LICENSE).then(() =>
                fetchMethod.reject('something went wrong!').catch((ex) => {
                    // Eat this error. We are checking for rejection later.
                })
            );

            return expect(ret).to.be.rejectedWith(error);
        });

        it('should parse the response from the fetch call', () => {
            const jsonMethod = _isomorphicFetchMock.mocks.json;

            _updateManager.launchUpdate({});

            expect(jsonMethod.stub).to.not.have.been.called;

            return _runUntilTask(Tasks.FETCH_CREDS).then(() => {
                expect(jsonMethod.stub).to.have.been.calledOnce;
                expect(jsonMethod.stub).to.have.been.calledWithExactly();
            });
        });

        it('should reject the promise if the response from the STS cannot be parsed', () => {
            const jsonMethod = _isomorphicFetchMock.mocks.json;
            const error = 'Error parsing software update token';

            const ret = _updateManager.launchUpdate({});

            _runUntilTask(Tasks.FETCH_CREDS).then(() =>
                jsonMethod.reject('something went wrong!').catch((ex) => {
                    // Eat this error. We are checking for rejection later.
                })
            );

            return expect(ret).to.be.rejectedWith(error);
        });

        it('should not create a new lock if a lock reference already exists', () => {
            const lockCtor = _lockMock.ctor;

            const lock = new lockCtor();
            lockCtor.resetHistory();

            _updateManagerModule.__set__('_lock', lock);

            _updateManager.launchUpdate({});

            return _runUntilTask(Tasks.PARSE_CREDS).then(() => {
                expect(lockCtor).to.not.have.been.called;
            });
        });

        it('should create a new lock if a lock reference does not already exist', () => {
            const lockCtor = _lockMock.ctor;

            const lockDir = _testValues.getString('lockDir');
            _configMock.__data.app.lockDir = lockDir;

            _updateManager.launchUpdate({});

            expect(lockCtor).to.not.have.been.called;

            return _runUntilTask(Tasks.PARSE_CREDS).then(() => {
                expect(lockCtor).to.have.been.calledOnce;
                expect(lockCtor).to.have.been.calledWithExactly(lockDir);
            });
        });

        it('should attempt to create a lock object on the file system', () => {
            const createMethod = _lockMock.mocks.create;

            const licenseData = {
                foo: _testValues.getString('foo')
            };

            _updateManager.launchUpdate(licenseData);

            expect(createMethod.stub).to.not.have.been.called;

            return _runUntilTask(Tasks.PARSE_CREDS).then(() => {
                expect(createMethod.stub).to.have.been.calledOnce;
                expect(createMethod.stub).to.have.been.calledWithExactly(
                    licenseData
                );
            });
        });

        it('should reject the promise if lock creation fails', () => {
            const createMethod = _lockMock.mocks.create;
            const error = 'something went wrong!';

            const ret = _updateManager.launchUpdate({});

            _runUntilTask(Tasks.PARSE_CREDS).then(() => {
                createMethod.reject(error).catch((ex) => {
                    // Eat this error. We are checking for rejection later.
                });
            });

            return expect(ret).to.be.rejectedWith(error);
        });

        it('should initialize the lock object if creation was successful', () => {
            const initMethod = _lockMock.mocks.init;

            _updateManager.launchUpdate({});

            expect(initMethod.stub).to.not.have.been.called;

            return _runUntilTask(Tasks.CREATE_LOCK).then(() => {
                expect(initMethod.stub).to.have.been.calledOnce;
                expect(initMethod.stub).to.have.been.calledWithExactly();
            });
        });

        it('should reject the promise if lock init fails', () => {
            const initMethod = _lockMock.mocks.init;
            const error = 'something went wrong!';

            const ret = _updateManager.launchUpdate({});

            _runUntilTask(Tasks.CREATE_LOCK).then(() => {
                initMethod.reject(error).catch((ex) => {
                    // Eat this error. We are checking for rejection later.
                });
            });

            return expect(ret).to.be.rejectedWith(error);
        });

        it('should generate an update job manifest based on new and old licenses if create succeeds', () => {
            const generateUpdateManifestMethod =
                _licenseMock.mocks.generateUpdateManifest;
            const licenseData = {
                foo: _testValues.getString('foo')
            };

            _updateManager.launchUpdate(licenseData);

            expect(generateUpdateManifestMethod.stub).to.not.have.been.called;
            return _runUntilTask(Tasks.INIT_LOCK).then(() => {
                expect(generateUpdateManifestMethod.stub).to.have.been
                    .calledOnce;
                expect(
                    generateUpdateManifestMethod.stub
                ).to.have.been.calledWithExactly(licenseData);
            });
        });

        it('should create a new software updater job with the generated update manifest', () => {
            const softwareUpdaterJobCtor = _softwareUpdaterJobMock.ctor;

            const manifest = {
                foo: _testValues.getString('foo')
            };
            const lockId = _testValues.getString('lockId');
            const callbackEndpoint = _testValues.getString('callbackEndpoint');
            const credentialProviderEndpoint = _testValues.getString(
                'credentialProviderEndpoint'
            );
            const stsResponse = {
                token: _testValues.getString('token')
            };

            _configMock.__data.app.job.callbackEndpoint = callbackEndpoint;
            _configMock.__data.app.job.credentialProviderEndpoint = credentialProviderEndpoint;

            _licenseMock.__updateManifest = manifest;

            _isomorphicFetchMock.__data.stsResponse = stsResponse;

            _lockMock.instance.lockId = lockId;

            _updateManager.launchUpdate({});

            expect(softwareUpdaterJobCtor).to.not.have.been.called;

            return _runUntilTask(Tasks.INIT_LOCK).then(() => {
                expect(softwareUpdaterJobCtor).to.have.been.calledOnce;
                expect(softwareUpdaterJobCtor).to.have.been.calledWithNew;
                expect(softwareUpdaterJobCtor.args[0]).to.have.length(1);

                const descriptor = softwareUpdaterJobCtor.args[0][0];
                expect(descriptor).to.deep.equal({
                    callbackEndpoint: `${callbackEndpoint}/${lockId}`,
                    credentialProviderEndpoint,
                    credentialProviderAuthToken: stsResponse.token,
                    manifest
                });
            });
        });

        it('should launch the software updater job', () => {
            const startJobMethod = _softwareUpdaterJobMock.mocks.start;

            _updateManager.launchUpdate({});

            expect(startJobMethod.stub).to.not.have.been.called;

            return _runUntilTask(Tasks.INIT_LOCK).then(() => {
                expect(startJobMethod.stub).to.have.been.calledOnce;
                expect(startJobMethod.stub).to.have.been.calledWithExactly();
            });
        });

        it('should reject the promise if the software update job start fails', () => {
            const startJobMethod = _softwareUpdaterJobMock.mocks.start;
            const error = 'something went wrong!';

            const ret = _updateManager.launchUpdate({});

            _runUntilTask(Tasks.INIT_LOCK).then(() => {
                startJobMethod.reject(error).catch((ex) => {
                    // Eat this error. We are checking for rejection later.
                });
            });

            return expect(ret).to.be.rejectedWith(error);
        });

        it('should update the lock state to reflect job start if the job starts successfully', () => {
            const updateStateMethod = _lockMock.mocks.updateState;

            _updateManager.launchUpdate({});

            expect(updateStateMethod.stub).to.not.have.been.called;

            return _runUntilTask(Tasks.START_JOB).then(() => {
                expect(updateStateMethod.stub).to.have.been.calledOnce;
                expect(updateStateMethod.stub).to.have.been.calledWithExactly(
                    'RUNNING'
                );
            });
        });

        it('should reject the promise if the updateState method fails', () => {
            const updateStateMethod = _lockMock.mocks.updateState;
            const error = 'something went wrong!';

            const ret = _updateManager.launchUpdate({});

            _runUntilTask(Tasks.START_JOB).then(() => {
                updateStateMethod.reject(error);
            });

            return expect(ret).to.be.rejectedWith(error);
        });

        it('should resolve the promise if the updateState method succeeds', () => {
            const ret = _updateManager.launchUpdate({});

            _runUntilTask(Tasks.UPDATE_STATE);
            return expect(ret).to.be.fulfilled;
        });
    });

    describe('notify()', () => {
        function _invokeNotify(
            kind: string = 'log',
            timestamp: number = Date.now(),
            message: string = _testValues.getString('message')
        ) {
            return _updateManager.notify(kind, timestamp, message);
        }

        function _initLock(
            isReady: boolean = false,
            state: string = 'RUNNING'
        ) {
            const lockCtor = _lockMock.ctor;
            const lock = new lockCtor();
            lock.isReady = isReady;
            lock.state = state;
            _updateManagerModule.__set__('_lock', lock);

            return lock;
        }

        enum Tasks {
            INIT_LOCK = 1,
            SAVE_LICENSE = 2,
            UPDATE_STATE = 3,
            CLEANUP_LOCK = 4
        }

        function _runUntilTask(depth: Tasks): Promise<any> {
            const initMethod = _lockMock.mocks.init;
            const saveMethod = _licenseMock.mocks.save;
            const updateStateMethod = _lockMock.mocks.updateState;
            const cleanupMethod = _lockMock.mocks.cleanup;

            const actions = [
                () => initMethod.resolve(),
                () => initMethod.promise().then(() => saveMethod.resolve()),
                () =>
                    initMethod
                        .promise()
                        .then(() => updateStateMethod.resolve()),
                () =>
                    updateStateMethod
                        .promise()
                        .then(() => cleanupMethod.resolve())
            ];

            return actions
                .reduce((result, action, index) => {
                    if (index < depth) {
                        return action();
                    } else {
                        return result;
                    }
                }, Promise.resolve())
                .then(_asyncHelper.wait(1));
        }

        it('should throw an error if invoked without a valid kind', () => {
            const inputs = _testValues.allButString('foo', 'bar');
            const error = 'Invalid kind (arg #1)';

            inputs.forEach((kind) => {
                const wrapper = () => {
                    return _updateManager.notify(kind);
                };

                expect(wrapper).to.throw(error);
            });
        });

        it('should throw an error if invoked without a valid timestamp', () => {
            const inputs = _testValues.allButNumber(0, -1);
            const error = 'Invalid timestamp (arg #2)';

            inputs.forEach((timestamp) => {
                const wrapper = () => {
                    const kind = 'log';
                    return _updateManager.notify(kind, timestamp);
                };

                expect(wrapper).to.throw(error);
            });
        });

        it('should throw an error if invoked without a valid message', () => {
            const inputs = _testValues.allButString('');
            const error = 'Invalid message (arg #3)';

            inputs.forEach((message) => {
                const wrapper = () => {
                    const kind = 'log';
                    const timestamp = Date.now();
                    return _updateManager.notify(kind, timestamp, message);
                };

                expect(wrapper).to.throw(error);
            });
        });

        it('should return a promise when invoked', () => {
            const ret = _invokeNotify();

            expect(ret).to.be.an('object');
            expect(ret.then).to.be.a('function');
        });

        describe('[log messages]', () => {
            it('should resolve the promise if the message has kind=log', () => {
                const licenseCtor = _licenseMock.ctor;
                const lockCtor = _lockMock.ctor;

                expect(licenseCtor).to.not.have.been.called;
                expect(lockCtor).to.not.have.been.called;

                const ret = _invokeNotify('log');

                return expect(ret).to.be.fulfilled.then(() => {
                    expect(licenseCtor).to.not.have.been.called;
                    expect(lockCtor).to.not.have.been.called;
                });
            });
        });

        it('should not create a new lock if a lock reference already exists', () => {
            const lockCtor = _lockMock.ctor;

            const lock = new lockCtor();
            lockCtor.resetHistory();

            _updateManagerModule.__set__('_lock', lock);

            _invokeNotify('success');

            expect(lockCtor).to.not.have.been.called;
        });

        it('should create a new lock if a lock reference does not already exist', () => {
            const lockCtor = _lockMock.ctor;

            const lockDir = _testValues.getString('lockDir');
            _configMock.__data.app.lockDir = lockDir;

            expect(lockCtor).to.not.have.been.called;

            _invokeNotify('success');

            expect(lockCtor).to.have.been.calledOnce;
            expect(lockCtor).to.have.been.calledWithExactly(lockDir);
        });

        it('should not initialize the lock if the lock is already ready', () => {
            const initMethod = _lockMock.mocks.init;
            _initLock(true);

            expect(initMethod.stub).to.not.have.been.called;

            _invokeNotify('success');

            return _asyncHelper
                .wait(1)()
                .then(() => {
                    expect(initMethod.stub).to.not.have.been.called;
                });
        });

        it('should initialize the lock if the lock is not ready', () => {
            const initMethod = _lockMock.mocks.init;

            _initLock();

            expect(initMethod.stub).to.not.have.been.called;

            _invokeNotify('success');

            return _asyncHelper
                .wait(1)()
                .then(() => {
                    expect(initMethod.stub).to.have.been.calledOnce;
                    expect(initMethod.stub).to.have.been.calledWithExactly();
                });
        });

        it('should reject the promise if the init method fails', () => {
            const initMethod = _lockMock.mocks.init;
            const error = 'something went wrong!';

            const ret = _invokeNotify('success');

            initMethod.reject(error);

            return expect(ret).to.be.rejectedWith(error);
        });

        it('should reject the promise if the lock is not in running state', () => {
            const initMethod = _lockMock.mocks.init;
            const inputs = ['success', 'fail']
                .map((kind) =>
                    ['READY', 'DONE', 'ERROR'].map((state) => ({ kind, state }))
                )
                .reduce((list, item) => list.concat(item), []);

            const result = Promise.mapSeries(
                inputs,
                ({ state, kind }, index) => {
                    const error = `Lock is not in RUNNING state. Current state: [${state}]`;
                    _initLock(false, state);

                    const ret = _invokeNotify(kind);

                    return initMethod.resolve(undefined, index).then(() => {
                        return expect(ret).to.be.rejectedWith(error);
                    });
                }
            );

            return expect(result).to.be.fulfilled;
        });

        describe('[success messages]', () => {
            it('should create a new license object', () => {
                const licenseCtor = _licenseMock.ctor;
                const licenseDir = _testValues.getString('licenseDir');

                _configMock.__data.app.licenseDir = licenseDir;

                _initLock();

                expect(licenseCtor).to.not.have.been.called;

                _invokeNotify('success');

                _runUntilTask(Tasks.INIT_LOCK).then(() => {
                    expect(licenseCtor).to.have.been.calledOnce;
                    expect(licenseCtor).to.have.been.calledWithNew;
                    expect(licenseCtor).to.have.been.calledWithExactly(
                        licenseDir
                    );
                });
            });

            it('should update the license data with data from the current lock', () => {
                const setDataMethod = _licenseMock.mocks.setData;
                const lock = _initLock();
                const lockManifest = {
                    foo: _testValues.getString('foo')
                };

                lock.license = lockManifest;

                expect(setDataMethod.stub).to.not.have.been.called;

                _invokeNotify('success');

                _runUntilTask(Tasks.INIT_LOCK).then(() => {
                    expect(setDataMethod.stub).to.have.been.calledOnce;
                    expect(setDataMethod.stub).to.have.been.calledWithExactly(
                        lockManifest
                    );
                });
            });

            it('should save the license file to disk', () => {
                const saveMethod = _licenseMock.mocks.save;

                _initLock();

                expect(saveMethod.stub).to.not.have.been.called;

                _invokeNotify('success');

                _runUntilTask(Tasks.INIT_LOCK).then(() => {
                    expect(saveMethod.stub).to.have.been.calledOnce;
                    expect(saveMethod.stub).to.have.been.calledWithExactly();
                });
            });

            it('should reject the promise if license save fails', () => {
                const saveMethod = _licenseMock.mocks.save;
                const error = 'something went wrong!';

                _initLock();

                const ret = _invokeNotify('success');

                _runUntilTask(Tasks.INIT_LOCK).then(() => {
                    saveMethod.reject(error);
                });

                return expect(ret).to.be.rejectedWith(error);
            });

            it('should update the lock state to "DONE"', () => {
                const updateStateMethod = _lockMock.mocks.updateState;

                _initLock();

                expect(updateStateMethod.stub).to.not.have.been.called;

                _invokeNotify('success');

                return _runUntilTask(Tasks.SAVE_LICENSE).then(() => {
                    expect(updateStateMethod.stub).to.have.been.calledOnce;
                    expect(
                        updateStateMethod.stub
                    ).to.have.been.calledWithExactly('DONE');
                });
            });

            it('should reject the promise if the update state call fails', () => {
                const updateStateMethod = _lockMock.mocks.updateState;
                const error = 'something went wrong!';

                _initLock();

                const ret = _invokeNotify('success');

                _runUntilTask(Tasks.SAVE_LICENSE).then(() => {
                    updateStateMethod.reject(error);
                });

                return expect(ret).to.be.rejectedWith(error);
            });
        });

        describe('[fail messages]', () => {
            it('should not create a new license object', () => {
                const licenseCtor = _licenseMock.ctor;
                const setDataMethod = _licenseMock.mocks.setData;
                const saveMethod = _licenseMock.mocks.save;

                _initLock();

                expect(licenseCtor).to.not.have.been.called;
                expect(setDataMethod.stub).to.not.have.been.called;
                expect(saveMethod.stub).to.not.have.been.called;

                _invokeNotify('fail');

                return _runUntilTask(Tasks.INIT_LOCK).then(() => {
                    expect(licenseCtor).to.not.have.been.called;
                    expect(setDataMethod.stub).to.not.have.been.called;
                    expect(saveMethod.stub).to.not.have.been.called;
                });
            });

            it('should update the lock state to "ERROR"', () => {
                const updateStateMethod = _lockMock.mocks.updateState;

                _initLock();

                expect(updateStateMethod.stub).to.not.have.been.called;

                _invokeNotify('fail');

                return _runUntilTask(Tasks.SAVE_LICENSE).then(() => {
                    expect(updateStateMethod.stub).to.have.been.calledOnce;
                    expect(
                        updateStateMethod.stub
                    ).to.have.been.calledWithExactly('ERROR');
                });
            });

            it('should reject the promise if the update state call fails', () => {
                const updateStateMethod = _lockMock.mocks.updateState;
                const error = 'something went wrong!';

                _initLock();

                const ret = _invokeNotify('fail');

                _runUntilTask(Tasks.SAVE_LICENSE).then(() => {
                    updateStateMethod.reject(error);
                });

                return expect(ret).to.be.rejectedWith(error);
            });
        });

        it('should clean up the lock file once processing is complete', () => {
            const cleanupMethod = _lockMock.mocks.cleanup;

            _initLock();

            _invokeNotify('success');

            expect(cleanupMethod.stub).to.not.have.been.called;

            return _runUntilTask(Tasks.UPDATE_STATE).then(() => {
                expect(cleanupMethod.stub).to.have.been.calledOnce;
                expect(cleanupMethod.stub).to.have.been.calledWithExactly();
            });
        });

        it('should reject the promise if cleanup fails', () => {
            const cleanupMethod = _lockMock.mocks.cleanup;
            const error = 'something went wrong!';

            _initLock();

            const ret = _invokeNotify('success');

            _runUntilTask(Tasks.UPDATE_STATE).then(() => {
                cleanupMethod.reject(error);
            });

            return expect(ret).to.be.rejectedWith(error);
        });

        it('should resolve the promise if cleanup succeeds', () => {
            _initLock();

            const ret = _invokeNotify('success');

            _runUntilTask(Tasks.CLEANUP_LOCK);

            return expect(ret).to.be.fulfilled;
        });
    });
});
