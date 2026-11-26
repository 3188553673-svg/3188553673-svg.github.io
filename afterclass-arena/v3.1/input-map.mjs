// One sampling order for local play, WebSocket transmission and host simulation.
export const INPUT_ACTIONS = ['left', 'right', 'up', 'down', 'attack', 'jump', 'dodge', 'skill', 'super', 'assist'];

export function inputMask(row) {
  return INPUT_ACTIONS.reduce((mask, action, index) => row?.[action] === true ? mask | (1 << index) : mask, 0);
}

const secondPlayer = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
for (const [index, action] of ['attack', 'jump', 'dodge', 'skill', 'super', 'assist'].entries()) {
  secondPlayer['Digit' + (index + 1)] = action;
  secondPlayer['Numpad' + (index + 1)] = action;
}

export const KEYMAP = [
  { KeyA: 'left', KeyD: 'right', KeyW: 'up', KeyS: 'down', KeyJ: 'attack', KeyK: 'jump', KeyL: 'dodge', KeyU: 'skill', KeyI: 'super', KeyO: 'assist' },
  secondPlayer
];
