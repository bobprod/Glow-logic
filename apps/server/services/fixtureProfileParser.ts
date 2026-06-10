import { inflateRawSync } from "zlib";

export interface ParsedFixtureChannel {
  channel: number;
  function: string;
  name: string;
  type: string;
  minValue: number;
  maxValue: number;
  notes?: string;
}

export interface ParsedFixtureMode {
  name: string;
  channels: ParsedFixtureChannel[];
}

export interface ParsedFixtureProfile {
  manufacturer: string;
  model: string;
  type: string;
  modes: ParsedFixtureMode[];
  sourceFormat: "qxf" | "gdtf";
}

function decodeXml(value: string) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .trim();
}

function getAttr(tag: string, name: string) {
  const match = tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, "i"));
  return match ? decodeXml(match[1]) : "";
}

function getText(xml: string, tagName: string) {
  const match = xml.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i"));
  return match ? decodeXml(match[1].replace(/<[^>]+>/g, " ")) : "";
}

function normalizeType(raw: string) {
  const value = raw.toLowerCase().replace(/[_\s-]+/g, "");
  if (value.includes("intensity") || value.includes("dimmer")) return "dimmer";
  if (value.includes("pan")) return value.includes("fine") ? "pan_fine" : "pan";
  if (value.includes("tilt")) return value.includes("fine") ? "tilt_fine" : "tilt";
  if (value.includes("red")) return "red";
  if (value.includes("green")) return "green";
  if (value.includes("blue")) return "blue";
  if (value.includes("white")) return "white";
  if (value.includes("amber")) return "amber";
  if (value.includes("uv") || value.includes("ultraviolet")) return "uv";
  if (value.includes("color") || value.includes("colour")) return "color_wheel";
  if (value.includes("gobo")) return value.includes("rot") ? "gobo_rotation" : "gobo";
  if (value.includes("strobe")) return "strobe";
  if (value.includes("shutter")) return "shutter";
  if (value.includes("zoom")) return "zoom";
  if (value.includes("focus")) return "focus";
  if (value.includes("iris")) return "iris";
  if (value.includes("prism")) return "prism";
  if (value.includes("speed")) return "speed";
  if (value.includes("reset")) return "reset";
  if (value.includes("macro") || value.includes("effect")) return "macro";
  return "other";
}

function parseQxf(xml: string): ParsedFixtureProfile {
  const manufacturer = getText(xml, "Manufacturer") || "Generic";
  const model = getText(xml, "Model") || "QXF Fixture";
  const type = getText(xml, "Type") || "DMX Fixture";
  const channelDefinitions = new Map<string, ParsedFixtureChannel>();

  for (const match of xml.matchAll(/<Channel\b([^>]*)>([\s\S]*?)<\/Channel>/gi)) {
    const channelName = getAttr(match[1], "Name") || `Channel ${channelDefinitions.size + 1}`;
    const body = match[2];
    const groupMatch = body.match(/<Group\b([^>]*)>([\s\S]*?)<\/Group>/i);
    const groupText = groupMatch ? decodeXml(groupMatch[2].replace(/<[^>]+>/g, " ")) : channelName;
    const capabilityMatch = body.match(/<Capability\b([^>]*)>([\s\S]*?)<\/Capability>/i);
    const minValue = capabilityMatch ? Number(getAttr(capabilityMatch[1], "Min") || 0) : 0;
    const maxValue = capabilityMatch ? Number(getAttr(capabilityMatch[1], "Max") || 255) : 255;

    channelDefinitions.set(channelName, {
      channel: channelDefinitions.size + 1,
      function: channelName,
      name: channelName,
      type: normalizeType(`${groupText} ${channelName}`),
      minValue: Number.isFinite(minValue) ? minValue : 0,
      maxValue: Number.isFinite(maxValue) ? maxValue : 255,
      notes: capabilityMatch ? decodeXml(capabilityMatch[2].replace(/<[^>]+>/g, " ")) : undefined,
    });
  }

  const modes: ParsedFixtureMode[] = [];
  for (const modeMatch of xml.matchAll(/<Mode\b([^>]*)>([\s\S]*?)<\/Mode>/gi)) {
    const name = getAttr(modeMatch[1], "Name") || `Mode ${modes.length + 1}`;
    const channels: ParsedFixtureChannel[] = [];
    for (const channelRef of modeMatch[2].matchAll(/<Channel\b([^>]*)>([\s\S]*?)<\/Channel>/gi)) {
      const zeroBased = Number(getAttr(channelRef[1], "Number"));
      const channelName = decodeXml(channelRef[2].replace(/<[^>]+>/g, " "));
      const definition = channelDefinitions.get(channelName);
      if (!definition) continue;
      channels.push({ ...definition, channel: Number.isFinite(zeroBased) ? zeroBased + 1 : channels.length + 1 });
    }
    if (channels.length > 0) {
      modes.push({ name, channels: channels.sort((a, b) => a.channel - b.channel) });
    }
  }

  const fallbackChannels = [...channelDefinitions.values()].map((channel, index) => ({ ...channel, channel: index + 1 }));
  return {
    manufacturer,
    model,
    type,
    modes: modes.length > 0 ? modes : [{ name: `${fallbackChannels.length}ch`, channels: fallbackChannels }],
    sourceFormat: "qxf",
  };
}

