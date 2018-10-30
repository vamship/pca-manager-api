/**
 * The schema object for job descriptors.
 */
export default {
    $schema: 'http://json-schema.org/draft-07/schema#',
    description: 'Schema for the update job descriptor',
    type: 'object',
    required: [
        'callbackEndpoint',
        'credentialProviderEndpoint',
        'credentialProviderAuthToken',
        'manifest'
    ],
    properties: {
        callbackEndpoint: {
            type: 'string',
            minLength: 1,
            pattern: '^(.+)$'
        },
        credentialProviderEndpoint: {
            type: 'string',
            minLength: 1,
            pattern: '^(.+)$'
        },
        credentialProviderAuthToken: {
            type: 'string',
            minLength: 1,
            pattern: '^(.+)$'
        },
        manifest: {
            type: 'object',
            required: [
                'privateContainerRepos',
                'installRecords',
                'uninstallRecords'
            ],
            properties: {
                privateContainerRepos: {
                    type: 'array',
                    items: {
                        type: 'object',
                        required: ['repoUri', 'targets'],
                        properties: {
                            repoUri: {
                                type: 'string',
                                minLength: 1,
                                pattern: '^(.+)$'
                            },
                            targets: {
                                type: 'array',
                                minItems: 1,
                                items: {
                                    type: 'object',
                                    required: [
                                        'serviceAccount',
                                        'namespace',
                                        'secretName'
                                    ],
                                    properties: {
                                        serviceAccount: {
                                            type: 'string',
                                            minLength: 1,
                                            pattern: '^(.+)$'
                                        },
                                        namespace: {
                                            type: 'string',
                                            minLength: 1,
                                            pattern: '^(.+)$'
                                        },
                                        secretName: {
                                            type: 'string',
                                            minLength: 1,
                                            pattern: '^(.+)$'
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                uninstallRecords: {
                    type: 'array',
                    items: {
                        type: 'string',
                        minLength: 1,
                        pattern: '^(.+)$'
                    }
                },
                installRecords: {
                    type: 'array',
                    items: {
                        type: 'object',
                        required: [
                            'releaseName',
                            'chartName',
                            'setOptions',
                            'namespace'
                        ],
                        properties: {
                            releaseName: {
                                type: 'string',
                                minLength: 1,
                                pattern: '^(.+)$'
                            },
                            chartName: {
                                type: 'string',
                                minLength: 1,
                                pattern: '^(.+)$'
                            },
                            namespace: {
                                type: 'string',
                                minLength: 1,
                                pattern: '^(.+)$'
                            },
                            setOptions: {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    required: ['key', 'value'],
                                    properties: {
                                        key: {
                                            type: 'string',
                                            minLength: 1,
                                            pattern: '^(.+)$'
                                        },
                                        value: {
                                            type: 'string',
                                            minLength: 1,
                                            pattern: '^(.+)$'
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
};
