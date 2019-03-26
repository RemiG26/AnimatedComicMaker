const { app, BrowserWindow, Menu, dialog } = require('electron')
const ipc = require('electron').ipcMain
const fs = require('fs')
const rimraf = require('rimraf')
const JSZip = require('jszip')

// Windows and other global variables
let mainWindow, codeWindow, modifyWindow
const base_path = app.getPath('userData')

// Create menus for each windows
const nativeMenusTemplate = [
	{
		label: 'Fichier',
		submenu: [
			{
				label: 'Modifier',
				accelerator: process.platform === 'darwin' ? 'Alt+Cmd+M' : 'Ctrl+Shift+M',
				click(){
					showDigicode()
				}
			},
			{
				label: "Quitter",
				accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
				click()
				{
					app.quit()
				}
			}
		]
	}
]
const modifyMenuTemplate = [
	{
		label: 'Fichier',
		submenu: [
			{
				label: "Enregistrer",
				accelerator: process.platform === 'darwin' ? 'Cmd+S' : 'Ctrl+S',
				click(){
					modifyWindow.webContents.send('saveRequest')
				}
			},
			{
				label: "Quitter la modification",
				accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
				click(){
					modifyWindow.close()
					mainWindow.reload()
					mainWindow.focus()
				}
			}
		]
	},
	{
		label: 'Editer',
		submenu: [
			{
				label: "Ajouter une image",
				accelerator: process.platform === 'darwin' ? 'Cmd+I' : 'Ctrl+I',
				click(){
					addImage()
				}
			},
			{
				label: "Gestion des BDs",
				accelerator: process.platform === 'darwin' ? 'Cmd+D' : 'Ctrl+D',
				click(){
					modifyWindow.webContents.send('openModal')
				}
			}
		]
	}
]
const nativeMenu = Menu.buildFromTemplate(nativeMenusTemplate)
const modifyMenu = Menu.buildFromTemplate(modifyMenuTemplate)
Menu.setApplicationMenu(nativeMenu)

// Create the main window
function createWindow(){
	let bdsPath = base_path + '/bds'
	let activePath = base_path + '/bds/active.json'
	if(!fs.existsSync(bdsPath))
	{
		fs.mkdirSync(bdsPath)
	}
	if(!fs.existsSync(activePath))
	{
		fs.writeFileSync(activePath, JSON.stringify({
			active: "default"
		}))
		fs.mkdirSync(bdsPath + '/default')
		fs.writeFileSync(bdsPath + '/default/default.json', "[]")
	}

	mainWindow = new BrowserWindow({
		fullscreen: true,
		frame: false
	})
	mainWindow.loadFile('views/index.html')
	mainWindow.on('closed', () => {
		mainWindow = null
	})
}

// Create and display a digicode to protect the modification page
function showDigicode() {
	if (codeWindow) {
		codeWindow.show()
	} else {
		codeWindow = new BrowserWindow({
			height: 500,
			resizable: false,
			width: 200,
			title: 'Code ?',
			minimizable: false,
			fullscreenable: false,
			parent: mainWindow,
			modal: true,
			frame: false
		})
		codeWindow.setMenu(null)
		codeWindow.loadFile('views/digicode.html')
	}
}

// Electron stuff to launch the app
app.on('ready', createWindow)
app.on('window-all-closed', () => {
	if(process.platform !== 'darwin')
		app.quit()
})
app.on('activate', () => {
	if(mainWindow === null)
		createWindow()
})

// Show file dialog to pick and image
function addImage()
{
	dialog.showOpenDialog(modifyWindow, {
		title: 'Ajoutez une image',

		properties: ['openFile']
	}, (files) => {
		if(files)
		{
			files.forEach(file => {
				uploadFile(file)
			})
		}
	})
}

/**
 * Save image in app
 * @param {string} file
 */
function uploadFile(file)
{
	let dirs = file.split('/')
	let name = dirs[dirs.length - 1]
	let active = JSON.parse("" + fs.readFileSync(base_path + '/bds/active.json'))
	let filepath = base_path + '/bds/'+ active.active + '/' + name
	fs.copyFileSync(file, filepath)
	let activeConfPath = `${base_path}/bds/${active.active}/${active.active}.json`
	let activeConf = JSON.parse(""+ fs.readFileSync(activeConfPath))
	activeConf.push({
		"url": filepath,
		"width": "50vw",
		"height": "50vh",
		"x": "0px",
		"y": "0px"
	})
	fs.writeFileSync(activeConfPath, JSON.stringify(activeConf))
	modifyWindow.reload()
}

/**
 * Get active.json content
 * @returns {Object}
 */
function getActive()
{
	let filepath = base_path + '/bds/active.json'
	return JSON.parse("" + fs.readFileSync(filepath))
}

/**
 * Replace active.json content
 * @param {Object} content
 */
function setActive(content)
{
	let filepath = base_path + '/bds/active.json'
	fs.writeFileSync(filepath, JSON.stringify(content))
}

function saveConfig(newConfig)
{
	let active = getActive()
	let filename = base_path + '/bds/' + active.active + '/' + active.active + '.json'
	fs.writeFileSync(filename, JSON.stringify(newConfig))
}

// Go back to main window
ipc.on('cancel', () => {
	codeWindow.hide()
	mainWindow.focus()
})

