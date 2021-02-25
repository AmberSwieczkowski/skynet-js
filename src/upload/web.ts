import { AxiosResponse } from "axios";

import { getFileMimeType, formatSkylink } from "../utils";
import { SkynetClient } from "../client/web";
import { CustomUploadOptions, defaultUploadOptions, UploadRequestResponse } from "./index";

/**
 * Uploads a file to Skynet.
 *
 * @param this - SkynetClient
 * @param file - The file to upload.
 * @param [customOptions] - Additional settings that can optionally be set.
 * @param [customOptions.endpointPath="/skynet/skyfile"] - The relative URL path of the portal endpoint to contact.
 * @returns - The returned skylink.
 * @throws - Will throw if the request is successful but the upload response does not contain a complete response.
 */
export async function uploadFile(
  this: SkynetClient,
  file: File,
  customOptions?: CustomUploadOptions
): Promise<UploadRequestResponse> {
  const response = await this.uploadFileRequest(file, customOptions);

  if (
    typeof response.data.skylink !== "string" ||
    typeof response.data.merkleroot !== "string" ||
    typeof response.data.bitfield !== "number"
  ) {
    throw new Error(
      "Did not get a complete upload response despite a successful request. Please try again and report this issue to the devs if it persists."
    );
  }

  const skylink = formatSkylink(response.data.skylink);
  const merkleroot = response.data.merkleroot;
  const bitfield = response.data.bitfield;

  return { skylink, merkleroot, bitfield };
}

/**
 * Makes a request to upload a file to Skynet.
 *
 * @param this - SkynetClient
 * @param file - The file to upload.
 * @param [customOptions] - Additional settings that can optionally be set.
 * @param [customOptions.endpointPath="/skynet/skyfile"] - The relative URL path of the portal endpoint to contact.
 * @returns - The upload response.
 */
export async function uploadFileRequest(
  this: SkynetClient,
  file: File,
  customOptions?: CustomUploadOptions
): Promise<AxiosResponse> {
  const opts = { ...defaultUploadOptions, ...this.customOptions, ...customOptions };
  const formData = new FormData();

  file = ensureFileObjectConsistency(file);
  if (opts.customFilename) {
    formData.append(opts.portalFileFieldname, file, opts.customFilename);
  } else {
    formData.append(opts.portalFileFieldname, file);
  }

  return this.executeRequest({
    ...opts,
    method: "post",
    data: formData,
  });
}

/**
 * Uploads a directory to Skynet.
 *
 * @param this - SkynetClient
 * @param directory - File objects to upload, indexed by their path strings.
 * @param filename - The name of the directory.
 * @param [customOptions] - Additional settings that can optionally be set.
 * @param [customOptions.endpointPath="/skynet/skyfile"] - The relative URL path of the portal endpoint to contact.
 * @returns - The returned skylink.
 * @throws - Will throw if the request is successful but the upload response does not contain a complete response.
 */
export async function uploadDirectory(
  this: SkynetClient,
  directory: Record<string, File>,
  filename: string,
  customOptions?: CustomUploadOptions
): Promise<UploadRequestResponse> {
  const response = await this.uploadDirectoryRequest(directory, filename, customOptions);

  if (
    typeof response.data.skylink !== "string" ||
    typeof response.data.merkleroot !== "string" ||
    typeof response.data.bitfield !== "number"
  ) {
    throw new Error(
      "Did not get a complete upload response despite a successful request. Please try again and report this issue to the devs if it persists."
    );
  }

  const skylink = formatSkylink(response.data.skylink);
  const merkleroot = response.data.merkleroot;
  const bitfield = response.data.bitfield;

  return { skylink, merkleroot, bitfield };
}

/**
 * Makes a request to upload a directory to Skynet.
 *
 * @param this - SkynetClient
 * @param directory - File objects to upload, indexed by their path strings.
 * @param filename - The name of the directory.
 * @param [customOptions] - Additional settings that can optionally be set.
 * @param [customOptions.endpointPath="/skynet/skyfile"] - The relative URL path of the portal endpoint to contact.
 * @returns - The upload response.
 * @throws - Will throw if the input filename is not a string.
 */
export async function uploadDirectoryRequest(
  this: SkynetClient,
  directory: Record<string, File>,
  filename: string,
  customOptions?: CustomUploadOptions
): Promise<AxiosResponse> {
  /* istanbul ignore next */
  if (typeof filename !== "string") {
    throw new Error(`Expected parameter filename to be type string, was type ${typeof filename}`);
  }

  const opts = { ...defaultUploadOptions, ...this.customOptions, ...customOptions };
  const formData = new FormData();

  Object.entries(directory).forEach(([path, file]) => {
    file = ensureFileObjectConsistency(file as File);
    formData.append(opts.portalDirectoryFileFieldname, file as File, path);
  });

  return this.executeRequest({
    ...opts,
    method: "post",
    data: formData,
    query: { filename },
  });
}

/**
 * Sometimes file object might have had the type property defined manually with
 * Object.defineProperty and some browsers (namely firefox) can have problems
 * reading it after the file has been appended to form data. To overcome this,
 * we recreate the file object using native File constructor with a type defined
 * as a constructor argument.
 *
 * @param file - The input file.
 * @returns - The processed file.
 * @see {@link https://github.com/NebulousLabs/skynet-webportal/issues/290| Related Issue}
 */
function ensureFileObjectConsistency(file: File): File {
  return new File([file], file.name, { type: getFileMimeType(file) });
}
