import _chai from 'chai';
import _chaiAsPromised from 'chai-as-promised';
import 'mocha';
import _sinon from 'sinon';
import _sinonChai from 'sinon-chai';

_chai.use(_chaiAsPromised);
_chai.use(_sinonChai);
const expect = _chai.expect;

import _rewire from 'rewire';

import { testValues as _testValues } from '@vamship/test-utils';

const _licenseWriteErrorModule = _rewire('../../../src/lib/license-write-error');
const LicenseWriteError = _licenseWriteErrorModule.default;

describe('LicenseWriteError', () => {
    const ERROR_NAME = 'LicenseWriteError';
    const ERROR_MESSAGE = 'Error writing license file';

    function _getExpectedMessage(message?: string): string {
        message = message || ERROR_MESSAGE;
        return `[${ERROR_NAME}] ${message}`;
    }

    describe('ctor()', () => {
        it('should return an Error object with default property values', () => {
            const error = new LicenseWriteError();

            expect(error).to.be.an.instanceOf(Error);
            expect(error.name).to.equal(ERROR_NAME);
            expect(error.message).to.equal(_getExpectedMessage());
        });

        it('should persist the error message property when specified', () => {
            const message = 'Something went wrong';
            const error = new LicenseWriteError(message);

            expect(error).to.be.an.instanceOf(Error);
            expect(error.message).to.equal(_getExpectedMessage(message));
        });

        it('should ignore any message values that are not strings', () => {
            const inputs = _testValues.allButString();

            inputs.forEach((message) => {
                const error = new LicenseWriteError(message);
                expect(error.message).to.equal(_getExpectedMessage());
            });
        });
    });
});
