import { BinaryParser } from './BinaryParser';
import { GP200PresetSchema, type GP200Preset } from './types';

// TODO: Confirm actual byte offsets via reverse engineering of real .prst files
export const PRST_MAGIC = 'PRST';
const OFFSET_MAGIC = 0;
const OFFSET_VERSION = 4;
const OFFSET_PATCH_NAME = 8;
const PATCH_NAME_LENGTH = 12;
// const OFFSET_EFFECTS = 20; // TODO: determine
// const OFFSET_CHECKSUM = ???; // TODO: determine

export class PRSTDecoder {
  private parser: BinaryParser;

  constructor(buffer: Uint8Array) {
    this.parser = new BinaryParser(buffer);
  }

  hasMagic(): boolean {
    return this.parser.readAscii(OFFSET_MAGIC, 4) === PRST_MAGIC;
  }

  decode(): GP200Preset {
    if (!this.hasMagic()) {
      throw new Error('Invalid .prst file: magic header not found');
    }

    const version = String(this.parser.readUint8(OFFSET_VERSION));
    const patchName = this.parser.readAscii(OFFSET_PATCH_NAME, PATCH_NAME_LENGTH);

    // TODO: Decode effect slots once format is known
    const effects: GP200Preset['effects'] = [];

    // TODO: Determine checksum offset
    const checksum = 0;

    const preset = { version, patchName, effects, checksum };
    return GP200PresetSchema.parse(preset);
  }
}
