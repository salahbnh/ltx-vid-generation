# LTX Video Generation

![Next.js](https://img.shields.io/badge/Next.js-000000?logo=next.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?logo=tailwindcss&logoColor=white)

A minimal **text-to-video generation** web app built with Next.js — enter a prompt and generate a video clip through a server-side generation API route.

> **Stack:** Next.js (App Router) · TypeScript · Tailwind CSS

## Overview

A focused, single-purpose app: the UI (`src/app/page.tsx`) sends a prompt to the API route (`src/app/api/generate/route.tsx`), which calls the video-generation backend and returns the result. A clean starting point for experimenting with LTX-style video models.

## Getting Started

```bash
git clone https://github.com/salahbnh/ltx-vid-generation.git
cd ltx-vid-generation
npm install
cp .env.example .env   # add your generation API key
npm run dev            # http://localhost:3000
```

## Demo

<!-- Add an example generated clip or a screenshot of the UI here. -->

---

Built by [Salah Bounouh](https://github.com/salahbnh) · [Portfolio](https://salahbounouh.com) · [LinkedIn](https://www.linkedin.com/in/salah-bounouh-1426ba27b/)
