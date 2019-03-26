const ipc = require('electron').ipcRenderer
const Drag = require('../js/Drag')
const fs = require('fs')
const electron = require('electron')

let base_path = electron.remote.app.getPath('userData')

const active = require(base_path + '/bds/active.json')
const bd = require(`${base_path}/bds/${active.active}/${active.active}.json`)

// Global variables
let items = []
let selectionInput = document.querySelector('#selectionInput')
let selectionModal = document.querySelector('#selectionModal')

document.addEventListener('DOMContentLoaded', function(){
	// Insert image in DOM
	insertImages()

	// Init Drag onto images
	new Drag(items, 'img')

	getBds()

	// Materialiaze initalisations
	M.FloatingActionButton.init(document.querySelectorAll('.fixed-action-btn'))
	M.Modal.init(document.querySelectorAll('.modal'))
	M.FormSelect.init(selectionInput)
})

// Element's click listeners
document.querySelector('#close').addEventListener('click', () => {
	ipc.send('closeModification')
})

document.querySelector('#save').addEventListener('click', () => {
	saveConfig()
})

document.querySelector('#createBD').addEventListener('click', () => {
	ipc.send('newBD', {
		name: document.querySelector('#newBDName').value
	})
})

document.querySelector("#changeBD").addEventListener('click', () => {
	let value = getSelectedValue()
	if(value && value !== active.active)
		ipc.send('changeBD', {
			folder: value
		})
})

document.querySelector("#deleteBD").addEventListener('click', () => {
	let value = getSelectedValue()
	if(value)
		ipc.send('deleteBD', {
			folder: value
		})
})

document.querySelector('#addButton').addEventListener('click', () => {
	ipc.send('upload')
})

document.querySelector('#exportBD').addEventListener('click', () => {
	let selectedValue = getSelectedValue()
	ipc.once('zip:saved', () => {
		M.toast({html: "Zip file saved"})
	})
	ipc.send('exportBD', {
		bd: selectedValue
	})
})

document.querySelector('#exportBDS').addEventListener('click', () => {
	ipc.once('zip:saved', () => {
		M.toast({html: "Zip file saved"})
	})
	ipc.send('exportBDS')
})

// ipc listener
ipc.on('configSaved', () => {
	M.toast({html: "Configuration sauvée!"})
})

ipc.on('saveRequest', () => {
	saveConfig()
})

ipc.on('openModal', () => {
	let instance = M.Modal.getInstance(selectionModal)
	if(!instance.isOpen)
		instance.open()
})

// Functions
function insertImages()
{
	bd.forEach((image) => {
		let el = document.createElement("img")
		el.src = image.url
		el.classList.add('img')
		el.style.transform = `translate3d(${image.x}px, ${image.y}px, 0)`
		el.style.width = image.width + 'px'
		el.style.height = image.height + 'px'
		// Increase body size if image is overflowing
		if(document.body.offsetWidth < image.x + image.width)
			document.body.style.width = image.x + image.width + 20 + "px"
		if(document.body.offsetHeight < image.y + image.height)
			document.body.style.height = image.y + image.height + 20 + "px"
		document.body.appendChild(el)
		items.push(el)
	})
}

function getBds()
{
	let bdsPath = base_path + '/bds'
	let files = fs.readdirSync(bdsPath, {
		encoding: 'utf8',
		withFileTypes: true
	})
	if(files)
	{
		files.forEach(item => {
			if(item.isDirectory())
			{
				let option = document.createElement("option")
				option.innerText = item.name
				selectionInput.appendChild(option)
			}
		})
	}
}

function getSelectedValue()
{
	let instance = M.FormSelect.getInstance(selectionInput)
	let selectedOption = instance.wrapper.querySelector('.selected')
	return selectedOption.innerText || null
}

function saveConfig()
{
	let json = []
	items.forEach(item => {
		let p = Drag.getTransform(item)
		json.push({
			url: item.src,
			zIndex: parseInt(item.zIndex) || 0,
			width: item.offsetWidth,
			height: item.offsetHeight,
			x: p[0],
			y: p[1]
		})
	})
	ipc.send('save', { json })
}