import { Connector, ConnectorError, logger } from '@sailpoint/connector-sdk'
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
    private readonly cloudDisplayName?: string
    config: Configuration

    constructor(config: any) {
        const tokenUrl = new URL(config.baseurl).origin + TOKEN_URL_PATH
        this.config = new Configuration({ ...config, tokenUrl })
        this.config.retriesConfig = axiosOptions['axios-retry']
        this.sourceID = config.sourceId
        this.cloudDisplayName = config.cloudDisplayName
    }

    async getAllAccounts(): Promise<any[]> {
        try {
            const api = new AccountsApi(this.config)
            const filters1 = `sourceId eq "${this.sourceID}"`
            const response = await Paginator.paginate(api, api.listAccounts, { filters: filters1 })
            return response.data
        } catch (error) {
            logger.error(`Error in getAllAccounts: ${error}`)
            throw new ConnectorError('Failed to fetch accounts')
        }
    }

    async getAccount(identity: string): Promise<any> {
        try {
            const api = new AccountsApi(this.config)
            const filters1 = `sourceId eq "${this.sourceID}" and nativeIdentity eq "${identity}"`
            const response = await api.listAccounts({ filters: filters1 })
            return response.data[0]
        } catch (error) {
            logger.error(`Error in getAccount: ${error}`)
            throw new ConnectorError('Failed to fetch account')
        }
    }

    async enableAccount(identity: string): Promise<any> {
        return this.toggleAccountStatus(identity, false)
    }

    async disableAccount(identity: string): Promise<any> {
        return this.toggleAccountStatus(identity, true)
    }

    private async toggleAccountStatus(identity: string, disable: boolean): Promise<any> {
        try {
            const api = new AccountsApi(this.config)
            const filters1 = `sourceId eq "${this.sourceID}" and nativeIdentity eq "${identity}"`
            const response = await api.listAccounts({ filters: filters1 })
            const accountId = response.data[0].id as string
            const body = [
                {
                    op: JsonPatchOperationOpEnum.Replace,
                    path: '/attributes/IIQDisabled',
                    value: disable,
                },
            ]
            const apiCall = (await api.updateAccount({ id: accountId, jsonPatchOperation: body })).status
            if (apiCall >= 200 && apiCall < 300) {
                return response.data[0]
            } else {
                throw new ConnectorError(
                    `Failed to ${disable ? 'disable' : 'enable'} account. Please check if IIQDisabled is in your schema attribute`
                )
            }
        } catch (error) {
            logger.error(`Error in toggleAccountStatus: ${error}`)
            throw new ConnectorError(
                `Failed to ${disable ? 'disable' : 'enable'} account. Please check if IIQDisabled is in your schema attribute`
            )
        }
    }

    async createAccount(attributes: Record<string, any>): Promise<any> {
        try {
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
        } catch (error) {
            logger.error(`Error in createAccount: ${error}`)
            throw new ConnectorError('Failed to create account')
        }
    }

    async updateAccount(identity: string, attributes: Record<string, any>): Promise<any> {
        try {
            const api = new AccountsApi(this.config)
            const filters1 = `sourceId eq "${this.sourceID}" and nativeIdentity eq "${identity}"`
            const response = await api.listAccounts({ filters: filters1 })
            const accountId = response.data[0].id as string
            const accountAttributes: AccountAttributes = {
                attributes: attributes
            }
            logger.info(`Updating account ${accountId} with attributes ${JSON.stringify(accountAttributes)}`)
            return (await api.putAccount({ id: accountId, accountAttributes })).data
        } catch (error) {
            logger.error(`Error in updateAccount: ${error}`)
            throw new ConnectorError('Failed to update account')
        }
    }

    async getAllEntitlements(): Promise<any[]> {
        try {
            const api = new EntitlementsBetaApi(this.config)
            const filters1 = `source.id eq "${this.sourceID}"`
            const response = await Paginator.paginate(api, api.listEntitlements, { filters: filters1 })
            return response.data
        } catch (error) {
            logger.error(`Error in getAllEntitlements: ${error}`)
            throw new ConnectorError('Failed to fetch entitlements')
        }
    }

    async getSchema(): Promise<any> {
        try {
            const api = new SourcesApi(this.config)
            const sourceId = this.sourceID as string
            const schemasResponse = await api.getSourceSchemas({ sourceId })
            const schemas = schemasResponse.data

            // Step 1: Create schemas that are referenced by account schema
            for (const schema of schemas) {
                if (schema.name !== 'account' && schema.id !== undefined) {
                    await this.createSchema(schema)
                }
            }

            // Step 2: Process and return the account schema 
            for (const schema of schemas) {
                if (schema.name === 'account') {
                    return this.processAccountSchema(schema)
                }
            }
            return null
        } catch (error) {
            logger.error(`Error in getSchema: ${error}`)
            throw new ConnectorError('Failed to get schema')
        }
    }

    private async getCurrentSourceId(): Promise<string> {
        const api = new SourcesApi(this.config)
        const filters1 = `name eq "${this.cloudDisplayName}"`
        const sourceId = (await api.listSources({ filters: filters1 })).data[0].id as string
        return sourceId
    }

    private async createSchema(schema: any): Promise<any> {
        try {
            const sourceId = await this.getCurrentSourceId()
            const api = new SourcesApi(this.config)

            // Check if schema exists
            const schemas = await api.getSourceSchemas({ sourceId })
            const existingSchema = schemas.data.find((s: any) => s.name === schema.name)
            if (existingSchema) {
                return existingSchema
            } else {
                // Create the schema
                const groupSchema = (await api.getSourceSchema({ sourceId: this.sourceID as string, schemaId: schema.id })).data
                const response = await api.createSourceSchema({ sourceId, schema: groupSchema })
                return response.data
            }
        } catch (error) {
            logger.error(`Error in createSchema: ${error}`)
            throw new ConnectorError('Failed to create schema')
        }
    }

    private processAccountSchema(schema: any) {
        return {
            identityAttribute: schema.identityAttribute,
            displayAttribute: schema.displayAttribute,
            groupAttribute: schema.attributes?.find((attr: any) => attr.isGroup)?.name || null,
            attributes: [
                ...(schema.attributes?.map((attr: any) => ({
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
    }
}
