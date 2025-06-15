# AxonOps Workbench Command Line Interface (CLI)

The AxonOps Workbench CLI provides a powerful command-line interface that can be enabled by passing supported arguments while calling the workbench from CMD/Terminal.

## 🚀 Getting Started

From terminal/CMD, start the AxonOps Workbench and pass one or more of the following supported arguments. The workbench will automatically switch to CLI mode, otherwise the regular GUI mode will be started as usual.

```bash
./axonops-workbench -v # CLI Mode!

./axonops-workbench # Regular GUI Mode
```

## 📋 Supported Arguments

```
  --help, -h                                     > Print all supported          
                                                 arguments.                     
  --version, -v                                  > Print the current version of
                                                 AxonOps Workbench.             
  --list-workspaces                              > List all saved workspaces in
                                                 the workbench without their    
                                                 connections.                   
  --import-workspace String: JSON or File Path   > Import a workspace by either
                                                 directly passing a JSON        
                                                 string containing specific     
                                                 data, or by passing an         
                                                 absolute path of a file        
                                                 containing a valid JSON        
                                                 string.                        
  --list-connections String: Workspace ID        > List all saved connections   
                                                 in a specific workspace by     
                                                 passing its ID.                
  --import-connection String: JSON File Path     > Import a connection by       
                                                 passing an absolute path of a  
                                                 file containing a valid JSON   
                                                 string. Note: this action      
                                                 supports passing SSH tunnel    
                                                 info in a specific format, and
                                                 a cqlsh.rc file path,          
                                                 however, username and password
                                                 should be passed within the    
                                                 JSON string, if they exist in  
                                                 the cqlsh config file they     
                                                 will be ignored.               
  --test-connection Boolean: true or false       > For import-connection        
                                                 argument, test the connection  
                                                 about to be imported before    
                                                 finalizing the import process,
                                                 passing it with true value     
                                                 will stop the importing        
                                                 process in case the connection
                                                 has failed, otherwise,         
                                                 passing it without specifying  
                                                 a value or with false value    
                                                 will not stop the importing    
                                                 process, in both cases a       
                                                 feedback will be printed.      
  --delete-file                                  > For import-workspace and     
                                                 import-connection arguments,   
                                                 delete the provided file after
                                                 successful feedback.           
  --connect String: connection ID                > Connect directly to a saved  
                                                 connection and start a cqlsh   
                                                 session by passing its ID.     
```

## 📁 JSON Structure

### Workspace
```json
{
	"name":"",
	"color": "",
	"defaultPath": "",
	"path": ""
}
```
- `name` (Mandatory): The workspace's unique name, in case of duplication or invalidation a feedback will be shown.
- `color` (Optional): The workspace's dominant color, passed value can be any color format (HEX, RGB, HSL, etc..).
- `defaultPath` (Optional): Whether or not workspace's main folder (data) should be in the default path or not, accepted value is either `true` or `false`, it's `true` by default.
- `path` (Optional): An absolute path to create workspace's main folder (data) in it, to make the Workbench takes this attribute into account `defaultPath` attribute must be provided with `false` value.

This JSON structure can be passed directly, for example:
```bash
--import-workspace='{"name":"test"}'
```
And it also can be in file, and the absolute path to this file is passed, for example:
```bash
--import-workspace='/path/to/file'
```
`--delete-file` argument can be passed alongside this argument, it'll delete the passed JSON file in case the importing process has been finished with success.

### Connection

#### Apache Cassandra
```json
{
	"basic": {
		"workspace_id": "",
		"name": "",
		"datacenter": "",
		"hostname": "",
		"port": "",
		"timestamp_generator": "",
		"cqlshrc": ""
	},
	"auth": {
		"username": "",
		"password": ""
	},
	"ssl": {
		"ssl": "",
		"certfile": "",
		"userkey": "",
		"usercert": "",
		"validate": ""
	},
	"ssh": {
		"host": "",
		"port": "",
		"username": "",
		"password": "",
		"privatekey": "",
		"passphrase": "",
		"destaddr": "",
		"destport": ""
	}
}
```
- Only `workspace_id`, `name` and `hostname` attributes are mandatory, all other attributes are optional.
- `basic`.
  - `workspace_id`: The ID of the workspace which the connection will be imported to.
  - `name`: The name of the connection, must be unique within the scope of the passed workspace.
  - `datacenter`: Specify a data center to be set when activating the connection.
  - `hostname`: Host/IP to Cassandra node.
  - `port`: Connection port, it's `9042` by default.
  - `cqlshrc`: Absolute path to a valid `cqlsh.rc` file.
