// ==UserScript==
// @name         TradingView Custom Sound
// @namespace    https://github.com/ywthoho/tv-custom-sound
// @version      3.0.0
// @description  Replace TradingView's built-in trade and alert sounds with your own custom audio
// @author       ywthoho
// @match        https://www.tradingview.com/*
// @match        https://tradingview.com/*
// @run-at       document-start
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        unsafeWindow
// ==/UserScript==

(function () {
  'use strict';

  // ─── Constants ───────────────────────────────────────────────────────────────

  const LOG_PREFIX = '[TV Custom Sound]';

  const KEYS = {
    tradeSound: 'tv_custom_sound_trade_base64',
    alertSound: 'tv_custom_sound_alert_base64',
    enabled: 'tv_custom_sound_enabled',
    soundMap: 'tv_custom_sound_map', // fingerprint → 'trade' | 'alert'
  };

  // ─── State ───────────────────────────────────────────────────────────────────

  let tradeSound = GM_getValue(KEYS.tradeSound, '');
  let alertSound = GM_getValue(KEYS.alertSound, '');
  let enabled = GM_getValue(KEYS.enabled, true);
  let soundMap = GM_getValue(KEYS.soundMap, {}); // { fingerprint: 'trade' | 'alert' }

  // Tag mode: when set, the next intercepted sound will be tagged with this category
  let pendingTag = null; // 'trade' | 'alert' | null

  // ─── Logging ─────────────────────────────────────────────────────────────────

  function log(...args) {
    console.log(LOG_PREFIX, ...args);
  }

  function warn(...args) {
    console.warn(LOG_PREFIX, ...args);
  }

  // ─── Fingerprinting ─────────────────────────────────────────────────────────

  /**
   * Create a short fingerprint from a data URI or URL.
   * For data URIs, we use a slice from the middle of the base64 content
   * to avoid matching common headers.
   */
  function getFingerprint(src) {
    if (!src) return null;
    if (src.startsWith('data:')) {
      // Use chars 100–300 of the base64 payload as fingerprint
      // This avoids the common audio header bytes
      const commaIndex = src.indexOf(',');
      if (commaIndex === -1) return src.slice(0, 200);
      const payload = src.slice(commaIndex + 1);
      return payload.slice(100, 300);
    }
    return src; // For regular URLs, use the full URL
  }

  /**
   * Check if a source is one of our custom sounds (to avoid double-replacement).
   */
  function isOwnCustomSound(src) {
    if (!src) return false;
    return src === tradeSound || src === alertSound;
  }

  // ─── Sound routing ──────────────────────────────────────────────────────────

  /**
   * Determine which custom sound to play for an intercepted audio source.
   * Uses the learned fingerprint map for routing.
   */
  function getReplacementSound(audioSrc) {
    if (!enabled) return null;

    // Never replace our own custom sounds (prevents double-replacement)
    if (isOwnCustomSound(audioSrc)) return null;

    const fingerprint = getFingerprint(audioSrc);
    if (!fingerprint) return null;

    // ── Tag mode: learn this sound's category ──
    if (pendingTag) {
      const tag = pendingTag;
      pendingTag = null;
      soundMap[fingerprint] = tag;
      GM_setValue(KEYS.soundMap, soundMap);
      log(`✅ Tagged sound as "${tag}" (fingerprint: ${fingerprint.slice(0, 30)}...)`);
      // Play the tagged custom sound immediately as feedback
      const taggedSound = tag === 'trade' ? tradeSound : alertSound;
      if (taggedSound) return taggedSound;
      return null;
    }

    // ── Check learned mapping ──
    const category = soundMap[fingerprint];
    if (category) {
      log(`Matched fingerprint → ${category}`);
      if (category === 'trade' && tradeSound) return tradeSound;
      if (category === 'alert' && alertSound) return alertSound;
    }

    // ── No mapping found ──
    // If only one custom sound is set, use it as catch-all
    if (tradeSound && !alertSound) return tradeSound;
    if (alertSound && !tradeSound) return alertSound;

    // Both sounds set but no mapping — log a hint to tag
    if (tradeSound && alertSound) {
      warn(
        'Unknown sound detected! Use "🏷️ Tag Next → Trade" or "🏷️ Tag Next → Alert" to teach me.\n' +
        'Fingerprint: ' + fingerprint.slice(0, 50) + '...'
      );
      // Default to trade sound as fallback
      return tradeSound;
    }

    return null;
  }

  // ─── Audio interception ──────────────────────────────────────────────────────

  const win = unsafeWindow || window;
  const OriginalAudio = win.Audio;
  const originalPlay = win.HTMLAudioElement.prototype.play;

  // Patch: Audio constructor
  win.Audio = function (src) {
    log('Audio() intercepted | src:', src ? src.slice(0, 80) + '...' : src);

    const replacement = getReplacementSound(src);
    if (replacement) {
      log('→ Replacing with custom sound');
      return new OriginalAudio(replacement);
    }

    return new OriginalAudio(src);
  };

  win.Audio.prototype = OriginalAudio.prototype;

  // Patch: HTMLAudioElement.prototype.play
  win.HTMLAudioElement.prototype.play = function () {
    const src = this.src || this.currentSrc || '';
    log('play() intercepted | src:', src ? src.slice(0, 80) + '...' : src);

    const replacement = getReplacementSound(src);
    if (replacement) {
      log('→ Replacing with custom sound');
      this.src = replacement;
    }

    return originalPlay.apply(this, arguments);
  };

  log('Audio interception initialized | enabled:', enabled);
  log('Trade sound loaded:', !!tradeSound, '| Alert sound loaded:', !!alertSound);
  log('Learned sound mappings:', Object.keys(soundMap).length);

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  function uploadSound(label, storageKey, onDone) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*';

    input.addEventListener('change', function () {
      const file = input.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = function (e) {
        const dataUri = e.target.result;
        GM_setValue(storageKey, dataUri);
        onDone(dataUri);
        log(`${label} sound uploaded:`, file.name, '| size:', file.size, 'bytes');
        alert(
          `[TV Custom Sound]\n\n${label} sound uploaded!\n\n` +
          `File: ${file.name}\n` +
          `Size: ${(file.size / 1024).toFixed(1)} KB`
        );
      };
      reader.onerror = function () {
        warn('Failed to read file');
        alert('[TV Custom Sound]\n\nFailed to read the audio file.');
      };
      reader.readAsDataURL(file);
    });

    input.click();
  }

  function testSound(label, dataUri) {
    if (!dataUri) {
      alert(`[TV Custom Sound]\n\nNo ${label} sound uploaded yet.`);
      return;
    }
    log(`Testing ${label} sound...`);
    const audio = new OriginalAudio(dataUri);
    audio.play().catch(function (err) {
      warn('Playback failed:', err);
      alert('[TV Custom Sound]\n\nPlayback failed: ' + err.message);
    });
  }

  function formatSize(dataUri) {
    if (!dataUri) return 'N/A';
    return ((dataUri.length * 0.75) / 1024).toFixed(1) + ' KB';
  }

  // ─── Menu: Trade Sound ───────────────────────────────────────────────────────

  GM_registerMenuCommand('📈 Upload Trade Sound', function () {
    uploadSound('Trade', KEYS.tradeSound, function (uri) {
      tradeSound = uri;
    });
  });

  GM_registerMenuCommand('🔊 Test Trade Sound', function () {
    testSound('Trade', tradeSound);
  });

  GM_registerMenuCommand('🗑️ Clear Trade Sound', function () {
    if (!tradeSound) {
      alert('[TV Custom Sound]\n\nNo trade sound to clear.');
      return;
    }
    if (confirm('[TV Custom Sound]\n\nRemove trade sound?')) {
      GM_setValue(KEYS.tradeSound, '');
      tradeSound = '';
      log('Trade sound cleared');
      alert('[TV Custom Sound]\n\nTrade sound removed.');
    }
  });

  // ─── Menu: Alert Sound ───────────────────────────────────────────────────────

  GM_registerMenuCommand('🔔 Upload Alert Sound', function () {
    uploadSound('Alert', KEYS.alertSound, function (uri) {
      alertSound = uri;
    });
  });

  GM_registerMenuCommand('🎵 Test Alert Sound', function () {
    testSound('Alert', alertSound);
  });

  GM_registerMenuCommand('🗑️ Clear Alert Sound', function () {
    if (!alertSound) {
      alert('[TV Custom Sound]\n\nNo alert sound to clear.');
      return;
    }
    if (confirm('[TV Custom Sound]\n\nRemove alert sound?')) {
      GM_setValue(KEYS.alertSound, '');
      alertSound = '';
      log('Alert sound cleared');
      alert('[TV Custom Sound]\n\nAlert sound removed.');
    }
  });

  // ─── Menu: Tagging (learning) ────────────────────────────────────────────────

  GM_registerMenuCommand('🏷️ Tag Next → Trade', function () {
    pendingTag = 'trade';
    log('Tag mode ON — next intercepted sound will be tagged as TRADE');
    alert(
      '[TV Custom Sound]\n\n' +
      'Tag mode: TRADE\n\n' +
      'Now trigger a trade/order on TradingView.\n' +
      'The next sound that plays will be remembered as a Trade sound.'
    );
  });

  GM_registerMenuCommand('🏷️ Tag Next → Alert', function () {
    pendingTag = 'alert';
    log('Tag mode ON — next intercepted sound will be tagged as ALERT');
    alert(
      '[TV Custom Sound]\n\n' +
      'Tag mode: ALERT\n\n' +
      'Now trigger an alert on TradingView.\n' +
      'The next sound that plays will be remembered as an Alert sound.'
    );
  });

  GM_registerMenuCommand('🧹 Reset Learned Tags', function () {
    const count = Object.keys(soundMap).length;
    if (count === 0) {
      alert('[TV Custom Sound]\n\nNo learned tags to reset.');
      return;
    }
    if (confirm(`[TV Custom Sound]\n\nReset ${count} learned tag(s)?`)) {
      soundMap = {};
      GM_setValue(KEYS.soundMap, soundMap);
      log('Learned tags reset');
      alert('[TV Custom Sound]\n\nAll learned tags cleared.');
    }
  });

  // ─── Menu: Toggle & Status ───────────────────────────────────────────────────

  GM_registerMenuCommand('⚙️ Toggle (current: ' + (enabled ? 'ON' : 'OFF') + ')', function () {
    enabled = !enabled;
    GM_setValue(KEYS.enabled, enabled);
    log('Toggled:', enabled ? 'ON' : 'OFF');
    alert(
      `[TV Custom Sound]\n\n${enabled ? 'Enabled ✅' : 'Disabled ❌'}\n\n` +
      'Refresh the page for the menu label to update.'
    );
  });

  GM_registerMenuCommand('ℹ️ Show Status', function () {
    const tagCount = Object.keys(soundMap).length;
    alert(
      `[TV Custom Sound] Status\n\n` +
      `Enabled: ${enabled ? 'Yes' : 'No'}\n` +
      `Trade sound: ${tradeSound ? 'Loaded (' + formatSize(tradeSound) + ')' : 'Not set'}\n` +
      `Alert sound: ${alertSound ? 'Loaded (' + formatSize(alertSound) + ')' : 'Not set'}\n` +
      `Learned tags: ${tagCount}\n` +
      `\nTip: Use "🏷️ Tag Next →" commands to teach which\n` +
      `TradingView sounds are Trade vs Alert.`
    );
  });
})();
