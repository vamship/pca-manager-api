import _chai from 'chai';
import _chaiAsPromised from 'chai-as-promised';
import 'mocha';
import _rewire from 'rewire';
import _sinonChai from 'sinon-chai';

_chai.use(_chaiAsPromised);
_chai.use(_sinonChai);
const expect = _chai.expect;

import { testValues as _testValues } from '@vamship/test-utils';

const _getManifestHandlerModule = _rewire(
    '../../../src/handlers/get-manifest-handler'
);
const getManifestHandler = _getManifestHandlerModule.default;

describe('getManifestHandler()', () => {
    it('should return an object when invoked', () => {
        const ret = getManifestHandler({});

        expect(ret).to.be.an('object');
        expect(ret.message).to.be.a('string').and.to.not.be.empty;
    });

    it('should return a message for the default language if the language is not recognized', () => {
        const inputs = ['es', 'it'];
        inputs.forEach((language) => {
            const name = _testValues.getString('name');
            const ret = getManifestHandler({
                name,
                language
            });

            expect(ret).to.deep.equal({
                message: `Hello, ${name}`
            });
        });
    });

    it('should return a message based on the language if the language is recognized', () => {
        const inputs = [
            {
                language: 'fr',
                greeting: 'Bonjour'
            },
            {
                language: 'en',
                greeting: 'Hello'
            }
        ];

        inputs.forEach(({ language, greeting }) => {
            const name = _testValues.getString('name');
            const ret = getManifestHandler({
                name,
                language
            });

            expect(ret).to.deep.equal({
                message: `${greeting}, ${name}`
            });
        });
    });

    it('should default the name to "there" if no name is specified', () => {
        const inputs = _testValues.allButString('');
        inputs.forEach((name) => {
            const ret = getManifestHandler({
                name,
                language: 'en'
            });

            expect(ret).to.deep.equal({
                message: `Hello, there`
            });
        });
    });
});
