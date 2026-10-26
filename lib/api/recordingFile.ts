import { File, Paths } from "expo-file-system";

/** Wait for the native copy to finish before exposing a clip to upload/playback. */
export async function saveRecordedClip(uri: string): Promise<string> {
  const source = new File(uri);
  if (!source.exists || source.size <= 0) {
    throw new Error("Walang laman o hindi makita ang recording. Mag-record po muli.");
  }
  const target = new File(Paths.document, `report-${Date.now()}-${Math.random().toString(36).slice(2)}.m4a`);
  await source.copy(target);
  if (!target.exists || target.size <= 0 || target.size !== source.size) {
    throw new Error("Hindi kumpleto ang pag-save ng recording. Mag-record po muli.");
  }
  return target.uri;
}