function parseDmxFrom(raw: string) {
  const match = raw.match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function parseGdtfXml(xml: string): ParsedFixtureProfile {
  const fixtureTag = xml.match(/<FixtureType\b([^>]*)>/i)?.[1] || "";
  const manufacturer = getAttr(fixtureTag, "Manufacturer") || "Generic";
  const model = getAttr(fixtureTag, "LongName") || getAttr(fixtureTag, "Name") || "GDTF Fixture";
  const type = getAttr(fixtureTag, "ShortName") || "GDTF";
  const modes: ParsedFixtureMode[] = [];

  for (const modeMatch of xml.matchAll(/<DMXMode\b([^>]*)>([\s\S]*?)<\/DMXMode>/gi)) {
    const name = getAttr(modeMatch[1], "Name") || `Mode ${modes.length + 1}`;
    const channels: ParsedFixtureChannel[] = [];
    for (const dmxMatch of modeMatch[2].matchAll(/<DMXChannel\b([^>]*)>([\s\S]*?)<\/DMXChannel>/gi)) {
      const offsetRaw = getAttr(dmxMatch[1], "Offset");
      const channel = Number((offsetRaw.match(/\d+/) || [channels.length + 1])[0]);
      const logicalTag = dmxMatch[2].match(/<LogicalChannel\b([^>]*)>/i)?.[1] || "";
      const functionTag = dmxMatch[2].match(/<ChannelFunction\b([^>]*)\/?>/i)?.[1] || "";
      const attribute = getAttr(functionTag, "Attribute") || getAttr(logicalTag, "Attribute") || `Channel ${channel}`;
      const pretty = getAttr(functionTag, "Name") || attribute;
      const dmxFrom = parseDmxFrom(getAttr(functionTag, "DMXFrom"));

      channels.push({
        channel,
        function: pretty,
        name: pretty,
        type: normalizeType(attribute),
        minValue: dmxFrom,
        maxValue: 255,
      });
    }
    if (channels.length > 0) {
      modes.push({ name, channels: channels.sort((a, b) => a.channel - b.channel) });
    }
  }

  return {
    manufacturer,
    model,
    type,
    modes: modes.length > 0 ? modes : [{ name: "Default", channels: [] }],
    sourceFormat: "gdtf",
  };
}

function readZipEntries(buffer: Buffer) {
  const entries: Array<{ name: string; data: Buffer }> = [];
  let offset = 0;
  while (offset < buffer.length - 30) {
    if (buffer.readUInt32LE(offset) !== 0x04034b50) {
      offset += 1;
      continue;
    }
    const flags = buffer.readUInt16LE(offset + 6);
    const method = buffer.readUInt16LE(offset + 8);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const fileNameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const dataStart = nameStart + fileNameLength + extraLength;
    const name = buffer.slice(nameStart, nameStart + fileNameLength).toString("utf8");
    if ((flags & 0x08) !== 0 || compressedSize <= 0 || dataStart + compressedSize > buffer.length) {
      offset = dataStart + Math.max(0, compressedSize);
      continue;
    }
    const compressed = buffer.slice(dataStart, dataStart + compressedSize);
    const data = method === 0 ? compressed : method === 8 ? inflateRawSync(compressed) : Buffer.alloc(0);
    if (data.length > 0) entries.push({ name, data });
    offset = dataStart + compressedSize;
  }
  return entries;
}

export function parseFixtureProfileFile(fileName: string, buffer: Buffer): ParsedFixtureProfile {
  const lowerName = fileName.toLowerCase();
  const isZip = buffer.length >= 4 && buffer.readUInt32LE(0) === 0x04034b50;

  if (lowerName.endsWith(".gdtf") || isZip) {
    if (isZip) {
      const description = readZipEntries(buffer).find((entry) => entry.name.toLowerCase().endsWith("description.xml"));
      if (!description) throw new Error("Description.xml introuvable dans le GDTF.");
      return parseGdtfXml(description.data.toString("utf8"));
    }
    return parseGdtfXml(buffer.toString("utf8"));
  }

  if (lowerName.endsWith(".qxf") || buffer.toString("utf8", 0, Math.min(buffer.length, 200)).includes("<FixtureDefinition")) {
    return parseQxf(buffer.toString("utf8"));
  }

  throw new Error("Format profil non supporte. Importez un .qxf, .gdtf ou XML GDTF.");
}
