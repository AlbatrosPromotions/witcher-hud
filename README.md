# witcher-hud

A Witcher 3 style HUD for Claude Code. It sits above the prompt and shows what the session is spending.

```
╔════════════════════════════════════════════════════════════╗
║ ◈ LEVEL 5  Contract Hunter  ⚔ 74 contracts                 ║
║ Vitality   ████████████████████░░░░░░░░░░ 66%              ║
║ Stamina    ███████████████████████░░░░░░░ 78%              ║
║ Adrenaline ●●○                                             ║
║ Sign       Igni  (Bash)  medallion humming…                ║
║ ✦ 12.3k / 80.0k XP  ⛁ $1.87 crowns  ↑24.3k ↓5.1k           ║
╚════════════════════════════════════════════════════════════╝
```

## Install

In a Claude Code terminal session:

```
/plugin install witcher-hud --marketplace AlbatrosPromotions/witcher-hud
```

Answer `y` to add the marketplace, then pick a scope.

## What it shows

| HUD | Meaning |
| --- | --- |
| **Vitality** | Context window left. Turns toxic green below 20%. |
| **Stamina** | What is left of the 5-hour rate limit (shown when the API reports it). |
| **Adrenaline** | Up to 3 points for how much input the prompt cache served. |
| **Sign** | The last tool used: Bash is Igni, Edit/Write Yrden, Read/Grep Axii, web tools Aard, Agent Quen, anything else Witcher Senses. |
| **Contracts** | Model requests, subagents included. |
| **XP / Level** | Input, cache-write and output tokens. Each level needs twice the last. |
| **Crowns** | The session's cost, as `/cost` totals it. |
| `↑ ↓` | Tokens sent and generated. |

Levels: Kaer Morhen Trainee, Survivor of the Grasses, Novice Witcher, Monster Slayer, Contract Hunter, Silver Sword, Wolf School Master, White Wolf.

Toasts announce each level up, and a warning appears when vitality drops below 20%. Meditate (`/compact`) to recover.

`/hud` hides or shows the HUD.

Token counts start when the plugin loads; cost, context and stamina cover the whole session.

## Develop

```
claude --plugin-dir ./witcher-hud
claude plugin validate ./witcher-hud
claude plugin test ./witcher-hud
```
