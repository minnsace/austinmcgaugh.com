---
title: "I Bought a $5 Domain on Impulse. Now It's a Game."
description: "How a $5 impulse domain and a Microsoft Paint sketch became FreeSnakeGame, an infinite-world snake game that runs in your browser."
date: 2026-11-14
tags:
  - freesnakegame
  - devlog
  - ai
  - pygame
type: article
draft: false
---

I impulsively bought freesnakegame.com for $5 off GoDaddy. Then I realized I should probably put something on it.

So I opened Microsoft Paint, sketched out what I wanted the game to look like, and started building it with GitHub Copilot.

## An infinite world, and a snake that can smell

I didn't want the snake boxed in, so the game takes place in an infinite world. That creates a problem: the food can end up somewhere you can't see. My fix was to let the snake occasionally stick out its tongue toward the food, and when it's off-screen, scent markers point you in the right direction.

## Actually playable on a phone

I wanted it to work properly on phones, not just technically load. On mobile, touching anywhere places a joystick right under your thumb. You drag to steer and let go to hide it.

## It gets harder the longer you survive

The snake gets longer and faster as your score rises, so every run eventually turns into a fight to stay alive.

## Under the hood

It's built in Python with pygame-ce, runs in the browser through WebAssembly, and is hosted on GitHub Pages.

## Why this matters to me

A $5 impulse buy and a Paint sketch turned into a real, playable game. That's what building with AI looks like now: imagination and willpower are the real limits.

[Play it at freesnakegame.com](https://freesnakegame.com)
