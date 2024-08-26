<img src="https://github.com/axonops/axonops-workbench-cassandra/assets/163300/0732fa17-37c5-4509-9595-a4163337680e" width="30" height="30"> THIS IS IN-DEVELOPMENT - DO NOT USE 
=======

# AxonOps™ Workbench for Apache Cassandra®

AxonOps Workbench for Apache Cassandra is a cutting-edge desktop application crafted exclusively for Cassandra DB developers and DBAs. Seamlessly connect and interact with Apache Cassandra clusters while enjoying a host of innovative enhancements and exciting features. Stay tuned for its highly anticipated first official release!

## New CQL Console
<img width="1709" alt="Screenshot 2024-08-23 at 07 45 40" src="https://github.com/user-attachments/assets/fc95976e-30f9-4760-ada9-1eb4711bfe73">

## Query Tracing
<img width="1708" alt="Screenshot 2024-08-23 at 07 45 55" src="https://github.com/user-attachments/assets/04d6af09-f2f7-45a4-ab8f-d259592d36c4">

## AI Assistant
<img width="1703" alt="Screenshot 2024-08-23 at 07 50 13" src="https://github.com/user-attachments/assets/83da8e29-6278-4094-ab21-2dba291fe9d6">

## Organise clusters into workspaces and securely add to source control for sharing
<img width="1678" alt="Screenshot 2024-08-23 at 10 07 50" src="https://github.com/user-attachments/assets/42be7bd5-6fa6-4881-8c30-42ab96c2ae45">

## Run local Cassandra clusters
<img width="1699" alt="Screenshot 2024-08-23 at 10 13 16" src="https://github.com/user-attachments/assets/0d3cdfe9-4266-4254-b9d1-54d90d7cbdfe">

## Built in SSH tunneling
<img width="981" alt="Screenshot 2024-08-23 at 07 50 46" src="https://github.com/user-attachments/assets/d26aee76-c34a-4495-a89b-85896e2590e5">

# Notice
Apache, Apache Cassandra, Cassandra, Apache Spark, Spark, Apache TinkerPop, TinkerPop, Apache Kafka and Kafka are either registered trademarks or trademarks of the Apache Software Foundation or its subsidiaries in Canada, the United States and/or other countries. The Apache Software Foundation has no affiliation with and does not endorse or review AxonOps Workbench.

## Download and install

Browse to the [releases](https://github.com/axonops/axonops-workbench-cassandra/releases) and select the package for your Operating System. We prebuild distributions for

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

### Installation & Running

- Clone this repository
- Run `npm i` to install the nodejs dependencies
- Execute `npm start` to run it in development mode

> **_NOTE:_** You can set the environment variable `AXONOPS_DEV_TOOLS=true` to open the developer tools on start up

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

