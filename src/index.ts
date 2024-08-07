import {
    Context,
    createConnector,
    readConfig,
    Response,
    logger,
    StdAccountListOutput,
    StdAccountReadInput,
    StdAccountReadOutput,
    StdTestConnectionOutput,
    StdAccountListInput,
    StdTestConnectionInput,
    StdEntitlementListInput,
    StdEntitlementListOutput,
    StdAccountDiscoverSchemaOutput,
    StdAccountCreateInput,
    StdAccountCreateOutput,
    StdAccountEnableInput,
    StdAccountEnableOutput,
    StdAccountDisableInput,
    StdAccountDisableOutput,
    StdAccountUpdateInput,
    StdAccountUpdateOutput,
    Attributes,
} from '@sailpoint/connector-sdk'
import { MyClient } from './my-client'

// Connector must be exported as module property named connector
export const connector = async () => {
    // Get connector source config
    const config = await readConfig()

    // Use the vendor SDK, or implement own client as necessary, to initialize a client
    const myClient = new MyClient(config)

    return createConnector()
        .stdTestConnection(
            async (context: Context, input: StdTestConnectionInput, res: Response<StdTestConnectionOutput>) => {
                logger.info('Test successful!')
                res.send({})
            }
        )
        .stdAccountList(async (context: Context, input: StdAccountListInput, res: Response<StdAccountListOutput>) => {
            const accounts = await myClient.getAllAccounts()
            const identityAttribute = input.schema?.identityAttribute as string
            const displayAttribute = input.schema?.displayAttribute as string
            const schemaAttributes = input.schema?.attributes?.map((attr: { name: string }) => attr.name) || []
            
            for (const account of accounts) {
                const accountAttributes: { [key: string]: any } = {}

                // Dynamically construct account attributes based on schema
                for (const attribute of schemaAttributes) {
                    accountAttributes[attribute] = account.attributes[attribute]
                }

                // Add additional account attributes
                accountAttributes['accountID'] = account.id

                res.send({
                    identity: account.attributes[identityAttribute],
                    uuid: account.attributes[displayAttribute],
                    attributes: accountAttributes,
                })
            }
            logger.info(`stdAccountList sent ${accounts.length} accounts`)
        })

        .stdAccountRead(async (context: Context, input: StdAccountReadInput, res: Response<StdAccountReadOutput>) => {
            logger.info(`stdAccountRead input: ${JSON.stringify(input.key)}`)
            logger.info(`stdAccountRead input: ${input.identity}`)
            const account = await myClient.getAccount(input.identity)
            const identityAttribute = input.schema?.identityAttribute as string
            const displayAttribute = input.schema?.displayAttribute as string
            const schemaAttributes = input.schema?.attributes?.map((attr: { name: string }) => attr.name) || []
            const accountAttributes: { [key: string]: any } = {}

            // Dynamically construct account attributes based on schema
            for (const attribute of schemaAttributes) {
                accountAttributes[attribute] = account.attributes[attribute]
            }

            // Add additional account attributes
            accountAttributes['accountID'] = account.id

            res.send({
                identity: account.attributes[identityAttribute],
                uuid: account.attributes[displayAttribute],
                attributes: accountAttributes,
            })

            logger.info(`stdAccountRead read account : ${input.identity}`)
        })

        .stdEntitlementList(
            async (context: Context, input: StdEntitlementListInput, res: Response<StdEntitlementListOutput>) => {
                logger.info(`stdEntitlementList input: ${JSON.stringify(input)}`)
                const entitlements = await myClient.getAllEntitlements()
                for (const entitlement of entitlements) {
                    res.send({
                        type: input.type,
                        identity: entitlement.value,
                        uuid: entitlement.name,
                        attributes: entitlement.attributes as Attributes
                    })
                }
                logger.info(`stdEntitlementList sent ${entitlements.length} entitlements`)
            }
        )

        .stdAccountDiscoverSchema(
            async (context: Context, input: undefined, res: Response<StdAccountDiscoverSchemaOutput>) => {
                const schema = await myClient.getSchema()
                res.send(schema)
                logger.info(`stdAccountDiscoverSchema sent schema: ${JSON.stringify(schema)}`)
            }
        )

        .stdAccountCreate(
            async (context: Context, input: StdAccountCreateInput, res: Response<StdAccountCreateOutput>) => {
                logger.info(`stdAccountCreate input: ${JSON.stringify(input)}`)

                const { attributes, schema, identity } = input
                const inputAny = input as any

                // Determine the identity attribute from the schema
                const identityAttribute = schema?.identityAttribute || 'id'

                // Get the value of the identity attribute
                const identityValue = inputAny.key?.simple?.['id'] || attributes[identityAttribute] || identity

                // Initialize the output object
                const output: StdAccountCreateOutput = {
                    key: {
                        simple: {
                            id: identityValue,
                        },
                    },
                    attributes: {
                        [identityAttribute]: identityValue,
                    },
                    disabled: false,
                    locked: false,
                }

                // Prepare attributes for the target system
                const accountAttributesCreate: Record<string, any> = {
                    [identityAttribute]: identityValue,
                }

                // Process each attribute according to the schema
                for (const attr of schema?.attributes || []) {
                    const { name, entitlement, multi } = attr

                    if (attributes[name] !== undefined) {
                        if (entitlement && multi) {
                            // Handle multi-valued entitlements
                            output.attributes[name] = Array.isArray(attributes[name])
                                ? attributes[name]
                                : [attributes[name]]
                            accountAttributesCreate[name] = output.attributes[name]
                        } else if (entitlement) {
                            // Handle single-valued entitlements
                            output.attributes[name] = attributes[name]
                            accountAttributesCreate[name] = attributes[name]
                        } else {
                            // Handle regular attributes
                            output.attributes[name] = attributes[name]
                            accountAttributesCreate[name] = attributes[name]
                        }
                    }
                }

                // Ensure the identity attribute is in the accountAttributesCreate
                accountAttributesCreate[identityAttribute] = identityValue

                const response = await myClient.createAccount(accountAttributesCreate)

                // Ensure the identity attribute is in the output attributes
                output.attributes[identityAttribute] = identityValue

                logger.info(`Account created successfully on target system: ${JSON.stringify(response)}`)

                // Return the created account information
                res.send(output)
            }
        )
        .stdAccountUpdate(
            async (context: Context, input: StdAccountUpdateInput, res: Response<StdAccountUpdateOutput>) => {
                logger.info(`stdAccountUpdate input: ${JSON.stringify(input)}`)
                const identityAttribute = input.schema?.identityAttribute as string
                const displayAttribute = input.schema?.displayAttribute as string
                const schemaAttributes = input.schema?.attributes?.map((attr: { name: string }) => attr.name) || []

                // Get the current account state
                let account = await myClient.getAccount(input.identity)
                let updatedAttributes: Record<string, any> = { ...account.attributes }

                // Process changes
                for (const change of input.changes) {
                    switch (change.op) {
                        case 'Set':
                            updatedAttributes[change.attribute] = change.value
                            break
                        case 'Add':
                            if (Array.isArray(updatedAttributes[change.attribute])) {
                                if (Array.isArray(change.value)) {
                                    updatedAttributes[change.attribute] = [
                                        ...new Set([...updatedAttributes[change.attribute], ...change.value]),
                                    ]
                                } else {
                                    if (!updatedAttributes[change.attribute].includes(change.value)) {
                                        updatedAttributes[change.attribute].push(change.value)
                                    }
                                }
                            } else {
                                logger.warn(`Cannot add to non-array attribute: ${change.attribute}`)
                            }
                            break
                        case 'Remove':
                            if (Array.isArray(updatedAttributes[change.attribute])) {
                                if (Array.isArray(change.value)) {
                                    updatedAttributes[change.attribute] = updatedAttributes[change.attribute].filter(
                                        (item: any) => !change.value.includes(item)
                                    )
                                } else {
                                    updatedAttributes[change.attribute] = updatedAttributes[change.attribute].filter(
                                        (item: any) => item !== change.value
                                    )
                                }
                            } else {
                                updatedAttributes[change.attribute] = null
                            }
                            break
                        default:
                            logger.warn(`Unknown operation: ${change.op}`)
                    }
                }

                // Ensure all schema attributes are included, even if they weren't changed
                for (const attribute of schemaAttributes) {
                    if (!(attribute in updatedAttributes)) {
                        updatedAttributes[attribute] = account.attributes[attribute]
                    }
                }

                // Update the account on the target system
                await myClient.updateAccount(input.identity, updatedAttributes)

                // Prepare the response
                const response = {
                    identity: account.attributes[identityAttribute],
                    uuid: account.attributes[displayAttribute],
                    attributes: updatedAttributes,
                }

                res.send(response)
                logger.info(`Account updated successfully on target system: ${JSON.stringify(response)}`)
            }
        )
        .stdAccountEnable(
            async (context: Context, input: StdAccountEnableInput, res: Response<StdAccountEnableOutput>) => {
                const account = await myClient.enableAccount(input.identity)
                const identityAttribute = input.schema?.identityAttribute as string
                const displayAttribute = input.schema?.displayAttribute as string
                const schemaAttributes = input.schema?.attributes?.map((attr: { name: string }) => attr.name) || []
                const accountAttributes: { [key: string]: any } = {}

                // Dynamically construct account attributes based on schema
                for (const attribute of schemaAttributes) {
                    accountAttributes[attribute] = account.attributes[attribute]
                }

                // Add additional account attributes
                accountAttributes['accountID'] = account.id

                const response = {
                    identity: account.attributes[identityAttribute],
                    uuid: account.attributes[displayAttribute],
                    attributes: accountAttributes,
                }

                res.send(response)
                logger.info(`Account enabled successfully on target system: ${JSON.stringify(response)}`)
            }
        )

        .stdAccountDisable(
            async (context: Context, input: StdAccountDisableInput, res: Response<StdAccountDisableOutput>) => {
                const account = await myClient.disableAccount(input.identity)
                const accountAttributes: { [key: string]: any } = {}
                const identityAttribute = input.schema?.identityAttribute as string
                const displayAttribute = input.schema?.displayAttribute as string
                const schemaAttributes = input.schema?.attributes?.map((attr: { name: string }) => attr.name) || []

                // Dynamically construct account attributes based on schema
                for (const attribute of schemaAttributes) {
                    accountAttributes[attribute] = account.attributes[attribute]
                }

                // Add additional account attributes
                accountAttributes['accountID'] = account.id

                const response = {
                    identity: account.attributes[identityAttribute],
                    uuid: account.attributes[displayAttribute],
                    attributes: accountAttributes,
                }

                res.send(response)
                logger.info(`Account disabled successfully on target system: ${JSON.stringify(response)}`)
            }
        )
}
