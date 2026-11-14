---
title: FreeSnakeGame
description: An infinite-world snake game I sketched in Paint and built with GitHub Copilot.
url: https://freesnakegame.com/
linkLabel: Play FreeSnakeGame.com
repository: https://github.com/minnsace/free-snake-game
repositoryLabel: Source on GitHub
status: Available online
kind: Web game
order: 2
platform: Web
---

I impulsively bought the domain [freesnakegame.com](https://freesnakegame.com/) for $5 off GoDaddy. Then I realized I should probably put something on it. So I opened Microsoft Paint, sketched out what I wanted the game to look like, and started building it with GitHub Copilot.

The game takes place in an infinite world, so the food can end up outside your view. To solve that, the snake occasionally sticks out its tongue toward the food. If it's off-screen, scent markers point you in the right direction.

I also wanted it to work properly on phones, not just load technically. On mobile, touching anywhere places a joystick under your thumb. You drag to steer and let go to hide it. The snake gets longer and faster as your score rises, so it becomes harder the longer you survive.

It's built in Python with pygame-ce, runs in the browser through WebAssembly, and is hosted on GitHub Pages. The source is on [GitHub](https://github.com/minnsace/free-snake-game).

## Features

- An infinite world, so the food can end up outside your view
- The snake sticks out its tongue toward the food
- Scent markers when the food is off-screen
- A phone joystick: touch anywhere to place it under your thumb, drag to steer, let go to hide it
- The snake gets longer and faster as your score rises

## Tech

- Python, with pygame-ce
- WebAssembly in the browser
- Hosted on GitHub Pages
