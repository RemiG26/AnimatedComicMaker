const { app, BrowserWindow, Menu, dialog } = require('electron')
const ipc = require('electron').ipcMain
const path = require('path')
const fs = require('fs')
const fsPromises = require('fs').promises
const rimraf = require('rimraf')

const nativeMenus = [
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
					mainWindow.close()
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
			modal: true,
			frame: false
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
					modal: false,
					frame: false
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
				ipc.on('deleteBD', (e, data) => {
					let filepath = base_path + '/bds/active.json'
					let active = JSON.parse(fs.readFileSync(filepath))
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
								dirs.forEach((item) => item.isDirectory() ? active.active = item.name : null)
								fs.writeFileSync(filepath, JSON.stringify(active))
								modifyWindow.reload()
								return false
							}
						})
					}
				})
				ipc.on('save', (e, data) => {
					let active = JSON.parse(fs.readFileSync(base_path + '/bds/active.json'))
					let filename = base_path + '/bds/' + active.active + '/' + active.active + '.json'
					fs.writeFileSync(filename, JSON.stringify(data.json))
				})
				ipc.on('deleteImage', (e, data) => {
					dialog.showMessageBox(modifyWindow, {
						type: "question",
						buttons: ["Annuler", "Ok"],
						title: "Attention",
						message: "Voulez-vous supprimer cette image ?"
					}, (response) => {
						if(response === 1)
						{
							let active = JSON.parse(fs.readFileSync(base_path + '/bds/active.json'))
							let filename = base_path + '/bds/' + active.active + '/' + active.active + '.json'
							let config = JSON.parse(fs.readFileSync(filename, JSON.stringify(data.json)))
							let image = data.image.split('/')
							image.shift()
							image.shift()
							image = image.join('/')
							console.log(image)
							config = config.filter(item => item.url !== image)
							fs.writeFileSync(filename, JSON.stringify(config))
							fs.unlinkSync(image)
							modifyWindow.reload()
						}
					})
				})
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
		fullscreen: true,
		frame: false
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