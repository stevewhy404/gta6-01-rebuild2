// Solmar Bay — input.js
// One job: keyboard and mouse state, with edge-triggered "just pressed" keys.

export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.pressed = new Set();
    this.mouse = { x: 0, y: 0, down: false, clicked: false };
    this.anyKey = false;
    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
      if (!e.repeat) {
        this.keys.add(e.code);
        this.pressed.add(e.code);
        this.anyKey = true;
      }
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.mouse.down = false;
    });
    canvas.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouse.x = e.clientX - r.left;
      this.mouse.y = e.clientY - r.top;
    });
    canvas.addEventListener('mousedown', (e) => {
      this.mouse.down = true;
      this.mouse.clicked = true;
      const r = canvas.getBoundingClientRect();
      this.mouse.x = e.clientX - r.left;
      this.mouse.y = e.clientY - r.top;
    });
    window.addEventListener('mouseup', () => { this.mouse.down = false; });
  }

  down(...codes) {
    return codes.some((c) => this.keys.has(c));
  }

  // True once, on the frame the key went down. Cleared by endFrame().
  justPressed(...codes) {
    return codes.some((c) => this.pressed.has(c));
  }

  // Movement axes: -1..1. WASD and arrows.
  moveX() {
    return (this.down('KeyD', 'ArrowRight') ? 1 : 0) - (this.down('KeyA', 'ArrowLeft') ? 1 : 0);
  }

  moveY() {
    return (this.down('KeyS', 'ArrowDown') ? 1 : 0) - (this.down('KeyW', 'ArrowUp') ? 1 : 0);
  }

  endFrame() {
    this.pressed.clear();
    this.mouse.clicked = false;
    this.anyKey = false;
  }
}
