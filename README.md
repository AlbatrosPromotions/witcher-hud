# witcher-hud

A Witcher 3 style HUD for Claude Code. It sits in one slim row above the prompt and plays the session as a hunt: every prompt is a quest, every tool a sign, every token experience.

In the desktop app it is drawn on one plate: a medallion that shakes once as each sign is cast and glows while Claude works, a vitality bar over a stamina bar with their figures, adrenaline pips, the level badge ringed by its experience, then the quest tracker, the sign at work in its own colour, and the crowns spent. It follows the app's light or dark appearance (a parchment plate in light), every bar shows its numbers under the pointer, and the pointer on the character turns the quest tracker into the character sheet. In a terminal it is a single row of colored cells, animated on the terminal's own clock. Colors aside, it reads like this:

```
 ▲ ▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂ 66%  ◆◆◇  Lv 5 ━━────  ⛁ 1.87  Fix the login redirect ◆ Igni: npm test
```

It speaks English or Russian. Current version: 3.1.1.

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
| **Medallion** | The wolf rests on it between quests. While Claude works it glows and shows the sign being cast, and shakes once as each sign is cast. |
| **Signs** | Bash is Igni, edits are Yrden, reading and searching files is Witcher Senses, the web is Axii, a subagent is Aard, anything else (MCP tools included) Quen. |
| **Vitality** (red) | Context window left. What a turn costs shows pale, then drains away. At 20% or less the bar pulses. |
| **Stamina** (yellow) | What is left of the 5-hour rate limit, when the API reports one, with its figure; red at 15% or less. In a terminal it is the yellow line along the vitality cells. |
| **Adrenaline** (◆◆◆, a column of pips on the desktop, filling from the bottom) | A point for every 4 tool calls in a row that succeed, up to three. A failed tool costs all of it, a call you refuse costs nothing, and a point fades between quests. |
| **Level** | Experience is input, cache-write and output tokens, subagents' included; cache reads earn none. The first level up takes 5,000 XP and each one after needs twice the last. On the desktop the ring around the level badge fills with the way to the next; in a terminal a thin gold bar does. |
| **Crowns** | The session's cost, as `/cost` totals it. |
| **Quest tracker** | The prompt's first line as the quest's name, and the sign at work as the objective, in the sign's colour, with what it acts on in monospace: the command, the file, the pattern, the site. When the turn ends: quest completed with the XP it earned, abandoned if you interrupted it, or failed. |
| **Character sheet** | On the desktop, the pointer on the medallion, bars or level shows the level's title, the experience to the next level, the tokens sent and generated, cache reads and model requests in the quest tracker's place. Each bar, the pips and the badge also show their numbers in a tooltip. |

On a narrow window the HUD makes room: on the desktop the crowns go first, then the quest name is cut, then the quest tracker steps aside; in a terminal the crowns go first, then the level, then the quest tracker. With the system's reduce-motion setting on, the desktop HUD keeps still.

The spinner speaks the trade too (Meditating, Casting Igni, Using Witcher Senses, Writing in the journal); on the desktop it only replaces a bare "Working". In a terminal the line that closes a turn reads like "Played Gwent for 42s".

Toasts announce each level up, warn when vitality falls to 20% (meditate with `/compact` to recover), and say when meditation restored it.

Levels: Kaer Morhen Trainee, Survivor of the Grasses, Novice Witcher, Monster Slayer, Contract Hunter, Silver Sword, Wolf School Master, then White Wolf from level 8 on.

## Language

The HUD speaks English or Russian. The Russian follows the game's own Russian edition: Игни, Квен, Ведьмачье чутьё, «Задание выполнено», кроны. The closing line reads «Играл в гвинт 1 мин 4 с», numbers take a decimal comma, and the text is set in serifs that carry Cyrillic.

- `/hud lang ru` or `/hud lang en` switches it, and it stays switched in every session.
- It is also the plugin's `language` option: `--config language=ru` at install, `/plugin configure witcher-hud@witcher-hud`, or the plugin's Language row in `/config`. That row is not Claude Code's own Language setting, which picks the language Claude answers in.
- In `~/.claude/settings.json` it is kept under `pluginConfigs` → `"witcher-hud@witcher-hud"` → `options.language` (`"witcher-hud"` for a copy loaded with `--plugin-dir`).

