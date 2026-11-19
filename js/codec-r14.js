import { isValidMusicState, normalizeMusicState, serializableMusicState } from "./model-r14.js";

function toBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export function encodeMusicState(state) {
  const json = JSON.stringify(serializableMusicState(state));
  return toBase64Url(new TextEncoder().encode(json));
}

export function decodeMusicState(encoded) {
  try {
    const json = new TextDecoder("utf-8", { fatal: true }).decode(fromBase64Url(encoded));
    const value = JSON.parse(json);
    return isValidMusicState(value) ? normalizeMusicState(value) : null;
  } catch {
    return null;
  }
}

export function readMusicStateFromHash(hash = window.location.hash) {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const encoded = params.get("s");
  return encoded ? decodeMusicState(encoded) : null;
}

export function buildShareUrl(state, location = window.location) {
  const url = new URL(location.href);
  url.hash = `s=${encodeMusicState(state)}`;
  return url.toString();
}
