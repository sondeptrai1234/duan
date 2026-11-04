export type User = { id?: number; fullName: string; email: string };
export type TrashCan = {
  TrashCanID: number; Name: string; MacAddress?: string; Capacity?: number; Status?: string;
  FillLevel?: number | null; Temperature?: number | null; Humidity?: number | null;
  LidState?: string | null; RecordedAt?: string | null; LocationName?: string | null;
  Latitude?: number | null; Longitude?: number | null;
};
export type WasteClassification = {
  wasteType: string; category: string; confidence: number; recyclable: boolean;
  binColor: string; instructions: string[]; note: string; classificationMode?: "ai" | "demo";
};
export type AppNotification = {
  id: string; title: string; message: string; type: "full" | "temperature" | "bin-event" | "system";
  createdAt: string; imageUrl?: string | null; read?: boolean; detectedLabel?: string; category?: string; confidence?: number;
};