## Theme

On the desktop the HUD follows the app's appearance: the dark plate in dark mode, a light parchment plate in light mode.

- `/hud theme auto`, `/hud theme dark` or `/hud theme light` picks it, and it stays picked in every session.
- It is also the plugin's `theme` option, set the same ways as `language`.

## Commands

- `/hud` sheathes or draws the HUD.
- `/hud stats` shows the character sheet: every number behind the bars, with the context used, the tokens sent, generated and read from cache, and the model requests made.
- `/hud lang en|ru` picks the language.
- `/hud theme auto|dark|light` picks the desktop theme.

Token counts start when the plugin loads; cost, context and stamina cover the whole session.

The desktop HUD's lettering is a subset of [Forum](https://fonts.google.com/specimen/Forum) by Denis Masharov, under the SIL Open Font License 1.1 (`fonts/OFL.txt`), embedded under the name "WHud Title" as that license asks of a modified copy.

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
| `hooks/layout.ts` | The desktop HUD's geometry: one grid every box is placed on, centred on the midline with even gaps, laid out for each band of widths. |
| `hooks/art.ts` | The desktop HUD as one SVG drawn from that layout: the character, the quest tracker and the character sheet, both themes. It fills its frame's width, each band's parts shown by a CSS media query. |
| `hooks/font.ts` | The embedded title face (generated): the woff2 as base64 and each glyph's advance, so text is measured. |
| `hooks/terminal-hud.ts` | The terminal row, animated on the terminal's own frame clock. |
| `types/index.d.ts` | The shapes of the HUD's session state. |
| `tests/witcher-hud.test.ts` | The tests `claude plugin test` runs. |
| `tests/geometry.test.ts` | The layout's rules checked over 140 widths: symmetry, gaps, whole pixels, no overlaps, text that fits; and across every band of widths, no part that appears or drops inside one, and the right-hand parts' gap. |

Claude Code writes `.claude-plugin/types/` and `tsconfig.json` each time it loads the plugin; both are gitignored. Bump `version` in `.claude-plugin/plugin.json` with each release, since `claude plugin update` goes by it.

## Versions

- **3.1.1** Fixes 3.1.0 on the desktop: the HUD's frame was given no width, and the app drew it at a browser's default 300px, so only the narrowest tier showed (the medallion, the bars and the level, without the quest or the crowns). The frame now asks for the full width and the band holds it to its own, so the HUD fills the band up to 960px. An update no longer blinks the HUD: the desktop draws an Svg in a frame that has to load, and a new drawing used to replace the old one and leave the band empty until it loaded. Now the new drawing is laid over the one on show, which stays untouched until the new one has had time to load, and only then takes its place. A redraw with nothing new keeps the frame as it is, and the medallion's breathing, the low-vitality pulse and the level-up glow carry on from where they were instead of starting over.
- **3.1.0** The desktop HUD is one drawing that fills the band at any width: the plate reaches the right edge, the crowns stay at its end, and the quest's text is cut to the room it has, all read from the drawing's own width instead of a guess from the band's columns. Updates no longer blank the quest's half for a moment, and the title's letter spacing is counted when it is cut.
- **3.0.0** The desktop HUD redrawn on one grid: one plate, the figures beside their bars, adrenaline as a column of pips, experience as a ring on the level badge, the sign's colour and a monospace target in the quest tracker, the crowns at the plate's end. A light parchment theme after the app's appearance and `/hud theme`, tooltips and a character sheet under the pointer, an embedded title face with Cyrillic, one shake per cast instead of a constant one, and stillness under reduce motion.
- **2.1.1** The README and the marketplace listing brought up to date; the HUD itself is unchanged.
- **2.1.0** Russian, after the game's Russian edition, and the `language` option with `/hud lang`.
- **2.0.0** The compact HUD: one row, a drawn medallion and sign glyphs, the quest tracker, adrenaline from clean tool streaks, the themed spinner and closing line, and `/hud stats`. Signs were remapped: reading is now Witcher Senses, the web Axii, a subagent Aard.
- **1.0.0** The first HUD: a framed panel of bars, with adrenaline from prompt cache hits.
