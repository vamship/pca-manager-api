import _chai from 'chai';
import _chaiAsPromised from 'chai-as-promised';
import 'mocha';
import _rewire from 'rewire';
import _sinonChai from 'sinon-chai';

_chai.use(_chaiAsPromised);
_chai.use(_sinonChai);
const expect = _chai.expect;

import {
    asyncHelper as _asyncHelper,
    ObjectMock,
    testValues as _testValues
} from '@vamship/test-utils';

import _dotProp from 'dot-prop';

const _refreshLicenseHandlerModule = _rewire(
    '../../../src/handlers/refresh-license-handler'
);
const _refreshLicenseHandler = _refreshLicenseHandlerModule.default;
const LOGGER_METHODS = [
    'trace',
    'debug',
    'info',
    'warn',
    'error',
    'fatal',
    'silent'
];

describe('refreshLicenseHandler()', () => {
    function _invokeHandler(input?: any, ext?: any) {
        input = Object.assign({}, input);
        ext = Object.assign(
            {
                logger: LOGGER_METHODS.reduce((result, method) => {
                    result.addMock(method);
                    return result;
                }, new ObjectMock()).instance,
                config: _configMock.instance
            },
            ext
        );

        return _refreshLicenseHandler(input, {}, ext);
    }

    enum Tasks {
        FETCH_LICENSE = 0,
        PARSE_LICENSE,
        LAUNCH_UPDATE,
        END
    }

    function _runUntilTask(depth: Tasks): Promise<any> {
        const fetchMethod = _isomorphicFetchMock.mocks.fetch;
        const jsonMethod = _isomorphicFetchMock.mocks.json;
        const launchUpdateMethod = _updateManagerMock.mocks.launchUpdate;

        const fetchResponse = { json: _isomorphicFetchMock.instance.json };
        const licenseData = _isomorphicFetchMock.__data.licenseData;
        const launchUpdateResponse =
            _updateManagerMock.__data.launchUpdateResponse;

        const actions = [
            () => fetchMethod.resolve(fetchResponse),
            () => jsonMethod.resolve(licenseData),
            () => launchUpdateMethod.resolve(launchUpdateResponse)
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

    let _isomorphicFetchMock;
    let _updateManagerMock;
    let _configMock;

    beforeEach(() => {
        _configMock = new ObjectMock().addMock('get', (key) =>
            _dotProp.get(_configMock.__data, key)
        );
        _configMock.__data = {
            app: {
                licenseServerEndpoint: _testValues.getString(
                    'licenseServerEndpoint'
                ),
                serverId: _testValues.getString('serverId'),
                serverApiKey: _testValues.getString('serverApiKey')
            }
        };

        _isomorphicFetchMock = new ObjectMock()
            .addPromiseMock('fetch')
            .addPromiseMock('json');
        _isomorphicFetchMock.__data = {
            licenseData: {
                foo: _testValues.getString('foo')
            }
        };

        _updateManagerMock = new ObjectMock().addPromiseMock('launchUpdate');
        _updateManagerMock.__data = {
            launchUpdateResponse: {
                lockId: _testValues.getString('lockId'),
                state: _testValues.getString('state')
            }
        };

        _refreshLicenseHandlerModule.__set__('isomorphic_fetch_1', {
            default: _isomorphicFetchMock.instance.fetch
        });

        _refreshLicenseHandlerModule.__set__('update_manager_1', {
            default: _updateManagerMock.instance
        });
    });

    it('should return a promise when invoked', () => {
        const ret = _invokeHandler();

        expect(ret).to.be.an('object');
        expect(ret.then).to.be.a('function');
    });

    it('should perform an HTTP request to fetch license data from the cloud', () => {
        const licenseServerEndpoint = `${_testValues.getString(
            'licenseServerEndpoint'
        )}/product-license/servers/:serverId/license`;
        const serverApiKey = _testValues.getString('serverApiKey');
        const serverId = _testValues.getString('serverId');

        _configMock.__data.app.licenseServerEndpoint = licenseServerEndpoint;
        _configMock.__data.app.serverId = serverId;
        _configMock.__data.app.serverApiKey = serverApiKey;

        const fetchMethod = _isomorphicFetchMock.mocks.fetch;

        expect(fetchMethod.stub).to.not.have.been.called;

        _invokeHandler();

        const expectedUrl = licenseServerEndpoint.replace(
            /:serverId/,
            serverId
        );

        return _runUntilTask(Tasks.FETCH_LICENSE).then(() => {
            expect(fetchMethod.stub).to.have.been.calledOnce;
            expect(fetchMethod.stub.args[0][0]).to.equal(expectedUrl);
            expect(fetchMethod.stub.args[0][1]).to.deep.equal({
                method: 'GET',
                headers: {
                    'content-type': 'application/json',
                    authorization: serverApiKey
                }
            });
        });
    });

    it('should reject the promise if the fetch method fails', () => {
        const fetchMethod = _isomorphicFetchMock.mocks.fetch;
        const error = 'Error fetching server license';

        const ret = _invokeHandler();

        _runUntilTask(Tasks.FETCH_LICENSE).then(() => {
            fetchMethod.reject('something went wrong!').catch((ex) => {
                // Eat this error. We are checking for rejection later.
            });
        });

        return expect(ret).to.be.rejectedWith(error);
    });

    it('should parse the license data if the fetch method succeeds', () => {
        const jsonMethod = _isomorphicFetchMock.mocks.json;

        expect(jsonMethod.stub).to.not.have.been.called;

        _invokeHandler();

        return _runUntilTask(Tasks.PARSE_LICENSE).then(() => {
            expect(jsonMethod.stub).to.have.been.calledOnce;
            expect(jsonMethod.stub).to.have.been.calledWithExactly();
        });
    });

    it('should reject the promise if license data parsing fails', () => {
        const jsonMethod = _isomorphicFetchMock.mocks.json;
        const error = 'Error parsing server license';

        const ret = _invokeHandler();

        _runUntilTask(Tasks.PARSE_LICENSE).then(() => {
            jsonMethod.reject('something went wrong').catch((ex) => {
                // Eat this error. We are checking for rejection later.
            });
        });

        return expect(ret).to.be.rejectedWith(error);
    });

    it('should launch a software update using the update manager', () => {
        const launchUpdateMethod = _updateManagerMock.mocks.launchUpdate;
        const licenseData = {
            foo: _testValues.getString('foo')
        };
        _isomorphicFetchMock.__data.licenseData = licenseData;

        expect(launchUpdateMethod.stub).to.not.have.been.called;

        _invokeHandler();

        return _runUntilTask(Tasks.LAUNCH_UPDATE).then(() => {
            expect(launchUpdateMethod.stub).to.have.been.calledOnce;
            expect(launchUpdateMethod.stub.args[0]).to.have.length(1);
            expect(launchUpdateMethod.stub.args[0][0]).to.deep.equal(
                licenseData
            );
        });
    });

    it('should reject the promise if the software update launch fails', () => {
        const launchUpdateMethod = _updateManagerMock.mocks.launchUpdate;
        const error = 'something went wrong!';

        const ret = _invokeHandler();

        _runUntilTask(Tasks.LAUNCH_UPDATE).then(() => {
            launchUpdateMethod.reject(error).catch((ex) => {
                // Eat this error. We are checking for rejection later.
            });
        });

        return expect(ret).to.be.rejectedWith(error);
    });

    it('should resolve the promise if the software update launch succeeds', () => {
        const launchUpdateResponse = {
            lockId: _testValues.getString('lockId'),
            state: _testValues.getString('state')
        };
        _updateManagerMock.__data.launchUpdateResponse = launchUpdateResponse;

        const ret = _invokeHandler();

        _runUntilTask(Tasks.END);

        return expect(ret).to.be.fulfilled.then((response) => {
            expect(response).to.deep.equal(launchUpdateResponse);
        });
    });
});
