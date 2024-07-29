[![Discourse Topics][discourse-shield]][discourse-url]
[![Issues][issues-shield]][issues-url]
[![Latest Releases][release-shield]][release-url]
[![Contributor Shield][contributor-shield]][contributors-url]

[discourse-shield]:https://img.shields.io/discourse/topics?label=Discuss%20This%20Tool&server=https%3A%2F%2Fdeveloper.sailpoint.com%2Fdiscuss
[discourse-url]:https://developer.sailpoint.com/discuss/tag/workflows
[issues-shield]:https://img.shields.io/github/issues/sailpoint-oss/repo-template?label=Issues
[issues-url]:https://github.com/sailpoint-oss/repo-template/issues
[release-shield]: https://img.shields.io/github/v/release/sailpoint-oss/repo-template?label=Current%20Release
[release-url]:https://github.com/sailpoint-oss/repo-template/releases
[contributor-shield]:https://img.shields.io/github/contributors/sailpoint-oss/repo-template?label=Contributors
[contributors-url]:https://github.com/sailpoint-oss/repo-template/graphs/contributors

# ISC SaaS Delimited File Connector Readme
[Explore the docs »](https://developer.sailpoint.com/discuss/t/delimited-file-saas-connector/74759)

[New to the CoLab? Click here »](https://developer.sailpoint.com/discuss/t/about-the-sailpoint-developer-community-colab/11230)


## Overview

The ISC SaaS Delimited File Connector enables seamless integration with a delimited source in Identity Security Cloud, providing a robust set of operations for managing accounts and entitlements.

## Supported Operations
- `Test Connection`: Verifies the connectivity to the delimited file source using PAT token.
- `Account Aggregation`: Retrieves a list of all accounts from the delimited file source.
- `Single Account Aggregation`: Fetches details for a specified account.
- `Entitlement Aggregation`: Gathers a list of all entitlements from the delimited file source.
- `Attribute Sync`: Updates attributes for an existing account.
- `Account Provisioning`: Creates a new account in the delimited file source and provisions or deprovisions entitlements.
- `Enable Account`: Activates a specified account, setting `IIQDisabled` to `false` (Requires `IIQDisabled` in delimited source schema).
- `Disable Account`: Deactivates a specified account, setting `IIQDisabled` to `true`(Requires `IIQDisabled` in delimited source schema).
- `Discover Schema`: Identifies the data schema of the delimited file source.

## Configuration
To configure the connector, follow these steps:

### 1. Source Configuration

To configure the connector, you will need to set up the following parameters in the `Source Configuration`:

- IdentityNow Connection Details:

    + `Base URL`: Enter the IdentityNow API URL.
    + `Client ID`: Provide your Personal Access Token ID.
    + `Client Secret`: Input your Personal Access Token secret.

- Configuration Details:

    + `Source ID`: Input the source ID for the delimited file source.

### 2. Discovering Schema
To discover the schema, follow these steps:
- Go to `Source Configuaration` > `Account Management` > `Account Schema`
- Click on `Discover Schema`
- Select `Account ID` and `Account Name` from the dropdown menu

### 3. Create Account Profile
After discovering the schema, you can create a Create Account Profile by following these steps:
- Go to `Source Configuaration` > `Account Management` > `Create Account`
- Do the account attributes mapping for create account operation


<!-- CONTRIBUTING -->
## Contributing

Contributions are what make the open source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

If you have a suggestion that would make this better, please fork the repo and create a pull request. You can also simply open an issue with the tag `enhancement`.
Don't forget to give the project a star! Thanks again!

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

<!-- LICENSE -->
## License

Distributed under the MIT License. See `LICENSE.txt` for more information.

<!-- CONTACT -->
## Discuss
[Click Here](https://developer.sailpoint.com/discuss/t/delimited-file-saas-connector/74759) to discuss this tool with other users.
