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
import LicenseLoadError from './license-load-error';

import licenseSchema from '../schema/license-schema';
const _checkLicenseSchema = _schemaHelper.createSchemaChecker(
    licenseSchema,
    'License does not conform to expected schema'
);

import _execa from 'execa';

/**
 * Class that represents the current license on the server. Provides methods to
 * update license data, perform comparisons against existing license files, and
 * generate update manifests.
 */
export default class License {
    private _logger: ILogger;
    private _data: ILicense;

    /**
     */
    constructor() {
        this._data = {
            components: []
        };

        this._logger = _loggerProvider.getLogger('license');
        this._logger.trace('License initialized');
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
        this._logger.trace('Listing installed components');

        return _execa('helm', ['list', '--short', '--tls']).then(
            (data) => {
                this._logger.trace('Splitting component list into array');
                const components = data.stdout
                    .split('\n')
                    .filter((component) => !component.startsWith('pca-'))
                    .map((releaseName) => ({ releaseName }));

                this._logger.trace('Setting license data from file');
                this._data = {
                    components
                };
            },
            (err) => {
                const message = 'Error listing installed components';
                this._logger.error(err, message);
                throw new LicenseLoadError(message);
            }
        );
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
