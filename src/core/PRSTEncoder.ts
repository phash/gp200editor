import { BufferGenerator } from './BufferGenerator';
import { GP200PresetSchema, type GP200Preset } from './types';

// TODO: Same offsets as Decoder — update when format is known
const PRST_MAGIC = 'PRST';
const TOTAL_SIZE = 512; // TODO: determine actual size
const OFFSET_MAGIC = 0;
const OFFSET_VERSION = 4;
const OFFSET_PATCH_NAME = 8;
const PATCH_NAME_LENGTH = 12;

export class PRSTEncoder {
  encode(preset: GP200Preset): ArrayBuffer {
    GP200PresetSchema.parse(preset); // Validate before writing

    const gen = new BufferGenerator(TOTAL_SIZE);

    gen.writeAscii(OFFSET_MAGIC, PRST_MAGIC, 4);
    gen.writeUint8(OFFSET_VERSION, parseInt(preset.version, 10));
    gen.writeAscii(OFFSET_PATCH_NAME, preset.patchName, PATCH_NAME_LENGTH);

    // TODO: Write effect slots once format is known
    // TODO: Calculate and write checksum

    return gen.toArrayBuffer();
  }
}
