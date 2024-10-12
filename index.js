const FS = require('fs'),
	Path = require('path'),
	Marked = require('marked')
	
FS.readFile(Path.join(__dirname, 'File.md'), (err, data) => {
	let content = data.toString()
	
	let contentHTML = Marked.parse(`${content}`)
	
	FS.writeFile(Path.join(__dirname, 'test.html'), `${contentHTML}`, (err) => {
		console.log("Finished");
	})
})