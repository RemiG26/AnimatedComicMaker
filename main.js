const { app, BrowserWindow, Menu } = require('electron')
const ipc = require('electron').ipcMain

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