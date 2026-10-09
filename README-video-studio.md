# AI Video Studio Pro — isolated staging snapshot

This branch contains a free-first video editing MVP for local use. The ecommerce repository's `main` branch is not changed.

## Download and run

Download `ai-video-studio-pro.zip` from this branch, extract it, then on Windows run `start_windows.bat` after installing FFmpeg. See the project's `README.md` for requirements and manual setup.

## What works

- Project persistence in SQLite
- Media upload and FFprobe metadata inspection
- Editable ordered clip timeline with trim points
- Optional title overlay, subtitle sidecars, and background music
- Real FFmpeg H.264/AAC MP4 rendering and job progress
- Post-export FFprobe metadata report
- Offline content-planning templates, optional Ollama local LLM, and optional no-key source discovery

## Important

This is a starter MVP, not a fully-trained AI or a full nonlinear editor. Live web search depends on the optional `ddgs` package and may be rate-limited. Ollama needs to be installed/configured locally. An exported file's quality report checks metadata and does not guarantee audience reach or viral results.

This staging branch belongs to the existing `bbest-globly` repository because the connected GitHub actions do not expose repository creation. Do not merge this branch into the ecommerce site's `main`; create a separate repository and move the video-studio folder/archive there when repository creation is available.