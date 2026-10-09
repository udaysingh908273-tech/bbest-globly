# AI Video Studio Pro — isolated staging branch

This is a staging note for the AI Video Studio Pro MVP. It is intentionally on the `ai-video-studio-pro` branch; the ecommerce site's `main` branch has not been changed.

## Source package

The complete starter source archive was built and tested in the current ChatGPT session and is attached in that conversation as `ai-video-studio-pro.zip`. The archive has not been uploaded as a binary asset into this GitHub branch yet.

## What the MVP supports

- Local project persistence in SQLite.
- Video/image/audio upload and FFprobe metadata inspection.
- Editable ordered clip timeline and trim points.
- Optional title overlay, subtitle sidecars, and background music.
- Real FFmpeg H.264/AAC MP4 rendering and render job status.
- Post-export FFprobe metadata report.
- Offline content-planning templates.
- Optional Ollama local LLM integration and optional no-key source discovery.

## Important limitations

This is a working starter MVP, not a fully trained AI system or a full nonlinear editor. Live search needs the optional `ddgs` package and may be rate-limited. Ollama must be installed and configured locally. Captioning with faster-whisper is optional. The current quality report checks file metadata, not guaranteed visual/perceptual quality. No tool can guarantee views or viral reach.

## Repository note

The connected GitHub actions do not expose repository creation. To keep the ecommerce store isolated, do not merge this branch into `main`. Create a separate repository named `ai-video-studio-pro` in GitHub, download the source ZIP from the conversation, extract it, and push those files into the new repository.