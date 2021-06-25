import { readFileSync } from "fs";

import {
  checkPaddedBlock,
  decryptJSONFile,
  deriveEncryptedFileKeyEntropy,
  deriveEncryptedFileSeed,
  deriveEncryptedFileTweak,
  encodeEncryptedFileMetadata,
  ENCRYPTED_JSON_RESPONSE_VERSION,
  ENCRYPTION_KEY_LENGTH,
  ENCRYPTION_HIDDEN_FIELD_METADATA_LENGTH,
  ENCRYPTION_NONCE_LENGTH,
  encryptJSONFile,
  padFileSize,
} from "./encrypted_files";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      toEqualUint8Array(argument: Uint8Array): R;
    }
  }
}

expect.extend({
  // source https://stackoverflow.com/a/60818105/6085242
  toEqualUint8Array(received: Uint8Array, argument: Uint8Array) {
    if (received.length !== argument.length) {
      return { pass: false, message: () => `expected ${received} to equal ${argument}` };
    }
    for (let i = 0; i < received.length; i++) {
      if (received[i] !== argument[i]) {
        return { pass: false, message: () => `expected ${received} to equal ${argument}` };
      }
    }
    return { pass: true, message: () => `expected ${received} not to equal ${argument}` };
  },
});

describe("deriveEncryptedFileKeyEntropy", () => {
  it("Should derive the correct encrypted file key entropy", () => {
    // Hard-code expected value to catch breaking changes.
    const pathSeed = "a".repeat(64);
    const expectedEntropy = [
      145, 247, 132, 82, 184, 94, 1, 97, 214, 174, 84, 50, 40, 0, 247, 144, 106, 110, 227, 25, 193, 138, 249, 233, 32,
      94, 186, 244, 48, 171, 115, 171,
    ];

    const result = deriveEncryptedFileKeyEntropy(pathSeed);

    expect(result).toEqualUint8Array(new Uint8Array(expectedEntropy));
  });
});

describe("deriveEncryptedFileSeed", () => {
  it("Should derive the correct encrypted file seed", () => {
    // Hard-code expected value to catch breaking changes.
    const pathSeed = "a".repeat(64);
    const subPath = "path/to/file.json";

    // Derive seed for a file.
    const fileSeed = deriveEncryptedFileSeed(pathSeed, subPath, false);

    expect(fileSeed).toEqual("ace80613629a4049386b3007c17aa9aa2a7f86a7649326c03d56eb40df23593b");

    // Derive seed for a directory.
    const directorySeed = deriveEncryptedFileSeed(pathSeed, subPath, true);

    expect(directorySeed).toEqual("fa91607af922c9e57d794b7980e550fb15db99e62960fb0908b0f5af10afaf16");

    expect(fileSeed).not.toEqual(directorySeed);
  });
});

describe("deriveEncryptedFileTweak", () => {
  it("Should derive the correct encrypted file tweak", () => {
    // Hard-code expected value to catch breaking changes.
    const seed = "test.hns/foo";
    const expectedTweak = "352140f347807438f8f74edf3e0750a408f39b9f2ae4147eb9055d396b467fc8";

    const result = deriveEncryptedFileTweak(seed);

    expect(result).toEqual(expectedTweak);
  });
});

const encryptedTestFilePath = "test_data/encrypted-json-file";
const json = { message: "text" };
const v = ENCRYPTED_JSON_RESPONSE_VERSION;
const fullData = { _data: json, _v: v };
const key = new Uint8Array(ENCRYPTION_KEY_LENGTH);
const fileData = new Uint8Array(readFileSync(encryptedTestFilePath));

