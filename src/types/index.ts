export type User = { id?: number; fullName: string; email: string };
export type TrashCan = {
  TrashCanID: number; Name: string; MacAddress?: string; Capacity?: number; Status?: string;
  FillLevel?: number | null; OrganicFillLevel?: number | null; InorganicFillLevel?: number | null;
  LidState?: string | null;
  OrganicLidState?: string | null;
  InorganicLidState?: string | null;
  RecordedAt?: string | null; LocationName?: string | null;
  Latitude?: number | null; Longitude?: number | null;
};
export type WasteClassification = {
  wasteType: string; category: string; confidence: number; recyclable: boolean;
  binColor: string; instructions: string[]; note: string; binCompartment?: string; classificationMode?: "ai" | "demo" | "hybrid-api" | "on-device";
  material?: string;
  disposalMethod?: string;
  imageUrl?: string;
  bbox?: number[] | null;
  bestClass?: string;
};
export type AppNotification = {
  id: string; title: string; message: string; type: "full" | "bin-event" | "system";
  createdAt: string; imageUrl?: string | null; read?: boolean; detectedLabel?: string; category?: string; confidence?: number; binCompartment?: string; instructions?: string[]; disposalMethod?: string; note?: string;
};
