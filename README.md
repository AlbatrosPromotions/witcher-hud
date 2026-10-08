# witcher-hud

A Witcher 3 style HUD for Claude Code. It sits in one slim row above the prompt and plays the session as a hunt: every prompt is a quest, every tool a sign, every token experience.

In the desktop app it is drawn: a medallion that casts the sign of the tool at work and shakes while Claude works, a vitality bar over a stamina bar, adrenaline points, the level, the crowns spent, and a quest tracker on the right. In a terminal it is a single row of colored cells, animated on the terminal's own clock.

## Install

In a Claude Code terminal session:

```
/plugin install witcher-hud --marketplace AlbatrosPromotions/witcher-hud
```

Answer `y` to add the marketplace, then pick a scope.

## What it shows

| HUD | Meaning |
| --- | --- |
| **Medallion** | The wolf rests on it between quests. While Claude works it shakes and shows the sign being cast. |
| **Signs** | Bash is Igni, edits are Yrden, reading files is Witcher Senses, the web is Axii, a subagent is Aard, anything else Quen. |
| **Vitality** (red) | Context window left. What a turn costs shows pale, then drains away. |
| **Stamina** (yellow) | What is left of the 5-hour rate limit, when the API reports one. |
| **Adrenaline** (◆◆◆) | A point for every 4 tool calls in a row that succeed. A failed tool costs all of it; a point fades between quests. |
| **Level** | Experience is input, cache-write and output tokens. Each level needs twice the last. |
| **Crowns** | The session's cost, as `/cost` totals it. |
| **Quest tracker** | The prompt as the quest's name, and the sign at work as the objective. When the turn ends: quest completed with the XP it earned, or abandoned, or failed. |

The spinner speaks the trade too (Meditating, Casting Igni, Using Witcher Senses, Writing in the journal), and in a terminal the line that closes a turn reads like "Played Gwent for 42s".

Toasts announce each level up, warn when vitality drops below 20% (meditate with `/compact` to recover), and say when meditation restored it.

Levels: Kaer Morhen Trainee, Survivor of the Grasses, Novice Witcher, Monster Slayer, Contract Hunter, Silver Sword, Wolf School Master, White Wolf.

## Language

The HUD speaks English or Russian. The Russian follows the game's own Russian edition: Игни, Квен, Ведьмачье чутьё, «Задание выполнено», кроны.

- `/hud lang ru` or `/hud lang en` switches it, and it stays switched in every session.
- It is also the plugin's `language` option, under `/config` or `pluginConfigs` in `~/.claude/settings.json`.

## Commands

- `/hud` sheathes or draws the HUD.
- `/hud stats` shows the character sheet: every number behind the bars.
- `/hud lang en|ru` picks the language.

Token counts start when the plugin loads; cost, context and stamina cover the whole session.

The sign glyphs, medallion and wording are original work in the spirit of the games. No art, sound or text from them is used. The Witcher is a trademark of CD PROJEKT S.A.; this is an unofficial fan project.

## Develop

```
claude --plugin-dir ./witcher-hud
claude plugin validate ./witcher-hud
claude plugin test ./witcher-hud
```
