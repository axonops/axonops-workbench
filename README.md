# AxonOps™ Workbench for Apache Cassandra®

AxonOps Workbench for Apache Cassandra is a desktop application built for Cassandra DB developers and DBAs. Seamlessly connect and interact with Apache Cassandra clusters while enjoying a host of innovative enhancements and exciting features. 

We welcome your feedback, so feel free to discuss any ideas you have https://github.com/axonops/axonops-workbench/discussions/categories/ideas or raise issues any issues (https://github.com/axonops/axonops-workbench/issues/new/choose)

## New CQL Console
![Enhanced_CQL_Console](https://github.com/user-attachments/assets/225cc8f3-d1e7-493c-bd73-b8186baa404d)

## Query Tracing
![Advanced_query_tracing](https://github.com/user-attachments/assets/346cbdc4-60f2-4482-9a57-874919a4f711)

## AI Assistant (Experimental)
![AI_Expert_Assistant](https://github.com/user-attachments/assets/41f737c4-7511-4732-8556-771a6dd8d8a3)

## Organise clusters into workspaces and securely add to source control for sharing
<img width="1678" alt="Screenshot 2025-08-23 at 10 07 50" src="https://github.com/user-attachments/assets/42be7bd5-6fa6-4881-8c30-42ab96c2ae45">

## Run local Cassandra clusters
<img width="1699" alt="Screenshot 2025-08-23 at 10 13 16" src="https://github.com/user-attachments/assets/0d3cdfe9-4266-4254-b9d1-54d90d7cbdfe">

## Built in SSH tunneling
<img width="981" alt="Screenshot 2025-08-23 at 07 50 46" src="https://github.com/user-attachments/assets/d26aee76-c34a-4495-a89b-85896e2590e5">

## Download and install

Browse to the [releases](https://github.com/axonops/axonops-workbench/releases) and select the package for your Operating System. We prebuild distributions for

- OSX (Intel and Apple chips)
- Linux (RedHat, Debian and others)
- Windows (Intel)

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

## Tidying up between beta release installs

The current builds are still in development and are not necessarily backwards compatible, so do this before taking a new beta release

### Linux and macOS:

- Delete the folder(s) with perfix .axonops- in the home folder.
- In the OS Keychain, remove all keys with prefix AxonOps.

### Windows:
- Delete the folder with prefix axonops- in the user directory folder C:\Users{username}.
- Delete the folder with prefix AxonOps in apps' data folder C:\Users{username}\AppData\Roaming or %appData%.
- In the Windows Credential Manager, remove all credentials with prefix AxonOps.
- In the registries - using the regedit tool -, navigate to Computer\HKEY_LOCAL_MACHINE\SOFTWARE\AxonOpsWorkbenchClustersSecrets - it can also be AxonOpsDeveloperWorkbenchClustersSecrets -, delete the entire key/folder.

## Development

If you would like to run it in development, please follow the instructions below.

### Requirements

- nodejs >= 20.15.0
- npm >= 10.7.0
- python >= 3.12

### Installation & Running

- Clone this repository
- Install python dependencies `pip3 install -r requirements.txt`
- Download CQLSH binaries from [axonops-workbench-cqlsh](https://github.com/axonops/axonops-workbench-cqlsh/releases/latest)
    - `cqlsh` binary has to be placed in `main/bin/cqlsh/cqlsh`
    - `keys_generator` binary has to be placed in `main/bin/keys_generator/keys_generator`
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

***

*This project may contain trademarks or logos for projects, products, or services. Any use of third-party trademarks or logos are subject to those third-party's policies. AxonOps is a registered trademark of AxonOps Limited. Apache, Apache Cassandra, Cassandra, Apache Spark, Spark, Apache TinkerPop, TinkerPop, Apache Kafka and Kafka are either registered trademarks or trademarks of the Apache Software Foundation or its subsidiaries in Canada, the United States and/or other countries.*

