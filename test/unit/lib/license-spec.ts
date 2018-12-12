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

import { ObjectMock, testValues as _testValues } from '@vamship/test-utils';
import { Promise } from 'bluebird';

import CorruptLicenseError from '../../../src/lib/corrupt-license-error';
import LicenseReadError from '../../../src/lib/license-read-error';
import LicenseWriteError from '../../../src/lib/license-write-error';

const _licenseModule = _rewire('../../../src/lib/license');
const License = _licenseModule.default;
const LICENSE_FILE_NAME = '_license';

describe('License', () => {
    function _createLicense(licenseDir?: string) {
        licenseDir = licenseDir || _testValues.getString('licenseDir');
        return new License(licenseDir);
    }

    function _generateLicenseData() {
        const count = 10;
        return {
            components: new Array(count).fill(0).map((item, index) => ({
                releaseName: _testValues.getString(`releaseName_${index}`),
                chartName: _testValues.getString(`chartName_${index}`),
                namespace: _testValues.getString(`namespace_${index}`),
                setOptions: new Array(count).fill(0).map((item2, index2) => ({
                    key: _testValues.getString(`set_${index}_${index2}`),
                    value: _testValues.getString(`set_${index}_${index2}`)
                })),
                serviceAccounts: new Array(count)
                    .fill(0)
                    .map((item2, index2) =>
                        _testValues.getString(`serviceAccount_${index2}`)
                    ),
                containerRepos: new Array(count)
                    .fill(0)
                    .map((item2, index2) =>
                        _testValues.getString(`containerRepo_${index2}`)
                    )
            }))
        };
    }

    function _generateLicenseSchemaValidationSuite(invokeFunction) {
        function _runTest(inputs, expectedError) {
            const result = Promise.map(inputs, (license) => {
                const ret = invokeFunction(license);
                return expect(ret).to.be.rejectedWith(
                    CorruptLicenseError,
                    expectedError
                );
            });

            return expect(result).to.be.fulfilled;
        }
        return () => {
            it('should throw an error if the license does not define a valid components array', () => {
                const inputs = _testValues
                    .allButArray()
                    .map((components) =>
                        Object.assign(_generateLicenseData(), { components })
                    );
                const error = /.*License does not conform to expected schema.*components.*/;

                return _runTest(inputs, error);
            });

            it('should throw an error if the components array has invalid values', () => {
                const inputs = _testValues.allButObject().map((component) =>
                    Object.assign(_generateLicenseData(), {
                        components: new Array(10).fill(0).map(() => component)
                    })
                );
                const error = /.*License does not conform to expected schema.*components.*/;

                return _runTest(inputs, error);
            });

            it('should throw an error if a component does not define a valid releaseName', () => {
                const inputs = _testValues
                    .allButString('')
                    .map((releaseName) => {
                        const license = _generateLicenseData();
                        license.components.forEach((component) => {
                            component.releaseName = releaseName;
                        });
                        return license;
                    });
                const error = /.*License does not conform to expected schema.*components.*releaseName.*/;

                return _runTest(inputs, error);
            });

            it('should throw an error if a component does not define a valid namespace', () => {
                const inputs = _testValues.allButString('').map((namespace) => {
                    const license = _generateLicenseData();
                    license.components.forEach((component) => {
                        component.namespace = namespace;
                    });
                    return license;
                });
                const error = /.*License does not conform to expected schema.*components.*namespace.*/;

                return _runTest(inputs, error);
            });

            it('should throw an error if a component does not define a valid chartName', () => {
                const inputs = _testValues.allButString('').map((chartName) => {
                    const license = _generateLicenseData();
                    license.components.forEach((component) => {
                        component.chartName = chartName;
                    });
                    return license;
                });
                const error = /.*License does not conform to expected schema.*components.*chartName.*/;

                return _runTest(inputs, error);
            });

            it('should throw an error if a component does not define a valid setOptions', () => {
                const inputs = _testValues.allButArray().map((setOptions) => {
                    const license = _generateLicenseData();
                    license.components.forEach((component) => {
                        component.setOptions = setOptions;
                    });
                    return license;
                });
                const error = /.*License does not conform to expected schema.*components.*setOptions.*/;

                return _runTest(inputs, error);
            });

            it('should throw an error if the setOptions have invalid values', () => {
                const inputs = _testValues.allButObject().map((setOptions) => {
                    const license = _generateLicenseData();
                    license.components.forEach((record) => {
                        record.setOptions = new Array(10)
                            .fill(0)
                            .map(() => setOptions);
                    });
                    return license;
                });
                const error = /.*License does not conform to expected schema.*setOptions.*/;

                return _runTest(inputs, error);
            });

            it('should throw an error if a setOption does not define the key property', () => {
                const inputs = _testValues.allButString('').map((key) => {
                    const license = _generateLicenseData();
                    license.components.forEach((record) => {
                        record.setOptions.forEach((option) => {
                            option.key = key;
                        });
                    });
                    return license;
                });
                const error = /.*License does not conform to expected schema.*setOptions.*key.*/;

                return _runTest(inputs, error);
            });

            it('should throw an error if a setOption does not define the value property', () => {
                const inputs = _testValues.allButString('').map((value) => {
                    const license = _generateLicenseData();
                    license.components.forEach((record) => {
                        record.setOptions.forEach((option) => {
                            option.value = value;
                        });
                    });
                    return license;
                });
                const error = /.*License does not conform to expected schema.*setOptions.*value.*/;

                return _runTest(inputs, error);
            });

            it('should throw an error if a component does not define a valid serviceAccounts', () => {
                const inputs = _testValues
                    .allButArray()
                    .map((serviceAccounts) => {
                        const license = _generateLicenseData();
                        license.components.forEach((component) => {
                            component.serviceAccounts = serviceAccounts;
                        });
                        return license;
                    });
                const error = /.*License does not conform to expected schema.*components.*serviceAccounts.*/;

                return _runTest(inputs, error);
            });

            it('should throw an error if the serviceAccounts have invalid values', () => {
                const inputs = _testValues
                    .allButString()
                    .map((serviceAccount) => {
                        const license = _generateLicenseData();
                        license.components.forEach((record) => {
                            record.serviceAccounts = new Array(10)
                                .fill(0)
                                .map(() => serviceAccount);
                        });
                        return license;
                    });
                const error = /.*License does not conform to expected schema.*serviceAccounts.*/;

                return _runTest(inputs, error);
            });

            it('should throw an error if a component does not define a valid containerRepos', () => {
                const inputs = _testValues
                    .allButArray()
                    .map((containerRepos) => {
                        const license = _generateLicenseData();
                        license.components.forEach((component) => {
                            component.containerRepos = containerRepos;
                        });
                        return license;
                    });
                const error = /.*License does not conform to expected schema.*components.*containerRepos.*/;

                return _runTest(inputs, error);
            });

            it('should throw an error if the containerRepos have invalid values', () => {
                const inputs = _testValues
                    .allButString()
                    .map((containerRepo) => {
                        const license = _generateLicenseData();
                        license.components.forEach((record) => {
                            record.containerRepos = new Array(10)
                                .fill(0)
                                .map(() => containerRepo);
                        });
                        return license;
                    });
                const error = /.*License does not conform to expected schema.*containerRepos.*/;

                return _runTest(inputs, error);
            });
        };
    }

    let _fsMock;

    beforeEach(() => {
        _fsMock = new ObjectMock().addMock('readFile').addMock('writeFile');

        _licenseModule.__set__('fs_1', {
            default: _fsMock.instance
        });
    });

    describe('ctor()', () => {
        it('should throw an error if invoked without a valid licenseDir', () => {
            const inputs = _testValues.allButString('');
            const error = 'Invalid licenseDir (arg #1)';

            inputs.forEach((licenseDir) => {
                const wrapper = () => {
                    return new License(licenseDir);
                };

                expect(wrapper).to.throw(error);
            });
        });

        it('should expose the expected properties and methods', () => {
            const license = new License(_testValues.getString('licenseDir'));

            expect(license).to.be.an('object');

            expect(license.load).to.be.a('function');
            expect(license.save).to.be.a('function');
            expect(license.setData).to.be.a('function');
            expect(license.generateUpdateManifest).to.be.a('function');
        });
    });

    describe('load()', () => {
        it('should return a promise when invoked', () => {
            const license = _createLicense();

            const ret = license.load();
            expect(ret).to.be.an('object');
            expect(ret.then).to.be.a('function');
        });

        it('should load the license file from the filesystem when invoked', () => {
            const licenseDir = _testValues.getString('licenseDir');
            const licenseFile = _path.join(licenseDir, LICENSE_FILE_NAME);
            const license = _createLicense(licenseDir);
            const readFileMethod = _fsMock.mocks.readFile;

            expect(readFileMethod.stub).to.not.have.been.called;
            license.load();

            expect(readFileMethod.stub).to.have.been.calledOnce;
            expect(readFileMethod.stub.args[0]).to.have.length(2);
            expect(readFileMethod.stub.args[0][0]).to.equal(licenseFile);
            expect(readFileMethod.stub.args[0][1]).to.be.a('function');
        });

        it('should reject the promise if the license file read operation fails with a non ENOENT error', () => {
            const error = 'Error reading license file';
            const license = _createLicense();
            const readFileMethod = _fsMock.mocks.readFile;

            const ret = license.load();
            const callback = readFileMethod.stub.args[0][1];
            callback({
                code: 'ESOMETHINGWENTWRONG'
            });

            return expect(ret).to.be.rejectedWith(LicenseReadError, error);
        });

        it('should fulfill the promise and reset internal data operation fails with ENOENT', () => {
            const license = _createLicense();
            const readFileMethod = _fsMock.mocks.readFile;

            license._data = _generateLicenseData();

            const ret = license.load();
            const callback = readFileMethod.stub.args[0][1];
            callback({
                code: 'ENOENT'
            });

            return expect(ret).to.be.fulfilled.then(() => {
                expect(license._data).to.deep.equal({
                    components: []
                });
            });
        });

        it('should reject the promise if license data parsing throws an error', () => {
            const error = 'Error parsing license data';
            const license = _createLicense();
            const readFileMethod = _fsMock.mocks.readFile;

            const ret = license.load();
            const callback = readFileMethod.stub.args[0][1];
            callback(undefined, 'bad json data');

            return expect(ret).to.be.rejectedWith(error);
        });

        it('should throw an error if the license data is not valid', () => {
            const inputs = _testValues.allButSelected('undefined', 'function');
            const error = /.*License does not conform to expected schema.*<root>.*/;

            const result = Promise.map(inputs, (licenseData) => {
                const license = _createLicense();
                const readFileMethod = _fsMock.mocks.readFile;
                readFileMethod.reset();

                const ret = license.load();
                const callback = readFileMethod.stub.args[0][1];
                callback(undefined, JSON.stringify(licenseData));

                return expect(ret).to.be.rejectedWith(error);
            });

            return expect(result).to.be.fulfilled;
        });

        describe(
            '[license schema validation]',
            _generateLicenseSchemaValidationSuite((licenseData) => {
                const license = _createLicense();
                const readFileMethod = _fsMock.mocks.readFile;
                readFileMethod.reset();

                const ret = license.load();
                const callback = readFileMethod.stub.args[0][1];
                callback(undefined, JSON.stringify(licenseData));

                return ret;
            })
        );

        it('should store the license data in an internal property and resolve the promise', () => {
            const license = _createLicense();
            const readFileMethod = _fsMock.mocks.readFile;
            const newData = _generateLicenseData();

            license._data = _generateLicenseData();

            const ret = license.load();
            const callback = readFileMethod.stub.args[0][1];
            callback(undefined, JSON.stringify(newData));

            return expect(ret).to.be.fulfilled.then(() => {
                expect(license._data).to.deep.equal(newData);
            });
        });
    });

    describe('save()', () => {
        it('should return a promise when invoked', () => {
            const license = _createLicense();

            const ret = license.save();
            expect(ret).to.be.an('object');
            expect(ret.then).to.be.a('function');
        });

        it('should save the license file from the filesystem when invoked', () => {
            const licenseDir = _testValues.getString('licenseDir');
            const licenseFile = _path.join(licenseDir, LICENSE_FILE_NAME);
            const license = _createLicense(licenseDir);
            const writeFileMethod = _fsMock.mocks.writeFile;

            const licenseData = _generateLicenseData();

            license._data = licenseData;

            expect(writeFileMethod.stub).to.not.have.been.called;
            license.save();

            expect(writeFileMethod.stub).to.have.been.calledOnce;
            expect(writeFileMethod.stub.args[0]).to.have.length(3);
            expect(writeFileMethod.stub.args[0][0]).to.equal(licenseFile);
            expect(writeFileMethod.stub.args[0][1]).to.equal(
                JSON.stringify(licenseData)
            );
            expect(writeFileMethod.stub.args[0][2]).to.be.a('function');
        });

        it('should reject the promise if the license file write operation fails', () => {
            const error = 'Error writing license file';
            const license = _createLicense();
            const writeFileMethod = _fsMock.mocks.writeFile;

            const ret = license.save();
            const callback = writeFileMethod.stub.args[0][2];
            callback({
                code: 'ESOMETHINGWENTWRONG'
            });

            return expect(ret).to.be.rejectedWith(LicenseWriteError, error);
        });

        it('should resolve the promise if the file write operation succeeds', () => {
            const license = _createLicense();
            const writeFileMethod = _fsMock.mocks.writeFile;

            const ret = license.save();
            const callback = writeFileMethod.stub.args[0][2];
            callback();

            return expect(ret).to.be.fulfilled;
        });
    });

    describe('setData()', () => {
        it('should throw an error if licenseData is invalid', () => {
            const inputs = _testValues.allButObject();
            const error = 'Invalid licenseData (arg #1)';

            inputs.forEach((licenseData) => {
                const wrapper = () => {
                    const license = _createLicense();
                    license.setData(licenseData);
                };
                expect(wrapper).to.throw(error);
            });
        });

        describe(
            '[license schema validation]',
            _generateLicenseSchemaValidationSuite((licenseData) => {
                return Promise.try(() => _createLicense().setData(licenseData));
            })
        );

        it('should update the internal license data if the license data is valid', () => {
            const license = _createLicense();
            const licenseData = _generateLicenseData();

            expect(license._data).to.not.deep.equal(licenseData);

            license.setData(licenseData);

            expect(license._data).to.deep.equal(licenseData);
        });
    });

    describe('generateUpdateManifest()', () => {
        it('should throw an error if licenseData is invalid', () => {
            const inputs = _testValues.allButObject();
            const error = 'Invalid licenseData (arg #1)';

            inputs.forEach((licenseData) => {
                const wrapper = () => {
                    const license = _createLicense();
                    license.generateUpdateManifest(licenseData);
                };
                expect(wrapper).to.throw(error);
            });
        });

        describe(
            '[license schema validation]',
            _generateLicenseSchemaValidationSuite((licenseData) => {
                return Promise.try(() =>
                    _createLicense().generateUpdateManifest(licenseData)
                );
            })
        );

        it('should return an object with the expected properties when invoked', () => {
            const license = _createLicense();
            const licenseData = _generateLicenseData();

            const manifest = license.generateUpdateManifest(licenseData);

            expect(manifest).to.be.an('object');
            expect(manifest.installRecords).to.be.an('array');
            expect(manifest.uninstallRecords).to.be.an('array');
            expect(manifest.privateContainerRepos).to.be.an('array');
        });

        describe('[privateContainerRepos]', () => {
            it('should be an empty list if the containerRepos list is empty', () => {
                const license = _createLicense();
                const licenseData = _generateLicenseData();
                licenseData.components.forEach((component) => {
                    component.containerRepos = [];
                });

                const manifest = license.generateUpdateManifest(licenseData);

                expect(manifest.privateContainerRepos).to.deep.equal([]);
            });

            it('should generate a map of every repo to the serviceAccount and namespace that uses it', () => {
                const license = _createLicense();

                const licenseData = {
                    components: [
                        {
                            releaseName: 'release1',
                            chartName: 'chart1',
                            namespace: 'namespace1',
                            setOptions: [],
                            containerRepos: ['repo1', 'repo2'],
                            serviceAccounts: [
                                'account1',
                                'account2',
                                'account3'
                            ]
                        },
                        {
                            releaseName: 'release2',
                            chartName: 'chart2',
                            namespace: 'namespace2',
                            setOptions: [],
                            containerRepos: ['repo1', 'repo3'],
                            serviceAccounts: [
                                'account4',
                                'account5',
                                'account6'
                            ]
                        },
                        {
                            releaseName: 'release3',
                            chartName: 'chart3',
                            namespace: 'namespace1',
                            setOptions: [],
                            containerRepos: ['repo4'],
                            serviceAccounts: [
                                'account1',
                                'account2',
                                'account3'
                            ]
                        }
                    ]
                };

                const expectedRepoData = [
                    {
                        repoUri: 'repo1',
                        targets: [
                            {
                                serviceAccount: 'account1',
                                namespace: 'namespace1',
                                secretName: 'pca-repocred-account1-namespace1'
                            },
                            {
                                serviceAccount: 'account2',
                                namespace: 'namespace1',
                                secretName: 'pca-repocred-account2-namespace1'
                            },
                            {
                                serviceAccount: 'account3',
                                namespace: 'namespace1',
                                secretName: 'pca-repocred-account3-namespace1'
                            },
                            {
                                serviceAccount: 'account4',
                                namespace: 'namespace2',
                                secretName: 'pca-repocred-account4-namespace2'
                            },
                            {
                                serviceAccount: 'account5',
                                namespace: 'namespace2',
                                secretName: 'pca-repocred-account5-namespace2'
                            },
                            {
                                serviceAccount: 'account6',
                                namespace: 'namespace2',
                                secretName: 'pca-repocred-account6-namespace2'
                            }
                        ]
                    },
                    {
                        repoUri: 'repo2',
                        targets: [
                            {
                                serviceAccount: 'account1',
                                namespace: 'namespace1',
                                secretName: 'pca-repocred-account1-namespace1'
                            },
                            {
                                serviceAccount: 'account2',
                                namespace: 'namespace1',
                                secretName: 'pca-repocred-account2-namespace1'
                            },
                            {
                                serviceAccount: 'account3',
                                namespace: 'namespace1',
                                secretName: 'pca-repocred-account3-namespace1'
                            }
                        ]
                    },
                    {
                        repoUri: 'repo3',
                        targets: [
                            {
                                serviceAccount: 'account4',
                                namespace: 'namespace2',
                                secretName: 'pca-repocred-account4-namespace2'
                            },
                            {
                                serviceAccount: 'account5',
                                namespace: 'namespace2',
                                secretName: 'pca-repocred-account5-namespace2'
                            },
                            {
                                serviceAccount: 'account6',
                                namespace: 'namespace2',
                                secretName: 'pca-repocred-account6-namespace2'
                            }
                        ]
                    },
                    {
                        repoUri: 'repo4',
                        targets: [
                            {
                                serviceAccount: 'account1',
                                namespace: 'namespace1',
                                secretName: 'pca-repocred-account1-namespace1'
                            },
                            {
                                serviceAccount: 'account2',
                                namespace: 'namespace1',
                                secretName: 'pca-repocred-account2-namespace1'
                            },
                            {
                                serviceAccount: 'account3',
                                namespace: 'namespace1',
                                secretName: 'pca-repocred-account3-namespace1'
                            }
                        ]
                    }
                ];

                const manifest = license.generateUpdateManifest(licenseData);
                expect(manifest.privateContainerRepos).to.deep.equal(
                    expectedRepoData
                );
            });
        });

        describe('[uninstallRecords]', () => {
            it('should be an empty list if the the current license has no components', () => {
                const license = _createLicense();
                license._data = { components: [] };

                const licenseData = _generateLicenseData();
                const manifest = license.generateUpdateManifest(licenseData);

                expect(manifest.uninstallRecords).to.deep.equal([]);
            });

            it('should include every component that exists in the current license, but not in the new one', () => {
                const license = _createLicense();
                const oldLicenseData = _generateLicenseData();
                license._data = oldLicenseData;

                const licenseData = _generateLicenseData();
                const manifest = license.generateUpdateManifest(licenseData);

                const expectedUninstallRecords = oldLicenseData.components.map(
                    (component) => component.releaseName
                );
                expect(manifest.uninstallRecords).to.deep.equal(
                    expectedUninstallRecords
                );
            });

            it('should omit any components that exist in both the current and new licenses', () => {
                const license = _createLicense();
                const oldLicenseData = _generateLicenseData();
                license._data = oldLicenseData;

                const deletedComponents = oldLicenseData.components.filter(
                    (component, index) => index % 2
                );

                const licenseData = _generateLicenseData();
                oldLicenseData.components
                    .filter((component, index) => (index + 1) % 2)
                    .forEach((component) => {
                        licenseData.components.push(component);
                    });

                const manifest = license.generateUpdateManifest(licenseData);

                const expectedUninstallRecords = deletedComponents.map(
                    (component) => component.releaseName
                );
                expect(manifest.uninstallRecords).to.deep.equal(
                    expectedUninstallRecords
                );
            });
        });

        describe('[installRecords]', () => {
            it('should be an empty list if the the new license has no components', () => {
                const license = _createLicense();
                license._data = _generateLicenseData();

                const licenseData = { components: [] };
                const manifest = license.generateUpdateManifest(licenseData);

                expect(manifest.installRecords).to.deep.equal([]);
            });

            it('should include every component that exists in the new license', () => {
                const license = _createLicense();
                license._data = _generateLicenseData();

                const licenseData = _generateLicenseData();
                const manifest = license.generateUpdateManifest(licenseData);

                const expectedInstallRecords = licenseData.components.map(
                    (component) => ({
                        releaseName: component.releaseName,
                        chartName: component.chartName,
                        namespace: component.namespace,
                        setOptions: component.setOptions
                    })
                );
                expect(manifest.installRecords).to.deep.equal(
                    expectedInstallRecords
                );
            });

            it('should include components even if they already exist in the current license', () => {
                const license = _createLicense();
                const oldLicenseData = _generateLicenseData();
                license._data = oldLicenseData;

                const licenseData = _generateLicenseData();

                oldLicenseData.components
                    .filter((component, index) => index % 2)
                    .forEach((component) => {
                        licenseData.components.push(component);
                    });

                const manifest = license.generateUpdateManifest(licenseData);

                const expectedInstallRecords = licenseData.components.map(
                    (component) => ({
                        releaseName: component.releaseName,
                        chartName: component.chartName,
                        namespace: component.namespace,
                        setOptions: component.setOptions
                    })
                );
                expect(manifest.installRecords).to.deep.equal(
                    expectedInstallRecords
                );
            });
        });
    });
});
