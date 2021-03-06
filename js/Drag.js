const interact = require('interactjs')
const ipc = require('electron').ipcRenderer
const _ = require('underscore')

class Drag
{
	constructor(items, selector)
	{
		this.startPosition = null
		this.html = document.querySelector("html")
		this.items = items
		this.move = this.move.bind(this)
		this.endMove = this.endMove.bind(this)
		this.resize = this.resize.bind(this)
		this.hold = this.hold.bind(this)
		this.interactionStart = this.interactionStart.bind(this)
		interact(selector)
			.origin('self')
			.draggable({
				inertia: false,
				autoScroll: true,
				onmove: _.throttle(this.move, 16),
				onstart: this.interactionStart,
				onend: this.endMove
			})
			.resizable({
				edges: { right: true, bottom: true },
				inertia: false,
				onmove: _.throttle(this.resize, 16),
				onstart: this.interactionStart
			})
			.on('hold', this.hold)
	}

	move(e){
		let x = this.startPosition.x + e.clientX - e.clientX0 + this.html.scrollLeft
		let y = this.startPosition.y + e.clientY - e.clientY0 + this.html.scrollTop
		e.target.style.transform = `translate3D(${x}px, ${y}px, 0)`
	}

	endMove(e) {
		let t = e.target
		let pos = Drag.getTransform(t)
		let y = parseInt(pos[1])
		let x = parseInt(pos[0])
		let zIndex = parseInt(t.style.zIndex) || 0
		this.items.forEach((item) => {
			if(item.src !== t.src)
			{
				let ipos = Drag.getTransform(item)
				let iy = parseInt(ipos[1])
				let ix = parseInt(ipos[0])
				// Collision
				if(x < ix + item.offsetWidth &&
					x + t.offsetWidth > ix &&
					y < iy + item.offsetHeight &&
					y + t.offsetHeight > iy)
				{
					let itemIndex = parseInt(item.style.zIndex) || 0
					if(zIndex <= itemIndex)
					{
						t.style.zIndex = "" + (itemIndex + 1)
						zIndex = (itemIndex + 1)
					}
				}
			}
		})
		e.target.classList.remove('active')
	}

	hold(e)
	{
		ipc.send('deleteImage', {
			image: e.target.src
		})
	}

	resize (e) {
		e.target.style.width = e.rect.width + 'px'
		e.target.style.height = e.rect.height + 'px'
	}

	interactionStart(e) {
		e.target.classList.add('active')
		let rect = e.target.getBoundingClientRect()
		this.startPosition = {
			x: rect.x,
			y: rect.y,
		}
	}

	static getTransform(el) {
		let results = window.getComputedStyle(el).transform.match(/matrix(?:(3d)\(\d+(?:, \d+)*(?:, (\d+))(?:, (\d+))(?:, (\d+)), \d+\)|\(\d+(?:, \d+)*(?:, (\d+))(?:, (\d+))\))/)

		if(!results) return [0, 0, 0];
		if(results[1] === '3d') results = results.slice(2,5);
		else
		{
			results.push("0");
			results = results.slice(5, 8);
		}
		return results.map(i => parseInt(i))
	}
}

module.exports = Drag