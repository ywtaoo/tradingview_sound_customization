# TradingView Custom Sound

A Tampermonkey userscript that replaces TradingView's built-in trade execution and alert sounds with your own custom audio.

## Features

- **Two independent sound slots** — set different sounds for **Trade execution** and **Alerts**
- **Intercepts all TradingView audio** — monkey-patches `Audio` constructor and `play()` at `document-start`
- **Smart routing & Learning** — identifies sounds via fingerprinting and learns which sound to play based on user tags
- **Upload any audio file** — stored as Base64 in Tampermonkey's storage, no external hosting needed
- **Menu-driven UI** — upload, test, clear, toggle, and check status via Tampermonkey's menu

## Installation

### Prerequisites

- [Tampermonkey](https://www.tampermonkey.net/) browser extension installed

### Steps

1. Click on this link to install the script directly: **[Install tv-custom-sound.user.js](https://raw.githubusercontent.com/ywtaoo/tradingview_sound_customization/main/tv-custom-sound.user.js)**
2. Tampermonkey will automatically open a new tab. Click the **Install** button.
3. Navigate to [TradingView](https://www.tradingview.com/chart/) — the script auto-activates.

## Usage

All controls are in the **Tampermonkey menu** (click the Tampermonkey icon in your browser toolbar):

### Trade Sound

| Menu Command | Description |
|---|---|
| 📈 Upload Trade Sound | Upload audio for trade/order execution events |
| 🔊 Test Trade Sound | Preview the uploaded trade sound |
| 🗑️ Clear Trade Sound | Remove trade sound, revert to original |

### Alert Sound

| Menu Command | Description |
|---|---|
| 🔔 Upload Alert Sound | Upload audio for alert/notification events |
| 🎵 Test Alert Sound | Preview the uploaded alert sound |
| 🗑️ Clear Alert Sound | Remove alert sound, revert to original |

### Learning & Tagging

| Menu Command | Description |
|---|---|
| 🏷️ Tag Next → Trade | Teaches the script to treat the next intercepted sound as a Trade event |
| 🏷️ Tag Next → Alert | Teaches the script to treat the next intercepted sound as an Alert event |
| 🧹 Reset Learned Tags | Clears all learned sound identifications |

### General

| Menu Command | Description |
|---|---|
| ⚙️ Toggle | Enable / disable the script (on/off) |
| ℹ️ Show Status | Display current state and loaded sound info |

### How Sound Routing Works

TradingView obfuscates the URLs for some audio elements or uses raw `data:` URIs. To reliably map TradingView events to your custom sounds, this script uses **Audio Fingerprinting** combined with a manual **Tagging** system:

1. When an unknown sound plays, the script creates a unique fingerprint for it. 
2. If both a Trade and an Alert sound are uploaded and the script doesn't recognize the fingerprint, it logs a warning in the Console and falls back to playing the Trade sound.
3. Use the **Tagging Menu** (`🏷️ Tag Next → Trade` or `🏷️ Tag Next → Alert`) to "teach" the script. After entering Tag mode, simply trigger the matching event on TradingView. The script will intercept the audio, tag its fingerprint permanently, and route it correctly from that moment on.

> **Tip**: Open the browser Console (`F12`) and look for `[TV Custom Sound]` logs to see fingerprints and exactly how sounds are being intercepted and mapped.

## Extracting Audio from a Song

If you want to use a specific part of a song as your custom sound, here's how to extract it using [FFmpeg](https://ffmpeg.org/):

### Install FFmpeg

```bash
# macOS (Homebrew)
brew install ffmpeg
```

### Extract a clip

```bash
# Extract from 1:23 to 1:27 (4-second clip)
ffmpeg -i "your_song.mp3" -ss 00:01:23 -to 00:01:27 -c copy clip.mp3

# Extract from 0:45, duration 3 seconds, with fade in/out
ffmpeg -i "your_song.mp3" -ss 00:00:45 -t 3 \
  -af "afade=t=in:st=0:d=0.3,afade=t=out:st=2.7:d=0.3" \
  clip.mp3
```

### Tips

- Keep clips **under 10 seconds** — trade sounds should be short and snappy
- Use `-af "volume=0.8"` to adjust volume (0.0–1.0)
- WAV files work but are large; MP3 or OGG are recommended for smaller Base64 storage

## Debugging

Open the browser Console (`F12` → Console tab) on TradingView. All interception events are logged with the `[TV Custom Sound]` prefix:

```
[TV Custom Sound] Audio constructor intercepted | src: https://...some-tv-sound.mp3
[TV Custom Sound] → Replacing with custom sound
```

## Limitations

- TradingView may update their audio implementation, requiring script adjustments
- Very large audio files (>1 MB) will increase Tampermonkey storage usage
