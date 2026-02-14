# Backend Agent Notes

- Storage policy: Always use local filesystem storage for uploads/streaming in this backend project.
- Do not introduce S3 (or any cloud object storage) integrations unless explicitly requested by the user in a future ticket.
- Video delivery policy: all uploaded video and live streaming playback must be HLS only.
- HLS packaging policy: use fMP4 segments (not MPEG-TS segments).
- Do not expose raw source files for playback endpoints.
- If requirements mention DASH or direct file playback, convert the implementation to HLS (fMP4) unless explicitly overridden by the user.