describe("decryptJSONFile", () => {
  it("Should decrypt the given test data", () => {
    expect(fileData.length).toEqual(4096);

    const result = decryptJSONFile(fileData, key);

    expect(result).toEqual(fullData);
  });

  it("Should fail to decrypt bad data", () => {
    expect(() => decryptJSONFile(new Uint8Array(4096), key)).toThrowError(
      "Received unrecognized JSON response version '0', expected '1'"
    );
  });

  it("Should fail to decrypt data with a corrupted nonce", () => {
    const data = fileData.slice();
    data[0]++;
    expect(() => decryptJSONFile(data, key)).toThrowError("Could not decrypt given encrypted JSON file");
  });

  it("Should fail to decrypt data with a corrupted metadata", () => {
    const data = fileData.slice();
    data[ENCRYPTION_NONCE_LENGTH]++;
    expect(() => decryptJSONFile(data, key)).toThrowError(
      "Received unrecognized JSON response version '2', expected '1'"
    );
  });

  it("Should fail to decrypt data with corrupted encrypted bytes", () => {
    const data = fileData.slice();
    data[ENCRYPTION_NONCE_LENGTH + ENCRYPTION_HIDDEN_FIELD_METADATA_LENGTH]++;
    expect(() => decryptJSONFile(data, key)).toThrowError("Could not decrypt given encrypted JSON file");
  });

  it("Should fail to decrypt data that was not padded correctly", () => {
    const data = fileData.slice(0, fileData.length - 1);
    expect(data.length).toEqual(4095);
    expect(() => decryptJSONFile(data, key)).toThrowError(
      "Expected parameter 'data' to be padded encrypted data, length was '4095', was type 'object', value '174,167,134,21,46,207,180,245,44,139,11,69,252,151,172,83,91,4,3,35,8,124,58,113,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,216,246,27,114,110,131,41,62,175,48,210,216,97,136,48,8,79,76,33,85,100,240,252,91,188,153,39,76,217,94,167,68,133,137,216,208,244,253,19,105,85,177,254,135,12,20,24,85,185,165,5,14,89,243,15,157,237,128,66,76,41,181,192,187,199,218,199,82,43,134,154,161,91,215,191,119,33,42,7,137,188,71,228,251,245,222,30,193,...'"
    );
  });
});

describe("encryptJSONFile", () => {
  const result = encryptJSONFile(fullData, key);

  expect(result.length).toEqual(4096);
});

describe("encodeEncryptedFileMetadata", () => {
  it("Should fail to encode metadata with an invalid version", () => {
    const version = 256;
    const metadata = { version };
    expect(() => encodeEncryptedFileMetadata(metadata)).toThrowError(
      `Metadata version '${version}' could not be stored in a uint8`
    );
  });
});

const kib = 1 << 10;
const mib = 1 << 20;
const gib = 1 << 30;

describe("padFileSize", () => {
  const sizes = [
    [1 * kib, 4 * kib],
    [4 * kib, 4 * kib],
    [5 * kib, 8 * kib],
    [105 * kib, 112 * kib],
    [305 * kib, 320 * kib],
    [351 * kib, 352 * kib],
    [352 * kib, 352 * kib],
    [mib, mib],
    [100 * mib, 104 * mib],
    [gib, gib],
    [100 * gib, 104 * gib],
  ];

  it.each(sizes)("Should pad the file size %s to %s", (initialSize, expectedSize) => {
    const size = padFileSize(initialSize);
    expect(size).toEqual(expectedSize);
    expect(checkPaddedBlock(size)).toBeTruthy();
  });

  it("Should throw on a really big number.", () => {
    expect(() => padFileSize(Number.MAX_SAFE_INTEGER)).toThrowError("Could not pad file size, overflow detected.");
  });
});

describe("checkPaddedBlock", () => {
  const sizes: Array<[number, boolean]> = [
    [1 * kib, false],
    [4 * kib, true],
    [5 * kib, false],
    [105 * kib, false],
    [305 * kib, false],
    [351 * kib, false],
    [352 * kib, true],
    [mib, true],
    [100 * mib, false],
    [gib, true],
    [100 * gib, false],
  ];

  it.each(sizes)("checkPaddedBlock(%s) should return %s", (size, isPadded) => {
    expect(checkPaddedBlock(size)).toEqual(isPadded);
  });

  it("Should throw on a really big number.", () => {
    expect(() => checkPaddedBlock(Number.MAX_SAFE_INTEGER)).toThrowError(
      "Could not check padded file size, overflow detected."
    );
  });
});
