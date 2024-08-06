import { ConnectorError, logger } from '@sailpoint/connector-sdk'
import { AxiosError, AxiosRequestConfig } from 'axios'
import axiosRetry from 'axios-retry'

import {
    Configuration,
    Paginator,
    AccountsApi,
    EntitlementsBetaApi,
    SourcesApi,
    JsonPatchOperationOpEnum,
    AccountAttributes,
} from 'sailpoint-api-client'

const TOKEN_URL_PATH = '/oauth/token'
const BATCH_SIZE = 15
const retries = 10

const retryCondition = (error: AxiosError): boolean => {
    return axiosRetry.isRetryableError(error) || (error.response ? error.response.status === 429 : false)
}

const retryDelay = (retryCount: number, error: AxiosError<unknown, any>, delayFactor?: number | undefined): number => {
    if (error.response && error.response.headers['retry-after']) {
        return error.response.headers['retry-after'] * 1000
    } else {
        return axiosRetry.exponentialDelay(retryCount, error, delayFactor)
    }
}

const axiosOptions: AxiosRequestConfig = {
    'axios-retry': {
        retries,
        retryDelay,
        retryCondition,
    },
}

export class MyClient {
    private readonly sourceID?: string
    config: Configuration

    constructor(config: any) {
        const tokenUrl = new URL(config.baseurl).origin + TOKEN_URL_PATH
        this.config = new Configuration({ ...config, tokenUrl })
        this.config.retriesConfig = axiosOptions['axios-retry']
        this.sourceID = config.sourceId
    }

    async getAllAccounts(): Promise<any[]> {
        const api = new AccountsApi(this.config)
        const filters1 = `sourceId eq "${this.sourceID}"`
        const response = await Paginator.paginate(api, api.listAccounts, {
            filters: filters1,
        })
        return response.data
    }

    async getAccount(identity: string): Promise<any> {
        const api = new AccountsApi(this.config)
        const filters1 = `sourceId eq "${this.sourceID}" and nativeIdentity eq "${identity}"`
        const response = await api.listAccounts({ filters: filters1 })
        return response.data[0]
    }

    async enableAccount(identity: string): Promise<any> {
        const api = new AccountsApi(this.config)
        const filters1 = `sourceId eq "${this.sourceID}" and nativeIdentity eq "${identity}"`
        const response = await api.listAccounts({ filters: filters1 })
        const accountId = (await response).data[0].id as string
        const body = [
            {
                op: JsonPatchOperationOpEnum.Replace,
                path: '/attributes/IIQDisabled',
                value: false,
            },
        ]
        const apiCall = (await api.updateAccount({ id: accountId, jsonPatchOperation: body })).status
        try {
            const apiCall = (await api.updateAccount({ id: accountId, jsonPatchOperation: body })).status
            if (apiCall >= 200 && apiCall < 300) {
                return response.data[0]
            }
            else
            {
                throw new ConnectorError(
                    'Failed to disable account. Please check if IIQDisabled is in your schema attribute'
                )
            }
        } catch (e) {
            throw new ConnectorError(
                'Failed to disable account. Please check if IIQDisabled is in your schema attribute'
            )
        }
    }

    async disableAccount(identity: string): Promise<any> {
        const api = new AccountsApi(this.config)
        const filters1 = `sourceId eq "${this.sourceID}" and nativeIdentity eq "${identity}"`
        const response = await api.listAccounts({ filters: filters1 })
        const accountId = (await response).data[0].id as string
        const body = [
            {
                op: JsonPatchOperationOpEnum.Replace,
                path: '/attributes/IIQDisabled',
                value: true,
            },
        ]
        try {
            const apiCall = (await api.updateAccount({ id: accountId, jsonPatchOperation: body })).status
            if (apiCall >= 200 && apiCall < 300) {
                return response.data[0]
            }
            else{
                throw new ConnectorError(
                    'Failed to disable account. Please check if IIQDisabled is in your schema attribute'
                )
            }
        } catch (e) {
            throw new ConnectorError(
                'Failed to disable account. Please check if IIQDisabled is in your schema attribute'
            )
        }
    }

    async createAccount(attributes: Record<string, any>): Promise<any> {
        const createAccountPayload = {
            accountAttributesCreate: {
                attributes: {
                    sourceId: this.sourceID as string,
                    ...attributes,
                },
            },
        }

        const api = new AccountsApi(this.config)
        return (await api.createAccount(createAccountPayload)).data
    }

    async updateAccount(identity: string, attributes: Record<string, any>): Promise<any> {
        const api = new AccountsApi(this.config)
        const filters1 = `sourceId eq "${this.sourceID}" and nativeIdentity eq "${identity}"`
        const response = await api.listAccounts({ filters: filters1 })
        const accountId = (await response).data[0].id as string
        const accountAttributes: AccountAttributes = {
            attributes: attributes
        };
        logger.info(`Updating account ${accountId} with attributes ${JSON.stringify(accountAttributes)}`)
        return (await api.putAccount({ id: accountId, accountAttributes })).data;
    }

    async getAllEntitlements(): Promise<any[]> {
        const api = new EntitlementsBetaApi(this.config)
        const filters1 = `source.id eq "${this.sourceID}"`
        const response = await Paginator.paginate(api, api.listEntitlements, {
            filters: filters1,
        })
        return response.data
    }

    async getSchema(): Promise<any> {
        const api = new SourcesApi(this.config)
        const sourceId = this.sourceID as string
        const response = await api.getSourceSchemas({ sourceId: sourceId })
        for (const schema of response.data) {
            if (schema.name == 'account') {
                const genericSchema = {
                    identityAttribute: schema.identityAttribute,
                    displayAttribute: schema.displayAttribute,
                    groupAttribute: schema.attributes?.find((attr) => attr.isGroup)?.name || null,
                    attributes: [
                        ...(schema.attributes?.map((attr) => ({
                            name: attr.name,
                            description: attr.description || attr.name, // Use attribute name if description is null
                            type: attr.type?.toLowerCase(),
                            ...(attr.isMulti && { multi: attr.isMulti }),
                            ...(attr.isEntitlement && { entitlement: attr.isEntitlement }),
                            ...(attr.isGroup && { managed: true }),
                        })) || []),
                        {
                            name: 'accountID',
                            type: 'string',
                            description: 'Account ID from the source',
                        },
                    ],
                }
                return genericSchema
            }
        }
        return null
    }
}
