from PyInstaller.utils.hooks import collect_all

datas, binaries, hiddenimports = collect_all('cassandra')

morePackages = ['secretstorage', 'pycryptodome', 'cryptography', 'idna', 'asn1crypto', 'cffi', 'pycparser', 'keyring', 'keyrings.alt', 'pywin32', 'pypiwin32']

for package in morePackages:
	try:
		secretstorageObj = collect_all(package)
		datas += secretstorageObj[0]
		binaries += secretstorageObj[1]
		hiddenimports += secretstorageObj[2]
	except:
		pass
