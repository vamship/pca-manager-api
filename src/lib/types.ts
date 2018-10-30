/**
 * @module app
 */

/**
 * Interface for logger objects.
 */
export interface ILogger {
    /**
     * Trace logger method.
     */
    trace: (message: string, args?: {}) => void;

    /**
     * Debug logger method.
     */
    debug: (message: string, args?: {}) => void;

    /**
     * Info logger method.
     */
    info: (message: string, args?: {}) => void;

    /**
     * Warn logger method.
     */
    warn: (message: string, args?: {}) => void;

    /**
     * Error logger method.
     */
    error: (message: string, args?: {}) => void;

    /**
     * Fatal logger method.
     */
    fatal: (message: string, args?: {}) => void;

    /**
     * Child method.
     */
    child: (props: any) => ILogger;
}

/**
 * Represents parameters that need to be passed to the job to ensure successful
 * execution.
 */
export interface IJobDescriptor {
    /**
     * An HTTP endpoint that can be invoked by the job to report logs, success
     * and failure.
     */
    callbackEndpoint: string;

    /**
     * An HTTP endpoint that can provide the job with a set of credentials
     * required for access to software components.
     */
    credentialProviderEndpoint: string;

    /**
     * An authorization token to allow the job to authenticate against the
     * credential provider.
     */
    credentialProviderAuthToken: string;

    /**
     * An object that describes the actions to be performed by the job.
     */
    manifest: IJobManifest;
}

/**
 * Defines the actions that need to performed by a job on launch.
 */
export interface IJobManifest {
    /**
     * An array of records that define the private containers accessed by the
     * job, and the service accounts that need access to these containers.
     */
    privateContainerRepos: IPrivateContainerRepoRecord[];

    /**
     * A list of components that need to be uninstalled by the job.
     */
    uninstallRecords: string[];

    /**
     * An array of records that describe the software components that have to
     * be installed by the job.
     */
    installRecords: IInstallRecord[];
}

/**
 * Defines the record structure for private container repos accessed by the
 * job.
 */
export interface IPrivateContainerRepoRecord {
    /**
     * The uri of the container repo being accessed.
     */
    repoUri: string;

    /**
     * An array of targets, defining the service account and namespace that will
     * require access to the repo.
     */
    targets: ICredentialTarget[];
}

/**
 * Describes the target that will require credentials to access private
 * resources.
 */
export interface ICredentialTarget {
    /**
     * The service account that will be accessing the resource.
     */
    serviceAccount: string;

    /**
     * The namespace in which the service account resides.
     */
    namespace: string;

    /**
     * The name of the secret that contains the credentials.
     */
    secretName: string;
}

/**
 * Defines a record that describes a software component that needs to be
 * installed by the job.
 */
export interface IInstallRecord {
    /**
     * A unique name to assign to the software release.
     */
    releaseName: string;

    /**
     * The name of the helm chart for the software component.
     */
    chartName: string;

    /**
     * The namespace in which the component will be installed.
     */
    namespace: string;

    /**
     * An array of options to be used when installing the chart.
     */
    setOptions: Array<{
        key: string;
        value: string;
    }>;
}

/**
 * Defines a license document that describes the various software components
 * that need to be installed.
 */
export interface ILicense {
    /**
     * A list of software components defined by the license.
     */
    components: ISoftwareComponent[];
}

/**
 * Defines a software component record that represents a single software
 * component running on the server. A server will typically run several software
 * components, that work together to deliver meaningful functionality.
 */
export interface ISoftwareComponent {
    /**
     * The name of the software component release. This uniquely identifies a
     * single instance of a component.
     */
    releaseName: string;

    /**
     * The name of the helm chart that can be used to install the component.
     */
    chartName: string;

    /**
     * The namespace into which the component will be deployed.
     */
    namespace: string;

    /**
     * An array of options to be used when installing the chart.
     */
    setOptions: Array<{
        key: string;
        value: string;
    }>;

    /**
     * A list of docker repo URIs referenced by the chart.
     */
    containerRepos: string[];

    /**
     * A list of service accounts that will be running pods/services for the
     * software component.
     */
    serviceAccounts: string[];
}
