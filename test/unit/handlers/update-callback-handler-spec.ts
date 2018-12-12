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

const _updateCallbackHandlerModule = _rewire(
    '../../../src/handlers/update-callback-handler'
);
const _updateCallbackHandler = _updateCallbackHandlerModule.default;
const LOGGER_METHODS = [
    'trace',
    'debug',
    'info',
    'warn',
    'error',
    'fatal',
    'silent'
];

describe('updateCallbackHandler()', () => {
    function _generateMessages(kinds: string[] = ['log', 'success', 'fail']) {
        return new Array(10).fill(0).map((item, index) => ({
            kind: kinds[index % kinds.length],
            timestamp: _testValues.getTimestamp(),
            message: _testValues.getString('message')
        }));
    }

    function _invokeHandler(input?: any, ext?: any) {
        input = Object.assign(
            {
                lockId: _testValues.getString('lockId'),
                messages: _generateMessages()
            },
            input
        );
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

        return _updateCallbackHandler(input, {}, ext);
    }

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

        _updateManagerMock = new ObjectMock().addPromiseMock('notify');

        _updateCallbackHandlerModule.__set__('update_manager_1', {
            default: _updateManagerMock.instance
        });
    });

    it('should return a promise when invoked', () => {
        const ret = _invokeHandler();

        expect(ret).to.be.an('object');
        expect(ret.then).to.be.a('function');
    });

    it('should notify the update manager of the messages from the update job', () => {
        const notifyMethod = _updateManagerMock.mocks.notify;
        const lockId = _testValues.getString('lockId');
        const messages = _generateMessages();

        expect(notifyMethod.stub).to.not.have.been.called;

        _invokeHandler({ lockId, messages });

        expect(notifyMethod.stub).to.have.been.calledOnce;
        expect(notifyMethod.stub.args[0]).to.have.length(2);
        expect(notifyMethod.stub.args[0][0]).to.equal(lockId);
        expect(notifyMethod.stub.args[0][1]).to.deep.equal(messages);
    });

    it('should reject the promise if the notify method fails', () => {
        const notifyMethod = _updateManagerMock.mocks.notify;
        const error = 'something went wrong!';

        const ret = _invokeHandler();

        notifyMethod.reject(error);
        return expect(ret).to.be.rejectedWith(error);
    });

    it('should resolve the promise if the notify method succeeds', () => {
        const notifyMethod = _updateManagerMock.mocks.notify;

        const ret = _invokeHandler();

        notifyMethod.resolve();
        return expect(ret).to.be.fulfilled.then((response) => {
            expect(response).to.deep.equal({});
        });
    });
});
