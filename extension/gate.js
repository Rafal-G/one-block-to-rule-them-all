import { QUOTES } from './quotes.js';
const $ = selector => document.querySelector(selector);
const quote = QUOTES[crypto.getRandomValues(new Uint32Array(1))[0] % QUOTES.length];
$('#quote').textContent = `“${quote.text}”`;
$('#attribution').textContent = `${quote.author} · ${quote.work}`;
$('#leave').addEventListener('click', () => { location.replace('https://search.brave.com/'); });
async function send(type) {
  const result = await chrome.runtime.sendMessage({ type });
  if (result.error) throw new Error(result.error);
  return result;
}
try {
  const state = await send('start');
  $('#domain').textContent = new URL(state.target).hostname;
  if (state.mode === 'blocked') {
    $('#heading').textContent = 'You shall not pass.';
    $('#eyebrow').textContent = 'THIS PATH IS CLOSED';
    $('#description').textContent = 'You chose to keep this website out of your day. There are better adventures ahead.';
  } else {
    $('#heading').textContent = state.mode === 'cooldown' ? 'Pause. Then choose.' : 'Your path is open.';
    $('#description').textContent = state.mode === 'cooldown' ? 'Take a breath. What brought you here, and is it where you want to go?' : 'This website is no longer on your lists.';
    $('#continue').hidden = false;
    $('#timer').hidden = state.mode !== 'cooldown';
    let interval;
    function tick() {
      const remaining = state.mode === 'cooldown' ? Math.max(0, Math.ceil((state.readyAt - Date.now()) / 1000)) : 0;
      $('#seconds').textContent = remaining;
      $('#continue').disabled = remaining > 0;
      if (!remaining) {
        $('#ready').textContent = 'The choice is yours. Continue only if you mean to.';
        if (interval) clearInterval(interval);
      }
    }
    tick();
    if ($('#continue').disabled) interval = setInterval(tick, 250);
    $('#continue').addEventListener('click', async () => {
      $('#continue').disabled = true;
      try { await send('continue'); }
      catch (error) { $('#error').textContent = error.message; tick(); }
    });
  }
} catch (error) {
  $('#description').textContent = 'This path could not be checked. Try opening the website again.';
  $('#error').textContent = error.message;
}