// Check the code and if correct show the modification page
ipc.on('validate', (e, data) => {
	if (data.code === 34000) {
		modifyWindow = new BrowserWindow({
			fullscreen: true,
			parent: mainWindow,
			modal: false,
			frame: false,
			webPreferences: {
				nodeIntegration: true
			}
		})
		modifyWindow.setMenu(modifyMenu)
		modifyWindow.loadFile('views/modify.html')
		modifyWindow.webContents.openDevTools()
		modifyWindow.on('closed', () => {
			modifyWindow = null
		})
		codeWindow.hide()
	} else {
		e.sender.send('errorReply', {
			error: 'Invalide!'
		})
	}
})

// Close the modification window and reload the main one to take effect of changes
ipc.on('closeModification', () => {
	modifyWindow.close()
	mainWindow.reload()
	mainWindow.focus()
})

// Insert new image
ipc.on('upload', () => {
	addImage()
})

// Create a new BD
ipc.on('newBD', (e, data) => {
	let dirpath = base_path + '/bds/' + data.name
	let filepath = dirpath + '/' + data.name + '.json'
	fs.mkdirSync(dirpath)
	fs.writeFileSync(filepath, "[]")
	setActive({
		active: data.name
	})
	modifyWindow.reload()
})

// Modify active BD by modifying active.json file
ipc.on('changeBD', (e, data) => {
	setActive({
		active: data.folder
	})
	modifyWindow.reload()
})

// Delete a BD and all files associated to it
ipc.on('deleteBD', (e, data) => {
	let bdsPath = fs.realpathSync('./bds')
	let dirs = fs.readdirSync(bdsPath, {
		encoding: 'utf8',
		withFileTypes: true
	})
	if(dirs)
	{
		dirs.forEach((item, index) => {
			if(item.name === data.folder)
			{
				rimraf.sync(bdsPath + '/' + data.folder)
				dirs.splice(index, 1)
				let active = {
					active: null
				}
				dirs.forEach((item) => item.isDirectory() ? active.active = item.name : null)
				setActive(active)
				modifyWindow.reload()
				return false
			}
		})
	}
})

// Save new state of bd
ipc.on('save', (e, data) => {
	saveConfig(data.json)
	e.sender.send('configSaved')
})

// Show dialog to confirm supression of image
ipc.on('deleteImage', (e, data) => {
	dialog.showMessageBox(modifyWindow, {
		type: "question",
		buttons: ["Annuler", "Ok"],
		title: "Attention",
		message: "Voulez-vous supprimer cette image ?"
	}, (response) => {
		if(response === 1) // Response is the index of the button clicked in this case 1 is "Ok"
		{
			let active = getActive()
			let filename = base_path + '/bds/' + active.active + '/' + active.active + '.json'
			let activeConfig = JSON.parse(fs.readFileSync(filename, JSON.stringify(data.json)))
			let image = data.image
			if(image.indexOf("file://") - 1)
			{
				// Transform data.image from "file:///home/..." to "/home/..."
				image = image.split('/')
				image.slice(0, 2)
				image = "" + image.join('/')
			}
			// Remove image from json config file
			activeConfig = activeConfig.filter(item => item.url !== image)
			fs.writeFileSync(filename, JSON.stringify(activeConfig))
			// Delete file
			fs.unlinkSync(image)
			modifyWindow.reload()
		}
	})
	e.sender.send('configSaved')
})

ipc.on('exportBD', (e, data) => {
	let filePath = dialog.showSaveDialog(modifyWindow, {
		title: 'Exporter tout',
		defaultPath: app.getPath('documents') + '/'+ data.bd +'.zip'
	})
	let bdPath = base_path + '/bds/' + data.bd
	const zip = new JSZip();
	let files = fs.readdirSync(bdPath, {
		encoding: 'utf8',
		withFileTypes: true
	})
	if(files) {
		files.forEach(item => {
			let f = fs.readFileSync(`${bdPath}/${item.name}`)
			zip.file(`${data.bd}/${item.name}`, f)
		})
		zip
			.generateNodeStream({
				type: 'nodebuffer',
				streamFiles: true
			})
			.pipe(fs.createWriteStream(filePath))
			.on('finish', () => {
				e.sender.send('zip:saved')
			})
	}
})

ipc.on('exportBDS', (e) => {
	let filePath = dialog.showSaveDialog(modifyWindow, {
		title: 'Exporter tout',
		defaultPath: app.getPath('documents') + '/bds.zip'
	})
	let bdsPath = base_path + '/bds'
	const zip = new JSZip();
	let files = fs.readdirSync(bdsPath, {
		encoding: 'utf8',
		withFileTypes: true
	})
	if(files) {
		files.forEach(item => {
			if (item.isDirectory()) {
				console.log(`${base_path}/bds/${item.name}`)
				let children = fs.readdirSync(`${base_path}/bds/${item.name}`, {
					encoding: 'utf8',
					withFileTypes: true
				})
				if(children)
				{
					children.forEach(c => {
						console.log(c)
						let contentFile = fs.readFileSync(`${base_path}/bds/${item.name}/${c.name}`)
						console.log(contentFile)
						zip.file(`bds/${item.name}/${c.name}`, contentFile)
					})
				}
			}
		})
		zip
			.generateNodeStream({
				type: 'nodebuffer',
				streamFiles: true
			})
			.pipe(fs.createWriteStream(filePath))
			.on('finish', () => {
				e.sender.send('zip:saved')
			})
	}
})