- `auth`.
  - `username`: Apache Cassandra authentication username.
  - `password`: Apache Cassandra authentication password.
- `ssl`.
  - `ssl`: Enable SSL/TLS connection.
  - `certfile`: Path to CA certificate file.
  - `userkey`: Path to user key file.
  - `usercert`: Path to user certificate file.
  - `validate`: Enable certificate validation.
- `ssh`.
  - `host`: SSH tunnel host.
  - `port`: SSH tunnel port.
  - `username`: SSH username.
  - `password`: SSH password.
  - `privatekey`: Path to SSH private key.
  - `passphrase`: SSH key passphrase.
  - `destaddr`: Destination address for tunnel.
  - `destport`: Destination port for tunnel.

#### Astra DB
```json
{
	"workspace_id": "",
	"name": "",
	"username": "clientId in AstraDB",
	"password": "secret in AstraDB",
	"scb_path": ""
}
```
- All attributes are required/mandatory.
- `username`: Represents `clientId` in AstraDB.
- `password`: Represents `secret` in AstraDB.
- `scb_path`: Absolute path to the secure connection bundle `.zip` file.

## 🔧 Test Connection
- Argument `--test-connection` can be passed alongside this `--import-connection` argument.
- Possible value is either `true` or `false`.
  - `true`: The importing process will be terminated in case the test process has finished with failure.
  - `false`: The importing process will be continued even if the test process has finished with failure.
- Default value is `false`.

## 🚀 Start a Connection
- Using the argument `--connect` we can start a connection immediately with all its complex parts - like creating an SSH tunnel first - by just passing the unique ID of the saved connection.
- Progress will be shown in the terminal.
- In case the connection has started, a cqlsh session will be opened within the same terminal instance.

## 🐧 Run AxonOps Workbench in Linux Headless Host (no GUI)

In order to use AxonOps Workbench in a headless Linux host, all you need to do is making sure the package `xvfb` is installed, running and exporting a display, it's available for most Linux distributions:

| Distribution  | Package Name           | Install Command                         |
| ------------- | ---------------------- | --------------------------------------- |
| Ubuntu/Debian | `xvfb`                 | `sudo apt install xvfb`                 |
| RHEL/CentOS   | `xorg-x11-server-Xvfb` | `sudo yum install xorg-x11-server-Xvfb` |
| Arch Linux    | `xorg-server-xvfb`     | `sudo pacman -S xorg-server-xvfb`       |
| Alpine        | `xvfb` (via community) | `apk add xvfb`                          |

Before running the workbench, run this command:
```bash
Xvfb :99 -screen 0 1280x720x24 & export DISPLAY=:99
```
And you're ready to go and run AxonOps Workbench in a headless Linux host!

## 📚 Examples

### Import Workspace and Connection
```bash
# Import a workspace
./axonops-workbench --import-workspace '{"name":"Production", "color":"#FF5733"}'

# List workspaces to get the ID
./axonops-workbench --list-workspaces

# Import a connection with test
./axonops-workbench --import-connection /path/to/connection.json --test-connection

# Connect to the database
./axonops-workbench --connect "connection-id"
```

### Automated Setup
```bash
#!/bin/bash
# Import workspace from file and delete after success
./axonops-workbench --import-workspace workspace.json --delete-file

# Import and test connection
./axonops-workbench --import-connection connection.json --test-connection --delete-file
```

## 🆘 Troubleshooting

- If connection import fails, verify all mandatory fields are present in the JSON
- For SSH connections, ensure private key has correct permissions (chmod 600)
- In headless mode, ensure Xvfb is running before starting the workbench
- Use `--test-connection` to validate connections before importing

## 📖 Additional Resources

- [AxonOps Workbench Documentation](https://docs.axonops.com/)
- [GitHub Issues](https://github.com/axonops/axonops-workbench/issues)
- [Community Discussions](https://github.com/axonops/axonops-workbench/discussions)