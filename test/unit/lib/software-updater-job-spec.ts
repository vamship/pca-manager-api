import _chai from 'chai';
import 'mocha';

const expect = _chai.expect;

import {
    asyncHelper as _asyncHelper,
    ObjectMock,
    testValues as _testValues
} from '@vamship/test-utils';
import _rewire from 'rewire';

import { IJobDescriptor } from '../../../src/lib/types';

const _softwareUpdaterJobModule = _rewire(
    '../../../src/lib/software-updater-job'
);
const SoftwareUpdaterJob = _softwareUpdaterJobModule.default;

// These secrets should have been created by a different process.
const HELM_CA_CERT_SECRET = 'pca-helm-ca-certificate';
const HELM_CERT_SECRET = 'pca-helm-certificate';

// Name of the container that will run the update job
const PCA_UPDATE_AGENT_CONTAINER = 'vamship/pca-update-agent:2.0.0';

describe('SoftwareUpdaterJob', () => {
    function _generateJobDescriptor(): IJobDescriptor {
        const count = 10;
        return {
            callbackEndpoint: _testValues.getString('callbackEndpoint'),
            credentialProviderEndpoint: _testValues.getString(
                'credentialProviderEndpoint'
            ),
            credentialProviderAuthToken: _testValues.getString(
                'credentialProviderAuthToken'
            ),
            manifest: {
                installRecords: new Array(count).fill(0).map((item, index) => ({
                    releaseName: _testValues.getString(`releaseName_${index}`),
                    chartName: _testValues.getString(`chartName_${index}`),
                    namespace: _testValues.getString(`namespace_${index}`),
                    setOptions: new Array(count)
                        .fill(0)
                        .map((item2, index2) => ({
                            key: _testValues.getString(
                                `set_${index}_${index2}`
                            ),
                            value: _testValues.getString(
                                `set_${index}_${index2}`
                            )
                        }))
                })),
                uninstallRecords: new Array(count)
                    .fill(0)
                    .map((item, index) => `uninstall_${index}`),
                privateContainerRepos: new Array(count)
                    .fill(0)
                    .map((item, index) => ({
                        repoUri: `repoUri_${index}`,
                        targets: new Array(count)
                            .fill(0)
                            .map((target, targetIndex) => ({
                                serviceAccount: `serviceAccount_${index}`,
                                secretName: `secret_${index}`,
                                namespace: `targetRepo_${index}`
                            }))
                    }))
            }
        };
    }

    function _createJob(descriptor?: IJobDescriptor) {
        descriptor = Object.assign(_generateJobDescriptor(), descriptor);
        return new SoftwareUpdaterJob(descriptor);
    }

    let _execaMock;

    beforeEach(() => {
        _execaMock = new ObjectMock().addPromiseMock('execa');

        _softwareUpdaterJobModule.__set__('execa_1', {
            default: _execaMock.instance.execa
        });
    });

    describe('ctor()', () => {
        it('should throw an error if invoked without a valid job descriptor', () => {
            const inputs = _testValues.allButObject();
            const error = 'Invalid jobDescriptor (arg #1)';

            inputs.forEach((jobInfo) => {
                const wrapper = () => {
                    return new SoftwareUpdaterJob(jobInfo);
                };

                expect(wrapper).to.throw(error);
            });
        });

        it('should throw an error if the job descriptor does not define a valid callbackEndpoint', () => {
            const inputs = _testValues.allButString('');
            const error = /.*JobDescriptor does not conform to expected schema.*callbackEndpoint.*/;

            inputs.forEach((callbackEndpoint) => {
                const wrapper = () => {
                    const jobInfo = Object.assign(_generateJobDescriptor(), {
                        callbackEndpoint
                    });
                    return new SoftwareUpdaterJob(jobInfo);
                };

                expect(wrapper).to.throw(error);
            });
        });

        it('should throw an error if the job descriptor does not define a valid credentialProviderEndpoint', () => {
            const inputs = _testValues.allButString('');
            const error = /.*JobDescriptor does not conform to expected schema.*credentialProviderEndpoint.*/;

            inputs.forEach((credentialProviderEndpoint) => {
                const wrapper = () => {
                    const jobInfo = Object.assign(_generateJobDescriptor(), {
                        credentialProviderEndpoint
                    });
                    return new SoftwareUpdaterJob(jobInfo);
                };

                expect(wrapper).to.throw(error);
            });
        });

        it('should throw an error if the job descriptor does not define a valid credentialProviderAuthToken', () => {
            const inputs = _testValues.allButString('');
            const error = /.*JobDescriptor does not conform to expected schema.*credentialProviderAuthToken.*/;

            inputs.forEach((credentialProviderAuthToken) => {
                const wrapper = () => {
                    const jobInfo = Object.assign(_generateJobDescriptor(), {
                        credentialProviderAuthToken
                    });
                    return new SoftwareUpdaterJob(jobInfo);
                };

                expect(wrapper).to.throw(error);
            });
        });

        it('should throw an error if the job descriptor does not define a valid manifest', () => {
            const inputs = _testValues.allButObject();
            const error = /.*JobDescriptor does not conform to expected schema.*manifest.*/;

            inputs.forEach((manifest) => {
                const wrapper = () => {
                    const jobInfo = Object.assign(_generateJobDescriptor(), {
                        manifest
                    });
                    return new SoftwareUpdaterJob(jobInfo);
                };

                expect(wrapper).to.throw(error);
            });
        });

        it('should throw an error if the manifest.privateContainerRepos is invalid', () => {
            const inputs = _testValues.allButArray();
            const error = /.*JobDescriptor does not conform to expected schema.*manifest.*privateContainerRepos.*/;

            inputs.forEach((privateContainerRepos) => {
                const wrapper = () => {
                    const jobInfo = _generateJobDescriptor();
                    jobInfo.manifest.privateContainerRepos = privateContainerRepos;
                    return new SoftwareUpdaterJob(jobInfo);
                };

                expect(wrapper).to.throw(error);
            });
        });

        it('should throw an error if the manifest.privateContainerRepos has invalid values', () => {
            const inputs = _testValues.allButObject();
            const error = /.*JobDescriptor does not conform to expected schema.*manifest.*privateContainerRepos.*/;

            inputs.forEach((repo) => {
                const wrapper = () => {
                    const jobInfo = _generateJobDescriptor();
                    jobInfo.manifest.privateContainerRepos = new Array(10)
                        .fill(0)
                        .map(() => repo);
                    return new SoftwareUpdaterJob(jobInfo);
                };

                expect(wrapper).to.throw(error);
            });
        });

        it('should throw an error if a repo has an invalid repoUri', () => {
            const inputs = _testValues.allButString('');
            const error = /.*JobDescriptor does not conform to expected schema.*manifest.*repoUri.*/;

            inputs.forEach((repoUri) => {
                const wrapper = () => {
                    const jobInfo = _generateJobDescriptor();
                    jobInfo.manifest.privateContainerRepos.forEach((repo) => {
                        repo.repoUri = repoUri;
                    });
                    return new SoftwareUpdaterJob(jobInfo);
                };

                expect(wrapper).to.throw(error);
            });
        });

        it('should throw an error if a repo has an invalid targets array', () => {
            const inputs = _testValues.allButArray([]);
            const error = /.*JobDescriptor does not conform to expected schema.*manifest.*targets.*/;

            inputs.forEach((targets) => {
                const wrapper = () => {
                    const jobInfo = _generateJobDescriptor();
                    jobInfo.manifest.privateContainerRepos.forEach((repo) => {
                        repo.targets = targets;
                    });
                    return new SoftwareUpdaterJob(jobInfo);
                };

                expect(wrapper).to.throw(error);
            });
        });

        it('should throw an error if the targets array has invalid items', () => {
            const inputs = _testValues.allButObject();
            const error = /.*JobDescriptor does not conform to expected schema.*manifest.*targets.*/;

            inputs.forEach((target) => {
                const wrapper = () => {
                    const jobInfo = _generateJobDescriptor();
                    jobInfo.manifest.privateContainerRepos.forEach((repo) => {
                        repo.targets = new Array(10).fill(0).map(() => target);
                    });

                    return new SoftwareUpdaterJob(jobInfo);
                };

                expect(wrapper).to.throw(error);
            });
        });

        it('should throw an error if a target does not define a valid serviceAccount', () => {
            const inputs = _testValues.allButString('');
            const error = /.*JobDescriptor does not conform to expected schema.*target.*serviceAccount.*/;

            inputs.forEach((serviceAccount) => {
                const wrapper = () => {
                    const jobInfo = _generateJobDescriptor();
                    jobInfo.manifest.privateContainerRepos.forEach((repo) => {
                        repo.targets.forEach((target) => {
                            target.serviceAccount = serviceAccount;
                        });
                    });

                    return new SoftwareUpdaterJob(jobInfo);
                };

                expect(wrapper).to.throw(error);
            });
        });

        it('should throw an error if a target does not define a valid namespace', () => {
            const inputs = _testValues.allButString('');
            const error = /.*JobDescriptor does not conform to expected schema.*target.*namespace.*/;

            inputs.forEach((namespace) => {
                const wrapper = () => {
                    const jobInfo = _generateJobDescriptor();
                    jobInfo.manifest.privateContainerRepos.forEach((repo) => {
                        repo.targets.forEach((target) => {
                            target.namespace = namespace;
                        });
                    });

                    return new SoftwareUpdaterJob(jobInfo);
                };

                expect(wrapper).to.throw(error);
            });
        });

        it('should throw an error if a target does not define a valid secretName', () => {
            const inputs = _testValues.allButString('');
            const error = /.*JobDescriptor does not conform to expected schema.*target.*secretName.*/;

            inputs.forEach((secretName) => {
                const wrapper = () => {
                    const jobInfo = _generateJobDescriptor();
                    jobInfo.manifest.privateContainerRepos.forEach((repo) => {
                        repo.targets.forEach((target) => {
                            target.secretName = secretName;
                        });
                    });

                    return new SoftwareUpdaterJob(jobInfo);
                };

                expect(wrapper).to.throw(error);
            });
        });

        it('should throw an error if the manifest.uninstallRecords is invalid', () => {
            const inputs = _testValues.allButArray();
            const error = /.*JobDescriptor does not conform to expected schema.*manifest.*uninstallRecords.*/;

            inputs.forEach((uninstallRecords) => {
                const wrapper = () => {
                    const jobInfo = _generateJobDescriptor();
                    jobInfo.manifest.uninstallRecords = uninstallRecords;
                    return new SoftwareUpdaterJob(jobInfo);
                };

                expect(wrapper).to.throw(error);
            });
        });

        it('should throw an error if the manifest.uninstallRecords has invalid values', () => {
            const inputs = _testValues.allButString('');
            const error = /.*JobDescriptor does not conform to expected schema.*manifest.*uninstallRecords.*/;

            inputs.forEach((record) => {
                const wrapper = () => {
                    const jobInfo = _generateJobDescriptor();
                    jobInfo.manifest.uninstallRecords = new Array(10)
                        .fill(0)
                        .map(() => record);
                    return new SoftwareUpdaterJob(jobInfo);
                };

                expect(wrapper).to.throw(error);
            });
        });

        it('should throw an error if the manifest.installRecords is invalid', () => {
            const inputs = _testValues.allButArray();
            const error = /.*JobDescriptor does not conform to expected schema.*manifest.*installRecords.*/;

            inputs.forEach((installRecords) => {
                const wrapper = () => {
                    const jobInfo = _generateJobDescriptor();
                    jobInfo.manifest.installRecords = installRecords;
                    return new SoftwareUpdaterJob(jobInfo);
                };

                expect(wrapper).to.throw(error);
            });
        });

        it('should throw an error if the manifest.installRecords has invalid values', () => {
            const inputs = _testValues.allButObject();
            const error = /.*JobDescriptor does not conform to expected schema.*manifest.*installRecords.*/;

            inputs.forEach((record) => {
                const wrapper = () => {
                    const jobInfo = _generateJobDescriptor();
                    jobInfo.manifest.installRecords = new Array(10)
                        .fill(0)
                        .map(() => record);
                    return new SoftwareUpdaterJob(jobInfo);
                };

                expect(wrapper).to.throw(error);
            });
        });

        it('should throw an error if an installRecord has an invalid releaseName', () => {
            const inputs = _testValues.allButString('');
            const error = /.*JobDescriptor does not conform to expected schema.*manifest.*releaseName.*/;

            inputs.forEach((releaseName) => {
                const wrapper = () => {
                    const jobInfo = _generateJobDescriptor();
                    jobInfo.manifest.installRecords.forEach((record) => {
                        record.releaseName = releaseName;
                    });
                    return new SoftwareUpdaterJob(jobInfo);
                };

                expect(wrapper).to.throw(error);
            });
        });

        it('should throw an error if an installRecord has an invalid chartName', () => {
            const inputs = _testValues.allButString('');
            const error = /.*JobDescriptor does not conform to expected schema.*manifest.*chartName.*/;

            inputs.forEach((chartName) => {
                const wrapper = () => {
                    const jobInfo = _generateJobDescriptor();
                    jobInfo.manifest.installRecords.forEach((record) => {
                        record.chartName = chartName;
                    });
                    return new SoftwareUpdaterJob(jobInfo);
                };

                expect(wrapper).to.throw(error);
            });
        });

        it('should throw an error if an installRecord has an invalid namespace', () => {
            const inputs = _testValues.allButString('');
            const error = /.*JobDescriptor does not conform to expected schema.*manifest.*namespace.*/;

            inputs.forEach((namespace) => {
                const wrapper = () => {
                    const jobInfo = _generateJobDescriptor();
                    jobInfo.manifest.installRecords.forEach((record) => {
                        record.namespace = namespace;
                    });
                    return new SoftwareUpdaterJob(jobInfo);
                };

                expect(wrapper).to.throw(error);
            });
        });

        it('should throw an error if an installRecord has an invalid setOptions', () => {
            const inputs = _testValues.allButArray();
            const error = /.*JobDescriptor does not conform to expected schema.*manifest.*setOptions.*/;

            inputs.forEach((setOptions) => {
                const wrapper = () => {
                    const jobInfo = _generateJobDescriptor();
                    jobInfo.manifest.installRecords.forEach((record) => {
                        record.setOptions = setOptions;
                    });
                    return new SoftwareUpdaterJob(jobInfo);
                };

                expect(wrapper).to.throw(error);
            });
        });

        it('should throw an error if the setOptions have invalid values', () => {
            const inputs = _testValues.allButObject();
            const error = /.*JobDescriptor does not conform to expected schema.*setOptions.*/;

            inputs.forEach((setOptions) => {
                const wrapper = () => {
                    const jobInfo = _generateJobDescriptor();
                    jobInfo.manifest.installRecords.forEach((record) => {
                        record.setOptions = new Array(10)
                            .fill(0)
                            .map(() => setOptions);
                    });
                    return new SoftwareUpdaterJob(jobInfo);
                };

                expect(wrapper).to.throw(error);
            });
        });

        it('should throw an error if a setOption does not define the key property', () => {
            const inputs = _testValues.allButString('');
            const error = /.*JobDescriptor does not conform to expected schema.*setOptions.*key.*/;

            inputs.forEach((key) => {
                const wrapper = () => {
                    const jobInfo = _generateJobDescriptor();
                    jobInfo.manifest.installRecords.forEach((record) => {
                        record.setOptions.forEach((option) => {
                            option.key = key;
                        });
                    });
                    return new SoftwareUpdaterJob(jobInfo);
                };

                expect(wrapper).to.throw(error);
            });
        });

        it('should throw an error if a setOption does not define the value property', () => {
            const inputs = _testValues.allButString('');
            const error = /.*JobDescriptor does not conform to expected schema.*setOptions.*value.*/;

            inputs.forEach((value) => {
                const wrapper = () => {
                    const jobInfo = _generateJobDescriptor();
                    jobInfo.manifest.installRecords.forEach((record) => {
                        record.setOptions.forEach((option) => {
                            option.value = value;
                        });
                    });
                    return new SoftwareUpdaterJob(jobInfo);
                };

                expect(wrapper).to.throw(error);
            });
        });

        it('should expose the expected properties and methods', () => {
            const job = new SoftwareUpdaterJob(_generateJobDescriptor());

            expect(job).to.be.an('object');
            expect(job.start).to.be.a('function');
        });
    });

    describe('start()', () => {
        it('should return a promise when invoked', () => {
            const job = _createJob();

            const ret = job.start();
            expect(ret).to.be.an('object');
            expect(ret.then).to.be.a('function');
        });

        it('should use kubectl to create a job configmap', () => {
            const jobDescriptor = _generateJobDescriptor();
            const job = _createJob(jobDescriptor);
            const execaMethod = _execaMock.mocks.execa;

            const expectedConfigMap = [
                'apiVersion: v1',
                'kind: ConfigMap',
                'metadata:',
                '  name: pca-agent-config',
                'data:',
                '  manifest: |',
                `    ${JSON.stringify(jobDescriptor.manifest)}`,
                ''
            ].join('\n');

            expect(execaMethod.stub).to.not.have.been.called;
            job.start();

            expect(execaMethod.stub).to.have.been.calledOnce;
            expect(execaMethod.stub.args[0]).to.have.length(3);
            expect(execaMethod.stub.args[0][0]).to.equal('kubectl');
            expect(execaMethod.stub.args[0][1]).to.deep.equal([
                'apply',
                '-f',
                '-'
            ]);
            expect(execaMethod.stub.args[0][2]).to.deep.equal({
                input: expectedConfigMap
            });
        });

        it('should reject the promise if configmap creation fails', () => {
            const error = 'Error creating ConfigMap for update job';
            const job = _createJob();
            const execaMethod = _execaMock.mocks.execa;

            const ret = job.start();
            execaMethod.reject('something went wrong!');

            return expect(ret).to.be.rejectedWith(error);
        });

        it('should use kubectl to launch the update job once the configmap has been created', () => {
            const jobDescriptor = _generateJobDescriptor();
            const job = _createJob(jobDescriptor);
            const execaMethod = _execaMock.mocks.execa;
            const {
                callbackEndpoint,
                credentialProviderEndpoint,
                credentialProviderAuthToken
            } = jobDescriptor;

            const expectedJob = [
                'apiVersion: batch/v1',
                'kind: Job',
                'metadata:',
                '  name: pca-agent-job',
                'spec:',
                '  backoffLimit: 4',
                '  activeDeadlineSeconds: 300',
                '  template:',
                '    spec:',
                '      serviceAccountName: pca-agent',
                '      restartPolicy: Never',
                '      containers:',
                '        - name: pca-agent',
                `          image: ${PCA_UPDATE_AGENT_CONTAINER}`,
                '          env:',
                '            - name: pcaUpdateAgent_production__callbackEndpoint',
                `              value: '${callbackEndpoint}'`,
                '            - name: pcaUpdateAgent_production__credentialProviderEndpoint',
                `              value: '${credentialProviderEndpoint}'`,
                '            - name: pcaUpdateAgent_production__credentialProviderAuth',
                `              value: '${credentialProviderAuthToken}'`,
                '            - name: pcaUpdateAgent_production__manifestFile',
                `              value: '/etc/pca/manifest/manifest'`,
                '            - name: LOG_LEVEL',
                "              value: 'trace'",
                '          volumeMounts:',
                '            - name: pca-agent-manifest',
                '              mountPath: /etc/pca/manifest',
                '            - name: helm-ca-tls-secret',
                '              mountPath: /root/.helm/ca.pem',
                '              subPath: ca.pem',
                '            - name: helm-tls-secret',
                '              mountPath: /root/.helm/cert.pem',
                '              subPath: cert.pem',
                '            - name: helm-tls-secret',
                '              mountPath: /root/.helm/key.pem',
                '              subPath: key.pem',
                '      volumes:',
                '        - name: pca-agent-manifest',
                '          configMap:',
                '            name: pca-agent-config',
                '        - name: helm-ca-tls-secret',
                '          secret:',
                `            secretName: ${HELM_CA_CERT_SECRET}`,
                '            items:',
                '              - key: tls.crt',
                '                path: ca.pem',
                '        - name: helm-tls-secret',
                '          secret:',
                `            secretName: ${HELM_CERT_SECRET}`,
                '            items:',
                '              - key: tls.crt',
                '                path: cert.pem',
                '              - key: tls.key',
                '                path: key.pem',
                ''
            ].join('\n');

            expect(execaMethod.stub).to.not.have.been.called;
            job.start();

            execaMethod.resolve(undefined, 0);
            return _asyncHelper
                .wait(1)()
                .then(() => {
                    expect(execaMethod.stub).to.have.been.calledTwice;
                    expect(execaMethod.stub.args[1]).to.have.length(3);
                    expect(execaMethod.stub.args[1][0]).to.equal('kubectl');
                    expect(execaMethod.stub.args[1][1]).to.deep.equal([
                        'apply',
                        '-f',
                        '-'
                    ]);
                    expect(execaMethod.stub.args[1][2]).to.deep.equal({
                        input: expectedJob
                    });
                });
        });

        it('should reject the promise if job creation fails', () => {
            const error = 'Error creating update job';
            const job = _createJob();
            const execaMethod = _execaMock.mocks.execa;

            const ret = job.start();

            execaMethod.resolve(undefined, 0);
            return execaMethod
                .promise(0)
                .then(() => {
                    return execaMethod
                        .reject('something went wrong!', 1)
                        .catch((ex) => {
                            // Eat this error. We are checking for rejection later.
                        });
                })
                .then(() => {
                    return expect(ret).to.be.rejectedWith(error);
                });
        });

        it('should resolve the promise if job creation succeeds', () => {
            const job = _createJob();
            const execaMethod = _execaMock.mocks.execa;

            const ret = job.start();

            execaMethod.resolve(undefined, 0);
            execaMethod.resolve(undefined, 1);

            return _asyncHelper
                .wait(1)()
                .then(() => {
                    return expect(ret).to.be.fulfilled;
                });
        });
    });
});
