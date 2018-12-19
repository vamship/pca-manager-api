import {
    argValidator as _argValidator,
    schemaHelper as _schemaHelper
} from '@vamship/arg-utils';
import _loggerProvider from '@vamship/logger';

import jobDescriptorSchema from '../schema/job-descriptor-schema';
import { IJobDescriptor, ILogger } from './types';

import _execa from 'execa';

const _checkJobDescriptorSchema = _schemaHelper.createSchemaChecker(
    jobDescriptorSchema,
    'JobDescriptor does not conform to expected schema'
);

// These secrets should have been created by a different process.
const HELM_CA_CERT_SECRET = 'pca-helm-ca-certificate';
const HELM_CERT_SECRET = 'pca-helm-certificate';

// Name of the container that will run the update job
const PCA_UPDATE_AGENT_CONTAINER = 'vamship/pca-update-agent:2.0.1';

/**
 * Class that can be used to launch a software updater job. Creates the
 * necessary Kubernetes config and job specification based on initialization
 * paramters, and executes the job.
 */
export default class SoftwareUpdaterJob {
    private _logger: ILogger;
    private _jobId: string;

    /**
     * @param jobId A unique id associated with the job
     */
    constructor(jobId: string) {
        _argValidator.checkString(jobId, 1, 'Invalid jobId (arg #1)');
        if (!jobId.match(/^[0-9a-z\-]+$/)) {
            throw new Error('Invalid jobId (arg #1)');
        }
        this._jobId = jobId;

        this._logger = _loggerProvider.getLogger('software-updater-job', {});
        this._logger.trace('SoftwareUpdaterJob initialized', { jobId });
    }

    /**
     * Configures and starts a Kubernetes job to perform upgrades on the server.
     *
     * @param descriptor A job descriptor that defines the parameters of the job
     *        to be executed.
     * @returns A promise that is rejected/resolved based on successful launch
     *          of the job.
     */
    public start(jobDescriptor: IJobDescriptor): Promise<any> {
        _argValidator.checkObject(
            jobDescriptor,
            'Invalid jobDescriptor (arg #1)'
        );
        _checkJobDescriptorSchema(jobDescriptor, true);

        this._logger.trace('Starting update job', {
            jobDescriptor
        });
        const {
            callbackEndpoint,
            credentialProviderEndpoint,
            credentialProviderAuthToken,
            manifest
        } = jobDescriptor;

        const configMapYaml = [
            'apiVersion: v1',
            'kind: ConfigMap',
            'metadata:',
            '  name: pca-agent-config',
            'data:',
            '  manifest: |',
            `    ${JSON.stringify(manifest)}`,
            ''
        ].join('\n');

        const jobYaml = [
            'apiVersion: batch/v1',
            'kind: Job',
            'metadata:',
            `  name: pca-agent-job-${this._jobId}`,
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

        this._logger.trace('Update job configmap YAML', {
            yaml: configMapYaml
        });
        return _execa(
            'kubectl',
            ['apply', '--namespace', 'kube-system', '-f', '-'],
            {
                input: configMapYaml
            }
        ).then(
            () => {
                this._logger.trace('Update job YAML', { yaml: jobYaml });
                return _execa(
                    'kubectl',
                    ['apply', '--namespace', 'kube-system', '-f', '-'],
                    {
                        input: jobYaml
                    }
                ).catch((ex) => {
                    this._logger.error(ex, 'Error creating update job');
                    throw new Error('Error creating update job');
                });
            },
            (err) => {
                this._logger.error(err, 'Error creating configmap');
                throw new Error('Error creating ConfigMap for update job');
            }
        );
    }

    /**
     * Cleans up an existing job. If the job does not exist, this command will
     * be ignored.
     */
    public cleanup() {
        this._logger.trace('Deleting job');
        return _execa('kubectl', [
            '--namespace',
            'kube-system',
            '--ignore-not-found',
            'true',
            'delete',
            'job',
            this._jobId
        ]).then(
            () => {
                this._logger.trace('Job successfully deleted');
            },
            (err) => {
                this._logger.error(err, 'Error deleting job');
                throw new Error('Error deleting update job');
            }
        );
    }
}
