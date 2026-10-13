let audio: AudioContext | null = null;

/** Short low tone for "barcode not found" (plan.md → Unknown barcode). Silent if audio isn't available. */
export function errorBeep() {
  try {
    audio ??= new AudioContext();
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = "square";
    oscillator.frequency.value = 220;
    gain.gain.value = 0.08;
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start();
    oscillator.stop(audio.currentTime + 0.25);
  } catch {
    // No sound on this device — the red message is still shown.
  }
}
