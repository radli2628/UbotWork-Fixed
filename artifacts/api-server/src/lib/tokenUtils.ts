const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function segment(): string {
  return Array.from(
    { length: 4 },
    () => CHARS[Math.floor(Math.random() * CHARS.length)],
  ).join("");
}

export function generateToken(): string {
  return `${segment()}-${segment()}-${segment()}-${segment()}`;
}
