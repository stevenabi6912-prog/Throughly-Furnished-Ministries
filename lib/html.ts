import "server-only";
import sanitizeHtml from "sanitize-html";

// Lesson and assignment bodies are stored as HTML (that's what the
// LearnDash import produces, and what admins paste in). Everything is
// sanitized before it's stored so rendering it is safe.
export function cleanHtml(dirty: string): string {
  return sanitizeHtml(dirty, {
    allowedTags: [
      ...sanitizeHtml.defaults.allowedTags,
      "img",
      "iframe",
      "figure",
      "figcaption",
      "audio",
      "video",
      "source",
    ],
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      img: ["src", "alt", "width", "height"],
      iframe: ["src", "width", "height", "allow", "allowfullscreen", "title"],
      audio: ["src", "controls"],
      video: ["src", "controls", "width", "height", "poster"],
      source: ["src", "type"],
      "*": ["class"],
    },
    // Videos embedded in lessons — YouTube/Vimeo only.
    allowedIframeHostnames: [
      "www.youtube.com",
      "www.youtube-nocookie.com",
      "player.vimeo.com",
    ],
  });
}
