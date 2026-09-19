# Hex Connection Word Puzzle — Prototype Rules

## Objective

The board is a regular hexagon with **5 tiles on each side** (61 tiles total).

The six edges form **three pairs of opposite sides**. The goal is to use valid words to create a connected path joining **any one pair of opposite sides**, while using as few words as possible.

In other words, the player may win by connecting:

- Side A to the opposite Side A, or
- Side B to the opposite Side B, or
- Side C to the opposite Side C.

Work toward different side pairs may share tiles and may intersect.

## Board

- The board is a hexagonal grid with **5 tiles per side**.
- Each tile contains a letter.
- The **center tile is a wildcard**.
- Each tile has up to six neighboring tiles.

## Forming Words

- A word is formed by tracing a path through adjacent tiles.
- A word must contain at least two letters. Two-letter words are valid.
- Adjacency is through the six neighboring hexes.
- A tile may not be used more than once within the same word.
- A tile may be reused in later words.
- Words must be valid according to the game's dictionary.

## Wildcard

- The center tile is a wildcard and may represent any letter.
- Within a single word, the wildcard represents one letter.
- The wildcard may represent a different letter in each new word.
- The wildcard can be reused across multiple words just like any other tile.

## Building the Network

- When a valid word is played, every tile used by that word becomes active.
- Active tiles remain active for the rest of the puzzle.
- Active tiles are considered connected whenever they are adjacent on the hex grid, even if they were activated by different words.
- Previously active tiles may be used again in later words.
- The player's active tiles therefore build up a network over the course of the puzzle.

## Winning

The puzzle is solved as soon as the active-tile network contains a connected path between at least one pair of opposite sides.

All three pairs are checked independently. A path may connect more than one pair at once, especially when its endpoints are corner tiles, but only one connected pair is required to win.

## Scoring

- The player's score is the **number of valid words used to solve the puzzle**.
- Lower scores are better.
- The ideal score is the minimum number of words in which the board can be solved.
- There is no penalty for reusing tiles across different words.

## Design Principle

The puzzle should be easy to finish with enough words but difficult to solve optimally.

The challenge is not simply to find words. It is to choose which opposite-side pair offers the best route, then build that connection with as few words as possible.
