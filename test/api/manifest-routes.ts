import _chai from 'chai';
import _chaiAsPromised from 'chai-as-promised';
import _chaiHttp from 'chai-http';
import 'mocha';
import _sinonChai from 'sinon-chai';

_chai.use(_chaiAsPromised);
_chai.use(_sinonChai);
_chai.use(_chaiHttp);
const { expect, request } = _chai;

import { testValues as _testValues } from '@vamship/test-utils';
import Promise from 'bluebird';
import {
    endpoint,
    getRouteBuilder as _getRouteBuilder
} from '../utils/api-utils';

describe('[/manifest routes]', () => {
    const _buildRoute = _getRouteBuilder('/manifest');

    xdescribe('GET /manifest/:language/:name', () => {
        it('should return a schema validation error if the language is invalid', () => {
            const inputs = [
                _testValues.getString('lang1'),
                _testValues.getString('lang2')
            ];
            return Promise.map(inputs, (language) => {
                const name = _testValues.getString('name');
                const path = _buildRoute(`${language}/${name}`);

                return request(endpoint)
                    .get(path)
                    .then((res) => {
                        expect(res.status).to.equal(400);
                        expect(res.header['content-type']).to.match(
                            /^application\/json/
                        );
                        const { error } = res.body;
                        expect(error).to.match(/.*\[SchemaError\].*language.*/);
                    });
            });
        });

        it('should return a schema validation error if the name is of invalid length', () => {
            const path = _buildRoute('fr/j');
            return request(endpoint)
                .get(path)
                .then((res) => {
                    expect(res.status).to.equal(400);
                    expect(res.header['content-type']).to.match(
                        /^application\/json/
                    );
                    const { error } = res.body;
                    expect(error).to.match(/.*\[SchemaError\].*name.*/);
                });
        });

        it('should return the correct greeting based on language', () => {
            const inputs = [
                { language: 'en', greeting: 'Hello' },
                { language: 'fr', greeting: 'Bonjour' }
            ];

            return Promise.map(inputs, ({ language, greeting }) => {
                const name = _testValues.getString('name');
                const path = _buildRoute(`${language}/${name}`);
                return request(endpoint)
                    .get(path)
                    .then((res) => {
                        expect(res.status).to.equal(200);
                        expect(res.header['content-type']).to.match(
                            /^application\/json/
                        );
                        expect(res.body).to.deep.equal({
                            message: `${greeting}, ${name}`
                        });
                    });
            });
        });
    });
});
