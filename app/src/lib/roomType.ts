import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { ImageSourcePropType } from "react-native";
import { TranslationKey } from "./i18n";

// Which kind of room the one ESP32 is in -- only changes the hero card's
// name and photo on the Home screen. Per-device preference, not synced:
// there is still exactly one real room (room1) behind it.
export type RoomType = "living" | "master" | "kids" | "kitchen";

export const ROOM_TYPES: {
  key: RoomType;
  label: TranslationKey;
  on: ImageSourcePropType;
  off: ImageSourcePropType;
}[] = [
  {
    key: "living",
    label: "roomLiving",
    on: require("../../assets/rooms/room-living-on.jpg"),
    off: require("../../assets/rooms/room-living-off.jpg"),
  },
  {
    key: "master",
    label: "roomMaster",
    on: require("../../assets/rooms/room-master-on.jpg"),
    off: require("../../assets/rooms/room-master-off.jpg"),
  },
  {
    key: "kids",
    label: "roomKids",
    on: require("../../assets/rooms/room-kids-on.jpg"),
    off: require("../../assets/rooms/room-kids-off.jpg"),
  },
  {
    key: "kitchen",
    label: "roomKitchen",
    on: require("../../assets/rooms/room-kitchen-on.jpg"),
    off: require("../../assets/rooms/room-kitchen-off.jpg"),
  },
];

const STORAGE_KEY = "wattwise:room-type";

export function useRoomType() {
  const [roomType, setRoomTypeState] = useState<RoomType>("living");

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (ROOM_TYPES.some((r) => r.key === saved)) setRoomTypeState(saved as RoomType);
      })
      .catch(() => {});
  }, []);

  function setRoomType(next: RoomType) {
    setRoomTypeState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }

  const room = ROOM_TYPES.find((r) => r.key === roomType) ?? ROOM_TYPES[0];
  return { roomType, setRoomType, room };
}
