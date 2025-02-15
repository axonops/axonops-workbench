# AxonOps™ Workbench

[AxonOps Workbench](https://axonops.com/workbench/) is a desktop application built for Cassandra DB developers and DBAs. Kafka support is coming soon! 

Seamlessly connect and interact with Apache Cassandra clusters while enjoying a host of innovative enhancements and exciting features. 

We welcome your feedback, so feel free to discuss any ideas you have https://github.com/axonops/axonops-workbench/discussions/categories/ideas or raise issues any issues (https://github.com/axonops/axonops-workbench/issues/new/choose)

## Download and install

Go to https://axonops.com/workbench/download/ to download the latest release for your OS.

For MacOS it is also possible to install the AxonOps Workbench using [brew](https://brew.sh/)

```sh
# Optional: set applications directory to your $HOME
export HOMEBREW_CASK_OPTS="--appdir=~/Applications"
brew tap axonops/homebrew-repository
brew install --cask axonopsworkbench
```

If you'd like to use a `beta` release use instead

```sh
brew install --cask axonopsworkbench-beta
```

and for the daily internal builds (used for testing and development purposes) use

```sh
brew install --cask axonopsworkbench-internal
```

## Features

### New CQL Console
![Enhanced_CQL_Console](https://github.com/user-attachments/assets/225cc8f3-d1e7-493c-bd73-b8186baa404d)

### Query Tracing
![Advanced_query_tracing](https://github.com/user-attachments/assets/346cbdc4-60f2-4482-9a57-874919a4f711)

### AI Assistant (Experimental)
![AI_Expert_Assistant](https://github.com/user-attachments/assets/41f737c4-7511-4732-8556-771a6dd8d8a3)

### Organise clusters into workspaces and securely add to source control for sharing
<img width="1678" alt="Screenshot 2024-08-23 at 10 07 50" src="https://github.com/user-attachments/assets/42be7bd5-6fa6-4881-8c30-42ab96c2ae45">

### Run local Cassandra clusters
<img width="1699" alt="Screenshot 2024-08-23 at 10 13 16" src="https://github.com/user-attachments/assets/0d3cdfe9-4266-4254-b9d1-54d90d7cbdfe">

### Built in SSH tunneling
<img width="981" alt="Screenshot 2024-08-23 at 07 50 46" src="https://github.com/user-attachments/assets/d26aee76-c34a-4495-a89b-85896e2590e5">

## Software Bill of Materials (SBOM)

This project provides Software Bill of Materials (SBOM) files with each release, offering transparency into our software components and dependencies. SBOMs help users and organizations understand exactly what components are included in our software, enabling better security and compliance management.

**Available SBOM Formats**
- CycloneDX (sbom.cyclonedx.json): A lightweight SBOM standard that provides detailed component information and security context
- SPDX (sbom.spdx.json): A comprehensive format focusing on software licensing and component identification

**Benefits of Our SBOM**
- Security: Easily identify and track known vulnerabilities in dependencies
- Compliance: Verify license obligations for all included components
- Transparency: Clear visibility into the software supply chain
- Risk Management: Better understand and assess potential risks in the software stack

You can find our SBOM files in each [release](releases) as part of the release artifacts. These files are automatically generated during our build process to ensure they remain current with each release.

**Using SBOM Files**
- Download the SBOM file in your preferred format from the release assets
- Use SBOM analysis tools like:
  - `cyclonedx-cli` for CycloneDX files
  - `spdx-tools` for SPDX files
- Integrate with your security and compliance workflows
- Monitor for vulnerabilities in included components

We maintain these SBOM files as part of our commitment to software supply chain security and transparency. They are updated with each release to reflect the current state of our software dependencies.

## Development

If you would like to run it in development, please follow the instructions below.

### Requirements

- nodejs >= 20.15.0
- npm >= 10.7.0
- python >= 3.12

### Installation & Running

- Clone this repository
- Install python dependencies `pip3 install -r requirements.txt`
- Install required tools by running `./install_tools.sh`. It will download CQLSH binaries from [axonops-workbench-cqlsh](https://github.com/axonops/axonops-workbench-cqlsh/releases/latest).
- Run `npm i` to install the nodejs dependencies
- Execute `npm start` to run it in development mode

### Debugging

- You can set the environment variable `AXONOPS_DEV_TOOLS=true` to open the developer tools on start up
- Using VSCode, you can use `Main + Renderer` compound launch configuration to debug main process and rendereres simultaneously

### Packaging

If you'd like to create your own distribution package, you will need to install `electron-builder` and then run the following:

```sh
# builds linux deb, rpm and tar.gz
npm run linux
# OSX dmg and zip
npm run mac
# windows
npm run win
```

See the `packages.json` for other build options.

### Tidying up between beta release installs

The current builds are still in development and are not necessarily backwards compatible, so do this before taking a new beta release

#### Linux and macOS:

- Delete the folder(s) with perfix .axonops- in the home folder.
- In the OS Keychain, remove all keys with prefix AxonOps.

#### Windows:
- Delete the folder with prefix axonops- in the user directory folder C:\Users{username}.
- Delete the folder with prefix AxonOps in apps' data folder C:\Users{username}\AppData\Roaming or %appData%.
- In the Windows Credential Manager, remove all credentials with prefix AxonOps.
- In the registries - using the regedit tool -, navigate to Computer\HKEY_LOCAL_MACHINE\SOFTWARE\AxonOpsWorkbenchClustersSecrets - it can also be AxonOpsDeveloperWorkbenchClustersSecrets -, delete the entire key/folder.


***

*This project may contain trademarks or logos for projects, products, or services. Any use of third-party trademarks or logos are subject to those third-party's policies. AxonOps is a registered trademark of AxonOps Limited. Apache, Apache Cassandra, Cassandra, Apache Spark, Spark, Apache TinkerPop, TinkerPop, Apache Kafka and Kafka are either registered trademarks or trademarks of the Apache Software Foundation or its subsidiaries in Canada, the United States and/or other countries. Elasticsearch is a trademark of Elasticsearch B.V., registered in the U.S. and in other countries. Docker is a trademark or registered trademark of Docker, Inc. in the United States and/or other countries.*

