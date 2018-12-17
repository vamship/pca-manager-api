import _chai from 'chai';
import _chaiAsPromised from 'chai-as-promised';
import _chaiHttp from 'chai-http';
import 'mocha';
import _sinonChai from 'sinon-chai';

_chai.use(_chaiAsPromised);
_chai.use(_sinonChai);
_chai.use(_chaiHttp);
const { expect, request } = _chai;

import {
    endpoint,
    getRouteBuilder as _getRouteBuilder
} from '../utils/api-utils';

describe('[/health routes]', () => {
    const _buildRoute = _getRouteBuilder('/external/health');

    describe('GET /external/health', () => {
        it('should return a valid JSON response when invoked', () => {
            const path = _buildRoute();
            return request(endpoint)
                .get(path)
                .then((res) => {
                    expect(res.status).to.equal(200);
                    expect(res.header['content-type']).to.match(
                        /^application\/json/
                    );
                    expect(res.body).to.deep.equal({
                        status: 'ok'
                    });
                });
        });
    });

    describe('GET /external/health/ready', () => {
        it('should return a valid JSON response when invoked', () => {
            const path = _buildRoute();
            return request(endpoint)
                .get(path)
                .then((res) => {
                    expect(res.status).to.equal(200);
                    expect(res.header['content-type']).to.match(
                        /^application\/json/
                    );
                    expect(res.body).to.deep.equal({
                        status: 'ok'
                    });
                });
        });
    });
});
