import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";

// Lets the user pick a photo from the gallery, crop it square, and shrinks
// it to 256 px wide JPEG so it's small enough to keep in the database.
// Returns a data URI, or null if the user cancelled.
export async function pickProfilePhoto(): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) throw new Error("permission");

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  });
  if (result.canceled || !result.assets?.[0]) return null;

  const small = await ImageManipulator.manipulateAsync(
    result.assets[0].uri,
    [{ resize: { width: 256 } }], // width only, so the height keeps its proportion
    { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
  );
  if (!small.base64) return null;
  return `data:image/jpeg;base64,${small.base64}`;
}
