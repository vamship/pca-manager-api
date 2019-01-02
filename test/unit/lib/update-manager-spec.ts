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

import { IJobMessage } from '../../../src/lib/types';

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
                excludePatterns: new Array(3)
                    .fill(0)
                    .map(() => _testValues.getString('excludePattern'))
                    .join(','),
                lockDir: _testValues.getString('lockDir'),
                stsEndpoint: _testValues.getString('stsEndpoint'),
                serverApiKey: _testValues.getString('serverApiKey'),
                callbackEndpoint: _testValues.getString('callbackEndpoint'),
                credentialProviderEndpoint: _testValues.getString(
                    'credentialProviderEndpoint'
                ),
                updateAgentContainer: _testValues.getString(
                    'updateAgentContainer'
                )
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
            .addMock('generateUpdateManifest', () => {
                return _licenseMock.__updateManifest;
            });
        _licenseMock.__updateManifest = {
            foo: _testValues.getString('foo')
        };

        _lockMock = new ObjectMock()
            .addPromiseMock('create')
            .addPromiseMock('init')
            .addPromiseMock('save')
            .addPromiseMock('cleanup')
            .addMock('addLog')
            .addMock(
                'updateState',
                (state) => (_lockMock.instance.state = state)
            );
        _lockMock.instance.lockId = _testValues.getString('lockId');

        _softwareUpdaterJobMock = new ObjectMock()
            .addPromiseMock('start')
            .addPromiseMock('cleanup');

        _updateManagerModule.__set__('_lock', undefined);
        _updateManagerModule.__set__('_createPromise', Promise.resolve());
        _updateManagerModule.__set__('_notifyPromise', Promise.resolve());

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
            CLEANUP_LOCK = 0,
            CREATE_LOCK,
            INIT_LOCK,
            LOAD_LICENSE,
            FETCH_CREDS,
            PARSE_CREDS,
            START_JOB,
            END
        }

        function _runUntilTask(depth: Tasks): Promise<any> {
            const cleanupLockMethod = _lockMock.mocks.cleanup;
            const createMethod = _lockMock.mocks.create;
            const initMethod = _lockMock.mocks.init;
            const fetchMethod = _isomorphicFetchMock.mocks.fetch;
            const jsonMethod = _isomorphicFetchMock.mocks.json;
            const loadMethod = _licenseMock.mocks.load;
            const startJobMethod = _softwareUpdaterJobMock.mocks.start;

            const fetchResponse = { json: _isomorphicFetchMock.instance.json };
            const softwareUpdaterToken =
                _isomorphicFetchMock.__data.stsResponse;

            const actions = [
                () => cleanupLockMethod.resolve(),
                () => createMethod.resolve(),
                () => initMethod.resolve(),
                () => loadMethod.resolve(),
                () => fetchMethod.resolve(fetchResponse),
                () => jsonMethod.resolve(softwareUpdaterToken),
                () => startJobMethod.resolve()
            ];

            return actions
                .reduce((result, action, index) => {
                    if (index < depth) {
                        return result.then(action);
                    } else {
                        return result;
                    }
                }, Promise.resolve())
                .then(_asyncHelper.wait(1));
        }

        function _verifyCleanup(cleanupLockFile: boolean): () => void {
            return () => {
                const createPromise = _updateManagerModule.__get__(
                    '_createPromise'
                );
                const lockRef = _updateManagerModule.__get__('_lock');
                const cleanupLockMethod = _lockMock.mocks.cleanup;

                return expect(createPromise).to.be.fulfilled.then(() => {
                    expect(lockRef).to.be.undefined;
                    if (cleanupLockFile) {
                        expect(cleanupLockMethod.stub).to.have.been.calledOnce;
                        expect(
                            cleanupLockMethod.stub
                        ).to.have.been.calledWithExactly();
                    } else {
                        expect(cleanupLockMethod.stub).to.not.have.been.called;
                    }
                });
            };
        }

        it('should throw an error if a lock reference already exists', () => {
            const error = 'Cannot create lock. A lock already exists';
            const wrapper = () => {
                const lockCtor = _lockMock.ctor;

                const lock = new lockCtor();
                lockCtor.resetHistory();

                _updateManagerModule.__set__('_lock', lock);

                _updateManager.launchUpdate({});
            };

            expect(wrapper).to.throw(error);
        });

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

        it('should store a promise to represent the create flow', () => {
            const oldPromise = Promise.resolve();
            _updateManagerModule.__set__('_createPromise', oldPromise);

            const ret = _updateManager.launchUpdate({});

            const createPromise = _updateManagerModule.__get__(
                '_createPromise'
            );
            expect(createPromise).to.not.equal(ret);
            expect(createPromise).to.not.equal(oldPromise);
            expect(createPromise).to.be.an('object');
            expect(createPromise.then).to.be.a('function');
        });

        it('should create a new lock object', () => {
            const lockCtor = _lockMock.ctor;

            const lockDir = _testValues.getString('lockDir');
            _configMock.__data.app.lockDir = lockDir;

            expect(lockCtor).to.not.have.been.called;

            _updateManager.launchUpdate({});

            expect(lockCtor).to.have.been.calledOnce;
            expect(lockCtor).to.have.been.calledWithNew;
            expect(lockCtor).to.have.been.calledWithExactly(lockDir);
        });

        it('should attempt to create a lock object on the file system', () => {
            const createMethod = _lockMock.mocks.create;

            const licenseData = {
                foo: _testValues.getString('foo')
            };

            expect(createMethod.stub).to.not.have.been.called;

            _updateManager.launchUpdate(licenseData);

            expect(createMethod.stub).to.have.been.calledOnce;
            expect(createMethod.stub).to.have.been.calledWithExactly(
                licenseData
            );
        });

        it('should reject the promise and cleanup lock references if lock creation fails', () => {
            const createMethod = _lockMock.mocks.create;
            const error = 'something went wrong!';

            const ret = _updateManager.launchUpdate({});

            _runUntilTask(Tasks.CREATE_LOCK).then(() => {
                createMethod.reject(error).catch((ex) => {
                    // Eat this error. We are checking for rejection later.
                });
            });

            return expect(ret)
                .to.be.rejectedWith(error)
                .then(_verifyCleanup(false));
        });

        it('should initialize the lock object if creation was successful', () => {
            const initMethod = _lockMock.mocks.init;

            _updateManager.launchUpdate({});

            expect(initMethod.stub).to.not.have.been.called;

            return _runUntilTask(Tasks.INIT_LOCK).then(() => {
                expect(initMethod.stub).to.have.been.calledOnce;
                expect(initMethod.stub).to.have.been.calledWithExactly();
            });
        });

        it('should reject the promise if lock init fails', () => {
            const initMethod = _lockMock.mocks.init;
            const error = 'something went wrong!';

            const ret = _updateManager.launchUpdate({});

            _runUntilTask(Tasks.INIT_LOCK).then(() => {
                initMethod.reject(error).catch((ex) => {
                    // Eat this error. We are checking for rejection later.
                });
            });

            return expect(ret)
                .to.be.rejectedWith(error)
                .then(_verifyCleanup(true));
        });

        it('should instantiate a new license object with the specified license data', () => {
            const licenseCtor = _licenseMock.ctor;
            const excludedPatternString = '^excluded.* ,.*excluded$';

            _configMock.__data.app.excludePatterns = excludedPatternString;

            const expectedPatterns = excludedPatternString
                .split(',')
                .map((pattern) => pattern.trim());

            expect(licenseCtor).to.not.have.been.called;

            _updateManager.launchUpdate({});

            return _runUntilTask(Tasks.LOAD_LICENSE).then(() => {
                expect(licenseCtor).to.have.been.calledOnce;
                expect(licenseCtor).to.have.been.calledWithNew;
                expect(licenseCtor).to.have.been.calledWithExactly(
                    expectedPatterns
                );
            });
        });

        it('should load license data from the file system', () => {
            const loadMethod = _licenseMock.mocks.load;

            expect(loadMethod.stub).to.not.have.been.called;

            _updateManager.launchUpdate({});

            return _runUntilTask(Tasks.LOAD_LICENSE).then(() => {
                expect(loadMethod.stub).to.have.been.calledOnce;
                expect(loadMethod.stub).to.have.been.calledWithExactly();
            });
        });

        it('should reject the promise if the load method fails', () => {
            const loadMethod = _licenseMock.mocks.load;
            const ret = _updateManager.launchUpdate({});
            const error = 'something went wrong!';

            _runUntilTask(Tasks.LOAD_LICENSE).then(() => {
                loadMethod.reject(error).catch((ex) => {
                    // Eat this error. We are checking for rejection later.
                });
            });

            return expect(ret)
                .to.be.rejectedWith(error)
                .then(_verifyCleanup(true));
        });

        it('should make an HTTP request to obtain the software update token', () => {
            const fetchMethod = _isomorphicFetchMock.mocks.fetch;

            const stsEndpoint = _testValues.getString('stsEndpoint');
            const serverApiKey = _testValues.getString('serverApiKey');

            _configMock.__data.app.stsEndpoint = stsEndpoint;
            _configMock.__data.app.serverApiKey = serverApiKey;

            expect(fetchMethod.stub).to.not.have.been.called;

            _updateManager.launchUpdate({});

            return _runUntilTask(Tasks.FETCH_CREDS).then(() => {
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

            _runUntilTask(Tasks.FETCH_CREDS).then(() =>
                fetchMethod.reject('something went wrong!').catch((ex) => {
                    // Eat this error. We are checking for rejection later.
                })
            );

            return expect(ret)
                .to.be.rejectedWith(error)
                .then(_verifyCleanup(true));
        });

        it('should parse the response from the fetch call', () => {
            const jsonMethod = _isomorphicFetchMock.mocks.json;

            expect(jsonMethod.stub).to.not.have.been.called;

            _updateManager.launchUpdate({});

            return _runUntilTask(Tasks.PARSE_CREDS).then(() => {
                expect(jsonMethod.stub).to.have.been.calledOnce;
                expect(jsonMethod.stub).to.have.been.calledWithExactly();
            });
        });

        it('should reject the promise if the response from the STS cannot be parsed', () => {
            const jsonMethod = _isomorphicFetchMock.mocks.json;
            const error = 'Error parsing software update token';

            const ret = _updateManager.launchUpdate({});

            _runUntilTask(Tasks.PARSE_CREDS).then(() =>
                jsonMethod.reject('something went wrong!').catch((ex) => {
                    // Eat this error. We are checking for rejection later.
                })
            );

            return expect(ret)
                .to.be.rejectedWith(error)
                .then(_verifyCleanup(true));
        });

        it('should generate an update job manifest based on new and old licenses if create succeeds', () => {
            const generateUpdateManifestMethod =
                _licenseMock.mocks.generateUpdateManifest;
            const licenseData = {
                foo: _testValues.getString('foo')
            };

            expect(generateUpdateManifestMethod.stub).to.not.have.been.called;

            _updateManager.launchUpdate(licenseData);

            return _runUntilTask(Tasks.START_JOB).then(() => {
                expect(generateUpdateManifestMethod.stub).to.have.been
                    .calledOnce;
                expect(
                    generateUpdateManifestMethod.stub
                ).to.have.been.calledWithExactly(licenseData);
            });
        });

        it('should create a new software updater job with the lock id', () => {
            const softwareUpdaterJobCtor = _softwareUpdaterJobMock.ctor;
            const updateAgentContainer = _testValues.getString(
                'updateAgentContainer'
            );
            const lockId = _testValues.getString('lockId');

            _configMock.__data.app.updateAgentContainer = updateAgentContainer;

            _lockMock.instance.lockId = lockId;

            expect(softwareUpdaterJobCtor).to.not.have.been.called;

            _updateManager.launchUpdate({});

            return _runUntilTask(Tasks.START_JOB).then(() => {
                expect(softwareUpdaterJobCtor).to.have.been.calledOnce;
                expect(softwareUpdaterJobCtor).to.have.been.calledWithNew;
                expect(softwareUpdaterJobCtor).to.have.been.calledWithExactly(
                    lockId,
                    updateAgentContainer
                );
            });
        });

        it('should launch the software updater job generated update manifest', () => {
            const startJobMethod = _softwareUpdaterJobMock.mocks.start;

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

            _configMock.__data.app.callbackEndpoint = callbackEndpoint;
            _configMock.__data.app.credentialProviderEndpoint = credentialProviderEndpoint;

            _licenseMock.__updateManifest = manifest;

            _isomorphicFetchMock.__data.stsResponse = stsResponse;

            _lockMock.instance.lockId = lockId;

            expect(startJobMethod.stub).to.not.have.been.called;

            _updateManager.launchUpdate({});

            return _runUntilTask(Tasks.START_JOB).then(() => {
                expect(startJobMethod.stub).to.have.been.calledOnce;
                expect(startJobMethod.stub.args[0]).to.have.length(1);

                const descriptor = startJobMethod.stub.args[0][0];
                expect(descriptor).to.deep.equal({
                    callbackEndpoint: `${callbackEndpoint}/${lockId}`,
                    credentialProviderEndpoint,
                    credentialProviderAuthToken: stsResponse.token,
                    manifest
                });
            });
        });

        it('should reject the promise if the software update job start fails', () => {
            const startJobMethod = _softwareUpdaterJobMock.mocks.start;
            const error = 'something went wrong!';

            const ret = _updateManager.launchUpdate({});

            _runUntilTask(Tasks.START_JOB).then(() => {
                startJobMethod.reject(error).catch((ex) => {
                    // Eat this error. We are checking for rejection later.
                });
            });

            return expect(ret)
                .to.be.rejectedWith(error)
                .then(_verifyCleanup(true));
        });

        it('should resolve the promise if the job starts successfully', () => {
            const ret = _updateManager.launchUpdate({});

            _runUntilTask(Tasks.END);
            return expect(ret).to.be.fulfilled.then((response) => {
                const lockRef = _updateManagerModule.__get__('_lock');
                const cleanupLockMethod = _lockMock.mocks.cleanup;

                expect(lockRef).to.not.be.undefined;
                expect(cleanupLockMethod.stub).to.not.have.been.called;
                expect(response).to.deep.equal({
                    lockId: lockRef.lockId,
                    state: lockRef.state
                });
            });
        });
    });

    describe('notify()', () => {
        function _generateMessages(kinds: string[] = ['log']) {
            return new Array(10).fill(0).map((item, index) => ({
                kind: kinds[index % kinds.length],
                timestamp: _testValues.getTimestamp(),
                message: _testValues.getString('message')
            }));
        }

        function _invokeNotify(
            lockId: string = _testValues.getString('lockId'),
            messages?: IJobMessage[]
        ) {
            messages = messages || _generateMessages();
            return _updateManager.notify(lockId, messages);
        }

        function _initLock(state: string = 'ACTIVE') {
            const lockCtor = _lockMock.ctor;
            const lock = new lockCtor();
            lock.lockId = _testValues.getString('lockId');
            lock.isReady = true;
            lock.state = state;
            _updateManagerModule.__set__('_lock', lock);

            return lock;
        }

        enum Tasks {
            CREATE_FLOW = 0,
            NOTIFY_FLOW,
            INIT_LOCK,
            SAVE_LOCK,
            CLEANUP_LOCK,
            CLEANUP_JOB,
            END
        }

        function _runUntilTask(depth: Tasks): Promise<any> {
            const createFlowMethod = _flowMocks.mocks.createFlow;
            const notifyFlowMethod = _flowMocks.mocks.notifyFlow;
            const initMethod = _lockMock.mocks.init;
            const saveLockMethod = _lockMock.mocks.save;
            const cleanupLockMethod = _lockMock.mocks.cleanup;
            const cleanupJobMethod = _softwareUpdaterJobMock.mocks.cleanup;

            const actions = [
                () => createFlowMethod.resolve(),
                () => notifyFlowMethod.resolve(),
                () => initMethod.resolve(),
                () => saveLockMethod.resolve(),
                () => cleanupLockMethod.resolve(),
                () => cleanupJobMethod.resolve()
            ];

            return actions
                .reduce((result, action, index) => {
                    if (index < depth) {
                        return result.then(action);
                    } else {
                        return result;
                    }
                }, Promise.resolve())
                .then(_asyncHelper.wait(1));
        }

        function _verifyCleanup(expectCleanup: boolean): () => void {
            return () => {
                const notifyPromise = _updateManagerModule.__get__(
                    '_notifyPromise'
                );
                const lockRef = _updateManagerModule.__get__('_lock');
                const cleanupLockMethod = _lockMock.mocks.cleanup;
                const softwareUpdaterJobCtor = _softwareUpdaterJobMock.ctor;
                const cleanupJobMethod = _softwareUpdaterJobMock.mocks.cleanup;

                return expect(notifyPromise).to.be.fulfilled.then(() => {
                    if (expectCleanup) {
                        expect(cleanupLockMethod.stub).to.have.been.calledOnce;
                        expect(
                            cleanupLockMethod.stub
                        ).to.have.been.calledWithExactly();

                        expect(softwareUpdaterJobCtor).to.have.been.calledOnce;
                        expect(softwareUpdaterJobCtor).to.have.been
                            .calledWithNew;
                        expect(
                            softwareUpdaterJobCtor
                        ).to.have.been.calledWithExactly(
                            _lockMock.instance.lockId,
                            _configMock.__data.app.updateAgentContainer
                        );

                        expect(cleanupJobMethod.stub).to.have.been.calledOnce;
                        expect(
                            cleanupJobMethod.stub
                        ).to.have.been.calledWithExactly();

                        expect(lockRef).to.be.undefined;
                    } else {
                        expect(softwareUpdaterJobCtor).to.not.have.been.called;
                        expect(cleanupLockMethod.stub).to.not.have.been.called;
                        expect(cleanupJobMethod.stub).to.not.have.been.called;
                        expect(lockRef).to.not.be.undefined;
                    }
                });
            };
        }

        let _flowMocks;

        beforeEach(() => {
            // Dummy promises to represent on going create/notify flows
            _flowMocks = new ObjectMock()
                .addPromiseMock('createFlow')
                .addPromiseMock('notifyFlow');

            _updateManagerModule.__set__(
                '_createPromise',
                _flowMocks.mocks.createFlow.promise()
            );

            _updateManagerModule.__set__(
                '_notifyPromise',
                _flowMocks.mocks.notifyFlow.promise()
            );
        });

        it('should throw an error if invoked without a valid lockId', () => {
            const inputs = _testValues.allButString('');
            const error = 'Invalid lockId (arg #1)';

            inputs.forEach((lockId) => {
                const wrapper = () => {
                    return _updateManager.notify(lockId);
                };

                expect(wrapper).to.throw(error);
            });
        });

        it('should throw an error if invoked without valid messages', () => {
            const inputs = _testValues.allButArray();
            const error = 'Invalid messages (arg #2)';

            inputs.forEach((messages) => {
                const wrapper = () => {
                    const lockId = _testValues.getString('lockId');
                    return _updateManager.notify(lockId, messages);
                };

                expect(wrapper).to.throw(error);
            });
        });

        it('should throw an error if the messages have invalid values', () => {
            const inputs = _testValues.allButObject();
            const error = 'Messages contain invalid values';

            inputs.forEach((message) => {
                const wrapper = () => {
                    const lockId = _testValues.getString('lockId');
                    const messages = _generateMessages().map(() => message);
                    return _updateManager.notify(lockId, messages);
                };

                expect(wrapper).to.throw(error);
            });
        });

        it('should throw an error if the messages have an invalid kind', () => {
            const inputs = _testValues.allButString('foo', 'bar');
            const error = 'Invalid kind (message.kind)';

            inputs.forEach((kind) => {
                const wrapper = () => {
                    const lockId = _testValues.getString('lockId');
                    const messages = _generateMessages();
                    messages.forEach((message) => {
                        message.kind = kind;
                    });
                    return _updateManager.notify(lockId, messages);
                };

                expect(wrapper).to.throw(error);
            });
        });

        it('should throw an error if invoked without a valid timestamp', () => {
            const inputs = _testValues.allButNumber(0, -1);
            const error = 'Invalid timestamp (message.timestamp)';

            inputs.forEach((timestamp) => {
                const wrapper = () => {
                    const lockId = _testValues.getString('lockId');
                    const messages = _generateMessages();
                    messages.forEach((message) => {
                        message.timestamp = timestamp;
                    });
                    return _updateManager.notify(lockId, messages);
                };

                expect(wrapper).to.throw(error);
            });
        });

        it('should throw an error if invoked without a valid message', () => {
            const inputs = _testValues.allButString('');
            const error = 'Invalid message (message.message)';

            inputs.forEach((message) => {
                const wrapper = () => {
                    const lockId = _testValues.getString('lockId');
                    const messages = _generateMessages();
                    messages.forEach((messageRecord) => {
                        messageRecord.message = message;
                    });
                    return _updateManager.notify(lockId, messages);
                };

                expect(wrapper).to.throw(error);
            });
        });

        it('should return a promise when invoked', () => {
            const ret = _invokeNotify();

            expect(ret).to.be.an('object');
            expect(ret.then).to.be.a('function');
        });

        it('should wait until any pending create or notify operations are completed', () => {
            const createFlowMethod = _flowMocks.mocks.createFlow;
            const notifyFlowMethod = _flowMocks.mocks.notifyFlow;

            const notifyFlowPromise = notifyFlowMethod.promise();

            const ret = _invokeNotify();

            return _asyncHelper
                .wait(10)()
                .then(() => {
                    expect(ret.isPending()).to.be.true;
                    expect(notifyFlowPromise).to.equal(notifyFlowPromise);
                    return createFlowMethod.resolve();
                })
                .then(() => {
                    expect(ret.isPending()).to.be.true;
                    expect(notifyFlowPromise).to.equal(notifyFlowPromise);
                    return notifyFlowMethod.resolve();
                })
                .then(() => {
                    const notifyPromise = _updateManagerModule.__get__(
                        '_notifyPromise'
                    );
                    expect(notifyPromise).to.not.equal(ret);
                    expect(notifyPromise).to.not.equal(notifyFlowPromise);
                    expect(notifyPromise).to.be.an('object');
                    expect(notifyPromise.then).to.be.a('function');
                });
        });

        it('should not create a new lock if a lock reference already exists', () => {
            const lockCtor = _lockMock.ctor;

            const lock = new lockCtor();
            lockCtor.resetHistory();

            _updateManagerModule.__set__('_lock', lock);

            _invokeNotify();

            return _runUntilTask(Tasks.INIT_LOCK).then(() => {
                expect(lockCtor).to.not.have.been.called;
            });
        });

        it('should create a new lock if a lock reference does not already exist', () => {
            const lockCtor = _lockMock.ctor;

            const lockDir = _testValues.getString('lockDir');
            _configMock.__data.app.lockDir = lockDir;

            expect(lockCtor).to.not.have.been.called;

            _invokeNotify();

            return _runUntilTask(Tasks.INIT_LOCK).then(() => {
                expect(lockCtor).to.have.been.calledOnce;
                expect(lockCtor).to.have.been.calledWithExactly(lockDir);
            });
        });

        it('should initialize the lock', () => {
            const initMethod = _lockMock.mocks.init;

            _initLock();

            _invokeNotify();

            expect(initMethod.stub).to.not.have.been.called;

            return _runUntilTask(Tasks.INIT_LOCK).then(() => {
                expect(initMethod.stub).to.have.been.calledOnce;
                expect(initMethod.stub).to.have.been.calledWithExactly();
            });
        });

        it('should reject the promise if the init method fails', () => {
            const initMethod = _lockMock.mocks.init;
            const error = 'something went wrong!';

            _initLock();

            const ret = _invokeNotify();

            _runUntilTask(Tasks.INIT_LOCK).then(() => {
                initMethod.reject(error).catch((ex) => {
                    // Eat this error. We are checking for rejection later.
                });
            });

            return expect(ret)
                .to.be.rejectedWith(error)
                .then(_verifyCleanup(false));
        });

        it('should reject the promise if the lock is not in ACTIVE state', () => {
            const cleanupLockMethod = _lockMock.mocks.cleanup;
            const cleanupJobMethod = _softwareUpdaterJobMock.mocks.cleanup;
            const state = 'ERROR';
            const error = `Lock is not ACTIVE. Current state: [${state}]`;

            const lock = _initLock(state);

            expect(cleanupLockMethod.stub).to.not.have.been.called;
            expect(cleanupJobMethod.stub).to.not.have.been.called;

            const ret = _invokeNotify(lock.lockId);

            _runUntilTask(Tasks.SAVE_LOCK).then(() => {
                cleanupLockMethod.resolve();
                cleanupJobMethod.resolve();
            });

            return expect(ret)
                .to.be.rejectedWith(error)
                .then(_verifyCleanup(true));
        });

        it('should handle cleanup lock errors gracefully', () => {
            const cleanupLockMethod = _lockMock.mocks.cleanup;
            const cleanupJobMethod = _softwareUpdaterJobMock.mocks.cleanup;
            const state = 'ERROR';
            const error = `Lock is not ACTIVE. Current state: [${state}]`;

            const lock = _initLock(state);

            expect(cleanupLockMethod.stub).to.not.have.been.called;

            const ret = _invokeNotify(lock.lockId);

            _runUntilTask(Tasks.SAVE_LOCK).then(() => {
                cleanupLockMethod.reject('someting went wrong!');
                cleanupJobMethod.resolve();
            });

            return expect(ret)
                .to.be.rejectedWith(error)
                .then(_verifyCleanup(true));
        });

        it('should handle cleanup job errors gracefully', () => {
            const cleanupLockMethod = _lockMock.mocks.cleanup;
            const cleanupJobMethod = _softwareUpdaterJobMock.mocks.cleanup;
            const state = 'ERROR';
            const error = `Lock is not ACTIVE. Current state: [${state}]`;

            const lock = _initLock(state);

            expect(cleanupLockMethod.stub).to.not.have.been.called;

            const ret = _invokeNotify(lock.lockId);

            _runUntilTask(Tasks.SAVE_LOCK).then(() => {
                cleanupJobMethod.reject('someting went wrong!');
                cleanupLockMethod.resolve();
            });

            return expect(ret)
                .to.be.rejectedWith(error)
                .then(_verifyCleanup(true));
        });

        it('should reject the promise if the lock id on the lock does not match the input lock id', () => {
            const error =
                'Lock id mismatch. Messages do not apply to current lock';

            _initLock();

            const differentLockId = _testValues.getString('lockId');
            const ret = _invokeNotify(differentLockId);

            _runUntilTask(Tasks.SAVE_LOCK);

            return expect(ret)
                .to.be.rejectedWith(error)
                .then(_verifyCleanup(false));
        });

        it('should update the log messages in the lock with each message', () => {
            const addLogMethod = _lockMock.mocks.addLog;

            const lock = _initLock();
            const messages = _generateMessages(['log']);

            expect(addLogMethod.stub).to.not.have.been.called;

            _invokeNotify(lock.lockId, messages);

            return _runUntilTask(Tasks.SAVE_LOCK).then(() => {
                expect(addLogMethod.stub).to.have.been.called;
                expect(addLogMethod.stub.callCount).to.equal(messages.length);
                messages.forEach((message, index) => {
                    expect(addLogMethod.stub.args[index][0]).to.deep.equal(
                        message
                    );
                });
            });
        });

        it('should update the state of the lock if the messages include "success" messages', () => {
            const updateStateMethod = _lockMock.mocks.updateState;
            const addLogMethod = _lockMock.mocks.addLog;

            const lock = _initLock();
            const message = {
                kind: 'success',
                timestamp: _testValues.getTimestamp(),
                message: _testValues.getString('message')
            };

            expect(addLogMethod.stub).to.not.have.been.called;
            expect(updateStateMethod.stub).to.not.have.been.called;

            _invokeNotify(lock.lockId, [message]);

            return _runUntilTask(Tasks.SAVE_LOCK).then(() => {
                expect(addLogMethod.stub).to.have.been.calledOnce;
                expect(addLogMethod.stub.args[0][0]).to.deep.equal(message);

                expect(updateStateMethod.stub).to.have.been.calledOnce;
                expect(updateStateMethod.stub).to.have.been.calledWithExactly(
                    'DONE'
                );
            });
        });

        it('should update the state of the lock if the messages include "fail" messages', () => {
            const updateStateMethod = _lockMock.mocks.updateState;
            const addLogMethod = _lockMock.mocks.addLog;

            const lock = _initLock();
            const message = {
                kind: 'fail',
                timestamp: _testValues.getTimestamp(),
                message: _testValues.getString('message')
            };

            expect(addLogMethod.stub).to.not.have.been.called;
            expect(updateStateMethod.stub).to.not.have.been.called;

            _invokeNotify(lock.lockId, [message]);

            return _runUntilTask(Tasks.SAVE_LOCK).then(() => {
                expect(addLogMethod.stub).to.have.been.calledOnce;
                expect(addLogMethod.stub.args[0][0]).to.deep.equal(message);

                expect(updateStateMethod.stub).to.have.been.calledOnce;
                expect(updateStateMethod.stub).to.have.been.calledWithExactly(
                    'ERROR'
                );
            });
        });

        it('should save the lock file after all messages have been processed', () => {
            const saveMethod = _lockMock.mocks.save;

            const lock = _initLock();
            const messages = _generateMessages(['log', 'success', 'fail']);

            expect(saveMethod.stub).to.not.have.been.called;

            _invokeNotify(lock.lockId, messages);

            return _runUntilTask(Tasks.SAVE_LOCK).then(() => {
                expect(saveMethod.stub).to.have.been.calledOnce;
                expect(saveMethod.stub).to.have.been.calledWithExactly();
            });
        });

        it('should reject the promise if the save method fails', () => {
            const saveMethod = _lockMock.mocks.save;
            const cleanupLockMethod = _lockMock.mocks.cleanup;
            const cleanupJobMethod = _softwareUpdaterJobMock.mocks.cleanup;
            const error = 'something went wrong!';

            const lock = _initLock();
            const messages = _generateMessages(['log', 'success', 'fail']);

            const ret = _invokeNotify(lock.lockId, messages);

            _runUntilTask(Tasks.SAVE_LOCK).then(() => {
                saveMethod.reject(error).catch((ex) => {
                    cleanupLockMethod.resolve();
                    cleanupJobMethod.resolve();
                });
            });

            return expect(ret)
                .to.be.rejectedWith(error)
                .then(_verifyCleanup(true));
        });

        it('should resolve the promise if cleanup succeeds', () => {
            const cleanupLockMethod = _lockMock.mocks.cleanup;

            const lock = _initLock();
            const messages = _generateMessages(['success']);

            const ret = _invokeNotify(lock.lockId, messages);

            _runUntilTask(Tasks.END).then(() => {
                cleanupLockMethod.resolve();
            });

            return expect(ret).to.be.fulfilled.then(_verifyCleanup(true));
        });
    });
});
