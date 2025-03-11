# Gladelike

A simple browser-based roguelike game created with rot.js.

## Description

Gladelike is a browser-based roguelike game that uses the rot.js library to generate random maps and handle game mechanics. The game features a variety of tiles including walls, floors, doors, trees, and other objects, as well as various character types. Players can descend through multiple dungeon levels with increasing difficulty, exploring large maps that extend beyond the visible area.

## Features

- Random map generation using cellular automata
- Guaranteed map connectivity (player can always reach the stairs)
- Camera system that keeps the player centered
- Large maps (80x50) with scrolling viewport (30x20)
- Tileset-based rendering
- Various terrain types (grass, dirt, stone walls, etc.)
- Randomly placed features (trees, mushrooms, chests, etc.)
- Player character that can be moved with arrow keys
- NPC characters randomly placed throughout the map
- Collision detection (can't move through walls, trees, or NPCs)
- Field of View (FOV) system - only shows what the player can see
- Memory system - dimly shows areas previously explored
- Dungeon progression - stairways that lead to deeper levels
- Environment changes based on dungeon depth
- Level indicator showing current dungeon depth and player position

## How to Run

1. Ensure you have all files in the same directory:
   - `index.html`
   - `game.js`
   - `tiles.png`
   - `rogues.png`

2. Open the `index.html` file in a web browser.

## Controls

- Use the arrow keys to move your character (the rogue)
- You cannot move through walls, trees, or NPCs
- You can only see areas within your field of view (10 tiles radius)
- Previously explored areas remain visible but dimmed
- Step on a staircase to descend to the next dungeon level
- The map scrolls to keep your character centered on the screen

## Game Progression

The game features multiple dungeon levels with increasing difficulty:
- Upper levels (1-3): Grassy environments with trees and civilian NPCs
- Middle levels (4-6): Stone and dirt floors with more adventurer NPCs
- Deep levels (7+): Primarily stone environments with tougher NPCs

Each level contains:
- One staircase down to the next level (always reachable from any valid position)
- Random placement of NPCs (more on deeper levels)
- Features appropriate to the environment (trees on upper levels, more chests on deeper levels)
- A large map (80x50 tiles) that extends beyond what's visible on screen

## Technical Details

- Uses ROT.js's PreciseShadowcasting algorithm for Field of View computation
- Walls completely block vision
- Trees are partially transparent to vision
- Areas outside FOV but previously seen appear dimmed
- Level generation adapts to dungeon depth (more difficult on deeper levels)
- Connected region analysis ensures map navigability:
  - Identifies all separate floor regions using flood fill algorithm
  - Keeps only the largest region as passable floor
  - Places player and stairs within the same connected region
  - Ensures the player can always reach the stairs
- Camera system:
  - Maintains a viewport of 30x20 tiles
  - Centers the player within this viewport
  - Scrolls the map when the player moves
  - Efficiently renders only the tiles within the current viewport

## Credits

- Uses [rot.js](https://ondras.github.io/rot.js/manual/) for roguelike functionality
- Tileset included in the project 