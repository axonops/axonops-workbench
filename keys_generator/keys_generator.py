# Cassandra Workbench tool to generate RSA keys,
# that will be used to encrypt/decrypt credentials securely with cqlsh tool

from platform import system
from keyring import get_password, set_password, set_keyring, backends
from Crypto.PublicKey import RSA

if system() == 'Windows':
   set_keyring(backends.Windows.WinVaultKeyring()) 

# First, attempt get the keys from the OS keychain
publicKey, privateKey = get_password("AxonOpsDeveloperWorkbenchPublicKey", "key"), \
                        get_password("AxonOpsDeveloperWorkbenchPrivateKey", "key")

# Check that they're saved in the OS keychain and valid if so
# If not, then create both keys
if publicKey is None or privateKey is None or \
        len(publicKey) != 271 or len(privateKey) != 886:
    keys = RSA.generate(1024)  # The longer the length, the stronger the keys are

    # Get public and private keys,
    # encode them with base64, and convert them from bytes to string
    publicKey, privateKey = keys.publickey().exportKey(), keys.exportKey()
    publicKey, privateKey = publicKey.decode("utf-8"), privateKey.decode("utf-8")

    # Now set both keys in the OS keychain
    set_password(
        "AxonOpsDeveloperWorkbenchPublicKey",
        "key", publicKey)
    set_password(
        "AxonOpsDeveloperWorkbenchPrivateKey",
        "key", privateKey)

# Print the public key
print(publicKey)
