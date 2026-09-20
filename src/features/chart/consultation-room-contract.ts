import type { WorkspaceSpaceManagementSnapshot } from "@/features/hospital-admin/space-management/model";

export type ConsultationCallRoom = {
  id: string;
  name: string;
  spaceType: "consultation_room";
  status: "active";
  isCallTarget: true;
  sortOrder: number;
};

export type ConsultationCallRoomResponse = {
  workspaceId: string;
  rooms: ConsultationCallRoom[];
};

export function getConsultationCallRooms(
  snapshot: WorkspaceSpaceManagementSnapshot,
): ConsultationCallRoom[] {
  return snapshot.categories
    .filter((category) => category.iconKey === "consult")
    .flatMap((category) => category.spaces)
    .sort(
      (left, right) =>
        left.sortOrder - right.sortOrder || left.name.localeCompare(right.name, "ko-KR"),
    )
    .map((space) => ({
      id: space.id,
      name: space.name,
      spaceType: "consultation_room" as const,
      status: "active" as const,
      isCallTarget: true as const,
      sortOrder: space.sortOrder,
    }));
}

export function getConsultationCallRoomById(
  snapshot: WorkspaceSpaceManagementSnapshot,
  roomId?: string,
) {
  return roomId
    ? getConsultationCallRooms(snapshot).find((room) => room.id === roomId)
    : undefined;
}

export function parseConsultationCallRoomResponse(
  value: unknown,
): ConsultationCallRoomResponse | null {
  if (!isRecord(value) || typeof value.workspaceId !== "string" || !Array.isArray(value.rooms)) {
    return null;
  }

  const roomIds = new Set<string>();
  const rooms: ConsultationCallRoom[] = [];
  for (const valueRoom of value.rooms) {
    if (
      !isRecord(valueRoom) ||
      typeof valueRoom.id !== "string" ||
      typeof valueRoom.name !== "string" ||
      valueRoom.spaceType !== "consultation_room" ||
      valueRoom.status !== "active" ||
      valueRoom.isCallTarget !== true ||
      !Number.isInteger(valueRoom.sortOrder) ||
      Number(valueRoom.sortOrder) < 0 ||
      roomIds.has(valueRoom.id)
    ) {
      return null;
    }
    roomIds.add(valueRoom.id);
    rooms.push({
      id: valueRoom.id,
      name: valueRoom.name,
      spaceType: "consultation_room",
      status: "active",
      isCallTarget: true,
      sortOrder: Number(valueRoom.sortOrder),
    });
  }

  return { workspaceId: value.workspaceId, rooms };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
