const { app, BrowserWindow, Menu, dialog } = require('electron')
const ipc = require('electron').ipcMain
const path = require('path')
const fs = require('fs')
const fsPromises = require('fs').promises

const nativeMenus = [
	{
		label: 'Modifier',
		submenu: [
			{
				label: 'Modifier',
				accelerator: process.platform === 'darwin' ? 'Alt+Cmd+M' : 'Ctrl+Shift+M',
				click(){
					showDigicode()
				}
			}
		]
	}
]

const menu = Menu.buildFromTemplate(nativeMenus)
Menu.setApplicationMenu(menu)

let mainWindow, codeWindow, modifyWindow

const base_path = path.resolve(__dirname)

function showDigicode() {
	if (codeWindow) {
		codeWindow.show()
	} else {
		codeWindow = new BrowserWindow({
			height: 400,
			resizable: false,
			width: 200,
			title: 'Code ?',
			minimizable: false,
			fullscreenable: false,
			parent: mainWindow,
			modal: true
		})
		codeWindow.loadFile('views/digicode.html')
		ipc.on('cancel', () => {
			codeWindow.hide()
			mainWindow.focus()
		})
		ipc.on('validate', (e, data) => {
			if (data.code === 34000) {
				modifyWindow = new BrowserWindow({
					fullscreen: true,
					parent: mainWindow,
					modal: false
				})
				modifyWindow.loadFile('views/modify.html')
				ipc.on('close', () => {
					modifyWindow.close()
					mainWindow.reload()
				})
				ipc.on('upload', () => {
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
				})
				ipc.on('newBD', (e, data) => {
					let dirpath = base_path + '/bds/' + data.name
					let filepath = dirpath + '/' + data.name + '.json'
					fs.mkdirSync(dirpath)
					fs.writeFileSync(filepath, "[]")
					let activePath = base_path + '/bds/active.json'
					let active = JSON.parse(fs.readFileSync(activePath))
					active.active = data.name
					fs.writeFileSync(activePath, JSON.stringify(active))
					modifyWindow.reload()
				})
				ipc.on('changeBD', (e, data) => {
					let filepath = base_path + '/bds/active.json'
					let active = JSON.parse(fs.readFileSync(filepath))
					active.active = data.folder
					fs.writeFileSync(filepath, JSON.stringify(active))
					modifyWindow.reload()
				})
				ipc.on('save', (e, data) => {
					let active = JSON.parse(fs.readFileSync(base_path + '/bds/active.json'))
					let filename = base_path + '/bds/' + active.active + '/' + active.active + '.json'
					fs.writeFileSync(filename, JSON.stringify(data.json))
				})
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
	}
}

function uploadFile(file)
{
	let dirs = file.split('/')
	let name = dirs[dirs.length - 1]
	let active = JSON.parse(fs.readFileSync(base_path + '/bds/active.json'))
	let filepath = base_path + '/bds/'+ active.active + '/' + name
	fsPromises.copyFile(file, filepath)
		.then(() => {
			fsPromises.readFile(base_path + '/bds/'+ active.active + '/' + active.active +'.json')
				.then(data => {
					let newImage =   {
						"url": filepath,
						"width": "50vw",
						"height": "50vh",
						"x": "0px",
						"y": "0px"
					}
					let config = JSON.parse(data)
					config.push(newImage)
					fsPromises.writeFile(base_path + '/bds/'+ active.active +'/' + active.active + '.json', JSON.stringify(config))
						.then(() => {
							modifyWindow.reload()
						})
						.catch((err) => console.log(err))
				})
				.catch(err => {
					console.log(err)
					dialog.showErrorBox("Erreur lors de l'importation", "Erreur lors de la lecture du fichier de configuration")
				})

		})
		.catch((err) => {
			console.log(err)
			dialog.showErrorBox("Erreur lors de l'importation", "Erreur lors de la copie de l'image")
		})
}

function createWindow(){
	mainWindow = new BrowserWindow({
		fullscreen: true
	})
	mainWindow.loadFile('views/index.html')
	mainWindow.on('closed', () => {
		mainWindow = null
	})
}

app.on('ready', createWindow)

app.on('window-all-closed', () => {
	if(process.platform !== 'darwin')
		app.quit()
})

app.on('activate', () => {
	if(mainWindow === null)
		createWindow()
})