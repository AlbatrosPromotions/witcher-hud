# witcher-hud

A Witcher 3 style HUD for Claude Code. It sits in one slim row above the prompt and plays the session as a hunt: every prompt is a quest, every tool a sign, every token experience.

In the desktop app it is drawn: a medallion that casts the sign of the tool at work and shakes while Claude works, a vitality bar over a stamina bar, a thin experience bar, adrenaline points, the level, the crowns spent, and a quest tracker on the right. In a terminal it is a single row of colored cells, animated on the terminal's own clock. Colors aside, it reads like this:

```
 ▲ ▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂ 66%  ◆◆◇  Lv 5 ━━────  ⛁ 1.87  Fix the login redirect ◆ Igni: npm test
```

It speaks English or Russian. Current version: 2.1.1.

## Install

In a Claude Code session:

```
/plugin install witcher-hud --marketplace AlbatrosPromotions/witcher-hud
```

Answer `y` to add the marketplace, then pick a scope.

Or from a shell, with the language chosen up front (`en` is the default):

```
claude plugin install witcher-hud --marketplace AlbatrosPromotions/witcher-hud --config language=ru
```

To update an installed copy, then restart Claude Code:

```
claude plugin marketplace update witcher-hud
claude plugin update witcher-hud@witcher-hud
```

To remove it: `claude plugin uninstall witcher-hud@witcher-hud`.

## What it shows

| HUD | Meaning |
| --- | --- |
| **Medallion** | The wolf rests on it between quests. While Claude works it shakes and shows the sign being cast. |
| **Signs** | Bash is Igni, edits are Yrden, reading and searching files is Witcher Senses, the web is Axii, a subagent is Aard, anything else (MCP tools included) Quen. |
| **Vitality** (red) | Context window left. What a turn costs shows pale, then drains away. At 20% or less the bar pulses. |
| **Stamina** (yellow) | What is left of the 5-hour rate limit, when the API reports one. In a terminal it is the yellow line along the vitality cells. |
| **Adrenaline** (◆◆◆) | A point for every 4 tool calls in a row that succeed, up to three. A failed tool costs all of it, a call you refuse costs nothing, and a point fades between quests. |
| **Level** | Experience is input, cache-write and output tokens, subagents' included; cache reads earn none. The first level up takes 5,000 XP and each one after needs twice the last. The thin gold bar shows the way to the next. |
| **Crowns** | The session's cost, as `/cost` totals it. |
| **Quest tracker** | The prompt's first line as the quest's name, and the sign at work as the objective, with what it acts on: the command, the file, the pattern, the site. When the turn ends: quest completed with the XP it earned, abandoned if you interrupted it, or failed. |

On a narrow window the HUD makes room: on the desktop the quest tracker steps aside, and in a terminal the crowns go first, then the level, then the quest tracker.

The spinner speaks the trade too (Meditating, Casting Igni, Using Witcher Senses, Writing in the journal); on the desktop it only replaces a bare "Working". In a terminal the line that closes a turn reads like "Played Gwent for 42s".

Toasts announce each level up, warn when vitality falls to 20% (meditate with `/compact` to recover), and say when meditation restored it.

Levels: Kaer Morhen Trainee, Survivor of the Grasses, Novice Witcher, Monster Slayer, Contract Hunter, Silver Sword, Wolf School Master, then White Wolf from level 8 on.

## Language

The HUD speaks English or Russian. The Russian follows the game's own Russian edition: Игни, Квен, Ведьмачье чутьё, «Задание выполнено», кроны. The closing line reads «Играл в гвинт 1 мин 4 с», numbers take a decimal comma, and the text is set in serifs that carry Cyrillic.

- `/hud lang ru` or `/hud lang en` switches it, and it stays switched in every session.
- It is also the plugin's `language` option: `--config language=ru` at install, `/plugin configure witcher-hud@witcher-hud`, or the plugin's Language row in `/config`. That row is not Claude Code's own Language setting, which picks the language Claude answers in.
- In `~/.claude/settings.json` it is kept under `pluginConfigs` → `"witcher-hud@witcher-hud"` → `options.language` (`"witcher-hud"` for a copy loaded with `--plugin-dir`).

## Commands

- `/hud` sheathes or draws the HUD.
- `/hud stats` shows the character sheet: every number behind the bars, with the context used, the tokens sent, generated and read from cache, and the model requests made.
- `/hud lang en|ru` picks the language.

Token counts start when the plugin loads; cost, context and stamina cover the whole session.

The sign glyphs, medallion and wording are original work in the spirit of the games. No art, sound or text from them is used. The Witcher is a trademark of CD PROJEKT S.A.; this is an unofficial fan project.

## Develop

```
claude --plugin-dir ./witcher-hud
claude plugin validate ./witcher-hud
claude plugin test ./witcher-hud
```

| File | What it holds |
| --- | --- |
| `hooks/register.tsx` | The hooks: counts tokens, runs quests and signs, draws the HUD, answers `/hud`. |
| `hooks/lore.ts` | The words in both languages, signs, levels and number formats. No engine calls, so tests and previews run it anywhere. |
| `hooks/art.ts` | The desktop HUD as SVG: the medallion cluster and the quest tracker. |
| `hooks/terminal-hud.ts` | The terminal row, animated on the terminal's own frame clock. |
| `types/index.d.ts` | The shapes of the HUD's session state. |
| `tests/witcher-hud.test.ts` | The tests `claude plugin test` runs. |

Claude Code writes `.claude-plugin/types/` and `tsconfig.json` each time it loads the plugin; both are gitignored. Bump `version` in `.claude-plugin/plugin.json` with each release, since `claude plugin update` goes by it.

## Versions

- **2.1.1** The README and the marketplace listing brought up to date; the HUD itself is unchanged.
- **2.1.0** Russian, after the game's Russian edition, and the `language` option with `/hud lang`.
- **2.0.0** The compact HUD: one row, a drawn medallion and sign glyphs, the quest tracker, adrenaline from clean tool streaks, the themed spinner and closing line, and `/hud stats`. Signs were remapped: reading is now Witcher Senses, the web Axii, a subagent Aard.
- **1.0.0** The first HUD: a framed panel of bars, with adrenaline from prompt cache hits.
