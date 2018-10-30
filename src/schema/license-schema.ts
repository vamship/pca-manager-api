/**
 * The schema object for license objects
 */
export default {
    $schema: 'http://json-schema.org/draft-07/schema#',
    description: 'Schema for license data',
    type: 'object',
    required: ['components'],
    properties: {
        components: {
            type: 'array',
            items: {
                type: 'object',
                required: [
                    'releaseName',
                    'chartName',
                    'namespace',
                    'setOptions',
                    'serviceAccounts',
                    'containerRepos'
                ],
                properties: {
                    releaseName: {
                        type: 'string',
                        minLength: 1,
                        pattern: '^(.+)$'
                    },
                    namespace: {
                        type: 'string',
                        minLength: 1,
                        pattern: '^(.+)$'
                    },
                    chartName: {
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
                    },
                    containerRepos: {
                        type: 'array',
                        items: {
                            type: 'string',
                            minLength: 1,
                            pattern: '^(.+)$'
                        }
                    },
                    serviceAccounts: {
                        type: 'array',
                        items: {
                            type: 'string',
                            minLength: 1,
                            pattern: '^(.+)$'
                        }
                    }
                }
            }
        }
    }
};
