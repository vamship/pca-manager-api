import _fs from 'fs';
import _path from 'path';

import {
    argValidator as _argValidator,
    schemaHelper as _schemaHelper
} from '@vamship/arg-utils';
import _loggerProvider from '@vamship/logger';
import { Promise } from 'bluebird';
import {
    IInstallRecord,
    IJobManifest,
    ILicense,
    ILogger,
    IPrivateContainerRepoRecord,
    ISoftwareComponent
} from './types';

import CorruptLicenseError from './corrupt-license-error';
import LicenseReadError from './license-read-error';
import LicenseWriteError from './license-write-error';

import licenseSchema from '../schema/license-schema';
const _checkLicenseSchema = _schemaHelper.createSchemaChecker(
    licenseSchema,
    'License does not conform to expected schema'
);

const LICENSE_FILE_NAME = '_license';

/**
 * Class that represents the current license on the server. Provides methods to
 * update license data, perform comparisons against existing license files, and
 * generate update manifests.
 */
export default class License {
    private _logger: ILogger;
    private _licenseDir: string;
    private _data: ILicense;
    private _readFileMethod: (fileName: string) => Promise<string>;
    private _writeFileMethod: (
        fileName: string,
        data: string
    ) => Promise<string>;

    /**
     * @param licenseDir The path to the directory containing the license file.
     */
    constructor(licenseDir: string) {
        _argValidator.checkString(licenseDir, 1, 'Invalid licenseDir (arg #1)');

        this._licenseDir = licenseDir;
        this._data = {
            components: []
        };

        this._logger = _loggerProvider.getLogger('license', {
            licenseDir
        });
        this._logger.trace('License initialized');

        this._readFileMethod = Promise.promisify(_fs.readFile.bind(_fs));
        this._writeFileMethod = Promise.promisify(_fs.writeFile.bind(_fs));
    }

    /**
     * Loads the current license file from disk. If the file does not exist,
     * defaults current license data to an empty object.
     *
     * @return A promise that is resolved/rejected based on the outcome of the
     *         load operation. If a license file does not exist, no error will
     *         be thrown.
     */
    public load(): Promise<any> {
        const licenseFile = _path.join(this._licenseDir, LICENSE_FILE_NAME);
        this._logger.trace('Reading license file', { licenseFile });
        return this._readFileMethod(licenseFile).then(
            (data) => {
                try {
                    this._logger.trace('Parsing license file contents');
                    data = JSON.parse(data);
                } catch (ex) {
                    const message = 'Error parsing license data';
                    this._logger.error(ex, message);
                    throw new Error(message);
                }

                this._performLicenseSchemaCheck(data);

                this._logger.trace('Setting license data from file');
                this._data = data;
            },
            (err) => {
                if (err.code !== 'ENOENT') {
                    const message = 'Error reading license file';
                    this._logger.error(err, message);
                    throw new LicenseReadError(message);
                }
                this._logger.warn(
                    'License file does not exist. Setting data to default value'
                );
                this._data = {
                    components: []
                };
            }
        );
    }

    /**
     * Saves the license data in the object to disk as the current license file.
     *
     * @return  A promise that is resolved/rejected based on the outcome of the
     *          save operation.
     */
    public save(): Promise<any> {
        const licenseFile = _path.join(this._licenseDir, LICENSE_FILE_NAME);
        this._logger.trace('Writing to license file', { licenseFile });
        return this._writeFileMethod(
            licenseFile,
            JSON.stringify(this._data)
        ).then(undefined, (err) => {
            const message = 'Error writing license file';
            this._logger.error(err, message);
            throw new LicenseWriteError(message);
        });
    }

    /**
     * Updates the current license data contained within this object.
     *
     * @param licenseData An object that defines the updated license.
     */
    public setData(licenseData: ILicense) {
        _argValidator.checkObject(licenseData, 'Invalid licenseData (arg #1)');
        this._performLicenseSchemaCheck(licenseData);
        this._data = licenseData;
    }

    /**
     * Compares the provided license data with current license data, and
     * generates an update manifest that can be passed to an update job.
     *
     * @param licenseData An object that defines the updated license.
     * @return An update manifest that can be passed to an update job that
     *         should bring the server into compliance with the new license.
     */
    public generateUpdateManifest(licenseData: ILicense): IJobManifest {
        _argValidator.checkObject(licenseData, 'Invalid licenseData (arg #1)');
        this._performLicenseSchemaCheck(licenseData);

        const { components: newComponents } = licenseData;
        const { components: oldComponents } = this._data;
        return {
            privateContainerRepos: this._buildContainerRepoList(newComponents),
            installRecords: this._buildInstallRecordList(
                oldComponents,
                newComponents
            ),
            uninstallRecords: this._buildUninstallRecordList(
                oldComponents,
                newComponents
            )
        };
    }

    /**
     * Generates an array of repository records based on a software component
     * list.
     *
     * @private
     * @param components A list of software components, typically extracted from
     *        a license document.
     * @return An array of private container repository records.
     */
    private _buildContainerRepoList(
        components: ISoftwareComponent[]
    ): IPrivateContainerRepoRecord[] {
        const repoMap = components
            .map((component) => {
                return component.containerRepos
                    .map((repoUri) => {
                        return component.serviceAccounts.map(
                            (serviceAccount) => ({
                                repoUri,
                                serviceAccount,
                                namespace: component.namespace
                            })
                        );
                    })
                    .reduce((result, item) => result.concat(item), []);
            })
            .reduce((result, item) => result.concat(item), [])
            .reduce((result, item) => {
                const { repoUri, namespace, serviceAccount } = item;
                const repoRecord = result[repoUri] || {
                    repoUri,
                    targets: []
                };
                result[repoUri] = repoRecord;
                repoRecord.targets.push({
                    namespace,
                    serviceAccount,
                    secretName: `pca-repocred-${serviceAccount}-${namespace}`
                });
                return result;
            }, {});

        return Object.keys(repoMap).map((key) => repoMap[key]);
    }

    /**
     * Generates an array of release names for components that have to be
     * uninstalled from the server.
     *
     * @private
     * @param oldComponent A list of existing software components.
     * @param newComponents A list of new software components.
     * @return An array of releases that have to be uninstalled.
     */
    private _buildUninstallRecordList(oldComponents, newComponents): string[] {
        return oldComponents
            .filter((oldComp) => {
                const compIndex = newComponents.findIndex(
                    (newComp) => newComp.releaseName === oldComp.releaseName
                );
                return compIndex < 0;
            })
            .map((component) => component.releaseName);
    }

    /**
     * Generates an array of component records for components that have to be
     * installed on the server.
     *
     * @private
     * @param oldComponent A list of existing software components.
     * @param newComponents A list of new software components.
     * @return An array of components that have to be installed.
     */
    private _buildInstallRecordList(
        oldComponents,
        newComponents
    ): IInstallRecord[] {
        return newComponents.map((component) => ({
            releaseName: component.releaseName,
            chartName: component.chartName,
            namespace: component.namespace,
            setOptions: component.setOptions
        }));
    }

    /**
     * Verifies the structure of license data.
     *
     * @private
     * @param data The license data to validate.
     */
    private _performLicenseSchemaCheck(data) {
        try {
            this._logger.trace('Validating license data');
            _checkLicenseSchema(data, true);
        } catch (ex) {
            this._logger.error(ex, 'Error validating license data');
            throw new CorruptLicenseError(ex.message);
        }
    }
}
