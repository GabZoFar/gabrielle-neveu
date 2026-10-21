---
title: How to write a post
date: 2026-10-21
description: Drafts only show up in dev. Delete this file once you've published your first real post.
draft: true
---

Every post is a Markdown file in `content/posts/`. The file name becomes the URL: this one lives at `/blog/example-post/`.

## Front matter

- `title`: required
- `date`: required, `YYYY-MM-DD`
- `description`: optional, shown under the title and in link previews
- `draft: true`: visible with `pnpm dev`, left out of the build

> Write the way you talk. Short is fine.

Images go in `public/` and are referenced as `/my-image.png`.
