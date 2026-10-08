'use strict';

function decode(value) {
  return decodeURIComponent(value.replace(/\+/g, ' '));
}

function encode(value) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

function parse(query) {
  const result = Object.create(null);
  const source = (query || '').replace(/^\?/, '');

  if (!source) {
    return result;
  }

  for (const pair of source.split('&')) {
    if (!pair) continue;

    const separator = pair.indexOf('=');
    const key = decode(separator === -1 ? pair : pair.slice(0, separator));
    const value = decode(separator === -1 ? '' : pair.slice(separator + 1));

    if (Object.prototype.hasOwnProperty.call(result, key)) {
      result[key] = Array.isArray(result[key]) ? [...result[key], value] : [result[key], value];
    } else {
      result[key] = value;
    }
  }

  return result;
}

function stringify(object, options = {}) {
  const entries = [];

  for (const [key, value] of Object.entries(object || {})) {
    if (value === undefined) continue;

    const values = Array.isArray(value) ? value : [value];
    for (const item of values) {
      if (item === undefined) continue;
      entries.push([key, item === null ? '' : String(item)]);
    }
  }

  if (options.sort !== false) {
    entries.sort(([left], [right]) => left.localeCompare(right));
  }

  return entries.map(([key, value]) => `${encode(key)}=${encode(value)}`).join('&');
}

exports.parse = parse;
exports.stringify = stringify;
